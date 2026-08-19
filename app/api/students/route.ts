import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard, TEAMS } from "@/lib/leaderboard";

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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const body = await req.json();
  const {
    external_id,
    first_name,
    last_name,
    grade,
    homeroom,
    team,
    google_email,
    initial_points,
  } = body;

  if (!first_name?.trim() || !last_name?.trim() || !grade?.trim() || !homeroom?.trim()) {
    return NextResponse.json({ error: "First name, last name, grade, and homeroom are required" }, { status: 400 });
  }

  const validTeam = team && (TEAMS as readonly string[]).includes(team) ? team : "Unassigned";
  const externalId = external_id?.trim() || null;
  const googleEmail = google_email?.trim().toLowerCase() || null;
  const points = Number.isFinite(Number(initial_points)) ? Number(initial_points) : 0;

  if (externalId) {
    const existing = await prisma.student.findFirst({ where: { schoolId, externalId } });
    if (existing) return NextResponse.json({ error: "A student with this ID already exists" }, { status: 400 });
  }
  if (googleEmail) {
    const existing = await prisma.student.findUnique({ where: { googleEmail } });
    if (existing) return NextResponse.json({ error: "A student with this email already exists" }, { status: 400 });
  }

  const student = await prisma.student.create({
    data: {
      schoolId,
      externalId,
      googleEmail,
      firstName: first_name.trim(),
      lastName: last_name.trim(),
      grade: grade.trim(),
      homeroom: homeroom.trim(),
      team: validTeam,
      totalPoints: points,
      lifetimePoints: points,
    },
  });

  await refreshLeaderboard(schoolId);

  return NextResponse.json(student, { status: 201 });
}
