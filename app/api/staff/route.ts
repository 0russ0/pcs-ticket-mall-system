import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staff.findMany({
    where: { schoolId: session.user.schoolId! },
    orderBy: { googleEmail: "asc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const body = await req.json();
  const { google_email, first_name, last_name, role } = body;

  if (!google_email || !role) {
    return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
  }

  const allowedDomain = process.env.ALLOWED_GOOGLE_DOMAIN;
  if (allowedDomain && !google_email.endsWith(`@${allowedDomain}`)) {
    return NextResponse.json({ error: `Email must be a @${allowedDomain} address` }, { status: 400 });
  }

  if (!["admin", "teacher"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await prisma.staff.findUnique({ where: { googleEmail: google_email } });
  if (existing) {
    return NextResponse.json({ error: "Staff member already exists" }, { status: 400 });
  }

  const staff = await prisma.staff.create({
    data: { schoolId, googleEmail: google_email, firstName: first_name || null, lastName: last_name || null, role },
  });

  return NextResponse.json(staff);
}
