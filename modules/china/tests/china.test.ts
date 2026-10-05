// The China section: China's reports (tagged 中国市場, or from a source tagged 中国) in its sections, policy
// first, with no AI score floor; other reports stay out.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@hotmoto/backend/db";
import { installModules } from "@hotmoto/backend/modules";
import { upsertMaterial } from "@hotmoto/backend/content/materials";
import { publishArticle } from "@hotmoto/backend/publication/publish";
import china from "../server.ts";
import type { ChinaPage } from "../types.ts";

installModules([china]);
const { buildApp } = await import("../../../apps/api/src/app.ts");

const T = tag();
const app = await buildApp();
const ids: Record<string, string> = {};

async function report(name: string, source: string, category: string, tags: string[], hoursAgo: number, score = 60) {
  const { articleId } = await upsertMaterial({ sourceId: source, url: `https://example.org/${T}/${name}`, title: `${T} ${name}`,
    bodyText: "A motorcycle report.", bodyStatus: "ok", via: "fetch", publishedAt: new Date(Date.now() - hoursAgo * 3600_000) });
  await sql`INSERT INTO analyses(article_id,input_revision,origin,relevance,category,tags,title_zh,summary_zh,score,selected)
    VALUES (${articleId},1,'rule','pass',${category},${tags},${`${T} ${name} の記事`},'二輪の記事。',${score},false)`;
  await publishArticle(articleId);
  ids[name] = articleId;
}

before(async () => {
  await sql`INSERT INTO sources(id,name,kind,tier,participation_mode,tags,next_fetch_at) VALUES
    (${`media-${T}`},'Media','rss','T2','editorial','{}','2100-01-01'),
    (${`cn-${T}`},'中国の情報源','rss','T2','editorial',${["中国"]},'2100-01-01')`;
  const media = `media-${T}`;
  await report("policy", media, "policy", ["規制・法改正", "中国市場"], 1, 12);
  await report("data", media, "market", ["販売・登録台数", "中国市場"], 2);
  await report("earnings", media, "market", ["決算・業績", "中国市場"], 3);
  await report("deal", media, "industry", ["提携・買収", "中国市場"], 4);
  await report("model", media, "new-models", ["新型車", "中国市場"], 5);
  await report("race", media, "motorsports", ["モータースポーツ", "中国市場"], 6);
  await report("local-rule", `cn-${T}`, "policy", ["規制・法改正"], 7);
  await report("japan", media, "policy", ["規制・法改正", "日本市場"], 8);
});
after(async () => { await app.close(); await closeDb(); });

const get = async (query = "") => {
  const res = await app.inject({ method: "GET", url: `/api/site/china${query}` });
  return { status: res.statusCode, body: res.json() as ChinaPage };
};
const named = (items: Array<{ id: string }>) => items.map((i) => Object.keys(ids).find((k) => ids[k] === i.id)).sort();

test("the overview gives each section's latest reports in the order of interest", async () => {
  const { body } = await get();
  assert.equal(body.view, "overview");
  if (body.view !== "overview") return;
  assert.deepEqual(body.sections.map((s) => s.key), ["policy", "data", "capital", "products"]);
  assert.deepEqual(Object.fromEntries(body.sections.map((s) => [s.key, named(s.items)])), {
    policy: ["local-rule", "policy"],
    data: ["data"],
    capital: ["deal", "earnings"],
    products: ["model"],
  }, "earnings go to capital; a report from a source tagged 中国 counts; a low score is no bar");
  assert.equal(body.total, 7, "every China report, the race included; the Japanese one is not");
});

test("a section and all of China list a page at a time; an unknown section is not found", async () => {
  const capital = (await get("?section=capital")).body;
  assert.equal(capital.view, "list");
  if (capital.view !== "list") return;
  assert.deepEqual(named(capital.items), ["deal", "earnings"]);
  assert.equal(capital.total, 2);
  assert.deepEqual(capital.sections.map((s) => s.key), ["policy", "data", "capital", "products", "all"]);
  const all = (await get("?section=all")).body;
  assert.equal(all.view === "list" && all.total, 7);
  assert.equal((await get("?section=nope")).status, 404);
});
