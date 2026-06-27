"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch("/api/students").then((r) => r.json()).then(setStudents);
    fetch("/api/categories").then((r) => r.json()).then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return students.slice(0, 8);
    const q = search.toLowerCase();
    return students
      .filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [students, search]);

  const selectedStudent = students.find((s) => s.id === studentId);

  function handleSelectStudent(s: Student) {
    setStudentId(s.id);
    setSearch(`${s.firstName} ${s.lastName}`);
    setDropdownOpen(false);
  }

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

      <div ref={containerRef} className="relative">
        <label className="block text-sm font-medium mb-1" htmlFor="student-search">
          Student
        </label>
        <input
          id="student-search"
          className="input"
          type="text"
          autoComplete="off"
          placeholder="Start typing a name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setStudentId("");
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          required
        />
        {dropdownOpen && filtered.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleSelectStudent(s)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between items-center"
                >
                  <span>
                    {s.firstName} {s.lastName}{" "}
                    <span className="text-gray-400">({s.grade} - {s.homeroom})</span>
                  </span>
                  <span className="text-gray-500 text-xs">{s.totalPoints} pts</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {dropdownOpen && search && filtered.length === 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
            No students match &quot;{search}&quot;
          </div>
        )}
        {selectedStudent && (
          <p className="text-sm text-gray-500 mt-1">
            Selected: {selectedStudent.firstName} {selectedStudent.lastName} &middot; Current points: {selectedStudent.totalPoints}
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
