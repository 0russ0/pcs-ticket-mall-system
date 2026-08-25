import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type AudienceFilter =
  | { type: "grade_band"; value: "2-5" | "6-8" }
  | { type: "grades"; values: string[] }
  | { type: "homerooms"; values: string[] }
  | { type: "houses"; values: string[] };

const GRADE_BANDS: Record<string, string[]> = {
  "2-5": ["2", "3", "4", "5"],
  "6-8": ["6", "7", "8"],
};

function isEligible(
  filter: AudienceFilter | null,
  grade: string,
  homeroom: string,
  team: string
): boolean {
  if (!filter) return true;
  if (filter.type === "grade_band") return GRADE_BANDS[filter.value]?.includes(grade) ?? false;
  if (filter.type === "grades") return filter.values.includes(grade);
  if (filter.type === "homerooms") return filter.values.includes(homeroom);
  if (filter.type === "houses") return filter.values.includes(team);
  return true;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";

  const products = await prisma.product.findMany({
    where: {
      schoolId: session.user.schoolId,
      ...(isAdmin ? {} : { isActive: true }),
      // Out-of-stock items disappear from the store entirely until restocked.
      OR: [{ inventoryLimit: null }, { inventoryAvailable: { gt: 0 } }],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  if (isAdmin || ["teacher", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json(products);
  }

  // For students: filter by audience
  const student = await prisma.student.findUnique({
    where: { id: session.user.studentId! },
    select: { grade: true, homeroom: true, team: true },
  });

  if (!student) return NextResponse.json(products);

  const eligible = products.filter((p) =>
    isEligible(p.audienceFilter as AudienceFilter | null, student.grade, student.homeroom, student.team)
  );

  return NextResponse.json(eligible);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, points_cost, category, inventory_limit, image_url, is_active, audience_filter, featured } = body;

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
      audienceFilter: audience_filter ?? null,
      featured: featured ?? false,
    },
  });

  return NextResponse.json(product);
}
