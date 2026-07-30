"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: number; firstName: string; lastName: string; grade: string; homeroom: string };

type TargetType = "student" | "homeroom" | "grade" | "house";

export default function BulkPointsClient({
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
  const [targetType, setTargetType] = useState<TargetType>("student");
  const [targetValue, setTargetValue] = useState("");
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const options: Record<TargetType, { label: string; choices: { value: string; label: string }[] }> = {
    student: {
      label: "Student",
      choices: students.map((s) => ({
        value: String(s.id),
        label: `${s.lastName}, ${s.firstName} (Gr ${s.grade} · ${s.homeroom})`,
      })),
    },
    homeroom: {
      label: "Homeroom",
      choices: homerooms.map((h) => ({ value: h, label: h })),
    },
    grade: {
      label: "Grade",
      choices: grades.map((g) => ({ value: g, label: `Grade ${g}` })),
    },
    house: {
      label: "House Team",
      choices: houses.map((h) => ({ value: h, label: h })),
    },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetValue || points < 1) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/points/bulk-award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetValue, points, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Something went wrong." });
      } else {
        const label = targetType === "student"
          ? `${data.studentCount} student`
          : `${options[targetType].label} — ${targetValue}`;
        const note = targetType !== "student" ? " (added to group total only, not individual students)" : "";
        setMessage({
          type: "success",
          text: `✓ +${points} points awarded to ${label}${note}`,
        });
        setTargetValue("");
        setPoints(1);
        setReason("");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Award points to a…</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["student", "homeroom", "grade", "house"] as TargetType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTargetType(t); setTargetValue(""); }}
              className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors capitalize ${
                targetType === t
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
              }`}
            >
              {options[t].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{options[targetType].label}</label>
        <select
          className="input"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          required
        >
          <option value="">Select {options[targetType].label.toLowerCase()}…</option>
          {options[targetType].choices.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Points to Award</label>
        <input
          className="input"
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          required
        />
        <p className="text-xs text-gray-500 mt-1">No maximum for bulk awards</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Reason (optional)</label>
        <textarea
          className="input"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Spirit Week, Field Day, Perfect Attendance"
        />
      </div>

      <button type="submit" disabled={submitting || !targetValue} className="btn btn-primary w-full">
        {submitting ? "Awarding…" : "Award Points"}
      </button>
    </form>
  );
}
