import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { chatStream, Message } from "@/lib/claude";
import { getSystemPrompt } from "@/lib/system-prompt";
import { parseCommand, handleCommand } from "@/lib/commands";

const MAX_CONTEXT_MESSAGES = 50;

export async function POST(request: NextRequest) {
  try {
    const { dbUserId } = await requireAuth();
    const { message, conversationId } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured. Please set AWS_BEARER_TOKEN_BEDROCK." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();
    let convId = conversationId;

    if (!convId) {
      const result = db
        .prepare("INSERT INTO conversations (user_id, title) VALUES (?, ?)")
        .run(dbUserId, message.slice(0, 50));
      convId = result.lastInsertRowid;
    } else {
      const conv = db
        .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
        .get(convId, dbUserId);
      if (!conv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)"
    ).run(convId, message.trim());

    const historyRows = db
      .prepare(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?"
      )
      .all(convId, MAX_CONTEXT_MESSAGES) as Message[];

    const messages: Message[] = historyRows.reverse();

    const command = parseCommand(message.trim());

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = "";

        const sendText = (text: string) => {
          fullContent += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`)
          );
        };

        const sendComplete = (usage: { input_tokens: number; output_tokens: number }) => {
          const assistantResult = db
            .prepare(
              "INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens) VALUES (?, 'assistant', ?, ?, ?)"
            )
            .run(convId, fullContent, usage.input_tokens, usage.output_tokens);

          db.prepare(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
          ).run(convId);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                conversationId: convId,
                messageId: assistantResult.lastInsertRowid,
                usage,
              })}\n\n`
            )
          );
          controller.close();
        };

        const sendError = (error: Error) => {
          const errorMessage = error.message?.includes("rate")
            ? "Please try again in a moment."
            : "Something went wrong generating a response.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
          );
          controller.close();
        };

        try {
          if (command) {
            const result = await handleCommand(
              command,
              dbUserId,
              convId as number,
              messages,
              sendText,
              sendComplete,
              sendError
            );

            if (result.handled) {
              if (!result.stream) {
                // Command completed synchronously - save and close
                const assistantResult = db
                  .prepare(
                    "INSERT INTO messages (conversation_id, role, content, input_tokens, output_tokens) VALUES (?, 'assistant', ?, 0, 0)"
                  )
                  .run(convId, fullContent);

                db.prepare(
                  "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
                ).run(convId);

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "done",
                      conversationId: convId,
                      messageId: assistantResult.lastInsertRowid,
                      usage: { input_tokens: 0, output_tokens: 0 },
                    })}\n\n`
                  )
                );
                controller.close();
              }
              return;
            }
          }

          // Not a command (or unrecognized command) - send to Claude
          const systemPrompt = getSystemPrompt(dbUserId);

          await chatStream(messages, { system: systemPrompt }, {
            onText: sendText,
            onComplete: sendComplete,
            onError: sendError,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          const errorMessage = msg.includes("rate") || msg.includes("throttl")
            ? "Please try again in a moment."
            : "Something went wrong generating a response.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
