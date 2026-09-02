"use client";

import { useState, useMemo } from "react";
import OrderActions from "./OrderActions";

type PendingOrder = {
  id: number;
  totalPoints: number;
  student: { firstName: string; lastName: string; grade: string; homeroom: string };
  items: { id: number; quantity: number; product: { name: string } }[];
};

type SortKey = "submitted" | "grade" | "homeroom";

export default function PendingApprovalsSection({ orders }: { orders: PendingOrder[] }) {
  const [sort, setSort] = useState<SortKey>("submitted");

  const sorted = useMemo(() => {
    const rows = [...orders];
    if (sort === "grade") {
      rows.sort((a, b) => a.student.grade.localeCompare(b.student.grade, undefined, { numeric: true }) || a.student.lastName.localeCompare(b.student.lastName));
    } else if (sort === "homeroom") {
      rows.sort((a, b) => a.student.homeroom.localeCompare(b.student.homeroom) || a.student.lastName.localeCompare(b.student.lastName));
    }
    // "submitted" keeps the server's oldest-first order as-is.
    return rows;
  }, [orders, sort]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          ⏳ Pending Approval
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">{orders.length}</span>
        </h2>
        {orders.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Sort:</span>
            {([
              { value: "submitted", label: "Submitted" },
              { value: "grade", label: "Grade" },
              { value: "homeroom", label: "Homeroom" },
            ] as { value: SortKey; label: string }[]).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSort(o.value)}
                className={`px-2 py-1 rounded-md font-medium border transition-colors ${sort === o.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {orders.length === 0 && <p className="text-gray-500 text-sm">No pending orders.</p>}
      {orders.length > 0 && (
        <div className="divide-y border rounded-lg overflow-hidden">
          {sorted.map((order) => (
            <div key={order.id} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white flex-wrap">
              <span className="font-medium shrink-0">{order.student.firstName} {order.student.lastName}</span>
              <span className="text-xs text-gray-400 shrink-0">Gr {order.student.grade} · {order.student.homeroom}</span>
              <span className="flex-1 min-w-[120px] text-xs text-gray-500 truncate">
                {order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ")}
              </span>
              <span className="text-xs font-bold text-blue-600 shrink-0">{order.totalPoints} pts</span>
              <span className="shrink-0">
                <OrderActions orderId={order.id} action="pending" compact />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
