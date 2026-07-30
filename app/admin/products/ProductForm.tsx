"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { proxiedImageUrl } from "@/lib/image";

type AudienceFilter =
  | { type: "grade_band"; value: "2-5" | "6-8" }
  | { type: "grades"; values: string[] }
  | { type: "homerooms"; values: string[] }
  | { type: "houses"; values: string[] };

type Product = {
  id?: number;
  name: string;
  description: string | null;
  pointsCost: number;
  category: string;
  inventoryLimit: number | null;
  imageUrl: string | null;
  isActive: boolean;
  audienceFilter?: AudienceFilter | null;
};

const ALL_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
const ALL_HOUSES = ["Rachel Carson House", "Clemente House", "Hot Metal House", "Liberty House"];

type AudienceType = "all" | "grade_band_2-5" | "grade_band_6-8" | "grade" | "homeroom" | "house";

function filterToType(f: AudienceFilter | null | undefined): AudienceType {
  if (!f) return "all";
  if (f.type === "grade_band") return f.value === "2-5" ? "grade_band_2-5" : "grade_band_6-8";
  if (f.type === "grades") return "grade";
  if (f.type === "homerooms") return "homeroom";
  if (f.type === "houses") return "house";
  return "all";
}

function filterToValues(f: AudienceFilter | null | undefined): string[] {
  if (!f) return [];
  if (f.type === "grades") return f.values;
  if (f.type === "homerooms") return f.values;
  if (f.type === "houses") return f.values;
  return [];
}

export default function ProductForm({
  product,
  homerooms = [],
}: {
  product?: Product;
  homerooms?: string[];
}) {
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

  const [audienceType, setAudienceType] = useState<AudienceType>(filterToType(product?.audienceFilter));
  const [audienceValues, setAudienceValues] = useState<string[]>(filterToValues(product?.audienceFilter));

  function buildAudienceFilter(): AudienceFilter | null {
    if (audienceType === "all") return null;
    if (audienceType === "grade_band_2-5") return { type: "grade_band", value: "2-5" };
    if (audienceType === "grade_band_6-8") return { type: "grade_band", value: "6-8" };
    if (audienceType === "grade") return { type: "grades", values: audienceValues };
    if (audienceType === "homeroom") return { type: "homerooms", values: audienceValues };
    if (audienceType === "house") return { type: "houses", values: audienceValues };
    return null;
  }

  function toggleValue(v: string) {
    setAudienceValues((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

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
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
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
      audience_filter: buildAudienceFilter(),
    };

    try {
      const res = await fetch(product?.id ? `/api/products/${product.id}` : "/api/products", {
        method: product?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      router.push("/admin/products");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const needsValuePicker = audienceType === "grade" || audienceType === "homeroom" || audienceType === "house";
  const valuePicker =
    audienceType === "grade" ? ALL_GRADES :
    audienceType === "homeroom" ? homerooms :
    audienceType === "house" ? ALL_HOUSES : [];

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
          <input className="input" type="number" min={1} value={pointsCost} onChange={(e) => setPointsCost(Number(e.target.value))} required />
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
          <input type="checkbox" checked={inventoryLimit === "unlimited"} onChange={(e) => setInventoryLimit(e.target.checked ? "unlimited" : "10")} className="h-5 w-5" id="unlimited" />
          <label htmlFor="unlimited" className="text-sm">Unlimited</label>
          {inventoryLimit !== "unlimited" && (
            <input className="input" type="number" min={0} value={inventoryLimit} onChange={(e) => setInventoryLimit(e.target.value)} />
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

      {/* Audience targeting */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Available To</p>
        <div className="space-y-2">
          {[
            { value: "all", label: "All Students" },
            { value: "grade_band_2-5", label: "Grades 2–5" },
            { value: "grade_band_6-8", label: "Grades 6–8" },
            { value: "grade", label: "Specific Grade(s)" },
            { value: "homeroom", label: "Specific Homeroom(s)" },
            { value: "house", label: "Specific House Team(s)" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="audienceType"
                value={opt.value}
                checked={audienceType === opt.value}
                onChange={() => { setAudienceType(opt.value as AudienceType); setAudienceValues([]); }}
                className="h-4 w-4"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>

        {needsValuePicker && (
          <div className="pl-6 space-y-1">
            <p className="text-xs text-gray-500 mb-2">Select one or more:</p>
            {valuePicker.map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={audienceValues.includes(v)}
                  onChange={() => toggleValue(v)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{v}</span>
              </label>
            ))}
          </div>
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
