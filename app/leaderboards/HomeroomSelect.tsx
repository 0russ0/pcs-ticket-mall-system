"use client";

import { useRouter } from "next/navigation";

export default function HomeroomSelect({ homerooms, selected }: { homerooms: string[]; selected?: string }) {
  const router = useRouter();

  return (
    <select
      className="input"
      defaultValue={selected}
      onChange={(e) => router.push(`/leaderboards?type=homeroom&homeroom=${encodeURIComponent(e.target.value)}`)}
    >
      {homerooms.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
