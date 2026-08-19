import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard";
import { buildCanonicalStudentRows, mapHouseToTeam, parseTeacherName } from "@/lib/powerschoolCsv";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;

  let csvText: string;
  let clearExisting: boolean;
  try {
    const body = await req.json();
    csvText = body.csv;
    clearExisting = body.clearExisting ?? false;
    if (!csvText) return NextResponse.json({ error: "No CSV data received" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not parse request body — file may be too large" }, { status: 400 });
  }

  try {
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: "Could not parse CSV", details: parsed.errors }, { status: 400 });
    }

    const canonicalRows = buildCanonicalStudentRows(parsed.data);

    const errors: string[] = [];
    const valid: { externalId: string; firstName: string; lastName: string; grade: string; homeroom: string; team: string; googleEmail: string | null }[] = [];

    for (const [sid, row] of canonicalRows) {
      const firstName = row["StudentFirstName"]?.trim();
      const lastName = row["StudentLastName"]?.trim();
      const grade = row["Grade"]?.trim();
      const rawHouse = row["House"]?.trim() ?? "";
      const teacherLastfirst = row["TeacherLastfirst"]?.trim() ?? "";
      const rawEmail = row["StudentEmail"]?.trim();

      if (!firstName || !lastName || !grade) {
        errors.push(`Student ${sid}: missing required field (StudentFirstName, StudentLastName, or Grade)`);
        continue;
      }

      const team = mapHouseToTeam(rawHouse);
      if (team === "Unassigned" && rawHouse.toLowerCase() !== "no house" && rawHouse !== "") {
        errors.push(`Student ${sid} (${firstName} ${lastName}): unknown house "${rawHouse}" — imported as Unassigned`);
      }

      const homeroom = parseTeacherName(teacherLastfirst).lastName || "Unassigned";
      const googleEmail = rawEmail ? rawEmail.toLowerCase() : null;

      valid.push({ externalId: sid, firstName, lastName, grade, homeroom, team, googleEmail });
    }

    // De-duplicate student emails against each other in this batch
    const emailCounts = new Map<string, number>();
    for (const r of valid) {
      if (r.googleEmail) emailCounts.set(r.googleEmail, (emailCounts.get(r.googleEmail) ?? 0) + 1);
    }
    for (const r of valid) {
      if (r.googleEmail && (emailCounts.get(r.googleEmail) ?? 0) > 1) {
        errors.push(`Student ${r.externalId} (${r.firstName} ${r.lastName}): email "${r.googleEmail}" is shared by multiple students in this file — login email skipped`);
        r.googleEmail = null;
      }
    }

    if (valid.length === 0 && errors.length > 0) {
      return NextResponse.json({ created: 0, skipped: 0, errors }, { status: 400 });
    }

    if (clearExisting) {
      const studentIds = (await prisma.student.findMany({ where: { schoolId }, select: { id: true } })).map((s) => s.id);
      if (studentIds.length > 0) {
        await prisma.campaignAward.deleteMany({ where: { studentId: { in: studentIds } } });
        await prisma.leaderboardCache.deleteMany({ where: { studentId: { in: studentIds } } });
        await prisma.studentClass.deleteMany({ where: { studentId: { in: studentIds } } });
        await prisma.goldenBulldog.deleteMany({ where: { studentId: { in: studentIds } } });
        await prisma.pointAward.deleteMany({ where: { studentId: { in: studentIds } } });
        const orderIds = (await prisma.order.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } })).map((o) => o.id);
        if (orderIds.length > 0) {
          await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
          await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
        }
        await prisma.student.deleteMany({ where: { schoolId } });
      }
    }

    // Bulk insert — skip duplicates by external ID
    const existing = await prisma.student.findMany({ where: { schoolId }, select: { externalId: true } });
    const existingIds = new Set(existing.map((s) => s.externalId));

    const toCreate = valid.filter((r) => !existingIds.has(r.externalId));
    const skipped = valid.length - toCreate.length;

    if (toCreate.length > 0) {
      await prisma.student.createMany({
        data: toCreate.map((r) => ({
          schoolId,
          externalId: r.externalId,
          googleEmail: r.googleEmail,
          firstName: r.firstName,
          lastName: r.lastName,
          grade: r.grade,
          homeroom: r.homeroom,
          team: r.team,
          totalPoints: 0,
          lifetimePoints: 0,
        })),
        skipDuplicates: true,
      });
    }

    await refreshLeaderboard(schoolId);

    return NextResponse.json({ created: toCreate.length, skipped, errors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Upload failed", detail: message }, { status: 500 });
  }
}
