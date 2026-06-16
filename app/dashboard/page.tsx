import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/leaderboard";

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const schoolId = session!.user.schoolId!;

  if (role === "admin") return <AdminDashboard schoolId={schoolId} />;
  if (role === "teacher") return <TeacherDashboard />;
  return <StudentDashboard schoolId={schoolId} studentId={session!.user.studentId!} />;
}

async function StudentDashboard({ schoolId, studentId }: { schoolId: number; studentId: number }) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return <p>Student record not found.</p>;

  const recentAwards = await prisma.pointAward.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { category: true },
  });

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
    </div>
  );
}

function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/award-points" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">⭐</div>
          <div className="font-semibold">Award Points</div>
        </Link>
        <Link href="/leaderboards" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">🏆</div>
          <div className="font-semibold">Leaderboards</div>
        </Link>
        <Link href="/store" className="card text-center hover:shadow-md">
          <div className="text-2xl mb-1">🛍️</div>
          <div className="font-semibold">Store Inventory</div>
        </Link>
      </div>
    </div>
  );
}

async function AdminDashboard({ schoolId }: { schoolId: number }) {
  const [totalPointsAgg, totalOrders, pendingOrders, topStudents, school] = await Promise.all([
    prisma.pointAward.aggregate({ where: { schoolId }, _sum: { points: true } }),
    prisma.order.count({ where: { schoolId } }),
    prisma.order.count({ where: { schoolId, status: "pending" } }),
    prisma.student.findMany({
      where: { schoolId },
      orderBy: { totalPoints: "desc" },
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
          <p className="text-sm text-gray-500">Pending Approvals</p>
          <p className="text-2xl font-bold text-amber-600">{pendingOrders}</p>
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
                <span className="font-bold">{s.totalPoints} pts</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-2">
          <h2 className="text-lg font-bold mb-2">Quick Links</h2>
          <Link href="/admin/orders" className="btn btn-secondary w-full">Approvals Queue</Link>
          <Link href="/admin/products" className="btn btn-secondary w-full">Manage Store</Link>
          <Link href="/admin/students/upload" className="btn btn-secondary w-full">Upload Students</Link>
          <Link href="/admin/staff" className="btn btn-secondary w-full">Manage Staff</Link>
          <Link href="/admin/settings" className="btn btn-secondary w-full">Settings</Link>
        </div>
      </div>
    </div>
  );
}
