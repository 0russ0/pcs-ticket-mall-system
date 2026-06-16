import { prisma } from "@/lib/prisma";

export const TEAMS = [
  "Rachel Carson House",
  "Clemente House",
  "Hot Metal House",
  "Liberty House",
] as const;

export const TEAM_COLORS: Record<string, string> = {
  "Rachel Carson House": "#3B82F6",
  "Clemente House": "#EF4444",
  "Hot Metal House": "#FBBF24",
  "Liberty House": "#10B981",
};

/**
 * Recompute and cache leaderboard rankings (school-wide, per homeroom, per team)
 * for a given school. Called after any point award or order completion that
 * changes student totals.
 */
export async function refreshLeaderboard(schoolId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, totalPoints: true, homeroom: true, team: true },
  });

  await prisma.leaderboardCache.deleteMany({ where: { schoolId } });

  const rows: {
    schoolId: number;
    leaderboardType: "school_wide" | "homeroom" | "team";
    grouping: string | null;
    studentId: number;
    rank: number;
    totalPoints: number;
  }[] = [];

  // School-wide
  const sorted = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  sorted.forEach((s, i) => {
    rows.push({
      schoolId,
      leaderboardType: "school_wide",
      grouping: null,
      studentId: s.id,
      rank: i + 1,
      totalPoints: s.totalPoints,
    });
  });

  // By homeroom
  const homerooms = new Set(students.map((s) => s.homeroom));
  for (const homeroom of homerooms) {
    const group = sorted.filter((s) => s.homeroom === homeroom);
    group.forEach((s, i) => {
      rows.push({
        schoolId,
        leaderboardType: "homeroom",
        grouping: homeroom,
        studentId: s.id,
        rank: i + 1,
        totalPoints: s.totalPoints,
      });
    });
  }

  // By team (individual ranking within team)
  for (const team of TEAMS) {
    const group = sorted.filter((s) => s.team === team);
    group.forEach((s, i) => {
      rows.push({
        schoolId,
        leaderboardType: "team",
        grouping: team,
        studentId: s.id,
        rank: i + 1,
        totalPoints: s.totalPoints,
      });
    });
  }

  if (rows.length > 0) {
    await prisma.leaderboardCache.createMany({ data: rows });
  }
}

export async function getTeamSummaries(schoolId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { team: true, totalPoints: true },
  });

  return TEAMS.map((team) => {
    const members = students.filter((s) => s.team === team);
    const total = members.reduce((sum, s) => sum + s.totalPoints, 0);
    return {
      team,
      color: TEAM_COLORS[team],
      totalPoints: total,
      memberCount: members.length,
      avgPoints: members.length > 0 ? Math.round(total / members.length) : 0,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}
