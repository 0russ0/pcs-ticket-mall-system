import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { refreshLeaderboard } from "@/lib/leaderboard";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["teacher", "admin"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const body = await req.json();
  const { student_id, points, category_id, reason } = body;

  if (!student_id || !category_id || points === undefined || points === null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pointsInt = Number(points);
  if (!Number.isInteger(pointsInt) || pointsInt === 0) {
    return NextResponse.json({ error: "Points must be a non-zero integer" }, { status: 400 });
  }

  const allowNegative = (await getSetting(schoolId, "allow_negative_points")) === "true";
  if (pointsInt < 0 && !allowNegative) {
    return NextResponse.json({ error: "Negative points are not allowed" }, { status: 400 });
  }

  const maxPerDay = Number(await getSetting(schoolId, "max_points_per_day"));
  if (maxPerDay > 0) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysTotal = await prisma.pointAward.aggregate({
      where: { studentId: student_id, createdAt: { gte: startOfDay } },
      _sum: { points: true },
    });

    const current = todaysTotal._sum.points ?? 0;
    if (current + pointsInt > maxPerDay) {
      return NextResponse.json(
        { error: `This would exceed the daily max of ${maxPerDay} points for this student` },
        { status: 400 }
      );
    }
  }

  const student = await prisma.student.findFirst({ where: { id: student_id, schoolId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const category = await prisma.pointCategory.findFirst({
    where: { id: category_id, schoolId },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.pointAward.create({
      data: {
        schoolId,
        studentId: student_id,
        staffId,
        categoryId: category_id,
        points: pointsInt,
        reason: reason || null,
      },
    }),
    prisma.student.update({
      where: { id: student_id },
      data: { totalPoints: { increment: pointsInt } },
    }),
  ]);

  await refreshLeaderboard(schoolId);

  const updated = await prisma.student.findUnique({ where: { id: student_id } });

  return NextResponse.json({
    success: true,
    message: `${pointsInt >= 0 ? "+" : ""}${pointsInt} points ${pointsInt >= 0 ? "awarded to" : "removed from"} ${student.firstName} ${student.lastName}`,
    totalPoints: updated?.totalPoints,
  });
}
