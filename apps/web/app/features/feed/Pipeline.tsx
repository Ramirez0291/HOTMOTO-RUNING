// The head of the 厳選 page: how the site's models turn the day's flow of reports into the few worth
// reading — collected, screened and scored, written up and grouped, selected — with the last 24 hours'
// numbers (/api/site/stats). Desktop: four stages pressed into a raised panel, a light running between
// them. Phones: one compact row, so the feed still starts on the first screen.
import type { ComponentType, ReactNode } from "react";
import type { SiteStats } from "@hotmoto/contracts/site";
import { ITEM_COPY, REPORTS, SITE } from "@hotmoto/site";
import { IconBolt, IconChevronRight, IconDoc, IconRss, IconSparkles } from "../../components/icons";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface Stage {
  no: string;
  title: string;
  icon: Icon;
  /** A figure from the stats; stages without one (or without stats) describe themselves instead. */
  figure: string | null;
  text: ReactNode;
  /** The last stage is the outcome: its disc is drawn in the accent. */
  outcome?: boolean;
}

const count = (n: number) => n.toLocaleString("en-US");

/** The share of the day's reports that made the selection, as "4.2%" (none when nothing was collected). */
function passRate(stats: SiteStats): string | null {
  if (stats.day.collected <= 0) return null;
  const pct = (stats.day.selected / stats.day.collected) * 100;
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

function stagesOf(stats: SiteStats | null): Stage[] {
  const rate = stats && passRate(stats);
  return [
    {
      no: "01",
      title: "収集",
      icon: IconRss,
      figure: stats && count(stats.day.collected),
      text: stats ? `${count(stats.sources)}${REPORTS.metricUnits.sourcesCount}を巡回` : "情報源を巡回し、新しい記事を集める",
    },
    {
      no: "02",
      title: "AI 選別・採点",
      icon: IconSparkles,
      figure: null,
      text: "業界との関連と情報の実質を見極め、独立に 2 回採点する",
    },
    {
      no: "03",
      title: "AI 執筆・統合",
      icon: IconDoc,
      figure: null,
      text: `要約と${ITEM_COPY.reasonLabel}を書き、同じ出来事の報道を一つにまとめる`,
    },
    {
      no: "04",
      title: "厳選",
      icon: IconBolt,
      figure: stats && count(stats.day.selected),
      text: rate ? `通過率 ${rate}` : "基準を超えたものだけが厳選に",
      outcome: true,
    },
  ];
}

/** The groove between two stages (from xl), with a light that runs along it (gone under reduced motion). */
function Flow({ delay }: { delay: number }) {
  return (
    <span aria-hidden="true" className="relative mx-1 hidden h-1.5 w-7 self-center overflow-hidden rounded-full shadow-[var(--shadow-inset-sm)] xl:block xl:w-9">
      <span
        className="absolute inset-y-0 w-3 rounded-full bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]"
        style={{ animation: `hotmoto-flow 2.4s ${delay}s cubic-bezier(0.45, 0, 0.55, 1) infinite` }}
      />
    </span>
  );
}

function Disc({ icon: Icon, outcome = false, size = "md" }: { icon: Icon; outcome?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full ${size === "md" ? "size-10" : "size-8"} ${
        outcome ? "neu-primary" : "bg-surface text-accent shadow-[var(--shadow-soft)]"
      }`}
    >
      <Icon size={size === "md" ? 18 : 15} strokeWidth={1.9} />
    </span>
  );
}

export function PipelineHero({ stats, title }: { stats: SiteStats | null; title: string }) {
  const stages = stagesOf(stats);
  return (
    <section aria-labelledby="pipeline-title" className="hidden lg:block">
      <div className="card relative mb-6 overflow-hidden bg-[radial-gradient(70%_120%_at_100%_0%,var(--accent-soft),transparent_65%)] px-6 pb-5 pt-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-accent shadow-[var(--shadow-inset-sm)]">
              <IconSparkles size={13} strokeWidth={2} />
              AI が集めて、選んで、まとめる
            </div>
            <h1 id="pipeline-title" className="mt-3 text-[26px] font-bold leading-[1.3] tracking-[-0.01em] text-ink">
              {title}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-3">{SITE.tagline}</p>
          </div>
          {stats && (
            <span className="mt-1 inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-surface px-3.5 text-[12px] text-ink-3 shadow-[var(--shadow-thumb)]">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-ok" />
              </span>
              過去 24 時間
            </span>
          )}
        </div>
        <ol className="mt-5 flex items-stretch gap-3 xl:gap-0">
          {stages.map((s, i) => (
            <li key={s.no} className="flex min-w-0 flex-1 items-stretch">
              {i > 0 && <Flow delay={(i - 1) * 0.8} />}
              <div className="well flex min-w-0 flex-1 flex-col gap-2 rounded-tile px-3.5 pb-3 pt-3">
                <div className="flex items-center gap-2.5">
                  <Disc icon={s.icon} outcome={s.outcome} />
                  <div className="min-w-0 leading-tight">
                    <div className="mono text-[11px] text-ink-4">{s.no}</div>
                    <div className="truncate text-[13px] font-semibold text-ink-2">{s.title}</div>
                  </div>
                  {s.figure !== null && (
                    <div className="ml-auto flex shrink-0 items-baseline gap-1">
                      <span className="num text-[22px] font-black leading-none tracking-[-0.02em] text-ink">{s.figure}</span>
                      <span className="text-[12px] text-ink-3">件</span>
                    </div>
                  )}
                </div>
                <p className="text-[12px] leading-[1.6] text-ink-3">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Phones: the day's flow in one row — collected, the models' work, selected. Shown only with stats. */
export function PipelineStrip({ stats }: { stats: SiteStats | null }) {
  if (!stats) return null;
  const rate = passRate(stats);
  return (
    <section aria-label="過去 24 時間の AI 厳選" className="card mb-4 mt-1 grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-1 px-3 py-2.5 lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Disc icon={IconRss} size="sm" />
        <div className="min-w-0 leading-tight">
          <div className="num text-[15px] font-black text-ink">{count(stats.day.collected)}</div>
          <div className="truncate text-[11px] text-ink-4">24h 収集</div>
        </div>
      </div>
      <IconChevronRight size={14} className="text-lavender" aria-hidden="true" />
      <div className="flex items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11.5px] font-semibold text-accent shadow-[var(--shadow-inset-sm)]">
        <IconSparkles size={13} strokeWidth={2} className="shrink-0" />
        AI 採点
      </div>
      <IconChevronRight size={14} className="text-lavender" aria-hidden="true" />
      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="min-w-0 text-right leading-tight">
          <div className="num text-[15px] font-black text-ink">{count(stats.day.selected)}</div>
          <div className="truncate text-[11px] text-ink-4">{rate ? `厳選 ${rate}` : "厳選"}</div>
        </div>
        <Disc icon={IconBolt} size="sm" outcome />
      </div>
    </section>
  );
}
