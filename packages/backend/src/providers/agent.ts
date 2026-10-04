// Work for an agent instead of a model API. A step whose model is `agent` (providers/llm.ts) posts its
// whole request here, as a task behind a pending receipt (receipts.ts deferredRequest), and waits. An
// agent polls the work interface (apps/api/src/routes/agent.ts, docs/agent.md), answers the tasks and
// posts each answer back; it is saved on the receipt and the task is deleted. The step's next attempt
// reads the answer like a provider's response and checks it against the step's own schema; an unusable
// one posts the task again with the reason. Tasks nobody answers are withdrawn after a while.
import { credential } from "../config.ts";
import { sql, type Db } from "../db.ts";
import { jobContext, type JobRef } from "../lib/job-context.ts";
import { AGENT_SERVICE, receiveDeferred, withdrawDeferred } from "./receipts.ts";

/** A step waits for its answer: not a failure, and nothing to retry before the answer is in. */
export class AwaitingAgentError extends Error {
  readonly receiptId: number;
  constructor(receiptId: number, purpose: string) {
    super(`waiting for the agent's answer (${purpose}, receipt ${receiptId})`);
    this.receiptId = receiptId;
  }
}

export interface AgentTaskInput {
  purpose: string;
  subject: string | null;
  /** The request's attemptTag: tasks of one subject and purpose with different attempts are answered apart. */
  attempt: string | null;
  system: string;
  input: string;
  /** json: one JSON object (described by `schema` when it converts); text: the format the prompt asks for. */
  format: "json" | "text";
  schema: unknown;
  temperature: number;
  maxTokens: number;
}

export interface AgentTask extends AgentTaskInput {
  id: number;
  /** Why the previous answer to the same request could not be used. */
  retryNote: string | null;
  postedAt: Date;
  claims: number;
}

const PLACEHOLDER = /^(|changeme|change-me|placeholder|xxx+|todo|test|dev|your[-_]?token.*)$/i;

/** The work interface's token (AGENT_TOKEN); null keeps the interface closed (missing, a placeholder, or shorter than 16). */
export function agentToken(): string | null {
  const token = credential("auth", "AGENT_TOKEN") ?? "";
  return PLACEHOLDER.test(token) || token.length < 16 ? null : token;
}

/** A claimed task is leased to its agent this long; after that another poll may take it. */
const LEASE_MINUTES = 30;
/** The longest answer kept. */
export const MAX_ANSWER_CHARS = 200_000;

/** Records the task behind a deferred receipt (in the transaction that reserved it), with the queue job it runs in. */
export async function postAgentTask(tx: Db, receiptId: number, task: AgentTaskInput, retryNote: string | null): Promise<void> {
  const resume = jobContext.getStore() ?? null;
  await tx`
    INSERT INTO agent_tasks (receipt_id, purpose, subject, attempt, system, input, format, schema, temperature, max_tokens, retry_note, resume)
    VALUES (${receiptId}, ${task.purpose}, ${task.subject}, ${task.attempt}, ${task.system}, ${task.input}, ${task.format},
            ${task.schema === null ? null : tx.json(task.schema as never)}, ${task.temperature}, ${task.maxTokens}, ${retryNote},
            ${resume === null ? null : tx.json(resume as never)})`;
}

interface TaskRow {
  receipt_id: number;
  purpose: string;
  subject: string | null;
  attempt: string | null;
  system: string;
  input: string;
  format: "json" | "text";
  schema: unknown;
  temperature: number | null;
  max_tokens: number | null;
  retry_note: string | null;
  created_at: Date;
  claims: number;
}

/** Up to `limit` waiting tasks, oldest first, each leased to the caller so two agents do not answer the same one. */
export async function claimAgentTasks(limit: number): Promise<AgentTask[]> {
  const rows = await sql<TaskRow[]>`
    UPDATE agent_tasks t SET claimed_at = now(), claims = t.claims + 1
    FROM (SELECT receipt_id FROM agent_tasks
          WHERE claimed_at IS NULL OR claimed_at < now() - make_interval(mins => ${LEASE_MINUTES})
          ORDER BY created_at, receipt_id LIMIT ${limit} FOR UPDATE SKIP LOCKED) picked
    WHERE t.receipt_id = picked.receipt_id
    RETURNING t.receipt_id, t.purpose, t.subject, t.attempt, t.system, t.input, t.format, t.schema, t.temperature, t.max_tokens,
              t.retry_note, t.created_at, t.claims`;
  return rows
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.receipt_id - b.receipt_id)
    .map((r) => ({
      id: Number(r.receipt_id), purpose: r.purpose, subject: r.subject, attempt: r.attempt, system: r.system, input: r.input, format: r.format,
      schema: r.schema, temperature: r.temperature ?? 0.2, maxTokens: r.max_tokens ?? 1500, retryNote: r.retry_note, postedAt: r.created_at, claims: r.claims,
    }));
}

/**
 * Saves an agent's answer on its receipt and deletes the task, in the caller's transaction; returns the
 * job that waits for it (null when it was posted outside a job). False when no such task waits (already
 * answered, withdrawn, or never posted).
 */
export async function saveAgentAnswer(tx: Db, receiptId: number, content: string): Promise<{ resume: JobRef | null } | false> {
  const [task] = await tx<{ resume: JobRef | null }[]>`DELETE FROM agent_tasks WHERE receipt_id = ${receiptId} RETURNING resume`;
  if (!task || !(await receiveDeferred(tx, receiptId, { content }))) return false;
  return { resume: task.resume };
}

export interface AgentQueue {
  waiting: number;
  /** Of the waiting tasks, those an agent holds now. */
  claimed: number;
  oldestAt: Date | null;
  answeredDay: number;
}

export async function agentQueue(): Promise<AgentQueue> {
  const [row] = await sql<{ waiting: number; claimed: number; oldest_at: Date | null; answered_day: number }[]>`
    SELECT count(*)::int AS waiting,
           count(*) FILTER (WHERE claimed_at > now() - make_interval(mins => ${LEASE_MINUTES}))::int AS claimed,
           min(created_at) AS oldest_at,
           (SELECT count(*)::int FROM receipt_attempts
            WHERE service = ${AGENT_SERVICE} AND status = 'received' AND finished_at > now() - interval '1 day') AS answered_day
    FROM agent_tasks`;
  return { waiting: row!.waiting, claimed: row!.claimed, oldestAt: row!.oldest_at, answeredDay: row!.answered_day };
}

/**
 * Tasks nobody answered within a day, or three agent intervals if longer: withdrawn (ops.recover). A
 * step still waiting on one posts it again on its next attempt; one that moved to another model since
 * leaves nothing behind.
 */
export async function withdrawStaleAgentTasks(intervalMinutes: number): Promise<number> {
  const minutes = Math.max(24 * 60, intervalMinutes * 3);
  return sql.begin(async (tx) => {
    const rows = await tx<{ receipt_id: number }[]>`
      DELETE FROM agent_tasks WHERE created_at < now() - make_interval(mins => ${minutes}) RETURNING receipt_id`;
    return withdrawDeferred(tx, rows.map((r) => Number(r.receipt_id)), `no agent answered within ${minutes} minutes`);
  });
}
