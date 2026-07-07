import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getApplication, updateApplication, deleteApplication } from "@/lib/applications";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { id } = await params;
    const app = getApplication(dbUserId, Number(id));

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json(app);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const updated = updateApplication(dbUserId, Number(id), body);
    if (!updated) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const app = getApplication(dbUserId, Number(id));
    return NextResponse.json(app);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { dbUserId } = await requireAuth();
    const { id } = await params;

    const deleted = deleteApplication(dbUserId, Number(id));
    if (!deleted) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
