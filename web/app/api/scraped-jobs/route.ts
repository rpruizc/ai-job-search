import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { dbUserId } = await requireAuth();
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const ranked = searchParams.get("ranked");

    let query = "SELECT * FROM scraped_jobs WHERE user_id = ?";
    const params: (number | string)[] = [dbUserId];

    if (ranked === "true") {
      query += " AND ranked = 1";
    } else if (ranked === "false") {
      query += " AND ranked = 0";
    }

    query += " ORDER BY COALESCE(rank_score, 0) DESC, scraped_at DESC";

    const jobs = db.prepare(query).all(...params);
    return Response.json(jobs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { dbUserId } = await requireAuth();
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      db.prepare("DELETE FROM scraped_jobs WHERE id = ? AND user_id = ?").run(
        Number(id),
        dbUserId
      );
    } else {
      db.prepare("DELETE FROM scraped_jobs WHERE user_id = ?").run(dbUserId);
    }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
