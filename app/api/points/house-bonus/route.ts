import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const HOUSE_BONUS_POINTS = 5;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["teacher", "admin", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const { house, reason } = await req.json();

  if (!house || typeof house !== "string") {
    return NextResponse.json({ error: "Missing house" }, { status: 400 });
  }

  await prisma.houseBonus.create({
    data: {
      schoolId,
      staffId,
      house,
      points: HOUSE_BONUS_POINTS,
      reason: reason || null,
    },
  });

  return NextResponse.json({ success: true, house, points: HOUSE_BONUS_POINTS });
}
