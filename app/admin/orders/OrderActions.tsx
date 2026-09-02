"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({ orderId, action, compact }: { orderId: number; action: "pending" | "approved"; compact?: boolean }) {
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

  function handleCancel() {
    if (!window.confirm("Cancel this order? Points will be refunded and inventory restocked.")) return;
    const reason = window.prompt("Reason for cancelling (optional):") ?? "";
    send("cancel", reason);
  }

  if (compact) {
    const btnBase = "text-xs font-bold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50";
    return (
      <div className="flex items-center gap-1.5">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {action === "pending" && (
          <>
            <button disabled={submitting} onClick={() => send("approve")} className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}>
              Approve
            </button>
            <button disabled={submitting} onClick={handleReject} className={`${btnBase} bg-white text-red-600 border border-red-300 hover:bg-red-50`}>
              Reject
            </button>
          </>
        )}
        {action === "approved" && (
          <>
            <button disabled={submitting} onClick={() => send("complete")} className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}>
              Complete
            </button>
            <button disabled={submitting} onClick={handleCancel} className={`${btnBase} bg-white text-red-600 border border-red-300 hover:bg-red-50`}>
              Cancel
            </button>
          </>
        )}
      </div>
    );
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
          <>
            <button disabled={submitting} onClick={() => send("complete")} className="btn btn-primary text-sm flex-1">
              Mark Complete
            </button>
            <button disabled={submitting} onClick={handleCancel} className="btn btn-danger text-sm flex-1">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
