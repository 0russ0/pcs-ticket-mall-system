import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  if (!Number.isInteger(pointsInt) || pointsInt < 1 || pointsInt > 3) {
    return NextResponse.json({ error: "Points must be between 1 and 3" }, { status: 400 });
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
      data: {
        totalPoints: { increment: pointsInt },
        lifetimePoints: { increment: pointsInt },
      },
    }),
  ]);

  await refreshLeaderboard(schoolId);

  const updated = await prisma.student.findUnique({ where: { id: student_id } });

  return NextResponse.json({
    success: true,
    message: `+${pointsInt} points awarded to ${student.firstName} ${student.lastName}`,
    totalPoints: updated?.totalPoints,
  });
}
