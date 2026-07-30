"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { TEAM_COLORS } from "@/lib/leaderboard";

type RankEntry = {
  studentId: number;
  name: string;
  grade: string;
  homeroom: string;
  team: string;
  count: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GBRankings({ refreshKey }: { refreshKey: number }) {
  const [rankings, setRankings] = useState<RankEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/golden-bulldog/rankings")
      .then((r) => r.json())
      .then(setRankings);
  }, [refreshKey]);

  if (!rankings) return <p className="text-gray-400 text-sm px-4 py-6">Loading…</p>;
  if (rankings.length === 0) return (
    <div className="px-4 py-8 text-center text-gray-400">
      <Image src="/golden-bulldog.png" alt="" width={48} height={48} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">No Golden Bulldogs awarded yet.</p>
    </div>
  );

  return (
    <div className="divide-y">
      {rankings.map((entry, i) => {
        const teamColor = TEAM_COLORS[entry.team] ?? "#9ca3af";
        return (
          <div key={entry.studentId} className="flex items-center gap-3 px-4 py-2.5" style={{ borderLeft: `4px solid ${teamColor}` }}>
            <span className="text-lg w-7 text-center shrink-0">
              {i < 3 ? MEDALS[i] : <span className="text-gray-400 font-bold text-sm">#{i + 1}</span>}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{entry.name}</p>
              <p className="text-xs text-gray-400">Gr {entry.grade} · {entry.homeroom}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {Array.from({ length: Math.min(entry.count, 5) }).map((_, j) => (
                <Image key={j} src="/golden-bulldog.png" alt="" width={20} height={20} />
              ))}
              {entry.count > 5 && <span className="text-xs font-bold text-amber-600">+{entry.count - 5}</span>}
              <span className="ml-1 text-sm font-bold text-amber-600">{entry.count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
