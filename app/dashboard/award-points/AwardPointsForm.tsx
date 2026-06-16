"use client";

import { useEffect, useMemo, useState } from "react";

type Student = {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  homeroom: string;
  team: string;
  totalPoints: number;
};

type Category = {
  id: number;
  name: string;
};

export default function AwardPointsForm() {
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<number | "">("");
  const [points, setPoints] = useState<number>(5);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/students").then((r) => r.json()).then(setStudents);
    fetch("/api/categories").then((r) => r.json()).then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
    );
  }, [students, search]);

  const selectedStudent = students.find((s) => s.id === studentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!studentId || !categoryId || !points) {
      setMessage({ type: "error", text: "Please fill out all required fields." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          points,
          category_id: categoryId,
          reason,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Something went wrong." });
      } else {
        setMessage({ type: "success", text: `✓ ${data.message}` });
        setReason("");
        setPoints(5);
        setStudentId("");
        setSearch("");
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, totalPoints: data.totalPoints } : s))
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="student-search">
          Student
        </label>
        <input
          id="student-search"
          className="input"
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input mt-2"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")}
          required
        >
          <option value="">Select a student...</option>
          {filtered.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName} ({s.grade} - {s.homeroom})
            </option>
          ))}
        </select>
        {selectedStudent && (
          <p className="text-sm text-gray-500 mt-1">
            Current points: {selectedStudent.totalPoints}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="points">
          Points
        </label>
        <input
          id="points"
          className="input"
          type="number"
          min={-500}
          max={500}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="category">
          Category
        </label>
        <select
          id="category"
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          required
        >
          <option value="">Select a category...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="reason">
          Reason (optional)
        </label>
        <textarea
          id="reason"
          className="input"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full">
        {submitting ? "Submitting..." : "Award Points"}
      </button>
    </form>
  );
}
