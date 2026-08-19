"use client";

import { useState, useEffect, useCallback } from "react";

// ── CSV utility ──────────────────────────────────────────────────────────────
function escapeCell(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(",")).join("\n");
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Period helpers ────────────────────────────────────────────────────────────
const PERIODS = [
  { value: "week",     label: "This Week" },
  { value: "month",   label: "This Month" },
  { value: "semester",label: "This Semester" },
  { value: "year",    label: "This Year" },
  { value: "all",     label: "All Time" },
];

function getSince(period: string): string | null {
  const now = new Date();
  if (period === "week")     { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
  if (period === "month")    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (period === "semester") { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString(); }
  if (period === "year")     return new Date(now.getFullYear(), 0, 1).toISOString();
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type StudentRow = {
  id: number; firstName: string; lastName: string; grade: string;
  homeroom: string; team: string; currentBalance: number; lifetimePoints: number;
  periodPoints: number; periodAwards: number; goldenBulldogs: number;
  ordersPlaced: number; pointsSpent: number;
};
type StaffRow = {
  staffId: number; name: string; email: string; role: string;
  totalPointsGiven: number; awardCount: number; goldenBulldogsGiven: number;
  houseBonusesGiven: number; houseBonusPointsGiven: number;
  byCategory: Record<string, number>;
};
type BulldogRow = {
  id: number; observedDate: string; studentName: string; grade: string;
  homeroom: string; team: string; category: string; description: string; awardedBy: string;
};
type AwardRow = {
  id: number; date: string; studentName: string; grade: string;
  homeroom: string; team: string; points: number; category: string;
  reason: string; awardedBy: string;
};
type PopularItemRow = {
  rank: number; productId: number; name: string; category: string;
  quantityPurchased: number; ordersCount: number; pointsSpent: number;
};

type Tab = "students" | "staff" | "bulldogs" | "awards" | "items";

const TABS: { value: Tab; label: string; emoji: string }[] = [
  { value: "students", label: "Student Totals",    emoji: "🎓" },
  { value: "staff",    label: "Staff Activity",    emoji: "👩‍🏫" },
  { value: "bulldogs", label: "Golden Bulldogs",   emoji: "🐾" },
  { value: "awards",   label: "Points Log",        emoji: "⭐" },
  { value: "items",    label: "Popular Items",     emoji: "🛍️" },
];

// ── Sortable table header ─────────────────────────────────────────────────────
function Th({ label, col, sort, onSort }: { label: string; col: string; sort: [string, "asc"|"desc"]; onSort: (c: string) => void }) {
  const active = sort[0] === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-gray-800"
    >
      {label}{active ? (sort[1] === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

export default function ReportsClient() {
  const [tab, setTab] = useState<Tab>("students");
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(false);

  const [studentData, setStudentData] = useState<StudentRow[]>([]);
  const [staffData, setStaffData] = useState<{ rows: StaffRow[]; categories: string[] }>({ rows: [], categories: [] });
  const [bulldogData, setBulldogData] = useState<BulldogRow[]>([]);
  const [awardData, setAwardData] = useState<AwardRow[]>([]);
  const [popularItemData, setPopularItemData] = useState<PopularItemRow[]>([]);

  const [sort, setSort] = useState<[string, "asc"|"desc"]>(["lastName", "asc"]);

  const since = getSince(period);
  const sinceParam = since ? `?since=${encodeURIComponent(since)}` : "";
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  const fetchTab = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === "students") {
        const data = await fetch(`/api/admin/reports/students${sinceParam}`).then((r) => r.json());
        setStudentData(data);
      } else if (t === "staff") {
        const data = await fetch(`/api/admin/reports/staff${sinceParam}`).then((r) => r.json());
        setStaffData(data);
      } else if (t === "bulldogs") {
        const data = await fetch(`/api/admin/reports/bulldogs${sinceParam}`).then((r) => r.json());
        setBulldogData(data);
      } else if (t === "awards") {
        const data = await fetch(`/api/admin/reports/awards${sinceParam}`).then((r) => r.json());
        setAwardData(data);
      } else {
        const data = await fetch(`/api/admin/reports/popular-items${sinceParam}`).then((r) => r.json());
        setPopularItemData(data);
      }
    } finally {
      setLoading(false);
    }
  }, [sinceParam]);

  useEffect(() => { fetchTab(tab); }, [tab, period, fetchTab]);

  function toggleSort(col: string) {
    setSort((prev) => prev[0] === col && prev[1] === "asc" ? [col, "desc"] : [col, "asc"]);
  }

  function sortedRows<T extends Record<string, unknown>>(rows: T[]): T[] {
    const [col, dir] = sort;
    return [...rows].sort((a, b) => {
      const av = a[col] ?? "";
      const bv = b[col] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }

  // ── CSV exports ──────────────────────────────────────────────────────────────
  function exportStudents() {
    const headers = ["ID","Last Name","First Name","Grade","Homeroom","House Team","Current Balance","Lifetime Points",`Points (${periodLabel})`,`Awards (${periodLabel})`,"Golden Bulldogs (All Time)","Orders Placed","Points Spent"];
    const rows = studentData.map((r) => [r.id, r.lastName, r.firstName, r.grade, r.homeroom, r.team, r.currentBalance, r.lifetimePoints, r.periodPoints, r.periodAwards, r.goldenBulldogs, r.ordersPlaced, r.pointsSpent]);
    downloadCSV(`students-report-${period}.csv`, toCSV(headers, rows));
  }

  function exportStaff() {
    const cats = staffData.categories;
    const headers = ["Staff Name","Email","Role","Points Given","Award Count","Golden Bulldogs Given","House Bonuses Given","House Bonus Points",...cats];
    const rows = staffData.rows.map((r) => [r.name, r.email, r.role, r.totalPointsGiven, r.awardCount, r.goldenBulldogsGiven, r.houseBonusesGiven, r.houseBonusPointsGiven, ...cats.map((c) => r.byCategory[c] ?? 0)]);
    downloadCSV(`staff-report-${period}.csv`, toCSV(headers, rows));
  }

  function exportBulldogs() {
    const headers = ["ID","Date","Student","Grade","Homeroom","House Team","Category","Description","Awarded By"];
    const rows = bulldogData.map((r) => [r.id, r.observedDate, r.studentName, r.grade, r.homeroom, r.team, r.category, r.description, r.awardedBy]);
    downloadCSV(`golden-bulldogs-${period}.csv`, toCSV(headers, rows));
  }

  function exportAwards() {
    const headers = ["ID","Date","Student","Grade","Homeroom","House Team","Points","Category","Reason","Awarded By"];
    const rows = awardData.map((r) => [r.id, r.date, r.studentName, r.grade, r.homeroom, r.team, r.points, r.category, r.reason, r.awardedBy]);
    downloadCSV(`points-log-${period}.csv`, toCSV(headers, rows));
  }

  function exportPopularItems() {
    const headers = ["Rank","Item","Category","Units Purchased","Orders","Points Spent"];
    const rows = popularItemData.map((r) => [r.rank, r.name, r.category, r.quantityPurchased, r.ordersCount, r.pointsSpent]);
    downloadCSV(`popular-items-${period}.csv`, toCSV(headers, rows));
  }

  const exportFn = { students: exportStudents, staff: exportStaff, bulldogs: exportBulldogs, awards: exportAwards, items: exportPopularItems }[tab];

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const summaryCards = {
    students: [
      { label: "Total Students", value: studentData.length },
      { label: `Points Given (${periodLabel})`, value: studentData.reduce((s, r) => s + r.periodPoints, 0) },
      { label: "Lifetime Points (All)", value: studentData.reduce((s, r) => s + r.lifetimePoints, 0) },
      { label: "Golden Bulldogs (All)", value: studentData.reduce((s, r) => s + r.goldenBulldogs, 0) },
    ],
    staff: [
      { label: "Staff Members", value: staffData.rows.length },
      { label: "Points Given", value: staffData.rows.reduce((s, r) => s + r.totalPointsGiven, 0) },
      { label: "Awards Made", value: staffData.rows.reduce((s, r) => s + r.awardCount, 0) },
      { label: "Golden Bulldogs Given", value: staffData.rows.reduce((s, r) => s + r.goldenBulldogsGiven, 0) },
    ],
    bulldogs: [
      { label: "Total Awarded", value: bulldogData.length },
      { label: "Unique Students", value: new Set(bulldogData.map((r) => r.studentName)).size },
    ],
    awards: [
      { label: "Total Awards", value: awardData.length },
      { label: "Total Points", value: awardData.reduce((s, r) => s + r.points, 0) },
      { label: "Unique Students", value: new Set(awardData.map((r) => r.studentName)).size },
    ],
    items: [
      { label: "Unique Items Sold", value: popularItemData.length },
      { label: "Units Purchased", value: popularItemData.reduce((s, r) => s + r.quantityPurchased, 0) },
      { label: "Orders", value: popularItemData.reduce((s, r) => s + r.ordersCount, 0) },
      { label: "Points Spent", value: popularItemData.reduce((s, r) => s + r.pointsSpent, 0) },
    ],
  }[tab];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setSort(t.value === "items" ? ["quantityPurchased", "desc"] : ["lastName", "asc"]); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
              tab === t.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Period + export row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                period === p.value ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={exportFn}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="card text-center py-3">
            <p className="text-2xl font-bold text-blue-600">{c.value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-12">Loading…</p>}

      {/* ── Student Totals ── */}
      {!loading && tab === "students" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ["lastName","Last Name"], ["firstName","First Name"], ["grade","Grade"],
                  ["homeroom","Homeroom"], ["team","House"], ["currentBalance","Balance"],
                  ["lifetimePoints","Lifetime Pts"], ["periodPoints","Period Pts"],
                  ["periodAwards","Awards"], ["goldenBulldogs","🐾 GBs"],
                  ["ordersPlaced","Orders"], ["pointsSpent","Pts Spent"],
                ].map(([col, label]) => (
                  <Th key={col} col={col} label={label} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {(sortedRows(studentData as unknown as Record<string, unknown>[]) as unknown as StudentRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.lastName}</td>
                  <td className="px-3 py-2">{r.firstName}</td>
                  <td className="px-3 py-2 text-center">{r.grade}</td>
                  <td className="px-3 py-2">{r.homeroom}</td>
                  <td className="px-3 py-2 text-xs">{r.team}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-600">{r.currentBalance}</td>
                  <td className="px-3 py-2 text-right">{r.lifetimePoints}</td>
                  <td className="px-3 py-2 text-right">{r.periodPoints}</td>
                  <td className="px-3 py-2 text-right">{r.periodAwards}</td>
                  <td className="px-3 py-2 text-center">{r.goldenBulldogs > 0 ? `🐾 ${r.goldenBulldogs}` : "—"}</td>
                  <td className="px-3 py-2 text-right">{r.ordersPlaced}</td>
                  <td className="px-3 py-2 text-right">{r.pointsSpent}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {studentData.length === 0 && <p className="text-center text-gray-400 py-8">No data for this period.</p>}
        </div>
      )}

      {/* ── Staff Activity ── */}
      {!loading && tab === "staff" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ["name","Name"], ["role","Role"], ["totalPointsGiven","Pts Given"],
                  ["awardCount","# Awards"], ["goldenBulldogsGiven","🐾 GBs Given"],
                  ["houseBonusesGiven","House Bonuses"], ["houseBonusPointsGiven","House Pts"],
                  ...staffData.categories.map((c) => [c, c]),
                ].map(([col, label]) => (
                  <Th key={col} col={col} label={label} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {(sortedRows(staffData.rows as unknown as Record<string, unknown>[]) as unknown as StaffRow[]).map((r) => (
                <tr key={r.staffId} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </td>
                  <td className="px-3 py-2 capitalize text-xs">{r.role}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-600">{r.totalPointsGiven}</td>
                  <td className="px-3 py-2 text-right">{r.awardCount}</td>
                  <td className="px-3 py-2 text-center">{r.goldenBulldogsGiven > 0 ? `🐾 ${r.goldenBulldogsGiven}` : "—"}</td>
                  <td className="px-3 py-2 text-right">{r.houseBonusesGiven}</td>
                  <td className="px-3 py-2 text-right">{r.houseBonusPointsGiven}</td>
                  {staffData.categories.map((c) => (
                    <td key={c} className="px-3 py-2 text-right">{r.byCategory[c] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {staffData.rows.length === 0 && <p className="text-center text-gray-400 py-8">No data for this period.</p>}
        </div>
      )}

      {/* ── Golden Bulldogs ── */}
      {!loading && tab === "bulldogs" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ["observedDate","Date"], ["studentName","Student"], ["grade","Gr"],
                  ["homeroom","Homeroom"], ["team","House"], ["category","Category"],
                  ["description","Description"], ["awardedBy","Awarded By"],
                ].map(([col, label]) => (
                  <Th key={col} col={col} label={label} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {(sortedRows(bulldogData as unknown as Record<string, unknown>[]) as unknown as BulldogRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{r.observedDate}</td>
                  <td className="px-3 py-2 font-medium">{r.studentName}</td>
                  <td className="px-3 py-2 text-center">{r.grade}</td>
                  <td className="px-3 py-2">{r.homeroom}</td>
                  <td className="px-3 py-2 text-xs">{r.team}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 max-w-xs truncate text-gray-600">{r.description}</td>
                  <td className="px-3 py-2">{r.awardedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bulldogData.length === 0 && <p className="text-center text-gray-400 py-8">No Golden Bulldogs in this period.</p>}
        </div>
      )}

      {/* ── Points Log ── */}
      {!loading && tab === "awards" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ["date","Date"], ["studentName","Student"], ["grade","Gr"],
                  ["homeroom","Homeroom"], ["team","House"], ["points","Pts"],
                  ["category","Category"], ["reason","Reason"], ["awardedBy","Awarded By"],
                ].map(([col, label]) => (
                  <Th key={col} col={col} label={label} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {(sortedRows(awardData as unknown as Record<string, unknown>[]) as unknown as AwardRow[]).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 font-medium">{r.studentName}</td>
                  <td className="px-3 py-2 text-center">{r.grade}</td>
                  <td className="px-3 py-2">{r.homeroom}</td>
                  <td className="px-3 py-2 text-xs">{r.team}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-600">{r.points}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{r.reason || "—"}</td>
                  <td className="px-3 py-2">{r.awardedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {awardData.length === 0 && <p className="text-center text-gray-400 py-8">No awards in this period.</p>}
        </div>
      )}

      {/* ── Popular Items ── */}
      {!loading && tab === "items" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {[
                  ["rank","Rank"], ["name","Item"], ["category","Category"],
                  ["quantityPurchased","Units Purchased"], ["ordersCount","Orders"], ["pointsSpent","Points Spent"],
                ].map(([col, label]) => (
                  <Th key={col} col={col} label={label} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {(sortedRows(popularItemData as unknown as Record<string, unknown>[]) as unknown as PopularItemRow[]).map((r) => (
                <tr key={r.productId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center font-bold text-gray-400">#{r.rank}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-xs capitalize">{r.category.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-600">{r.quantityPurchased}</td>
                  <td className="px-3 py-2 text-right">{r.ordersCount}</td>
                  <td className="px-3 py-2 text-right">{r.pointsSpent}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {popularItemData.length === 0 && <p className="text-center text-gray-400 py-8">No items purchased (picked up) in this period.</p>}
        </div>
      )}
    </div>
  );
}
