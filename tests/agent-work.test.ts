// The agent instead of a model API: every step posts its request as a task and waits; the agent's answers,
// saved on the tasks' receipts, carry an article through to the judgement an API would give. A job that
// waited is sent again with the answer, an unusable answer is posted again with the reason, tasks nobody
// answers are withdrawn, the work interface needs its token, and the processing mode moves the steps.
import { tag } from "./setup.ts";
import { SELECTING_SCORE } from "./analysis-steps.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@hotmoto/backend/db";
import { upsertMaterial } from "@hotmoto/backend/content/materials";
import { analyzeArticle } from "@hotmoto/backend/editorial/analyze";
import { CAPABILITIES, invalidateModelCache, modelFor, type Capability } from "@hotmoto/backend/editorial/models";
import { switchProcessing } from "@hotmoto/backend/admin/models";
import { AwaitingAgentError, claimAgentTasks, withdrawStaleAgentTasks, type AgentTask } from "@hotmoto/backend/providers/agent";
import { markStalePendingReceipts } from "@hotmoto/backend/providers/receipts";
import { ModelOutputError } from "@hotmoto/backend/providers/llm";
import { answerAgentTask } from "@hotmoto/backend/jobs/agent";
import { enqueue, getBoss, QUEUES, stopBoss } from "@hotmoto/backend/jobs/queue";
import { jobContext } from "@hotmoto/backend/lib/job-context";
import { buildApp } from "../apps/api/src/app.ts";

// No step has a model of its own: the processing mode decides, and it is the agent.
for (const c of Object.values(CAPABILITIES) as Capability[]) delete process.env[c.env];
process.env.PROCESSING_MODE = "agent";
process.env.AGENT_TOKEN = "agent-work-test-token-0123456789";

const T = tag();
const SOURCE = `test-agent-work-${T}`;
const app = await buildApp();

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at) VALUES (${SOURCE}, 'Test agent work', 'rss', 'T1', 'editorial', '2100-01-01')`;
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

// The tag keeps each material unique: identical input would reuse an earlier test's answers.
const article = async (marker: string) =>
  (await upsertMaterial({
    sourceId: SOURCE, url: `https://example.com/${marker}-${T}`, title: `${marker} 新型車の発表 ${T}`,
    bodyText: `${marker}: あるメーカーが新型車を発表し、価格と発売日を明らかにした。 ${T} `.repeat(6),
    bodyStatus: "ok", via: "fetch", publishedAt: new Date(),
  } as never)).articleId;

const tasksOf = async (articleId: string): Promise<AgentTask[]> =>
  (await claimAgentTasks(50)).filter((t) => t.subject?.startsWith(`article:${articleId}`));

const ANSWERS: Record<string, unknown> = {
  prefilter_article: { label: "PASS", reason: "テスト" },
  score_article: { attentionScore: SELECTING_SCORE },
  structure_article: { scope: "single", category: "new-models", tags: ["新型車"], subjects: [], fact: null },
  understand_article: {
    itemType: "model_release", authorRole: "principal", tags: ["新型車"], editorialJudgment: "注目の理由",
    title: "エージェントが書いたタイトル", summary: "エージェントが書いた要約。二文目で価格に触れる。",
  },
};

async function answerAll(tasks: AgentTask[]) {
  for (const t of tasks) assert.equal(await answerAgentTask(t.id, ANSWERS[t.purpose]), "saved");
}

test("an article goes through the agent step by step and is judged from its answers alone", async () => {
  const id = await article("STEPS");
  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const first = await tasksOf(id);
  assert.deepEqual(first.map((t) => t.purpose), ["prefilter_article"]);
  assert.equal(first[0]!.format, "json");
  assert.ok(first[0]!.schema, "the step's output schema goes with the task");
  await answerAll(first);

  // The structure runs beside the scores, and both scores are posted before the step waits.
  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const second = await tasksOf(id);
  assert.deepEqual(second.map((t) => t.purpose).sort(), ["score_article", "score_article", "structure_article"]);
  assert.deepEqual(second.filter((t) => t.purpose === "score_article").map((t) => t.attempt).sort(), ["score-1", "score-2"]);
  await answerAll(second);

  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const third = await tasksOf(id);
  assert.deepEqual(third.map((t) => t.purpose), ["understand_article"]);
  await answerAll(third);

  const res = await analyzeArticle(id);
  assert.equal(res!.output!.selected, true);
  assert.equal(res!.output!.score, SELECTING_SCORE);
  assert.equal(res!.output!.titleZh, "エージェントが書いたタイトル");
  const services = await sql<{ service: string; status: string }[]>`SELECT DISTINCT service, status FROM receipts WHERE subject LIKE ${`article:${id}%`}`;
  assert.deepEqual(services, [{ service: "agent", status: "completed" }]);
  assert.deepEqual(await tasksOf(id), [], "answered tasks are gone");
});

test("the job that waited on the agent is sent again with the answer", async () => {
  const id = await article("RESUME");
  await enqueue(QUEUES.analyze, { articleId: id }, { singletonKey: id });
  const boss = await getBoss();
  const [job] = await boss.fetch(QUEUES.analyze);
  assert.equal((job!.data as { articleId: string }).articleId, id);
  await assert.rejects(jobContext.run({ queue: QUEUES.analyze, id: job!.id }, () => analyzeArticle(id)), AwaitingAgentError);
  await boss.complete(QUEUES.analyze, job!.id, { awaitingAgent: true });

  const [task] = await tasksOf(id);
  assert.equal(await answerAgentTask(task!.id, ANSWERS.prefilter_article), "saved");
  const [queued] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pgboss.job WHERE name = ${QUEUES.analyze} AND data->>'articleId' = ${id} AND state = 'created'`;
  assert.equal(queued!.n, 1);
});

test("an unusable answer is posted again with the reason", async () => {
  const id = await article("UNUSABLE");
  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const [task] = await tasksOf(id);
  assert.equal(await answerAgentTask(task!.id, "これは JSON ではない"), "saved");
  await assert.rejects(analyzeArticle(id), ModelOutputError);
  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const [again] = await tasksOf(id);
  assert.equal(again!.id, task!.id, "the same request, on the same receipt");
  assert.match(again!.retryNote ?? "", /unusable output/);
});

test("a task nobody answers is withdrawn and posted again, and never turns unknown", async () => {
  const id = await article("STALE");
  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const [task] = await tasksOf(id);
  await sql`UPDATE receipts SET updated_at = now() - interval '2 hours' WHERE id = ${task!.id}`;
  await markStalePendingReceipts();
  const [waiting] = await sql<{ status: string }[]>`SELECT status FROM receipts WHERE id = ${task!.id}`;
  assert.equal(waiting!.status, "pending", "an agent's task is not a stopped process");

  await sql`UPDATE agent_tasks SET created_at = now() - interval '2 days' WHERE receipt_id = ${task!.id}`;
  assert.equal(await withdrawStaleAgentTasks(60), 1);
  const [withdrawn] = await sql<{ status: string }[]>`SELECT status FROM receipts WHERE id = ${task!.id}`;
  assert.equal(withdrawn!.status, "failed");
  assert.equal(await answerAgentTask(task!.id, ANSWERS.prefilter_article), "missing");

  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const [again] = await tasksOf(id);
  assert.match(again!.retryNote ?? "", /no agent answered/);
});

test("the work interface needs the agent's token, hands out tasks and takes each answer once", async () => {
  const id = await article("HTTP");
  await assert.rejects(analyzeArticle(id), AwaitingAgentError);
  const auth = { authorization: `Bearer ${process.env.AGENT_TOKEN}` };

  assert.equal((await app.inject({ url: "/api/agent/tasks" })).statusCode, 401);
  assert.equal((await app.inject({ url: "/api/agent/tasks", headers: { authorization: "Bearer wrong-token-0123456789abc" } })).statusCode, 401);

  const batch = await app.inject({ url: "/api/agent/tasks?limit=50", headers: auth });
  assert.equal(batch.statusCode, 200);
  assert.equal(batch.headers["cache-control"], "no-store");
  const body = batch.json() as { intervalMinutes: number; instructions: string[]; tasks: Array<{ id: number; subject: string; purpose: string; step: string | null }> };
  assert.equal(body.intervalMinutes, 60);
  assert.ok(body.instructions.length > 0);
  const task = body.tasks.find((t) => t.subject.startsWith(`article:${id}`))!;
  assert.equal(task.purpose, "prefilter_article");
  assert.equal(task.step, CAPABILITIES.prefilter.label);

  const answer = (output: unknown) => app.inject({ method: "POST", url: `/api/agent/tasks/${task.id}/answer`, headers: auth, payload: { output } });
  assert.equal((await answer("")).statusCode, 400);
  assert.equal((await answer(ANSWERS.prefilter_article)).statusCode, 200);
  assert.equal((await answer(ANSWERS.prefilter_article)).statusCode, 404, "an answered task takes no second answer");

  const status = await app.inject({ url: "/api/agent/status", headers: auth });
  assert.equal(status.statusCode, 200);
  assert.equal((status.json() as { mode: string }).mode, "agent");
});

test("the processing mode moves every step without a model of its own; a step's own model stays", async () => {
  assert.equal(await modelFor("score"), "agent");
  process.env.SUMMARIZE_MODEL = "default";
  try {
    assert.equal(await modelFor("summarize"), "default", "the environment's model for a step wins over the mode");
    await switchProcessing({ mode: "api" }, "API に戻す", "test");
    assert.equal(await modelFor("score"), CAPABILITIES.score.default);
    await assert.rejects(switchProcessing({ intervalMinutes: 2 }, "短すぎる", "test"), /intervalMinutes/);
    await switchProcessing({ intervalMinutes: 30 }, "30 分ごと", "test");
    const [setting] = await sql<{ value: { mode?: string; intervalMinutes?: number } }[]>`SELECT value FROM settings WHERE key = 'processing'`;
    assert.deepEqual(setting!.value, { mode: "api", intervalMinutes: 30 }, "changing the interval keeps the mode switched");
  } finally {
    delete process.env.SUMMARIZE_MODEL;
    await sql`DELETE FROM settings WHERE key = 'processing'`;
    invalidateModelCache();
  }
});
