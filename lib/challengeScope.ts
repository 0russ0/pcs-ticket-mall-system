import { prisma } from "@/lib/prisma";

const GRADE_BANDS: Record<string, string[]> = {
  "2-5": ["2", "3", "4", "5"],
  "6-8": ["6", "7", "8"],
};

type AudienceFilter =
  | { type: "all" }
  | { type: "grade_band"; value: "2-5" | "6-8" }
  | { type: "grades"; values: string[] }
  | { type: "homerooms"; values: string[] }
  | { type: "houses"; values: string[] }
  | null;

export type TeacherScope = { grades: string[]; homerooms: string[]; hasRoster: boolean };

/** Grades and homerooms this teacher actually has students in, derived from their Class rosters. */
export async function getTeacherScope(schoolId: number, staffId: number): Promise<TeacherScope> {
  const classes = await prisma.class.findMany({
    where: { schoolId, teacherId: staffId },
    include: { students: { include: { student: { select: { grade: true, homeroom: true } } } } },
  });

  const grades = new Set<string>();
  const homerooms = new Set<string>();
  for (const c of classes) {
    for (const sc of c.students) {
      grades.add(sc.student.grade);
      homerooms.add(sc.student.homeroom);
    }
  }

  return { grades: [...grades], homerooms: [...homerooms], hasRoster: classes.length > 0 };
}

/**
 * House-scoped (and unscoped "all students") challenges are always visible to every
 * teacher. Grade/homeroom-scoped challenges only show for teachers whose roster
 * actually overlaps. Teachers with no imported roster see everything (permissive
 * fallback — we have no data to scope against).
 */
export function isChallengeVisibleToTeacher(filter: unknown, scope: TeacherScope): boolean {
  if (!scope.hasRoster) return true;

  const f = filter as AudienceFilter;
  if (!f || f.type === "all" || f.type === "houses") return true;
  if (f.type === "grade_band") return (GRADE_BANDS[f.value] ?? []).some((g) => scope.grades.includes(g));
  if (f.type === "grades") return f.values.some((g) => scope.grades.includes(g));
  if (f.type === "homerooms") return f.values.some((h) => scope.homerooms.includes(h));
  return true;
}
