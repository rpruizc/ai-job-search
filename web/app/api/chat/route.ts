import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { chatStream, Message } from "@/lib/claude";
import { getSystemPrompt } from "@/lib/system-prompt";

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

    const systemPrompt = getSystemPrompt();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = "";

        try {
          await chatStream(messages, { system: systemPrompt }, {
            onText(text) {
              fullContent += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`)
              );
            },
            onComplete(usage) {
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
            },
            onError(error) {
              const errorMessage = error.message?.includes("rate")
                ? "Please try again in a moment."
                : "Something went wrong generating a response.";
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
              );
              controller.close();
            },
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
