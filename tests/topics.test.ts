// Topic pages: which articles a topic takes, and their counts.
// Written before the code, from the ways it can go wrong:
// - a company topic takes an article about another company that only mentions it (several subjects,
//   its name nowhere in the title), or drops one about it whose title names it in English, in another
//   case, next to Japanese text, or only by a product (it is the article's only subject);
// - a Latin name matches inside another word ("Hondata" is not Honda); a headline naming a company
//   that is not a subject of the article gets in;
// - a technical-direction topic stops taking its tags;
// - withdrawn or not yet released articles appear in a list or a count;
// - an article or story page names a topic its reports do not belong to;
// - a topic without content has no page, or an unknown slug or a page past the end has one.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@hotmoto/backend/db";
import { upsertMaterial } from "@hotmoto/backend/content/materials";
import { stopBoss } from "@hotmoto/backend/jobs/queue";
import { publishArticle } from "@hotmoto/backend/publication/publish";
import { loadTopicPage, listTopicSummaries, topicsOfStory } from "@hotmoto/backend/publication/topics";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const OFFICIAL = `test-topics-official-${T}`;
const MEDIA = `test-topics-media-${T}`;
const app = await buildApp();

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, next_fetch_at) VALUES
    (${OFFICIAL}, 'Official', 'rss', 'T1', 'editorial', true, '2100-01-01'),
    (${MEDIA}, 'Media', 'rss', 'T2', 'editorial', false, '2100-01-01')`;
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

let n = 0;
interface Report {
  source?: string;
  at: Date;
  title: string;
  originalTitle?: string;
  subjects?: string[];
  tags?: string[];
  score?: number;
  selected?: boolean;
  fact?: number;
  category?: string;
}

/** A published report; `fact` links it to a fact before publishing, as grouping would. */
async function report(r: Report): Promise<string> {
  n += 1;
  const { articleId } = await upsertMaterial({
    sourceId: r.source ?? MEDIA, url: `https://example.com/topics-${T}-${n}`, title: r.originalTitle ?? r.title, bodyText: "body", bodyHtml: "<p>body</p>", bodyStatus: "ok", via: "fetch", publishedAt: r.at,
  });
  await sql`UPDATE articles SET discovered_at = ${r.at}, timeline_at = ${r.at}, grouped_at = now() WHERE id = ${articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
            VALUES (${articleId}, 1, 'rule', 'pass', ${r.category ?? "new-models"}, ${r.title}, ${`要約 ${n}`}, ${r.score ?? 80}, ${r.selected ?? true}, ${r.subjects ?? []}, ${[r.category === "gear" ? "用品・パーツ" : r.category === "market" ? "販売・登録台数" : r.category === "review" ? "解説" : r.category === "industry" ? "業界動向" : r.category === "opinion" ? "論評・インタビュー" : "新型車", ...(r.tags ?? [])]})`;
  if (r.fact) await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES (${r.fact}, ${articleId}, 'report')`;
  await publishArticle(articleId, { releasedAt: new Date(r.at.getTime() + 60_000) });
  return articleId;
}

async function story(title: string): Promise<{ id: number; publicId: string }> {
  const publicId = randomUUID();
  const [s] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title, first_report_at, latest_at) VALUES (${publicId}, ${title}, now(), now()) RETURNING id`;
  return { id: s!.id, publicId };
}

async function fact(storyId: number | null, title: string): Promise<number> {
  const [f] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, story_id, title) VALUES (${`f-${T}-${randomUUID()}`}, ${storyId}, ${title}) RETURNING id`;
  return f!.id;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);
const page = async (slug: string, p = 1) => {
  const data = await loadTopicPage(slug, p, new Date());
  assert.ok(data, `${slug} page ${p}`);
  return data;
};
/** Every article of a topic, over all its pages. */
async function members(slug: string): Promise<string[]> {
  const first = await page(slug);
  const out = ids(first.items);
  for (let p = 2; p <= first.pageCount; p++) out.push(...ids((await page(slug, p)).items));
  return out;
}

test("a company topic takes the articles about it, not the ones that only mention it", async () => {
  const about = await report({ at: hoursAgo(30), title: `Eクラッチ搭載モデルを追加 ${T}`, subjects: ["honda"] });
  const product = await report({ at: hoursAgo(31), title: `ホーネットの新型が登場 ${T}`, subjects: ["honda"] });
  const english = await report({ at: hoursAgo(32), title: `新型車を発表 ${T}`, originalTitle: `Honda launches a new model ${T}`, subjects: ["honda", "yamaha"] });
  const recall = await report({ at: hoursAgo(33), title: `ヤマハが国土交通省にリコールを届け出 ${T}`, subjects: ["yamaha", "honda", "ducati"] });
  const lowerCase = await report({ at: hoursAgo(34), title: `yamaha が新しい安全方針を公表 ${T}`, subjects: ["yamaha", "honda"] });
  const pact = await report({ at: hoursAgo(35), title: `国内メーカー 4 社が安全協定に署名 ${T}`, subjects: ["yamaha", "honda", "suzuki"] });
  const hondata = await report({ at: hoursAgo(36), title: `Hondata 製の ECU が発売、Yamaha も協力 ${T}`, subjects: ["honda", "yamaha"] });
  const adjacent = await report({ at: hoursAgo(37), title: `新型Hondaの電動モデル ${T}`, subjects: ["honda", "yamaha"] });
  const headline = await report({ at: hoursAgo(38), title: `ホンダが 1 本のまとめ記事で触れられた ${T}`, subjects: ["suzuki"] });
  const electric = await report({ at: hoursAgo(39), title: `電動スクーターの新型を発表 ${T}`, tags: ["電動化"] });

  const honda = await members("honda");
  for (const id of [about, product, english]) assert.ok(honda.includes(id), "about Honda");
  for (const id of [recall, lowerCase, pact, headline]) assert.ok(!honda.includes(id), "only mentions Honda");
  const yamaha = await members("yamaha");
  for (const id of [recall, lowerCase, hondata]) assert.ok(yamaha.includes(id), "about Yamaha");
  for (const id of [english, pact]) assert.ok(!yamaha.includes(id), "only mentions Yamaha");
  assert.ok(honda.includes(adjacent), "Honda next to Japanese text");
  assert.ok(!honda.includes(hondata), "Hondata is not Honda");
  assert.ok((await members("ev-battery")).includes(electric), "a market theme takes its tag");

  // The article page names the topics it belongs to.
  const topicsOf = async (id: string) => {
    const res = await app.inject({ method: "GET", url: `/api/site/items/${id}` });
    return (JSON.parse(res.body) as { topics: Array<{ slug: string }> }).topics.map((t) => t.slug);
  };
  assert.deepEqual(await topicsOf(about), ["honda", "new-models"]);
  assert.deepEqual(await topicsOf(recall), ["yamaha", "new-models"]);
  assert.deepEqual(await topicsOf(pact), ["new-models"]);
  assert.deepEqual(await topicsOf(electric), ["ev-battery", "new-models"]);
});

test("a story page names the topics of its reports", async () => {
  const launch = await story(`電動スクーター V2 を発表 ${T}`);
  await report({ source: OFFICIAL, at: hoursAgo(26), title: `電動スクーター V2 を発表 ${T}`, tags: ["電動化"], fact: await fact(launch.id, "V2 を発表") });
  assert.deepEqual(await topicsOfStory(launch.id), [{ slug: "ev-battery", name: "電動化・バッテリー交換" }, { slug: "new-models", name: "新型車" }]);
});

test("withdrawn articles stay out of lists and counts", async () => {
  const kept = await report({ at: hoursAgo(5), title: `カワサキが新型を発表 ${T}`, subjects: ["kawasaki"] });
  const withdrawn = await report({ at: hoursAgo(4), title: `カワサキが取り下げたニュース ${T}`, subjects: ["kawasaki"] });
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${withdrawn}`;

  const data = await page("kawasaki");
  assert.deepEqual(ids(data.items), [kept]);
  assert.equal(data.topic.total, 1);
  const summary = (await listTopicSummaries()).topics.find((t) => t.slug === "kawasaki")!;
  assert.equal(summary.latest?.title, `カワサキが新型を発表 ${T}`, "the index shows the newest public article");
});

test("every topic has a page; unknown topics and pages past the end have none", async () => {
  const empty = await page("royal-enfield");
  assert.equal(empty.topic.indexable, false, "a topic without content is not indexed");
  assert.deepEqual(empty.items, []);
  assert.equal(await loadTopicPage("not-a-topic", 1, new Date()), null);
  assert.equal(await loadTopicPage("royal-enfield", 2, new Date()), null);
  const index = await app.inject({ method: "GET", url: "/api/site/topics" });
  const body = JSON.parse(index.body) as { groups: Array<{ key: string }>; topics: Array<{ slug: string }> };
  assert.deepEqual(body.groups.map((g) => g.key), ["company", "field", "genre"]);
  assert.equal(body.topics.length, 31);
});
