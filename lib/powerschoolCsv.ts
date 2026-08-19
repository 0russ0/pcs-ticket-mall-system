export type PSRow = Record<string, string>;

export const HOUSE_MAP: Record<string, string> = {
  "rachel carson house": "Rachel Carson House",
  "clemente house": "Clemente House",
  "hot metal house": "Hot Metal House",
  "liberty house": "Liberty House",
  "no house": "Unassigned",
  "": "Unassigned",
};

export function parseTeacherName(lastfirst: string): { firstName: string; lastName: string } {
  const [last = "", first = ""] = lastfirst.split(",").map((s) => s.trim());
  return { firstName: first, lastName: last };
}

export function mapHouseToTeam(rawHouse: string): string {
  return HOUSE_MAP[rawHouse.trim().toLowerCase()] ?? "Unassigned";
}

/**
 * PowerSchool "Section Enrollment" exports one row per student per course.
 * The homeroom row (CourseName containing "homeroom") is the canonical
 * source for grade/house/homeroom-teacher; other rows are a fallback for
 * students missing a homeroom row.
 */
export function buildCanonicalStudentRows(rows: PSRow[]): Map<string, PSRow> {
  const homeroomRows = new Map<string, PSRow>();
  const firstRows = new Map<string, PSRow>();

  for (const row of rows) {
    const sid = row["StudentNumber"]?.trim();
    if (!sid) continue;
    if (!firstRows.has(sid)) firstRows.set(sid, row);
    if (row["CourseName"]?.trim().toLowerCase().includes("homeroom")) homeroomRows.set(sid, row);
  }

  const canonical = new Map<string, PSRow>();
  for (const [sid, row] of firstRows) {
    canonical.set(sid, homeroomRows.get(sid) ?? row);
  }
  return canonical;
}

export function buildTeacherMap(rows: PSRow[]): Map<string, { firstName: string; lastName: string }> {
  const teacherMap = new Map<string, { firstName: string; lastName: string }>();
  for (const row of rows) {
    const email = row["TeacherEmail"]?.trim().toLowerCase();
    if (email && !teacherMap.has(email)) {
      teacherMap.set(email, parseTeacherName(row["TeacherLastfirst"] ?? ""));
    }
  }
  return teacherMap;
}
