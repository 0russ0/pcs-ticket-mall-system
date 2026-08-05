"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import GoldenBulldogModal from "@/components/GoldenBulldogModal";
import DrawingWheel from "./DrawingWheel";
import GBRankings from "./GBRankings";
import { TEAM_COLORS } from "@/lib/leaderboard";

type Award = {
  id: number;
  observedDate: string;
  description: string;
  category: { name: string };
  staff: { firstName: string | null; lastName: string | null };
  student: { firstName: string; lastName: string; grade: string; homeroom: string; team: string };
  studentId: number;
};

type Period = "week" | "month" | "all";

function getSince(period: Period): string | null {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
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

const PERIOD_LABELS: Record<Period, string> = {
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

export default function GoldenBulldogPageClient({ role }: { role: string }) {
  const [showModal, setShowModal] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [period, setPeriod] = useState<Period>("week");
  const [awards, setAwards] = useState<Award[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter state shared between wheel and Recent Awards
  const [filterGrade, setFilterGrade] = useState("");
  const [filterHomeroom, setFilterHomeroom] = useState("");
  const [filterTeam, setFilterTeam] = useState("");

  useEffect(() => {
    setAwards(null);
    const since = getSince(period);
    const url = since ? `/api/golden-bulldog?since=${since}` : `/api/golden-bulldog`;
    fetch(url).then((r) => r.json()).then(setAwards);
  }, [period, refreshKey]);

  // Unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    if (!awards) return { grades: [], homerooms: [], teams: [] };
    const grades = [...new Set(awards.map((a) => a.student.grade))].filter(Boolean).sort();
    const homerooms = [...new Set(awards.map((a) => a.student.homeroom))].filter(Boolean).sort();
    const teams = [...new Set(awards.map((a) => a.student.team))].filter(Boolean).sort();
    return { grades, homerooms, teams };
  }, [awards]);

  const filteredAwards = useMemo(() => {
    if (!awards) return [];
    return awards.filter((a) => {
      if (filterGrade && a.student.grade !== filterGrade) return false;
      if (filterHomeroom && a.student.homeroom !== filterHomeroom) return false;
      if (filterTeam && a.student.team !== filterTeam) return false;
      return true;
    });
  }, [awards, filterGrade, filterHomeroom, filterTeam]);

  // Wheel entries derived from the filtered set so filters drive who spins
  const wheelEntries = useMemo(() => {
    if (!filteredAwards) return [];
    const map: Record<number, { studentId: number; name: string; count: number; team: string }> = {};
    for (const a of filteredAwards) {
      if (!map[a.studentId]) {
        map[a.studentId] = {
          studentId: a.studentId,
          name: `${a.student.firstName} ${a.student.lastName}`,
          count: 0,
          team: a.student.team ?? "",
        };
      }
      map[a.studentId].count++;
    }
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .map((e) => ({ ...e, color: TEAM_COLORS[e.team] ?? "#6366f1" }));
  }, [filteredAwards]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center gap-4">
        <Image src="/golden-bulldog.png" alt="Golden Bulldog" width={72} height={72} className="drop-shadow-md" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Golden Bulldog Award</h1>
          <p className="text-gray-500 text-sm">Recognize a student for exceptional behavior</p>
        </div>
        {(role === "admin" || role === "teacher") && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary bg-amber-500 hover:bg-amber-600 whitespace-nowrap">
            + Award Golden Bulldog
          </button>
        )}
      </div>

      {/* Admin Drawing Section */}
      {role === "admin" && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold">Prize Drawing</h2>
            <p className="text-sm text-gray-500">Each bulldog counts as one entry. Filter to control who spins.</p>
          </div>

          {/* Period + filters */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium text-gray-500 w-14">Period:</span>
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

            {awards && awards.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-500 w-14">Filter:</span>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">All Houses</option>
                  {filterOptions.teams.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">All Grades</option>
                  {filterOptions.grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
                <select
                  value={filterHomeroom}
                  onChange={(e) => setFilterHomeroom(e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">All Homerooms</option>
                  {filterOptions.homerooms.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {(filterGrade || filterHomeroom || filterTeam) && (
                  <button
                    onClick={() => { setFilterGrade(""); setFilterHomeroom(""); setFilterTeam(""); }}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {!awards && <p className="text-gray-400 text-sm">Loading…</p>}
          {awards && wheelEntries.length === 0 && (
            <p className="text-gray-500 text-sm">No Golden Bulldogs match the current filters.</p>
          )}
          {awards && wheelEntries.length > 0 && (
            <>
              <p className="text-xs text-gray-400">
                {wheelEntries.length} student{wheelEntries.length !== 1 ? "s" : ""} · {filteredAwards.length} total {filteredAwards.length !== 1 ? "entries" : "entry"} in pool
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {wheelEntries.map((e) => (
                  <div key={e.studentId} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border" style={{ borderLeft: `4px solid ${e.color}` }}>
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(e.count, 5) }).map((_, i) => (
                        <Image key={i} src="/golden-bulldog.png" alt="" width={18} height={18} />
                      ))}
                      {e.count > 5 && <span className="text-xs font-bold text-amber-600">+{e.count - 5}</span>}
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

      {/* GB Rankings — visible to all roles */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b">
          <Image src="/golden-bulldog.png" alt="" width={24} height={24} />
          <h2 className="font-bold text-lg">Golden Bulldog Rankings</h2>
          <span className="text-xs text-gray-400 ml-1">All Time</span>
        </div>
        <GBRankings refreshKey={refreshKey} />
      </div>

      {/* Recent Awards */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="font-bold text-lg">
              Recent Awards {awards ? `(${filteredAwards.length})` : ""}
            </h2>
            {role === "admin" && (
              <div className="flex gap-2">
                {(["week", "month", "all"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      period === p ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Filter row (admin only) */}
          {role === "admin" && awards && awards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-white"
              >
                <option value="">All Grades</option>
                {filterOptions.grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
              <select
                value={filterHomeroom}
                onChange={(e) => setFilterHomeroom(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-white"
              >
                <option value="">All Homerooms</option>
                {filterOptions.homerooms.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1 bg-white"
              >
                <option value="">All Teams</option>
                {filterOptions.teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {(filterGrade || filterHomeroom || filterTeam) && (
                <button
                  onClick={() => { setFilterGrade(""); setFilterHomeroom(""); setFilterTeam(""); }}
                  className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg border border-gray-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="divide-y">
          {!awards && <p className="px-4 py-6 text-gray-400">Loading…</p>}
          {awards && filteredAwards.length === 0 && (
            <div className="px-4 py-10 text-center text-gray-400">
              <Image src="/golden-bulldog.png" alt="" width={60} height={60} className="mx-auto mb-3 opacity-30" />
              <p>No Golden Bulldogs match these filters.</p>
            </div>
          )}
          {filteredAwards.map((a) => {
            const teamColor = TEAM_COLORS[a.student.team] ?? "#9ca3af";
            return (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3" style={{ borderLeft: `4px solid ${teamColor}` }}>
                <Image src="/golden-bulldog.png" alt="" width={36} height={36} className="mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-medium">{a.student.firstName} {a.student.lastName}</p>
                    <span className="text-xs text-gray-400">Gr {a.student.grade} · {a.student.homeroom}</span>
                    {a.student.team && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: teamColor + "22", color: teamColor }}>
                        {a.student.team}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    {a.category.name} · {new Date(a.observedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {a.staff.firstName && ` · by ${a.staff.firstName} ${a.staff.lastName}`}
                  </p>
                  <p className="text-sm text-gray-700">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
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
          periodLabel={[
            PERIOD_LABELS[period],
            filterTeam || null,
            filterGrade ? `Grade ${filterGrade}` : null,
            filterHomeroom || null,
          ].filter(Boolean).join(" · ")}
          onClose={() => setShowWheel(false)}
        />
      )}
    </div>
  );
}
