"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcknowledgeButton({ orderId }: { orderId: number }) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function acknowledge() {
    setSubmitting(true);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button disabled={submitting} onClick={acknowledge} className="btn btn-secondary text-sm mt-2">
      {submitting ? "…" : "Dismiss"}
    </button>
  );
}
