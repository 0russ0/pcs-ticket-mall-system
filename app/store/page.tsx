import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import StoreClient from "./StoreClient";

export default async function StorePage() {
  const session = await auth();
  let studentPoints: number | null = null;

  if (session?.user.role === "student") {
    const student = await prisma.student.findUnique({ where: { id: session.user.studentId! } });
    studentPoints = student?.totalPoints ?? 0;
  }

  return <StoreClient studentPoints={studentPoints} />;
}
