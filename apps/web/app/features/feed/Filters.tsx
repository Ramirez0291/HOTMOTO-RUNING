// Feed filters: the channel and category choice (a row of tabs on desktop, a sheet behind the bar's filter
// button on phones), すべて's AI score floor, the phone bar of 厳選 and すべて, and search.
import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import { CATEGORY_KEYS, CATEGORY_LABELS, CHANNEL_LABELS, type CategoryKey, type ChannelKey } from "@hotmoto/contracts/taxonomy";
import { ITEM_COPY, SITE } from "@hotmoto/site";
import { scoreParam } from "../../lib/seo";
import { IconCheck, IconClose, IconFilter, IconSearch } from "../../components/icons";
import { PillTabs } from "../../components/ui/Tabs";
import { Sheet } from "../../components/ui/Sheet";
import { Wordmark } from "@hotmoto/site/brand/Logo.tsx";
import { BarButton, PhoneBar } from "../../components/shell/PhoneBar";
import { openSearch } from "../search/SearchOverlay";

/** Same page with some query parameters changed (paging state dropped). */
function hrefWith(base: string, params: URLSearchParams, patch: Record<string, string | null>) {
  const sp = new URLSearchParams(params);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  sp.delete("page");
  sp.delete("cursor");
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * The feed's one filter (厳選 and すべてのニュース alike): none, 一次情報, or a category. One choice at a time: picking
 * 一次情報 clears the category and picking a category clears 一次情報. Older ニュース / X links still filter; the
 * choice then shows as none.
 */
function filterOptions(base: string, params: URLSearchParams, noneLabel: string) {
  return [
    { key: "all", label: noneLabel, to: hrefWith(base, params, { category: null, channel: null }) },
    { key: "firstParty", label: CHANNEL_LABELS.firstParty, to: hrefWith(base, params, { category: null, channel: "firstParty" }) },
    ...CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORY_LABELS[k], to: hrefWith(base, params, { category: k, channel: null }) })),
  ];
}

function filterKey(category: CategoryKey | null, channel: ChannelKey): string {
  return channel === "firstParty" ? "firstParty" : (category ?? "all");
}

/** すべて's AI score floor: every item (0) or the items scored at least so much. */
function scoreOptions(params: URLSearchParams) {
  return ITEM_COPY.poolMinScore.options.map((n) => ({ key: String(n), label: n === 0 ? "すべて" : `${n} 以上`, to: hrefWith("/all", params, { score: scoreParam(n) }) }));
}

/** Desktop: すべて's AI score floor as a small row of tabs (none where the site keeps scores from readers). */
export function ScoreTabs({ minScore, layoutId, className = "" }: { minScore: number; layoutId: string; className?: string }) {
  const [params] = useSearchParams();
  if (!ITEM_COPY.showScore) return null;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="shrink-0 text-[12px] text-ink-4">AI スコア</span>
      <PillTabs size="xs" items={scoreOptions(params)} active={String(minScore)} layoutId={layoutId} label="AI スコアで絞り込み" />
    </div>
  );
}

/** Desktop: the filter as a row of tabs beside the search field. */
export function CategoryTabs({ base, category, channel = "all", layoutId, className = "" }: { base: string; category: CategoryKey | null; channel?: ChannelKey; layoutId: string; className?: string }) {
  const [params] = useSearchParams();
  return <PillTabs items={filterOptions(base, params, "すべて")} active={filterKey(category, channel)} layoutId={layoutId} label="絞り込み" className={className} />;
}

/**
 * The phone bar of 厳選 and すべて: the brand, the 厳選 | すべて switch (a filter in use carries over; the score
 * floor is すべて's own), and buttons for the filter sheet and search.
 */
export function FeedBar({ base, category, channel, minScore }: { base: "/" | "/all"; category: CategoryKey | null; channel: ChannelKey; minScore?: number }) {
  const [params] = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const scope = (to: string) => hrefWith(to, params, { q: null, tab: null, search: null, ...(to === "/" ? { score: null } : {}) });
  const filtered = filterKey(category, channel) !== "all" || (minScore !== undefined && ITEM_COPY.showScore && scoreParam(minScore) !== null);
  return (
    <>
      <PhoneBar
        leading={
          <Link to="/" aria-label={`${SITE.name} トップ`} className="flex h-11 items-center pl-2.5 pr-2 text-ink">
            <Wordmark size={17} />
          </Link>
        }
        center={
          <PillTabs
            size="sm"
            layoutId="feed-scope"
            label="厳選かすべてを見る"
            active={base === "/" ? "featured" : "all"}
            items={[
              { key: "featured", label: "厳選", to: scope("/"), resetScroll: true },
              { key: "all", label: "すべて", to: scope("/all"), resetScroll: true },
            ]}
          />
        }
        actions={
          <>
            <BarButton label={filtered ? "絞り込み（選択中）" : "絞り込み"} on={filtered} onClick={() => setSheet(true)}>
              <IconFilter size={21} />
              {filtered && <span aria-hidden="true" className="absolute right-[9px] top-[9px] size-[7px] rounded-full bg-accent ring-2 ring-surface" />}
            </BarButton>
            <SearchButton />
          </>
        }
      />
      <FilterSheet open={sheet} onClose={() => setSheet(false)} base={base} active={filterKey(category, channel)} minScore={minScore} />
    </>
  );
}

/**
 * Phones: the filter as a sheet of options, the one in use ticked; choosing one applies it. On すべて the AI
 * score floor follows as a second list.
 */
function FilterSheet({ open, onClose, base, active, minScore }: { open: boolean; onClose: () => void; base: string; active: string; minScore?: number }) {
  const [params] = useSearchParams();
  return (
    <Sheet open={open} onClose={onClose} title="絞り込み">
      <SheetOptions options={filterOptions(base, params, "指定なし")} active={active} onClose={onClose} />
      {minScore !== undefined && ITEM_COPY.showScore && (
        <>
          <h3 className="mx-4 pb-1 pt-5 text-[13px] font-semibold text-ink-3">AI スコア</h3>
          <SheetOptions options={scoreOptions(params)} active={String(minScore)} onClose={onClose} />
        </>
      )}
    </Sheet>
  );
}

function SheetOptions({ options, active, onClose }: { options: Array<{ key: string; label: string; to: string }>; active: string; onClose: () => void }) {
  return (
    <ul className="mx-4 divide-y divide-line-soft">
      {options.map((o) => {
        const on = o.key === active;
        return (
          <li key={o.key}>
            <Link
              to={o.to}
              onClick={onClose}
              aria-current={on ? "true" : undefined}
              className={`-mx-2 flex h-12 items-center justify-between rounded-tile px-2 text-[16px] transition-colors active:bg-bg-sunk ${on ? "font-semibold text-accent" : "text-ink"}`}
            >
              {o.label}
              {on && <IconCheck size={19} strokeWidth={2.2} />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Phones: the filter, the tag and a score floor other than the site's as chips under the bar; each one clears
 * itself when tapped (the floor goes back to the site's).
 */
export function ActiveFilters({ base, category, channel, tag, minScore }: { base: string; category: CategoryKey | null; channel: ChannelKey; tag: string | null; minScore?: number }) {
  const [params] = useSearchParams();
  const label = channel === "firstParty" ? CHANNEL_LABELS.firstParty : category ? CATEGORY_LABELS[category] : null;
  const score = minScore !== undefined && ITEM_COPY.showScore && scoreParam(minScore) !== null ? (minScore === 0 ? "AI スコア：すべて" : `AI スコア ${minScore} 以上`) : null;
  if (!label && !tag && !score) return null;
  const chip = "neu-inset inline-flex min-h-11 max-w-full items-center gap-1 rounded-full pl-3.5 pr-2.5 text-[13px] font-medium text-accent transition-opacity active:opacity-60";
  return (
    <div className="flex flex-wrap gap-2 pb-3 pt-1 lg:hidden">
      {label && (
        <Link to={hrefWith(base, params, { category: null, channel: null })} aria-label={`絞り込みを解除：${label}`} className={chip}>
          {label}だけ
          <IconClose size={14} strokeWidth={2} />
        </Link>
      )}
      {tag && (
        <Link to={hrefWith(base, params, { tag: null })} aria-label={`タグを解除：${tag}`} className={chip}>
          <span className="truncate">#{tag}</span>
          <IconClose size={14} strokeWidth={2} className="shrink-0" />
        </Link>
      )}
      {score && (
        <Link to={hrefWith(base, params, { score: null })} aria-label={`既定のスコアに戻す：${score}`} className={chip}>
          {score}
          <IconClose size={14} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

/** Phones: the magnifier in a bar; the search opens over the page with the keyboard up. */
function SearchButton() {
  return (
    <BarButton label="検索" onClick={(event) => openSearch("", event.currentTarget)}>
      <IconSearch size={21} />
    </BarButton>
  );
}

function useSlashFocus(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);
}

/** Desktop search field (GET /all?q=…): at the end of the filter row, pressed in like the tabs' track, with a "/" hint. */
export function SearchField({ defaultValue = "", keep = {} }: { defaultValue?: string; keep?: Record<string, string | null> }) {
  const [value, setValue] = useState(defaultValue);
  const navigation = useNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(defaultValue), [defaultValue]);
  useSlashFocus(inputRef);
  const searching = navigation.state === "loading" && navigation.location?.pathname === "/all" && !!new URLSearchParams(navigation.location.search).get("q");
  const hidden = Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null));

  return (
    <Form method="get" action="/all" role="search" className="group relative w-full shrink-0 lg:w-60">
      {hidden}
      <label htmlFor="site-search" className="sr-only">
        タイトル・要約・本文を検索
      </label>
      <IconSearch size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searching ? "text-accent" : "text-ink-4 group-focus-within:text-ink-3"}`} />
      <input
        ref={inputRef}
        id="site-search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="タイトル・要約を検索…"
        maxLength={200}
        autoComplete="off"
        className="neu-inset h-[44px] w-full rounded-full pl-10 pr-10 text-[14px] text-ink outline-none transition-shadow placeholder:text-ink-4 focus:shadow-[var(--shadow-inset),0_0_0_2px_var(--accent)]"
      />
      {value ? (
        <button
          type="button"
          aria-label="クリア"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink-4 shadow-[var(--shadow-thumb)] transition-colors hover:text-ink"
        >
          <IconClose size={13} />
        </button>
      ) : (
        <kbd className="mono pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-mark bg-surface px-1.5 text-[10.5px] leading-4 text-ink-4 shadow-[var(--shadow-thumb)] lg:block">/</kbd>
      )}
    </Form>
  );
}
