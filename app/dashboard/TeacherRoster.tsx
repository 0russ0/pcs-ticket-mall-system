"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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

type RosterItem = { label: string; value: string; type: "class" | "homeroom" };
type FeedbackState = { [studentId: number]: { type: "points" | "house"; value?: number } | null };

export default function TeacherRoster({ rosterItems }: { rosterItems: RosterItem[] }) {
  const [selected, setSelected] = useState<RosterItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [pointTotals, setPointTotals] = useState<{ [id: number]: number }>({});
  const [bulldogStudent, setBulldogStudent] = useState<Student | null>(null);

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
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const now = ctx.currentTime;

      // "CHA" — filtered white noise burst (mechanical drawer/key click)
      const bufLen = Math.floor(ctx.sampleRate * 0.18);
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1100;
      bp.Q.value = 0.7;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      noise.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.18);

      // "CHING" — inharmonic bell stack (metallic ring that sustains)
      const bells = [
        { freq: 1760, gain: 0.45, decay: 0.9 },  // A6 — fundamental
        { freq: 2637, gain: 0.22, decay: 0.5 },  // E7 — slightly sharp for metal character
        { freq: 3520, gain: 0.13, decay: 0.28 }, // A7 — brightness
        { freq: 4186, gain: 0.08, decay: 0.18 }, // C8 — shimmer
      ];
      const chingStart = now + 0.07;
      for (const b of bells) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = b.freq;
        g.gain.setValueAtTime(b.gain, chingStart);
        g.gain.exponentialRampToValueAtTime(0.001, chingStart + b.decay);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(chingStart);
        osc.stop(chingStart + b.decay);
      }
    } catch {
      // audio not available — silent fail
    }
  }

  async function awardPoints(student: Student, pts: number) {
    playCashRegister();
    setPointTotals((prev) => ({ ...prev, [student.id]: (prev[student.id] ?? 0) + pts }));
    flash(student.id, "points", pts);
    const cats = await fetch("/api/categories").then((r) => r.json());
    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, points: pts, category_id: cats[0]?.id, reason: "" }),
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
