import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings, setSetting } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSettings(session.user.schoolId);
  const categories = await prisma.pointCategory.findMany({ where: { schoolId: session.user.schoolId }, orderBy: { name: "asc" } });

  return NextResponse.json({ settings, categories });
}

const BUILT_IN_CATEGORIES = ["Behavior", "Academic", "Attendance", "Citizenship"];

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const body = await req.json();
  const { settings, newCategory, categoryToggle } = body;

  if (settings) {
    for (const [key, value] of Object.entries(settings)) {
      await setSetting(schoolId, key, String(value));
    }
  }

  if (newCategory) {
    await prisma.pointCategory.upsert({
      where: { schoolId_name: { schoolId, name: newCategory } },
      create: { schoolId, name: newCategory, isActive: true },
      update: {},
    });
  }

  if (categoryToggle) {
    const { id, isActive } = categoryToggle;
    const category = await prisma.pointCategory.findFirst({ where: { id, schoolId } });
    if (category && (!BUILT_IN_CATEGORIES.includes(category.name) || isActive)) {
      await prisma.pointCategory.update({ where: { id }, data: { isActive } });
    } else if (category && BUILT_IN_CATEGORIES.includes(category.name) && !isActive) {
      return NextResponse.json({ error: "Cannot deactivate built-in categories" }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
