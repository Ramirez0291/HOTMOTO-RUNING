import { siteDate, siteTime, siteWeekdayShort } from "@hotmoto/contracts/time";

/** "9月28日" of a calendar date (YYYY-MM-DD). */
export function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

/** "土" of a calendar date (YYYY-MM-DD). */
export function weekdayShort(date: string): string {
  return siteWeekdayShort(date);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "たった今";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} 分前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 時間前`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} 日前`;
  return siteDate(iso);
}

export function fullDateTime(iso: string): string {
  return `${siteDate(iso)} ${siteTime(iso)}`;
}

/** "9月24日 10:51" (site time zone), for lists that span days. */
export function monthDayTime(iso: string): string {
  return `${monthDay(siteDate(iso))} ${siteTime(iso)}`;
}

export function sourceInitial(name: string): string {
  const s = name.replace(/^[^\p{L}\p{N}]+/u, "");
  return (s[0] ?? "A").toUpperCase();
}
