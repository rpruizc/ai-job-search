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
      .prepare(
        `SELECT id, title, created_at, updated_at
         FROM conversations
         WHERE id = ? AND user_id = ?`
      )
      .get(id, dbUserId);

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { id } = await params;
    const db = getDb();
    const result = db
      .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
      .run(id, dbUserId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
