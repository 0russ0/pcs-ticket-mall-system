"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: number; name: string; isActive: boolean };

const BUILT_IN_CATEGORIES = ["Perseverance", "Compassion", "Self-Control"];

export default function SettingsForm({
  initialSettings,
  initialCategories,
}: {
  initialSettings: Record<string, string>;
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [maxPerDay, setMaxPerDay] = useState(initialSettings.max_points_per_day ?? "0");
  const [expirationDays, setExpirationDays] = useState(initialSettings.point_expiration_days ?? "0");
  const [allowNegative, setAllowNegative] = useState(initialSettings.allow_negative_points === "true");
  const [storeOpen, setStoreOpen] = useState(initialSettings.store_status !== "closed");
  const [categories, setCategories] = useState(initialCategories);
  const [newCategory, setNewCategory] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function save(payload: object) {
    setSubmitting(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    await save({
      settings: {
        max_points_per_day: maxPerDay,
        point_expiration_days: expirationDays,
        allow_negative_points: String(allowNegative),
        store_status: storeOpen ? "open" : "closed",
      },
    });
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    await save({ newCategory: newCategory.trim() });
    setCategories((prev) => [...prev, { id: Date.now(), name: newCategory.trim(), isActive: true }]);
    setNewCategory("");
  }

  async function toggleCategory(cat: Category) {
    await save({ categoryToggle: { id: cat.id, isActive: !cat.isActive } });
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c)));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSaveSettings} className="card space-y-4">
        {saved && <div className="rounded-md p-3 text-sm bg-green-50 text-green-800">Settings saved.</div>}

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Store Status</label>
          <button
            type="button"
            onClick={() => setStoreOpen((v) => !v)}
            className={`btn ${storeOpen ? "btn-primary" : "btn-danger"} text-sm`}
          >
            {storeOpen ? "Open" : "Closed"}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Max Points per Student per Day</label>
          <input className="input" type="number" min={0} value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Point Expiration (days)</label>
          <input className="input" type="number" min={0} value={expirationDays} onChange={(e) => setExpirationDays(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">0 = no expiration</p>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="allowNeg" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} className="h-5 w-5" />
          <label htmlFor="allowNeg" className="text-sm">Allow staff to award negative points</label>
        </div>

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <div className="card space-y-3">
        <h2 className="font-bold">Point Categories</h2>
        <ul className="divide-y">
          {categories.map((c) => (
            <li key={c.id} className="py-2 flex items-center justify-between">
              <span>{c.name} {BUILT_IN_CATEGORIES.includes(c.name) && <span className="text-xs text-gray-400">(built-in)</span>}</span>
              <button
                onClick={() => toggleCategory(c)}
                disabled={BUILT_IN_CATEGORIES.includes(c.name)}
                className={`badge ${c.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"} ${BUILT_IN_CATEGORIES.includes(c.name) ? "opacity-60" : "cursor-pointer"}`}
              >
                {c.isActive ? "Active" : "Inactive"}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="input" placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <button onClick={handleAddCategory} className="btn btn-secondary">Add</button>
        </div>
      </div>
    </div>
  );
}
