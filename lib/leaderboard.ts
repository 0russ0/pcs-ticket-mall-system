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

  // School-wide uses current spendable balance
  const sortedByBalance = [...students].sort((a, b) => b.totalPoints - a.totalPoints);
  sortedByBalance.forEach((s, i) => {
    rows.push({
      schoolId,
      leaderboardType: "school_wide",
      grouping: null,
      studentId: s.id,
      rank: i + 1,
      totalPoints: s.totalPoints,
    });
  });

  // Homeroom & team use lifetime points — never reduced by redemptions
  const sortedByLifetime = [...students].sort((a, b) => b.lifetimePoints - a.lifetimePoints);

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

export async function getHomeroomSummaries(schoolId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { homeroom: true, lifetimePoints: true },
  });

  const homerooms = Array.from(new Set(students.map((s) => s.homeroom))).sort();

  return homerooms
    .map((homeroom) => {
      const members = students.filter((s) => s.homeroom === homeroom);
      const total = members.reduce((sum, s) => sum + s.lifetimePoints, 0);
      return {
        homeroom,
        totalPoints: total,
        memberCount: members.length,
        avgPoints: members.length > 0 ? Math.round(total / members.length) : 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getTeamSummaries(schoolId: number) {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { team: true, lifetimePoints: true },
  });

  return TEAMS.map((team) => {
    const members = students.filter((s) => s.team === team);
    const total = members.reduce((sum, s) => sum + s.lifetimePoints, 0);
    return {
      team,
      color: TEAM_COLORS[team],
      totalPoints: total,
      memberCount: members.length,
      avgPoints: members.length > 0 ? Math.round(total / members.length) : 0,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}
