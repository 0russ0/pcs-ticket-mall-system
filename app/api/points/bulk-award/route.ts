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
  if (pointsInt < 1) {
    return NextResponse.json({ error: "Points must be at least 1" }, { status: 400 });
  }

  // Find matching students
  let where: { schoolId: number; id?: number; homeroom?: string; grade?: string; team?: string } = { schoolId };
  if (targetType === "student") {
    where.id = Number(targetValue);
  } else if (targetType === "homeroom") {
    where.homeroom = targetValue;
  } else if (targetType === "grade") {
    where.grade = targetValue;
  } else if (targetType === "house") {
    where.team = targetValue;
  } else {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }

  const students = await prisma.student.findMany({ where, select: { id: true } });
  if (students.length === 0) {
    return NextResponse.json({ error: "No students found for this target" }, { status: 404 });
  }

  // Get default category (first active one)
  const category = await prisma.pointCategory.findFirst({
    where: { schoolId, isActive: true },
    orderBy: { name: "asc" },
  });
  if (!category) {
    return NextResponse.json({ error: "No active point categories found" }, { status: 400 });
  }

  // Award points to all matching students in a transaction
  await prisma.$transaction([
    prisma.pointAward.createMany({
      data: students.map((s) => ({
        schoolId,
        studentId: s.id,
        staffId,
        categoryId: category.id,
        points: pointsInt,
        reason: reason || null,
      })),
    }),
    ...students.map((s) =>
      prisma.student.update({
        where: { id: s.id },
        data: {
          totalPoints: { increment: pointsInt },
          lifetimePoints: { increment: pointsInt },
        },
      })
    ),
  ]);

  await refreshLeaderboard(schoolId);

  return NextResponse.json({ success: true, studentCount: students.length });
}
