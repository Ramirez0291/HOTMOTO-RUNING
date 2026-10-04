// Story digest: rewritten incrementally as reports arrive; contradictions with earlier reporting are
// stated explicitly. Latest progress is bound to a current public report, not generated independently.
import { z } from "zod";
import { modelFor } from "../editorial/models.ts";
import { siteDate, siteTime } from "@hotmoto/contracts/time";
import { sql } from "../db.ts";
import { chatJson } from "../providers/llm.ts";
import { completeReceipt } from "../providers/receipts.ts";
import { digestFactEvidence, digestInputsHash, digestReports, type DigestReport } from "../publication/story-evidence.ts";
import { promptText, promptVersion } from "../editorial/prompts.ts";

export const DIGEST_PROMPT_VERSION = promptVersion("story-digest");

export const DIGEST_SYSTEM = promptText("story-digest");

export const DigestSchema = z.object({
  title: z.string().max(120).catch(""),
  digest: z.string().min(10).max(2000),
});

/** Production and the real-sample evaluation use this same input builder. */
export function buildStoryDigestInput(story: { title: string; digest: string | null }, reports: DigestReport[], opts: { corrected: boolean; knownArticleIds?: string[] }) {
  const known = new Set(opts.knownArticleIds ?? []);
  const lines = reports.slice(-40).map((r) => `${opts.corrected || known.has(r.id) ? "" : "【新】"}報道 ${r.id}｜事実 ${r.fact_id}｜${siteDate(r.at)} ${siteTime(r.at)}｜${r.source_name}${r.first_party ? "（一次）" : ""}｜${r.title}｜${r.summary ?? ""}\n事実の条件と情報源の証拠：${JSON.stringify(digestFactEvidence(r))}`);
  return opts.corrected
    ? `出来事のいまのタイトル：${story.title}\n\n報道の内容か事実の証拠が訂正された。下の報道のいまの内容だけに基づいてまとめを書き直し、以前の版の言い方を引き継がない。\n報道（時系列）：\n${lines.join("\n")}`
    : `出来事のいまのタイトル：${story.title}\n${story.digest ? `前の版のまとめ：${story.digest}\n` : ""}\n報道（時系列。【新】は前の版より後の新しい報道）：\n${lines.join("\n")}`;
}

export async function composeStoryDigest(storyId: number): Promise<{ updated: boolean; version?: number }> {
  const [story] = await sql<{ id: number; title: string; digest: string | null; version: number; origin: string }[]>`
    SELECT id, title, digest, version, origin FROM stories WHERE id = ${storyId} AND merged_into IS NULL`;
  if (!story) return { updated: false };
  const reports = await digestReports(sql, [storyId]);
  if (reports.length === 0) {
    const cleared = await sql`UPDATE stories SET digest = NULL, latest = NULL, digest_updated_at = NULL, updated_at = now()
      WHERE id = ${storyId} AND version = ${story.version} AND merged_into IS NULL AND (digest IS NOT NULL OR latest IS NOT NULL)`;
    return { updated: cleared.count > 0 };
  }
  reports.sort((a, b) => a.at.getTime() - b.at.getTime());
  const ids = reports.map((r) => r.id).sort();
  // What this version is written from: the reports and what they currently say (corrections included).
  const inputsHash = digestInputsHash(reports);
  const [last] = await sql<{ article_ids: string[]; inputs_hash: string | null; digest: string; receipt_id: number | null }[]>`
    SELECT article_ids, inputs_hash, digest, receipt_id FROM story_digests WHERE story_id = ${storyId} ORDER BY version DESC LIMIT 1`;
  const sameReports = !!last && JSON.stringify([...last.article_ids].sort()) === JSON.stringify(ids);
  if (story.digest !== null && sameReports && last!.inputs_hash === inputsHash) return { updated: false };
  // Same reports, different content: an editor corrected one. A report gone from the story (withdrawn,
  // or regrouped elsewhere) likewise. Rewrite from the reports as they are now, without the previous
  // digest, so a corrected or withdrawn fact does not survive as "earlier reports said".
  const dropped = !!last && last.article_ids.some((id) => !ids.includes(id));
  const corrected = sameReports || dropped;
  const user = buildStoryDigestInput(story, reports, { corrected, knownArticleIds: last?.article_ids });
  const latest = reports[reports.length - 1]!.title;
  // A withdrawal clears the public projection but retains its history. Restoring exactly the same
  // evidence reuses that digest through the normal version/input checks, without another model call.
  const res = last?.inputs_hash === inputsHash ? { data: { title: "", digest: last.digest }, receiptId: last.receipt_id } : await chatJson({
    model: await modelFor("digest"), purpose: "story_digest", subject: `story:${storyId}@${ids.length}`, promptVersion: DIGEST_PROMPT_VERSION,
    system: DIGEST_SYSTEM, user, schema: DigestSchema, temperature: 0.3, maxTokens: 1200,
  });
  const version = story.version + 1;
  const updated = await sql.begin(async (tx) => {
    const [current] = await tx<{ version: number; merged_into: number | null }[]>`
      SELECT version, merged_into FROM stories WHERE id = ${storyId} FOR UPDATE`;
    // Report corrections, withdrawals and membership changes do not necessarily bump the story
    // version. Compare the same input identity again after the model returns.
    if (!current || current.version !== story.version || current.merged_into !== null || digestInputsHash(await digestReports(tx, [storyId])) !== inputsHash) {
      // A paid response remains reusable even when an editor or another digest won the race.
      if (res.receiptId !== null) await completeReceipt(tx, res.receiptId);
      return false;
    }
    await tx`INSERT INTO story_digests (story_id, version, digest, latest, receipt_id, article_ids, inputs_hash)
             VALUES (${storyId}, ${version}, ${res.data.digest}, ${latest}, ${res.receiptId}, ${ids}, ${inputsHash})`;
    await tx`UPDATE stories SET digest = ${res.data.digest}, latest = ${latest}, digest_updated_at = now(),
               title = CASE WHEN origin = 'manual' OR ${res.data.title} = '' THEN title ELSE ${res.data.title} END,
               version = ${version}, updated_at = now()
             WHERE id = ${storyId}`;
    if (res.receiptId !== null) await completeReceipt(tx, res.receiptId);
    return true;
  });
  return updated ? { updated: true, version } : { updated: false };
}
