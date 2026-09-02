"use client";

import { useState, useMemo } from "react";
import OrderActions from "./OrderActions";
import MultiSelectFilter from "@/components/MultiSelectFilter";

type PendingOrder = {
  id: number;
  totalPoints: number;
  student: { firstName: string; lastName: string; grade: string; homeroom: string };
  items: { id: number; quantity: number; product: { name: string } }[];
};

type Mode = "all" | "grade" | "homeroom";

export default function PendingApprovalsSection({ orders }: { orders: PendingOrder[] }) {
  const [mode, setMode] = useState<Mode>("all");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedHomerooms, setSelectedHomerooms] = useState<string[]>([]);

  const grades = useMemo(() => [...new Set(orders.map((o) => o.student.grade))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [orders]);
  const homerooms = useMemo(() => [...new Set(orders.map((o) => o.student.homeroom))].sort(), [orders]);

  const visible = useMemo(() => {
    let rows = orders;
    if (mode === "grade" && selectedGrades.length > 0) {
      rows = rows.filter((o) => selectedGrades.includes(o.student.grade));
    } else if (mode === "homeroom" && selectedHomerooms.length > 0) {
      rows = rows.filter((o) => selectedHomerooms.includes(o.student.homeroom));
    }

    rows = [...rows];
    if (mode === "grade") {
      rows.sort((a, b) => a.student.grade.localeCompare(b.student.grade, undefined, { numeric: true }) || a.student.lastName.localeCompare(b.student.lastName));
    } else if (mode === "homeroom") {
      rows.sort((a, b) => a.student.homeroom.localeCompare(b.student.homeroom) || a.student.lastName.localeCompare(b.student.lastName));
    }
    // "all" keeps the server's oldest-first order as-is.
    return rows;
  }, [orders, mode, selectedGrades, selectedHomerooms]);

  function selectMode(m: Mode) {
    setMode(m);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          ⏳ Pending Approval
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">{orders.length}</span>
        </h2>
        {orders.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-gray-500">Filter:</span>
            {([
              { value: "all", label: "All" },
              { value: "grade", label: "Grade" },
              { value: "homeroom", label: "Homeroom" },
            ] as { value: Mode; label: string }[]).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => selectMode(o.value)}
                className={`px-2 py-1 rounded-md font-medium border transition-colors ${mode === o.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}
              >
                {o.label}
              </button>
            ))}
            {mode === "grade" && (
              <MultiSelectFilter label="Grades" options={grades} selected={selectedGrades} onChange={setSelectedGrades} formatOption={(g) => `Grade ${g}`} />
            )}
            {mode === "homeroom" && (
              <MultiSelectFilter label="Homerooms" options={homerooms} selected={selectedHomerooms} onChange={setSelectedHomerooms} />
            )}
          </div>
        )}
      </div>

      {orders.length === 0 && <p className="text-gray-500 text-sm">No pending orders.</p>}
      {orders.length > 0 && visible.length === 0 && (
        <p className="text-gray-400 text-sm">No pending orders match the selected {mode === "grade" ? "grade(s)" : "homeroom(s)"}.</p>
      )}
      {visible.length > 0 && (
        <div className="divide-y border rounded-lg overflow-hidden">
          {visible.map((order) => (
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
