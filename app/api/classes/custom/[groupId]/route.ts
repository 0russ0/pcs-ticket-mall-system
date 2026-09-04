import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageClassGroup } from "@/lib/classGroupPermissions";

async function loadGroup(groupId: number, schoolId: number) {
  return prisma.classGroup.findFirst({
    where: { id: groupId, schoolId },
    include: {
      classes: {
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true, googleEmail: true } },
          students: { include: { student: { select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true } } } },
        },
      },
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const schoolId = session.user.schoolId!;
  const group = await loadGroup(Number(groupId), schoolId);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageClassGroup({ role: session.user.role ?? "", staffId: session.user.staffId ?? null }, group)) {
    return NextResponse.json({ error: "You don't have access to this class" }, { status: 403 });
  }

  const roster = group.classes[0]?.students.map((sc) => sc.student) ?? [];

  return NextResponse.json({
    id: group.id,
    name: group.name,
    teachers: group.classes.map((c) => ({ classId: c.id, staffId: c.teacherId, firstName: c.teacher.firstName, lastName: c.teacher.lastName, email: c.teacher.googleEmail })),
    students: roster,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;
  const schoolId = session.user.schoolId!;
  const id = Number(groupId);
  const group = await loadGroup(id, schoolId);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageClassGroup({ role: session.user.role ?? "", staffId: session.user.staffId ?? null }, group)) {
    return NextResponse.json({ error: "You don't have access to manage this class" }, { status: 403 });
  }

  const body = await req.json();
  const classIds = group.classes.map((c) => c.id);

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Class name cannot be empty" }, { status: 400 });
    await prisma.$transaction([
      prisma.classGroup.update({ where: { id }, data: { name } }),
      prisma.class.updateMany({ where: { id: { in: classIds } }, data: { name } }),
    ]);
  }

  if (Array.isArray(body.addStudentIds) && body.addStudentIds.length > 0) {
    const addIds: number[] = body.addStudentIds.map(Number);
    const validStudents = await prisma.student.findMany({ where: { id: { in: addIds }, schoolId }, select: { id: true } });
    const validIds = validStudents.map((s) => s.id);
    for (const classId of classIds) {
      const existing = await prisma.studentClass.findMany({ where: { classId, studentId: { in: validIds } }, select: { studentId: true } });
      const existingIds = new Set(existing.map((e) => e.studentId));
      const toAdd = validIds.filter((sid) => !existingIds.has(sid));
      if (toAdd.length > 0) {
        await prisma.studentClass.createMany({ data: toAdd.map((studentId) => ({ studentId, classId })) });
      }
    }
  }

  if (Array.isArray(body.removeStudentIds) && body.removeStudentIds.length > 0) {
    const removeIds: number[] = body.removeStudentIds.map(Number);
    await prisma.studentClass.deleteMany({ where: { classId: { in: classIds }, studentId: { in: removeIds } } });
  }

  if (body.addTeacherStaffId) {
    const newTeacherId = Number(body.addTeacherStaffId);
    const alreadyIn = classIds.length > 0 && group.classes.some((c) => c.teacherId === newTeacherId);
    if (!alreadyIn) {
      const newTeacher = await prisma.staff.findFirst({ where: { id: newTeacherId, schoolId, role: { in: ["teacher", "power_user", "admin"] } } });
      if (!newTeacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      const roster = group.classes[0]?.students.map((sc) => sc.student.id) ?? [];
      const newClass = await prisma.class.create({
        data: { schoolId, teacherId: newTeacherId, name: group.name, period: null, classGroupId: id },
      });
      if (roster.length > 0) {
        await prisma.studentClass.createMany({ data: roster.map((studentId) => ({ studentId, classId: newClass.id })) });
      }
    }
  }

  if (body.removeTeacherStaffId) {
    const removeTeacherId = Number(body.removeTeacherStaffId);
    if (classIds.length <= 1) {
      return NextResponse.json({ error: "A class needs at least one teacher — delete it instead" }, { status: 400 });
    }
    const target = group.classes.find((c) => c.teacherId === removeTeacherId);
    if (target) {
      await prisma.class.delete({ where: { id: target.id } });
    }
  }

  const updated = await loadGroup(id, schoolId);
  const roster = updated!.classes[0]?.students.map((sc) => sc.student) ?? [];
  return NextResponse.json({
    id: updated!.id,
    name: updated!.name,
    teachers: updated!.classes.map((c) => ({ classId: c.id, staffId: c.teacherId, firstName: c.teacher.firstName, lastName: c.teacher.lastName, email: c.teacher.googleEmail })),
    students: roster,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;
  const schoolId = session.user.schoolId!;
  const id = Number(groupId);
  const group = await loadGroup(id, schoolId);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageClassGroup({ role: session.user.role ?? "", staffId: session.user.staffId ?? null }, group)) {
    return NextResponse.json({ error: "You don't have access to delete this class" }, { status: 403 });
  }

  // Cascades to Class rows (classGroupId FK, onDelete: Cascade) and from there
  // to StudentClass rows (classId FK, onDelete: Cascade).
  await prisma.classGroup.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
