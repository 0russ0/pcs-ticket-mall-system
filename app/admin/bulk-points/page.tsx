import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/leaderboard";
import BulkPointsClient from "./BulkPointsClient";

export default async function BulkPointsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");

  const schoolId = session.user.schoolId!;

  const [students, homerooms, grades] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { homeroom: true },
      distinct: ["homeroom"],
      orderBy: { homeroom: "asc" },
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { grade: true },
      distinct: ["grade"],
      orderBy: { grade: "asc" },
    }),
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Bulk Award Points</h1>
      <p className="text-sm text-gray-500">Award points to a student, homeroom, grade, or house team all at once.</p>
      <BulkPointsClient
        students={students}
        homerooms={homerooms.map((h) => h.homeroom)}
        grades={grades.map((g) => g.grade)}
        houses={[...TEAMS]}
      />
    </div>
  );
}
