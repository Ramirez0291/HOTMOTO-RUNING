// The engine's ways in, one panel each: what it is for, the steps to connect, then the details folded away.
// Addresses are the site's configured public address (`base`); what visitors copy carries the site's tag
// (CopyTag) when it has one.
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { PUBLIC_INTERFACE_VERSION } from "@aihot/contracts/http-policy";
import { MCP_TOOL_NAMES as T, MCP_TOOLS } from "@aihot/contracts/mcp";
import { feedCategoryLabel, PUBLIC_API_CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { ACCESS, AGENT, EDITION_WHEN, POLICY, REPORTS, SITE, TIME_ZONE, withSubject } from "@aihot/site";
import { CodeBlock, CopyButton } from "./CodeBlock";
import { PillTabs } from "../../components/ui/Tabs";
import type { AgentPanelProps } from "../../modules";
import { AGENT_PARTS, GUIDE_CLIENTS, TAG } from "./module-parts";
import { Address, Ask, Block, Bullets, Details, Mono, PanelHead, Step, Steps, Table, Tips } from "./parts";

const V = PUBLIC_INTERFACE_VERSION;

/** Every MCP tool: the engine's and the modules'. */
export const mcpToolCount = () => MCP_TOOLS.length + AGENT_PARTS.reduce((n, a) => n + (a.tools?.length ?? 0), 0);
const link = "text-accent hover:underline";

/** An address on this site as the copy buttons copy it, with the tag. */
function addressOf({ base, tag }: AgentPanelProps, path: string): string {
  return TAG && tag ? `${base}${path}?${TAG.query}=${tag}` : `${base}${path}`;
}

const MCP_CLIENTS = [
  { key: "claude", label: "Claude Code" },
  { key: "codex", label: "Codex" },
  { key: "json", label: "JSON 設定" },
  { key: "other", label: "その他のクライアント" },
] as const;

export function McpPanel(props: AgentPanelProps) {
  const url = addressOf(props, "/api/mcp");
  const name = SITE.mcpPrefix;
  const [client, setClient] = useState<string>("claude");
  return (
    <>
      <PanelHead label={`MCP · ${V}`} title={`アドレスを 1 つ入れるだけで、Agent に ${mcpToolCount()} 個のツールが加わる`}>
        標準の Streamable HTTP で、匿名・読み取り専用。トークンは不要で、ログイン状態も読みません。Claude デスクトップ版、Cursor、Cherry Studio のようにリモート MCP に対応したクライアントに向いています。
      </PanelHead>
      <Steps>
        <Step n={1} title="サーバーのアドレスをコピー">
          <Address url={url} />
          {TAG && <p className="mt-2 text-[13px] text-ink-3">{TAG.mcp}</p>}
        </Step>
        <Step n={2} title="クライアントに追加">
          <PillTabs className="mt-3" size="xs" layoutId="agent-mcp-client" label="クライアント" active={client} onSelect={setClient} items={MCP_CLIENTS.map((c) => ({ key: c.key, label: c.label }))} />
          {client === "claude" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`claude mcp add --transport http ${name} '${url}'`} />}
          {client === "codex" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`codex mcp add ${name} --url '${url}'`} />}
          {client === "json" && <CodeBlock className="mb-0 mt-3" title="Cursor、Cherry Studio など JSON で設定するクライアント" lang="json" code={JSON.stringify({ mcpServers: { [name]: { type: "http", url } } }, null, 2)} />}
          {client === "other" && <p className="mt-3">{`クライアントの MCP またはコネクタの設定で新しい項目を作り、名前に ${name}、アドレスに上の URL を入れ、認証は「なし」を選び、API キーは入れないでください。ローカルのコマンドにしか対応していないクライアントは、付属のリモート MCP プロキシを使ってください。`}</p>}
        </Step>
        <Step n={3} title="Agent に一度呼ばせる">
          <Ask text={`${T.latest} を呼び出して、過去 24 時間で最も重要な${withSubject("ニュース")} 5 件を、${SITE.name} のリンク付きで教えて。`} />
          <p className="mt-2 text-[13px] text-ink-3">{`クライアントが ${T.latest} を呼び出したと表示し、回答に期間、日本語の要約、${new URL(props.base).host} のリンクがあれば、接続できています。`}</p>
        </Step>
      </Steps>

      <Block title={`${mcpToolCount()} 個のツール`}>
        <Table
          head={["ツール", "できること", "聞き方の例"]}
          minWidth={600}
          rows={[
            [<Mono>{T.latest}</Mono>, "過去 24 時間か直近 7 日の厳選、すべてのニュース", `今日の${withSubject("ニュース")}は？`],
            [<Mono>{T.search}</Mono>, AGENT.search.scope, AGENT.search.ask],
            [<Mono>{T.hot}</Mono>, "いまのホットランキング Top 10", "いちばん話題になっているのは？"],
            [<Mono>{T.story}</Mono>, "話題の出来事 1 件の時系列と、更新され続けるまとめ", "この件の経緯は？"],
            [<Mono>{T.daily}</Mono>, `最新か指定した日付の${withSubject("日報")}`, "今日の日報をちょうだい。"],
            [<Mono>{T.weekly}</Mono>, `最新か指定した週の${withSubject("週報")}`, `今週の${withSubject("業界")}の大きな出来事は？`],
            [<Mono>{T.monthly}</Mono>, `最新か指定した月の${withSubject("月報")}`, `9 月の${withSubject("業界")}で何があった？`],
            ...AGENT_PARTS.flatMap((a) => a.tools ?? []).map((t) => [<Mono>{t.name}</Mono>, t.does, t.ask]),
          ]}
        />
      </Block>

      <Details
        items={[
          {
            title: "制限と安全",
            body: (
              <Bullets items={[
                "通常の検索は最大 30 件、話題は最大 10 件、出来事の時系列は最大 50 件。範囲を超えるとはっきりエラーになり、黙って広げることはありません。",
                `${T.story} の public_id は、話題のツールが返す出来事のリンクからだけ取り、ID を推測しないでください。`,
                "タイトルと要約は外部の情報源から来たもので、資料としてだけ扱ってください。ツールはこの安全上の境界を示します。重要な数字、規制、発言は原文で確認してください。",
              ]} />
            ),
          },
          {
            title: "つながらないとき",
            body: (
              <Bullets items={[
                "まずアドレスが完全か、クライアントがリモートの Streamable HTTP に対応しているかを確認してください。新しいツールが見えないときは、ツール一覧を更新するか接続し直してください。",
                ...AGENT_PARTS.flatMap((a) => a.mcpTroubles ?? []),
                "サービスにログインは不要です。クライアントに OAuth や API キーを聞かれたら「なし」を選んでください。",
                "429 が返ったら案内どおり少し待ち、並列で再試行しないでください。",
                <>それでもつながらないときは、クライアントの名前、バージョン、エラーを<Link viewTransition to="/feedback" className={link}>フィードバックページ</Link>に書いてください。</>,
              ]} />
            ),
          },
        ]}
      />
    </>
  );
}

const FEEDS = [
  { name: "厳選の要約", badge: "おすすめ", path: "/feed.xml", desc: "最新 50 件の厳選。タイトル、要約、サイト内の閲覧ページと原文へのリンク付き。" },
  { name: "厳選の全文", path: "/feed/full.xml", desc: "同じ 50 件。転載が許可された情報源は全文を付け、それ以外は要約のままです。" },
  { name: "すべてのニュース", path: "/feed/all.xml", desc: "直近 7 日の公開ニュースを、原文の発表日時の新しい順に。" },
  { name: withSubject("日報"), path: "/feed/daily.xml", desc: `${EDITION_WHEN.daily}（${TIME_ZONE.label}）に 1 号：トップのリードと号全体の目次。直近 30 号を保持します。` },
  { name: withSubject("週報"), path: "/feed/weekly.xml", desc: `${EDITION_WHEN.weekly}（${TIME_ZONE.label}）に 1 号：総括と欄ごとに分けた${REPORTS.entry.noun}。直近 12 号を保持します。` },
  { name: withSubject("月報"), path: "/feed/monthly.xml", desc: `${EDITION_WHEN.monthly}（${TIME_ZONE.label}）に 1 号：総括と欄ごとに分けた${REPORTS.entry.noun}。直近 12 号を保持します。` },
];

/** The category feeds, under the names the feeds themselves use. */
const FEED_CATEGORIES = PUBLIC_API_CATEGORY_KEYS.map((key) => [key, feedCategoryLabel(key)] as const);

export function RssPanel(props: AgentPanelProps) {
  const { base } = props;
  const lead = `${["主要な RSS 2.0 リーダーに対応し、n8n や Zapier のような自動化ツールにもつなげられます。アドレスは長く変わりません", ...AGENT_PARTS.flatMap((a) => a.rssLead ?? [])].join("。")}。`;
  return (
    <>
      <PanelHead label="RSS" title="アドレスをコピーして、リーダーで購読">
        {lead}
      </PanelHead>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEEDS.map((f) => (
          <div key={f.path} className="card flex flex-col p-4">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{f.name}</span>
              {f.badge && <span className="inline-flex h-[18px] items-center rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">{f.badge}</span>}
            </div>
            <p className="mt-1 flex-1 text-[13px] leading-[1.7] text-ink-3">{f.desc}</p>
            <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
              <code className="mono min-w-0 flex-1 truncate text-[12px] text-ink-4">{base}{f.path}</code>
              <CopyButton text={addressOf(props, f.path)} label="アドレスをコピー" className="shrink-0" />
            </div>
          </div>
        ))}
      </div>
      {TAG && <p className="mt-3 text-[12.5px] text-ink-4">{TAG.rss}</p>}

      <Block title="カテゴリごとに購読">
        <Table
          head={["カテゴリ", "要約", "全文"]}
          minWidth={420}
          rows={FEED_CATEGORIES.map(([slug, label]) => [
            <span className="font-medium text-ink">{label}</span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/full/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/full/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
          ])}
        />
      </Block>

      <Block title="更新の頻度の目安">
        <p>リーダーは前回の ETag を付けて問い合わせ、内容が変わっていなければごく小さな 304 だけが返り、再ダウンロードしません。30 分に 1 回の更新で十分で、それより速くても新しい内容は得られません。</p>
        <p className="mt-3 text-[13px] text-ink-3">{`項目のリンクはサイト内の閲覧ページを指し、原文のリンクは要約の中にあります。匿名で購読できても、すべての用途が許可されているわけではありません${POLICY.terms.notes ? `：${POLICY.terms.notes.rss}` : ""}。詳しくは`}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>を参照してください。</p>
      </Block>
    </>
  );
}

const RECIPES = [
  { key: "latest", label: "最新ニュースを追う" },
  { key: "sync", label: "厳選をすべて同期" },
];

export function ApiPanel(props: AgentPanelProps) {
  const { base, tag } = props;
  const userAgent = [ACCESS.userAgent, TAG && tag ? TAG.userAgent(tag) : null].filter(Boolean).join(" ");
  const curl = `curl --compressed${userAgent ? ` -A '${userAgent}'` : ""}`;
  let pace = `内容の変わる頻度：新しいニュースは一日中少しずつ入り、厳選は 1 日に数回から数十回変わります。日報は${EDITION_WHEN.daily}、週報は${EDITION_WHEN.weekly}、月報は${EDITION_WHEN.monthly}（${TIME_ZONE.label}）にそれぞれ 1 号です。`;
  if (ACCESS.ratePerMinute) pace += `同じ IP から 1 分間に約 ${ACCESS.ratePerMinute} 回を超えると 429 が返ります。Retry-After のとおり待ち、並列で再試行しないでください。`;
  const [recipe, setRecipe] = useState<string>("latest");
  const recipes = AGENT_PARTS.flatMap((a) => a.recipes ?? []);
  const items = `${base}/api/v1/items?mode=selected&window=24h&limit=20`;
  return (
    <>
      <PanelHead label={`REST API · ${V}`} title="匿名の GET で、すぐに使える">
        トークンは不要です。ブラウザからのクロスオリジン、curl、各言語の標準の HTTP クライアントから直接呼べます。パスは /api/v1 で、項目とエラーコードは <a href="/openapi-v1.json" className={link}>OpenAPI</a> が正です。
      </PanelHead>
      <CodeBlock className="mt-6" title="最初のリクエスト" lang="bash" code={`${curl} '${items}'`} />

      <Block title="軽く、速く使う">
        <Tips
          items={[
            { title: "圧縮を有効に", text: <>curl なら <Mono>--compressed</Mono> を付け、ほかのクライアントは gzip か br を有効にしてください。JSON は圧縮で元の 1/4〜1/8 になります。</> },
            { title: "ETag を付ける", text: <>レスポンスの ETag を保存し、次回は <Mono>If-None-Match</Mono> を付けてください。内容が変わっていなければ 304 が返り、本文は送られません。</> },
            { title: "間隔を守る", text: `ニュースと話題は最短で 1 分に 1 回。日報は${EDITION_WHEN.daily} の後に 1 回、週報と月報は発行後に 1 回取ってください。ページを遡るときは、手元にある項目に着いたら止めてください。` },
          ]}
        />
        <p className="mt-3 text-[13px] leading-[1.75] text-ink-3">{pace}</p>
      </Block>

      <Block title="インターフェース一覧">
        <Table
          head={["パス", "用途", "取得の頻度"]}
          minWidth={640}
          rows={[
            { group: "ニュース" },
            [<Mono>/api/v1/items</Mono>, "厳選か直近 7 日のすべてのニュース。カテゴリ、期間、キーワードで絞り込める", "最短 1 分に 1 回"],
            { group: "話題と出来事" },
            [<Mono>/api/v1/hot-topics</Mono>, "いまのホットランキング Top 10", "最短 1 分に 1 回"],
            [<Mono>{"/api/v1/stories/{publicId}"}</Mono>, "出来事 1 件の報道の時系列、AI のまとめ、関連する出来事", "必要なとき"],
            { group: "日報" },
            [<Mono>/api/v1/dailies/latest</Mono>, "最新号の日報", `${EDITION_WHEN.daily} の後に 1 回`],
            [<Mono>{"/api/v1/dailies/{date}"}</Mono>, "指定した日付の日報。取り下げで引用が消えることがある", "キャッシュが切れた後、使う前に ETag で検証"],
            [<Mono>/api/v1/dailies</Mono>, "日報の日付の索引", "1 日に 1 回"],
            { group: "週報と月報" },
            [<Mono>/api/v1/weeklies/latest</Mono>, "最新号の週報：トップ、総括、欄ごとに分けた 1 週間の重点", `${EDITION_WHEN.weekly} の後に 1 回`],
            [<Mono>{"/api/v1/weeklies/{week}"}</Mono>, "指定した週（ISO 週。例：2026-W39）。取り下げで引用が消えることがある", "キャッシュが切れた後、使う前に ETag で検証"],
            [<Mono>/api/v1/weeklies</Mono>, "週報の索引", "1 週に 1 回"],
            [<Mono>/api/v1/monthlies/latest</Mono>, "最新号の月報", `${EDITION_WHEN.monthly} の後に 1 回`],
            [<Mono>{"/api/v1/monthlies/{month}"}</Mono>, "指定した月（例：2026-09）", "キャッシュが切れた後、使う前に ETag で検証"],
            [<Mono>/api/v1/monthlies</Mono>, "月報の索引", "1 か月に 1 回"],
            ...AGENT_PARTS.flatMap((a) => (a.api ? [{ group: a.api.group }, ...a.api.rows.map(([path, does, often]) => [<Mono>{path}</Mono>, does, often])] : [])),
            { group: "AI アシスタント向け" },
            [<Mono>/api/v1/agent</Mono>, `Agent 向けの利用説明。挙げたアドレスは整理済みの日本語 Markdown を返す${GUIDE_CLIENTS ? `。${GUIDE_CLIENTS} が使うのもこれら` : ""}`, "必要なとき"],
            { group: "厳選の完全な同期" },
            [<Mono>/api/v1/selected/snapshot</Mono>, "いまの厳選すべて。ページ送りで一度に取り切る", "最初の 1 回だけ"],
            [<Mono>/api/v1/selected/changes</Mono>, "その後の追加、変更、厳選からの除外", "数分に 1 回"],
          ]}
        />
      </Block>

      <Block title="よくある使い方">
        <PillTabs size="xs" layoutId="agent-api-recipe" label="使い方" active={recipe} onSelect={setRecipe} items={[...RECIPES, ...recipes].map((r) => ({ key: r.key, label: r.label }))} />
        {recipe === "latest" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# 初回：レスポンスヘッダーの ETag を保存する\n${curl} -i '${items}'\n# 以後は最短で 1 分に 1 回、ETag を付ける。304 なら変化なし\n${curl} -i -H 'If-None-Match: <前回の ETag>' '${items}'`} />
            <p>ページを遡るときは、<Mono>page.nextCursor</Mono> を cursor として渡し、手元にある項目に着いたら止めてください。毎回 7 日分を読み直さないでください。</p>
          </>
        )}
        {recipe === "sync" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# 初回：ページ送りで取り切る。最初のページのレスポンスの cursor を保存する（どのページも同じ）\n${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500'\n# hasMore が true なら nextPage を付けて最後まで続ける\n${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500&page=<前のページの nextPage>'\n# 以後：cursor をそのまま渡し、追加・変更・除外だけを取る\n${curl} '${base}/api/v1/selected/changes?cursor=<最初のページの cursor>&limit=100'`} />
            <p>各ページをローカルに書き込めてから、新しい cursor を保存してください。cursor は記録の位置で、どれだけ置いても期限切れになりません。409 <Mono>snapshot_required</Mono> が返ったらスナップショットを取り直してください。データが黙って抜け落ちることはありません。</p>
          </>
        )}
        {recipes.map((r) => recipe === r.key && <r.Body key={r.key} base={base} curl={curl} />)}
      </Block>

      <Block title="エラーのとき" id="agent-api-recovery">
        <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
          <dt className="mono text-[13px] text-ink">400</dt>
          <dd>引数が正しくありません：OpenAPI と返ってきた code に従って直し、自動でより広い検索に変えないでください。cursor が無効か期間外なら invalid_cursor が返るので、最初のページからやり直してください。</dd>
          <dt className="mono text-[13px] text-ink">409</dt>
          <dd>snapshot_required：差分を安全に続けられないので、完全なスナップショットを取り直してください。</dd>
          <dt className="mono text-[13px] text-ink">429</dt>
          <dd>リクエストが多すぎます：Retry-After のとおり待ち、並列で再試行しないでください。</dd>
          <dt className="mono text-[13px] text-ink">5xx</dt>
          <dd>指数バックオフで再試行し、それまでは前回成功した結果を使ってください。公開サービスは SLA を約束しません。</dd>
          {AGENT_PARTS.flatMap((a) => a.apiErrors ?? []).map(([status, what]) => (
            <Fragment key={status}>
              <dt className="mono text-[13px] text-ink">{status}</dt>
              <dd>{what}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ink-3">{`匿名で呼べても、すべての用途が許可されているわけではありません${POLICY.terms.notes ? `：${POLICY.terms.notes.api}` : ""}。詳しくは`}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>を参照してください。</p>
      </Block>

    </>
  );
}
