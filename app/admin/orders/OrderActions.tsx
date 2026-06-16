"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({ orderId, action }: { orderId: number; action: "pending" | "approved" }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function send(actionName: string, notes?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function handleReject() {
    const reason = window.prompt("Reason for rejecting this order (optional):") ?? "";
    send("reject", reason);
  }

  return (
    <div className="mt-2 space-y-1">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        {action === "pending" && (
          <>
            <button disabled={submitting} onClick={() => send("approve")} className="btn btn-primary text-sm flex-1">
              Approve
            </button>
            <button disabled={submitting} onClick={handleReject} className="btn btn-danger text-sm flex-1">
              Reject
            </button>
          </>
        )}
        {action === "approved" && (
          <button disabled={submitting} onClick={() => send("complete")} className="btn btn-primary text-sm flex-1">
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
