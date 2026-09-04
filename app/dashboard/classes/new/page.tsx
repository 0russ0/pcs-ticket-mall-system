import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewClassGroupForm from "@/components/NewClassGroupForm";

export default async function NewClassPage() {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const schoolId = session.user.schoolId!;
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">New Class</h1>
      <p className="text-gray-500 text-sm">
        Create a small group of students that isn&apos;t part of the imported class schedule — it&apos;ll show up in your class dropdown just like an imported class.
      </p>
      <NewClassGroupForm students={students} />
    </div>
  );
}
