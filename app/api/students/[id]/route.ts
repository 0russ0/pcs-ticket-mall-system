import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard, TEAMS } from "@/lib/leaderboard";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const schoolId = session.user.schoolId!;
  const studentId = Number(id);

  const existing = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    external_id,
    first_name,
    last_name,
    grade,
    homeroom,
    team,
    google_email,
    total_points,
  } = body;

  if (team !== undefined && team !== null && !(TEAMS as readonly string[]).includes(team) && team !== "Unassigned") {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  const externalId = external_id !== undefined ? (external_id?.trim() || null) : undefined;
  const googleEmail = google_email !== undefined ? (google_email?.trim().toLowerCase() || null) : undefined;

  if (externalId) {
    const dupe = await prisma.student.findFirst({ where: { schoolId, externalId, NOT: { id: studentId } } });
    if (dupe) return NextResponse.json({ error: "Another student already uses this ID" }, { status: 400 });
  }
  if (googleEmail) {
    const dupe = await prisma.student.findFirst({ where: { googleEmail, NOT: { id: studentId } } });
    if (dupe) return NextResponse.json({ error: "Another student already uses this email" }, { status: 400 });
  }

  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      ...(externalId !== undefined && { externalId }),
      ...(googleEmail !== undefined && { googleEmail }),
      ...(first_name !== undefined && { firstName: first_name.trim() }),
      ...(last_name !== undefined && { lastName: last_name.trim() }),
      ...(grade !== undefined && { grade: grade.trim() }),
      ...(homeroom !== undefined && { homeroom: homeroom.trim() }),
      ...(team !== undefined && { team }),
      ...(total_points !== undefined && Number.isFinite(Number(total_points)) && { totalPoints: Number(total_points) }),
    },
  });

  await refreshLeaderboard(schoolId);

  return NextResponse.json(student);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const schoolId = session.user.schoolId!;
  const studentId = Number(id);

  const existing = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaignAward.deleteMany({ where: { studentId } });
  await prisma.leaderboardCache.deleteMany({ where: { studentId } });
  await prisma.studentClass.deleteMany({ where: { studentId } });
  await prisma.goldenBulldog.deleteMany({ where: { studentId } });
  await prisma.pointAward.deleteMany({ where: { studentId } });
  const orderIds = (await prisma.order.findMany({ where: { studentId }, select: { id: true } })).map((o) => o.id);
  if (orderIds.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  await prisma.student.delete({ where: { id: studentId } });

  await refreshLeaderboard(schoolId);

  return NextResponse.json({ success: true });
}
