import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshLeaderboard } from "@/lib/leaderboard";
import Papa from "papaparse";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const HOUSE_MAP: Record<string, string> = {
  "rachel carson house": "Rachel Carson House",
  "clemente house": "Clemente House",
  "hot metal house": "Hot Metal House",
  "liberty house": "Liberty House",
  "no house": "Unassigned",
  "": "Unassigned",
};

function parseTeacherName(lastfirst: string): { firstName: string; lastName: string } {
  const [last = "", first = ""] = lastfirst.split(",").map((s) => s.trim());
  return { firstName: first, lastName: last };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId!;

  let csvText: string;
  try {
    const body = await req.json();
    csvText = body.csv;
    if (!csvText) return NextResponse.json({ error: "No CSV data received" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not parse request body — file may be too large" }, { status: 400 });
  }

  try {
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: "Could not parse CSV", details: parsed.errors }, { status: 400 });
    }

    // Build per-student maps: prefer the homeroom course row, fall back to first row seen
    const homeroomRows = new Map<string, Record<string, string>>();
    const firstRows = new Map<string, Record<string, string>>();

    for (const row of parsed.data) {
      const sid = row["StudentNumber"]?.trim();
      if (!sid) continue;
      if (!firstRows.has(sid)) firstRows.set(sid, row);
      if (row["CourseName"]?.trim().toLowerCase().includes("homeroom")) homeroomRows.set(sid, row);
    }

    // Collect unique teachers from homeroom rows (or all rows as fallback)
    const teacherMap = new Map<string, { firstName: string; lastName: string }>();
    for (const row of [...homeroomRows.values(), ...firstRows.values()]) {
      const email = row["TeacherEmail"]?.trim().toLowerCase();
      if (email && !teacherMap.has(email)) {
        teacherMap.set(email, parseTeacherName(row["TeacherLastfirst"] ?? ""));
      }
    }

    // Build student records
    const warnings: string[] = [];
    const studentRows: {
      externalId: string;
      firstName: string;
      lastName: string;
      grade: string;
      homeroom: string;
      team: string;
      googleEmail: string | null;
    }[] = [];

    for (const [sid, firstRow] of firstRows) {
      const canonical = homeroomRows.get(sid) ?? firstRow;
      const firstName = canonical["StudentFirstName"]?.trim();
      const lastName = canonical["StudentLastName"]?.trim();
      const grade = canonical["Grade"]?.trim();
      const rawHouse = canonical["House"]?.trim() ?? "";
      const teacherLastfirst = canonical["TeacherLastfirst"]?.trim() ?? "";
      const rawEmail = canonical["StudentEmail"]?.trim();

      if (!firstName || !lastName || !grade) {
        warnings.push(`Student ${sid}: missing name or grade — skipped`);
        continue;
      }

      const team = HOUSE_MAP[rawHouse.toLowerCase()] ?? "Unassigned";
      if (team === "Unassigned" && rawHouse.toLowerCase() !== "no house" && rawHouse !== "") {
        warnings.push(`Student ${sid} (${firstName} ${lastName}): unknown house "${rawHouse}" — imported as Unassigned`);
      }

      const homeroom = parseTeacherName(teacherLastfirst).lastName || "Unassigned";
      const googleEmail = rawEmail ? rawEmail.toLowerCase() : null;

      if (!googleEmail) {
        warnings.push(`Student ${sid} (${firstName} ${lastName}): no email — will not be able to log in`);
      }

      studentRows.push({ externalId: sid, firstName, lastName, grade, homeroom, team, googleEmail });
    }

    // De-duplicate student emails — a shared email would violate the unique constraint
    const emailCounts = new Map<string, number>();
    for (const r of studentRows) {
      if (r.googleEmail) emailCounts.set(r.googleEmail, (emailCounts.get(r.googleEmail) ?? 0) + 1);
    }
    for (const r of studentRows) {
      if (r.googleEmail && (emailCounts.get(r.googleEmail) ?? 0) > 1) {
        warnings.push(`Student ${r.externalId} (${r.firstName} ${r.lastName}): email "${r.googleEmail}" is shared by multiple students — login email skipped`);
        r.googleEmail = null;
      }
    }

    if (studentRows.length === 0) {
      return NextResponse.json({ error: "No valid students found in CSV" }, { status: 400 });
    }

    // ── Clear existing data in FK-safe order ──────────────────────────────────
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

    // Clear records that reference Staff (must happen before deleting Staff)
    await prisma.houseBonus.deleteMany({ where: { schoolId } });
    await prisma.groupBonus.deleteMany({ where: { schoolId } });
    // Null out proposed-by on store items so teacher FK doesn't block
    await prisma.product.updateMany({ where: { schoolId }, data: { proposedByStaffId: null } });
    // Classes reference Staff via teacher_id
    await prisma.class.deleteMany({ where: { schoolId } });

    // Clear non-admin staff
    await prisma.staff.deleteMany({ where: { schoolId, role: "teacher" } });

    // ── Create new staff (teacher login email = TeacherEmail) ────────────────
    await prisma.staff.createMany({
      data: [...teacherMap.entries()].map(([email, { firstName, lastName }]) => ({
        schoolId,
        googleEmail: email,
        firstName,
        lastName,
        role: "teacher",
      })),
      skipDuplicates: true,
    });

    // ── Create new students (login email = StudentEmail, when present) ───────
    await prisma.student.createMany({
      data: studentRows.map((r) => ({
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

    await refreshLeaderboard(schoolId);

    return NextResponse.json({
      students: studentRows.length,
      staff: teacherMap.size,
      warnings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Import failed", detail: message }, { status: 500 });
  }
}
