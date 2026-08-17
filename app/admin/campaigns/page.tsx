import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function audienceSummary(filter: unknown): string {
  if (!filter || typeof filter !== "object") return "All students";
  const f = filter as Record<string, unknown>;
  if (f.type === "grade_band") return `Grades ${f.value}`;
  if (f.type === "grades") return `Grade${(f.values as string[]).length > 1 ? "s" : ""} ${(f.values as string[]).join(", ")}`;
  if (f.type === "homerooms") return `Homeroom: ${(f.values as string[]).join(", ")}`;
  if (f.type === "houses") return `House: ${(f.values as string[]).join(", ")}`;
  return "All students";
}

function durationLabel(type: string, endDate: Date | null): string {
  if (type === "school_year") return "School year";
  if (type === "day") return "1 day";
  if (type === "week") return "1 week";
  if (type === "month") return "1 month";
  if (type === "custom" && endDate) return `Ends ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return "Custom";
}

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const schoolId = session.user.schoolId!;
  const campaigns = await prisma.campaign.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { awards: true } } },
  });

  const now = new Date();
  const active = campaigns.filter((c) => c.isActive && (!c.endDate || c.endDate >= now));
  const ended = campaigns.filter((c) => !c.isActive || (c.endDate && c.endDate < now));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/admin/campaigns/new" className="btn btn-primary">+ New Campaign</Link>
      </div>

      {campaigns.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg mb-4">No campaigns yet.</p>
          <Link href="/admin/campaigns/new" className="btn btn-primary">Create your first campaign</Link>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Active</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map((c) => (
              <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="card hover:shadow-md border-l-4 border-l-blue-500">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{c.name}</p>
                    {c.description && <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>}
                  </div>
                  <span className="badge bg-green-100 text-green-700 shrink-0">Active</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                  <span>{audienceSummary(c.audienceFilter)}</span>
                  <span>{durationLabel(c.durationType, c.endDate)}</span>
                  <span>{c.addToTotal ? "Counts to total" : "Standalone"}</span>
                  <span>{c._count.awards} award{c._count.awards !== 1 ? "s" : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {ended.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Ended / Inactive</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ended.map((c) => (
              <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="card hover:shadow-md opacity-70">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{c.name}</p>
                  <span className="badge bg-gray-100 text-gray-500 shrink-0">Ended</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  <span>{audienceSummary(c.audienceFilter)}</span>
                  <span>{c._count.awards} award{c._count.awards !== 1 ? "s" : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
