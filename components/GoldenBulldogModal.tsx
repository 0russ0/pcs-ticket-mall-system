"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

type Student = { id: number; firstName: string; lastName: string; grade: string; homeroom: string };
type Category = { id: number; name: string };

type Props = {
  prefillStudent?: Student;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function GoldenBulldogModal({ prefillStudent, onClose, onSuccess }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const [student, setStudent] = useState<Student | null>(prefillStudent ?? null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [observedDate, setObservedDate] = useState(today);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((cats: Category[]) => {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(String(cats[0].id));
    });
  }, []);

  useEffect(() => {
    if (prefillStudent) return;
    if (search.length < 2) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(search)}`);
      if (res.ok) setSearchResults(await res.json());
    }, 250);
  }, [search, prefillStudent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !categoryId || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/golden-bulldog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, categoryId, observedDate, description }),
      });
      if (res.ok) {
        setSuccess(true);
        onSuccess?.();
        setTimeout(onClose, 1500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b">
          <Image src="/golden-bulldog.png" alt="Golden Bulldog" width={48} height={48} className="drop-shadow" />
          <div>
            <h2 className="text-xl font-bold">Golden Bulldog Award</h2>
            <p className="text-xs text-gray-500">Recognizing exceptional behavior</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <Image src="/golden-bulldog.png" alt="" width={80} height={80} className="mx-auto mb-4" />
            <p className="text-xl font-bold text-amber-600">Golden Bulldog Awarded!</p>
            <p className="text-gray-500 text-sm mt-1">{student?.firstName} {student?.lastName}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Student */}
            <div>
              <label className="block text-sm font-medium mb-1">Student</label>
              {student ? (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="font-medium">{student.firstName} {student.lastName} <span className="text-gray-400 text-xs">Gr {student.grade} · {student.homeroom}</span></span>
                  {!prefillStudent && (
                    <button type="button" onClick={() => setStudent(null)} className="text-gray-400 hover:text-red-500 text-sm">change</button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    className="input w-full"
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto mt-1">
                      {searchResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm"
                          onClick={() => { setStudent(s); setSearch(""); setSearchResults([]); }}
                        >
                          <span className="font-medium">{s.firstName} {s.lastName}</span>
                          <span className="text-gray-400 ml-2">Gr {s.grade} · {s.homeroom}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Date Observed</label>
              <input
                type="date"
                className="input w-full"
                value={observedDate}
                max={today}
                onChange={(e) => setObservedDate(e.target.value)}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select className="input w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">Description of Behavior</label>
              <textarea
                className="input w-full h-24 resize-none"
                placeholder="Briefly describe what the student did..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
              <button
                type="submit"
                disabled={submitting || !student || !description.trim()}
                className="btn btn-primary flex-1 bg-amber-500 hover:bg-amber-600"
              >
                {submitting ? "Awarding..." : "Award Golden Bulldog"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
