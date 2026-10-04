// An agent's answer to a task (the work interface, apps/api/src/routes/agent.ts): saved on the task's
// receipt, and the queue job that stopped to wait for it sent again, in one transaction. Work outside a
// job (reports, translations, scheduled runs) picks its answer up on its next run.
import { sql } from "../db.ts";
import { MAX_ANSWER_CHARS, saveAgentAnswer } from "../providers/agent.ts";
import { resendJob } from "./queue.ts";

export type AnswerOutcome = "saved" | "missing" | "empty" | "too-long";

/** `output`: the JSON object a json task asks for (or its text), or the text a text task asks for. */
export async function answerAgentTask(id: number, output: unknown): Promise<AnswerOutcome> {
  const content = typeof output === "string" ? output : output === undefined || output === null ? "" : JSON.stringify(output);
  if (!content.trim()) return "empty";
  if (content.length > MAX_ANSWER_CHARS) return "too-long";
  return sql.begin(async (tx) => {
    const saved = await saveAgentAnswer(tx, id, content);
    if (!saved) return "missing";
    if (saved.resume) await resendJob(saved.resume, tx);
    return "saved";
  });
}
