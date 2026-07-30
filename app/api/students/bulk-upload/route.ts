import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard, TEAMS } from "@/lib/leaderboard";
import Papa from "papaparse";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;
  const body = await req.json();
  const csvText: string = body.csv;
  const clearExisting: boolean = body.clearExisting ?? false;

  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: "Could not parse CSV", details: parsed.errors }, { status: 400 });
  }

  const errors: string[] = [];
  const valid: { externalId: string; firstName: string; lastName: string; grade: string; homeroom: string; team: string; initialPoints: number }[] = [];

  // Build a case-insensitive lookup for team names
  const teamLookup = new Map(
    (TEAMS as readonly string[]).map((t) => [t.toLowerCase(), t])
  );
  // Also accept common shorthand
  const teamAliases: Record<string, string> = {
    "no house": "Unassigned",
    "unassigned": "Unassigned",
    "none": "Unassigned",
    "": "Unassigned",
  };

  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    const externalId = row.student_id?.trim();
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();
    const grade = row.grade?.trim();
    const homeroom = row.homeroom?.trim();
    const rawTeam = row.team?.trim() ?? "";
    const initialPoints = row.initial_points ? Number(row.initial_points) : 0;

    if (!externalId || !firstName || !lastName || !grade || !homeroom) {
      errors.push(`Row ${rowNum}: missing required field (student_id, first_name, last_name, grade, or homeroom)`);
      return;
    }

    // Normalize team name — case-insensitive match, fallback to Unassigned
    const team =
      teamLookup.get(rawTeam.toLowerCase()) ??
      teamAliases[rawTeam.toLowerCase()] ??
      "Unassigned";

    if (team === "Unassigned") {
      errors.push(`Row ${rowNum}: ${firstName} ${lastName} has no house assigned — imported as Unassigned`);
    }

    valid.push({ externalId, firstName, lastName, grade, homeroom, team, initialPoints });
  });

  if (valid.length === 0 && errors.length > 0) {
    return NextResponse.json({ created: 0, skipped: 0, errors }, { status: 400 });
  }

  if (clearExisting) {
    // Must delete in FK-safe order
    const studentIds = (await prisma.student.findMany({ where: { schoolId }, select: { id: true } })).map((s) => s.id);
    if (studentIds.length > 0) {
      await prisma.leaderboardCache.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.studentClass.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.goldenBulldog.deleteMany({ where: { studentId: { in: studentIds } } });
      await prisma.pointAward.deleteMany({ where: { studentId: { in: studentIds } } });
      // Order items cascade from orders; delete orders after items aren't needed separately
      const orderIds = (await prisma.order.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } })).map((o) => o.id);
      if (orderIds.length > 0) {
        await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }
      await prisma.student.deleteMany({ where: { schoolId } });
    }
  }

  // Bulk insert — skip duplicates
  const existing = await prisma.student.findMany({ where: { schoolId }, select: { externalId: true } });
  const existingIds = new Set(existing.map((s) => s.externalId));

  const toCreate = valid.filter((r) => !existingIds.has(r.externalId));
  const skipped = valid.length - toCreate.length;

  if (toCreate.length > 0) {
    await prisma.student.createMany({
      data: toCreate.map((r) => ({
        schoolId,
        externalId: r.externalId,
        firstName: r.firstName,
        lastName: r.lastName,
        grade: r.grade,
        homeroom: r.homeroom,
        team: r.team,
        totalPoints: r.initialPoints,
        lifetimePoints: r.initialPoints,
      })),
      skipDuplicates: true,
    });
  }

  await refreshLeaderboard(schoolId);

  return NextResponse.json({ created: toCreate.length, skipped, errors });
}
