"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/leaderboard";
import GoldenBulldogModal from "@/components/GoldenBulldogModal";

type Student = {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  homeroom: string;
  team: string;
  totalPoints: number;
};

type RosterItem = { label: string; value: string; type: "class" | "homeroom"; classGroupId?: number };
type FeedbackState = { [studentId: number]: { type: "points" | "house"; value?: number } | null };

const STORAGE_KEY = "teacher_roster_last_selected";

export default function TeacherRoster({ rosterItems }: { rosterItems: RosterItem[] }) {
  const [selected, setSelected] = useState<RosterItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [pointTotals, setPointTotals] = useState<{ [id: number]: number }>({});
  const [bulldogStudent, setBulldogStudent] = useState<Student | null>(null);
  // Guards against rapid/stuck taps firing duplicate awards for the same student
  // (a real incident: 132 stacked +3 clicks landed in ~30s from one touch glitch).
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  // Restore last selection on mount
  useEffect(() => {
    if (rosterItems.length === 0) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: RosterItem = JSON.parse(saved);
        const match = rosterItems.find((r) => r.value === parsed.value && r.type === parsed.type);
        if (match) setSelected(match);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selection whenever it changes
  useEffect(() => {
    if (!selected) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)); } catch { /* ignore */ }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);

    const url = selected.type === "class"
      ? `/api/students?classId=${selected.value}`
      : `/api/students?homeroom=${encodeURIComponent(selected.value)}`;

    fetch(url)
      .then((r) => r.json())
      .then((data: Student[]) => {
        const sorted = [...data].sort((a, b) =>
          a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
        );
        setStudents(sorted);
        const totals: { [id: number]: number } = {};
        sorted.forEach((s) => { totals[s.id] = s.totalPoints; });
        setPointTotals(totals);
        setFeedback({});
      })
      .finally(() => setLoading(false));
  }, [selected]);

  function flash(studentId: number, type: "points" | "house", value?: number) {
    setFeedback((prev) => ({ ...prev, [studentId]: { type, value } }));
    setTimeout(() => setFeedback((prev) => ({ ...prev, [studentId]: null })), 1500);
  }

  function playCashRegister() {
    try {
      new Audio("/cash-register-sound.mp3").play();
    } catch {
      // audio not available — silent fail
    }
  }

  async function awardPoints(student: Student, pts: number) {
    if (busyIds.has(student.id)) return;
    setBusyIds((prev) => new Set(prev).add(student.id));
    try {
      playCashRegister();
      setPointTotals((prev) => ({ ...prev, [student.id]: (prev[student.id] ?? 0) + pts }));
      flash(student.id, "points", pts);
      const cats = await fetch("/api/categories").then((r) => r.json());
      await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, points: pts, category_id: cats[0]?.id, reason: "" }),
      });
    } finally {
      setBusyIds((prev) => { const next = new Set(prev); next.delete(student.id); return next; });
    }
  }

  async function awardHouse(student: Student) {
    if (busyIds.has(student.id)) return;
    setBusyIds((prev) => new Set(prev).add(student.id));
    try {
      flash(student.id, "house");
      await fetch("/api/points/house-bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ house: student.team }),
      });
    } finally {
      setBusyIds((prev) => { const next = new Set(prev); next.delete(student.id); return next; });
    }
  }

  const dropdownLabel = rosterItems[0]?.type === "class" ? "Class:" : "Class in Room:";

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">{dropdownLabel}</label>
          <select
            className="input flex-1"
            value={selected?.value ?? ""}
            onChange={(e) => {
              const item = rosterItems.find((r) => r.value === e.target.value) ?? null;
              setSelected(item);
            }}
          >
            <option value="">— Select a class —</option>
            {rosterItems.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
        {selected && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-gray-500">
              Buttons 1–3 award personal points. <strong>House</strong> awards 5 pts to the student&apos;s house team only.
            </p>
            {selected.classGroupId && (
              <Link href={`/dashboard/classes/${selected.classGroupId}`} className="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap">
                Manage class →
              </Link>
            )}
          </div>
        )}
      </div>

      {loading && <p className="text-center text-gray-500 py-8">Loading roster…</p>}

      {!loading && students.length > 0 && (
        <div className="card divide-y p-0 overflow-hidden">
          {students.map((student) => {
            const fb = feedback[student.id];
            const teamColor = TEAM_COLORS[student.team] || "#9ca3af";
            const busy = busyIds.has(student.id);
            return (
              <div
                key={student.id}
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderLeft: `4px solid ${teamColor}` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {student.lastName}, {student.firstName}
                  </p>
                  <p className="text-xs text-gray-400">{student.team}</p>
                </div>

                <span className="text-sm font-bold text-blue-600 w-12 text-right">
                  {pointTotals[student.id] ?? student.totalPoints}
                </span>

                {fb && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${fb.type === "house" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                    {fb.type === "house" ? "🏠 +5" : `+${fb.value}`}
                  </span>
                )}

                <div className="flex gap-2">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      onClick={() => awardPoints(student, pts)}
                      disabled={busy}
                      className="w-16 h-16 rounded-xl bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {pts}
                    </button>
                  ))}
                  <button
                    onClick={() => awardHouse(student)}
                    disabled={busy}
                    className="h-16 px-4 rounded-xl text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-transform whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none"
                    style={{ backgroundColor: teamColor }}
                    title={`Award 5 pts to ${student.team}`}
                  >
                    🏠 House
                  </button>
                  <button
                    onClick={() => setBulldogStudent(student)}
                    className="w-16 h-16 rounded-xl bg-amber-50 border-2 border-amber-300 hover:border-amber-500 active:scale-95 transition-transform flex items-center justify-center"
                    title="Award Golden Bulldog"
                  >
                    <Image src="/golden-bulldog.png" alt="Golden Bulldog" width={44} height={44} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && selected && students.length === 0 && (
        <p className="text-gray-500 text-center py-8">No students found in {selected.label}.</p>
      )}

      {bulldogStudent && (
        <GoldenBulldogModal
          prefillStudent={bulldogStudent}
          onClose={() => setBulldogStudent(null)}
        />
      )}
    </div>
  );
}
