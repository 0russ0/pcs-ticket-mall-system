import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendGoldenBulldogCertificate } from "@/lib/goldenBulldogCertificate";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["teacher", "admin", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const { studentId, categoryId, observedDate, description } = await req.json();

  if (!studentId || !categoryId || !observedDate || !description?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [student, category] = await Promise.all([
    prisma.student.findFirst({ where: { id: Number(studentId), schoolId }, select: { id: true, firstName: true, lastName: true, grade: true } }),
    prisma.pointCategory.findFirst({ where: { id: Number(categoryId), schoolId }, select: { name: true } }),
  ]);
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const observed = new Date(observedDate);
  const trimmedDescription = description.trim();

  const award = await prisma.goldenBulldog.create({
    data: {
      schoolId,
      staffId,
      studentId: Number(studentId),
      categoryId: Number(categoryId),
      observedDate: observed,
      description: trimmedDescription,
    },
  });

  // Best-effort — the award itself already succeeded above, so an email
  // failure here shouldn't turn a successful award into an error response.
  try {
    await sendGoldenBulldogCertificate(schoolId, student, category, trimmedDescription, observed);
  } catch (err) {
    console.error("Failed to send Golden Bulldog certificate email:", err);
  }

  return NextResponse.json({ success: true, id: award.id });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const schoolId = session.user.schoolId;
  const since = searchParams.get("since");

  // Students may only ever see their own awards — ignore any requested studentId
  // and force self-scoping regardless of what the client sends.
  const studentId = session.user.role === "student"
    ? session.user.studentId
    : searchParams.get("studentId") ? Number(searchParams.get("studentId")) : null;

  const awards = await prisma.goldenBulldog.findMany({
    where: {
      schoolId,
      ...(studentId ? { studentId } : {}),
      ...(since ? { observedDate: { gte: new Date(since) } } : {}),
    },
    include: {
      category: { select: { name: true } },
      staff: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true, grade: true, homeroom: true, team: true } },
    },
    orderBy: { observedDate: "desc" },
  });

  return NextResponse.json(awards);
}
