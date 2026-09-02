"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Student = { id: number; firstName: string; lastName: string; grade: string; homeroom: string; team: string };
type TargetType = "individual" | "grade" | "homeroom" | "house";

export default function CampaignAwardPanel({
  campaignId,
  students,
  addToTotal,
}: {
  campaignId: number;
  students: Student[];
  addToTotal: boolean;
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<TargetType>("individual");
  const [groupValue, setGroupValue] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const grades = useMemo(() => [...new Set(students.map((s) => s.grade))].sort(), [students]);
  const homerooms = useMemo(() => [...new Set(students.map((s) => s.homeroom))].sort(), [students]);
  const houses = useMemo(() => [...new Set(students.map((s) => s.team))].sort(), [students]);

  const filtered = search.length > 1
    ? students.filter((s) =>
        `${s.firstName} ${s.lastName} ${s.lastName} ${s.firstName} ${s.homeroom} ${s.grade}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ).slice(0, 20)
    : [];

  function selectTargetType(t: TargetType) {
    setTargetType(t);
    setSearch("");
    if (t === "individual") {
      setSelectedIds(new Set());
      setGroupValue("");
      return;
    }
    const options = t === "grade" ? grades : t === "homeroom" ? homerooms : houses;
    const value = options[0] ?? "";
    setGroupValue(value);
    applyGroupValue(t, value);
  }

  function applyGroupValue(t: TargetType, value: string) {
    setGroupValue(value);
    if (!value) { setSelectedIds(new Set()); return; }
    const field = t === "grade" ? "grade" : t === "homeroom" ? "homeroom" : "team";
    setSelectedIds(new Set(students.filter((s) => s[field] === value).map((s) => s.id)));
  }

  function toggleStudent(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeSelected(id: number) {
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  const selectedStudents = students.filter((s) => selectedIds.has(s.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0 || points < 1) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selectedIds], points, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ type: "error", text: data.error || "Failed to award points." }); return; }
      setMessage({ type: "success", text: `Awarded ${points} pts to ${data.awarded} student${data.awarded !== 1 ? "s" : ""}!` });
      if (targetType === "individual") setSelectedIds(new Set());
      setReason("");
      setSearch("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-bold text-lg">Award Points</h2>
      {!addToTotal && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Standalone campaign — points stay within this campaign and won&apos;t affect student totals.
        </p>
      )}

      {message && (
        <p className={`text-sm rounded-lg p-3 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {message.text}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Award to</label>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "individual", label: "Individual" },
            { value: "grade", label: "Grade" },
            { value: "homeroom", label: "Homeroom" },
            { value: "house", label: "House" },
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

      {targetType === "grade" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
          <select className="input" value={groupValue} onChange={(e) => applyGroupValue("grade", e.target.value)}>
            {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
      )}

      {targetType === "homeroom" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Homeroom</label>
          <select className="input" value={groupValue} onChange={(e) => applyGroupValue("homeroom", e.target.value)}>
            {homerooms.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      )}

      {targetType === "house" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">House</label>
          <select className="input" value={groupValue} onChange={(e) => applyGroupValue("house", e.target.value)}>
            {houses.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      )}

      {targetType !== "individual" && (
        <p className="text-sm text-gray-500">
          {selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""} in {groupValue || "…"}
        </p>
      )}

      {targetType === "individual" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search students</label>
            <input
              className="input"
              placeholder="Type a name, grade, or homeroom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {filtered.length > 0 && (
              <div className="mt-1 border rounded-lg overflow-hidden divide-y text-sm max-h-48 overflow-y-auto">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { toggleStudent(s.id); setSearch(""); }}
                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${selectedIds.has(s.id) ? "bg-blue-50 font-medium text-blue-700" : "bg-white"}`}
                  >
                    {s.lastName}, {s.firstName} <span className="text-gray-400">· Gr {s.grade} · {s.homeroom}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStudents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Selected ({selectedStudents.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded-full px-2.5 py-1">
                    {s.firstName} {s.lastName}
                    <button type="button" onClick={() => removeSelected(s.id)} className="hover:text-red-600 transition-colors font-bold leading-none">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Points {targetType !== "individual" ? "(per student)" : ""}</label>
          <input
            className="input"
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-gray-400">(optional)</span></label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Most books read"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || selectedIds.size === 0}
        className="btn btn-primary w-full"
      >
        {submitting ? "Awarding…" : `Award ${points} pts to ${selectedIds.size || "…"} student${selectedIds.size !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
