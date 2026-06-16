import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StaffClient from "./StaffClient";

export default async function AdminStaffPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const staff = await prisma.staff.findMany({
    where: { schoolId: session.user.schoolId! },
    orderBy: { googleEmail: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Staff Management</h1>
      <StaffClient initialStaff={staff} />
    </div>
  );
}
