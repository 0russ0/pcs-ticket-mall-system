"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: number; firstName: string; lastName: string; grade: string; homeroom: string };

export default function NewClassGroupForm({ students }: { students: Student[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = search.length > 1
    ? students.filter((s) =>
        `${s.firstName} ${s.lastName} ${s.homeroom} ${s.grade}`.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 20)
    : [];

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
    if (!name.trim()) { setError("Class name is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/classes/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentIds: [...selectedIds] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create class."); return; }
      router.push(`/dashboard/classes/${data.groupId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reading Group A" required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Students</label>
        <input
          className="input"
          placeholder="Search by name, grade, or homeroom…"
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

      <button type="submit" disabled={submitting || !name.trim()} className="btn btn-primary w-full">
        {submitting ? "Creating…" : "Create Class"}
      </button>
    </form>
  );
}
