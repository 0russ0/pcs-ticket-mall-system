"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { proxiedImageUrl } from "@/lib/image";

type Product = {
  id?: number;
  name: string;
  description: string | null;
  pointsCost: number;
  category: string;
  inventoryLimit: number | null;
  imageUrl: string | null;
  isActive: boolean;
};

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [pointsCost, setPointsCost] = useState(product?.pointsCost ?? 50);
  const [category, setCategory] = useState(product?.category ?? "physical_item");
  const [inventoryLimit, setInventoryLimit] = useState(
    product?.inventoryLimit === null || product?.inventoryLimit === undefined
      ? "unlimited"
      : String(product.inventoryLimit)
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setImageUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      description,
      points_cost: pointsCost,
      category,
      inventory_limit: inventoryLimit === "unlimited" ? "unlimited" : Number(inventoryLimit),
      image_url: imageUrl,
      is_active: isActive,
    };

    try {
      const res = await fetch(product?.id ? `/api/products/${product.id}` : "/api/products", {
        method: product?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && <div className="rounded-md p-3 text-sm bg-red-50 text-red-800">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea className="input" rows={3} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Points Cost</label>
          <input
            className="input"
            type="number"
            min={1}
            value={pointsCost}
            onChange={(e) => setPointsCost(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="physical_item">Physical Item</option>
            <option value="experience">Experience</option>
            <option value="privilege">Privilege</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Inventory Limit</label>
        <div className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={inventoryLimit === "unlimited"}
            onChange={(e) => setInventoryLimit(e.target.checked ? "unlimited" : "10")}
            className="h-5 w-5"
            id="unlimited"
          />
          <label htmlFor="unlimited" className="text-sm">Unlimited</label>
          {inventoryLimit !== "unlimited" && (
            <input
              className="input"
              type="number"
              min={0}
              value={inventoryLimit}
              onChange={(e) => setInventoryLimit(e.target.value)}
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Image</label>
        <input type="file" accept="image/*" onChange={handleFile} className="text-sm" />
        {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxiedImageUrl(imageUrl)!} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-md" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5" />
        <label htmlFor="active" className="text-sm">Active (visible in store)</label>
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full">
        {submitting ? "Saving..." : product?.id ? "Save Changes" : "Add Product"}
      </button>
    </form>
  );
}
