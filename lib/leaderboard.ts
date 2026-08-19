import { prisma } from "@/lib/prisma";

export const TEAMS = [
  "Rachel Carson House",
  "Clemente House",
  "Hot Metal House",
  "Liberty House",
] as const;

export const TEAM_COLORS: Record<string, string> = {
  "Rachel Carson House": "#10B981",
  "Clemente House": "#EF4444",
  "Hot Metal House": "#FBBF24",
  "Liberty House": "#3B82F6",
};

export async function refreshLeaderboard(schoolId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, totalPoints: true, lifetimePoints: true, homeroom: true, team: true },
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

  // All leaderboards rank by lifetime points earned — never reduced by
  // redemptions. Only a student's own spendable balance (totalPoints) drops
  // when they place an order.
  const sortedByLifetime = [...students].sort((a, b) => b.lifetimePoints - a.lifetimePoints);

  sortedByLifetime.forEach((s, i) => {
    rows.push({
      schoolId,
      leaderboardType: "school_wide",
      grouping: null,
      studentId: s.id,
      rank: i + 1,
      totalPoints: s.lifetimePoints,
    });
  });

  const homerooms = new Set(students.map((s) => s.homeroom));
  for (const homeroom of homerooms) {
    const group = sortedByLifetime.filter((s) => s.homeroom === homeroom);
    group.forEach((s, i) => {
      rows.push({
        schoolId,
        leaderboardType: "homeroom",
        grouping: homeroom,
        studentId: s.id,
        rank: i + 1,
        totalPoints: s.lifetimePoints,
      });
    });
  }

  for (const team of TEAMS) {
    const group = sortedByLifetime.filter((s) => s.team === team);
    group.forEach((s, i) => {
      rows.push({
        schoolId,
        leaderboardType: "team",
        grouping: team,
        studentId: s.id,
        rank: i + 1,
        totalPoints: s.lifetimePoints,
      });
    });
  }

  if (rows.length > 0) {
    await prisma.leaderboardCache.createMany({ data: rows });
  }
}

export async function getHomeroomSummaries(schoolId: number, grades?: string[]) {
  const [students, bonuses] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, ...(grades ? { grade: { in: grades } } : {}) },
      select: { homeroom: true, lifetimePoints: true },
    }),
    prisma.groupBonus.groupBy({
      by: ["groupValue"],
      where: { schoolId, groupType: "homeroom" },
      _sum: { points: true },
    }),
  ]);

  const bonusMap = new Map(bonuses.map((b) => [b.groupValue, b._sum.points ?? 0]));
  const homerooms = Array.from(new Set(students.map((s) => s.homeroom))).sort();

  return homerooms
    .map((homeroom) => {
      const members = students.filter((s) => s.homeroom === homeroom);
      const studentTotal = members.reduce((sum, s) => sum + s.lifetimePoints, 0);
      const bonusTotal = bonusMap.get(homeroom) ?? 0;
      const total = studentTotal + bonusTotal;
      return {
        homeroom,
        totalPoints: total,
        memberCount: members.length,
        avgPoints: members.length > 0 ? Math.round(total / members.length) : 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getTeamSummaries(schoolId: number, grades?: string[]) {
  const [students, houseBonuses, groupBonuses] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, ...(grades ? { grade: { in: grades } } : {}) },
      select: { team: true, lifetimePoints: true },
    }),
    prisma.houseBonus.groupBy({
      by: ["house"],
      where: { schoolId },
      _sum: { points: true },
    }),
    prisma.groupBonus.groupBy({
      by: ["groupValue"],
      where: { schoolId, groupType: "house" },
      _sum: { points: true },
    }),
  ]);

  const bonusMap = new Map<string, number>();
  houseBonuses.forEach((b) => bonusMap.set(b.house, (bonusMap.get(b.house) ?? 0) + (b._sum.points ?? 0)));
  groupBonuses.forEach((b) => bonusMap.set(b.groupValue, (bonusMap.get(b.groupValue) ?? 0) + (b._sum.points ?? 0)));

  return TEAMS.map((team) => {
    const members = students.filter((s) => s.team === team);
    const studentTotal = members.reduce((sum, s) => sum + s.lifetimePoints, 0);
    const bonusTotal = bonusMap.get(team) ?? 0;
    const total = studentTotal + bonusTotal;
    return {
      team,
      color: TEAM_COLORS[team],
      totalPoints: total,
      memberCount: members.length,
      avgPoints: members.length > 0 ? Math.round(total / members.length) : 0,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}
