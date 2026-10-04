// The work interface for an agent that answers the model steps instead of an API (docs/agent.md): it
// takes waiting tasks, answers each one and posts the answer back. The agent token (AGENT_TOKEN, never
// an admin session) opens it; without a usable token it answers 401 to everything.
import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { capabilities, processing } from "@hotmoto/backend/editorial/models";
import { agentQueue, agentToken, claimAgentTasks, MAX_ANSWER_CHARS } from "@hotmoto/backend/providers/agent";
import { answerAgentTask } from "@hotmoto/backend/jobs/agent";

/** Constant-time check against AGENT_TOKEN. */
function authorized(req: FastifyRequest): boolean {
  const expected = agentToken();
  if (!expected) return false;
  const given = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1]?.trim() ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function unauthorized(reply: FastifyReply) {
  return reply.code(401).header("Cache-Control", "no-store").type("text/plain; charset=utf-8").send("Unauthorized");
}

/** How to answer, sent with every batch so any agent can follow it without the documentation. */
const INSTRUCTIONS = [
  "各タスクは 1 回のモデル呼び出しです。system を指示、input を入力として読み、答えだけを返します。",
  "format が json のタスクは、JSON オブジェクト 1 つで答えます（schema があればそれに従う）。text のタスクは、指示が求める形式の文字列で答えます。",
  "subject と purpose が同じで attempt が違うタスク（2 回の採点など）は、互いを見ずに別々に答えます。",
  "retryNote があるタスクは、前回の答えが使えなかった理由です。直して答えます。",
  "答えは POST /api/agent/tasks/{id}/answer に {\"output\": 答え} で送ります。送った答えで次の工程のタスクができるので、タスクがなくなるまで取り直します。",
];

/** The step each receipt purpose belongs to, as the admin's model page names it. */
function stepOf(purpose: string): string | null {
  return Object.values(capabilities()).find((c) => c.purposes.includes(purpose))?.label ?? null;
}

export function registerAgentWork(app: FastifyInstance) {
  app.get("/api/agent/tasks", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!authorized(req)) return unauthorized(reply);
    const limit = Math.min(50, Math.max(1, Math.floor(Number((req.query as { limit?: string }).limit) || 10)));
    const tasks = await claimAgentTasks(limit);
    const [{ intervalMinutes }, queue] = await Promise.all([processing(), agentQueue()]);
    return {
      intervalMinutes,
      // Waiting tasks nobody holds after this batch.
      waiting: queue.waiting - queue.claimed,
      instructions: INSTRUCTIONS,
      tasks: tasks.map((t) => ({ ...t, step: stepOf(t.purpose) })),
    };
  });

  app.post("/api/agent/tasks/:id/answer", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!authorized(req)) return unauthorized(reply);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isSafeInteger(id) || id <= 0) return reply.code(404).send({ ok: false, error: "no such task" });
    const outcome = await answerAgentTask(id, (req.body as { output?: unknown } | null)?.output);
    if (outcome === "missing") return reply.code(404).send({ ok: false, error: "no such task is waiting (already answered or withdrawn)" });
    if (outcome === "empty") return reply.code(400).send({ ok: false, error: "output is empty" });
    if (outcome === "too-long") return reply.code(400).send({ ok: false, error: `output is longer than ${MAX_ANSWER_CHARS} characters` });
    return { ok: true };
  });

  app.get("/api/agent/status", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!authorized(req)) return unauthorized(reply);
    const [{ mode, intervalMinutes }, queue] = await Promise.all([processing(), agentQueue()]);
    return { mode, intervalMinutes, ...queue };
  });
}
