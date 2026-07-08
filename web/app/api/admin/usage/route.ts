import { requireAuth } from "@/lib/auth";
import { isAdmin, getAllUsersUsage, getDailyTokenLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const { userId } = await requireAuth();

    if (!isAdmin(userId)) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const users = getAllUsersUsage();
    const limit = getDailyTokenLimit();

    const totalToday = users.reduce((sum, u) => sum + u.today_total, 0);
    const totalAllTime = users.reduce((sum, u) => sum + u.all_time_total, 0);

    return Response.json({
      users,
      limit,
      totalToday,
      totalAllTime,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
