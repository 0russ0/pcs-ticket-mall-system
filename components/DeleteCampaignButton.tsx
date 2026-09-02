"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCampaignButton({ campaignId, redirectHref }: { campaignId: number; redirectHref: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this campaign permanently? This removes its award history and leaderboard. This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete campaign.");
        return;
      }
      router.push(redirectHref);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card border-red-100">
      <h2 className="font-bold text-sm text-red-700 mb-2">Delete Campaign</h2>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <p className="text-sm text-gray-500 mb-3">Permanently removes this campaign and its award history. This cannot be undone.</p>
      <button onClick={handleDelete} disabled={deleting} className="btn text-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
        {deleting ? "Deleting…" : "Delete this campaign"}
      </button>
    </div>
  );
}
