import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/leaderboard";

type TargetType = "student" | "grade" | "homeroom" | "house";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["admin", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const body = await req.json();
  const { targetType, targetValue, points, reason } = body as {
    targetType: TargetType;
    targetValue: string;
    points: number;
    reason?: string;
  };

  if (!targetType || !targetValue || !points || points < 1) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const pointsInt = Math.round(Number(points));

  // A direct house target is a flat bonus to that house — not multiplied by roster size.
  if (targetType === "house") {
    if (!(TEAMS as readonly string[]).includes(targetValue)) {
      return NextResponse.json({ error: "Invalid house" }, { status: 400 });
    }
    await prisma.houseBonus.create({
      data: { schoolId, staffId, house: targetValue, points: pointsInt, reason: reason?.trim() || null },
    });
    return NextResponse.json({ success: true, house: targetValue, points: pointsInt });
  }

  // Student / grade / homeroom targets: resolve the affected students, then
  // credit each one's own house — never the student's personal total.
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      ...(targetType === "student" ? { id: Number(targetValue) } : {}),
      ...(targetType === "grade" ? { grade: targetValue } : {}),
      ...(targetType === "homeroom" ? { homeroom: targetValue } : {}),
    },
    select: { team: true },
  });

  if (students.length === 0) {
    return NextResponse.json({ error: "No matching students found" }, { status: 404 });
  }

  const perHouseCount = new Map<string, number>();
  for (const s of students) {
    perHouseCount.set(s.team, (perHouseCount.get(s.team) ?? 0) + 1);
  }

  const targetLabel = targetType === "student" ? "1 student" : `${students.length} student${students.length !== 1 ? "s" : ""} (${targetType} ${targetValue})`;

  await prisma.houseBonus.createMany({
    data: [...perHouseCount.entries()].map(([house, count]) => ({
      schoolId,
      staffId,
      house,
      points: pointsInt * count,
      reason: `${reason?.trim() ? `${reason.trim()} — ` : ""}${pointsInt} pts × ${targetLabel}`,
    })),
  });

  return NextResponse.json({ success: true, studentsAffected: students.length, houses: [...perHouseCount.keys()] });
}
