import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const { phrase, expectedPhrase } = await req.json();

  if (!phrase || phrase.trim() !== expectedPhrase?.trim()) {
    return NextResponse.json({ error: "Confirmation phrase does not match." }, { status: 400 });
  }

  // Wipe all points and recognition data for this school
  await prisma.$transaction([
    prisma.leaderboardCache.deleteMany({ where: { schoolId } }),
    prisma.groupBonus.deleteMany({ where: { schoolId } }),
    prisma.houseBonus.deleteMany({ where: { schoolId } }),
    prisma.pointAward.deleteMany({ where: { schoolId } }),
    prisma.goldenBulldog.deleteMany({ where: { schoolId } }),
    prisma.student.updateMany({
      where: { schoolId },
      data: { totalPoints: 0, lifetimePoints: 0 },
    }),
  ]);

  return NextResponse.json({ success: true });
}
