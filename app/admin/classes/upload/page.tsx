"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

export default function ClassUploadPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [clearExisting, setClearExisting] = useState(false);
  const [result, setResult] = useState<{ enrolled: number; skipped: number; errors: string[] } | null>(null);
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
    if (clearExisting && !window.confirm("This will clear ALL class enrollments for this school before importing. Continue?")) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/classes/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, clearExisting }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Import Class Enrollments</h1>

      <div className="card space-y-3">
        <p className="text-sm text-gray-600">
          Upload a &ldquo;Section Enrollment Report&rdquo; CSV exported from PowerSchool. Either of the two column layouts below is accepted — no need to edit headers. Import students first if you haven&apos;t already.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto space-y-1">
          <p>Course Name,Course Number,Section Number,Lastfirst,Teacher Email,Termid,Stud Lastfirst,Student Number,Grade,House</p>
          <p className="text-gray-400">— or (older export) —</p>
          <p>Course Name,Lastfirst,Teacher Email,Stud Lastfirst,First Name,Last Name,Name,Abbreviation,Expression,Grade,Course Number</p>
        </div>
        <ul className="text-xs text-gray-500 list-disc pl-5 space-y-1">
          <li><strong>Student Number</strong> — matched against each student&apos;s existing ID in the system when present (most reliable). Falls back to First/Last Name (from &ldquo;Stud Lastfirst&rdquo; or separate columns) with Grade as a tiebreaker for exports without a student ID. Ambiguous name matches are skipped and listed as errors.</li>
          <li><strong>Course Name</strong> — the class (e.g. 7 MATH). A homeroom row (e.g. &ldquo;2 HOMEROOM&rdquo;) is imported the same as any other class.</li>
          <li><strong>Teacher Email</strong> — if this email is new to the system, a teacher account is created automatically so they can sign in right away. Two teachers listed for the same course+section (co-teachers) each get their own copy of the class with the identical student roster.</li>
          <li><strong>Section Number / Abbreviation</strong> — distinguishes two sections of the same course taught by the same teacher</li>
          <li><strong>House</strong> — not used by this import; house assignments are managed separately</li>
        </ul>

        <input type="file" accept=".csv" onChange={handleFile} />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="clear"
            checked={clearExisting}
            onChange={(e) => setClearExisting(e.target.checked)}
            className="h-5 w-5"
          />
          <label htmlFor="clear" className="text-sm text-red-600">
            Clear all existing class enrollments before import (use at start of new year)
          </label>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-bold mb-2">Preview (first 5 rows)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {Object.keys(preview[0]).map((k) => (
                  <th key={k} className="text-left pr-3 border-b py-1">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="pr-3 py-1">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleUpload} disabled={submitting} className="btn btn-primary mt-3">
            {submitting ? "Importing..." : "Confirm Import"}
          </button>
        </div>
      )}

      {result && (
        <div className="card space-y-2">
          <p className="font-bold text-green-700">
            {result.enrolled} enrollments created. {result.skipped} skipped (already enrolled or not found).
          </p>
          {result.errors.length > 0 && (
            <div>
              <p className="font-bold text-red-700">{result.errors.length} errors:</p>
              <ul className="text-sm text-red-600 list-disc pl-5 max-h-60 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
