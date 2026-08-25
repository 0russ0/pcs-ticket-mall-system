import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { TEAM_COLORS, getTeamSummaries } from "@/lib/leaderboard";
import TeacherRoster from "./TeacherRoster";

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const schoolId = session!.user.schoolId!;

  if (role === "admin") return <AdminDashboard schoolId={schoolId} />;
  if (role === "teacher") return <TeacherDashboard schoolId={schoolId} />;
  if (role === "power_user") return <TeacherDashboard schoolId={schoolId} isPowerUser />;
  return <StudentDashboard schoolId={schoolId} studentId={session!.user.studentId!} />;
}

async function StudentDashboard({ schoolId, studentId }: { schoolId: number; studentId: number }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return <p>Student record not found.</p>;

  const [goldenBulldogs, recentAwards, allGBRankings] = await Promise.all([
    prisma.goldenBulldog.findMany({
      where: { studentId },
      orderBy: { observedDate: "desc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.pointAward.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { category: true },
    }),
    // All-time GB counts for rankings (counts only — never exposes other students' names)
    prisma.goldenBulldog.groupBy({
      by: ["studentId"],
      where: { schoolId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
  ]);

  // Find this student's GB rank
  const gbRankIndex = allGBRankings.findIndex((r) => r.studentId === studentId);
  const gbCount = goldenBulldogs.length;
  const gbRank = gbRankIndex >= 0 ? gbRankIndex + 1 : null;

  const rankRow = await prisma.leaderboardCache.findFirst({
    where: { schoolId, leaderboardType: "school_wide", studentId },
  });

  const orderCounts = await prisma.order.groupBy({
    by: ["status"],
    where: { studentId },
    _count: true,
  });

  const teamColor = TEAM_COLORS[student.team] || "#2563eb";

  return (
    <div className="space-y-6">
      <div className="card" style={{ borderLeft: `6px solid ${teamColor}` }}>
        <h1 className="text-2xl font-bold">Hi, {student.firstName}!</h1>
        <p className="text-gray-600">
          Grade {student.grade} &middot; {student.homeroom} &middot; {student.team}
        </p>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-blue-600">{student.totalPoints}</span>
          <span className="text-gray-600">points</span>
        </div>
        {rankRow && (
          <p className="text-sm text-gray-500 mt-1">
            School rank: #{rankRow.rank}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/store" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">🛍️</div>
          <div className="font-semibold">Shop Now</div>
        </Link>
        <Link href="/orders" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">📦</div>
          <div className="font-semibold">My Orders</div>
          {orderCounts.some((o) => o.status === "pending") && (
            <span className="badge bg-amber-100 text-amber-800 mt-1">Pending</span>
          )}
        </Link>
        <Link href="/leaderboards" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">🏆</div>
          <div className="font-semibold">Leaderboards</div>
        </Link>
        <Link href="/leaderboards?type=team" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">🏠</div>
          <div className="font-semibold">My Team</div>
        </Link>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-2">Recent Activity</h2>
        {recentAwards.length === 0 && <p className="text-gray-500">No points awarded yet.</p>}
        <ul className="divide-y">
          {recentAwards.map((a) => (
            <li key={a.id} className="py-2 flex justify-between text-sm">
              <div>
                <p className="font-medium">{a.category.name}</p>
                {a.reason && <p className="text-gray-500">{a.reason}</p>}
              </div>
              <span className={`font-bold ${a.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                {a.points >= 0 ? "+" : ""}
                {a.points}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {goldenBulldogs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Image src="/golden-bulldog.png" alt="" width={28} height={28} />
              My Golden Bulldogs ({gbCount})
            </h2>
            {gbRank && (
              <span className="text-sm font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
                #{gbRank} All-Time Rank
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {goldenBulldogs.map((gb) => (
              <div key={gb.id} className="flex flex-col items-center gap-1 group relative">
                <Image src="/golden-bulldog.png" alt="Golden Bulldog" width={52} height={52} className="drop-shadow" />
                <span className="text-xs text-gray-500">
                  {new Date(gb.observedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-48 z-10 shadow-lg">
                  <p className="font-bold mb-1">{gb.category.name}</p>
                  <p>{gb.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

async function TeacherDashboard({ schoolId, isPowerUser = false }: { schoolId: number; isPowerUser?: boolean }) {
  const session = await import("@/auth").then((m) => m.auth());
  const staffId = session?.user?.staffId;
  const teamSummaries = isPowerUser ? await getTeamSummaries(schoolId) : null;

  // Check if this teacher has any classes assigned via enrollment import
  const assignedClasses = staffId
    ? await prisma.class.findMany({
        where: { schoolId, teacherId: staffId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, period: true },
      })
    : [];

  // Fall back to homerooms if no classes imported yet
  const useClasses = assignedClasses.length > 0;
  let rosterItems: { label: string; value: string; type: "class" | "homeroom" }[] = [];

  if (useClasses) {
    rosterItems = assignedClasses.map((c) => ({
      label: c.period ? `${c.name} (Period ${c.period})` : c.name,
      value: String(c.id),
      type: "class" as const,
    }));
  } else {
    const homerooms = await prisma.student.findMany({
      where: { schoolId },
      select: { homeroom: true },
      distinct: ["homeroom"],
      orderBy: { homeroom: "asc" },
    });
    rosterItems = homerooms.map((r) => ({
      label: r.homeroom,
      value: r.homeroom,
      type: "homeroom" as const,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{isPowerUser ? "Power User Dashboard" : "Teacher Dashboard"}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/leaderboards" className="btn btn-secondary">🏆 Leaderboards</Link>
          <Link href="/dashboard/award-points" className="btn btn-secondary">⭐ Award Points</Link>
          <Link href="/dashboard/campaigns" className="btn btn-secondary">🎯 Challenges</Link>
          {isPowerUser && <Link href="/house-points" className="btn btn-primary">🏠 House Points</Link>}
        </div>
      </div>

      {isPowerUser && (
        <>
          <p className="text-gray-500 text-sm">
            You have every teacher capability, plus House Points: bulk-award points to a house/grade/homeroom and create house-only challenges — those never affect a student&apos;s personal balance.
          </p>
          {teamSummaries && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {teamSummaries.map((t, i) => (
                <div key={t.team} className="card flex items-center gap-3" style={{ borderLeft: `6px solid ${t.color}` }}>
                  <div className="text-xl font-bold text-gray-400 w-6">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{t.team}</p>
                    <p className="text-xs text-gray-500">{t.memberCount} members</p>
                  </div>
                  <div className="text-lg font-bold shrink-0">{t.totalPoints}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!useClasses && (
        <div className="card bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Showing homerooms — class enrollments haven&apos;t been imported yet. Contact your admin to import the class roster from PowerSchool.
        </div>
      )}
      <TeacherRoster rosterItems={rosterItems} />
    </div>
  );
}

async function AdminDashboard({ schoolId }: { schoolId: number }) {
  const [totalPointsAgg, totalOrders, pendingOrders, pendingProposals, topStudents, school] = await Promise.all([
    prisma.pointAward.aggregate({ where: { schoolId }, _sum: { points: true } }),
    prisma.order.count({ where: { schoolId } }),
    prisma.order.count({ where: { schoolId, status: "pending" } }),
    prisma.product.count({ where: { schoolId, proposalStatus: "pending" } }),
    prisma.student.findMany({
      where: { schoolId },
      orderBy: { lifetimePoints: "desc" },
      take: 5,
    }),
    prisma.school.findUnique({ where: { id: schoolId } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{school?.name} &mdash; Admin Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-sm text-gray-500">Total Points Awarded</p>
          <p className="text-2xl font-bold">{totalPointsAgg._sum.points ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <Link href="/admin/orders" className="card hover:shadow-md">
          <p className="text-sm text-gray-500">Pending Orders</p>
          <p className="text-2xl font-bold text-amber-600">{pendingOrders}</p>
          {pendingProposals > 0 && (
            <p className="text-xs text-yellow-700 mt-1">{pendingProposals} store proposal{pendingProposals !== 1 ? "s" : ""}</p>
          )}
        </Link>
        <div className="card">
          <p className="text-sm text-gray-500">Students</p>
          <p className="text-2xl font-bold">
            {await prisma.student.count({ where: { schoolId } })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card">
          <h2 className="text-lg font-bold mb-2">Top 5 Students</h2>
          <ul className="divide-y">
            {topStudents.map((s, i) => (
              <li key={s.id} className="py-2 flex justify-between text-sm">
                <span>
                  #{i + 1} {s.firstName} {s.lastName}
                </span>
                <span className="font-bold">{s.lifetimePoints} pts</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-2">
          <h2 className="text-lg font-bold mb-2">Quick Links</h2>
          <Link href="/admin/orders" className="btn btn-secondary w-full">Approvals Queue</Link>
          <Link href="/admin/products" className="btn btn-secondary w-full">Manage Store</Link>
          <Link href="/admin/students" className="btn btn-secondary w-full">Manage Students</Link>
          <Link href="/admin/staff" className="btn btn-secondary w-full">Manage Staff</Link>
          <Link href="/admin/settings" className="btn btn-secondary w-full">Settings</Link>
          <Link href="/admin/year-reset" className="btn w-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">New Year Reset</Link>
        </div>
      </div>
    </div>
  );
}
