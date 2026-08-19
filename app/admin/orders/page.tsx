import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderActions from "./OrderActions";
import ProposalActions from "./ProposalActions";
import AcknowledgeButton from "./AcknowledgeButton";
import { proxiedImageUrl } from "@/lib/image";

export default async function AdminOrdersPage() {
  const session = await auth();
  if (!session?.user || !["admin", "teacher"].includes(session.user.role ?? "")) {
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
      where: { schoolId, cancelledBySelf: true, cancelAcknowledgedAt: null },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { cancelledAt: "desc" },
    }),
    prisma.order.findMany({
      where: { schoolId, status: { in: ["completed", "cancelled"] } },
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

      {/* Students cancelling their own approved/pending orders — needs admin attention */}
      {cancelledByStudent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            🔔 Cancelled by Student
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 font-bold">{cancelledByStudent.length}</span>
          </h2>
          <div className="space-y-2 border-l-4 border-red-300 pl-3">
            {cancelledByStudent.map((order) => (
              <div key={order.id} className="card bg-red-50/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{order.student.firstName} {order.student.lastName}</p>
                    <p className="text-xs text-gray-500">
                      Order #{order.id} &middot; cancelled {order.cancelledAt?.toLocaleString()}
                    </p>
                  </div>
                  <span className="font-bold text-red-600">{order.totalPoints} pts refunded</span>
                </div>
                <ul className="mt-2 text-sm text-gray-700">
                  {order.items.map((item) => (
                    <li key={item.id}>{item.product.name} x{item.quantity}</li>
                  ))}
                </ul>
                {order.notes && <p className="text-xs text-gray-500 mt-1">{order.notes}</p>}
                <AcknowledgeButton orderId={order.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending approval */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          ⏳ Pending Approval
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">{pending.length}</span>
        </h2>
        <div className="space-y-2 border-l-4 border-amber-300 pl-3">
          {pending.length === 0 && <p className="text-gray-500">No pending orders.</p>}
          {pending.map((order) => (
            <OrderCard key={order.id} order={order} action="pending" />
          ))}
        </div>
      </section>

      {/* Approved, waiting for the student to pick up */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          📦 Pending Pickup
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-bold">{approved.length}</span>
        </h2>
        <div className="space-y-2 border-l-4 border-blue-300 pl-3">
          {approved.length === 0 && <p className="text-gray-500">No approved orders awaiting pickup.</p>}
          {approved.map((order) => (
            <OrderCard key={order.id} order={order} action="approved" />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Recent History</h2>
        {recent.map((order) => (
          <OrderCard key={order.id} order={order} action="none" />
        ))}
      </section>
    </div>
  );
}

type OrderWithItems = {
  id: number;
  status: string;
  totalPoints: number;
  submittedAt: Date;
  student: { firstName: string; lastName: string };
  items: { id: number; quantity: number; pointsPerItem: number; product: { name: string } }[];
};

function OrderCard({ order, action }: { order: OrderWithItems; action: "pending" | "approved" | "none" }) {
  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{order.student.firstName} {order.student.lastName}</p>
          <p className="text-xs text-gray-500">Order #{order.id} &middot; {order.submittedAt.toLocaleDateString()}</p>
        </div>
        <span className="font-bold text-blue-600">{order.totalPoints} pts</span>
      </div>
      <ul className="mt-2 text-sm text-gray-700">
        {order.items.map((item) => (
          <li key={item.id}>{item.product.name} x{item.quantity}</li>
        ))}
      </ul>
      {action !== "none" && <OrderActions orderId={order.id} action={action} />}
      {action === "none" && (
        <span className={`badge mt-2 ${order.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {order.status}
        </span>
      )}
    </div>
  );
}
