import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const recipient = await prisma.digestRecipient.create({
      data: { schoolId, email: email.trim().toLowerCase() },
    });
    return NextResponse.json(recipient);
  } catch {
    return NextResponse.json({ error: "Email already added" }, { status: 409 });
  }
}
