"use client";

import { useState, useEffect } from "react";
import { TEAM_COLORS } from "@/lib/leaderboard";

type Student = {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  homeroom: string;
  team: string;
  totalPoints: number;
};

type FeedbackState = { [studentId: number]: { type: "points" | "house"; value?: number } | null };

export default function TeacherRoster({
  homerooms,
}: {
  homerooms: string[];
}) {
  const [selectedHomeroom, setSelectedHomeroom] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [pointTotals, setPointTotals] = useState<{ [id: number]: number }>({});

  useEffect(() => {
    if (!selectedHomeroom) return;
    setLoading(true);
    fetch(`/api/students?homeroom=${encodeURIComponent(selectedHomeroom)}`)
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
  }, [selectedHomeroom]);

  function flash(studentId: number, type: "points" | "house", value?: number) {
    setFeedback((prev) => ({ ...prev, [studentId]: { type, value } }));
    setTimeout(() => setFeedback((prev) => ({ ...prev, [studentId]: null })), 1500);
  }

  async function awardPoints(student: Student, pts: number) {
    // Optimistic update
    setPointTotals((prev) => ({ ...prev, [student.id]: (prev[student.id] ?? 0) + pts }));
    flash(student.id, "points", pts);

    const cats = await fetch("/api/categories").then((r) => r.json());
    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: student.id,
        points: pts,
        category_id: cats[0]?.id,
        reason: "",
      }),
    });
  }

  async function awardHouse(student: Student) {
    flash(student.id, "house");
    await fetch("/api/points/house-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ house: student.team }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Class in Room:</label>
          <select
            className="input flex-1"
            value={selectedHomeroom}
            onChange={(e) => setSelectedHomeroom(e.target.value)}
          >
            <option value="">— Select a homeroom —</option>
            {homerooms.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        {selectedHomeroom && (
          <p className="text-xs text-gray-500">
            Buttons 1–3 award personal points. <strong>House</strong> awards 5 pts to the student&apos;s house team only.
          </p>
        )}
      </div>

      {loading && <p className="text-center text-gray-500 py-8">Loading roster…</p>}

      {!loading && students.length > 0 && (
        <div className="card divide-y p-0 overflow-hidden">
          {students.map((student) => {
            const fb = feedback[student.id];
            const teamColor = TEAM_COLORS[student.team] || "#9ca3af";
            return (
              <div
                key={student.id}
                className="flex items-center gap-2 px-4 py-3 transition-colors"
                style={{ borderLeft: `4px solid ${teamColor}` }}
              >
                {/* Name + points */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {student.lastName}, {student.firstName}
                  </p>
                  <p className="text-xs text-gray-400">{student.team}</p>
                </div>

                <span className="text-sm font-bold text-blue-600 w-12 text-right">
                  {pointTotals[student.id] ?? student.totalPoints}
                </span>

                {/* Feedback flash */}
                {fb && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${fb.type === "house" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                    {fb.type === "house" ? "🏠 +5" : `+${fb.value}`}
                  </span>
                )}

                {/* Point buttons */}
                <div className="flex gap-2">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      onClick={() => awardPoints(student, pts)}
                      className="w-16 h-16 rounded-xl bg-blue-600 text-white font-bold text-xl hover:bg-blue-700 active:scale-95 transition-transform"
                    >
                      {pts}
                    </button>
                  ))}
                  <button
                    onClick={() => awardHouse(student)}
                    className="h-16 px-4 rounded-xl text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-transform whitespace-nowrap"
                    style={{ backgroundColor: teamColor }}
                    title={`Award 5 pts to ${student.team}`}
                  >
                    🏠 House
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && selectedHomeroom && students.length === 0 && (
        <p className="text-gray-500 text-center py-8">No students found in {selectedHomeroom}.</p>
      )}
    </div>
  );
}
