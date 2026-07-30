import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["teacher", "admin"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const { studentId, categoryId, observedDate, description } = await req.json();

  if (!studentId || !categoryId || !observedDate || !description?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const award = await prisma.goldenBulldog.create({
    data: {
      schoolId,
      staffId,
      studentId: Number(studentId),
      categoryId: Number(categoryId),
      observedDate: new Date(observedDate),
      description: description.trim(),
    },
  });

  return NextResponse.json({ success: true, id: award.id });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const schoolId = session.user.schoolId;

  const since = searchParams.get("since");

  const awards = await prisma.goldenBulldog.findMany({
    where: {
      schoolId,
      ...(studentId ? { studentId: Number(studentId) } : {}),
      ...(since ? { observedDate: { gte: new Date(since) } } : {}),
    },
    include: {
      category: { select: { name: true } },
      staff: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true, team: true } },
    },
    orderBy: { observedDate: "desc" },
  });

  return NextResponse.json(awards);
}
