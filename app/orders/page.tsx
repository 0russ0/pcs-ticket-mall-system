import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  const { submitted } = await searchParams;

  const orders = await prisma.order.findMany({
    where: { studentId: session!.user.studentId! },
    include: { items: { include: { product: true } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">My Orders</h1>

      {submitted && (
        <div className="rounded-md p-3 text-sm bg-green-50 text-green-800">
          Your order has been submitted for approval. You&apos;ll see it here once approved.
        </div>
      )}

      {orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">Order #{order.id}</p>
                <p className="text-xs text-gray-500">
                  Submitted {order.submittedAt.toLocaleDateString()}
                </p>
              </div>
              <span className={`badge ${STATUS_STYLES[order.status]}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
            <ul className="mt-2 text-sm text-gray-700 divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="py-1 flex justify-between">
                  <span>{item.product.name} x{item.quantity}</span>
                  <span>{item.pointsPerItem * item.quantity} pts</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>{order.totalPoints} pts</span>
            </div>
            {order.approvedAt && (
              <p className="text-xs text-gray-500 mt-1">Approved {order.approvedAt.toLocaleDateString()}</p>
            )}
            {order.completedAt && (
              <p className="text-xs text-gray-500">Completed {order.completedAt.toLocaleDateString()}</p>
            )}
            {order.notes && <p className="text-xs text-red-600 mt-1">Note: {order.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
