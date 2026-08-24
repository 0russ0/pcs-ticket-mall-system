import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductCategory } from "@prisma/client";
import Papa from "papaparse";

const VALID_CATEGORIES = ["physical_item", "experience", "privilege"];

// Spreadsheet exports vary a lot in header formatting ("Name (REQUIRED)",
// "Points_cost  (REQUIRED)", etc). Strip parenthetical notes and normalize
// casing/spacing so any reasonable header variant maps to our canonical keys.
function normalizeHeaderKey(header: string): string {
  return header
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeaderKey(key)] = value;
  }
  return normalized;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const body = await req.json();
  const csvText: string = body.csv;
  const clearExisting: boolean = body.clearExisting ?? false;

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
    imageUrl: string | null;
  }[] = [];

  parsed.data.forEach((rawRow, i) => {
    const row = normalizeRow(rawRow);
    const rowNum = i + 2;
    const name = row.name?.trim();
    const pointsCost = Number(row.points_cost);
    const category = row.category?.trim().toLowerCase().replace(/\s+/g, "_");
    const limitRaw = row.inventory_limit?.trim().toLowerCase();

    if (!name) {
      // Blank trailing rows are common in exported spreadsheets — skip silently.
      if (!row.points_cost?.trim() && !row.category?.trim()) return;
      errors.push(`Row ${rowNum}: missing name`);
      return;
    }
    if (!pointsCost || pointsCost <= 0) {
      errors.push(`Row ${rowNum} (${name}): invalid points_cost`);
      return;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push(`Row ${rowNum} (${name}): invalid category "${row.category}"`);
      return;
    }

    const limit = !limitRaw || limitRaw === "unlimited" ? null : Number(limitRaw);

    const imageUrl = row.image_url?.trim() || null;

    toCreate.push({
      schoolId,
      name,
      description: row.description?.trim() || null,
      pointsCost,
      category: category as ProductCategory,
      inventoryLimit: limit,
      inventoryAvailable: limit,
      imageUrl,
    });
  });

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, deactivated: 0, errors }, { status: errors.length > 0 ? 400 : 200 });
  }

  let deactivated = 0;
  if (clearExisting) {
    const result = await prisma.product.updateMany({
      where: { schoolId, isActive: true },
      data: { isActive: false, featured: false },
    });
    deactivated = result.count;
  }

  await prisma.product.createMany({ data: toCreate });

  return NextResponse.json({ created: toCreate.length, deactivated, errors });
}
