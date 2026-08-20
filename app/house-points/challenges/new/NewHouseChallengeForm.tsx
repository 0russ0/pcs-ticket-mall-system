"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_OPTIONS = [
  { value: "day", label: "1 Day" },
  { value: "week", label: "1 Week" },
  { value: "month", label: "1 Month" },
  { value: "school_year", label: "School Year" },
  { value: "custom", label: "Custom End Date" },
];

function endDateFromDuration(start: string, type: string): string {
  if (!start) return "";
  const d = new Date(start);
  if (type === "day") d.setDate(d.getDate() + 1);
  else if (type === "week") d.setDate(d.getDate() + 7);
  else if (type === "month") d.setMonth(d.getMonth() + 1);
  else if (type === "school_year") { d.setFullYear(d.getFullYear() + 1); d.setMonth(5); d.setDate(30); }
  else return "";
  return d.toISOString().split("T")[0];
}

export default function NewHouseChallengeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [durationType, setDurationType] = useState("week");
  const [customEndDate, setCustomEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function computedEndDate() {
    if (durationType === "custom") return customEndDate || null;
    return endDateFromDuration(startDate, durationType);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Challenge name is required."); return; }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          startDate,
          endDate: computedEndDate(),
          durationType,
          // Server forces audienceFilter to houses and addToTotal to false
          // for power users regardless of what's sent here.
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create challenge."); return; }
      router.push(`/dashboard/campaigns/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div className="card space-y-3">
        <h2 className="font-bold">Challenge Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spirit Week House Cup" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this challenge about?" />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">Duration</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setDurationType(o.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${durationType === o.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {durationType === "custom" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input className="input" type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} min={startDate} required />
          </div>
        )}
        {durationType !== "custom" && startDate && (
          <p className="text-sm text-gray-500">
            Ends: <span className="font-medium">{computedEndDate() ? new Date(computedEndDate()!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}</span>
          </p>
        )}
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        House challenge: open to all 4 houses. Points awarded here always count toward house totals only — never a student's personal balance.
      </p>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full">
        {submitting ? "Creating…" : "Create Challenge"}
      </button>
    </form>
  );
}
