"use client";

import { useState, useRef, useEffect } from "react";

export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  formatOption,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  formatOption?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  const display = (v: string) => (formatOption ? formatOption(v) : v);
  const buttonLabel =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
      ? display(selected[0])
      : `${selected.length} ${label} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-xs border rounded-lg px-2 py-1.5 bg-white flex items-center gap-1 whitespace-nowrap ${
          selected.length > 0 ? "border-amber-400 text-amber-700 font-medium" : "border-gray-300 text-gray-700"
        }`}
      >
        {buttonLabel}
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[170px] max-h-64 overflow-y-auto">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-amber-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="h-3.5 w-3.5 accent-amber-500" />
              {display(o)}
            </label>
          ))}
          {options.length === 0 && <p className="px-3 py-1.5 text-xs text-gray-400">No options</p>}
        </div>
      )}
    </div>
  );
}
