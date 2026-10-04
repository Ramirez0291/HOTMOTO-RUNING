import { Link } from "react-router";
import type { HotStripEntry } from "@hotmoto/contracts/site";
import { IconArrowRight, IconMinus, IconTrendDown, IconTrendUp } from "../../components/icons";
import { Faces } from "../hot/Faces";

// As on the original list: the top three in the ranking colours at the heaviest weight, each on a small raised disc.
const RANK_COLOR = ["text-[13px] font-black text-rank-1", "text-[13px] font-black text-rank-2", "text-[13px] font-black text-rank-3"];

function hrefOf(e: HotStripEntry): string {
  return e.storyPublicId ? `/story/${e.storyPublicId}` : e.itemId ? `/items/${e.itemId}` : "/hot";
}

/** Where the heat is heading, as a small arrow (a "新" mark for a story new to the ranking). */
function TrendMark({ trend }: { trend: HotStripEntry["trend"] }) {
  if (trend === "up") return <IconTrendUp size={14} strokeWidth={2.2} className="text-hot" aria-label="話題度が上昇" />;
  if (trend === "down") return <IconTrendDown size={14} strokeWidth={2.2} className="text-ink-4" aria-label="話題度が低下" />;
  if (trend === "new") return <span className="rounded-full bg-accent-soft px-1.5 text-[10.5px] font-semibold leading-4 text-accent">新</span>;
  if (trend === "unknown") return null; // sources behind on collection: no comparison to show
  return <IconMinus size={14} strokeWidth={2.2} className="text-ink-4" aria-label="話題度は横ばい" />;
}

/**
 * The top of the hot ranking on the home page, kept quiet: a live dot, coloured ranks and titles, then
 * columns of fixed width so every row lines up — who is talking (main source faces, from sm), "N 話題度" and an arrow for
 * where it is heading. The whole row lights up on hover. Phones show the top three in one line each, so
 * the feed starts on the first screen.
 */
export function HotTopics({ entries }: { entries: HotStripEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section
      aria-labelledby="hot-topics"
      className="card relative mb-5 overflow-hidden bg-[radial-gradient(120%_90%_at_100%_0%,var(--hot-soft),transparent_55%)] px-3.5 pb-1.5 pt-2.5 lg:mb-7 lg:px-5 lg:pb-2.5 lg:pt-3.5"
    >
      <div className="flex items-center justify-between lg:mb-1">
        <h2 id="hot-topics" className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-hot opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-hot" />
          </span>
          いまの話題
        </h2>
        <Link to="/hot" className="group -my-2 -mr-1.5 inline-flex h-10 items-center gap-1 px-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-accent lg:my-0 lg:mr-0 lg:h-auto lg:px-0">
          ランキング全体 <IconArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ol>
        {entries.slice(0, 5).map((e, i) => (
          <li key={e.rank} className={i >= 3 ? "max-sm:hidden" : undefined}>
            <Link viewTransition
              to={hrefOf(e)}
              className="group -mx-2 grid min-h-10 sm:min-h-0 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-tile px-2 py-1.5 transition-shadow duration-200 hover:shadow-[var(--shadow-inset-sm)] active:shadow-[var(--shadow-inset-sm)] sm:grid-cols-[24px_minmax(0,1fr)_120px_64px_20px] sm:gap-x-4 sm:py-2"
            >
              <span className={`num grid size-6 place-items-center rounded-full bg-surface leading-none shadow-[var(--shadow-thumb)] ${RANK_COLOR[i] ?? "text-[13px] font-bold text-rank-rest"}`}>{e.rank}</span>
              <span className="line-clamp-1 min-w-0 text-[14.5px] font-semibold leading-[1.5] text-ink transition-colors group-hover:text-accent lg:text-[14px]">{e.title}</span>
              <span className="hidden justify-end sm:flex">
                <Faces participants={e.participants} total={e.participantCount} size={20} interactive={false} />
              </span>
              <span className="flex items-center justify-end gap-2.5 sm:contents">
                <span className="whitespace-nowrap text-right text-[12.5px] text-ink-4" title="話題度指数">
                  <span className="num text-[13.5px] font-semibold text-ink-2">{Math.round(e.heat)}</span> 話題度
                </span>
                <span className="flex w-5 justify-center">
                  <TrendMark trend={e.trend} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
