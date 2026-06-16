import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const isStaff = ["admin", "teacher"].includes(session.user.role ?? "");

  const orders = await prisma.order.findMany({
    where: {
      schoolId: session.user.schoolId,
      ...(isStaff ? {} : { studentId: session.user.studentId! }),
      ...(status ? { status: status as "pending" | "approved" | "completed" | "cancelled" } : {}),
    },
    include: {
      student: true,
      items: { include: { product: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Only students can place orders" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const studentId = session.user.studentId!;

  const storeStatus = await getSetting(schoolId, "store_status");
  if (storeStatus === "closed") {
    return NextResponse.json({ error: "The store is currently closed." }, { status: 400 });
  }

  const body = await req.json();
  const items: { product_id: number; quantity: number }[] = body.items;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const productIds = items.map((i) => i.product_id);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, schoolId, isActive: true },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "One or more items are no longer available" }, { status: 400 });
  }

  let total = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id)!;
    if (item.quantity < 1) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (product.inventoryLimit !== null && (product.inventoryAvailable ?? 0) < item.quantity) {
      return NextResponse.json({ error: `Not enough "${product.name}" in stock` }, { status: 400 });
    }
    total += product.pointsCost * item.quantity;
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.totalPoints < total) {
    return NextResponse.json({ error: "Not enough points for this order" }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      schoolId,
      studentId,
      totalPoints: total,
      status: "pending",
      items: {
        create: items.map((item) => {
          const product = products.find((p) => p.id === item.product_id)!;
          return {
            productId: item.product_id,
            quantity: item.quantity,
            pointsPerItem: product.pointsCost,
          };
        }),
      },
    },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json(order);
}
