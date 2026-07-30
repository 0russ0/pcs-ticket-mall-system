import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, action, notes } = await req.json();
  if (!productId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "approve") {
    await prisma.product.update({
      where: { id: Number(productId) },
      data: { proposalStatus: "approved", isActive: true },
    });
  } else {
    await prisma.product.update({
      where: { id: Number(productId) },
      data: { proposalStatus: "rejected" },
    });
  }

  return NextResponse.json({ success: true });
}
