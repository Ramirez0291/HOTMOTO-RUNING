// Names, dates and grouping for daily, weekly and monthly reports.
import type { ReportNavigationEntry, ReportKind } from "@aihot/contracts/site";
import { siteDate, siteWeekday, isoWeekLabel, isoWeekRange } from "@aihot/contracts/time";
import { EDITION_WHEN, REPORTS, SITE, withSubject } from "@aihot/site";
import { RELEASE } from "@aihot/industry/taxonomy";
import { monthDay, weekdayShort } from "../../lib/format.ts";

export const KINDS: ReportKind[] = ["daily", "weekly", "monthly"];
export const KIND_PATH: Record<ReportKind, string> = { daily: "/daily", weekly: "/weekly", monthly: "/monthly" };
export const KIND_LABEL: Record<ReportKind, string> = { daily: "日報", weekly: "週報", monthly: "月報" };

export function kindFromPath(pathname: string): ReportKind {
  if (pathname.startsWith("/weekly")) return "weekly";
  if (pathname.startsWith("/monthly")) return "monthly";
  return "daily";
}

/** The kind's RSS feed, announced in the page head so a reader given the page finds it. */
export const feedLink = (kind: ReportKind) => ({ tagName: "link", rel: "alternate", type: "application/rss+xml", title: `${SITE.name} ${KIND_LABEL[kind]}`, href: `/feed/${kind}.xml` }) as const;

export function reportPath(kind: ReportKind, key: string): string {
  return `${KIND_PATH[kind]}/${key}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

const { measure, noun } = REPORTS.entry;
/** "件のトピック": what an issue counts its entries in, in the site's words (REPORTS.entry). */
export const ENTRIES_UNIT = `${measure}の${noun}`;

/** "この日の二輪トピック 4 件" / "今週の二輪トピック 12 件" / "8 月の二輪トピック 20 件" (the subject and REPORTS.entry from site/site.ts). */
export function headline(kind: ReportKind, key: string, count: number): string {
  if (kind === "daily") return `この日の${withSubject(noun)} ${count} ${measure}`;
  if (kind === "weekly") return `今週の${withSubject(noun)} ${count} ${measure}`;
  return `${Number(key.slice(5, 7))} 月の${withSubject(noun)} ${count} ${measure}`;
}

/** "09.16" for a story inside a week or month. */
export function shortDay(iso: string): string {
  return siteDate(iso).slice(5).replace("-", ".");
}

export interface ArchiveGroup {
  id: string;
  label: string;
  entries: Array<ReportNavigationEntry & { short: string }>;
}

/**
 * The archive column: days grouped by month, weeks by the month their Monday falls in ("第2週"),
 * months by year. Newest first, as the index comes.
 */
export function archiveGroups(kind: ReportKind, index: ReportNavigationEntry[]): ArchiveGroup[] {
  const groups: ArchiveGroup[] = [];
  const push = (id: string, label: string, e: ReportNavigationEntry & { short: string }) => {
    const g = groups[groups.length - 1];
    if (g && g.id === id) g.entries.push(e);
    else groups.push({ id, label, entries: [e] });
  };
  if (kind === "weekly") {
    const byMonth = new Map<string, string[]>();
    for (const e of index) {
      const m = isoWeekRange(e.key)!.start.slice(0, 7);
      byMonth.set(m, [...(byMonth.get(m) ?? []), e.key]);
    }
    for (const e of index) {
      const m = isoWeekRange(e.key)!.start.slice(0, 7);
      const weeks = [...byMonth.get(m)!].sort();
      push(m, `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`, { ...e, short: `第${weeks.indexOf(e.key) + 1}週` });
    }
    return groups;
  }
  for (const e of index) {
    if (kind === "daily") push(e.key.slice(0, 7), `${e.key.slice(0, 4)} 年 ${Number(e.key.slice(5, 7))} 月`, { ...e, short: `${Number(e.key.slice(8, 10))} 日` });
    else push(e.key.slice(0, 4), `${e.key.slice(0, 4)} 年`, { ...e, short: `${Number(e.key.slice(5, 7))} 月` });
  }
  return groups;
}

/** An issue's mark in the archive column: a large number over a small word (a month's number stands alone). */
export function archiveMark(kind: ReportKind, key: string): { big: string; small: string | null } {
  if (kind === "daily") return { big: key.slice(8, 10), small: weekdayShort(key) };
  if (kind === "weekly") {
    const { start } = isoWeekRange(key)!;
    return { big: key.slice(6), small: `${Number(start.slice(5, 7))}.${Number(start.slice(8, 10))}〜` };
  }
  return { big: key.slice(5, 7), small: null };
}

/** Short chip label for the phone switcher: "今日", "9月26日", "9月第2週", "8 月". */
export function chipLabel(kind: ReportKind, key: string, index: ReportNavigationEntry[], today: string): string {
  if (kind === "daily") return key === today ? "今日" : monthDay(key);
  if (kind === "monthly") return `${Number(key.slice(5, 7))} 月`;
  const group = archiveGroups("weekly", index).find((g) => g.entries.some((e) => e.key === key));
  const entry = group?.entries.find((e) => e.key === key);
  return group && entry ? `${Number(group.id.slice(5))}月${entry.short}` : key;
}

/**
 * "第 N 号": the issue's place in its series as the server counts it over every issue. The navigation
 * index holds only the newest issues, so its length cannot tell.
 */
export function issueNumber(index: ReportNavigationEntry[], key: string): number | null {
  return index.find((e) => e.key === key)?.issueNumber ?? null;
}

/** The masthead's date block: a large figure and two small lines beside it. */
export function dateMark(kind: ReportKind, key: string): { figure: string; top: string; bottom: string } {
  if (kind === "daily") return { figure: key.slice(8, 10), top: `${key.slice(0, 4)} 年 ${Number(key.slice(5, 7))} 月`, bottom: siteWeekday(key) };
  if (kind === "weekly") {
    const { start, end } = isoWeekRange(key)!;
    return { figure: key.slice(6), top: `${key.slice(0, 4)} 年 第 ${Number(key.slice(6))} 週`, bottom: `${start.slice(5).replace("-", ".")} — ${end.slice(5).replace("-", ".")}` };
  }
  return { figure: key.slice(5, 7), top: `${key.slice(0, 4)} 年`, bottom: `${Number(key.slice(5, 7))} 月` };
}

/** When each kind comes out, for the masthead (the times are the site's, EDITION_WHEN). */
export const EDITION: Record<ReportKind, string> = { daily: `${EDITION_WHEN.daily} 発行`, weekly: "毎週月曜発行", monthly: "毎月 1 日発行" };

/**
 * The masthead's figures, in the order a reader wants them, in the site's words (REPORTS). Releases of the
 * pack's headline launch kind (RELEASE, "車種の新モデル" for two-wheelers) count only where the pack has one; zero is left out.
 */
const UNITS = REPORTS.metricUnits;
const METRICS: Array<[key: string, unit: string]> = [
  ["totalEvents", ENTRIES_UNIT],
  ["totalStories", ENTRIES_UNIT],
  ["sourcesCount", UNITS.sourcesCount],
  ["firstPartyEvents", UNITS.firstPartyEvents],
  ...(RELEASE ? [["modelsReleased", RELEASE.unit] as [string, string]] : []),
  ["selectedCount", UNITS.selectedCount],
  ["reportsCovered", UNITS.reportsCovered],
];
export function metricItems(metrics: Record<string, number>): Array<{ value: number; unit: string }> {
  return METRICS.filter(([k]) => typeof metrics[k] === "number" && (k !== "modelsReleased" || metrics[k]! > 0)).map(([k, unit]) => ({ value: metrics[k]!, unit }));
}

/** "前日 · 9月25日", "前号 · 第 37 週", "次号 · 7 月". */
export function neighbourLabel(kind: ReportKind, key: string, direction: "prev" | "next"): string {
  if (kind === "daily") return `${direction === "prev" ? "前日" : "翌日"} · ${monthDay(key)}`;
  const which = direction === "prev" ? "前号" : "次号";
  return kind === "weekly" ? `${which} · 第 ${Number(key.slice(6))} 週` : `${which} · ${Number(key.slice(5, 7))} 月`;
}

const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
/** Numbers in kanji as a paper prints them: 1 → 一, 12 → 十二, 20 → 二十. */
function cnNumber(n: number): string {
  if (n <= 10) return CN[n]!;
  if (n < 20) return `十${CN[n - 10]}`;
  return `${CN[Math.floor(n / 10)]}十${n % 10 ? CN[n % 10] : ""}`;
}

/** The line above the nameplate: "2026 年 9 月 26 日 · 土曜日", "2026 年 第 38 週 · 09.14 — 09.20", "2026 年 8 月". */
export function dateLine(kind: ReportKind, key: string): string {
  const m = dateMark(kind, key);
  if (kind === "daily") return `${m.top} ${Number(key.slice(8, 10))} 日 · ${m.bottom}`;
  return kind === "weekly" ? `${m.top} · ${m.bottom}` : `${m.top} ${m.bottom}`;
}

/** What each kind is, under its nameplate. */
export const MOTTO: Record<ReportKind, string> = { daily: `${REPORTS.motto} · 毎日のニュース`, weekly: `${REPORTS.motto} · 毎週のまとめ`, monthly: `${REPORTS.motto} · 毎月の総まとめ` };

export interface PeriodCell {
  key: string | null;
  /** Hover text: "9月26日 · 第 158 号". */
  label: string;
  state: "current" | "issue" | "none" | "pad";
}

/**
 * The dot grid beside the date in the masthead: the days of this issue's month (dailies, Monday first),
 * the weeks of its year (weeklies) or the months of its year (monthlies), each marked as this issue,
 * an issue that exists, or none. This issue's own number (`current`) labels it, also when it is older
 * than the navigation.
 */
export function periodGrid(kind: ReportKind, key: string, index: ReportNavigationEntry[], current: number): { title: string; note: string; columns: number; heads: string[] | null; cells: PeriodCell[] } {
  const exists = new Set(index.map((e) => e.key));
  const cell = (k: string, name: string): PeriodCell => {
    const n = k === key ? current : issueNumber(index, k);
    return { key: k, label: n ? `${name} · 第 ${n} 号` : `${name} · 未発行`, state: k === key ? "current" : exists.has(k) ? "issue" : "none" };
  };
  const count = (cells: PeriodCell[]) => cells.filter((c) => c.state === "issue" || c.state === "current").length;
  const year = key.slice(0, 4);
  if (kind === "daily") {
    const m = Number(key.slice(5, 7));
    const days = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(Number(year), m - 1, 1)).getUTCDay() + 6) % 7;
    const cells: PeriodCell[] = [
      ...Array.from({ length: lead }, (): PeriodCell => ({ key: null, label: "", state: "pad" })),
      ...Array.from({ length: days }, (_, i) => {
        const day = `${key.slice(0, 7)}-${pad(i + 1)}`;
        return cell(day, monthDay(day));
      }),
    ];
    return { title: `${cnNumber(m)}月`, note: `今月 ${count(cells)} 号`, columns: 7, heads: ["月", "火", "水", "木", "金", "土", "日"], cells };
  }
  if (kind === "weekly") {
    // 28 December always falls in its year's last ISO week.
    const weeks = Number(isoWeekLabel(`${year}-12-28`).slice(6));
    const cells = Array.from({ length: weeks }, (_, i) => {
      const k = `${year}-W${pad(i + 1)}`;
      const { start, end } = isoWeekRange(k)!;
      return cell(k, `第 ${i + 1} 週（${start.slice(5).replace("-", ".")}—${end.slice(5).replace("-", ".")}）`);
    });
    return { title: `${year} 年`, note: `年間 ${count(cells)} 号`, columns: 13, heads: null, cells };
  }
  const cells = Array.from({ length: 12 }, (_, i) => cell(`${year}-${pad(i + 1)}`, `${i + 1} 月`));
  return { title: `${year} 年`, note: `年間 ${count(cells)} 号`, columns: 6, heads: null, cells };
}
