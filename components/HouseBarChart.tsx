import { houseBadgeUrl } from "@/lib/houseLogos";

type Row = { team: string; points: number; color: string; subtitle?: string };

export default function HouseBarChart({ rows, myTeam }: { rows: Row[]; myTeam?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.points));

  return (
    <div className="space-y-4">
      {rows.map((r, i) => {
        const pct = Math.max(3, Math.round((r.points / max) * 100));
        const badge = houseBadgeUrl(r.team);
        return (
          <div key={r.team}>
            <div className="flex items-center gap-4 mb-1">
              {badge && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={badge} alt="" className="w-24 h-24 rounded-full shrink-0" />
              )}
              <div className="flex items-baseline justify-between gap-2 flex-1 min-w-0">
                <span className="font-bold text-lg truncate">
                  <span className="text-gray-400 font-normal mr-1">#{i + 1}</span>
                  {r.team}
                  {myTeam === r.team && <span className="badge bg-blue-100 text-blue-800 ml-1.5">My Team</span>}
                  {r.subtitle && <span className="text-gray-400 font-normal text-sm ml-1.5">{r.subtitle}</span>}
                </span>
                <span className="font-bold text-lg shrink-0">{r.points} pts</span>
              </div>
            </div>
            <div className="w-full h-7 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: r.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
