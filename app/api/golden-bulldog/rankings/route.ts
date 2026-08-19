import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "student") {
    return NextResponse.json({ error: "Not available to students" }, { status: 403 });
  }

  const schoolId = session.user.schoolId;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const awards = await prisma.goldenBulldog.findMany({
    where: {
      schoolId,
      ...(since ? { observedDate: { gte: new Date(since) } } : {}),
    },
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true, grade: true, homeroom: true, team: true } },
    },
  });

  // Group by student and count
  const countMap = new Map<number, { studentId: number; name: string; grade: string; homeroom: string; team: string; count: number }>();
  for (const a of awards) {
    const key = a.studentId;
    if (!countMap.has(key)) {
      countMap.set(key, {
        studentId: key,
        name: `${a.student.firstName} ${a.student.lastName}`,
        grade: a.student.grade,
        homeroom: a.student.homeroom,
        team: a.student.team,
        count: 0,
      });
    }
    countMap.get(key)!.count++;
  }

  const rankings = Array.from(countMap.values()).sort((a, b) => b.count - a.count);

  return NextResponse.json(rankings);
}
