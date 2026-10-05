# 情報源

情報源は管理画面の「情報源」ページで管理します：新規作成、試しに 1 回取得して何が取れるかを見る、頻度の変更、有効・停止、失敗の理由と最近の記事の確認。初回起動時には `industry/sources.json` の示範の情報源を取り込みます。

## 6 種類の情報源

| 種類 | 向いているもの | 必要なもの |
|---|---|---|
| `rss` | RSS / Atom があるブログ、メディア、Substack、WeChat 公式アカウントを RSS にするサービス | なし |
| `web_list` | RSS のないウェブの一覧（ニュースページ、ブログの一覧、更新履歴） | セレクターを書く。必要に応じて Jina Reader の描画（回数で課金） |
| `json_list` | JSON を返すインターフェース（GitHub Releases など） | 項目のパスを書く |
| `x_search` | X のアカウント | SocialData の鍵。リクエストごとに課金 |
| `mp_account` | WeChat 公式アカウント | 極致了（Dajiala）の鍵。リクエストごとに課金 |
| `external` | 自分のスクリプトから送る内容 | `INGEST_TOKEN`。下を参照 |

`json_list` のアドレスや設定には認証情報が含まれることがあるので、同じオリジン（プロトコル、ホスト、ポートがすべて同じ）へのリダイレクトだけをたどります。インターフェースが別のオリジンに移ったら、情報源のアドレスを直接更新してください。オリジンをまたぐ転送で認証情報を渡すことに頼らないでください。

情報源の種類ごとにどの設定項目を受け付けるかは [`config-keys.ts`](../packages/backend/src/sources/config-keys.ts) に書いてあります。知らない設定項目を入れると、保存は拒否され、取得はそのまま失敗して管理画面に理由が出ます。黙って汎用の解析に戻ることはありません。


## まずプレビュー、それから作成

`/admin/sources/new` に入り、ID と名前を入れ、種類を選んでから、下の対応する JSON を「収集の設定（JSON）」に入れます。ここに入れるのは設定のオブジェクトで、`kind` や `config` で包まないでください。種類を切り替えると設定がリセットされるので、先に種類を選んでから貼り付けます。

名前の中の全角かっこのメモ（たとえば「あるメディア（話題 RSS）」）は管理画面向けで、読者がウェブ、RSS、Agent 向け Markdown、MCP、検索で見るのはメモを除いた名前です。X のアカウントを `X：表示名 (@handle)` と書くと、読者には表示名だけが見えます。公開 API の JSON には完全な名前が入ります。

`rss`、`web_list`、`json_list`、`x_search` では「取得をプレビュー」を押せます：記事の総数と先頭 20 件のタイトル、原文のリンク、発表日時、要約を表示し、記事は保存しません。取れているのがナビゲーションではなく記事か、日付が原文と一致するかを確かめてから「作成」を押します。プレビューは本番の収集の完了と同じではなく、その後の詳細の補完、厳選、公開の流れも通りません。

プレビューも取得のリクエストを送ります。X と Jina のプレビューには費用がかかることもあり、有料の受領記録と予算を通ります。`COLLECT_ENABLED=false` は管理画面の自動の収集を止めるだけで、手動のプレビューが外部のサービスにアクセスしないことは保証しません。下のローカルの HTML/JSON の例には API キーは要りません。

### rss

```json
{ "feedUrl": "https://example.com/feed.xml" }
```

任意：`summaryIsBody`（フィードの要約が本文そのもの：RSS の `description`、Atom の `summary` を長さにかかわらず本文として扱い、原文のページを取得しない）、`allowCategories` / `denyCategories`（フィードのカテゴリで絞り込む。いまの設定では RushLane を `"Bike News"` だけに絞っています）。

どの種類の情報源でも、`ingestNoiseFilter` で取り込む前に項目を絞れます：`requireMarkers` はタイトルか要約にどれかの語がある項目だけを残し（政府の一覧や総合ニュースのような広い情報源から二輪の項目だけを取るとき）、`dropMarkers`・`dropMarkersTitleOnly` はその語がある項目を捨て、`keepIfMatches` は `dropMarkers` の例外です。語は大文字と小文字を区別しません。絞り込みは保存とモデルの呼び出しより前なので、捨てた項目に費用はかかりません。

ウェブページのないポッドキャストの回（`<link>` がなく、`guid` も URL ではない）は、原文のリンクに音声や動画のファイルを使い、ブラウザで直接再生できます。こうした回はウェブページを取得せず、フィードの文字で処理します。

### web_list

普通の CSS セレクターに対応し、`div` の一覧も収集できます。肝心なのは、`itemSelector` で全体を包む入れ物ではなく**ニュース 1 件ずつ**を選ぶことです。例：

```html
<div class="news-list">
  <div class="news-item">
    <h2><a href="/posts/first">1 件目の例のニュース</a></h2>
    <time datetime="2026-10-01T09:00:00+09:00">10 月 1 日</time>
  </div>
  <div class="news-item">
    <h2><a href="/posts/second">2 件目の例のニュース</a></h2>
    <time datetime="2026-10-01T10:00:00+09:00">10 月 1 日</time>
  </div>
</div>
```

対応する設定（`example.com` は仮のアドレスなので、対象のウェブページに替えてください。動く版は[ローカルの例](#ローカルで-htmljson-の例を動かす)）：

```json
{
  "url": "https://example.com/news",
  "parseMode": "html",
  "itemSelector": ".news-list > .news-item",
  "linkSelector": "h2 a",
  "titleSelector": "h2 a",
  "publishedAtSelector": "time",
  "allowUrlPrefixes": ["https://example.com/posts/"]
}
```

- `itemSelector` はページ全体から項目を探します。`linkSelector`、`titleSelector` は各項目の中で最初に一致したノードを取り、項目自身に一致させることもできます。`.news-list` を選ぶと入れ物が 1 つ取れるだけで、たいてい 1 件目のニュースしか取れません。`div` とだけ書くと入れ子の入れ物が混ざります。繰り返し現れるニュースのノードを選んでください。
- リンクは `href` から取ります。`/posts/first` のような相対リンクは一覧の `url` を基準に解決し、`baseUrl` で基準のアドレスを指定することもできます。タイトルはノードの文字を取ります。重複したリンクはまとめ、一覧自身を指すリンクはたいてい飛ばします。
- 日付は項目の中で `publishedAtSelector` を探し、`datetime` 属性、`title` 属性、文字の順に読みます。タイムゾーンのない日時には `publishedAtUtcOffset`（既定はサイトの `TIME_ZONE`、いまは `+09:00`）を使えます。タイムゾーン付きの時刻はその意味を保ち、`YYYY-MM-DD` だけのものは UTC の 0 時として読みます。「2026年10月1日」や「2025.2.10」の形も読めます。
- `parseMode`：普通のウェブページは既定で `html`。`markdown` は Markdown のリンクとして読み、`docusaurus_changelog` は更新履歴の見出しを読みます。Jina が必要なときは、`url` を明示的に `https://r.jina.ai/https://対象サイト/パス` と書き、`JINA_API_KEY` を設定します。取れないときに自動で切り替わるわけではありません。Jina は既定で Markdown を返すので、CSS セレクターを使い続けるなら `parseMode: "html"` を明示します。
- `detail`：一覧に日付・タイトル・要約がないとき、詳細ページを取得して補います（`publishedAtSelector`、`titleSelector`、`summarySelector` など）。詳細ページと本文の抽出でタイムゾーンのない日時を読んだときは、まず `detail.publishedAtUtcOffset` を使い、なければ情報源の `publishedAtUtcOffset` を引き継ぎ、どちらもなければサイトの `TIME_ZONE` を使います。
- `allowUrlPrefixes` / `denyUrlPrefixes`：特定のパスの下の記事だけを収めます。

いまの設定の例（スズキ二輪ニュース、カワサキのニュース）は `industry/sources.json` にあります。

### json_list

インターフェースが下の構造を返すとすると、`itemsPath` は配列を指し、ほかの項目のパスは**配列の各要素**からの相対で書きます。パスはドット区切りで、JSONPath ではなく、`$` や `[*]` は書きません。

```json
{
  "data": {
    "items": [
      {
        "id": "first",
        "title": "1 件目の例のニュース",
        "url": "https://example.com/posts/first",
        "summary": "1 件目のニュースの要約。",
        "published_at": "2026-10-01T09:00:00+09:00"
      }
    ]
  }
}
```

対応する設定：

```json
{
  "url": "https://example.com/api/news",
  "mode": "json_api",
  "itemsPath": "data.items",
  "titlePaths": ["title"],
  "urlTemplate": "{raw:url}",
  "summaryPaths": ["summary"],
  "publishedAtPath": "published_at",
  "externalIdPath": "id"
}
```

- インターフェースが配列そのものを返すときは `itemsPath` を省きます。`titlePaths`、`summaryPaths`、`authorPaths` は候補のパスの配列で、順に最初の空でない値を取ります。例：`["title", "name"]`。
- 完全な URL があるときは `{raw:url}` を使い、slug だけなら `https://example.com/posts/{slug}` のようにします。`{項目のパス}` は値をエンコードし、`{raw:項目のパス}` はそのまま入れます。JSON の一覧は相対の URL を自動で絶対の URL にしないので、テンプレートは完全な HTTP(S) のアドレスを作る必要があります。
- 日付はタイムゾーン付きの ISO の文字列がおすすめです。`2026-09-30 17:43:58` のようなタイムゾーンのない時刻は、ウェブの一覧と同じく `publishedAtUtcOffset`（既定はサイトの `TIME_ZONE`）で読みます。数値のタイムスタンプは `publishedAtUnit: "epoch_s"`（秒）か `"epoch_ms"`（ミリ秒）、`20261001` のような日付は `"yyyymmdd"` を設定します。
- タイトルがない、またはリンクを作れない項目は飛ばします。空でない配列が全部対応付けに失敗すると `no items mapped (check title/url paths)` を、パスが配列でなければ `items path did not resolve to an array` を報告します。

### ローカルで HTML/JSON の例を動かす

リポジトリには架空の例が 2 つあります：[news.html](examples/sources/news.html) と [news.json](examples/sources/news.json)。それぞれニュースが 2 件です。セレクターと項目の対応付けを確かめるためのもので、運用の情報源ではなく、例の記事のリンクには本文がありません。

リポジトリのルートで、Node.js 24.11 以上で次を実行します。サービスはローカルでだけ待ち受け、この 2 つのファイルだけを提供します。`Ctrl+C` で止めます。

```bash
node --input-type=module -e '
import http from "node:http";
import { readFileSync } from "node:fs";
const files = {
  "/news.html": ["text/html; charset=utf-8", readFileSync("docs/examples/sources/news.html")],
  "/news.json": ["application/json", readFileSync("docs/examples/sources/news.json")]
};
http.createServer((req, res) => {
  const file = files[req.url];
  res.writeHead(file ? 200 : 404, { "content-type": file ? file[0] : "text/plain" });
  res.end(file ? file[1] : "Not found");
}).listen(8787, "127.0.0.1");'
```

同じマシンで、[Docker を使わない方法](deploy.md#docker-を使わない) で開発用の API とウェブを動かし、収集、モデル、飛書、IndexNow の安全弁は閉じたままにし、worker は起動しません。このローカルの例のためだけに、開発用の API のプロセスに `ALLOW_PRIVATE_NETWORK_FETCH=true` を設定して再起動します。既定では内部ネットワークのアドレスの取得は禁止で、本番ではこの設定を拒否します。確認が終わったら外してください。API がコンテナか別のサーバーにあるなら、`127.0.0.1` はその API 自身を指すので、このコマンドのアドレスはそのデプロイではそのまま使えません。

`web_list`、`json_list` をそれぞれ選び、設定を貼り付けて「取得をプレビュー」を押します。情報源を作る必要はありません：

```json
{
  "url": "http://127.0.0.1:8787/news.html",
  "parseMode": "html",
  "itemSelector": ".news-list > .news-item",
  "linkSelector": "h2 a",
  "titleSelector": "h2 a",
  "publishedAtSelector": "time",
  "allowUrlPrefixes": ["http://127.0.0.1:8787/posts/"]
}
```

```json
{
  "url": "http://127.0.0.1:8787/news.json",
  "mode": "json_api",
  "itemsPath": "data.items",
  "titlePaths": ["title"],
  "urlTemplate": "http://127.0.0.1:8787/posts/{id}",
  "summaryPaths": ["summary"],
  "publishedAtPath": "published_at",
  "externalIdPath": "id"
}
```

どちらも **2 件** が表示され、順に下の表の内容になります。JSON の例には対応する要約も出ますが、HTML の例には要約の抽出を設定していません（例のファイルの日付は `+08:00` で書かれています）。

| タイトル | 原文のリンク | プレビュー API の publishedAt |
|---|---|---|
| 第一条示例新闻 | `http://127.0.0.1:8787/posts/first` | `2026-10-01T01:00:00.000Z` |
| 第二条示例新闻 | `http://127.0.0.1:8787/posts/second` | `2026-10-01T02:00:00.000Z` |

HTML の `itemSelector` を一時的に `.news-list` に変えて比べてみてください：1 件目しか返りません。`.news-list > .news-item` に戻すと 2 件に戻ります。これが「一覧の入れ物」と「ニュース 1 件ずつ」の違いです。

実際のウェブページを取得するときは、まず生の HTTP レスポンスにニュースのノードがあるかを見てください。普通の HTML モードは JavaScript を実行しません。ブラウザでは見えるのにレスポンスにない内容は、CSS セレクターを替えても作れません。RSS か JSON のインターフェースを優先して探し、必要に応じて Jina か自前の外部の収集を設定してください。`no items matched (html)` は、セレクターが一致しない、`href` やタイトルがない、リンクが接頭辞の規則で除外された、のどれかのこともあります。収集の方法を替える前に、レスポンスと設定を確かめてください。

### x_search

この種類の情報源は SocialData の検索を使うもので、X のプロフィールの URL をウェブの一覧に入れるのではありません。`https://x.com/SomeAccount` なら、ユーザー名 `SomeAccount` を取り、`@` や URL 全体は含めません：

```json
{ "query": "from:SomeAccount -filter:replies", "searchType": "Latest" }
```

`SomeAccount` は仮のユーザー名なので、追いたい実在のアカウントに替えてください。`-filter:replies` は返信を除き、`Latest` は最新の内容で探します。

バックエンドの実行環境の `.env` に `SOCIALDATA_API_KEY` を設定し、API（プレビュー）と worker（定期の収集）を再起動すると有効になります。鍵を情報源の JSON に書いたりリポジトリにコミットしたりしないでください。先に管理画面の「設定 → 有料リクエストの上限」で SocialData の枠を確認し、必要に応じてプレビューします。鍵がなければ `SOCIALDATA_API_KEY is not configured` と報告し、サービスがリクエストを拒否したときや予算で遮断されたときは管理画面のエラーの理由を見てください。プレビューには有料のリクエストがありうるので、この文書は実際のサービスでの確認を求めません。結果はアカウントとサービスのその時の応答によります。

本番の自動の収集では、普通のアカウントは自動で 1 回の検索にまとめられ（1 回に最大 20 数件のアカウント）、リクエスト数を節約します。1 つの情報源の手動のプレビューはまとめた収集ではありません。

### mp_account

```json
{ "ghid": "gh_xxxxxxxx", "nickname": "公式アカウントの名前" }
```

WeChat 公式アカウントごとに取得の間隔で 1 回確認し（一覧の確認は回数で課金）、新しい記事の本文も一緒に取ります。

バックエンドの `.env` に `DAJIALA_KEY` を設定し、`ghid` は公式アカウントの元の ID に替えます。設定の項目は上の `ghid` / `nickname` を使い、`biz` / `name` とは書きません。いまの `mp_account` は「取得をプレビュー」に対応していません。`external` も試しの取得には対応していないので、下の送信インターフェースで接続します。

## 格付け、参加方法、全文

- **格付け** `tier`：`T1` 公式の一次情報（公式サイト、公式ブログ、団体）、`T1_5` 公式アカウントと準公式の発信者、`T2` メディアと個人、`EXCLUDE_MP` 厳選に参加しない。入選のしきい値は格付けで違います（`industry/selection.ts`）。
- **参加方法** `participation_mode`：`editorial` は厳選とすべてのニュースに入る。`hot_signal` は単独では表示せず、「みんなが何を話しているか」の話題度の証拠にだけ使う。`isolated` はどの公開ページにも出ない。
- **一次情報**：`T1` だけが一次情報で、別には設定しません。同じニュースに複数の報道があるとき、代表記事は一次情報を優先し、出来事のページも一次情報の報道を優先して表示します。
- **発表元**（任意、`config` に書く）：
  - `publisherUrlPrefixes`：`T1` の情報源自身の記事の URL の接頭辞。例：`["https://example.com/blog/"]`。ほかの情報源（まとめサイト、転載）がもたらしたこれらの URL の記事は、唯一の公式の情報源だと認められれば、その名義に付け替えます。ウェブの一覧の情報源で書かなければ、その一覧があるパスを認めます（その記事も一覧に出ている必要がある）。
  - `publisherRole`：`T1_5` のアカウントの身分。`organization`（団体の公式アカウント）か `person`（公式の人物）。さらに情報源の `owner_entity_id`（`industry/taxonomy.ts` の `ENTITIES` の id）を入れると、このアカウントが発信した、主体がまさにその企業のニュースを代表記事にできます（`T1` の次）。
- **全文**：`site_fulltext` はサイト内で全文を表示できるか、`syndicate_fulltext` は全文の RSS に本文を含められるかを決めます。どちらも**既定では無効**で、要約と原文のリンクだけを表示します。情報源がはっきり許可しているときだけ有効にしてください。WeChat 公式アカウントや有料の壁の中の内容は、技術的に取得できても全文表示の許可にはなりません。

## 取得の頻度

情報源ごとに取得の間隔があります。毎日 04:20 に直近 7 日の産出量で自動調整します：産出が多いものほど頻繁に取り、最短 15 分（Jina で読むウェブの一覧は最短 60 分）。最長は、一般の情報源で 60 分、X のアカウントと Jina で読むウェブの一覧で 120 分、話題度の証拠だけのものは 180 分です。まとめて検索する X のアカウントはまとめた後の頻度に従い、厳選に入るものは 30 分に 1 回、話題度の証拠だけのものは 1 時間に 1 回です。

取得に失敗すると位置は進まず、次は同じところから続けます。連続して失敗した情報源は管理画面で赤く表示し、毎週月曜に運用のグループに情報源の週報を送ります（飛書の社内グループを設定しているとき）。

## 規則：古い記事で埋めない

初めて発見したときに原文の公開から 48 時間を過ぎていた資料、新しい情報源を初めて取り込んだときの既存の記事、さかのぼりの印が付いた送信は、すべて原文の日時で保管します：「今日」に入れず、配信もしません。この規則はすべての入口で共通で、一度に過去の内容を取り込んで画面を埋めることを防ぎます。

新しい情報源を初めて取り込むときは、一覧の先頭 `_hotmoto.initialBackfillLimit` 件（既定 30）、`_hotmoto.initialBackfillMonths` か月以内（既定 12）の項目だけを取ります（いまの示範の情報源は 8 件に絞っています）。その後の取得では、情報源を加える 48 時間前より後に公開された項目だけを収め、一覧の中のそれより古い既存の分は入らず、購読の保管庫全体に費用をかけることもありません。加えた後に公開された項目は、長い一覧の何番目にあっても収めます。一覧に発表日時のない項目も収めますが、原文のページから日付を読んでから上の規則で新旧を判断し、読むまでは公開の一覧と厳選には入れません。X のアカウントは取得の位置から後ろへ読み、この制限を受けません。

## 外部からの送信インターフェース

自分で書いたスクリプトで取得した内容をサイトに送ると、普通の収集と同じ重複確認、厳選、まとめを通ります。全国軽自動車協会連合会や自工会の月次統計のように、一覧ではなくページを更新する形式の資料を取り込むのに向いています。

```
POST /api/ingest/items
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{
  "sourceId": "my-crawler",
  "sourceName": "自分の取得スクリプト",
  "items": [
    { "title": "必須", "url": "必須", "publishedAt": "2026-10-01T08:00:00+09:00", "author": "任意" }
  ]
}
```

- `INGEST_TOKEN` は `.env` で設定し、16 文字以上です。設定しなければインターフェースは常に 401 を返します。
- 1 回に最大 50 件、クライアントごとに 1 分に最大 10 回です。
- `{"ok": true, "created": <新規の件数>}` を返します。JSON のオブジェクトでない項目、タイトルか URL がない項目は飛ばし、同じリクエストの中で重複した URL は最初の 1 件だけを取ります。
- `sourceId` がなければ `external` の情報源を自動で作り、既定では公開ページに出しません：管理画面でその参加方法を `editorial` に変えるとサイトに出ます。
- 管理画面で情報源を停止すると、送信インターフェースは 409 を返し、新しい記事を受け付けません。情報源を再開すれば再び送れます。
- 項目の `raw._hotmoto.backfill` が `true` なら、過去分のさかのぼりとして扱います（「今日」に入れず、配信もしない）。
