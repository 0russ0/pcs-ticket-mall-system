"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Product = {
  id: number;
  name: string;
  category: string;
  pointsCost: number;
  inventoryLimit: number | null;
  inventoryAvailable: number | null;
  isActive: boolean;
};

export default function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Deactivate "${product.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-2 font-medium">{product.name}</td>
      <td className="py-2 pr-2">{product.category.replace("_", " ")}</td>
      <td className="py-2 pr-2">{product.pointsCost}</td>
      <td className="py-2 pr-2">
        {product.inventoryLimit === null ? "Unlimited" : `${product.inventoryAvailable}/${product.inventoryLimit}`}
      </td>
      <td className="py-2 pr-2">
        <span className={`badge ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
          {product.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="py-2 pr-2 flex gap-2">
        <Link href={`/admin/products/${product.id}`} className="text-blue-600 font-medium">Edit</Link>
        {product.isActive && (
          <button onClick={handleDelete} disabled={busy} className="text-red-600 font-medium">
            Deactivate
          </button>
        )}
      </td>
    </tr>
  );
}
