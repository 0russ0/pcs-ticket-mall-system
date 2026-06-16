"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

export default function ProductUploadPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      setCsvText(text);
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      setPreview(parsed.data.slice(0, 5));
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/products/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok && data.created > 0) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Bulk Upload Products</h1>
      <div className="card space-y-3">
        <p className="text-sm text-gray-600">
          CSV columns: <code>name,description,points_cost,category,inventory_limit</code>.
          Category must be one of <code>physical_item</code>, <code>experience</code>, <code>privilege</code>.
          Use <code>unlimited</code> for no inventory limit.
        </p>
        <input type="file" accept=".csv" onChange={handleFile} />
      </div>

      {preview.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-bold mb-2">Preview (first 5 rows)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {Object.keys(preview[0]).map((k) => (
                  <th key={k} className="text-left pr-2 border-b py-1">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="pr-2 py-1">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleUpload} disabled={submitting} className="btn btn-primary mt-3">
            {submitting ? "Uploading..." : "Confirm Upload"}
          </button>
        </div>
      )}

      {result && (
        <div className="card space-y-2">
          <p className="font-bold text-green-700">{result.created} products created.</p>
          {result.errors.length > 0 && (
            <div>
              <p className="font-bold text-red-700">{result.errors.length} errors:</p>
              <ul className="text-sm text-red-600 list-disc pl-5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
