import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";

  const products = await prisma.product.findMany({
    where: { schoolId: session.user.schoolId, ...(isAdmin ? {} : { isActive: true }) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, points_cost, category, inventory_limit, image_url, is_active } = body;

  if (!name || !points_cost || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const limit = inventory_limit === "unlimited" || inventory_limit === null || inventory_limit === ""
    ? null
    : Number(inventory_limit);

  const product = await prisma.product.create({
    data: {
      schoolId: session.user.schoolId!,
      name,
      description: description || null,
      pointsCost: Number(points_cost),
      category,
      inventoryLimit: limit,
      inventoryAvailable: limit,
      imageUrl: image_url || null,
      isActive: is_active ?? true,
    },
  });

  return NextResponse.json(product);
}
