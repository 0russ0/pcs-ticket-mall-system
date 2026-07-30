"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import GoldenBulldogModal from "@/components/GoldenBulldogModal";
import DrawingWheel from "./DrawingWheel";
import { TEAM_COLORS } from "@/lib/leaderboard";

type Award = {
  id: number;
  observedDate: string;
  description: string;
  category: { name: string };
  staff: { firstName: string | null; lastName: string | null };
  student: { firstName: string; lastName: string; team?: string };
  studentId: number;
};

type Period = "week" | "month" | "all";

function getSince(period: Period): string | null {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1; // back to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0];
  }
  if (period === "month") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return null;
}

export default function GoldenBulldogPageClient({ role }: { role: string }) {
  const [showModal, setShowModal] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [period, setPeriod] = useState<Period>("week");
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setAwards(null);
    const since = getSince(period);
    const url = since ? `/api/golden-bulldog?since=${since}` : `/api/golden-bulldog`;
    fetch(url).then((r) => r.json()).then(setAwards);
  }, [period, refreshKey]);

  // Build wheel entries: one entry per student, count = number of bulldogs
  const wheelEntries = awards
    ? Object.values(
        awards.reduce((acc, a) => {
          const key = a.studentId;
          if (!acc[key]) {
            acc[key] = {
              studentId: a.studentId,
              name: `${a.student.firstName} ${a.student.lastName}`,
              count: 0,
              team: (a.student as { team?: string }).team ?? "",
            };
          }
          acc[key].count++;
          return acc;
        }, {} as Record<number, { studentId: number; name: string; count: number; team: string }>)
      ).map((e) => ({
        ...e,
        color: TEAM_COLORS[e.team] ?? "#6366f1",
      }))
    : [];

  const PERIOD_LABELS: Record<Period, string> = {
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center gap-4">
        <Image src="/golden-bulldog.png" alt="Golden Bulldog" width={72} height={72} className="drop-shadow-md" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Golden Bulldog Award</h1>
          <p className="text-gray-500 text-sm">Recognize a student for exceptional behavior</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary bg-amber-500 hover:bg-amber-600 whitespace-nowrap">
          + Award Golden Bulldog
        </button>
      </div>

      {/* Admin Drawing Section */}
      {role === "admin" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold">Prize Drawing</h2>
              <p className="text-sm text-gray-500">Each bulldog counts as one entry on the wheel</p>
            </div>
            <div className="flex gap-2">
              {(["week", "month", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    period === p ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-300 hover:border-amber-400"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Eligible students list */}
          {!awards && <p className="text-gray-400 text-sm">Loading…</p>}
          {awards && wheelEntries.length === 0 && (
            <p className="text-gray-500 text-sm">No Golden Bulldogs awarded in this period.</p>
          )}
          {awards && wheelEntries.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {wheelEntries
                  .sort((a, b) => b.count - a.count)
                  .map((e) => (
                    <div key={e.studentId} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border" style={{ borderLeft: `4px solid ${e.color}` }}>
                      <div className="flex gap-0.5">
                        {Array.from({ length: e.count }).map((_, i) => (
                          <Image key={i} src="/golden-bulldog.png" alt="" width={18} height={18} />
                        ))}
                      </div>
                      <span className="text-sm font-medium truncate">{e.name}</span>
                    </div>
                  ))}
              </div>
              <button
                onClick={() => setShowWheel(true)}
                className="btn btn-primary w-full bg-amber-500 hover:bg-amber-600 text-lg py-3"
              >
                🎡 Spin the Wheel!
              </button>
            </>
          )}
        </div>
      )}

      {/* Recent Awards */}
      <div className="card divide-y p-0 overflow-hidden">
        <h2 className="px-4 py-3 font-bold text-lg">
          Recent Awards {awards ? `(${awards.length})` : ""}
        </h2>
        {!awards && <p className="px-4 py-6 text-gray-400">Loading…</p>}
        {awards && awards.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-400">
            <Image src="/golden-bulldog.png" alt="" width={60} height={60} className="mx-auto mb-3 opacity-30" />
            <p>No Golden Bulldogs awarded in this period.</p>
          </div>
        )}
        {awards && awards.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3">
            <Image src="/golden-bulldog.png" alt="" width={36} height={36} className="mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{a.student.firstName} {a.student.lastName}</p>
              <p className="text-xs text-gray-500 mb-1">
                {a.category.name} · {new Date(a.observedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {a.staff.firstName && ` · Awarded by ${a.staff.firstName} ${a.staff.lastName}`}
              </p>
              <p className="text-sm text-gray-700">{a.description}</p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <GoldenBulldogModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {showWheel && (
        <DrawingWheel
          entries={wheelEntries}
          periodLabel={PERIOD_LABELS[period]}
          onClose={() => setShowWheel(false)}
        />
      )}
    </div>
  );
}
