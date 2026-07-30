"use client";

import { useRouter } from "next/navigation";

export default function HomeroomSelect({
  homerooms,
  selected,
  band = "all",
}: {
  homerooms: string[];
  selected?: string;
  band?: string;
}) {
  const router = useRouter();

  return (
    <select
      className="input"
      defaultValue={selected}
      onChange={(e) =>
        router.push(
          `/leaderboards?type=homeroom&band=${band}&homeroom=${encodeURIComponent(e.target.value)}`
        )
      }
    >
      <option value="__all__">⭐ PCS Homeroom Leaderboard (all homerooms)</option>
      {homerooms.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
