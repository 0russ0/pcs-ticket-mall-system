import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId;
  const staffId = session.user.staffId;

  if (!schoolId || !staffId) {
    return NextResponse.json({ error: "Session missing school or staff ID — please sign out and back in" }, { status: 400 });
  }

  const { targetType, targetValue, points, reason } = await req.json();

  if (!targetType || !targetValue || !points || points < 1) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pointsInt = Math.round(Number(points));

  try {
    // Student target: award points directly to the student (affects personal total)
    if (targetType === "student") {
      const studentId = Number(targetValue);

      const [student, category] = await Promise.all([
        prisma.student.findFirst({ where: { id: studentId, schoolId } }),
        prisma.pointCategory.findFirst({ where: { schoolId }, orderBy: { isActive: "desc" } }),
      ]);

      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      if (!category) return NextResponse.json({ error: "No point categories exist for this school — add one under Settings first" }, { status: 400 });

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
  } catch (err) {
    console.error("bulk-award error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to award points: ${message}` }, { status: 500 });
  }
}
