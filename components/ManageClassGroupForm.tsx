"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: number; firstName: string; lastName: string; grade: string; homeroom: string };
type Teacher = { classId: number; staffId: number; firstName: string | null; lastName: string | null; email: string };
type Staff = { id: number; firstName: string | null; lastName: string | null; googleEmail: string };

export default function ManageClassGroupForm({
  groupId,
  initialName,
  initialStudents,
  initialTeachers,
  allStudents,
  allStaff,
  currentStaffId,
}: {
  groupId: number;
  initialName: string;
  initialStudents: Student[];
  initialTeachers: Teacher[];
  allStudents: Student[];
  allStaff: Staff[];
  currentStaffId: number | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [students, setStudents] = useState(initialStudents);
  const [teachers, setTeachers] = useState(initialTeachers);
  const [studentSearch, setStudentSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function patch(body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/custom/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setName(data.name);
      setStudents(data.students);
      setTeachers(data.teachers);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await patch({ name: name.trim() });
  }

  const enrolledIds = new Set(students.map((s) => s.id));
  const studentMatches = studentSearch.length > 1
    ? allStudents.filter((s) => !enrolledIds.has(s.id) && `${s.firstName} ${s.lastName} ${s.homeroom} ${s.grade}`.toLowerCase().includes(studentSearch.toLowerCase())).slice(0, 8)
    : [];

  const teacherIds = new Set(teachers.map((t) => t.staffId));
  const teacherMatches = teacherSearch.length > 1
    ? allStaff.filter((s) => !teacherIds.has(s.id) && `${s.firstName ?? ""} ${s.lastName ?? ""} ${s.googleEmail}`.toLowerCase().includes(teacherSearch.toLowerCase())).slice(0, 8)
    : [];

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This removes it for every co-teacher and cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/custom/${groupId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to delete."); return; }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <form onSubmit={saveName} className="card space-y-2">
        <label className="block text-sm font-medium text-gray-700">Class Name</label>
        <div className="flex gap-2">
          <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit" disabled={busy || !name.trim()} className="btn btn-secondary shrink-0">
            Save
          </button>
        </div>
      </form>

      <div className="card space-y-3">
        <h2 className="font-bold">Co-Teachers</h2>
        <div className="flex flex-wrap gap-1.5">
          {teachers.map((t) => (
            <span key={t.staffId} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded-full px-2.5 py-1">
              {t.firstName} {t.lastName}
              {t.staffId === currentStaffId && <span className="text-blue-500">(you)</span>}
              {teachers.length > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patch({ removeTeacherStaffId: t.staffId })}
                  className="hover:text-red-600 transition-colors font-bold leading-none"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            className="input"
            placeholder="Add a co-teacher by name or email…"
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
          />
          {teacherMatches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {teacherMatches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => { patch({ addTeacherStaffId: s.id }); setTeacherSearch(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                >
                  {s.firstName} {s.lastName} <span className="text-gray-400">{s.googleEmail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">Students ({students.length})</h2>
        <div className="flex flex-wrap gap-1.5">
          {students.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded-full px-2.5 py-1">
              {s.firstName} {s.lastName}
              <button
                type="button"
                disabled={busy}
                onClick={() => patch({ removeStudentIds: [s.id] })}
                className="hover:text-red-600 transition-colors font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
          {students.length === 0 && <p className="text-sm text-gray-400">No students yet.</p>}
        </div>
        <div className="relative">
          <input
            className="input"
            placeholder="Add a student by name…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          {studentMatches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {studentMatches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => { patch({ addStudentIds: [s.id] }); setStudentSearch(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                >
                  {s.lastName}, {s.firstName} <span className="text-gray-400">· Gr {s.grade} · {s.homeroom}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card border-red-100">
        <h2 className="font-bold text-sm text-red-700 mb-2">Delete Class</h2>
        <p className="text-sm text-gray-500 mb-3">Removes this class for every co-teacher. This cannot be undone.</p>
        <button onClick={handleDelete} disabled={deleting} className="btn text-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
          {deleting ? "Deleting…" : "Delete this class"}
        </button>
      </div>
    </div>
  );
}
