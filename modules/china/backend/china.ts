// The China section's reports, read through the public layer: the same listed scope, columns and cards as
// すべてのニュース, without its AI score floor (the score is tuned on the Japanese market). A report is
// China's when the structure step tagged it 中国市場, or when it comes from a source the admin tagged 中国.
import { one, sql } from "@hotmoto/backend/db";
import { ITEM_COLUMNS, ITEM_FROM, seatHolders, toFeedItemSummary, type ItemRow } from "@hotmoto/backend/publication/items";
import { listedCondition } from "@hotmoto/backend/publication/scope";
import type { FeedItemSummary } from "@hotmoto/contracts/site";
import type { ChinaPage } from "../types.ts";

export const CHINA_TAG = "中国市場";
export const CHINA_SOURCE_TAG = "中国";

interface Section {
  key: string;
  label: string;
  categories: string[];
  /** Reports with one of these tags belong here whatever their category. */
  orTags?: string[];
  /** Reports with one of these tags go to the section that names them in orTags. */
  exceptTags?: string[];
}

/** The order of interest: policy, then production and sales data, capital and company moves, new products. */
export const SECTIONS: Section[] = [
  { key: "policy", label: "政策・規制", categories: ["policy"] },
  { key: "data", label: "生産・販売データ", categories: ["market"], exceptTags: ["決算・業績"] },
  { key: "capital", label: "資本・企業動向", categories: ["industry"], orTags: ["決算・業績"] },
  { key: "products", label: "新製品", categories: ["new-models", "gear"] },
];
const ALL = { key: "all", label: "すべて" };

export const CHINA_PAGE_SIZE = 40;
export const CHINA_MAX_PAGES = 50;
const OVERVIEW_SIZE = 5;

const china = () =>
  sql`AND (p.tags @> ${[CHINA_TAG]}::text[] OR p.source_id IN (SELECT id FROM sources WHERE tags @> ${[CHINA_SOURCE_TAG]}::text[]))`;

function sectionCondition(s: Section | typeof ALL) {
  if (!("categories" in s)) return sql``;
  const inCategory = sql`p.category IN ${sql(s.categories)}`;
  const member = s.orTags ? sql`(${inCategory} OR p.tags && ${s.orTags}::text[])` : inCategory;
  return s.exceptTags ? sql`AND ${member} AND NOT (p.tags && ${s.exceptTags}::text[])` : sql`AND ${member}`;
}

type Condition = ReturnType<typeof sectionCondition>;

async function reports(where: Condition, limit: number, offset: number, now: Date): Promise<FeedItemSummary[]> {
  // Page ids from the timeline index first, then the joins for those rows only.
  const rows = await sql<ItemRow[]>`
    WITH page AS (
      SELECT p.article_id FROM publications p WHERE ${listedCondition(now)} ${china()} ${where}
      ORDER BY p.timeline_at DESC, p.article_id DESC LIMIT ${limit} OFFSET ${offset})
    SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE p.article_id IN (SELECT article_id FROM page)
    ORDER BY p.timeline_at DESC, p.article_id DESC`;
  const holders = await seatHolders(rows, now);
  return rows.map((r) => (holders.has(r.id) ? { ...toFeedItemSummary(r), reason: null, sameEvent: holders.get(r.id)! } : toFeedItemSummary(r)));
}

async function count(where: Condition, now: Date): Promise<number> {
  return Number(one(await sql<{ n: number }[]>`
    SELECT count(*) AS n FROM (SELECT 1 FROM publications p WHERE ${listedCondition(now)} ${china()} ${where}
      LIMIT ${CHINA_MAX_PAGES * CHINA_PAGE_SIZE}) t`).n);
}

/** The section's key when there is one: a section of SECTIONS, or "all". */
export function isChinaSection(key: string): boolean {
  return key === ALL.key || SECTIONS.some((s) => s.key === key);
}

/** The overview (no section), or a page of one section. */
export async function loadChina(query: { section?: string | null; page?: number; now?: Date }): Promise<ChinaPage> {
  const now = query.now ?? new Date();
  const totals = await Promise.all([...SECTIONS, ALL].map(async (s) => ({ key: s.key, label: s.label, total: await count(sectionCondition(s), now) })));
  const all = totals.pop()!;
  if (!query.section) {
    const items = await Promise.all(SECTIONS.map((s) => reports(sectionCondition(s), OVERVIEW_SIZE, 0, now)));
    return { view: "overview", sections: totals.map((t, i) => ({ ...t, items: items[i]! })), total: all.total };
  }
  const section = SECTIONS.find((s) => s.key === query.section) ?? ALL;
  const page = Math.min(Math.max(query.page ?? 1, 1), CHINA_MAX_PAGES);
  const total = section === ALL ? all.total : totals.find((t) => t.key === section.key)!.total;
  return {
    view: "list",
    sections: [...totals, all],
    section: section.key,
    items: await reports(sectionCondition(section), CHINA_PAGE_SIZE, (page - 1) * CHINA_PAGE_SIZE, now),
    page,
    pageCount: Math.min(CHINA_MAX_PAGES, Math.max(1, Math.ceil(total / CHINA_PAGE_SIZE))),
    total,
  };
}
