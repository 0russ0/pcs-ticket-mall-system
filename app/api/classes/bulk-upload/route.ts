import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseTeacherName } from "@/lib/powerschoolCsv";
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

    const errors: string[] = [];
    type ValidRow = { firstName: string; lastName: string; grade: string; className: string; teacherEmail: string; teacherLastfirst: string; period: string | null };
    const valid: ValidRow[] = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const rowNum = i + 2;
      const firstName = row["First Name"]?.trim();
      const lastName = row["Last Name"]?.trim();
      const grade = row["Grade"]?.trim();
      const className = row["Course Name"]?.trim();
      const teacherEmail = row["Teacher Email"]?.trim().toLowerCase();
      const teacherLastfirst = row["Lastfirst"]?.trim() ?? "";
      const period = row["Abbreviation"]?.trim() || null;

      if (!firstName || !lastName || !className || !teacherEmail) {
        errors.push(`Row ${rowNum}: missing First Name, Last Name, Course Name, or Teacher Email`);
        continue;
      }
      valid.push({ firstName, lastName, grade: grade ?? "", className, teacherEmail, teacherLastfirst, period });
    }

    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid rows found", errors }, { status: 400 });
    }

    if (clearExisting) {
      const classIds = (await prisma.class.findMany({ where: { schoolId }, select: { id: true } })).map((c) => c.id);
      if (classIds.length > 0) {
        await prisma.studentClass.deleteMany({ where: { classId: { in: classIds } } });
      }
      await prisma.class.deleteMany({ where: { schoolId } });
    }

    // Pre-load staff by email
    const staffList = await prisma.staff.findMany({ where: { schoolId }, select: { id: true, googleEmail: true } });
    const staffMap = new Map(staffList.map((s) => [s.googleEmail.toLowerCase(), s.id]));

    // Pre-load students, keyed by first+last name (case-insensitive). This CSV
    // has no student ID column, so name is the only available match key.
    const studentList = await prisma.student.findMany({ where: { schoolId }, select: { id: true, firstName: true, lastName: true, grade: true } });
    const studentMap = new Map<string, typeof studentList>();
    for (const s of studentList) {
      const key = `${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`;
      if (!studentMap.has(key)) studentMap.set(key, []);
      studentMap.get(key)!.push(s);
    }

    let created = 0;
    let enrolled = 0;
    let skipped = 0;
    const classCache = new Map<string, number>(); // "teacherId:name:period" → classId

    for (const row of valid) {
      let teacherId = staffMap.get(row.teacherEmail);
      if (!teacherId) {
        // New teacher email seen in the roster — create their account now so
        // they can sign in and see this class immediately.
        const { firstName: tFirst, lastName: tLast } = parseTeacherName(row.teacherLastfirst);
        const newStaff = await prisma.staff.create({
          data: { schoolId, googleEmail: row.teacherEmail, firstName: tFirst || null, lastName: tLast || null, role: "teacher" },
        });
        teacherId = newStaff.id;
        staffMap.set(row.teacherEmail, teacherId);
        created++;
      }

      const key = `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}`;
      const matches = studentMap.get(key) ?? [];
      let studentDbId: number | undefined;
      if (matches.length === 1) {
        studentDbId = matches[0].id;
      } else if (matches.length > 1) {
        const byGrade = matches.filter((m) => m.grade === row.grade);
        if (byGrade.length === 1) {
          studentDbId = byGrade[0].id;
        } else {
          errors.push(`Ambiguous student "${row.firstName} ${row.lastName}" (Grade ${row.grade}) — matches ${matches.length} students, skipped`);
          skipped++;
          continue;
        }
      }

      if (!studentDbId) {
        errors.push(`Student not found: ${row.firstName} ${row.lastName} — import students first`);
        skipped++;
        continue;
      }

      // Find or create the class
      const cacheKey = `${teacherId}:${row.className}:${row.period ?? ""}`;
      let classId = classCache.get(cacheKey);
      if (!classId) {
        const cls = await prisma.class.upsert({
          where: {
            schoolId_teacherId_name_period: {
              schoolId,
              teacherId,
              name: row.className,
              period: row.period ?? "",
            },
          },
          create: { schoolId, teacherId, name: row.className, period: row.period },
          update: {},
        });
        classId = cls.id;
        classCache.set(cacheKey, classId);
      }

      // Enroll student
      const existing = await prisma.studentClass.findUnique({
        where: { studentId_classId: { studentId: studentDbId, classId } },
      });
      if (existing) { skipped++; continue; }

      await prisma.studentClass.create({ data: { studentId: studentDbId, classId } });
      enrolled++;
    }

    return NextResponse.json({ enrolled, skipped, teachersCreated: created, errors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Import failed", detail: message }, { status: 500 });
  }
}
