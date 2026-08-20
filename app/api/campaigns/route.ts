import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/leaderboard";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["admin", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = session.user.schoolId!;
  const campaigns = await prisma.campaign.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { awards: true } } },
  });

  // Power users only manage house-scoped, points-don't-count-elsewhere challenges.
  const visible = session.user.role === "power_user"
    ? campaigns.filter((c) => (c.audienceFilter as { type?: string } | null)?.type === "houses")
    : campaigns;

  return NextResponse.json(visible);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["admin", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = session.user.schoolId!;
  const isPowerUser = session.user.role === "power_user";
  const body = await req.json();
  const { name, description, startDate, endDate, durationType, audienceFilter, addToTotal } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!startDate) return NextResponse.json({ error: "Start date is required" }, { status: 400 });
  if (!durationType) return NextResponse.json({ error: "Duration type is required" }, { status: 400 });

  const campaign = await prisma.campaign.create({
    data: {
      schoolId,
      name: name.trim(),
      description: description?.trim() || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      durationType,
      // Power users can only ever create house-scoped, standalone challenges —
      // enforced server-side regardless of what the client sends.
      audienceFilter: isPowerUser ? { type: "houses", values: [...TEAMS] } : (audienceFilter ?? null),
      addToTotal: isPowerUser ? false : addToTotal !== false,
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}
