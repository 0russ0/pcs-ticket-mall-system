"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Recipient = { id: number; email: string };

export default function DigestRecipientsForm({
  initialRecipients,
}: {
  initialRecipients: Recipient[];
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState(initialRecipients);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/digest-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add recipient.");
      } else {
        setRecipients((prev) => [...prev, { id: data.id, email: data.email }]);
        setNewEmail("");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: number) {
    setSubmitting(true);
    try {
      await fetch(`/api/digest-recipients/${id}`, { method: "DELETE" });
      setRecipients((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-bold">Daily Digest Recipients</h2>
        <p className="text-xs text-gray-500 mt-1">
          Emails sent weekdays at 7:30 AM and 2:00 PM ET with new mall requests and outstanding orders.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {recipients.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No recipients yet.</p>
      ) : (
        <ul className="divide-y">
          {recipients.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between">
              <span className="text-sm">{r.email}</span>
              <button
                onClick={() => handleRemove(r.id)}
                disabled={submitting}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          type="email"
          placeholder="admin@providentcharterschool.org"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={submitting}
          className="btn btn-secondary"
        >
          Add
        </button>
      </div>
    </div>
  );
}
