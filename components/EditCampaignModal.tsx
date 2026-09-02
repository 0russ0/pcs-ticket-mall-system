"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditCampaignModal({
  campaignId,
  initialName,
  initialDescription,
  initialEndDate,
}: {
  campaignId: number;
  initialName: string;
  initialDescription: string;
  initialEndDate: string; // yyyy-mm-dd, or "" for no end date
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setName(initialName);
    setDescription(initialDescription);
    setEndDate(initialEndDate);
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          endDate: endDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save changes."); return; }
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openModal} className="btn btn-secondary text-sm">
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg">Edit Challenge</h2>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-gray-400">(optional)</span></label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Leave blank for no end date.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
