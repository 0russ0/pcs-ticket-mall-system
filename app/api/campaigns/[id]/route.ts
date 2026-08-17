import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaignId = Number(id);
  const schoolId = session.user.schoolId!;

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, schoolId } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Aggregate points per student for this campaign
  const awardTotals = await prisma.campaignAward.groupBy({
    by: ["studentId"],
    where: { campaignId },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
  });

  const studentIds = awardTotals.map((a) => a.studentId);
  const students = studentIds.length > 0
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true, team: true },
      })
    : [];

  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
  const leaderboard = awardTotals.map((a, i) => ({
    rank: i + 1,
    student: studentMap[a.studentId],
    points: a._sum.points ?? 0,
  }));

  return NextResponse.json({ campaign, leaderboard });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = Number(id);
  const schoolId = session.user.schoolId!;
  const body = await req.json();

  const existing = await prisma.campaign.findFirst({ where: { id: campaignId, schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
    },
  });
  return NextResponse.json(campaign);
}
