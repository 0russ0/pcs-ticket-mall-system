import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CampaignAwardPanel from "@/components/CampaignAwardPanel";
import DeleteCampaignButton from "@/components/DeleteCampaignButton";
import EditCampaignModal from "@/components/EditCampaignModal";
import { getTeacherScope, isChallengeVisibleToTeacher } from "@/lib/challengeScope";
import { canManageCampaign } from "@/lib/campaignPermissions";

function audienceSummary(filter: unknown): string {
  if (!filter || typeof filter !== "object") return "All students";
  const f = filter as Record<string, unknown>;
  if (f.type === "grade_band") return `Grades ${f.value}`;
  if (f.type === "grades") return `Grades ${(f.values as string[]).join(", ")}`;
  if (f.type === "homerooms") return `Homerooms: ${(f.values as string[]).join(", ")}`;
  if (f.type === "houses") return `Houses: ${(f.values as string[]).join(", ")}`;
  return "All students";
}

export default async function TeacherCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const campaignId = Number(id);
  const schoolId = session.user.schoolId!;
  const isPowerUser = session.user.role === "power_user";
  const backHref = "/dashboard/campaigns";

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, schoolId } });
  if (!campaign) notFound();

  if (session.user.role === "teacher" || isPowerUser) {
    const scope = await getTeacherScope(schoolId, session.user.staffId!);
    if (!isChallengeVisibleToTeacher(campaign.audienceFilter, scope)) redirect("/dashboard/campaigns");
  }

  const effectiveAddToTotal = campaign.addToTotal;

  const now = new Date();
  const isActive = campaign.isActive && (!campaign.endDate || campaign.endDate >= now);
  const canManage = canManageCampaign({ role: session.user.role ?? "", staffId: session.user.staffId ?? null }, campaign);

  const [awardTotals, allStudents] = await Promise.all([
    prisma.campaignAward.groupBy({
      by: ["studentId"],
      where: { campaignId },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true, team: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const studentMap = Object.fromEntries(allStudents.map((s) => [s.id, s]));
  const leaderboard = awardTotals.map((a, i) => ({
    rank: i + 1,
    student: studentMap[a.studentId],
    points: a._sum.points ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-gray-400 hover:text-blue-600">← Challenges</Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            {campaign.description && <p className="text-gray-500 mt-1">{campaign.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive ? (
              <span className="badge bg-green-100 text-green-700">Active</span>
            ) : (
              <span className="badge bg-gray-100 text-gray-500">Ended</span>
            )}
            {canManage && (
              <EditCampaignModal
                campaignId={campaign.id}
                initialName={campaign.name}
                initialDescription={campaign.description ?? ""}
                initialEndDate={campaign.endDate ? campaign.endDate.toISOString().split("T")[0] : ""}
              />
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Audience</dt>
            <dd className="font-medium mt-0.5">{audienceSummary(campaign.audienceFilter)}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Ends</dt>
            <dd className="font-medium mt-0.5">
              {campaign.endDate
                ? campaign.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "No end date"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Points</dt>
            <dd className="font-medium mt-0.5">{effectiveAddToTotal ? "Adds to student totals" : "Standalone"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No points awarded yet — be the first!</p>
          ) : (
            <ol className="divide-y">
              {leaderboard.map(({ rank, student, points }) => (
                <li key={student?.id ?? rank} className="flex items-center gap-3 py-2.5">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${rank === 1 ? "bg-yellow-400 text-yellow-900" : rank === 2 ? "bg-gray-300 text-gray-700" : rank === 3 ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {rank}
                  </span>
                  <span className="flex-1 text-sm font-medium">
                    {student ? `${student.lastName}, ${student.firstName}` : "—"}
                    {student && <span className="text-gray-400 font-normal"> · Gr {student.grade} · {student.homeroom}</span>}
                  </span>
                  <span className="text-sm font-bold text-blue-700">{points} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Award panel — available to any teacher for any student */}
        {isActive && (
          <CampaignAwardPanel
            campaignId={campaign.id}
            students={allStudents}
            addToTotal={effectiveAddToTotal}
          />
        )}
      </div>

      {canManage && (
        <DeleteCampaignButton campaignId={campaign.id} redirectHref="/dashboard/campaigns" />
      )}
    </div>
  );
}
