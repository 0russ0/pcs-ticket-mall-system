import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = Number(id);
  const existing = await prisma.product.findFirst({
    where: { id: productId, schoolId: session.user.schoolId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, description, points_cost, category, inventory_limit, image_url, is_active } = body;

  const limit = inventory_limit === "unlimited" || inventory_limit === null || inventory_limit === ""
    ? null
    : Number(inventory_limit);

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      name,
      description: description || null,
      pointsCost: Number(points_cost),
      category,
      inventoryLimit: limit,
      ...(limit !== existing.inventoryLimit ? { inventoryAvailable: limit } : {}),
      imageUrl: image_url || null,
      isActive: is_active ?? true,
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const productId = Number(id);
  const existing = await prisma.product.findFirst({
    where: { id: productId, schoolId: session.user.schoolId! },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.product.update({ where: { id: productId }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
