import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { role } = body;
  if (!["admin", "teacher"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const staff = await prisma.staff.findFirst({ where: { id: Number(id), schoolId: session.user.schoolId! } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.staff.update({ where: { id: Number(id) }, data: { role } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const staff = await prisma.staff.findFirst({ where: { id: Number(id), schoolId: session.user.schoolId! } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAwards = await prisma.pointAward.count({ where: { staffId: Number(id) } });
  if (hasAwards > 0) {
    return NextResponse.json({ error: "Cannot remove staff with award history. Demote to teacher instead." }, { status: 400 });
  }

  await prisma.staff.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
