import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OrderActions from "./OrderActions";

export default async function AdminOrdersPage() {
  const session = await auth();
  if (!session?.user || !["admin", "teacher"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const schoolId = session.user.schoolId!;

  const [pending, approved, recent] = await Promise.all([
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
      where: { schoolId, status: { in: ["completed", "cancelled"] } },
      include: { student: true, items: { include: { product: true } } },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Order Approvals</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Pending ({pending.length})</h2>
        {pending.length === 0 && <p className="text-gray-500">No pending orders.</p>}
        {pending.map((order) => (
          <OrderCard key={order.id} order={order} action="pending" />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Approved &mdash; Awaiting Pickup ({approved.length})</h2>
        {approved.length === 0 && <p className="text-gray-500">No approved orders awaiting pickup.</p>}
        {approved.map((order) => (
          <OrderCard key={order.id} order={order} action="approved" />
        ))}
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
