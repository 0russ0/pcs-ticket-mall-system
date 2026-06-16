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
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled", notes: notes || null },
    });
    return NextResponse.json(updated);
  }

  if (action === "complete") {
    if (order.status !== "approved") {
      return NextResponse.json({ error: "Order is not approved" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "completed", completedAt: new Date(), completedBy: staffId },
      });

      await tx.student.update({
        where: { id: order.studentId },
        data: { totalPoints: { decrement: order.totalPoints } },
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

    await refreshLeaderboard(schoolId);

    const updated = await prisma.order.findUnique({ where: { id: orderId } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
