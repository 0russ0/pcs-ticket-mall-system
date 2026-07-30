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

  // Wipe all point-related data for this school
  await prisma.$transaction([
    // Clear leaderboard cache
    prisma.leaderboardCache.deleteMany({ where: { schoolId } }),
    // Clear group bonuses (homeroom/grade/house bulk awards)
    prisma.groupBonus.deleteMany({ where: { schoolId } }),
    // Clear house bonuses (teacher House button)
    prisma.houseBonus.deleteMany({ where: { schoolId } }),
    // Clear individual point awards
    prisma.pointAward.deleteMany({ where: { schoolId } }),
    // Reset all student point balances
    prisma.student.updateMany({
      where: { schoolId },
      data: { totalPoints: 0, lifetimePoints: 0 },
    }),
  ]);

  return NextResponse.json({ success: true });
}
