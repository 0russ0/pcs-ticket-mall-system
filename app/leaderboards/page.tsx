import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS, TEAM_COLORS, getTeamSummaries, getHomeroomSummaries } from "@/lib/leaderboard";
import Link from "next/link";
import HomeroomSelect from "./HomeroomSelect";
import HouseBarChart from "@/components/HouseBarChart";
import { houseBadgeUrl } from "@/lib/houseLogos";

type SearchParams = { type?: string; homeroom?: string; band?: string };

const GRADE_BANDS: Record<string, string[]> = {
  "2-5": ["2", "3", "4", "5"],
  "6-8": ["6", "7", "8"],
};

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const role = session!.user.role;
  const isStudent = role === "student";
  // Students may never see another student's individual total — just the
  // house/team leaderboard and the (also house-aggregated) Challenges tab.
  // Power users get full teacher-level access to every tab.
  const isHouseOnly = isStudent;

  const { type: typeParam = "school_wide", homeroom: homeroomParam, band = "all" } = await searchParams;
  const type = isHouseOnly && !["team", "challenges"].includes(typeParam) ? "team" : typeParam;

  const me =
    session!.user.role === "student"
      ? await prisma.student.findUnique({ where: { id: session!.user.studentId! } })
      : null;

  const grades = band !== "all" ? (GRADE_BANDS[band] ?? null) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboards</h1>

      {role === "admin" && (
        <div className="flex gap-2 overflow-x-auto">
          {(["all", "2-5", "6-8"] as const).map((b) => (
            <Link
              key={b}
              href={`/leaderboards?type=${type}&band=${b}`}
              className={`btn whitespace-nowrap ${band === b ? "btn-primary" : "btn-secondary"}`}
            >
              {b === "all" ? "All Grades" : `Grades ${b}`}
            </Link>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {!isHouseOnly && (
          <>
            <TabLink href={`/leaderboards?type=school_wide&band=${band}`} active={type === "school_wide"}>School-Wide</TabLink>
            <TabLink href={`/leaderboards?type=homeroom&band=${band}`} active={type === "homeroom"}>Homeroom</TabLink>
          </>
        )}
        <TabLink href={`/leaderboards?type=team&band=${band}`} active={type === "team"}>Teams</TabLink>
        <TabLink href={`/leaderboards?type=challenges&band=${band}`} active={type === "challenges"}>Challenges</TabLink>
      </div>

      {type === "school_wide" && !isHouseOnly && <SchoolWide schoolId={schoolId} me={me} grades={grades} />}
      {type === "homeroom" && !isHouseOnly && (
        <Homeroom schoolId={schoolId} me={me} homeroomParam={homeroomParam} grades={grades} band={band} />
      )}
      {type === "team" && <Teams schoolId={schoolId} myTeam={me?.team} grades={grades} />}
      {type === "challenges" && <Challenges schoolId={schoolId} myTeam={me?.team} />}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`btn ${active ? "btn-primary" : "btn-secondary"} whitespace-nowrap`}>
      {children}
    </Link>
  );
}

async function SchoolWide({ schoolId, me, grades }: { schoolId: number; me: { id: number } | null; grades: string[] | null }) {
  if (grades) {
    const students = await prisma.student.findMany({
      where: { schoolId, grade: { in: grades } },
      orderBy: { lifetimePoints: "desc" },
      take: 20,
    });
    return (
      <div className="space-y-2">
        {students.map((s, i) => (
          <LeaderboardCard key={s.id} rank={i + 1} name={`${s.firstName} ${s.lastName}`} grade={s.grade} team={s.team} points={s.lifetimePoints} highlight={s.id === me?.id} />
        ))}
        {students.length === 0 && <p className="text-gray-500">No students in this grade range.</p>}
      </div>
    );
  }

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
        <LeaderboardCard key={row.id} rank={row.rank} name={`${row.student.firstName} ${row.student.lastName}`} grade={row.student.grade} team={row.student.team} points={row.totalPoints} highlight={row.studentId === me?.id} />
      ))}
      {myRow && (
        <>
          <p className="text-center text-gray-500 text-sm py-1">You are ranked #{myRow.rank} with {myRow.totalPoints} points</p>
          <LeaderboardCard rank={myRow.rank} name={`${myRow.student.firstName} ${myRow.student.lastName}`} grade={myRow.student.grade} team={myRow.student.team} points={myRow.totalPoints} highlight />
        </>
      )}
    </div>
  );
}

async function Homeroom({ schoolId, me, homeroomParam, grades, band }: {
  schoolId: number; me: { id: number; homeroom: string } | null; homeroomParam?: string; grades: string[] | null; band: string;
}) {
  const homerooms = await prisma.student.findMany({
    where: { schoolId, ...(grades ? { grade: { in: grades } } : {}) },
    select: { homeroom: true },
    distinct: ["homeroom"],
    orderBy: { homeroom: "asc" },
  });

  const selected = homeroomParam || me?.homeroom || homerooms[0]?.homeroom;

  if (selected === "__all__") {
    const summaries = await getHomeroomSummaries(schoolId, grades ?? undefined);
    return (
      <div className="space-y-3">
        <HomeroomSelect homerooms={homerooms.map((h) => h.homeroom)} selected={selected} band={band} />
        <div className="space-y-2">
          {summaries.map((s, i) => (
            <div key={s.homeroom} className={`card flex items-center gap-3 ${me?.homeroom === s.homeroom ? "ring-2 ring-blue-500" : ""}`}>
              <div className="text-xl font-bold text-gray-400 w-8 text-center">#{i + 1}</div>
              <div className="flex-1">
                <p className="font-semibold">{s.homeroom} {me?.homeroom === s.homeroom && <span className="badge bg-blue-100 text-blue-800 ml-1">My Homeroom</span>}</p>
                <p className="text-xs text-gray-500">{s.memberCount} students &middot; avg {s.avgPoints} pts</p>
              </div>
              <div className="text-lg font-bold">{s.totalPoints}</div>
            </div>
          ))}
          {summaries.length === 0 && <p className="text-gray-500">No homerooms yet.</p>}
        </div>
      </div>
    );
  }

  const rows = await prisma.leaderboardCache.findMany({
    where: { schoolId, leaderboardType: "homeroom", grouping: selected, rank: { lte: 20 } },
    orderBy: { rank: "asc" },
    include: { student: true },
  });

  const visibleRows = grades ? rows.filter((r) => grades.includes(r.student.grade)) : rows;

  return (
    <div className="space-y-3">
      <HomeroomSelect homerooms={homerooms.map((h) => h.homeroom)} selected={selected} band={band} />
      <div className="space-y-2">
        {visibleRows.map((row) => (
          <LeaderboardCard key={row.id} rank={row.rank} name={`${row.student.firstName} ${row.student.lastName}`} grade={row.student.grade} team={row.student.team} points={row.totalPoints} highlight={row.studentId === me?.id} />
        ))}
        {visibleRows.length === 0 && <p className="text-gray-500">No students in this homeroom yet.</p>}
      </div>
    </div>
  );
}

async function Teams({ schoolId, myTeam, grades }: { schoolId: number; myTeam?: string; grades: string[] | null }) {
  const teams = await getTeamSummaries(schoolId, grades ?? undefined);
  return (
    <div className="card">
      <HouseBarChart
        myTeam={myTeam}
        rows={teams.map((t) => ({
          team: t.team,
          points: t.totalPoints,
          color: t.color,
          subtitle: `${t.memberCount} members · avg ${t.avgPoints}`,
        }))}
      />
    </div>
  );
}

// House-scoped challenges only, aggregated by house — never shows an individual
// student's points, consistent with the rest of the leaderboard privacy rules.
async function Challenges({ schoolId, myTeam }: { schoolId: number; myTeam?: string }) {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: { schoolId, isActive: true, OR: [{ endDate: null }, { endDate: { gte: now } }] },
    orderBy: { startDate: "desc" },
  });

  const houseCampaigns = campaigns.filter((c) => {
    const f = c.audienceFilter as { type?: string } | null;
    return f?.type === "houses";
  });

  if (houseCampaigns.length === 0) {
    return <p className="text-gray-500">No house challenges are active right now.</p>;
  }

  const summaries = await Promise.all(
    houseCampaigns.map(async (c) => {
      const f = c.audienceFilter as { values?: string[] };
      const targetHouses = f.values?.length ? f.values : [...TEAMS];

      const awards = await prisma.campaignAward.findMany({
        where: { campaignId: c.id },
        select: { points: true, student: { select: { team: true } } },
      });

      const totals = new Map<string, number>(targetHouses.map((h) => [h, 0]));
      for (const a of awards) {
        if (totals.has(a.student.team)) {
          totals.set(a.student.team, (totals.get(a.student.team) ?? 0) + a.points);
        }
      }

      const ranked = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([team, points]) => ({ team, points }));

      return { campaign: c, ranked };
    })
  );

  return (
    <div className="space-y-6">
      {summaries.map(({ campaign, ranked }) => (
        <div key={campaign.id} className="card space-y-3">
          <div>
            <p className="font-bold text-lg">{campaign.name}</p>
            {campaign.description && <p className="text-sm text-gray-500">{campaign.description}</p>}
          </div>
          <HouseBarChart
            myTeam={myTeam}
            rows={ranked.map((r) => ({ team: r.team, points: r.points, color: TEAM_COLORS[r.team] || "#9ca3af" }))}
          />
        </div>
      ))}
    </div>
  );
}

function LeaderboardCard({ rank, name, grade, team, points, highlight }: {
  rank: number; name: string; grade: string; team: string; points: number; highlight?: boolean;
}) {
  const color = TEAM_COLORS[team] || "#9ca3af";
  const badge = houseBadgeUrl(team);
  return (
    <div className={`card flex items-center gap-3 ${highlight ? "ring-2 ring-blue-500" : ""}`} style={{ borderLeft: `6px solid ${color}` }}>
      <div className="text-xl font-bold text-gray-400 w-8 text-center">{rank}</div>
      {badge && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={badge} alt="" className="w-8 h-8 rounded-full shrink-0" />
      )}
      <div className="flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-gray-500">Grade {grade} &middot; {team}</p>
      </div>
      <div className="text-lg font-bold">{points}</div>
    </div>
  );
}
