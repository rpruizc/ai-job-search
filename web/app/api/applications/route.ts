import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getApplications, createApplication } from "@/lib/applications";

export async function GET() {
  try {
    const { dbUserId } = await requireAuth();
    const applications = getApplications(dbUserId);
    return NextResponse.json(applications);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dbUserId } = await requireAuth();
    const body = await request.json();

    if (!body.company || !body.role) {
      return NextResponse.json({ error: "company and role are required" }, { status: 400 });
    }

    const id = createApplication(dbUserId, {
      company: body.company,
      role: body.role,
      status: body.status,
      job_posting_text: body.job_posting_text,
      notes: body.notes,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
