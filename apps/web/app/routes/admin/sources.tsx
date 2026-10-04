import { SITE } from "@hotmoto/site";
import { Form, Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/sources";
import type { AdminSources } from "@hotmoto/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { num } from "../../features/admin/format";
import { HEALTH_LABEL, KIND_LABEL, MODE_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, ButtonLink, Card, DataTable, Dot, FilterChips, healthTone, Input, Pager, Select, Stat, Time } from "../../features/admin/ui";



export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return adminGet<AdminSources>(request, `/api/admin/sources${url.search}`);
}

export const meta: Route.MetaFunction = () => [{ title: `情報源 · ${SITE.name} 管理画面` }];

export default function Sources({ loaderData }: Route.ComponentProps) {
  const { rows, totals, page } = loaderData;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  return (
    <AdminPage
      title="情報源"
      subtitle="一覧は状態の順：失敗しているものが先頭。詳細では取得のプレビュー、手動の収集、頻度と参加方法の調整ができます。"
      actions={<ButtonLink to="/admin/sources/new" tone="primary">情報源を新規作成</ButtonLink>}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="すべて" value={num(totals.total)} />
        <Stat label="有効" value={num(totals.enabled)} />
        <Stat label="失敗" value={num(totals.failing)} tone={totals.failing ? "bad" : "ok"} />
        <Stat label="不安定" value={num(totals.degraded)} tone={totals.degraded ? "warn" : undefined} />
      </div>
      <Card pad={false}>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <Form method="get" className="flex w-full max-w-md gap-2" preventScrollReset>
            {["kind", "health", "mode"].map((k) => sp.get(k) && <input key={k} type="hidden" name={k} value={sp.get(k)!} />)}
            <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="名前、ID、アドレス" aria-label="情報源を検索" />
          </Form>
          <div className="flex flex-wrap items-center gap-3">
            <FilterChips param="health" options={[{ value: "", label: "すべて" }, { value: "failing", label: "失敗" }, { value: "degraded", label: "不安定" }, { value: "paused", label: "停止中" }]} />
            <Select
              aria-label="種類"
              className="!w-auto"
              value={sp.get("kind") ?? ""}
              onChange={(e) => {
                const next = new URLSearchParams(sp);
                if (e.target.value) next.set("kind", e.target.value);
                else next.delete("kind");
                next.delete("page");
                navigate(`?${next}`, { preventScrollReset: true });
              }}
            >
              <option value="">すべての種類</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/sources/${encodeURIComponent(r.id)}`)}
          columns={[
            {
              key: "name",
              label: "情報源",
              render: (r) => (
                <div className="min-w-[220px]">
                  <Link to={`/admin/sources/${encodeURIComponent(r.id)}`} className="font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>
                    {r.name}
                  </Link>
                  <div className="font-mono text-[11.5px] text-ink-4">{r.id}</div>
                  {r.health === "failing" && r.last_error && <div className="mt-1 line-clamp-1 text-[12px] text-hot">{r.last_error}</div>}
                </div>
              ),
            },
            { key: "kind", label: "種類", render: (r) => <Badge>{KIND_LABEL[r.kind] ?? r.kind}</Badge> },
            {
              key: "mode",
              label: "参加",
              render: (r) => (
                <div className="flex gap-1">
                  <Badge tone={r.participation_mode === "editorial" ? "accent" : "muted"}>{MODE_LABEL[r.participation_mode] ?? r.participation_mode}</Badge>
                  <Badge tone="info">{r.tier.replace("_", ".")}</Badge>
                  {r.first_party && <Badge tone="ok">一次</Badge>}
                </div>
              ),
            },
            {
              key: "health",
              label: "状態",
              render: (r) => (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Dot tone={r.enabled ? healthTone(r.health) : "muted"} />
                  {r.enabled ? HEALTH_LABEL[r.health] ?? r.health : "停止中"}
                  {r.fail_count > 0 && <span className="num text-[11.5px] text-ink-4">×{r.fail_count}</span>}
                </span>
              ),
            },
            { key: "ok", label: "前回の成功", render: (r) => <Time at={r.last_ok_at} /> },
            { key: "interval", label: "頻度", align: "right", render: (r) => `${r.interval_minutes} 分` },
            { key: "items", label: "7 日の記事", align: "right", render: (r) => num(r.items_7d) },
            { key: "sel", label: "30 日の厳選", align: "right", render: (r) => num(r.selected_30d) },
          ]}
        />
      </Card>
      <Pager page={page} hasMore={rows.length === 100} />
    </AdminPage>
  );
}
