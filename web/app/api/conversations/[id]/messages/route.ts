import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { id } = await params;
    const db = getDb();

    const conversation = db
      .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
      .get(id, dbUserId);

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = db
      .prepare(
        `SELECT id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`
      )
      .all(id);

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
