// Calendar helpers in the site's time zone (site/site.ts TIME_ZONE: a fixed offset, no DST), shared by
// web and backend.
import { SITE, TIME_ZONE } from "@hotmoto/site";

const OFFSET = TIME_ZONE.offset;
const OFFSET_MS = (OFFSET.startsWith("-") ? -1 : 1) * (Number(OFFSET.slice(1, 3)) * 60 + Number(OFFSET.slice(4, 6))) * 60_000;

/** YYYY-MM-DD of the instant in the site's time zone. */
export function siteDate(instant: Date | string | number): string {
  const d = new Date(new Date(instant).getTime() + OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/** HH:mm of the instant in the site's time zone. */
export function siteTime(instant: Date | string | number): string {
  const d = new Date(new Date(instant).getTime() + OFFSET_MS);
  return d.toISOString().slice(11, 16);
}

/** UTC instant of 00:00 in the site's time zone on the given calendar day. */
export function siteMidnight(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00${OFFSET}`));
}

/** UTC instant of an HH:mm time in the site's time zone on the given calendar day. */
export function siteAt(date: string, time: string): Date {
  return new Date(Date.parse(`${date}T${time}:00${OFFSET}`));
}

export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Weekday names in the site's language, Sunday first: in full and short. */
const WEEKDAYS = SITE.language === "ja"
  ? { full: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"], short: ["日", "月", "火", "水", "木", "金", "土"] }
  : { full: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"], short: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] };

/** "月曜日" of a calendar date (YYYY-MM-DD). */
export function siteWeekday(date: string): string {
  return WEEKDAYS.full[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/** "月" of a calendar date (YYYY-MM-DD). */
export function siteWeekdayShort(date: string): string {
  return WEEKDAYS.short[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/** ISO week label (e.g. 2026-W38) of a calendar date. */
export function isoWeekLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const year = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday..Sunday calendar dates of an ISO week label. */
export function isoWeekRange(label: string): { start: string; end: string } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(label);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const startDate = start.toISOString().slice(0, 10);
  if (isoWeekLabel(startDate) !== label) return null;
  return { start: startDate, end: addDays(startDate, 6) };
}

/** First and last day (YYYY-MM-DD) of a calendar month label such as 2026-09; null for anything else. */
export function monthRange(label: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(label);
  if (!m) return null;
  const next = Number(m[2]) === 12 ? `${Number(m[1]) + 1}-01-01` : `${m[1]}-${String(Number(m[2]) + 1).padStart(2, "0")}-01`;
  return { start: `${label}-01`, end: addDays(next, -1) };
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === date;
}
