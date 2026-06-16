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

  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    const externalId = row.student_id?.trim();
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();
    const grade = row.grade?.trim();
    const homeroom = row.homeroom?.trim();
    const team = row.team?.trim();
    const initialPoints = row.initial_points ? Number(row.initial_points) : 0;

    if (!externalId || !firstName || !lastName || !grade || !homeroom || !team) {
      errors.push(`Row ${rowNum}: missing required field`);
      return;
    }
    if (!(TEAMS as readonly string[]).includes(team)) {
      errors.push(`Row ${rowNum}: invalid team "${team}". Must be one of: ${TEAMS.join(", ")}`);
      return;
    }

    valid.push({ externalId, firstName, lastName, grade, homeroom, team, initialPoints });
  });

  if (clearExisting) {
    await prisma.student.deleteMany({ where: { schoolId } });
  }

  let created = 0;
  let skipped = 0;
  for (const row of valid) {
    const existing = await prisma.student.findUnique({
      where: { schoolId_externalId: { schoolId, externalId: row.externalId } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.student.create({
      data: {
        schoolId,
        externalId: row.externalId,
        firstName: row.firstName,
        lastName: row.lastName,
        grade: row.grade,
        homeroom: row.homeroom,
        team: row.team,
        totalPoints: row.initialPoints || 0,
      },
    });
    created++;
  }

  await refreshLeaderboard(schoolId);

  return NextResponse.json({ created, skipped, errors });
}
