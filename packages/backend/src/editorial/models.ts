// Model per capability: the code default (the site's choice in site/models.ts, else `default`, the deployment's
// own model), an environment override, and an admin switch kept in settings (every switch is audited).
// Above the code default sits the processing mode (site/models.ts PROCESSING, PROCESSING_MODE, the admin):
// "agent" hands every step without a model of its own to an agent (providers/agent.ts), "api" leaves it
// on the code default. Read at call time and cached for a minute, so a switch applies to the next call
// without a restart; a changed model only affects work done from then on (history is not re-judged).
import { DEFAULTS, PROCESSING } from "@hotmoto/site/models";
import { sql } from "../db.ts";
import { serverModules } from "../modules.ts";
import { MODELS } from "../providers/llm.ts";

export interface Capability {
  label: string;
  env: string;
  default: string;
  /** Receipt purposes this capability produces (for the admin statistics). */
  purposes: string[];
  vision?: boolean;
}

export const CAPABILITIES = {
  prefilter: { label: "厳選の予備選別（この業界の話か、広めに拾う）", env: "PREFILTER_MODEL", default: DEFAULTS.prefilter ?? "default", purposes: ["prefilter_article"] },
  score: { label: "厳選の採点（独立した 2 回の採点、情報源の格付けごとのしきい値）", env: "SCORE_MODEL", default: DEFAULTS.score ?? "default", purposes: ["score_article"] },
  understand: { label: "内容理解（入選と入選に近いもののタイトル、要約、注目ポイント。画像を読めるときは最初の画像も見る）", env: "UNDERSTAND_MODEL", default: DEFAULTS.understand ?? "default", purposes: ["understand_article"] },
  summarize: { label: "タイトルと要約（それ以外の記事のタイトルと要約）", env: "SUMMARIZE_MODEL", default: DEFAULTS.summarize ?? "default", purposes: ["summarize_article"] },
  structure: { label: "構造の抽出（カテゴリ、タグ、主体の企業、出来事の事実。読者向けの文は書かない）", env: "STRUCTURE_MODEL", default: DEFAULTS.structure ?? "default", purposes: ["structure_article"] },
  group: { label: "出来事のまとめ（新しい報道と候補の事実の関係：同じ出来事、同じ出来事の進展、無関係。同じ報道でつながった 2 つの出来事が同じか）", env: "GROUP_MODEL", default: DEFAULTS.group ?? "default", purposes: ["group_article", "group_signal", "group_story"] },
  groupReview: { label: "まとめの再確認（類似度の低い統合、2 つの出来事の統合を書き込む前にもう一度読む。別の会社のモデルが望ましい）", env: "GROUP_REVIEW_MODEL", default: DEFAULTS.groupReview ?? "default", purposes: ["group_review", "group_story_review"] },
  digest: { label: "出来事のまとめ文", env: "DIGEST_MODEL", default: DEFAULTS.digest ?? "default", purposes: ["story_digest"] },
  // Dailies are computed by rule; report_lead and report_daily remain for their older receipts.
  report: { label: "週報・月報の総括とテーマ（日報はルールで作り、モデルを使わない）", env: "REPORT_MODEL", default: DEFAULTS.report ?? "default", purposes: ["report_weekly", "report_monthly", "report_lead", "report_daily"] },
  translate: { label: "厳選の全文翻訳（引用された投稿を含む）", env: "TRANSLATE_MODEL", default: DEFAULTS.translate ?? "default", purposes: ["translate_body", "translate_quoted"] },
} satisfies Record<string, Capability>;

export type CapabilityKey = keyof typeof CAPABILITIES;

/** Every step: the engine's, then the installed modules' (their defaults also from site/models.ts). */
export function capabilities(): Record<string, Capability> {
  const all: Record<string, Capability> = { ...CAPABILITIES };
  for (const m of serverModules()) for (const [key, step] of Object.entries(m.models ?? {})) all[key] = { ...step, default: DEFAULTS[key] ?? "default" };
  return all;
}

export type ProcessingMode = "agent" | "api";

/** The admin's processing switch (settings `processing`); what it leaves out comes from the environment or the site. */
export interface ProcessingSetting {
  mode?: ProcessingMode;
  intervalMinutes?: number;
}

export interface Processing {
  mode: ProcessingMode;
  source: "admin" | "env" | "site";
  /** How often the agent comes for work, as the work interface tells it (minutes). */
  intervalMinutes: number;
}

let cache: { at: number; overrides: Record<string, string>; processing: ProcessingSetting } | null = null;

async function stored(): Promise<NonNullable<typeof cache>> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const rows = await sql<{ key: string; value: { model?: string } & ProcessingSetting }[]>`
    SELECT key, value FROM settings WHERE key LIKE 'models.%' OR key = 'processing'`;
  const map: Record<string, string> = {};
  let setting: ProcessingSetting = {};
  for (const r of rows) {
    if (r.key === "processing") setting = r.value ?? {};
    else if (r.value?.model && MODELS[r.value.model]) map[r.key.slice("models.".length)] = r.value.model;
  }
  cache = { at: Date.now(), overrides: map, processing: setting };
  return cache;
}

export function invalidateModelCache() {
  cache = null;
}

const isMode = (value: unknown): value is ProcessingMode => value === "agent" || value === "api";

/** The processing mode and the agent's interval now: admin switch, else PROCESSING_MODE, else the site's. */
export async function processing(): Promise<Processing> {
  const setting = (await stored()).processing;
  const env = process.env.PROCESSING_MODE;
  const mode = isMode(setting.mode) ? setting.mode : isMode(env) ? env : PROCESSING.mode;
  const source = isMode(setting.mode) ? "admin" : isMode(env) ? "env" : "site";
  return { mode, source, intervalMinutes: setting.intervalMinutes ?? PROCESSING.intervalMinutes };
}

/** A step left to the mode: the agent in agent mode (it reads no images), else the code default. */
function modeModel(c: Capability, mode: ProcessingMode): string {
  return mode === "agent" && !c.vision ? "agent" : c.default;
}

/** The model a capability uses now: admin switch, else environment, else the processing mode's. */
export async function modelFor(capability: CapabilityKey | (string & {})): Promise<string> {
  const c = capabilities()[capability];
  if (!c) throw new Error(`unknown model step: ${capability}`);
  const chosen = (await stored()).overrides[capability] ?? process.env[c.env] ?? modeModel(c, (await processing()).mode);
  return MODELS[chosen] ? chosen : c.default;
}

export type ModelSource = "admin" | "env" | "mode" | "default";

/** Where the current choice comes from, for the admin page. */
export async function modelSources(): Promise<Record<string, { model: string; source: ModelSource }>> {
  const o = (await stored()).overrides;
  const { mode } = await processing();
  const out: Record<string, { model: string; source: ModelSource }> = {};
  for (const [key, c] of Object.entries(capabilities())) {
    if (o[key]) out[key] = { model: o[key]!, source: "admin" };
    else if (process.env[c.env] && MODELS[process.env[c.env]!]) out[key] = { model: process.env[c.env]!, source: "env" };
    else {
      const model = modeModel(c, mode);
      out[key] = { model, source: model === "agent" ? "mode" : "default" };
    }
  }
  return out;
}
