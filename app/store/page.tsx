import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import StoreClient from "./StoreClient";

export default async function StorePage() {
  const session = await auth();
  const role = session?.user?.role ?? "student";

  let studentPoints: number | null = null;
  let userGrade: string | null = null;
  let userHomeroom: string | null = null;
  let userTeam: string | null = null;

  if (role === "student" && session?.user?.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: session.user.studentId },
      select: { totalPoints: true, grade: true, homeroom: true, team: true },
    });
    studentPoints = student?.totalPoints ?? 0;
    userGrade = student?.grade ?? null;
    userHomeroom = student?.homeroom ?? null;
    userTeam = student?.team ?? null;
  }

  return (
    <StoreClient
      role={role}
      studentPoints={studentPoints}
      userGrade={userGrade}
      userHomeroom={userHomeroom}
      userTeam={userTeam}
    />
  );
}
