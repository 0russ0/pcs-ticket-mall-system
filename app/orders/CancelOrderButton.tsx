"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelOrderButton({ orderId }: { orderId: number }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    if (!window.confirm("Cancel this order? Your points will be refunded right away.")) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not cancel this order.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <button
        onClick={handleCancel}
        disabled={submitting}
        className="btn btn-danger text-sm w-full"
      >
        {submitting ? "Cancelling…" : "Cancel Order"}
      </button>
    </div>
  );
}
