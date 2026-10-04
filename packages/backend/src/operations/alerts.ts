// Operations alerts. The person reading them is the site owner, not an engineer: each
// message says what readers see, whether it heals by itself and what, if anything, the owner must do.
//   now    — readers are affected and it has not healed: sent at once, repeated hourly, recovery reported.
//   today  — money at risk or only the owner can act: sent at once, repeated at most daily, recovery reported.
//   digest — other follow-ups: one 09:00 message a day, meant to be handed to the AI.
// Delivery goes through sendAlert (ops chat, internal-chat fallback; off unless FEISHU_INTERNAL_ENABLED).
import { siteAt, siteDate } from "@aihot/contracts/time";
import { ALERTS, EDITION_TIMES } from "@aihot/site";
import { sql } from "../db.ts";
import { siteDay, siteStamp, duration, formatAlert, formatRecovery, sendAlert, type Finding, type Level } from "../notify/feishu.ts";
import { backupConfigured } from "./backup.ts";
import { GROUPING_WARN_AFTER_MS, waitingSelectedNews } from "./grouping.ts";
import { upstreamFindings } from "../media/upstream.ts";
import { serverModules } from "../modules.ts";
import { sourceHealth, sourceHealthList } from "../sources/health.ts";

const REPEAT_MS: Record<Exclude<Level, "digest">, number> = { now: 3600_000, today: 24 * 3600_000 };

/** What the content groups receive, as the alerts name it: the engine's cards, then the modules' pushes. */
const pushes = () => ["厳選", ...serverModules().flatMap((m) => m.pushes ?? [])];

// Valves default off: read at call time, only an explicit "true" turns them on.
const collecting = () => process.env.COLLECT_ENABLED === "true";
const modelsOn = () => process.env.MODEL_CALLS_ENABLED === "true";
/**
 * How long the site may go without a new article before it counts as stalled (ALERT_QUIET_MINUTES, else
 * the site's own setting; small source lists are quieter). At most a day: the check looks one day back.
 */
const QUIET_MINUTES = Math.min(Number(process.env.ALERT_QUIET_MINUTES || ALERTS.quietMinutes), 1440);

/** Everything wrong right now, with its level. */
export async function collectFindings(now = Date.now()): Promise<Finding[]> {
  const out: Finding[] = [];

  // Readers affected now
  // Content flow, judged by outcome: whatever broke (worker, egress proxy, models, queues), readers see
  // a site that stops changing. Skipped for 20 minutes after the worker starts, and where the valves are off.
  const [hb] = await sql<{ value: { startedAt?: string } }[]>`SELECT value FROM settings WHERE key = 'heartbeat.worker'`;
  const settled = !hb?.value.startedAt || now - Date.parse(hb.value.startedAt) > 20 * 60_000;
  if (settled && collecting()) {
    const [last] = await sql<{ at: Date | null }[]>`SELECT max(a.discovered_at) AS at FROM articles a
      JOIN sources s ON s.id = a.source_id WHERE s.participation_mode = 'editorial' AND a.discovered_at > now() - interval '1 day'`;
    if (!last?.at || now - last.at.getTime() > QUIET_MINUTES * 60_000) {
      // A site without an enabled source has nothing to collect.
      const [anySource] = await sql`SELECT 1 FROM sources WHERE enabled AND participation_mode = 'editorial' LIMIT 1`;
      if (anySource) {
        out.push({
          key: "content.collect",
          level: "now",
          title: "サイトが新しい記事を収録しなくなっています",
          impact: last?.at ? `最後の編集内容の収録は ${siteStamp(last.at)} で、その後新しい記事が処理に入っていません` : "1 日のあいだ編集内容を一件も収録していません",
          heals: ALERTS.usualFlow ? `いいえ。${ALERTS.usualFlow}` : "いいえ",
          action: "すぐに AI に渡して対応してください",
          detail: `editorial articles.discovered_at が ${QUIET_MINUTES} 分以上新しい値になっていません（話題度のシグナルは別に評価）。sources.schedule、送信プロキシ、収集の失敗を確認`,
          since: last?.at ?? undefined,
        });
      }
    }
  }
  if (settled && collecting() && modelsOn()) {
    const waiting = (await waitingSelectedNews()).filter((item) => now - item.since.getTime() >= GROUPING_WARN_AFTER_MS);
    if (waiting.length) {
      const manual = waiting.filter((item) => item.recovery === "manual").length;
      const receipt = waiting.some((item) => item.recovery === "receipt");
      out.push({
        key: "content.grouping",
        level: "now",
        title: "厳選ニュースが重複確認で止まり、まだ公開されていません",
        impact: `厳選の条件を満たした ${waiting.length} 件のニュースが 10 分以上確認待ちで、まだ厳選に入っていません。読者がこれらの更新を見るのが遅れる可能性があります`,
        heals: manual ? `${manual} 件は人の手で処理しないと復旧しません${manual < waiting.length ? "。残りは自動で復旧中です" : ""}`
          : receipt ? "自動復旧を待っています。有料で結果不明のリクエストは 30 分後に自動で 1 回解放されます" : "自動で再試行しますが、待ち時間はすでに通常の範囲を超えています",
        action: manual ? "AI に渡して対応してください。結果不明の有料リクエストは、課金と結果を確認してから解放するか決めてください" : "AI に渡して待ちの原因を調べ、これ以上たまらないようにしてください",
        detail: waiting.slice(0, 8).map((item) => `${item.articleId}（${duration(now - item.since.getTime())}）${item.receiptId ? ` 受領記録 #${item.receiptId}` : ""}${item.error ? `：${item.error.slice(0, 120)}` : ""}`).join("、"),
        since: waiting[0]!.since,
      });
    }
    const [p] = await sql<{ waiting: number; oldest: Date | null; failed: number }[]>`
      SELECT count(*) FILTER (WHERE processing_state = 'new' AND discovered_at < now() - interval '2 hours')::int AS waiting,
             min(discovered_at) FILTER (WHERE processing_state = 'new') AS oldest,
             count(*) FILTER (WHERE processing_state = 'failed' AND discovered_at > now() - interval '3 hours')::int AS failed
      FROM articles WHERE processing_state IN ('new', 'failed') AND discovered_at > now() - interval '2 days'`;
    if (p!.waiting >= 10 || p!.failed >= 20) {
      const errors = await sql<{ error: string; n: number }[]>`
        SELECT left(coalesce(processing_error, '（なし）'), 120) AS error, count(*)::int AS n FROM articles
        WHERE processing_state IN ('new', 'failed') AND discovered_at > now() - interval '3 hours' AND processing_error IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3`;
      out.push({
        key: "content.process",
        level: "now",
        title: "新しい内容が止まり、サイトに入っていません",
        impact: [p!.waiting >= 10 && `${p!.waiting} 本の新しい記事が 2 時間以上待っていてまだ処理が終わっていません`, p!.failed >= 20 && `直近 3 時間で ${p!.failed} 本の新しい記事の処理に失敗しました`]
          .filter(Boolean)
          .join("。") + "。厳選と話題に内容が欠けます",
        heals: p!.waiting >= 10 ? "サービスが復旧すれば自動で処理し直します" : "いいえ。直した後にこれらの記事を処理し直す必要があります",
        action: "AI に渡して対応してください",
        detail: errors.map((e) => `${e.error}（${e.n}）`).join("、") || "記録されたエラーはありません",
        since: p!.waiting >= 10 && p!.oldest ? p!.oldest : undefined,
      });
    }
    // The daily report is composed from its edition time, and tried again every half hour until it exists:
    // two hours later it is overdue.
    if (now >= siteAt(siteDate(now), EDITION_TIMES.daily).getTime() + 2 * 3600_000) {
      const [r] = await sql`SELECT 1 FROM reports WHERE kind = 'daily' AND key = ${siteDate(now)}`;
      if (!r) {
        out.push({
          key: "report.daily",
          level: "now",
          title: "今日の日報がまだ作られていません",
          impact: "読者が今日の日報を見られません",
          heals: "システムは 30 分ごとに作り直しを試みますが、いまのところ成功していません",
          action: "AI に渡して対応してください",
          detail: `reports daily ${siteDate(now)} が存在しません。reports.compose の実行記録を確認`,
        });
      }
    }
  }

  // Money, and things only the owner can do
  out.push(...(await providerFindings()));

  // Content-group pushes the Feishu webhook refused (a removed bot, a changed address); nothing resends them.
  const [refused] = await sql<{ n: number; target: string | null; response: string | null }[]>`
    SELECT count(*)::int AS n, max(t.note) AS target, left(max(d.response), 200) AS response FROM deliveries d JOIN notify_targets t ON t.key = d.target_key
    WHERE d.status = 'failed' AND d.updated_at > now() - interval '1 day'`;
  if (refused!.n > 0) {
    out.push({
      key: "deliveries.failed",
      level: "today",
      title: "飛書のコンテンツ配信グループに届いていない配信があります",
      impact: `過去 24 時間で ${refused!.n} 件の${pushes().join("・")}の通知が${refused!.target ?? "コンテンツ配信グループ"}に届いていません`,
      heals: "自動では再送しません",
      action: "AI に渡して対応してください。配信ボットがグループから外されている場合は、グループに戻してください",
      detail: refused!.response ?? "",
    });
  }

  if (backupConfigured()) {
    const [b] = await sql<{ value: { at: string; uploaded: boolean; filesError?: string } }[]>`SELECT value FROM settings WHERE key = 'backup.last'`;
    // A failed archive updates backup.last too. Reuse the run history so repeated failures cannot
    // reset the age; before the first success, count from the first attempt rather than from now.
    const [runs] = await sql<{ last_ok: Date | null; first_attempt: Date | null }[]>`
      SELECT max(finished_at) FILTER (WHERE status = 'ok') AS last_ok, min(started_at) AS first_attempt
      FROM job_runs WHERE job = 'ops.backup'`;
    const lastOk = Math.max(runs?.last_ok?.getTime() ?? 0, b?.value.uploaded ? Date.parse(b.value.at) : 0);
    const since = lastOk || runs?.first_attempt?.getTime() || now;
    const age = now - since;
    const state = b?.value.filesError ? `データベースはアップロード済み、添付ファイルのまとめに失敗：${b.value.filesError}` : b?.value.uploaded === false ? "未アップロード" : "";
    if (age > 50 * 3600_000) {
      out.push({
        key: "backup.failed",
        level: "today",
        title: "データベースのバックアップが 2 日続けて成功していません",
        impact: lastOk ? `万一サーバーに問題が起きると、直近 ${duration(age)} のデータを完全には復元できない可能性があります` : "成功した完全なバックアップがまだなく、サーバーに問題が起きるとデータを復元できない可能性があります",
        heals: "いいえ",
        action: "AI に渡して対応してください",
        detail: `${lastOk ? "最後の成功" : "最初のバックアップの試み"} ${siteStamp(since)}${state ? `。${state}` : ""}。ops.backup の実行記録を確認`,
        since: new Date(since),
      });
    } else if (!b || !b.value.uploaded || age > 30 * 3600_000) {
      out.push({ key: "backup.stale", level: "digest", title: "データベースのバックアップが 1 日以上成功していません", detail: b ? `最後 ${siteStamp(b.value.at)}${state ? `（${state}）` : ""}。ops.backup を確認` : "成功したバックアップの記録がまだありません" });
    }
  }

  out.push(...(await upstreamFindings(now)));

  // What the site's modules find.
  for (const m of serverModules()) if (m.alerts) out.push(...(await m.alerts(now)));

  // Follow-ups for the daily digest
  if (collecting()) {
    for (const group of await sourceHealth(now)) {
      if (group.failing.length) out.push({
        key: `sources.failing.${group.mode}`, level: "digest", title: `${group.name}で ${group.failing.length} 件の情報源の取得が連続して失敗しています`,
        detail: sourceHealthList(group.failing, s => `連続失敗 ${s.fail_count} 回${s.last_error ? `、${s.last_error}` : ""}`) + "。AI に渡して取得のエラーを調べてください",
      });
      if (group.unstable.length) out.push({
        key: `sources.unstable.${group.mode}`, level: "digest", title: `${group.name}で ${group.unstable.length} 件の情報源の取得が失敗を繰り返しています`,
        detail: sourceHealthList(group.unstable, s => `直近 7 日で失敗 ${s.failed}/${s.runs} 回`) + "。最近成功していても、取りこぼしが続かないよう確認してください",
      });
      if (group.silent.length) out.push({
        key: `sources.silent.${group.mode}`, level: "digest", title: `${group.name}で ${group.silent.length} 件の情報源に 7 日間新しい内容がありません`,
        detail: sourceHealthList(group.silent, s => `直近 7 日で取得 ${s.runs} 回、新着 0 件`) + "。元サイトと照合して、更新が少ないだけか収集が壊れているかを見分けてください",
      });
      if (group.quality.length) out.push({
        key: `sources.quality.${group.mode}`, level: "digest", title: `${group.name}で ${group.quality.length} 件の情報源の記事の質を確認する必要があります`,
        detail: sourceHealthList(group.quality, s => `直近 7 日で発表日時なし ${s.undated} 本、修正の繰り返し ${s.repeated} 本`) + "。日時がないとニュースが過去の記事として扱われることがあり、修正の繰り返しは本文に変わる内容が混じっていないか確認してください",
      });
      if (group.detailFailures.length) out.push({
        key: `sources.details.${group.mode}`, level: "digest", title: `${group.name}で ${group.detailFailures.length} 件の情報源の詳細の補完が失敗しています`,
        detail: sourceHealthList(group.detailFailures, s => `直近 7 日で ${s.detail_failures} 回`) + "。取得記録の詳細ページのアドレスとエラーを確認してください",
      });
    }
  }
  const [r] = await sql<{ receipts: number; services: string | null; deliveries: number }[]>`
    SELECT (SELECT count(*)::int FROM receipts WHERE status = 'unknown') AS receipts,
           (SELECT string_agg(DISTINCT service || '/' || purpose, '、') FROM receipts WHERE status = 'unknown') AS services,
           (SELECT count(*)::int FROM deliveries WHERE status = 'unknown') AS deliveries`;
  if (r!.receipts > 0) {
    out.push({ key: "receipts.unknown", level: "digest", title: `${r!.receipts} 件の有料リクエストの結果がまだ確認されていません`, detail: `${r!.services}。内容の処理に影響する可能性があります。影響は管理画面の「実行」ページで確認し、自動復旧後も不明なリクエストは確認してから解放してください` });
  }
  if (r!.deliveries > 0) out.push({ key: "deliveries.unknown", level: "digest", title: `飛書のコンテンツ配信グループへの配信 ${r!.deliveries} 件が届いたか不明です`, detail: "管理画面の「実行」ページでグループに届いているか確認し、記録するか再送してください" });

  // Runnable jobs (deferred ones excluded) that have waited more than two hours.
  const queues = await sql<{ name: string; n: number; oldest: Date }[]>`
    SELECT name, count(*)::int AS n, min(start_after) AS oldest FROM pgboss.job
    WHERE state IN ('created', 'retry') AND start_after <= now() AND name NOT LIKE 'cron.%' GROUP BY 1`;
  for (const q of queues) {
    if (now - q.oldest.getTime() > 2 * 3600_000) {
      out.push({ key: `queue.${q.name}`, level: "digest", title: `バックグラウンドの作業が 2 時間以上待っています：${q.name}`, detail: `${q.n} 件が待機中、最も古いものは ${duration(now - q.oldest.getTime())} 待っています` });
    }
  }

  // The site's modules' follow-ups.
  for (const m of serverModules()) if (m.followUps) out.push(...(await m.followUps(now)));
  return out;
}

/** What stops when a model service refuses us: the site's own words for its models, else a pointer to the admin. */
const modelStops = (service: string) => ALERTS.modelStops[service] ?? "このモデルを使う工程が止まりました（管理画面の「モデルと評価」を参照）。新しい内容が厳選に入らない可能性があります";
const PROVIDERS: Record<string, { name: string; stops: string; where: string }> = {
  llm: { name: "既定のモデルサービス", stops: "新しい記事の厳選、要約、まとめ、日報が止まりました", where: "モデル提供元の管理コンソール" },
  zhipu: { name: "智譜（Zhipu）", stops: modelStops("zhipu"), where: "智譜オープンプラットフォーム" },
  dashscope: { name: "阿里雲 百煉（DashScope）", stops: modelStops("dashscope"), where: "阿里雲 百煉のコンソール" },
  deepseek: { name: "DeepSeek", stops: modelStops("deepseek"), where: "DeepSeek オープンプラットフォーム" },
  mimo: { name: "Xiaomi MiMo", stops: modelStops("mimo"), where: "Xiaomi MiMo オープンプラットフォーム" },
  socialdata: { name: "SocialData", stops: "X の新しい内容を受け取れません", where: "SocialData の管理画面" },
  jina: { name: "Jina", stops: "一部の記事の本文を取得できません", where: "Jina の管理画面" },
  dajiala: { name: "極致了（Dajiala）", stops: "WeChat 公式アカウントの新しい記事を受け取れません", where: "極致了の管理画面" },
};
export const providerName = (service: string) => PROVIDERS[service]?.name ?? service;
export const providerStops = (service: string) => PROVIDERS[service]?.stops ?? "関連する機能が止まりました";
export const providerConsole = (service: string) => PROVIDERS[service]?.where ?? `${service} の管理画面`;

/** Paid services that refuse us (no balance, a dead key), and daily budgets used up. */
async function providerFindings(): Promise<Finding[]> {
  const out: Finding[] = [];
  const refused = await sql<{ service: string; n: number; last: string }[]>`
    SELECT service, count(*)::int AS n, (array_agg(left(error, 200) ORDER BY started_at DESC))[1] AS last FROM receipt_attempts
    WHERE status = 'failed' AND started_at > now() - interval '1 hour'
      AND error ~* '(HTTP 40[123]\\M|insufficient|balance|arrear|good standing|欠费|余额)'
    GROUP BY 1 HAVING count(*) >= 3`;
  for (const p of refused) {
    out.push({
      key: `provider.refused.${p.service}`,
      level: "today",
      title: `${providerName(p.service)} がサービスを拒否しています。残高不足かアカウントの無効化の可能性があります`,
      impact: providerStops(p.service),
      heals: "いいえ",
      action: `${providerConsole(p.service)}で残高とアカウントの状態を確認してください。チャージか復旧の後、システムは自動で再開します`,
      detail: `直近 1 時間で ${p.n} 回拒否：${p.last}`,
    });
  }
  const capped = await sql<{ service: string; per_day: number; used: number }[]>`
    SELECT b.service, b.per_day, count(a.id)::int AS used FROM budgets b
    JOIN receipt_attempts a ON a.service = b.service AND a.origin = 'live' AND a.started_at > now() - interval '1 day'
    WHERE b.per_day > 0 GROUP BY 1, 2 HAVING count(a.id) >= b.per_day`;
  for (const c of capped) {
    out.push({
      key: `budget.day.${c.service}`,
      level: "today",
      title: `${providerName(c.service)} の過去 24 時間の呼び出し枠を使い切りました`,
      impact: `${providerStops(c.service)}。時間がたって枠が空くまで続きます`,
      heals: "はい。枠は 24 時間の移動枠で回復します",
      action: "今回は対応不要です。頻繁に起きるなら、枠を上げるか検討してください",
      detail: `24 時間で ${c.used} 回、上限 ${c.per_day}（budgets テーブル）`,
    });
  }
  return out;
}

interface AlertState {
  [key: string]: { title: string; since: string; sentAt: string };
}

/** Every 10 minutes: new problems and recoveries of the now/today levels go out; digest items wait for 09:00. */
export async function checkAlerts(now = Date.now()) {
  const found = (await collectFindings(now)).filter((f) => f.level !== "digest");
  const [row] = await sql<{ value: AlertState }[]>`SELECT value FROM settings WHERE key = 'alerts.state'`;
  const state: AlertState = { ...(row?.value ?? {}) };
  const sent: string[] = [];
  for (const f of found) {
    const open = state[f.key];
    if (open && now - Date.parse(open.sentAt) <= REPEAT_MS[f.level as Exclude<Level, "digest">]) continue;
    const since = open ? new Date(open.since) : (f.since ?? new Date(now));
    const msg = formatAlert(f, since, now, !!open);
    await sendAlert(msg.title, msg.lines);
    state[f.key] = { title: f.title, since: since.toISOString(), sentAt: new Date(now).toISOString() };
    sent.push(f.key);
  }
  for (const [key, open] of Object.entries(state)) {
    if (found.some((f) => f.key === key)) continue;
    const msg = formatRecovery(open.title, new Date(open.since), now);
    await sendAlert(msg.title, msg.lines);
    sent.push(`${key}:recovered`);
    delete state[key];
  }
  await sql`INSERT INTO settings (key, value, updated_by) VALUES ('alerts.state', ${sql.json(state as never)}, 'alerts')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return { open: Object.keys(state), sent };
}

/** 09:00: one message with other follow-ups; nothing when there are none. */
export async function sendDigest(now = Date.now()) {
  const items = (await collectFindings(now)).filter((f) => f.level === "digest");
  const lines = items.map((f, i) => `${i + 1}. ${f.title}${f.detail ? `\n   ${f.detail}` : ""}`);
  if (!lines.length) return { items: 0 };
  await sendAlert(`📋 システム日報 · ${siteDay(now)}`, ["以下の事項に対応が必要です。具体的な影響は各項目の説明を参照してください。このメッセージをそのまま AI に渡して対応できます。", ...lines]);
  return { items: lines.length };
}
