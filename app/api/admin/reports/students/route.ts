import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = session.user.schoolId!;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const [students, pointAwards, goldenBulldogs, orders] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      orderBy: [{ grade: "asc" }, { lastName: "asc" }],
    }),
    prisma.pointAward.groupBy({
      by: ["studentId"],
      where: { schoolId, ...(since ? { createdAt: { gte: new Date(since) } } : {}) },
      _sum: { points: true },
      _count: { id: true },
    }),
    prisma.goldenBulldog.groupBy({
      by: ["studentId"],
      where: { schoolId },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["studentId"],
      where: { schoolId, status: { in: ["approved", "completed"] } },
      _sum: { totalPoints: true },
      _count: { id: true },
    }),
  ]);

  const awardMap = new Map(pointAwards.map((r) => [r.studentId, r]));
  const gbMap = new Map(goldenBulldogs.map((r) => [r.studentId, r._count.id]));
  const orderMap = new Map(orders.map((r) => [r.studentId, r]));

  const rows = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    grade: s.grade,
    homeroom: s.homeroom,
    team: s.team,
    currentBalance: s.totalPoints,
    lifetimePoints: s.lifetimePoints,
    periodPoints: awardMap.get(s.id)?._sum.points ?? 0,
    periodAwards: awardMap.get(s.id)?._count.id ?? 0,
    goldenBulldogs: gbMap.get(s.id) ?? 0,
    ordersPlaced: orderMap.get(s.id)?._count.id ?? 0,
    pointsSpent: orderMap.get(s.id)?._sum.totalPoints ?? 0,
  }));

  return NextResponse.json(rows);
}
