import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const homeroom = searchParams.get("homeroom");

  const students = await prisma.student.findMany({
    where: {
      schoolId: session.user.schoolId,
      ...(homeroom ? { homeroom } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      homeroom: true,
      team: true,
      totalPoints: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json(students);
}
