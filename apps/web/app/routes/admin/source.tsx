import { SITE } from "@aihot/site";
import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/source";
import type { AdminSource, AdminSourceDetail, AdminSourcePreview } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, duration, num } from "../../features/admin/format";
import { HEALTH_LABEL, KIND_LABEL, MODE_LABEL, TIER_LABEL, VISIBILITY_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, DataTable, Dot, Empty, Field, healthTone, Input, Json, KV, ReasonDialog, Select, Stat, Textarea, Time } from "../../features/admin/ui";


/** X runs: pages read, and older stretches still to read (backlog) or given up (dropped). */



export async function loader({ request, params }: Route.LoaderArgs) {
  return adminGet<AdminSourceDetail>(request, `/api/admin/sources/${encodeURIComponent(params.id)}`);
}

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.source.name ?? "情報源"} · ${SITE.name} 管理画面` }];

type Draft = Pick<AdminSource, "name" | "interval_minutes" | "tier" | "participation_mode" | "signal_group_id" | "first_party" | "owner_entity_id" | "site_fulltext" | "syndicate_fulltext"> & { tags: string; config: string };

function draftOf(s: AdminSource): Draft {
  return {
    name: s.name,
    interval_minutes: s.interval_minutes,
    tier: s.tier,
    participation_mode: s.participation_mode,
    signal_group_id: s.signal_group_id,
    first_party: s.first_party,
    owner_entity_id: s.owner_entity_id,
    site_fulltext: s.site_fulltext,
    syndicate_fulltext: s.syndicate_fulltext,
    tags: s.tags.join(", "),
    config: JSON.stringify(s.config, null, 2),
  };
}

export default function SourceDetail({ loaderData }: Route.ComponentProps) {
  const { source: s, runs, items, stats, history } = loaderData;
  const { run, pending } = useAdminAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(s));
  const [draftFor, setDraftFor] = useState(s.updated_at);
  const [preview, setPreview] = useState<AdminSourcePreview | null>(null);
  const [dialog, setDialog] = useState<null | "save" | "toggle">(null);
  const [configError, setConfigError] = useState<string | null>(null);
  if (draftFor !== s.updated_at) {
    // The source changed (our own save or someone else's): start from the saved state.
    setDraft(draftOf(s));
    setDraftFor(s.updated_at);
  }
  const base = `/api/admin/sources/${encodeURIComponent(s.id)}`;

  const patch = (): Record<string, unknown> | null => {
    let config: unknown;
    try {
      config = JSON.parse(draft.config);
      setConfigError(null);
    } catch (e) {
      setConfigError(`設定が正しい JSON ではありません：${(e as Error).message}`);
      return null;
    }
    const next: Record<string, unknown> = {
      ...draft,
      tags: draft.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      config,
      interval_minutes: Number(draft.interval_minutes),
      signal_group_id: draft.signal_group_id || null,
      owner_entity_id: draft.owner_entity_id || null,
    };
    const before = draftOf(s) as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next)) {
      const was = k === "tags" ? s.tags : k === "config" ? s.config : before[k];
      if (JSON.stringify(v) !== JSON.stringify(was)) changed[k] = v;
    }
    return changed;
  };
  const changes = (() => {
    try {
      return Object.keys(patchPreview(draft, s)).length;
    } catch {
      return 1;
    }
  })();

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-2">
          {s.name}
          <Badge>{KIND_LABEL[s.kind] ?? s.kind}</Badge>
          <Badge tone={s.participation_mode === "editorial" ? "accent" : "muted"}>{MODE_LABEL[s.participation_mode]}</Badge>
        </span>
      }
      subtitle={<span className="font-mono text-[12px]">{s.id}</span>}
      actions={
        <>
          <Button
            busy={pending === "preview"}
            onClick={async () => {
              const r = await run<AdminSourcePreview>("POST", `${base}/preview`, {}, { label: "preview", revalidate: false });
              if (r) setPreview(r);
            }}
          >
            取得をプレビュー
          </Button>
          <Button busy={pending === "fetch"} onClick={() => run("POST", `${base}/fetch`, {}, { label: "fetch", success: "収集の待ち行列に入れました" })}>
            すぐに収集
          </Button>
          <Button tone={s.enabled ? "danger" : "primary"} onClick={() => setDialog("toggle")}>
            {s.enabled ? "停止" : "再開"}
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="状態"
          value={
            <span className="inline-flex items-center gap-2 text-[18px]">
              <Dot tone={s.enabled ? healthTone(s.health) : "muted"} />
              {s.enabled ? HEALTH_LABEL[s.health] ?? s.health : "停止中"}
            </span>
          }
          hint={s.fail_count ? `連続失敗 ${s.fail_count} 回` : `前回の成功 ${s.last_ok_at ? bj(s.last_ok_at) : "—"}`}
        />
        <Stat label="累計の記事" value={num(stats.total)} />
        <Stat label="直近 7 日" value={num(stats.last7d)} />
        <Stat label="厳選入り" value={num(stats.selected)} />
      </div>
      {s.last_error && s.health !== "ok" && <div className="mb-5 rounded-card bg-hot-soft px-4 py-3 text-[13px] text-hot ring-1 ring-hot/20">{s.last_error}</div>}

      {preview && (
        <Card className="mb-5" title={`プレビュー：${preview.count} 件（${preview.ms}ms、未保存）`} right={<button onClick={() => setPreview(null)}>閉じる</button>}>
          {preview.items.length ? (
            <ul className="space-y-2.5">
              {preview.items.map((i) => (
                <li key={i.url} className="text-[13px]">
                  <a href={i.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">{i.title}</a>
                  <div className="text-[12px] text-ink-4">{i.publishedAt ? bj(i.publishedAt, true) : "発表日時なし"} · {i.url}</div>
                  {i.excerpt && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3">{i.excerpt}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>記事を取得できませんでした。アドレス、セレクター、ログインの要否を確認してください。</Empty>
          )}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title="設定" right={<span>バージョン {bj(s.updated_at, true)}</span>}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="名前">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="収集の間隔（分）">
                <Input type="number" min={1} max={1440} value={draft.interval_minutes} onChange={(e) => setDraft({ ...draft, interval_minutes: Number(e.target.value) })} />
              </Field>
              <Field label="参加方法" hint="「話題のみ」は話題の証拠にだけ使い、単独の内容にはなりません">
                <Select value={draft.participation_mode} onChange={(e) => setDraft({ ...draft, participation_mode: e.target.value })}>
                  {Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="格付け" hint="一次情報源は T1 だけ">
                <Select value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>
                  {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="話題のグループ ID" hint="同じ組織の複数のアカウントで共有し、話題度は 1 回だけ数えます">
                <Input value={draft.signal_group_id ?? ""} onChange={(e) => setDraft({ ...draft, signal_group_id: e.target.value })} />
              </Field>
              <Field label="運営者 ID">
                <Input value={draft.owner_entity_id ?? ""} onChange={(e) => setDraft({ ...draft, owner_entity_id: e.target.value })} />
              </Field>
              <Field label="タグ（カンマ区切り）">
                <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
              </Field>
              <div className="flex flex-col justify-end gap-2 text-[13px] text-ink-2">
                {([
                  ["site_fulltext", "サイト内で全文を表示できる"],
                  ["syndicate_fulltext", "外部インターフェースに全文を含められる"],
                ] as const).map(([k, label]) => (
                  <label key={k} className="inline-flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <Field label="収集の設定（JSON）">
                <Textarea className="font-mono !text-[12px]" rows={Math.min(18, draft.config.split("\n").length + 1)} value={draft.config} onChange={(e) => setDraft({ ...draft, config: e.target.value })} spellCheck={false} />
              </Field>
              {configError && <div className="mt-1 text-[12.5px] text-hot">{configError}</div>}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              {changes > 0 && <span className="text-[12.5px] text-ink-3">未保存の変更 {changes} 件</span>}
              <Button tone="ghost" disabled={!changes} onClick={() => setDraft(draftOf(s))}>元に戻す</Button>
              <Button tone="primary" disabled={!changes} onClick={() => patch() && setDialog("save")}>保存</Button>
            </div>
          </Card>

          <Card title="最近の記事" pad={false}>
            <DataTable
              rows={items}
              rowKey={(r) => r.id}
              empty="まだ何も収集していません"
              columns={[
                {
                  key: "t",
                  label: "タイトル",
                  render: (r) => (
                    <Link to={`/admin/content/${r.id}`} className="line-clamp-2 min-w-[260px] text-ink hover:text-accent">{r.title_zh || r.title}</Link>
                  ),
                },
                { key: "s", label: "状態", render: (r) => <span className="flex gap-1">{r.selected && <Badge tone="accent">厳選</Badge>}{r.visibility && r.visibility !== "public" && <Badge tone="warn">{VISIBILITY_LABEL[r.visibility]}</Badge>}<Badge>{r.processing_state}</Badge></span> },
                { key: "d", label: "発見", render: (r) => <Time at={r.discovered_at} /> },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="状態">
            <KV
              items={[
                ["前回の取得", s.last_fetch_at ? bj(s.last_fetch_at, true) : null],
                ["前回の成功", s.last_ok_at ? bj(s.last_ok_at, true) : null],
                ["次回の取得", s.next_fetch_at ? bj(s.next_fetch_at, true) : null],
                ["作成", bj(s.created_at, true)],
              ]}
            />
            {s.cursor && <div className="mt-3"><Json value={s.cursor} label="カーソル" /></div>}
          </Card>
          <Card title="収集の記録" pad={false}>
            <DataTable
              dense
              rows={runs}
              rowKey={(r) => r.id}
              empty="収集の記録はまだありません"
              columns={[
                { key: "at", label: "日時", render: (r) => <span className="num whitespace-nowrap">{bj(r.started_at)}</span> },
                {
                  key: "st",
                  label: "結果",
                  render: (r) => (
                    <span className="inline-flex gap-1">
                      <Badge tone={r.status === "ok" ? "ok" : r.status === "failed" ? "bad" : "muted"} title={r.error ?? undefined}>{r.status}</Badge>
                      {!!r.detail?.dropped && <Badge tone="bad" title="それより前の投稿の一部を読み切れず、取りこぼした可能性があります">取りこぼしの可能性</Badge>}
                      {!r.detail?.dropped && !!r.detail?.backlog && <Badge tone="warn" title="投稿が 1 回で読めるページ数より多いため、残りは次の回以降に続けて読みます">続きあり {r.detail.backlog} 区間</Badge>}
                    </span>
                  ),
                },
                { key: "n", label: "発見/新規", align: "right", render: (r) => `${r.found_count ?? "—"}/${r.new_count ?? "—"}` },
                { key: "ms", label: "所要時間", align: "right", render: (r) => duration(r.started_at, r.finished_at) },
              ]}
            />
          </Card>
          <Card title="変更の記録">
            {history.length ? (
              <ul className="space-y-3 text-[12.5px]">
                {history.map((h, i) => (
                  <li key={i}>
                    <div className="text-ink-2"><span className="font-medium">{h.action}</span> · {h.actor} · {bj(h.created_at)}</div>
                    {h.reason && <div className="text-ink-3">{h.reason}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>人の手による変更はありません</Empty>
            )}
          </Card>
        </div>
      </div>

      <ReasonDialog
        open={dialog === "save"}
        title="情報源の設定を保存"
        description={`変更する項目：${Object.keys(patchPreview(draft, s)).join("、") || "なし"}`}
        busy={pending === "save"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          const p = patch();
          if (!p) return false;
          const r = await run("PATCH", base, { patch: p, version: new Date(s.updated_at).toISOString(), reason }, { label: "save", success: "保存しました" });
          return r !== null;
        }}
      />
      <ReasonDialog
        open={dialog === "toggle"}
        title={s.enabled ? "この情報源を停止" : "この情報源を再開"}
        description={s.enabled ? "停止すると収集しなくなります。既存の内容と履歴は残ります。" : "再開するとすぐに 1 回の収集を待ち行列に入れます。"}
        danger={s.enabled}
        confirmLabel={s.enabled ? "停止" : "再開"}
        busy={pending === "toggle"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          const r = await run("PATCH", base, { patch: { enabled: !s.enabled }, version: new Date(s.updated_at).toISOString(), reason }, { label: "toggle", success: s.enabled ? "停止しました" : "再開しました" });
          return r !== null;
        }}
      />
    </AdminPage>
  );
}

/** Field names that differ from the saved source (for the confirmation text). */
function patchPreview(draft: Draft, s: AdminSource): Record<string, true> {
  const out: Record<string, true> = {};
  const saved = draftOf(s);
  for (const k of Object.keys(draft) as Array<keyof Draft>) {
    if (k === "config") {
      try {
        if (JSON.stringify(JSON.parse(draft.config)) !== JSON.stringify(s.config)) out.config = true;
      } catch {
        out.config = true;
      }
    } else if (String(draft[k] ?? "") !== String(saved[k] ?? "")) out[k] = true;
  }
  return out;
}
