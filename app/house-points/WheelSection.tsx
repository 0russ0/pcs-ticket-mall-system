"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HouseWheel from "./HouseWheel";

export default function WheelSection() {
  const router = useRouter();
  const [points, setPoints] = useState(10);
  const [showWheel, setShowWheel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWinner(house: string) {
    setError(null);
    try {
      const res = await fetch("/api/house-points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "house", targetValue: house, points, reason: "Spin the Wheel" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to award points.");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to award points.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Each of the 4 houses has an equal 25% chance. Set the points, then spin — the winning house gets them automatically.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

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
