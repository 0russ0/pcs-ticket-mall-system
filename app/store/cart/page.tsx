"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { proxiedImageUrl } from "@/lib/image";

export default function CartPage() {
  const { items, removeItem, setQuantity, total, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheckout() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      clear();
      router.push("/orders?submitted=1");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Your Cart</h1>

      {error && <div className="rounded-md p-3 text-sm bg-red-50 text-red-800">{error}</div>}

      {items.length === 0 ? (
        <div className="card text-center space-y-3">
          <p className="text-gray-500">Your cart is empty.</p>
          <Link href="/store" className="btn btn-primary">Continue Shopping</Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.productId} className="card flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden shrink-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proxiedImageUrl(item.imageUrl)!} alt={item.name} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-xl">🎁</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.pointsCost} pts each</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={item.inventoryLimit ?? undefined}
                  value={item.quantity}
                  onChange={(e) => setQuantity(item.productId, Number(e.target.value))}
                  className="input w-16 text-center"
                />
                <div className="font-bold w-16 text-right">{item.pointsCost * item.quantity}</div>
                <button onClick={() => removeItem(item.productId)} className="text-red-500 text-sm font-medium">
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="card flex items-center justify-between">
            <span className="font-bold text-lg">Total</span>
            <span className="font-bold text-2xl text-blue-600">{total} pts</span>
          </div>

          <div className="flex gap-3">
            <Link href="/store" className="btn btn-secondary flex-1">Continue Shopping</Link>
            <button onClick={handleCheckout} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? "Submitting..." : "Submit Order for Approval"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
