"use client";

import { useState } from "react";

const WORD_BANK = [
  "avalanche", "blizzard", "cactus", "driftwood", "eclipse",
  "falcon", "glacier", "harbor", "ignite", "jasmine",
  "keystone", "lantern", "marble", "nebula", "orbit",
  "phantom", "quarry", "rapids", "summit", "tundra",
  "uplift", "vortex", "willow", "xenon", "yonder", "zenith",
];

function generatePhrase(): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const words = [...WORD_BANK].sort(() => Math.random() - 0.5).slice(0, 3);
  return words.join("-");
}

export default function MasterResetButton() {
  const [step, setStep] = useState<"idle" | "confirm" | "loading" | "done">("idle");
  const [phrase, setPhrase] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function openDialog() {
    setPhrase(generatePhrase());
    setInput("");
    setError("");
    setStep("confirm");
  }

  async function handleReset() {
    if (input.trim() !== phrase.trim()) {
      setError("Phrase does not match. Please type it exactly.");
      return;
    }
    setStep("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/reset-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: input, expectedPhrase: phrase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred.");
      setStep("confirm");
    }
  }

  if (step === "done") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-green-700 font-semibold text-lg">✓ Points Reset Complete</p>
        <p className="text-green-600 text-sm mt-1">All student, team, and homeroom points have been zeroed out.</p>
        <button onClick={() => setStep("idle")} className="mt-3 text-sm text-green-600 underline">Dismiss</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div>
        <h3 className="font-bold text-red-700 text-base">Danger Zone — Master Points Reset</h3>
        <p className="text-red-600 text-sm mt-1">
          Permanently zeroes <strong>all</strong> student points, team totals, homeroom totals, and point award history school-wide. This cannot be undone.
        </p>
      </div>

      {step === "idle" && (
        <button
          onClick={openDialog}
          className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
        >
          Reset All Points…
        </button>
      )}

      {(step === "confirm" || step === "loading") && (
        <div className="space-y-3">
          <p className="text-sm text-red-700 font-medium">
            To confirm, type the phrase below exactly:
          </p>
          <div className="font-mono text-lg font-bold tracking-widest text-red-800 bg-white border border-red-300 rounded-lg px-4 py-3 text-center select-all">
            {phrase}
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            placeholder="Type the phrase here"
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
            disabled={step === "loading"}
            autoFocus
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={step === "loading" || !input}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {step === "loading" ? "Resetting…" : "Confirm Reset"}
            </button>
            <button
              onClick={() => setStep("idle")}
              disabled={step === "loading"}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
