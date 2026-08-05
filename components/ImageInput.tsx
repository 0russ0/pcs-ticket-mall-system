"use client";

import { useState } from "react";
import { proxiedImageUrl } from "@/lib/image";

type Props = {
  value: string;
  onChange: (url: string) => void;
};

export default function ImageInput({ value, onChange }: Props) {
  const [mode, setMode] = useState<"upload" | "url">(value && !value.startsWith("blob:") ? "url" : "upload");
  const [urlInput, setUrlInput] = useState(mode === "url" ? value : "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      onChange(data.url);
    } finally {
      setUploading(false);
    }
  }

  function handleUrlBlur() {
    const trimmed = urlInput.trim();
    onChange(trimmed);
  }

  const preview = value ? proxiedImageUrl(value) : null;

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg w-fit">
        {(["upload", "url"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === m ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m === "upload" ? "📁 Upload File" : "🔗 Image URL"}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={handleFile}
            className="text-sm"
            disabled={uploading}
          />
          <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF, WebP, SVG</p>
          {uploading && <p className="text-xs text-gray-500 mt-1">Uploading…</p>}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      )}

      {mode === "url" && (
        <div>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://example.com/image.png"
            className="input text-sm"
          />
          <p className="text-xs text-gray-400 mt-0.5">Paste any public image URL</p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border" />
          <button
            type="button"
            onClick={() => { onChange(""); setUrlInput(""); }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
