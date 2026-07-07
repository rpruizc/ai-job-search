import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const { dbUserId } = await requireAuth();
    const db = getDb();
    const conversations = db
      .prepare(
        `SELECT id, title, created_at, updated_at
         FROM conversations
         WHERE user_id = ?
         ORDER BY updated_at DESC`
      )
      .all(dbUserId);
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST() {
  try {
    const { dbUserId } = await requireAuth();
    const db = getDb();
    const result = db
      .prepare("INSERT INTO conversations (user_id) VALUES (?)")
      .run(dbUserId);
    const conversation = db
      .prepare("SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json(conversation, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
