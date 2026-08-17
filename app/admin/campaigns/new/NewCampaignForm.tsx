"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AudienceType = "all" | "grade_band" | "grades" | "homerooms" | "houses";

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
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

export default function NewCampaignForm({ homerooms, teams }: { homerooms: string[]; teams: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [durationType, setDurationType] = useState("week");
  const [customEndDate, setCustomEndDate] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [gradeBand, setGradeBand] = useState<"2-5" | "6-8">("2-5");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedHomerooms, setSelectedHomerooms] = useState<string[]>([]);
  const [selectedHouses, setSelectedHouses] = useState<string[]>([]);
  const [addToTotal, setAddToTotal] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGrade(g: string) {
    setSelectedGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }
  function toggleHomeroom(h: string) {
    setSelectedHomerooms((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  }
  function toggleHouse(h: string) {
    setSelectedHouses((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  }

  function buildAudienceFilter() {
    if (audienceType === "all") return null;
    if (audienceType === "grade_band") return { type: "grade_band", value: gradeBand };
    if (audienceType === "grades") return { type: "grades", values: selectedGrades };
    if (audienceType === "homerooms") return { type: "homerooms", values: selectedHomerooms };
    if (audienceType === "houses") return { type: "houses", values: selectedHouses };
    return null;
  }

  function computedEndDate() {
    if (durationType === "custom") return customEndDate || null;
    if (durationType === "school_year") return endDateFromDuration(startDate, "school_year");
    return endDateFromDuration(startDate, durationType);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Campaign name is required."); return; }
    const filter = buildAudienceFilter();
    if (audienceType === "grades" && selectedGrades.length === 0) { setError("Select at least one grade."); return; }
    if (audienceType === "homerooms" && selectedHomerooms.length === 0) { setError("Select at least one homeroom."); return; }
    if (audienceType === "houses" && selectedHouses.length === 0) { setError("Select at least one house."); return; }

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
          audienceFilter: filter,
          addToTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create campaign."); return; }
      router.push(`/admin/campaigns/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div className="card space-y-3">
        <h2 className="font-bold">Campaign Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reading Month Challenge" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this campaign about?" />
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

      <div className="card space-y-3">
        <h2 className="font-bold">Who participates?</h2>
        <div className="flex flex-col gap-2">
          {(["all", "grade_band", "grades", "homerooms", "houses"] as AudienceType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="audience" value={t} checked={audienceType === t} onChange={() => setAudienceType(t)} />
              <span className="text-sm">
                {t === "all" && "All students"}
                {t === "grade_band" && "Grade band (lower/middle school)"}
                {t === "grades" && "Specific grades"}
                {t === "homerooms" && "Specific homerooms"}
                {t === "houses" && "Specific houses / teams"}
              </span>
            </label>
          ))}
        </div>

        {audienceType === "grade_band" && (
          <div className="flex gap-3 pt-1">
            {(["2-5", "6-8"] as const).map((b) => (
              <button key={b} type="button" onClick={() => setGradeBand(b)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${gradeBand === b ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}>
                {b === "2-5" ? "Lower School (Gr 2–5)" : "Middle School (Gr 6–8)"}
              </button>
            ))}
          </div>
        )}

        {audienceType === "grades" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {GRADES.map((g) => (
              <button key={g} type="button" onClick={() => toggleGrade(g)}
                className={`w-10 h-10 rounded-lg text-sm font-bold border ${selectedGrades.includes(g) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}>
                {g}
              </button>
            ))}
          </div>
        )}

        {audienceType === "homerooms" && (
          <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
            {homerooms.map((h) => (
              <button key={h} type="button" onClick={() => toggleHomeroom(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${selectedHomerooms.includes(h) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}>
                {h}
              </button>
            ))}
          </div>
        )}

        {audienceType === "houses" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {teams.map((t) => (
              <button key={t} type="button" onClick={() => toggleHouse(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${selectedHouses.includes(t) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">Points Behavior</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={addToTotal}
            onChange={(e) => setAddToTotal(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <div>
            <p className="text-sm font-medium">Apply campaign points to student totals</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {addToTotal
                ? "Points awarded in this campaign also count toward each student's global point balance and leaderboard rank."
                : "Campaign points are tracked separately. Students' global totals are unaffected."}
            </p>
          </div>
        </label>
        {!addToTotal && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Standalone mode: this campaign has its own leaderboard but points stay separate from the main store balance.
          </p>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full">
        {submitting ? "Creating…" : "Create Campaign"}
      </button>
    </form>
  );
}
