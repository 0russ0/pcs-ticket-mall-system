import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard";
import { notifyStudentCancelledOrder } from "@/lib/notify";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = ["admin", "teacher", "power_user"].includes(session.user.role ?? "");
  const isStudent = session.user.role === "student";
  if (!isStaff && !isStudent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId;
  const { id } = await params;
  const orderId = Number(id);

  const body = await req.json();
  const { action, notes } = body; // action: 'approve' | 'reject' | 'complete' | 'cancel'

  const order = await prisma.order.findFirst({
    where: { id: orderId, schoolId },
    include: { items: { include: { product: true } }, student: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Students may only cancel their own order — every other action is staff-only.
  if (isStudent && (action !== "cancel" || order.studentId !== session.user.studentId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action === "approve") {
    if (!isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (order.status !== "pending") {
      return NextResponse.json({ error: "Order is not pending" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status: "cancelled", notes: notes || null, cancelledAt: new Date() },
      });
      await tx.student.update({
        where: { id: order.studentId },
        data: { totalPoints: { increment: order.totalPoints } },
      });
      for (const item of order.items) {
        if (item.product.inventoryLimit !== null) {
          await tx.product.update({
            where: { id: item.productId },
            data: { inventoryAvailable: { increment: item.quantity } },
          });
        }
      }
      return o;
    });

    await refreshLeaderboard(schoolId);

    return NextResponse.json(updated);
  }

  if (action === "cancel") {
    // Available to staff (on a student's behalf) or the student themselves,
    // for an order that hasn't been picked up yet — refunds points and
    // restocks inventory since the order never happened.
    if (order.status !== "pending" && order.status !== "approved") {
      return NextResponse.json({ error: "Order can no longer be cancelled" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "cancelled",
          notes: notes || (isStudent ? "Cancelled by student" : "Cancelled by staff"),
          cancelledAt: new Date(),
          cancelledBySelf: isStudent,
        },
      });
      await tx.student.update({
        where: { id: order.studentId },
        data: { totalPoints: { increment: order.totalPoints } },
      });
      for (const item of order.items) {
        if (item.product.inventoryLimit !== null) {
          await tx.product.update({
            where: { id: item.productId },
            data: { inventoryAvailable: { increment: item.quantity } },
          });
        }
      }
      return o;
    });

    await refreshLeaderboard(schoolId);

    if (isStudent) {
      // Best-effort — the cancellation itself already succeeded above, so an
      // email failure here shouldn't turn a successful cancel into a 500. We
      // await (rather than fire-and-forget) since serverless functions can be
      // frozen once the response is sent.
      try {
        await notifyStudentCancelledOrder(schoolId, order, order.student, order.items);
      } catch (err) {
        console.error("Failed to send cancellation email:", err);
      }
    }

    return NextResponse.json(updated);
  }

  if (action === "complete") {
    if (!isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (order.status !== "approved") {
      return NextResponse.json({ error: "Order is not approved" }, { status: 400 });
    }

    // Points and inventory were already deducted at submission — just flip the status.
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "completed", completedAt: new Date(), completedBy: staffId },
    });
    return NextResponse.json(updated);
  }

  if (action === "acknowledge") {
    if (!isStaff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { cancelAcknowledgedAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
