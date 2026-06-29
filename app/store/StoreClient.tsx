"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartContext";
import { proxiedImageUrl } from "@/lib/image";

type Product = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  category: "physical_item" | "experience" | "privilege";
  inventoryLimit: number | null;
  inventoryAvailable: number | null;
  imageUrl: string | null;
  isActive: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  physical_item: "Physical Item",
  experience: "Experience",
  privilege: "Privilege",
};

const CATEGORY_COLORS: Record<string, string> = {
  physical_item: "bg-blue-100 text-blue-800",
  experience: "bg-purple-100 text-purple-800",
  privilege: "bg-green-100 text-green-800",
};

export default function StoreClient({ studentPoints }: { studentPoints: number | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const { addItem, count, total } = useCart();
  const [added, setAdded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
  }, []);

  const filtered = filter === "all" ? products : products.filter((p) => p.category === filter);

  function handleAdd(p: Product) {
    addItem({
      productId: p.id,
      name: p.name,
      pointsCost: p.pointsCost,
      imageUrl: p.imageUrl,
      quantity: 1,
      inventoryLimit: p.inventoryLimit,
      inventoryAvailable: p.inventoryAvailable,
    });
    setAdded(p.id);
    setTimeout(() => setAdded(null), 1200);
  }

  return (
    <div className={`space-y-4 ${count > 0 ? "pb-20" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">School Store</h1>
        <Link href="/store/cart" className="btn btn-primary">
          🛒 Cart {count > 0 && `(${count})`}
        </Link>
      </div>

      {studentPoints !== null && (
        <p className="text-sm text-gray-600">
          You have <span className="font-bold">{studentPoints}</span> points to spend.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {["all", "physical_item", "experience", "privilege"].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`btn whitespace-nowrap ${filter === c ? "btn-primary" : "btn-secondary"}`}
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.map((p) => {
          const outOfStock = p.inventoryLimit !== null && (p.inventoryAvailable ?? 0) <= 0;
          return (
            <div key={p.id} className="card flex flex-col">
              <div className="w-full aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proxiedImageUrl(p.imageUrl)!} alt={p.name} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-3xl">🎁</span>
                )}
              </div>
              <span className={`badge ${CATEGORY_COLORS[p.category]} self-start mb-1`}>
                {CATEGORY_LABELS[p.category]}
              </span>
              <p className="font-semibold text-sm flex-1">{p.name}</p>
              <p className="font-bold text-blue-600 mt-1">{p.pointsCost} pts</p>
              {outOfStock ? (
                <span className="text-xs text-red-600 mt-2">Out of stock</span>
              ) : (
                <button onClick={() => handleAdd(p)} className="btn btn-secondary mt-2 text-sm">
                  {added === p.id ? "Added ✓" : "Add to Cart"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-gray-500">No items available yet.</p>}

      {count > 0 && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{count} item{count > 1 ? "s" : ""} in cart</p>
              <p className="font-bold text-lg text-blue-600">{total} pts</p>
            </div>
            <Link href="/store/cart" className="btn btn-primary">
              View Cart
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
