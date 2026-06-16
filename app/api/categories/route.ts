import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.pointCategory.findMany({
    where: { schoolId: session.user.schoolId, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}
