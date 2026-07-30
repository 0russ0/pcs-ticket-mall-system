"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import GoldenBulldogModal from "@/components/GoldenBulldogModal";

export default function GoldenBulldogPage() {
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4">
        <Image src="/golden-bulldog.png" alt="Golden Bulldog" width={72} height={72} className="drop-shadow-md" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Golden Bulldog Award</h1>
          <p className="text-gray-500 text-sm">Recognize a student for exceptional behavior</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary bg-amber-500 hover:bg-amber-600 whitespace-nowrap"
        >
          + Award Golden Bulldog
        </button>
      </div>

      <RecentAwards key={refreshKey} />

      {showModal && (
        <GoldenBulldogModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

type Award = {
  id: number;
  observedDate: string;
  description: string;
  category: { name: string };
  staff: { firstName: string | null; lastName: string | null };
  student: { firstName: string; lastName: string };
};

function RecentAwards({ }: object) {
  const [awards, setAwards] = useState<Award[] | null>(null);

  useEffect(() => {
    fetch("/api/golden-bulldog")
      .then((r) => r.json())
      .then(setAwards);
  }, []);

  if (!awards) return <p className="text-center text-gray-400 py-8">Loading…</p>;
  if (awards.length === 0) return (
    <div className="card text-center py-10 text-gray-400">
      <Image src="/golden-bulldog.png" alt="" width={60} height={60} className="mx-auto mb-3 opacity-30" />
      <p>No Golden Bulldogs awarded yet.</p>
    </div>
  );

  return (
    <div className="card divide-y p-0 overflow-hidden">
      <h2 className="px-4 py-3 font-bold text-lg">Recent Awards</h2>
      {awards.map((a) => (
        <div key={a.id} className="flex items-start gap-3 px-4 py-3">
          <Image src="/golden-bulldog.png" alt="" width={36} height={36} className="mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{a.student.firstName} {a.student.lastName}</p>
            <p className="text-xs text-gray-500 mb-1">
              {a.category.name} · {new Date(a.observedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {a.staff.firstName && ` · Awarded by ${a.staff.firstName} ${a.staff.lastName}`}
            </p>
            <p className="text-sm text-gray-700">{a.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
