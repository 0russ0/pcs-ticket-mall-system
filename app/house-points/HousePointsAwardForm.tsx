"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: number; firstName: string; lastName: string; grade: string; homeroom: string };

type TargetType = "house" | "student" | "grade" | "homeroom";

export default function HousePointsAwardForm({
  students,
  homerooms,
  grades,
  houses,
}: {
  students: Student[];
  homerooms: string[];
  grades: string[];
  houses: string[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<TargetType>("house");
  const [targetValue, setTargetValue] = useState(houses[0] ?? "");
  const [studentSearch, setStudentSearch] = useState("");
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastAwardIds, setLastAwardIds] = useState<number[] | null>(null);
  const [undoing, setUndoing] = useState(false);

  const studentMatches = studentSearch.length > 1
    ? students.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase())).slice(0, 8)
    : [];

  function selectTargetType(t: TargetType) {
    setTargetType(t);
    if (t === "house") setTargetValue(houses[0] ?? "");
    else if (t === "grade") setTargetValue(grades[0] ?? "");
    else if (t === "homeroom") setTargetValue(homerooms[0] ?? "");
    else setTargetValue("");
    setStudentSearch("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetValue || points < 1) return;
    setMessage(null);
    setLastAwardIds(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/house-points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetValue, points, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Something went wrong." });
        return;
      }
      setMessage({ type: "success", text: "House points awarded!" });
      setLastAwardIds(data.houseBonusIds ?? null);
      setReason("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUndo() {
    if (!lastAwardIds) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/house-points/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: lastAwardIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Could not undo." });
        return;
      }
      setMessage({ type: "success", text: "Undone — points reversed." });
      setLastAwardIds(null);
      router.refresh();
    } finally {
      setUndoing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-bold text-lg">Award House Points</h2>
      {message && (
        <div className={`text-sm rounded-lg p-3 flex items-center justify-between gap-3 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          <span>{message.text}</span>
          {lastAwardIds && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoing}
              className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-600 hover:bg-red-50"
            >
              {undoing ? "Undoing…" : "Undo"}
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Award to</label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "house", label: "Whole House" },
            { value: "student", label: "Student" },
            { value: "grade", label: "Grade" },
            { value: "homeroom", label: "Homeroom" },
          ] as { value: TargetType; label: string }[]).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => selectTargetType(o.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${targetType === o.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {targetType === "house" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">House</label>
          <select className="input" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
            {houses.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      )}

      {targetType === "grade" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
          <select className="input" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
            {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
      )}

      {targetType === "homeroom" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Homeroom</label>
          <select className="input" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
            {homerooms.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      )}

      {targetType === "student" && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
          <input
            className="input"
            placeholder="Search by name…"
            value={studentSearch}
            onChange={(e) => { setStudentSearch(e.target.value); setTargetValue(""); }}
          />
          {studentMatches.length > 0 && !targetValue && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {studentMatches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setTargetValue(String(s.id)); setStudentSearch(`${s.firstName} ${s.lastName}`); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                >
                  {s.firstName} {s.lastName} <span className="text-gray-400">Gr {s.grade} · {s.homeroom}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Points {targetType !== "house" && targetType !== "student" ? "(per student)" : ""}</label>
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPoints(n)}
              className={`flex-1 py-3 rounded-lg text-lg font-bold border-2 transition-colors ${points === n ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"}`}
            >
              {n}
            </button>
          ))}
          <input
            className="input w-24 text-center"
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-gray-400">(optional)</span></label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Won the pep rally spirit contest" />
      </div>

      <button
        type="submit"
        disabled={submitting || !targetValue}
        className="btn btn-primary w-full"
      >
        {submitting ? "Awarding…" : "Award House Points"}
      </button>
    </form>
  );
}
