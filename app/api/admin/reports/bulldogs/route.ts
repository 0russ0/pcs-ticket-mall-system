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

  const records = await prisma.goldenBulldog.findMany({
    where: { schoolId, ...(since ? { observedDate: { gte: new Date(since) } } : {}) },
    include: {
      student: { select: { firstName: true, lastName: true, grade: true, homeroom: true, team: true } },
      staff: { select: { firstName: true, lastName: true, googleEmail: true } },
      category: { select: { name: true } },
    },
    orderBy: { observedDate: "desc" },
  });

  return NextResponse.json(records.map((r) => ({
    id: r.id,
    observedDate: r.observedDate.toISOString().split("T")[0],
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    grade: r.student.grade,
    homeroom: r.student.homeroom,
    team: r.student.team,
    category: r.category.name,
    description: r.description,
    awardedBy: `${r.staff.firstName ?? ""} ${r.staff.lastName ?? ""}`.trim() || r.staff.googleEmail,
  })));
}
