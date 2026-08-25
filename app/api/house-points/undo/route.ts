import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const UNDO_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !["admin", "power_user"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId!;
  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number) : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No entries to undo" }, { status: 400 });
  }

  // Only allow undoing your own recent entries — never someone else's, and
  // not an arbitrarily old one a stale browser tab might still reference.
  const since = new Date(Date.now() - UNDO_WINDOW_MS);
  const result = await prisma.houseBonus.deleteMany({
    where: { id: { in: ids }, schoolId, staffId, createdAt: { gte: since } },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Nothing to undo — it may have already been undone or is too old." }, { status: 400 });
  }

  return NextResponse.json({ success: true, undone: result.count });
}
