import type { HotEntryView } from "@aihot/contracts/site";

/** Change against six hours before the ranking: up in the hot tone, down quiet, new stories marked new, none while sources are behind. */
export function Delta({ trend, pct, className = "" }: { trend: HotEntryView["trend"]; pct: number | null; className?: string }) {
  const base = `inline-flex h-[22px] shrink-0 items-center gap-0.5 rounded-full px-2 text-[11.5px] font-medium tabular-nums ${className}`;
  if (trend === "unknown") return <span className={`${base} bg-bg-sunk text-ink-4 dark:bg-bg-muted/60`} title="一部の情報源の収集が遅れているため、6 時間前とはまだ比べません">比較なし</span>;
  if (trend === "new" || pct === null) return <span className={`${base} bg-accent-soft text-accent`}>新登場</span>;
  if (trend === "flat") return <span className={`${base} bg-bg-sunk text-ink-4 dark:bg-bg-muted/60`} title="6 時間前と比べて">横ばい</span>;
  const up = trend === "up";
  return (
    <span className={`${base} ${up ? "bg-hot-soft text-hot" : "bg-bg-sunk text-ink-4 dark:bg-bg-muted/60"}`} title="6 時間前と比べて">
      {up ? "↑" : "↓"} {Math.abs(Math.round(pct))}%
    </span>
  );
}
