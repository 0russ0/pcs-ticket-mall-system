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
    // Two PowerSchool export layouts are supported:
    //  - older "Section Enrollment Report": First Name/Last Name columns, Abbreviation for section
    //  - newer "Section Enrollment w/ Houses": Stud Lastfirst (combined name) + Student Number
    //    (which lines up with Student.externalId, so it's the preferred match key), Section Number
    //    instead of Abbreviation. The House column is intentionally not read here — house
    //    assignment is managed separately in the app.
    type ValidRow = { studentNumber: string | null; firstName: string; lastName: string; grade: string; className: string; teacherEmail: string; teacherLastfirst: string; period: string | null };
    const valid: ValidRow[] = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const rowNum = i + 2;
      const studentNumber = row["Student Number"]?.trim() || null;
      let firstName = row["First Name"]?.trim();
      let lastName = row["Last Name"]?.trim();
      if ((!firstName || !lastName) && row["Stud Lastfirst"]) {
        const [last = "", first = ""] = row["Stud Lastfirst"].split(",").map((s) => s.trim());
        lastName = lastName || last;
        firstName = firstName || first.split(" ")[0]; // drop middle name(s)
      }
      const grade = row["Grade"]?.trim();
      const className = row["Course Name"]?.trim();
      const teacherEmail = row["Teacher Email"]?.trim().toLowerCase();
      const teacherLastfirst = row["Lastfirst"]?.trim() ?? "";
      const period = row["Abbreviation"]?.trim() || row["Section Number"]?.trim() || null;

      if ((!studentNumber && (!firstName || !lastName)) || !className || !teacherEmail) {
        errors.push(`Row ${rowNum}: missing Student Number (or First/Last Name), Course Name, or Teacher Email`);
        continue;
      }
      valid.push({ studentNumber, firstName: firstName ?? "", lastName: lastName ?? "", grade: grade ?? "", className, teacherEmail, teacherLastfirst, period });
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

    // Pre-load students. Student Number (externalId) is the preferred match key when
    // present — it's reliable and unambiguous. First+Last name (case-insensitive,
    // grade as a tiebreaker) is the fallback for exports without a student ID column.
    const studentList = await prisma.student.findMany({ where: { schoolId }, select: { id: true, externalId: true, firstName: true, lastName: true, grade: true } });
    const studentByExternalId = new Map(studentList.filter((s) => s.externalId).map((s) => [s.externalId as string, s]));
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

      let studentDbId: number | undefined = row.studentNumber ? studentByExternalId.get(row.studentNumber)?.id : undefined;
      if (!studentDbId) {
        const key = `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}`;
        const matches = studentMap.get(key) ?? [];
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
