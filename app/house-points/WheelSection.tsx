"use client";

import { useEffect, useState } from "react";
import DrawingWheel from "@/app/dashboard/golden-bulldog/DrawingWheel";
import { TEAM_COLORS } from "@/lib/leaderboard";

type Challenge = { id: number; name: string };
type LeaderboardRow = { student: { team: string } | null; points: number };

export default function WheelSection() {
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [entries, setEntries] = useState<{ studentId: number; name: string; count: number; color: string }[] | null>(null);
  const [showWheel, setShowWheel] = useState(false);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((all: { id: number; name: string; isActive: boolean; audienceFilter: unknown }[]) => {
        const houseChallenges = all.filter(
          (c) => c.isActive && (c.audienceFilter as { type?: string } | null)?.type === "houses"
        );
        setChallenges(houseChallenges);
        if (houseChallenges.length > 0) setSelectedId(houseChallenges[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) { setEntries(null); return; }
    setEntries(null);
    fetch(`/api/campaigns/${selectedId}`)
      .then((r) => r.json())
      .then((data: { leaderboard: LeaderboardRow[] }) => {
        const totals = new Map<string, number>();
        for (const row of data.leaderboard) {
          if (!row.student) continue;
          totals.set(row.student.team, (totals.get(row.student.team) ?? 0) + row.points);
        }
        const wheelEntries = [...totals.entries()]
          .filter(([, points]) => points > 0)
          .map(([team, points], i) => ({
            studentId: i,
            name: team,
            count: points,
            color: TEAM_COLORS[team] ?? "#6366f1",
          }));
        setEntries(wheelEntries);
      });
  }, [selectedId]);

  if (challenges === null) return <p className="text-gray-400 text-sm">Loading…</p>;
  if (challenges.length === 0) {
    return <p className="text-gray-500 text-sm">Create a house challenge first, then come back here to spin for it.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Challenge</label>
        <select
          className="input"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {challenges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {entries === null && <p className="text-gray-400 text-sm">Loading standings…</p>}
      {entries && entries.length === 0 && (
        <p className="text-gray-500 text-sm">No points awarded in this challenge yet — nothing to spin for.</p>
      )}
      {entries && entries.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {entries.map((e) => (
              <span key={e.studentId} className="text-xs font-medium px-2 py-1 rounded-full text-white" style={{ backgroundColor: e.color }}>
                {e.name}: {e.count} pts
              </span>
            ))}
          </div>
          <button onClick={() => setShowWheel(true)} className="btn btn-primary w-full bg-amber-500 hover:bg-amber-600">
            🎡 Spin for a House
          </button>
        </>
      )}

      {showWheel && entries && (
        <DrawingWheel
          entries={entries}
          periodLabel={challenges.find((c) => c.id === selectedId)?.name ?? ""}
          onClose={() => setShowWheel(false)}
        />
      )}
    </div>
  );
}
