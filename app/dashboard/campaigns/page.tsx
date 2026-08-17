import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function audienceSummary(filter: unknown): string {
  if (!filter || typeof filter !== "object") return "All students";
  const f = filter as Record<string, unknown>;
  if (f.type === "grade_band") return `Grades ${f.value}`;
  if (f.type === "grades") return `Grades ${(f.values as string[]).join(", ")}`;
  if (f.type === "homerooms") return `Homerooms: ${(f.values as string[]).join(", ")}`;
  if (f.type === "houses") return `Houses: ${(f.values as string[]).join(", ")}`;
  return "All students";
}

export default async function TeacherCampaignsPage() {
  const session = await auth();
  if (!session?.user || !["admin", "teacher"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const schoolId = session.user.schoolId!;
  const now = new Date();

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId, isActive: true, OR: [{ endDate: null }, { endDate: { gte: now } }] },
    orderBy: { startDate: "desc" },
    include: { _count: { select: { awards: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Active Campaigns</h1>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">No active campaigns right now.</p>
          <p className="text-sm mt-1">Check back later or ask your admin to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="card hover:shadow-md border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-lg">{c.name}</p>
                  {c.description && <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>}
                </div>
                <span className="badge bg-green-100 text-green-700 shrink-0">Active</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                <span>{audienceSummary(c.audienceFilter)}</span>
                <span>{c.addToTotal ? "Counts to student totals" : "Standalone"}</span>
                <span>{c._count.awards} award{c._count.awards !== 1 ? "s" : ""} given</span>
              </div>
              <p className="text-sm font-medium text-blue-600 mt-3">Award points →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
