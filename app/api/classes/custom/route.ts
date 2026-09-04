import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId;
  if (!staffId) return NextResponse.json({ error: "Staff ID missing from session" }, { status: 400 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const studentIds: number[] = Array.isArray(body.studentIds) ? body.studentIds.map(Number) : [];

  if (!name) return NextResponse.json({ error: "Class name is required" }, { status: 400 });

  const validStudents = studentIds.length > 0
    ? await prisma.student.findMany({ where: { id: { in: studentIds }, schoolId }, select: { id: true } })
    : [];
  const validIds = validStudents.map((s) => s.id);

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.classGroup.create({
      data: { schoolId, name, createdByStaffId: staffId },
    });
    const cls = await tx.class.create({
      data: { schoolId, teacherId: staffId, name, period: null, classGroupId: group.id },
    });
    if (validIds.length > 0) {
      await tx.studentClass.createMany({
        data: validIds.map((studentId) => ({ studentId, classId: cls.id })),
      });
    }
    return { group, cls };
  });

  return NextResponse.json({ groupId: result.group.id, classId: result.cls.id }, { status: 201 });
}
