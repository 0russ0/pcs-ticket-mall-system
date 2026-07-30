import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  type ValidRow = { studentId: string; className: string; teacherEmail: string; period: string | null };
  const valid: ValidRow[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2;
    const studentId = row.student_id?.trim();
    const className = row.class_name?.trim();
    const teacherEmail = row.teacher_email?.trim().toLowerCase();
    const period = row.period?.trim() || null;

    if (!studentId || !className || !teacherEmail) {
      errors.push(`Row ${rowNum}: missing student_id, class_name, or teacher_email`);
      continue;
    }
    valid.push({ studentId, className, teacherEmail, period });
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "No valid rows found", errors }, { status: 400 });
  }

  if (clearExisting) {
    // Delete all class enrollments for this school, then all classes
    const classIds = (await prisma.class.findMany({ where: { schoolId }, select: { id: true } })).map((c) => c.id);
    if (classIds.length > 0) {
      await prisma.studentClass.deleteMany({ where: { classId: { in: classIds } } });
    }
    await prisma.class.deleteMany({ where: { schoolId } });
  }

  // Pre-load staff by email
  const staffList = await prisma.staff.findMany({ where: { schoolId }, select: { id: true, googleEmail: true } });
  const staffMap = new Map(staffList.map((s) => [s.googleEmail.toLowerCase(), s.id]));

  // Pre-load students by externalId
  const studentList = await prisma.student.findMany({ where: { schoolId }, select: { id: true, externalId: true } });
  const studentMap = new Map(studentList.map((s) => [s.externalId ?? "", s.id]));

  let enrolled = 0;
  let skipped = 0;
  const classCache = new Map<string, number>(); // "teacherId:name:period" → classId

  for (const row of valid) {
    let teacherId = staffMap.get(row.teacherEmail);
    if (!teacherId) {
      // Create a placeholder staff account from the email in the export
      const newStaff = await prisma.staff.create({
        data: { schoolId, googleEmail: row.teacherEmail, role: "teacher" },
      });
      teacherId = newStaff.id;
      staffMap.set(row.teacherEmail, teacherId);
    }

    const studentDbId = studentMap.get(row.studentId);
    if (!studentDbId) {
      errors.push(`Student not found: student_id=${row.studentId} — import students first`);
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

  return NextResponse.json({ enrolled, skipped, errors });
}
