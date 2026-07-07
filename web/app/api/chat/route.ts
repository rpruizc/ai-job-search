import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { dbUserId } = await requireAuth();
    const { message, conversationId } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
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
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    }

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)"
    ).run(convId, message.trim());

    const echoContent = `Echo: ${message.trim()}\n\n*(LLM not connected yet — this is a mock response. Claude integration coming in Task #4.)*`;

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)"
    ).run(convId, echoContent);

    db.prepare(
      "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
    ).run(convId);

    const assistantMessage = db
      .prepare("SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1")
      .get(convId) as { id: number; role: string; content: string; created_at: string };

    return NextResponse.json({
      conversationId: convId,
      message: assistantMessage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
