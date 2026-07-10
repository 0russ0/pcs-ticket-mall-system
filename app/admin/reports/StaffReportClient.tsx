"use client";

import { useRouter } from "next/navigation";

type StaffRow = {
  staffId: number;
  name: string;
  email: string;
  totalPoints: number;
  awardCount: number;
  byCategory: Record<string, number>;
};

const PERIODS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "semester", label: "This Semester (6 mo)" },
  { value: "year", label: "This Year" },
];

export default function StaffReportClient({
  rows,
  categories,
  period,
}: {
  rows: StaffRow[];
  categories: string[];
  period: string;
}) {
  const router = useRouter();
  const totalPoints = rows.reduce((s, r) => s + r.totalPoints, 0);
  const totalAwards = rows.reduce((s, r) => s + r.awardCount, 0);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => router.push(`/admin/reports?period=${p.value}`)}
            className={`btn whitespace-nowrap ${period === p.value ? "btn-primary" : "btn-secondary"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{totalPoints}</p>
          <p className="text-sm text-gray-500">Total Points Given</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{totalAwards}</p>
          <p className="text-sm text-gray-500">Total Awards</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No points awarded in this period.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.staffId} className="card space-y-2">
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold text-gray-400 w-8 text-center">#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{r.totalPoints} pts</p>
                  <p className="text-xs text-gray-500">{r.awardCount} awards</p>
                </div>
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-11">
                  {categories.map((cat) =>
                    r.byCategory[cat] ? (
                      <span key={cat} className="badge bg-gray-100 text-gray-700 text-xs">
                        {cat}: {r.byCategory[cat]}
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
