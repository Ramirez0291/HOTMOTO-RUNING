import { ITEM_COPY, SITE } from "@hotmoto/site";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@hotmoto/contracts/taxonomy";
import type { Route } from "./+types/content-item";
import type { AdminContentChain } from "@hotmoto/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, money } from "../../features/admin/format";
import { KIND_LABEL, MODE_LABEL, VISIBILITY_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, Empty, Field, Input, Json, KV, ReasonDialog, Select, Textarea } from "../../features/admin/ui";


export async function loader({ request, params }: Route.LoaderArgs) {
  return adminGet<AdminContentChain>(request, `/api/admin/content/${encodeURIComponent(params.id)}`);
}

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.publication?.title ?? loaderData?.article.title ?? "内容"} · ${SITE.name} 管理画面` }];

function Step({ title, meta, children, tone = "accent", last }: { title: ReactNode; meta?: ReactNode; children: ReactNode; tone?: "accent" | "muted" | "bad"; last?: boolean }) {
  const dot = tone === "bad" ? "bg-hot" : tone === "muted" ? "bg-ink-4" : "bg-accent";
  return (
    <li className="relative pl-7">
      {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-line-strong" aria-hidden />}
      <span className={`absolute left-[3px] top-[7px] size-[9px] rounded-full ring-4 ring-bg ${dot}`} aria-hidden />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {meta && <div className="text-[12px] text-ink-4">{meta}</div>}
      </div>
      <div className="mt-2 pb-6 text-[13px] text-ink-2">{children}</div>
    </li>
  );
}

type Dialog = null | "visibility" | "seo" | "override" | "analyze" | "extract" | "group" | "detach" | "merge";

export default function ContentItem({ loaderData }: Route.ComponentProps) {
  const c = loaderData;
  const a = c.article;
  const p = c.publication;
  const { run, pending } = useAdminAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [visibility, setVisibility] = useState<string>(p?.visibility ?? "public");
  const [fields, setFields] = useState({ title: "", summary: "", reason: "", category: "", tags: "", selected: "", silent: "" });
  const [mergeInto, setMergeInto] = useState("");
  const version = c.override?.version ?? 0;
  const base = `/api/admin/content/${encodeURIComponent(a.id)}`;
  const story = c.membership[0];
  const title = p?.title ?? a.title;

  const openOverride = () => {
    const f = (c.override?.fields ?? {}) as Record<string, unknown>;
    setFields({
      title: String(f.title ?? ""),
      summary: String(f.summary ?? ""),
      reason: String(f.reason ?? ""),
      category: String(f.category ?? ""),
      tags: Array.isArray(f.tags) ? (f.tags as string[]).join(", ") : "",
      selected: f.selected === undefined ? "" : String(f.selected),
      silent: f.silent === undefined ? "" : String(f.silent),
    });
    setDialog("override");
  };

  return (
    <AdminPage
      title={<span className="line-clamp-2">{title}</span>}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[12px]">{a.id}</span>
          <span>·</span>
          <Link className="hover:text-accent" to={`/admin/sources/${encodeURIComponent(a.source_id)}`}>{a.source_name}</Link>
          <span>·</span>
          <a className="max-w-[420px] truncate hover:text-accent" href={a.url} target="_blank" rel="noreferrer">{a.url}</a>
          {p?.visibility !== "withdrawn" && p && (
            <>
              <span>·</span>
              <a className="text-accent" href={`/items/${a.id}`} target="_blank" rel="noreferrer">公開ページ</a>
            </>
          )}
        </span>
      }
      actions={
        <>
          <Button onClick={() => setDialog("visibility")}>公開範囲</Button>
          {p && <Button onClick={() => setDialog("seo")}>{p.indexable ? "インデックス解除" : "インデックス対象にする"}</Button>}
          <Button onClick={openOverride}>手動で修正</Button>
          <Button onClick={() => setDialog("analyze")}>評価し直す</Button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-1.5">
        {p ? <Badge tone={p.visibility === "public" ? "ok" : "warn"}>{VISIBILITY_LABEL[p.visibility] ?? p.visibility}</Badge> : <Badge>未公開</Badge>}
        {p?.selected && <Badge tone="accent">厳選</Badge>}
        {p?.eligible === false && <Badge>公開面に出さない</Badge>}
        {a.backfill && <Badge tone="warn">過去分の取り込み</Badge>}
        <Badge>処理 {a.processing_state}</Badge>
        {c.override && <Badge tone="info" title={c.override.reason ?? undefined}>手動設定あり v{c.override.version}</Badge>}
      </div>
      {a.processing_error && <div className="mb-5 rounded-card bg-hot-soft px-4 py-3 text-[13px] text-hot ring-1 ring-hot/20">{a.processing_error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="処理の経路">
          <ol className="pt-1">
            <Step title="情報源" meta={`${KIND_LABEL[a.source_kind] ?? a.source_kind} · ${String(a.tier).replace("_", ".")} · ${MODE_LABEL[a.participation_mode] ?? a.participation_mode}`}>
              <Link className="text-ink hover:text-accent" to={`/admin/sources/${encodeURIComponent(a.source_id)}`}>{a.source_name}</Link>
              <span className="text-ink-4"> · サイト内の全文 {a.site_fulltext ? "許可" : "不許可"} · 外部への全文 {a.syndicate_fulltext ? "許可" : "不許可"}</span>
            </Step>
            <Step title="発見" meta={`${c.discoveries.length} 回`}>
              <ul className="space-y-1">
                {c.discoveries.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="num text-ink-4">{bj(d.discovered_at, true)}</span>
                    <span>{d.via}</span>
                    {d.source_id !== a.source_id && <span className="text-ink-3">{d.source_id} 経由</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 text-[12px] text-ink-4">
                原文の日時 {a.published_at ? bj(a.published_at, true) : "不明"}{a.published_at_claim && !a.published_at ? `（主張 ${a.published_at_claim}、採用せず）` : ""} · タイムライン {bj(a.timeline_at, true)}
              </div>
            </Step>
            <Step title="本文と改訂" meta={`第 ${a.revision} 版 · 本文 ${a.body_status} · ${a.body_chars ?? 0} 文字`}>
              {c.revisions.length ? (
                <ul className="space-y-1">
                  {c.revisions.map((r) => (
                    <li key={r.revision} className="flex gap-2">
                      <span className="num text-ink-4">v{r.revision}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <span className="num shrink-0 text-ink-4">{bj(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-4">初版だけ</span>
              )}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setDialog("extract")}>本文を抽出し直す</Button>
              </div>
            </Step>
            <Step title="モデルの判断" meta={`${c.analyses.length} 回`} tone={c.analyses.length ? "accent" : "muted"}>
              {c.analyses.length ? (
                <div className="space-y-3">
                  {c.analyses.map((an) => (
                    <div key={an.id} className="rounded-control bg-bg-sunk/60 p-3 ring-1 ring-line">
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                        <Badge tone={an.relevance === "pass" ? "ok" : "muted"}>{an.relevance}</Badge>
                        {an.selected && <Badge tone="accent">入選</Badge>}
                        <Badge tone="info">点数 {an.score}</Badge>
                        {an.category && <Badge>{CATEGORY_LABELS[an.category as keyof typeof CATEGORY_LABELS] ?? an.category}</Badge>}
                        <span className="text-ink-4">{an.model} · {an.prompt_version} · 入力 v{an.input_revision} · {an.origin} · {bj(an.created_at)}</span>
                      </div>
                      {an.title_zh && <div className="mt-2 font-medium text-ink">{an.title_zh}</div>}
                      {an.reason_zh && <div className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{an.reason_zh}</div>}
                      {an.receipts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                          {an.receipts.map((r) => (
                            <span key={r.id} className="num rounded bg-surface px-1.5 py-0.5 text-ink-3 ring-1 ring-line">
                              受領記録 #{r.id} · {r.status} · {r.model ?? r.service}{r.cost !== null ? ` · ${money(r.cost)}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-ink-4">{a.participation_mode === "editorial" ? "まだ判断していません（待ち行列か失敗）" : "話題のみの情報源は編集の判断をしません"}</span>
              )}
            </Step>
            <Step title="公開" tone={p ? (p.visibility === "withdrawn" ? "bad" : "accent") : "muted"} meta={p ? `${bj(p.updated_at, true)} 更新` : undefined}>
              {p ? (
                <KV
                  items={[
                    ["範囲", VISIBILITY_LABEL[p.visibility] ?? p.visibility],
                    ["厳選", p.selected ? `はい · ${p.visible_after ? bj(p.visible_after, true) : "すぐに"}表示` : "いいえ"],
                    ["カテゴリ", p.category ? CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category : null],
                    ["タグ", (p.tags as string[] | null)?.join("、")],
                    ["要約", p.summary],
                    [ITEM_COPY.reasonLabel, p.reason],
                    [
                      "本文の表示",
                      `${p.body_mode}${p.syndicate ? " · 外部に全文を含められる" : ""}${
                        p.indexable ? (p.seo_indexed_at ? " · インデックス対象（手動）" : " · インデックス対象（厳選で自動）") : p.seo_excluded_at ? " · インデックス対象外（手動で除外）" : " · インデックス対象外"
                      }`,
                    ],
                  ]}
                />
              ) : (
                <span className="text-ink-4">公開の投影はありません（関連性を通らなかったか、処理中）</span>
              )}
              {c.override && (
                <div className="mt-3 rounded-control bg-accent-softer p-3 ring-1 ring-accent/15">
                  <div className="text-[12px] text-ink-3">手動設定 v{c.override.version} · {c.override.updated_by} · {bj(c.override.updated_at, true)}{c.override.reason ? ` · ${c.override.reason}` : ""}</div>
                  <Json value={{ visibility: c.override.visibility, ...c.override.fields }} label="上書きした項目" collapsed={false} />
                </div>
              )}
            </Step>
            <Step title="厳選の同期の記録" meta={`${c.ledger.length} 件`} tone={c.ledger.length ? "accent" : "muted"}>
              {c.ledger.length ? (
                <ul className="space-y-1">
                  {c.ledger.map((l) => (
                    <li key={l.seq} className="flex gap-2">
                      <span className="num text-ink-4">#{l.seq}</span>
                      <Badge tone={l.op === "remove" ? "warn" : "ok"}>{l.op}</Badge>
                      <span className="num text-ink-4">表示 {bj(l.visible_at)} · 書き込み {bj(l.changed_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-4">厳選の同期に入ったことはありません</span>
              )}
            </Step>
            <Step title="出来事のまとめ" tone={story ? "accent" : "muted"} meta={a.grouped_at ? `${bj(a.grouped_at, true)} にまとめ` : "未まとめ"}>
              {c.membership.map((m) => (
                <div key={m.fact_id} className="mb-2">
                  <div>
                    事実 <span className="font-mono text-[12px]">#{m.fact_id}</span> {m.fact_title} <Badge>{m.role}</Badge> {m.manual && <Badge tone="info">手動</Badge>}
                  </div>
                  {m.story_public_id && (
                    <div className="mt-0.5">
                      出来事 <a className="text-accent" href={`/story/${m.story_public_id}`} target="_blank" rel="noreferrer">{m.story_title}</a> <span className="font-mono text-[12px] text-ink-4">#{m.story_id}</span>
                    </div>
                  )}
                </div>
              ))}
              {c.decisions.length > 0 && (
                <ul className="mt-2 space-y-1 text-[12.5px]">
                  {c.decisions.map((d, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <span className="num text-ink-4">{bj(d.created_at)}</span>
                      <Badge>{d.verdict}</Badge>
                      {d.fact_id && <span>事実 #{d.fact_id}</span>}
                      {d.receipt_id && <span className="text-ink-4">受領記録 #{d.receipt_id}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setDialog("group")}>まとめ直す</Button>
                {c.membership.length > 0 && <Button size="sm" onClick={() => setDialog("detach")}>出来事から外す</Button>}
                {story?.story_id && <Button size="sm" onClick={() => setDialog("merge")}>この出来事を統合…</Button>}
              </div>
            </Step>
            <Step title="配信" last meta={`${c.deliveries.length} 件`} tone={c.deliveries.some((d) => d.status === "unknown") ? "bad" : c.deliveries.length ? "accent" : "muted"}>
              {c.deliveries.length ? (
                <ul className="space-y-1">
                  {c.deliveries.map((d, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <span>{d.target_key}</span>
                      <Badge tone={d.status === "sent" ? "ok" : d.status === "unknown" ? "bad" : "muted"}>{d.status}</Badge>
                      <span className="num text-ink-4">{bj(d.created_at)}{d.sent_at ? ` → ${bj(d.sent_at)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-4">配信の記録はありません</span>
              )}
            </Step>
          </ol>
        </Card>

        <div className="space-y-5">
          <Card title="元の情報">
            <KV
              items={[
                ["原題", a.title],
                ["筆者", a.author],
                ["言語", a.language],
                ["識別キー", <span className="break-all font-mono text-[11.5px]">{a.identity_key}</span>],
              ]}
            />
          </Card>
          <Card title="変更の記録">
            {c.history.length ? (
              <ul className="space-y-3 text-[12.5px]">
                {c.history.map((h, i) => (
                  <li key={i}>
                    <div className="text-ink-2"><span className="font-medium">{h.action}</span> · {h.actor} · {bj(h.created_at)}</div>
                    {h.reason && <div className="text-ink-3">{h.reason}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>人の手による操作はありません</Empty>
            )}
          </Card>
        </div>
      </div>

      <ReasonDialog
        open={dialog === "seo"}
        title={p?.indexable ? "検索のインデックスを解除" : "インデックス対象にする"}
        description={
          p?.indexable
            ? "詳細ページを noindex に戻し、サイトマップから外します。厳選でも、もう一度指定するまで自動ではインデックスされません。"
            : "詳細ページは既定で noindex で、厳選は自動でインデックスされます。指定すると（公開状態のときだけ）index になり、サイトマップに入り、次の IndexNow で送信されます。単独で価値があり、要約と本文がそろった内容に向いています。"
        }
        confirmLabel={p?.indexable ? "インデックス解除" : "インデックス対象にする"}
        busy={pending === "seo"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/seo`, { indexed: !p?.indexable, reason }, { label: "seo", success: p?.indexable ? "インデックスを解除しました" : "インデックス対象にしました" })) !== null}
      />

      <ReasonDialog
        open={dialog === "visibility"}
        title="公開範囲"
        description="変更はウェブ、API、RSS、MCP、同期の流れ、検索の索引に同時に効き、キャッシュも更新します。情報源から取り下げを求められたときは、先に身元と範囲を確かめてください。"
        danger={visibility === "withdrawn"}
        confirmLabel="適用"
        busy={pending === "visibility"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/visibility`, { visibility, reason, version }, { label: "visibility", success: "公開範囲を更新しました" })) !== null}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["public", "公開", "通常どおり表示"],
            ["summary-only", "要約のみ", "本文は表示せず、タイトルと要約は残す"],
            ["withdrawn", "取り下げ", "すべての出口から外し、リンクは 404"],
          ] as const).map(([v, label, hint]) => (
            <label key={v} className={`cursor-pointer rounded-card p-3 ring-1 transition-colors ${visibility === v ? "bg-accent-soft ring-accent" : "ring-line-strong hover:bg-bg-sunk"}`}>
              <input type="radio" name="visibility" className="sr-only" checked={visibility === v} onChange={() => setVisibility(v)} />
              <div className="text-[13.5px] font-medium text-ink">{label}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{hint}</div>
            </label>
          ))}
        </div>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "override"}
        title="手動で修正"
        description="手動の値はモデルの出力より優先し、その後の再処理でも上書きされません。空欄はその項目を修正しないという意味です（既存の修正を消すには「消去」を選んでください）。"
        confirmLabel="修正を保存"
        busy={pending === "override"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          const next: Record<string, unknown> = {};
          const clear: string[] = [];
          for (const k of ["title", "summary", "reason"] as const) {
            if (fields[k].trim()) next[k] = fields[k].trim();
            else if (c.override?.fields[k] !== undefined) clear.push(k);
          }
          if (fields.category) next.category = fields.category;
          else if (c.override?.fields.category !== undefined) clear.push("category");
          if (fields.tags.trim()) next.tags = fields.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
          else if (c.override?.fields.tags !== undefined) clear.push("tags");
          for (const k of ["selected", "silent"] as const) {
            if (fields[k] === "true" || fields[k] === "false") next[k] = fields[k] === "true";
            else if (c.override?.fields[k] !== undefined) clear.push(k);
          }
          return (await run("POST", `${base}/override`, { fields: next, clear, reason, version }, { label: "override", success: "修正を保存して公開し直しました" })) !== null;
        }}
      >
        <Field label="タイトル"><Input value={fields.title} placeholder={p?.title ?? ""} onChange={(e) => setFields({ ...fields, title: e.target.value })} /></Field>
        <Field label="要約"><Textarea rows={3} value={fields.summary} placeholder={p?.summary ?? ""} onChange={(e) => setFields({ ...fields, summary: e.target.value })} /></Field>
        <Field label={ITEM_COPY.reasonLabel}><Textarea rows={2} value={fields.reason} placeholder={p?.reason ?? ""} onChange={(e) => setFields({ ...fields, reason: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="カテゴリ">
            <Select value={fields.category} onChange={(e) => setFields({ ...fields, category: e.target.value })}>
              <option value="">修正しない</option>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
            </Select>
          </Field>
          <Field label="タグ（カンマ区切り）"><Input value={fields.tags} onChange={(e) => setFields({ ...fields, tags: e.target.value })} /></Field>
          <Field label="厳選">
            <Select value={fields.selected} onChange={(e) => setFields({ ...fields, selected: e.target.value })}>
              <option value="">モデルに従う</option>
              <option value="true">必ず入選</option>
              <option value="false">必ず除外</option>
            </Select>
          </Field>
          <Field label="配信">
            <Select value={fields.silent} onChange={(e) => setFields({ ...fields, silent: e.target.value })}>
              <option value="">通常</option>
              <option value="true">ミュート（入選しても配信しない）</option>
              <option value="false">ミュート解除</option>
            </Select>
          </Field>
        </div>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "analyze"}
        title="いまの改訂を評価し直す"
        description="新しいモデルの呼び出しを 1 回行います（課金され、受領記録が残ります）。同じ送信で何度押しても重複して課金されることはありません。"
        requireReason={false}
        confirmLabel="評価し直す"
        busy={pending === "analyze"}
        onClose={() => setDialog(null)}
        onSubmit={async () => (await run("POST", `${base}/rerun`, { step: "analyze" }, { label: "analyze", success: "評価の待ち行列に入れました" })) !== null}
      />
      <ReasonDialog
        open={dialog === "extract"}
        title="本文を抽出し直す"
        requireReason={false}
        confirmLabel="抽出し直す"
        busy={pending === "extract"}
        onClose={() => setDialog(null)}
        onSubmit={async () => (await run("POST", `${base}/rerun`, { step: "extract" }, { label: "extract", success: "抽出の待ち行列に入れました" })) !== null}
      />
      <ReasonDialog
        open={dialog === "group"}
        title="まとめ直す"
        description="手動でまとめた所属は上書きされません。"
        requireReason={false}
        confirmLabel="まとめ直す"
        busy={pending === "group"}
        onClose={() => setDialog(null)}
        onSubmit={async () => (await run("POST", `${base}/rerun`, { step: "group" }, { label: "group", success: "まとめの待ち行列に入れました" })) !== null}
      />
      <ReasonDialog
        open={dialog === "detach"}
        title="出来事から外す"
        description="この内容は単独の内容として表示され、出来事のページもそれに合わせて更新されます。"
        danger
        confirmLabel="外す"
        busy={pending === "detach"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/detach`, { reason }, { label: "detach", success: "出来事から外しました" })) !== null}
      />
      <ReasonDialog
        open={dialog === "merge"}
        title="出来事を統合"
        description={`出来事 #${story?.story_id}（${story?.story_title ?? ""}）を別の出来事に統合します。古いリンクは新しい出来事に転送されます。`}
        danger
        confirmLabel="統合"
        busy={pending === "merge"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          if (!/^\d+$/.test(mergeInto.trim())) return false;
          return (await run("POST", "/api/admin/stories/merge", { from: story!.story_id, into: Number(mergeInto), reason }, { label: "merge", success: "出来事を統合しました" })) !== null;
        }}
      >
        <Field label="統合先の出来事の番号" hint="統合先の出来事に属する内容の診断ページで #番号 を確認できます">
          <Input inputMode="numeric" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} placeholder="例：1234" />
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
