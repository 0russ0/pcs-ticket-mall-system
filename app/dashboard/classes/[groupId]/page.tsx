import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ManageClassGroupForm from "@/components/ManageClassGroupForm";
import { canManageClassGroup } from "@/lib/classGroupPermissions";

export default async function ManageClassPage({ params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const { groupId } = await params;
  const schoolId = session.user.schoolId!;
  const id = Number(groupId);

  const [group, allStudents, allStaff] = await Promise.all([
    prisma.classGroup.findFirst({
      where: { id, schoolId },
      include: {
        classes: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true, googleEmail: true } },
            students: { include: { student: { select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true } } } },
          },
        },
      },
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.staff.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, googleEmail: true },
      orderBy: { googleEmail: "asc" },
    }),
  ]);

  if (!group) notFound();

  if (!canManageClassGroup({ role: session.user.role ?? "", staffId: session.user.staffId ?? null }, group)) {
    redirect("/dashboard");
  }

  const roster = group.classes[0]?.students.map((sc) => sc.student) ?? [];
  const teachers = group.classes.map((c) => ({ classId: c.id, staffId: c.teacherId, firstName: c.teacher.firstName, lastName: c.teacher.lastName, email: c.teacher.googleEmail }));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-blue-600">← Dashboard</Link>
      <h1 className="text-2xl font-bold">Manage Class</h1>
      <ManageClassGroupForm
        groupId={group.id}
        initialName={group.name}
        initialStudents={roster}
        initialTeachers={teachers}
        allStudents={allStudents}
        allStaff={allStaff}
        currentStaffId={session.user.staffId ?? null}
      />
    </div>
  );
}
