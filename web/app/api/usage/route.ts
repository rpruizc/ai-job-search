import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const { dbUserId } = await requireAuth();
    const result = checkRateLimit(dbUserId);

    return Response.json({
      usage: result.usage,
      limit: result.limit,
      remaining: result.remaining,
      percentage: Math.round((result.usage.total_tokens / result.limit) * 100),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
