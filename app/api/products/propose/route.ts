import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["teacher", "admin"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const body = await req.json();

  const { name, description, points_cost, category, inventory_limit, image_url, audience_filter } = body;

  if (!name?.trim() || !points_cost || !category) {
    return NextResponse.json({ error: "Name, points cost, and category are required." }, { status: 400 });
  }

  const invLimit = inventory_limit === "unlimited" || inventory_limit === null ? null : Number(inventory_limit);

  const product = await prisma.product.create({
    data: {
      schoolId,
      name: name.trim(),
      description: description?.trim() || null,
      pointsCost: Number(points_cost),
      category,
      inventoryLimit: invLimit,
      inventoryAvailable: invLimit,
      imageUrl: image_url || null,
      audienceFilter: audience_filter ?? null,
      isActive: false,
      proposalStatus: "pending",
      proposedByStaffId: staffId,
    },
  });

  return NextResponse.json({ success: true, id: product.id });
}
