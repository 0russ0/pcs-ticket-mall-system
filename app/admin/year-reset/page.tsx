"use client";

import { useState } from "react";
import Papa from "papaparse";

type Result = { students: number; staff: number; warnings: string[] };

export default function YearResetPage() {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ students: number; teachers: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    setConfirmed(false);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      setCsvText(text);

      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const uniqueStudents = new Set(parsed.data.map((r) => r["Student Number"]?.trim()).filter(Boolean));
      const uniqueTeachers = new Set(parsed.data.map((r) => r["Teacher Email"]?.trim().toLowerCase()).filter(Boolean));
      setPreview({ students: uniqueStudents.size, teachers: uniqueTeachers.size });
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvText) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/year-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {};
      try { data = await res.json(); } catch { /* empty body */ }
      if (!res.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(msg || `Server error ${res.status}`);
      } else {
        setResult(data as Result);
        setCsvText("");
        setFileName("");
        setPreview(null);
        setConfirmed(false);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Year Reset</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Import a PowerSchool &ldquo;Section Enrollment with Houses&rdquo; CSV to replace all students and teachers for the new school year.
          Admin accounts are never touched.
        </p>
      </div>

      <div className="card border-red-100 bg-red-50 space-y-2">
        <p className="font-bold text-red-700">This action will permanently:</p>
        <ul className="text-sm text-red-700 space-y-1 list-disc pl-5">
          <li>Delete all current students and reset all point balances to zero</li>
          <li>Delete all point awards, orders, Golden Bulldogs, and campaign history</li>
          <li>Delete all teacher accounts and recreate them from the CSV</li>
          <li>Admin accounts are <strong>not</strong> affected</li>
        </ul>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PowerSchool CSV (Section Enrollment with Houses)
          </label>
          <input type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm" />
          {fileName && <p className="text-xs text-gray-500 mt-1">Selected: {fileName}</p>}
        </div>

        {preview && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm space-y-1">
            <p className="font-bold text-blue-800">File preview</p>
            <p className="text-blue-700">{preview.students} unique students found</p>
            <p className="text-blue-700">{preview.teachers} unique teachers found</p>
            <p className="text-blue-600 text-xs">Students with NO HOUSE will be imported as Unassigned and excluded from house leaderboards.</p>
          </div>
        )}

        {preview && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-600"
            />
            <span className="text-sm text-red-700 font-medium">
              I understand this will delete all existing student and teacher data and cannot be undone.
            </span>
          </label>
        )}

        {preview && (
          <button
            onClick={handleImport}
            disabled={!confirmed || submitting}
            className="btn w-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Importing — please wait…" : `Import ${preview.students} students & ${preview.teachers} teachers`}
          </button>
        )}
      </div>

      {error && (
        <div className="card bg-red-50 border border-red-200">
          <p className="font-bold text-red-700">Import failed</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      )}

      {result && (
        <div className="card space-y-3">
          <p className="font-bold text-green-700 text-lg">
            ✓ Import complete
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.students}</p>
              <p className="text-sm text-green-600">Students imported</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{result.staff}</p>
              <p className="text-sm text-blue-600">Teachers created</p>
            </div>
          </div>
          {result.warnings.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-700 mb-1">{result.warnings.length} notice{result.warnings.length !== 1 ? "s" : ""}:</p>
              <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5 max-h-48 overflow-y-auto">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
