import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import StudentsClient from "./StudentsClient";

export default async function AdminStudentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const students = await prisma.student.findMany({
    where: { schoolId: session.user.schoolId! },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Manage Students</h1>
        <Link href="/admin/students/upload" className="btn btn-secondary">Bulk Upload CSV</Link>
      </div>
      <StudentsClient initialStudents={students} />
    </div>
  );
}
