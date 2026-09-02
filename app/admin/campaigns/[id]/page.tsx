import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CampaignAwardPanel from "@/components/CampaignAwardPanel";
import DeleteCampaignButton from "@/components/DeleteCampaignButton";

function audienceSummary(filter: unknown): string {
  if (!filter || typeof filter !== "object") return "All students";
  const f = filter as Record<string, unknown>;
  if (f.type === "grade_band") return `Grades ${f.value}`;
  if (f.type === "grades") return `Grades ${(f.values as string[]).join(", ")}`;
  if (f.type === "homerooms") return `Homerooms: ${(f.values as string[]).join(", ")}`;
  if (f.type === "houses") return `Houses: ${(f.values as string[]).join(", ")}`;
  return "All students";
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) redirect("/dashboard");

  const { id } = await params;
  const campaignId = Number(id);
  const schoolId = session.user.schoolId!;
  const isAdmin = session.user.role === "admin";

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, schoolId } });
  if (!campaign) notFound();

  const [awardTotals, students] = await Promise.all([
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

  const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
  const leaderboard = awardTotals.map((a, i) => ({
    rank: i + 1,
    student: studentMap[a.studentId],
    points: a._sum.points ?? 0,
  }));

  const now = new Date();
  const isEnded = !campaign.isActive || (campaign.endDate != null && campaign.endDate < now);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/campaigns" className="text-sm text-gray-400 hover:text-blue-600">← Campaigns</Link>
          </div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.description && <p className="text-gray-500 mt-1">{campaign.description}</p>}
        </div>
        {isEnded ? (
          <span className="badge bg-gray-100 text-gray-500 shrink-0">Ended</span>
        ) : (
          <span className="badge bg-green-100 text-green-700 shrink-0">Active</span>
        )}
      </div>

      <div className="card">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Audience</dt>
            <dd className="font-medium mt-0.5">{audienceSummary(campaign.audienceFilter)}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Started</dt>
            <dd className="font-medium mt-0.5">{campaign.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Ends</dt>
            <dd className="font-medium mt-0.5">{campaign.endDate ? campaign.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No end date"}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wide">Points mode</dt>
            <dd className="font-medium mt-0.5">{campaign.addToTotal ? "Adds to total" : "Standalone"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No points awarded yet.</p>
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

        {/* Award panel */}
        {!isEnded && (
          <CampaignAwardPanel
            campaignId={campaign.id}
            students={students}
            addToTotal={campaign.addToTotal}
          />
        )}
      </div>

      {isAdmin && !isEnded && (
        <div className="card border-red-100">
          <h2 className="font-bold text-sm text-red-700 mb-2">End Campaign</h2>
          <p className="text-sm text-gray-500 mb-3">Ending the campaign stops new awards but keeps the leaderboard.</p>
          <form action={async () => {
            "use server";
            await prisma.campaign.update({ where: { id: campaignId }, data: { isActive: false } });
            redirect(`/admin/campaigns/${campaignId}`);
          }}>
            <button type="submit" className="btn text-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
              End this campaign
            </button>
          </form>
        </div>
      )}

      {(isAdmin || campaign.createdByStaffId === session.user.staffId) && (
        <DeleteCampaignButton campaignId={campaign.id} redirectHref="/admin/campaigns" />
      )}
    </div>
  );
}
