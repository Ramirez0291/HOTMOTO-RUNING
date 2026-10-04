import { useState } from "react";
import { SITE } from "@aihot/site";
import { Link, useFetcher } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/runs";
import type { AdminDeliveryIssue, AdminReceiptIssue, AdminRuns } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { ago, bj, duration, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Dot, Empty, Field, Json, ReasonDialog, Select, Stat, Time } from "../../features/admin/ui";
import { loadParts, webModules } from "../../site-modules";


export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminRuns>(request, "/api/admin/runs");
}

export const meta: Route.MetaFunction = () => [{ title: `実行 · ${SITE.name} 管理画面` }];

const STATE_LABEL: Record<string, string> = { created: "待機", retry: "再試行待ち", active: "実行中" };

const PARTS = await loadParts((m) => m.admin?.runs);

/** Who reports through the ingest API, named when nothing has reported yet: the modules' clients first. */
const ingestClients = () => [
  ...webModules().flatMap((m) => m.admin?.ingestClients ?? []),
  "収集スクリプト",
];

export default function RunsAdmin({ loaderData }: Route.ComponentProps) {
  const refresh = useFetcher<typeof loader>();
  const r = refresh.data ?? loaderData;
  const { run, pending } = useAdminAction();
  const [receipt, setReceipt] = useState<AdminReceiptIssue | null>(null);
  const [billed, setBilled] = useState("false");
  const [delivery, setDelivery] = useState<AdminDeliveryIssue | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "drop" | "resend">("sent");
  // Failure group to put back into processing ("" = every failure of the last 30 days).
  const [requeue, setRequeue] = useState<string | null>(null);

  // Live view: refresh every 20 s while visible.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh.state === "idle" && refresh.load("/admin/runs"), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const backlog = new Map<string, Record<string, { n: number; oldest: string }>>();
  for (const q of r.queues) backlog.set(q.name, { ...(backlog.get(q.name) ?? {}), [q.state]: { n: q.n, oldest: q.oldest } });
  const queued = r.queues.filter((q) => q.state !== "active").reduce((a, q) => a + q.n, 0);
  const worker = r.processes.find((p) => p.role === "worker");
  const failing = r.jobs.filter((j) => j.status === "failed");

  return (
    <AdminPage title="実行" subtitle={<>作業、待ち行列、情報源の遅れ、人の手で確認が必要な受領記録と配信。20 秒ごとに自動更新 · 最終確認 {bj(r.checkedAt)}</>}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="worker"
          value={<span className="inline-flex items-center gap-2 text-[18px]"><Dot tone={worker?.alive ? "ok" : "bad"} />{worker ? (worker.alive ? "稼働中" : "ハートビート停止") : "ハートビートなし"}</span>}
          hint={worker ? `${worker.host} · ハートビート ${ago(worker.at)}` : "worker からハートビートの報告がありません"}
        />
        <Stat label="待ち行列の滞留" value={num(queued)} tone={queued > 500 ? "warn" : undefined} hint="待機と再試行待ち" />
        <Stat label="失敗した定期作業" value={num(failing.length)} tone={failing.length ? "bad" : "ok"} hint="直近の実行が失敗" />
        <Stat label="結果不明の受領記録" value={num(r.receipts.issues.filter((x) => x.status === "unknown").length)} tone={r.receipts.issues.some((x) => x.status === "unknown") ? "bad" : "ok"} hint={`7 日で有料リクエスト ${num(Object.values(r.receipts.counts).reduce((a, b) => a + b, 0))} 回`} />
        <Stat label="確認待ちの配信" value={num(r.deliveries.filter((d) => d.status === "unknown").length)} tone={r.deliveries.some((d) => d.status === "unknown") ? "bad" : "ok"} />
      </div>

      {r.grouping.waiting > 0 && (
        <Card className="mb-5" title="重複確認待ちの厳選" right={<span>待機 {num(r.grouping.waiting)} 件 · 10 分超過 {num(r.grouping.needsAttention)} 件</span>} pad={false}>
          <p className="px-4 py-3 text-[13px] text-ink-3">これらのニュースは厳選の条件を満たしており、重複かどうかを確認してから厳選に入ります。待ち時間の長い 30 件まで表示します。</p>
          <DataTable dense rows={r.grouping.items} rowKey={(item) => item.articleId} columns={[
            { key: "title", label: "ニュース", render: (item) => <Link className="text-accent" to={`/admin/content/${item.articleId}`}>{item.title}</Link> },
            { key: "since", label: "待機開始", render: (item) => <Time at={item.since} /> },
            { key: "recovery", label: "次の段階", render: (item) => <Badge tone={item.recovery === "manual" ? "bad" : "warn"}>{item.recovery === "manual" ? "対応後に復旧" : item.recovery === "receipt" ? "有料の結果を待って自動復旧" : "自動で処理中"}</Badge> },
            { key: "error", label: "理由", render: (item) => <span className="line-clamp-2 text-[12px] text-ink-3">{item.receiptId ? `受領記録 #${item.receiptId} · ` : ""}{item.error ?? "身元の確認待ち"}</span> },
          ]} />
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="待ち行列" pad={false}>
          <DataTable
            dense
            rows={[...backlog.entries()]}
            rowKey={([name]) => name}
            empty="待ち行列は空です"
            columns={[
              { key: "n", label: "待ち行列", render: ([name]) => <span className="font-mono text-[12.5px]">{name}</span> },
              ...(["created", "retry", "active"] as const).map((st) => ({
                key: st,
                label: STATE_LABEL[st],
                align: "right" as const,
                render: ([, v]: [string, Record<string, { n: number; oldest: string }>]) => (v[st] ? <span title={`最も古い ${bj(v[st]!.oldest, true)}`}>{num(v[st]!.n)}</span> : <span className="text-ink-4">0</span>),
              })),
              { key: "old", label: "最も古い待機", render: ([, v]) => <Time at={v.created?.oldest ?? v.retry?.oldest ?? null} /> },
            ]}
          />
        </Card>
        <Card title="定期作業" pad={false}>
          <DataTable
            dense
            rows={r.jobs}
            rowKey={(j) => j.job}
            columns={[
              { key: "j", label: "作業", render: (j) => <span className="font-mono text-[12.5px]">{j.job}</span> },
              { key: "s", label: "前回", render: (j) => <Badge tone={j.status === "ok" ? "ok" : j.status === "failed" ? "bad" : "muted"} title={j.error ?? undefined}>{j.status ?? "実行中"}</Badge> },
              { key: "at", label: "日時", render: (j) => <Time at={j.started_at} /> },
              { key: "d", label: "所要時間", align: "right", render: (j) => duration(j.started_at, j.finished_at) },
              { key: "f", label: "24h 失敗", align: "right", render: (j) => (j.failed_24h ? <span className="text-hot">{j.failed_24h}/{j.runs_24h}</span> : `0/${j.runs_24h}`) },
            ]}
          />
        </Card>
      </div>

      {r.failedJobs.length > 0 && (
        <Card className="mt-5" title="24 時間以内に失敗した待ち行列の作業" pad={false}>
          <DataTable
            dense
            rows={r.failedJobs}
            rowKey={(j) => j.name}
            columns={[
              { key: "n", label: "待ち行列", render: (j) => <span className="font-mono text-[12.5px]">{j.name}</span> },
              { key: "c", label: "失敗", align: "right", render: (j) => num(j.failed) },
              { key: "l", label: "最新", render: (j) => <Time at={j.last} /> },
              { key: "o", label: "最新のエラー", render: (j) => <span className="line-clamp-2 font-mono text-[11.5px] text-ink-3">{j.last_output}</span> },
            ]}
          />
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="確認が必要な有料の受領記録" right={<span>{Object.entries(r.receipts.counts).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>} pad={false}>
          <DataTable
            dense
            rows={r.receipts.issues}
            rowKey={(x) => x.id}
            empty="対応待ちの受領記録はありません"
            columns={[
              { key: "id", label: "受領記録", render: (x) => <span className="num">#{x.id}</span> },
              { key: "s", label: "状態", render: (x) => <Badge tone={x.status === "unknown" ? "bad" : "warn"}>{x.status}</Badge> },
              { key: "w", label: "サービス", render: (x) => <span className="whitespace-nowrap">{x.service}{x.model ? ` · ${x.model}` : ""}</span> },
              { key: "p", label: "用途", render: (x) => (x.subject && /^[\w-]{10,}$/.test(x.subject) && x.purpose.includes("analy") ? <Link className="text-accent" to={`/admin/content/${x.subject}`}>{x.purpose}</Link> : x.purpose) },
              { key: "e", label: "エラー", render: (x) => <span className="line-clamp-2 text-[12px] text-ink-3" title={x.error ?? ""}>{x.error}</span> },
              { key: "a", label: "", render: (x) => (x.status === "unknown" ? <Button size="sm" onClick={() => setReceipt(x)}>確認</Button> : null) },
            ]}
          />
        </Card>
        <Card title="確認が必要な配信" pad={false}>
          <DataTable
            dense
            rows={r.deliveries}
            rowKey={(d) => d.id}
            empty="確認待ちの配信はありません"
            columns={[
              { key: "t", label: "配信先", render: (d) => d.target_key },
              { key: "s", label: "状態", render: (d) => <Badge tone={d.status === "unknown" ? "bad" : "warn"}>{d.status}</Badge> },
              { key: "sub", label: "内容", render: (d) => (d.subject_kind === "selected" ? <Link className="text-accent" to={`/admin/content/${d.subject_id}`}>{d.subject_id}</Link> : `${d.subject_kind} ${d.subject_id}`) },
              { key: "at", label: "日時", render: (d) => <Time at={d.updated_at} /> },
              { key: "a", label: "", render: (d) => <Button size="sm" onClick={() => setDelivery(d)}>対応</Button> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="遅れているか失敗している情報源" right={<Link className="text-accent" to="/admin/sources?health=failing">失敗している情報源すべて</Link>} pad={false}>
          <DataTable
            dense
            rows={r.lagging}
            rowKey={(s) => s.id}
            empty="情報源はすべて予定どおり収集しています"
            columns={[
              { key: "n", label: "情報源", render: (s) => <Link className="text-ink hover:text-accent" to={`/admin/sources/${encodeURIComponent(s.id)}`}>{s.name}</Link> },
              { key: "h", label: "状態", render: (s) => <Badge tone={s.health === "failing" ? "bad" : s.health === "degraded" ? "warn" : "muted"}>{s.health}</Badge> },
              { key: "ok", label: "前回の成功", render: (s) => <Time at={s.last_ok_at} /> },
              { key: "nx", label: "取得予定", render: (s) => <Time at={s.next_fetch_at} /> },
              { key: "e", label: "エラー", render: (s) => <span className="line-clamp-1 text-[12px] text-ink-3" title={s.last_error ?? ""}>{s.last_error}</span> },
            ]}
          />
        </Card>
        <Card
          title="処理の失敗（30 日、エラー別）"
          right={
            <span className="flex items-center gap-3">
              {r.retrying.count > 0 && <span>再試行待ち {num(r.retrying.count)} 件 · 次回 <Time at={r.retrying.next} /></span>}
              {r.errors.length > 0 && <Button size="sm" onClick={() => setRequeue("")}>すべて処理し直す</Button>}
            </span>
          }
          pad={false}
        >
          <DataTable
            dense
            rows={r.errors}
            rowKey={(e) => e.error}
            empty="処理の失敗はありません"
            columns={[
              { key: "e", label: "エラー", render: (e) => <span className="font-mono text-[11.5px] text-ink-2">{e.error}</span> },
              { key: "n", label: "件数", align: "right", render: (e) => num(e.n) },
              { key: "x", label: "例", render: (e) => <Link className="text-accent" to={`/admin/content/${e.example}`}>見る</Link> },
              { key: "l", label: "最新", render: (e) => <Time at={e.last} /> },
              { key: "a", label: "", align: "right", render: (e) => <Button size="sm" onClick={() => setRequeue(e.error)}>処理し直す</Button> },
            ]}
          />
        </Card>
      </div>

      {PARTS.map(({ name, part: Part }) => (r.modules[name] != null ? <Part key={name} data={r.modules[name]} /> : null))}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="作業の時系列" pad={false}>
          <div className="max-h-[420px] overflow-y-auto">
            <DataTable
              dense
              rows={r.timeline}
              rowKey={(t) => t.id}
              columns={[
                { key: "at", label: "開始", render: (t) => <span className="num whitespace-nowrap">{bj(t.started_at)}</span> },
                { key: "j", label: "作業", render: (t) => <span className="font-mono text-[12px]">{t.job}</span> },
                { key: "s", label: "結果", render: (t) => <Badge tone={t.status === "ok" ? "ok" : t.status === "failed" ? "bad" : "muted"} title={t.error ?? undefined}>{t.status ?? "実行中"}</Badge> },
                { key: "d", label: "所要時間", align: "right", render: (t) => duration(t.started_at, t.finished_at) },
              ]}
            />
          </div>
        </Card>
        <Card title="外部からの送信" pad={false}>
          {r.ingest.length ? (
            <DataTable
              dense
              rows={r.ingest}
              rowKey={(e) => `${e.client}-${e.created_at}`}
              columns={[
                { key: "at", label: "日時", render: (e) => <Time at={e.created_at} /> },
                { key: "c", label: "クライアント", render: (e) => e.client },
                { key: "k", label: "種類", render: (e) => e.kind },
                { key: "s", label: "結果", render: (e) => <Badge tone={e.status === "ok" ? "ok" : e.status === "error" ? "bad" : "muted"} title={e.error ?? undefined}>{e.status}</Badge> },
                { key: "x", label: "概要", render: (e) => <Json value={e.summary} label="概要" /> },
              ]}
            />
          ) : (
            <Empty>{`外部からの送信はまだありません（${ingestClients().join("、")}）`}</Empty>
          )}
        </Card>
      </div>

      {r.processes.length > 0 && (
        <Card className="mt-5" title="プロセス">
          <ul className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {r.processes.map((p) => (
              <li key={p.role} className="flex items-center gap-2">
                <Dot tone={p.alive ? "ok" : "bad"} />
                <span className="font-medium">{p.role}</span>
                <span className="text-ink-3">{p.host} · pid {p.pid} · {p.release} · {bj(p.startedAt)} に起動</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReasonDialog
        open={!!receipt}
        title={`受領記録 #${receipt?.id ?? ""} を確認`}
        description="結果不明のリクエストは自動では再送しません。先に提供元のコンソールでこのリクエストが課金されたか確認してから解放してください。解放すると、次の処理で呼び出しをやり直します。"
        confirmLabel="記録して解放"
        busy={pending === "release"}
        onClose={() => setReceipt(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/receipts/${receipt!.id}/release`, { billed: billed === "true", note }, { label: "release", success: "解放しました" })) !== null}
      >
        <Field label="提供元の課金の有無">
          <Select value={billed} onChange={(e) => setBilled(e.target.value)}>
            <option value="false">未課金（リクエストは受け付けられていない）</option>
            <option value="true">課金済み（結果は取得できていない）</option>
          </Select>
        </Field>
      </ReasonDialog>
      <ReasonDialog
        open={requeue !== null}
        title={requeue ? "この種類の失敗を処理し直す" : "すべての失敗を処理し直す"}
        description="これらの記事は処理の待ち行列に戻ります（本文、判断、公開）。モデルの呼び出しは改めて課金され、提供元に拒否された内容は再び失敗することがあります。"
        confirmLabel="処理し直す"
        busy={pending === "requeue"}
        onClose={() => setRequeue(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/processing/requeue", { group: requeue || null, reason }, { label: "requeue", success: "待ち行列に戻しました" })) !== null}
      />
      <ReasonDialog
        open={!!delivery}
        title="配信に対応"
        description="先に該当する飛書グループで届いているか確認してください。届いていないと確認できたら再送します。開発環境では実際には送られません。"
        confirmLabel="確認"
        danger={outcome === "resend"}
        busy={pending === "delivery"}
        onClose={() => setDelivery(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/deliveries/${delivery!.id}/resolve`, { outcome, note }, { label: "delivery", success: "対応しました" })) !== null}
      >
        <Field label="結果">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="sent">グループに届いていたので、到達済みにする</option>
            <option value="drop">もう送らない</option>
            <option value="resend">グループに届いていないので、再送する</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
