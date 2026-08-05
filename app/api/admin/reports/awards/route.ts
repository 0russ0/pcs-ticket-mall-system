import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = session.user.schoolId!;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const records = await prisma.pointAward.findMany({
    where: { schoolId, ...(since ? { createdAt: { gte: new Date(since) } } : {}) },
    include: {
      student: { select: { firstName: true, lastName: true, grade: true, homeroom: true, team: true } },
      staff: { select: { firstName: true, lastName: true, googleEmail: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return NextResponse.json(records.map((r) => ({
    id: r.id,
    date: r.createdAt.toISOString().split("T")[0],
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    grade: r.student.grade,
    homeroom: r.student.homeroom,
    team: r.student.team,
    points: r.points,
    category: r.category.name,
    reason: r.reason ?? "",
    awardedBy: `${r.staff.firstName ?? ""} ${r.staff.lastName ?? ""}`.trim() || r.staff.googleEmail,
  })));
}
