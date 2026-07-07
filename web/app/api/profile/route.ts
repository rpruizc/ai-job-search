import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProfile, PROFILE_SECTIONS, upsertProfileSection } from "@/lib/profile";

export async function GET() {
  try {
    const { dbUserId } = await requireAuth();
    const profile = getProfile(dbUserId);
    return NextResponse.json(profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { dbUserId } = await requireAuth();
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    for (const [section, content] of Object.entries(body)) {
      if (!PROFILE_SECTIONS.includes(section as any)) {
        return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
      }
      if (typeof content !== "string") {
        return NextResponse.json({ error: `Content for ${section} must be a string` }, { status: 400 });
      }
      upsertProfileSection(dbUserId, section as any, content);
    }

    const profile = getProfile(dbUserId);
    return NextResponse.json(profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
