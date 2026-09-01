"use client";

import { useState } from "react";
import { ALL_HOUSE_LOGOS, houseBadgeUrl } from "@/lib/houseLogos";

type Student = {
  id: number;
  externalId: string | null;
  googleEmail: string | null;
  firstName: string;
  lastName: string;
  grade: string;
  homeroom: string;
  team: string;
  totalPoints: number;
};

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
const TEAMS = ["Rachel Carson House", "Clemente House", "Hot Metal House", "Liberty House", "Unassigned"];

type FormState = {
  externalId: string;
  firstName: string;
  lastName: string;
  grade: string;
  homeroom: string;
  team: string;
  googleEmail: string;
  totalPoints: string;
};

const EMPTY_FORM: FormState = {
  externalId: "",
  firstName: "",
  lastName: "",
  grade: "K",
  homeroom: "",
  team: "Unassigned",
  googleEmail: "",
  totalPoints: "0",
};

function studentToForm(s: Student): FormState {
  return {
    externalId: s.externalId ?? "",
    firstName: s.firstName,
    lastName: s.lastName,
    grade: s.grade,
    homeroom: s.homeroom,
    team: s.team,
    googleEmail: s.googleEmail ?? "",
    totalPoints: String(s.totalPoints),
  };
}

export default function StudentsClient({ initialStudents }: { initialStudents: Student[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_id: form.externalId,
          first_name: form.firstName,
          last_name: form.lastName,
          grade: form.grade,
          homeroom: form.homeroom,
          team: form.team,
          google_email: form.googleEmail,
          initial_points: Number(form.totalPoints) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setStudents((prev) => [...prev, data].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)));
      setForm(EMPTY_FORM);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(s: Student) {
    setEditingId(s.id);
    setEditForm(studentToForm(s));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: number) {
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_id: editForm.externalId,
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          grade: editForm.grade,
          homeroom: editForm.homeroom,
          team: editForm.team,
          google_email: editForm.googleEmail,
          total_points: Number(editForm.totalPoints) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error);
        return;
      }
      setStudents((prev) => prev.map((s) => (s.id === id ? data : s)));
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRemove(id: number) {
    if (!window.confirm("Delete this student? This also removes their point history, orders, and awards. This cannot be undone.")) return;
    const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }

  const filtered = students.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.homeroom} ${s.grade} ${s.externalId ?? ""} ${s.googleEmail ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-around flex-wrap gap-4">
          {ALL_HOUSE_LOGOS.map((h) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={h.team} src={h.logoUrl} alt={h.team} className="h-16 w-auto" />
          ))}
        </div>
      </div>

      <form onSubmit={handleAdd} className="card space-y-3">
        <h2 className="font-bold">Add Student</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          <input className="input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          <input className="input" placeholder="Homeroom" value={form.homeroom} onChange={(e) => setForm({ ...form, homeroom: e.target.value })} required />
        </div>
        <select className="input" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
          {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Student ID (optional)" value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
          <input className="input" placeholder="Points" type="number" value={form.totalPoints} onChange={(e) => setForm({ ...form, totalPoints: e.target.value })} />
        </div>
        <input className="input" placeholder="Login email (optional)" type="email" value={form.googleEmail} onChange={(e) => setForm({ ...form, googleEmail: e.target.value })} />
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Adding..." : "Add Student"}
        </button>
      </form>

      <div className="card">
        <input className="input mb-3" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Grade</th>
                <th className="py-2 pr-2">Homeroom</th>
                <th className="py-2 pr-2">Team</th>
                <th className="py-2 pr-2">Points</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) =>
                editingId === s.id ? (
                  <tr key={s.id} className="border-b last:border-0 bg-blue-50">
                    <td className="py-2 pr-2" colSpan={7}>
                      {editError && <p className="text-sm text-red-600 mb-2">{editError}</p>}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <input className="input" placeholder="First name" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                        <input className="input" placeholder="Last name" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                        <select className="input" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}>
                          {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                        <input className="input" placeholder="Homeroom" value={editForm.homeroom} onChange={(e) => setEditForm({ ...editForm, homeroom: e.target.value })} />
                        <select className="input" value={editForm.team} onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}>
                          {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input className="input" placeholder="Points" type="number" value={editForm.totalPoints} onChange={(e) => setEditForm({ ...editForm, totalPoints: e.target.value })} />
                        <input className="input" placeholder="Student ID" value={editForm.externalId} onChange={(e) => setEditForm({ ...editForm, externalId: e.target.value })} />
                        <input className="input" placeholder="Login email" type="email" value={editForm.googleEmail} onChange={(e) => setEditForm({ ...editForm, googleEmail: e.target.value })} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(s.id)} disabled={savingEdit} className="btn btn-primary py-1 px-3 text-sm">
                          {savingEdit ? "Saving..." : "Save"}
                        </button>
                        <button onClick={cancelEdit} className="btn btn-secondary py-1 px-3 text-sm">Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">{s.lastName}, {s.firstName}</td>
                    <td className="py-2 pr-2">{s.grade}</td>
                    <td className="py-2 pr-2">{s.homeroom}</td>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        {houseBadgeUrl(s.team) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={houseBadgeUrl(s.team)!} alt="" className="w-5 h-5 rounded-full shrink-0" />
                        )}
                        {s.team}
                      </span>
                    </td>
                    <td className="py-2 pr-2 font-bold">{s.totalPoints}</td>
                    <td className="py-2 pr-2 text-gray-500">{s.googleEmail ?? "—"}</td>
                    <td className="py-2 whitespace-nowrap">
                      <button onClick={() => startEdit(s)} className="text-blue-600 font-medium mr-3">Edit</button>
                      <button onClick={() => handleRemove(s.id)} className="text-red-600 font-medium">Remove</button>
                    </td>
                  </tr>
                )
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
