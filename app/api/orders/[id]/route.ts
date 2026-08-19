import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const { id } = await params;
  const orderId = Number(id);

  const body = await req.json();
  const { action, notes } = body; // action: 'approve' | 'reject' | 'complete'

  const order = await prisma.order.findFirst({
    where: { id: orderId, schoolId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (action === "approve") {
    if (order.status !== "pending") {
      return NextResponse.json({ error: "Order is not pending" }, { status: 400 });
    }
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "approved", approvedAt: new Date(), approvedBy: staffId },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject") {
    if (order.status !== "pending") {
      return NextResponse.json({ error: "Order is not pending" }, { status: 400 });
    }

    // Points were deducted at submission — refund them since the order never happened.
    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status: "cancelled", notes: notes || null },
      });
      await tx.student.update({
        where: { id: order.studentId },
        data: { totalPoints: { increment: order.totalPoints } },
      });
      return o;
    });

    await refreshLeaderboard(schoolId);

    return NextResponse.json(updated);
  }

  if (action === "complete") {
    if (order.status !== "approved") {
      return NextResponse.json({ error: "Order is not approved" }, { status: 400 });
    }

    // Points were already deducted at submission — only inventory changes here.
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "completed", completedAt: new Date(), completedBy: staffId },
      });

      for (const item of order.items) {
        if (item.product.inventoryLimit !== null) {
          await tx.product.update({
            where: { id: item.productId },
            data: { inventoryAvailable: { decrement: item.quantity } },
          });
        }
      }
    });

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
