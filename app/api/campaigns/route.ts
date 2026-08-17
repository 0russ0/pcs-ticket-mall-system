import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = session.user.schoolId!;
  const campaigns = await prisma.campaign.findMany({
    where: { schoolId },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { awards: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = session.user.schoolId!;
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
      audienceFilter: audienceFilter ?? null,
      addToTotal: addToTotal !== false,
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}
