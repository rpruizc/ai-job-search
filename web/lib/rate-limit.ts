import { getDb } from "./db";

const DEFAULT_DAILY_LIMIT = 100_000;

export function getDailyTokenLimit(): number {
  const env = process.env.DAILY_TOKEN_LIMIT;
  if (env && !isNaN(Number(env))) {
    return Number(env);
  }
  return DEFAULT_DAILY_LIMIT;
}

export function getAdminUsers(): string[] {
  const env = process.env.ADMIN_USERS;
  if (!env) return [];
  return env.split(",").map((u) => u.trim()).filter(Boolean);
}

export function isAdmin(clerkId: string): boolean {
  return getAdminUsers().includes(clerkId);
}

interface DailyUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export function getUserDailyUsage(dbUserId: number): DailyUsage {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(m.input_tokens), 0) AS input_tokens,
        COALESCE(SUM(m.output_tokens), 0) AS output_tokens
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ?
        AND m.role = 'assistant'
        AND m.created_at >= date('now')
      `
    )
    .get(dbUserId) as { input_tokens: number; output_tokens: number };

  return {
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    total_tokens: row.input_tokens + row.output_tokens,
  };
}

interface RateLimitResult {
  allowed: boolean;
  usage: DailyUsage;
  limit: number;
  remaining: number;
}

export function checkRateLimit(dbUserId: number): RateLimitResult {
  const limit = getDailyTokenLimit();
  const usage = getUserDailyUsage(dbUserId);
  const remaining = Math.max(0, limit - usage.total_tokens);

  return {
    allowed: usage.total_tokens < limit,
    usage,
    limit,
    remaining,
  };
}

interface AllUsersUsage {
  user_id: number;
  clerk_id: string;
  display_name: string | null;
  today_input: number;
  today_output: number;
  today_total: number;
  all_time_input: number;
  all_time_output: number;
  all_time_total: number;
}

export function getAllUsersUsage(): AllUsersUsage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
        u.id AS user_id,
        u.clerk_id,
        u.display_name,
        COALESCE(SUM(CASE WHEN m.created_at >= date('now') THEN m.input_tokens ELSE 0 END), 0) AS today_input,
        COALESCE(SUM(CASE WHEN m.created_at >= date('now') THEN m.output_tokens ELSE 0 END), 0) AS today_output,
        COALESCE(SUM(m.input_tokens), 0) AS all_time_input,
        COALESCE(SUM(m.output_tokens), 0) AS all_time_output
      FROM users u
      LEFT JOIN conversations c ON c.user_id = u.id
      LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'assistant'
      GROUP BY u.id
      ORDER BY today_input + today_output DESC
      `
    )
    .all() as {
    user_id: number;
    clerk_id: string;
    display_name: string | null;
    today_input: number;
    today_output: number;
    all_time_input: number;
    all_time_output: number;
  }[];

  return rows.map((r) => ({
    ...r,
    today_total: r.today_input + r.today_output,
    all_time_total: r.all_time_input + r.all_time_output,
  }));
}
