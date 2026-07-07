import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    return NextResponse.json({ status: "ok", db: row.ok === 1 });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: (e as Error).message },
      { status: 500 }
    );
  }
}
