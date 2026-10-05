// すべてのニュース's AI score floor: the site API lists every item unless the page sends a floor; with one,
// items scored lower and unscored items are left out of the list, its count and search alike.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@hotmoto/backend/db";
import { upsertMaterial } from "@hotmoto/backend/content/materials";
import { publishArticle } from "@hotmoto/backend/publication/publish";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const SOURCE = `pool-score-${T}`;
const app = await buildApp();
const ids = new Map<number | null, string>();

before(async () => {
  await sql`INSERT INTO sources(id,name,kind,tier,participation_mode,next_fetch_at)
    VALUES (${SOURCE},'Pool score','rss','T2','editorial','2100-01-01')`;
  for (const score of [20, 35, 36, 80, null]) {
    const name = `s${score ?? "none"}`;
    const { articleId } = await upsertMaterial({ sourceId: SOURCE, url: `https://example.org/${T}/${name}`,
      title: `${T} ${name}`, bodyText: "A motorcycle maker announced a new model.", bodyStatus: "ok", via: "fetch", publishedAt: new Date() });
    await sql`INSERT INTO analyses(article_id,input_revision,origin,relevance,category,tags,title_zh,summary_zh,score,selected)
      VALUES (${articleId},1,'rule','pass','new-models',${[T]},${`${T} ${name} の新型車`},'新型車の発表。',${score},false)`;
    await publishArticle(articleId);
    ids.set(score, articleId);
  }
});
after(async () => { await app.close(); await closeDb(); });

const pool = async (query: string) => {
  const res = await app.inject({ method: "GET", url: `/api/site/pool?${query}` });
  return { status: res.statusCode, body: res.json() as { filters: { minScore: number }; items: Array<{ id: string }>; total: number } };
};
const listed = (items: Array<{ id: string }>) => new Set(items.map((i) => i.id));

test("without a floor every item is listed, unscored ones too", async () => {
  for (const query of [`tag=${T}`, `tag=${T}&score=0`]) {
    const { body } = await pool(query);
    assert.equal(body.filters.minScore, 0);
    assert.deepEqual(listed(body.items), new Set(ids.values()), query);
    assert.equal(body.total, 5);
  }
});

test("a floor leaves out lower and unscored items from the list, its count and search", async () => {
  const want = new Set([ids.get(36)!, ids.get(80)!]);
  const { body } = await pool(`tag=${T}&score=36`);
  assert.equal(body.filters.minScore, 36);
  assert.deepEqual(listed(body.items), want);
  assert.equal(body.total, 2);
  for (const tab of ["time", "relevance"]) {
    const search = await pool(`q=${encodeURIComponent(T)}&tab=${tab}&score=36`);
    assert.deepEqual(listed(search.body.items), want, tab);
    assert.equal(search.body.total, 2, tab);
  }
});

test("an unreadable floor is refused", async () => {
  for (const score of ["abc", "-1", "101", "1.5"]) assert.equal((await pool(`tag=${T}&score=${score}`)).status, 400, score);
});
