// The Monday source-health report for the ops chat. It goes through the same gated channel as the
// alerts (off unless FEISHU_INTERNAL_ENABLED).
import { sql } from "../db.ts";
import { sendAlert } from "../notify/feishu.ts";
import { serverModules } from "../modules.ts";
import { sourceHealth, sourceHealthList } from "../sources/health.ts";

/** The change from b to a: "+12%", "—" without a b. Also the modules' reports. */
export const pct = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(0)}%` : "—");
/** A count with thousands separators. */
export const n = (v: number) => v.toLocaleString("en-US");

/** Monday 09:00: how the sources did over the last seven days. */
export async function sourceHealthWeekly(now = Date.now()) {
  const since = new Date(now - 7 * 86400_000);
  const before = new Date(now - 14 * 86400_000);
  const [[counts], [items], groups] = await Promise.all([
    sql<{ enabled: number; failing: number; degraded: number; added: number }[]>`
      SELECT count(*) FILTER (WHERE enabled)::int AS enabled,
             count(*) FILTER (WHERE enabled AND health = 'failing')::int AS failing,
             count(*) FILTER (WHERE enabled AND health = 'degraded')::int AS degraded,
             count(*) FILTER (WHERE created_at >= ${since})::int AS added
      FROM sources`,
    sql<{ week: number; prev: number; selected: number }[]>`
      SELECT count(*) FILTER (WHERE discovered_at >= ${since})::int AS week,
             count(*) FILTER (WHERE discovered_at >= ${before} AND discovered_at < ${since})::int AS prev,
             (SELECT count(*)::int FROM publications p WHERE p.selected AND p.visibility <> 'withdrawn' AND p.discovered_at >= ${since}) AS selected
      FROM articles WHERE discovered_at >= ${before}`,
    sourceHealth(now),
  ]);
  const lines = [
    `今週の収録 ${n(items!.week)} 件（先週 ${n(items!.prev)}、${pct(items!.week, items!.prev)}）、うち厳選 ${n(items!.selected)} 件`,
    `使用中の情報源 ${counts!.enabled} 件、今週の追加 ${counts!.added} 件。取得失敗 ${counts!.failing} 件、やや不安定 ${counts!.degraded} 件`,
  ];
  // The modules' own collectors, a line each.
  for (const m of serverModules()) if (m.sourceHealth) lines.push(...(await m.sourceHealth(now)));
  for (const group of groups) {
    lines.push("", `${group.name}：使用中の情報源 ${group.sources.length} 件。今週の所属記事 ${n(group.sources.reduce((sum, s) => sum + s.items, 0))} 件。連続失敗 ${group.failing.length} 件、失敗の繰り返し ${group.unstable.length} 件、7 日間新着なし ${group.silent.length} 件`);
    if (group.failing.length) lines.push(`取得失敗：${sourceHealthList(group.failing, s => `連続失敗 ${s.fail_count} 回${s.last_error ? `（${s.last_error}）` : ""}`, Infinity)}`);
    if (group.unstable.length) lines.push(`不安定：${sourceHealthList(group.unstable, s => `失敗 ${s.failed}/${s.runs} 回`, Infinity)}`);
    if (group.silent.length) lines.push(`7 日間新着なし（元サイトと照合が必要。更新が少ないだけの可能性あり）：${sourceHealthList(group.silent, s => `取得 ${s.runs} 回`, Infinity)}`);
    if (group.quality.length) lines.push(`記事の質を要確認：${sourceHealthList(group.quality, s => `発表日時なし ${s.undated} 本、修正の繰り返し ${s.repeated} 本`, Infinity)}`);
    if (group.detailFailures.length) lines.push(`詳細の補完に失敗：${sourceHealthList(group.detailFailures, s => `${s.detail_failures} 回`, Infinity)}`);
  }
  const failing = counts!.failing;
  const silent = groups.reduce((sum, g) => sum + g.silent.length, 0);
  const followUp = counts!.failing > 0 || groups.some(g => g.failing.length || g.unstable.length || g.silent.length || g.quality.length || g.detailFailures.length);
  lines.push("", followUp ? "対応が必要なら、このメッセージを AI に渡してください。詳細は管理画面の「情報源」と「実行」ページにあります。" : "対応が必要な情報源はありません。");
  await sendAlert("📊 情報源の週報", lines);
  return { failing, silent };
}
