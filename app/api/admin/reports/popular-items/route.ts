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

  // "Purchased" = picked up (order status completed), since that's when points
  // are actually deducted from the student's balance.
  const items = await prisma.orderItem.findMany({
    where: {
      product: { schoolId },
      order: {
        status: "completed",
        ...(since ? { completedAt: { gte: new Date(since) } } : {}),
      },
    },
    select: {
      quantity: true,
      pointsPerItem: true,
      orderId: true,
      product: { select: { id: true, name: true, category: true } },
    },
  });

  const byProduct = new Map<number, {
    productId: number; name: string; category: string;
    quantityPurchased: number; pointsSpent: number; orderIds: Set<number>;
  }>();

  for (const item of items) {
    const key = item.product.id;
    if (!byProduct.has(key)) {
      byProduct.set(key, {
        productId: key,
        name: item.product.name,
        category: item.product.category,
        quantityPurchased: 0,
        pointsSpent: 0,
        orderIds: new Set(),
      });
    }
    const row = byProduct.get(key)!;
    row.quantityPurchased += item.quantity;
    row.pointsSpent += item.quantity * item.pointsPerItem;
    row.orderIds.add(item.orderId);
  }

  const ranked = Array.from(byProduct.values())
    .sort((a, b) => b.quantityPurchased - a.quantityPurchased)
    .map((r, i) => ({
      rank: i + 1,
      productId: r.productId,
      name: r.name,
      category: r.category,
      quantityPurchased: r.quantityPurchased,
      ordersCount: r.orderIds.size,
      pointsSpent: r.pointsSpent,
    }));

  return NextResponse.json(ranked);
}
