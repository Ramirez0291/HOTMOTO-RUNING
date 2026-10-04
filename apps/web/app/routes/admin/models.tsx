import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/models";
import type { AdminModels } from "@hotmoto/contracts/admin";
import { SITE } from "@hotmoto/site";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, money, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Empty, Field, FilterChips, Input, ReasonDialog, Select, Stat } from "../../features/admin/ui";
import { webModules } from "../../site-modules";



export async function loader({ request }: Route.LoaderArgs) {
  const days = new URL(request.url).searchParams.get("days") ?? "7";
  return adminGet<AdminModels>(request, `/api/admin/models?days=${encodeURIComponent(days)}`);
}

export const meta: Route.MetaFunction = () => [{ title: `モデルと評価 · ${SITE.name} 管理画面` }];

const SOURCE_LABEL = { admin: "管理画面で切り替え", env: "環境変数", mode: "処理方式（Agent）", default: "コードの既定" } as const;
const MODE_SOURCE_LABEL = { admin: "管理画面で切り替え", env: "環境変数 PROCESSING_MODE", site: "サイトの既定（site/models.ts）" } as const;
const MODE_LABEL = { agent: "Agent", api: "API" } as const;

type Change = { mode: "agent" | "api" } | { intervalMinutes: number };

/**
 * The processing mode: an agent that comes for work on its own schedule (no API), or the models' APIs.
 * The switch moves every step without a model of its own at once; the agent's queue shows whether it is coming.
 */
function ProcessingCard({ p }: { p: AdminModels["processing"] }) {
  const { run, pending } = useAdminAction();
  const [change, setChange] = useState<Change | null>(null);
  const [minutes, setMinutes] = useState(String(p.intervalMinutes));
  const oldestMinutes = p.queue.oldestAt ? (Date.now() - Date.parse(p.queue.oldestAt)) / 60_000 : null;
  // A task older than two intervals: the agent has missed at least one round.
  const late = oldestMinutes !== null && oldestMinutes > p.intervalMinutes * 2;
  const agent = p.mode === "agent";
  return (
    <Card
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          処理方式
          <span className="font-mono text-[12px] font-normal text-ink-3">{MODE_LABEL[p.mode]}</span>
          <Badge tone={p.source === "admin" ? "accent" : "muted"}>{MODE_SOURCE_LABEL[p.source]}</Badge>
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          <div role="radiogroup" aria-label="処理方式" className="neu-inset grid grid-cols-2 gap-1 rounded-full p-1">
            {(["agent", "api"] as const).map((mode) => {
              const on = p.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !on && setChange({ mode })}
                  className={`h-9 rounded-full text-[13.5px] font-medium transition-[box-shadow,color] ${on ? "bg-surface text-accent shadow-[var(--shadow-thumb)]" : "text-ink-3 hover:text-ink"}`}
                >
                  {mode === "agent" ? "Agent（API を使わない）" : "API"}
                </button>
              );
            })}
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            {agent
              ? "工程ごとにモデルを選んでいない工程は、Agent が定期的に作業を取りに来て答えます。答えが届くまで記事は待ち、届くとすぐ次の工程へ進みます。"
              : "工程ごとにモデルを選んでいない工程は、コードの既定のモデル（site/models.ts の DEFAULTS か default）の API で処理します。"}
            工程ごとに切り替えたモデルはこれより優先します。接続方法は docs/agent.md を参照してください。
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            Agent の処理間隔：<span className="num font-semibold">{p.intervalMinutes} 分</span>
            <Button size="sm" onClick={() => { setMinutes(String(p.intervalMinutes)); setChange({ intervalMinutes: p.intervalMinutes }); }}>
              変更
            </Button>
          </div>
          {agent && !p.agentReady && (
            <p className="rounded-control bg-hot-soft px-3 py-2 text-[12.5px] leading-relaxed text-hot">
              AGENT_TOKEN が設定されていないため、作業のインターフェースは閉じています。.env に 16 文字以上の AGENT_TOKEN を設定して再起動してください。
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="待ち" value={p.queue.waiting} hint="Agent の答えを待つ作業" tone={late ? "warn" : undefined} />
          <Stat label="取得済み" value={p.queue.claimed} hint="Agent が処理中" />
          <Stat
            label="最も古い待ち"
            value={oldestMinutes === null ? "—" : oldestMinutes < 60 ? `${Math.round(oldestMinutes)} 分` : `${Math.round(oldestMinutes / 60)} 時間`}
            hint={late ? "Agent が来ていない可能性があります" : p.queue.oldestAt ? bj(p.queue.oldestAt) : undefined}
            tone={late ? "warn" : undefined}
          />
          <Stat label="24 時間の回答" value={num(p.queue.answeredDay)} />
        </div>
      </div>
      <ReasonDialog
        open={!!change}
        title={change && "mode" in change ? `処理方式を ${MODE_LABEL[change.mode]} に切り替え` : "Agent の処理間隔を変更"}
        description={
          change && "mode" in change
            ? change.mode === "agent"
              ? "工程ごとにモデルを選んでいない工程が、次の作業から Agent の待ちになります。AGENT_TOKEN と、作業を取りに来る Agent が必要です。"
              : "工程ごとにモデルを選んでいない工程が、次の作業から API で処理されます。モデルの API キーが必要です。Agent の答えを待っている作業も API で処理し直します。"
            : "作業のインターフェースが Agent に伝える間隔です。Agent 自体の実行の予定は、Agent 側で合わせてください。"
        }
        confirmLabel={change && "mode" in change ? "切り替え" : "変更"}
        busy={pending === "processing"}
        onClose={() => setChange(null)}
        onSubmit={async (reason) =>
          (await run(
            "PUT",
            "/api/admin/processing",
            { ...(change && "mode" in change ? { mode: change.mode } : { intervalMinutes: Number(minutes) }), reason },
            { label: "processing", success: "変更しました。次の作業から有効です" },
          )) !== null
        }
      >
        {change && !("mode" in change) && (
          <Field label="間隔（分）" hint="5〜1440">
            <Input type="number" min={5} max={1440} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        )}
      </ReasonDialog>
    </Card>
  );
}

/** A cost the provider did not report and no price covers: a link to the prices when a module keeps them. */
function Unpriced() {
  const prices = webModules().find((m) => m.admin?.prices)?.admin?.prices;
  if (prices) return <Link to={prices} className="whitespace-nowrap text-ink-4 hover:text-accent">価格未設定</Link>;
  return <span className="whitespace-nowrap text-ink-4" title="提供元が費用を返さないため、token 数とモデルの単価から自分で見積もってください">価格未設定</span>;
}
// An agent's answer takes minutes (the wait for its next run), a provider's seconds.
const secs = (ms: number | null) =>
  ms == null ? "—" : ms >= 120_000 ? `${Math.round(ms / 60_000)} 分` : ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;

export default function ModelsAdmin({ loaderData: m }: Route.ComponentProps) {
  const { run, pending } = useAdminAction();
  const [target, setTarget] = useState<AdminModels["capabilities"][number] | null>(null);
  const [choice, setChoice] = useState<string>("");
  const labelOf = (key: string) => m.capabilities.find((c) => `capability:${c.key}` === key)?.label ?? key;

  return (
    <AdminPage
      title="モデルと評価"
      subtitle="処理方式（Agent か API か）、各機能がいまどのモデルを使い、その設定がどこから来ているか（管理画面での切り替え > 環境変数 > 処理方式 > コードの既定）、そして最近の成功率、所要時間、費用。切り替えはその後の新しい作業にだけ効き、既存の結果は計算し直しません。厳選のモデルを替える前に SelectBench の同じサンプルでの比較を確認してください。"
      actions={<FilterChips param="days" options={[{ value: "1", label: "24 時間" }, { value: "", label: "7 日" }, { value: "30", label: "30 日" }]} />}
    >
      <div className="grid gap-5">
        <ProcessingCard p={m.processing} />
        {m.capabilities.map((c) => {
          const total = c.usage.reduce((a, u) => a + u.calls, 0);
          return (
            <Card
              key={c.key}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {c.label}
                  <span className="font-mono text-[12px] font-normal text-ink-3">{c.current.model}</span>
                  <Badge tone={c.current.source === "admin" ? "accent" : "muted"}>{SOURCE_LABEL[c.current.source]}</Badge>
                </span>
              }
              right={
                <Button
                  size="sm"
                  onClick={() => {
                    setTarget(c);
                    setChoice(c.current.model);
                  }}
                >
                  切り替え
                </Button>
              }
              pad={false}
            >
              {c.usage.length ? (
                <DataTable
                  dense
                  rows={c.usage}
                  rowKey={(u) => `${u.purpose}|${u.model}|${u.promptVersion}`}
                  columns={[
                    { key: "m", label: "モデル", render: (u) => <span className="whitespace-nowrap font-mono text-[12px]">{u.model}</span> },
                    { key: "v", label: "プロンプトのバージョン", render: (u) => <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-3">{u.promptVersion ?? "—"}</span> },
                    { key: "p", label: "用途", render: (u) => <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-3">{u.purpose}</span> },
                    { key: "c", label: "呼び出し", align: "right", render: (u) => num(u.calls) },
                    {
                      key: "ok",
                      label: "成功率",
                      align: "right",
                      render: (u) => {
                        const rate = u.calls ? u.ok / u.calls : 0;
                        return <span className={rate < 0.95 ? "text-hot" : ""} title={`失敗 ${u.failed} · 結果不明 ${u.unknown}`}>{`${Math.round(rate * 1000) / 10}%`}</span>;
                      },
                    },
                    { key: "l", label: "所要時間 p50 / p95", align: "right", render: (u) => <span className="whitespace-nowrap">{`${secs(u.p50)} / ${secs(u.p95)}`}</span> },
                    { key: "t", label: "入力 / 出力 token", align: "right", render: (u) => <span className="whitespace-nowrap">{`${num(u.tokensIn)} / ${num(u.tokensOut)}`}</span> },
                    {
                      key: "$",
                      label: "費用",
                      align: "right",
                      render: (u) =>
                        u.actualCost !== null ? (
                          `${money(u.actualCost)}${u.currency && u.currency !== "CNY" ? ` ${u.currency}` : ""}`
                        ) : u.estimate ? (
                          <span title="使用量 × 単価で推計">≈ {money(u.estimate.amount)}{u.estimate.currency !== "CNY" ? ` ${u.estimate.currency}` : ""}</span>
                        ) : (
                          <Unpriced />
                        ),
                    },
                  ]}
                />
              ) : (
                <Empty>{m.days} 日間に呼び出しはありません{total === 0 && c.vision ? "（画像があるときだけ使います）" : ""}</Empty>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="切り替えの記録" pad={false}>
          {m.history.length ? (
            <DataTable
              dense
              rows={m.history}
              rowKey={(h) => `${h.at}|${h.subject}`}
              columns={[
                { key: "at", label: "日時", render: (h) => <span className="num whitespace-nowrap">{bj(h.at)}</span> },
                { key: "c", label: "機能", render: (h) => labelOf(h.subject) },
                { key: "m", label: "変化", render: (h) => <span className="font-mono text-[12px]">{h.before?.model ?? "—"} → {h.after?.model ?? "—"}</span> },
                { key: "r", label: "理由", render: (h) => <span className="text-ink-3">{h.reason}</span> },
                { key: "a", label: "操作者", render: (h) => h.actor },
              ]}
            />
          ) : (
            <Empty>管理画面でモデルを切り替えたことはまだありません</Empty>
          )}
        </Card>
        <Card title="同じサンプルでの比較（SelectBench）" right={<Link to="/admin/selectbench" className="text-accent">すべての実行</Link>} pad={false}>
          {m.benches.length ? (
            <DataTable
              dense
              rows={m.benches}
              rowKey={(b) => b.id}
              columns={[
                { key: "l", label: "実行", render: (b) => <Link to={`/admin/selectbench/${b.id}`} className="text-ink hover:text-accent">{b.label}</Link> },
                { key: "m", label: "モデル", render: (b) => <span className="font-mono text-[11.5px] text-ink-3">{b.models.join("、")}</span> },
                { key: "n", label: "サンプル", align: "right", render: (b) => num(b.sample_size) },
                { key: "at", label: "日時", render: (b) => <span className="num whitespace-nowrap">{bj(b.created_at)}</span> },
              ]}
            />
          ) : (
            <Empty>比較の実行はまだ取り込まれていません</Empty>
          )}
        </Card>
      </div>

      <ReasonDialog
        open={!!target}
        title={`モデルを切り替え：${target?.label ?? ""}`}
        description="その後の新しい作業にだけ効きます。「既定に戻す」を選ぶと、環境変数かコードの既定に戻ります。"
        confirmLabel="切り替え"
        busy={pending === "switch"}
        onClose={() => setTarget(null)}
        onSubmit={async (reason) =>
          (await run("POST", `/api/admin/models/${target!.key}`, { model: choice === "__default" ? null : choice, reason }, { label: "switch", success: "切り替えました。次の呼び出しから有効です" })) !== null
        }
      >
        <Field label="モデル">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            {m.choices
              .filter((x) => x.vision === !!target?.vision)
              .map((x) => (
                <option key={x.key} value={x.key}>
                  {x.key}（{x.service}）
                </option>
              ))}
            <option value="__default">既定に戻す（{target?.env} または {target?.defaultModel}）</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
