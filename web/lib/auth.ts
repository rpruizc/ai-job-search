import { auth } from "@clerk/nextjs/server";
import { getDb } from "./db";

export async function requireAuth(): Promise<{ userId: string; dbUserId: number }> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  const row = db
    .prepare("SELECT id FROM users WHERE clerk_id = ?")
    .get(userId) as { id: number } | undefined;

  if (row) {
    return { userId, dbUserId: row.id };
  }

  const result = db
    .prepare("INSERT INTO users (clerk_id) VALUES (?)")
    .run(userId);

  return { userId, dbUserId: result.lastInsertRowid as number };
}
