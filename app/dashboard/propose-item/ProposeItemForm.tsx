"use client";

import { useState } from "react";
import ImageInput from "@/components/ImageInput";

const ALL_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
const ALL_HOUSES = ["Rachel Carson House", "Clemente House", "Hot Metal House", "Liberty House"];

type AudienceType = "all" | "grade_band_2-5" | "grade_band_6-8" | "grade" | "homeroom" | "house";

export default function ProposeItemForm({ homerooms }: { homerooms: string[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState(1);
  const [category, setCategory] = useState("experience");
  const [inventoryLimit, setInventoryLimit] = useState<string>("unlimited");
  const [imageUrl, setImageUrl] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [audienceValues, setAudienceValues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function buildAudienceFilter() {
    if (audienceType === "all") return null;
    if (audienceType === "grade_band_2-5") return { type: "grade_band", value: "2-5" };
    if (audienceType === "grade_band_6-8") return { type: "grade_band", value: "6-8" };
    if (audienceType === "grade") return { type: "grades", values: audienceValues };
    if (audienceType === "homeroom") return { type: "homerooms", values: audienceValues };
    if (audienceType === "house") return { type: "houses", values: audienceValues };
    return null;
  }

  function toggleValue(v: string) {
    setAudienceValues((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const needsValues = audienceType === "grade" || audienceType === "homeroom" || audienceType === "house";
    if (needsValues && audienceValues.length === 0) {
      setError("Please select at least one value for your audience filter.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/products/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          points_cost: pointsCost,
          category,
          inventory_limit: inventoryLimit === "unlimited" ? "unlimited" : Number(inventoryLimit),
          image_url: imageUrl || null,
          audience_filter: buildAudienceFilter(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Submission failed."); return; }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="card text-center space-y-3 py-10">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">Item Submitted!</h2>
        <p className="text-gray-500">Your store item proposal has been sent to the admin for review. It will appear in the mall once approved.</p>
        <button
          onClick={() => { setSuccess(false); setName(""); setDescription(""); setPointsCost(1); setCategory("experience"); setInventoryLimit("unlimited"); setImageUrl(""); setAudienceType("all"); setAudienceValues([]); }}
          className="btn btn-primary"
        >
          Submit Another
        </button>
      </div>
    );
  }

  const needsValuePicker = audienceType === "grade" || audienceType === "homeroom" || audienceType === "house";
  const valuePicker =
    audienceType === "grade" ? ALL_GRADES :
    audienceType === "homeroom" ? homerooms :
    ALL_HOUSES;

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      {error && <div className="rounded-md p-3 text-sm bg-red-50 text-red-700">{error}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Item Name <span className="text-red-500">*</span></label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Movie Day Ticket" required />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this item or experience? Any details students should know." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Points Cost <span className="text-red-500">*</span></label>
          <input className="input" type="number" min={1} value={pointsCost} onChange={(e) => setPointsCost(Number(e.target.value))} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="experience">Experience</option>
            <option value="privilege">Privilege</option>
            <option value="physical_item">Physical Item</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Number of Spots / Quantity</label>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="inv" checked={inventoryLimit === "unlimited"} onChange={() => setInventoryLimit("unlimited")} className="h-4 w-4" />
            <span className="text-sm">Unlimited</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="inv" checked={inventoryLimit !== "unlimited"} onChange={() => setInventoryLimit("30")} className="h-4 w-4" />
            <span className="text-sm">Limited:</span>
          </label>
          {inventoryLimit !== "unlimited" && (
            <input className="input w-24" type="number" min={1} value={inventoryLimit} onChange={(e) => setInventoryLimit(e.target.value)} />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Image</label>
        <ImageInput value={imageUrl} onChange={setImageUrl} />
      </div>

      {/* Audience */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold">Who is this for?</p>
        <div className="grid grid-cols-2 gap-y-2">
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
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs text-gray-500 mb-2">Select one or more:</p>
            <div className="flex flex-wrap gap-2">
              {valuePicker.map((v) => (
                <label key={v} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${audienceValues.includes(v) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>
                  <input type="checkbox" checked={audienceValues.includes(v)} onChange={() => toggleValue(v)} className="sr-only" />
                  {v}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3 text-base">
        {submitting ? "Submitting…" : "Submit for Admin Approval"}
      </button>
    </form>
  );
}
