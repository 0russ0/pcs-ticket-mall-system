"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProposalActions({ productId }: { productId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    await fetch("/api/products/proposal-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, action }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={() => act("approve")}
        disabled={!!loading}
        className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading === "approve" ? "Approving…" : "✓ Approve & Publish"}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={!!loading}
        className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition-colors"
      >
        {loading === "reject" ? "Rejecting…" : "✕ Reject"}
      </button>
    </div>
  );
}
