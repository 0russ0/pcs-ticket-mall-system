import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TEAMS, getTeamSummaries } from "@/lib/leaderboard";
import HousePointsAwardForm from "./HousePointsAwardForm";
import WheelSection from "./WheelSection";
import HouseBarChart from "@/components/HouseBarChart";

export default async function HousePointsPage() {
  const session = await auth();
  if (!session?.user || !["admin", "power_user"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const schoolId = session.user.schoolId!;
  const now = new Date();

  const [students, homerooms, grades, teamSummaries, houseChallenges] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { homeroom: true },
      distinct: ["homeroom"],
      orderBy: { homeroom: "asc" },
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { grade: true },
      distinct: ["grade"],
      orderBy: { grade: "asc" },
    }),
    getTeamSummaries(schoolId),
    prisma.campaign.findMany({
      where: {
        schoolId,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { _count: { select: { awards: true } } },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const houseOnlyChallenges = houseChallenges.filter(
    (c) => (c.audienceFilter as { type?: string } | null)?.type === "houses"
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">House Points</h1>
        <p className="text-gray-500 text-sm mt-1">
          Everything here counts toward house/team totals only — it never touches a student&apos;s personal point balance.
        </p>
      </div>

      {/* Current standings */}
      <div className="card">
        <HouseBarChart
          rows={teamSummaries.map((t) => ({
            team: t.team,
            points: t.totalPoints,
            color: t.color,
            subtitle: `${t.memberCount} members`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Award points */}
        <HousePointsAwardForm
          students={students}
          homerooms={homerooms.map((h) => h.homeroom)}
          grades={grades.map((g) => g.grade)}
          houses={[...TEAMS]}
        />

        <div className="space-y-6">
          {/* House challenges */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">House Challenges</h2>
              <Link href="/house-points/challenges/new" className="btn btn-primary text-sm">+ New Challenge</Link>
            </div>
            {houseOnlyChallenges.length === 0 ? (
              <p className="text-gray-400 text-sm">No active house challenges yet.</p>
            ) : (
              <div className="space-y-2">
                {houseOnlyChallenges.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/campaigns/${c.id}`}
                    className="block rounded-lg border p-3 hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <span className="badge bg-green-100 text-green-700 text-xs">Active</span>
                    </div>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{c._count.awards} award{c._count.awards !== 1 ? "s" : ""} given</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Spin the wheel */}
          <div className="card space-y-3">
            <h2 className="font-bold text-lg">🎡 Spin for a House</h2>
            <WheelSection />
          </div>
        </div>
      </div>
    </div>
  );
}
