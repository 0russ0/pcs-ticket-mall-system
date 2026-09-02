import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderActions from "./OrderActions";
import ProposalActions from "./ProposalActions";
import PendingApprovalsSection from "./PendingApprovalsSection";
import { proxiedImageUrl } from "@/lib/image";

export default async function AdminOrdersPage() {
  const session = await auth();
  if (!session?.user || !["admin", "teacher", "power_user"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const schoolId = session.user.schoolId!;
  const isAdmin = session.user.role === "admin";

  const [pendingProposals, pending, approved, cancelledByStudent, recent] = await Promise.all([
    isAdmin
      ? prisma.product.findMany({
          where: { schoolId, proposalStatus: "pending" },
          include: { proposedBy: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.order.findMany({
      where: { schoolId, status: "pending" },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.order.findMany({
      where: { schoolId, status: "approved" },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { approvedAt: "asc" },
    }),
    prisma.order.findMany({
      where: { schoolId, cancelledBySelf: true, cancelledAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { cancelledAt: "desc" },
      take: 20,
    }),
    prisma.order.findMany({
      // Student self-cancellations live only in the "Cancelled by Students"
      // section below — exclude them here so each one shows up in exactly
      // one place. Staff-initiated cancellations (rejections) still show.
      where: {
        schoolId,
        OR: [
          { status: "completed" },
          { status: "cancelled", cancelledBySelf: false },
        ],
      },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
  ]);

  const AUDIENCE_LABEL: Record<string, string> = {
    all: "All Students",
    grade_band: "Grade Band",
    grades: "Specific Grades",
    homerooms: "Homerooms",
    houses: "House Teams",
  };

  function audienceSummary(filter: unknown): string {
    if (!filter || typeof filter !== "object") return "All Students";
    const f = filter as { type: string; value?: string; values?: string[] };
    if (f.type === "grade_band") return `Grades ${f.value}`;
    const label = AUDIENCE_LABEL[f.type] ?? f.type;
    return f.values?.length ? `${label}: ${f.values.join(", ")}` : label;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Approvals</h1>

      {/* Pending store item proposals — admin only */}
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            🛍️ Pending Store Item Proposals
            {pendingProposals.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">{pendingProposals.length}</span>
            )}
          </h2>
          {pendingProposals.length === 0 && <p className="text-gray-500 text-sm">No pending proposals.</p>}
          {pendingProposals.map((p) => (
            <div key={p.id} className="card flex gap-4">
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proxiedImageUrl(p.imageUrl)!} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.pointsCost} pts · {p.category.replace("_", " ")} · {audienceSummary(p.audienceFilter)}
                      {p.inventoryLimit !== null && ` · ${p.inventoryLimit} spots`}
                    </p>
                    {p.proposedBy && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Proposed by {p.proposedBy.firstName} {p.proposedBy.lastName}
                      </p>
                    )}
                  </div>
                </div>
                {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                <ProposalActions productId={p.id} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Pending approval */}
      <PendingApprovalsSection orders={pending} />

      {/* Approved, waiting for the student to pick up */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          📦 Pending Pickup
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-bold">{approved.length}</span>
        </h2>
        {approved.length === 0 && <p className="text-gray-500 text-sm">No approved orders awaiting pickup.</p>}
        {approved.length > 0 && (
          <div className="divide-y border rounded-lg overflow-hidden">
            {approved.map((order) => (
              <OrderRow key={order.id} order={order} action="approved" />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Recent History</h2>
        {recent.length > 0 && (
          <div className="divide-y border rounded-lg overflow-hidden">
            {recent.map((order) => (
              <OrderRow key={order.id} order={order} action="none" />
            ))}
          </div>
        )}
      </section>

      {/* Students cancelling their own approved/pending orders — small reference list */}
      {cancelledByStudent.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            Cancelled by Students ({cancelledByStudent.length})
          </h2>
          <div className="text-xs text-gray-500 divide-y border rounded-lg overflow-hidden">
            {cancelledByStudent.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white">
                <span className="truncate">
                  <span className="font-medium text-gray-700">{order.student.firstName} {order.student.lastName}</span>
                  {" — "}
                  {order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}
                </span>
                <span className="shrink-0 text-gray-400">
                  {order.totalPoints} pts &middot; {order.cancelledAt?.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type OrderWithItems = {
  id: number;
  status: string;
  totalPoints: number;
  submittedAt: Date;
  student: { firstName: string; lastName: string; grade: string; homeroom: string };
  items: { id: number; quantity: number; pointsPerItem: number; product: { name: string } }[];
};

function OrderRow({ order, action }: { order: OrderWithItems; action: "pending" | "approved" | "none" }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white flex-wrap">
      <span className="font-medium shrink-0">{order.student.firstName} {order.student.lastName}</span>
      <span className="text-xs text-gray-400 shrink-0">Gr {order.student.grade} · {order.student.homeroom}</span>
      <span className="flex-1 min-w-[120px] text-xs text-gray-500 truncate">
        {order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}
      </span>
      <span className="text-xs font-bold text-blue-600 shrink-0">{order.totalPoints} pts</span>
      <span className="text-xs text-gray-400 shrink-0">{order.submittedAt.toLocaleDateString()}</span>
      {action !== "none" && (
        <span className="shrink-0">
          <OrderActions orderId={order.id} action={action} compact />
        </span>
      )}
      {action === "none" && (
        <span className={`shrink-0 badge text-xs ${order.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {order.status}
        </span>
      )}
    </div>
  );
}
