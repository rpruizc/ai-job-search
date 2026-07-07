import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProfileSection, upsertProfileSection, PROFILE_SECTIONS, ProfileSection } from "@/lib/profile";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { section } = await params;

    if (!PROFILE_SECTIONS.includes(section as ProfileSection)) {
      return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
    }

    const content = getProfileSection(dbUserId, section as ProfileSection);
    return NextResponse.json({ section, content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { section } = await params;

    if (!PROFILE_SECTIONS.includes(section as ProfileSection)) {
      return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body.content !== "string") {
      return NextResponse.json({ error: "Body must contain a 'content' string" }, { status: 400 });
    }

    upsertProfileSection(dbUserId, section as ProfileSection, body.content);
    return NextResponse.json({ section, content: body.content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
