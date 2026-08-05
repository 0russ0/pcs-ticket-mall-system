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
  const dateFilter = since ? { createdAt: { gte: new Date(since) } } : {};
  const gbDateFilter = since ? { createdAt: { gte: new Date(since) } } : {};

  const [staff, pointAwards, goldenBulldogs, houseBonuses] = await Promise.all([
    prisma.staff.findMany({ where: { schoolId }, orderBy: { lastName: "asc" } }),
    prisma.pointAward.findMany({
      where: { schoolId, ...dateFilter },
      include: { category: { select: { name: true } } },
    }),
    prisma.goldenBulldog.findMany({
      where: { schoolId, ...gbDateFilter },
      select: { staffId: true },
    }),
    prisma.houseBonus.findMany({
      where: { schoolId, ...(since ? { createdAt: { gte: new Date(since) } } : {}) },
      select: { staffId: true, points: true },
    }),
  ]);

  const categories = [...new Set(pointAwards.map((a) => a.category.name))].sort();

  const staffMap = new Map(
    staff.map((s) => [s.id, {
      staffId: s.id,
      name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.googleEmail,
      email: s.googleEmail,
      role: s.role,
      totalPointsGiven: 0,
      awardCount: 0,
      goldenBulldogsGiven: 0,
      houseBonusesGiven: 0,
      houseBonusPointsGiven: 0,
      byCategory: {} as Record<string, number>,
    }])
  );

  for (const a of pointAwards) {
    const entry = staffMap.get(a.staffId);
    if (!entry) continue;
    entry.totalPointsGiven += a.points;
    entry.awardCount += 1;
    entry.byCategory[a.category.name] = (entry.byCategory[a.category.name] ?? 0) + a.points;
  }
  for (const gb of goldenBulldogs) {
    const entry = staffMap.get(gb.staffId);
    if (entry) entry.goldenBulldogsGiven += 1;
  }
  for (const hb of houseBonuses) {
    const entry = staffMap.get(hb.staffId);
    if (entry) { entry.houseBonusesGiven += 1; entry.houseBonusPointsGiven += hb.points; }
  }

  const rows = Array.from(staffMap.values()).sort((a, b) => b.totalPointsGiven - a.totalPointsGiven);
  return NextResponse.json({ rows, categories });
}
