import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TEAM_COLORS, getTeamSummaries } from "@/lib/leaderboard";
import Link from "next/link";

type SearchParams = { type?: string; homeroom?: string };

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const { type = "school_wide", homeroom: homeroomParam } = await searchParams;

  const me =
    session!.user.role === "student"
      ? await prisma.student.findUnique({ where: { id: session!.user.studentId! } })
      : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboards</h1>

      <div className="flex gap-2 overflow-x-auto">
        <TabLink href="/leaderboards?type=school_wide" active={type === "school_wide"}>
          School-Wide
        </TabLink>
        <TabLink href="/leaderboards?type=homeroom" active={type === "homeroom"}>
          Homeroom
        </TabLink>
        <TabLink href="/leaderboards?type=team" active={type === "team"}>
          Teams
        </TabLink>
      </div>

      {type === "school_wide" && <SchoolWide schoolId={schoolId} me={me} />}
      {type === "homeroom" && (
        <Homeroom schoolId={schoolId} me={me} homeroomParam={homeroomParam} />
      )}
      {type === "team" && <Teams schoolId={schoolId} myTeam={me?.team} />}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`btn ${active ? "btn-primary" : "btn-secondary"} whitespace-nowrap`}
    >
      {children}
    </Link>
  );
}

async function SchoolWide({ schoolId, me }: { schoolId: number; me: { id: number } | null }) {
  const top = await prisma.leaderboardCache.findMany({
    where: { schoolId, leaderboardType: "school_wide", rank: { lte: 20 } },
    orderBy: { rank: "asc" },
    include: { student: true },
  });

  let myRow = null;
  if (me && !top.some((r) => r.studentId === me.id)) {
    myRow = await prisma.leaderboardCache.findFirst({
      where: { schoolId, leaderboardType: "school_wide", studentId: me.id },
      include: { student: true },
    });
  }

  return (
    <div className="space-y-2">
      {top.map((row) => (
        <LeaderboardCard
          key={row.id}
          rank={row.rank}
          name={`${row.student.firstName} ${row.student.lastName}`}
          grade={row.student.grade}
          team={row.student.team}
          points={row.totalPoints}
          highlight={row.studentId === me?.id}
        />
      ))}
      {myRow && (
        <>
          <p className="text-center text-gray-500 text-sm py-1">
            You are ranked #{myRow.rank} with {myRow.totalPoints} points
          </p>
          <LeaderboardCard
            rank={myRow.rank}
            name={`${myRow.student.firstName} ${myRow.student.lastName}`}
            grade={myRow.student.grade}
            team={myRow.student.team}
            points={myRow.totalPoints}
            highlight
          />
        </>
      )}
    </div>
  );
}

async function Homeroom({
  schoolId,
  me,
  homeroomParam,
}: {
  schoolId: number;
  me: { id: number; homeroom: string } | null;
  homeroomParam?: string;
}) {
  const homerooms = await prisma.student.findMany({
    where: { schoolId },
    select: { homeroom: true },
    distinct: ["homeroom"],
    orderBy: { homeroom: "asc" },
  });

  const selected = homeroomParam || me?.homeroom || homerooms[0]?.homeroom;

  const rows = await prisma.leaderboardCache.findMany({
    where: { schoolId, leaderboardType: "homeroom", grouping: selected, rank: { lte: 20 } },
    orderBy: { rank: "asc" },
    include: { student: true },
  });

  return (
    <div className="space-y-3">
      <form>
        <input type="hidden" name="type" value="homeroom" />
        <select name="homeroom" defaultValue={selected} className="input" onChange={(e) => e.target.form?.submit()}>
          {homerooms.map((h) => (
            <option key={h.homeroom} value={h.homeroom}>
              {h.homeroom}
            </option>
          ))}
        </select>
      </form>
      <div className="space-y-2">
        {rows.map((row) => (
          <LeaderboardCard
            key={row.id}
            rank={row.rank}
            name={`${row.student.firstName} ${row.student.lastName}`}
            grade={row.student.grade}
            team={row.student.team}
            points={row.totalPoints}
            highlight={row.studentId === me?.id}
          />
        ))}
        {rows.length === 0 && <p className="text-gray-500">No students in this homeroom yet.</p>}
      </div>
    </div>
  );
}

async function Teams({ schoolId, myTeam }: { schoolId: number; myTeam?: string }) {
  const teams = await getTeamSummaries(schoolId);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {teams.map((t, i) => (
        <div
          key={t.team}
          className="card flex items-center gap-3"
          style={{ borderLeft: `6px solid ${t.color}` }}
        >
          <div className="text-2xl font-bold text-gray-400 w-8">#{i + 1}</div>
          <div className="flex-1">
            <p className="font-bold">
              {t.team} {myTeam === t.team && <span className="badge bg-blue-100 text-blue-800 ml-1">My Team</span>}
            </p>
            <p className="text-sm text-gray-500">
              {t.memberCount} members &middot; avg {t.avgPoints} pts
            </p>
          </div>
          <div className="text-xl font-bold">{t.totalPoints}</div>
        </div>
      ))}
    </div>
  );
}

function LeaderboardCard({
  rank,
  name,
  grade,
  team,
  points,
  highlight,
}: {
  rank: number;
  name: string;
  grade: string;
  team: string;
  points: number;
  highlight?: boolean;
}) {
  const color = TEAM_COLORS[team] || "#9ca3af";
  return (
    <div
      className={`card flex items-center gap-3 ${highlight ? "ring-2 ring-blue-500" : ""}`}
      style={{ borderLeft: `6px solid ${color}` }}
    >
      <div className="text-xl font-bold text-gray-400 w-8 text-center">{rank}</div>
      <div className="flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-gray-500">Grade {grade} &middot; {team}</p>
      </div>
      <div className="text-lg font-bold">{points}</div>
    </div>
  );
}
