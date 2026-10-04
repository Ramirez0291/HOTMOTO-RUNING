import { ITEM_COPY } from "@hotmoto/site";
import { IconSparkles } from "../icons";

/**
 * The AI score as a small pill pressed into the card, tinted by tier instead of drawn as a bar: strong
 * picks (85+) in warm red, solid ones (70+) in the accent, the rest as quiet text. The score itself is unchanged.
 */
const TIERS = [
  { min: 85, className: "bg-hot-soft text-hot" },
  { min: 70, className: "bg-accent-soft text-accent" },
  { min: 0, className: "text-ink-4" },
];

/** The score readers see: none when the site keeps scores from them. */
export function shownScore(score: number | null): number | null {
  return ITEM_COPY.showScore ? score : null;
}

/** "AI スコア · 88" on desktop cards; `compact` keeps only the number (phones). */
export function ScoreLabel({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const shown = shownScore(score);
  if (shown === null) return null;
  const value = Math.round(shown);
  const tier = TIERS.find((t) => value >= t.min)!;
  return (
    <span
      title={`AI スコア ${value}/100`}
      aria-label={`AI スコア ${value} 点`}
      className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 shadow-[var(--shadow-inset-sm)] ${tier.className}`}
    >
      <IconSparkles size={12} strokeWidth={2} className="opacity-80" />
      {!compact && (
        <>
          <span className="text-[11px] font-medium leading-none opacity-85">AI スコア</span>
          <span className="mx-0.5 h-2.5 w-px bg-current opacity-25" aria-hidden="true" />
        </>
      )}
      <span className="mono text-[12.5px] font-bold leading-none tabular-nums">{value}</span>
    </span>
  );
}
