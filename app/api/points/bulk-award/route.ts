import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const { targetType, targetValue, points, reason } = await req.json();

  if (!targetType || !targetValue || !points || points < 1) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pointsInt = Math.round(Number(points));

  // Student target: award points directly to the student (affects personal total)
  if (targetType === "student") {
    const studentId = Number(targetValue);
    const category = await prisma.pointCategory.findFirst({
      where: { schoolId, isActive: true },
      orderBy: { name: "asc" },
    });
    if (!category) return NextResponse.json({ error: "No active categories" }, { status: 400 });

    await prisma.$transaction([
      prisma.pointAward.create({
        data: { schoolId, studentId, staffId, categoryId: category.id, points: pointsInt, reason: reason || null },
      }),
      prisma.student.update({
        where: { id: studentId },
        data: { totalPoints: { increment: pointsInt }, lifetimePoints: { increment: pointsInt } },
      }),
    ]);

    await refreshLeaderboard(schoolId);
    return NextResponse.json({ success: true, studentCount: 1 });
  }

  // Group targets (house, homeroom, grade): write to group_bonuses only — do NOT touch students
  if (!["house", "homeroom", "grade"].includes(targetType)) {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }

  await prisma.groupBonus.create({
    data: {
      schoolId,
      staffId,
      groupType: targetType,
      groupValue: targetValue,
      points: pointsInt,
      reason: reason || null,
    },
  });

  await refreshLeaderboard(schoolId);
  return NextResponse.json({ success: true, groupType: targetType, groupValue: targetValue });
}
