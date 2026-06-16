import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductCategory } from "@prisma/client";
import Papa from "papaparse";

const VALID_CATEGORIES = ["physical_item", "experience", "privilege"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const body = await req.json();
  const csvText: string = body.csv;

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: "Could not parse CSV", details: parsed.errors }, { status: 400 });
  }

  const errors: string[] = [];
  const toCreate: {
    schoolId: number;
    name: string;
    description: string | null;
    pointsCost: number;
    category: ProductCategory;
    inventoryLimit: number | null;
    inventoryAvailable: number | null;
  }[] = [];

  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row.name?.trim();
    const pointsCost = Number(row.points_cost);
    const category = row.category?.trim().toLowerCase();
    const limitRaw = row.inventory_limit?.trim().toLowerCase();

    if (!name) {
      errors.push(`Row ${rowNum}: missing name`);
      return;
    }
    if (!pointsCost || pointsCost <= 0) {
      errors.push(`Row ${rowNum}: invalid points_cost`);
      return;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push(`Row ${rowNum}: invalid category "${row.category}"`);
      return;
    }

    const limit = !limitRaw || limitRaw === "unlimited" ? null : Number(limitRaw);

    toCreate.push({
      schoolId,
      name,
      description: row.description?.trim() || null,
      pointsCost,
      category: category as ProductCategory,
      inventoryLimit: limit,
      inventoryAvailable: limit,
    });
  });

  if (toCreate.length > 0) {
    await prisma.product.createMany({
      data: toCreate,
    });
  }

  return NextResponse.json({ created: toCreate.length, errors });
}
