"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HouseWheel from "./HouseWheel";

export default function WheelSection() {
  const router = useRouter();
  const [points, setPoints] = useState(10);
  const [showWheel, setShowWheel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAward, setLastAward] = useState<{ ids: number[]; house: string; points: number } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  async function handleWinner(house: string) {
    setError(null);
    setUndone(false);
    try {
      const res = await fetch("/api/house-points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "house", targetValue: house, points, reason: "Spin the Wheel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to award points.");
        return;
      }
      setLastAward({ ids: data.houseBonusIds ?? [], house, points });
      router.refresh();
    } catch {
      setError("Failed to award points.");
    }
  }

  async function handleUndo() {
    if (!lastAward) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/house-points/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: lastAward.ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not undo.");
        return;
      }
      setUndone(true);
      setLastAward(null);
      router.refresh();
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Each of the 4 houses has an equal 25% chance. Set the points, then spin — the winning house gets them automatically.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      {undone && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">Undone — points reversed.</p>}

      {lastAward && (
        <div className="flex items-center justify-between gap-3 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
          <span className="text-amber-800">+{lastAward.points} pts awarded to {lastAward.house}</span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-600 hover:bg-red-50"
          >
            {undoing ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Points to the winner</label>
        <div className="flex gap-2">
          {[5, 10, 25].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPoints(n)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${points === n ? "border-amber-500 bg-amber-500 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-amber-400"}`}
            >
              {n}
            </button>
          ))}
          <input
            className="input w-24 text-center"
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
          />
        </div>
      </div>

      <button onClick={() => setShowWheel(true)} className="btn btn-primary w-full bg-amber-500 hover:bg-amber-600">
        🎡 Spin for a House
      </button>

      {showWheel && (
        <HouseWheel
          points={points}
          onWinner={handleWinner}
          onClose={() => setShowWheel(false)}
        />
      )}
    </div>
  );
}
