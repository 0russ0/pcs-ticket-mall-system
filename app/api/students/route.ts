import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const homeroom = searchParams.get("homeroom");
  const classId = searchParams.get("classId");

  // classId lookup: find students enrolled in a specific class
  if (classId) {
    const enrollments = await prisma.studentClass.findMany({
      where: { classId: Number(classId) },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true, team: true, totalPoints: true },
        },
      },
    });
    const students = enrollments
      .map((e) => e.student)
      .filter((s) => s !== null);
    return NextResponse.json(students);
  }

  const students = await prisma.student.findMany({
    where: {
      schoolId: session.user.schoolId,
      ...(homeroom ? { homeroom } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      homeroom: true,
      team: true,
      totalPoints: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json(students);
}
