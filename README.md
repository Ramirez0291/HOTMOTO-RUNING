# HOTMOTO

**二輪市場の HOT POINTS を定点観測するサイト。**

国内外の二輪メーカーの発表、業界団体の統計、二輪メディアを自動で見張り、言語モデルが予備選別・独立した 2 回の採点・日本語のタイトルと要約の執筆を行います。同じ出来事を報じた複数の記事は 1 つの「出来事」にまとめ、独立した情報源がどれだけ話題にしているかでホットランキングを作り、毎朝 8:00（日本時間）に日報、毎週月曜に週報、毎月 1 日に月報を発行します。

ウェブサイトのほか、RSS、公開 API、Agent 向け Markdown、MCP でも同じ内容を提供します。


## 何を「HOT POINTS」とするか

日本市場を中心に、インド・ASEAN・欧米・中国の大きな動きも拾います。採点の基準は [`industry/prompts/selection-score.md`](industry/prompts/selection-score.md) にあります。

| 扱い | テーマ |
|---|---|
| 重点（高く評価） | 新型車・モデルチェンジ・価格改定、販売・登録台数・決算・市場データ、規制・政策・リコール、用品・カスタムパーツ |
| 収録（独立した話題として扱う） | 業界動向（提携・買収・人事・電動化戦略など）、モータースポーツ、イベント・ツーリング、試乗記・解説・論評 |
| ノイズ（低く評価） | 中古車の相場・買取、レンタル・サブスク、販売店の開店やキャンペーン、タイアップ広告、まとめ記事 |

## しくみ

1 本の資料が情報源から入ると、重複を確かめてから予備選別し、重要そうなものは独立に 2 回採点し、日本語のタイトルと要約を書き、ほかの報道と出来事にまとめ、話題度に数えます。点数がしきい値を超え、厳選済みのニュースの重複でもないものだけが厳選に入ります。日報はルールで当日の重要ニュースを編み、週報・月報は日報から編みます。各工程のプロンプトはすべて [`industry/prompts/`](industry/prompts/) にあり、基準を変えるのにコードを変える必要はありません。

**話題度**は記事ではなく出来事ごとに数えます：48 時間以内、独立した情報源ごとに 1 回だけ数え、24 時間で半減します。同じメディアが 10 本書いても 1 回なので、上位に来るのは本当に多くの人が話題にしている出来事です。

## 動かす

[Docker](https://docs.docker.com/get-docker/) が必要です。モデルの工程は、既定では **Agent** が処理します（API キー不要）。OpenAI 互換のモデル API キー（Claude、Gemini など）で処理することもできます。

```bash
node scripts/init-env.ts                       # Agent で処理する（AGENT_TOKEN を自動で作る）
node scripts/init-env.ts --llm-key <API キー>   # API でも処理できるようにする
docker compose up -d --build
```

<http://localhost:3000> を開きます。管理画面は `/admin` で、管理者パスワードは `.env` の `ADMIN_PASSWORD` にあります。収集は 1〜2 分で始まります。

- **Agent で処理する**：Claude Code などの Agent を定期的に実行し、作業のインターフェース（`/api/agent/tasks`）からタスクを取って答えさせます。プロンプトと cron の例は [Agent による処理](docs/agent.md) にあります。新しい記事は Agent の次の実行（既定は 1 時間ごと）で判断されます。
- **API で処理する**：管理画面の「モデル」ページの「処理方式」で API を選ぶか、`.env` に `PROCESSING_MODE=api` を書きます。初回に取り込む資料はおよそ 30 分で処理が終わります。

Node.js での直接起動、ドメインと HTTPS の設定は [デプロイ](docs/deploy.md) を参照してください。

## 公開前に決めること

- **情報源**：[`industry/sources.json`](industry/sources.json) には動作確認済みの 18 の情報源（メーカー公式 4、欧州業界団体 1、国内メディア 7、海外メディア 6）が入っています。運用しながら管理画面の「情報源」で追加・停止してください。
- **しきい値の校正**：[`industry/selection.ts`](industry/selection.ts) の数値は AI 業界で校正された初期値のままです。自分でラベル付けした二輪のサンプル 100〜200 件で校正し直してください（[厳選と校正](docs/selection.md)）。
- **利用規約とプライバシーポリシー**：[`site/pages/`](site/pages/) はひな形です。運営者、連絡先、許可する用途を書き入れ、必要なら専門家の確認を受けてください。
- **ブランド**：ロゴは [`site/brand/`](site/brand/) で差し替えられます（いまはサイト名を文字で組んだもの）。

## 主なファイル

| ファイル | 内容 |
|---|---|
| `site/site.ts` | サイト名、業界名、表示言語、タイムゾーン、トップページと About ページの文言 |
| `industry/taxonomy.ts`、`industry/topics.json` | カテゴリ、タグ、メーカー、トピック |
| `industry/sources.json` | 初回起動時に取り込む情報源 |
| `industry/prompts/` | 厳選の基準と書き方。**二輪業界の知見はここに書く** |
| `industry/selection.ts` | 入選のしきい値 |
| `site/models.ts` | 処理方式（Agent か API か）と、各工程で既定に使うモデル（変えなければ `.env` のモデル） |
| `site/brand/`、`site/pages/`、`site/public/` | アイコンとロゴ、規約とプライバシー、`robots.txt` などそのまま公開するファイル |

## 言語とタイムゾーン

表示言語とモデルが書く言語は `site/site.ts` の `SITE.locale`・`SITE.language`（いまは `ja-JP`・`ja`）、日付と時刻の基準は `TIME_ZONE`（いまは日本時間）で決まります。どの文章がサイトの言語で書かれているか（翻訳が要るか）の判定は [`packages/contracts/src/language.ts`](packages/contracts/src/language.ts) にまとめてあり、日本語と中国語に対応しています。将来の日中切り替えの考え方は [アーキテクチャ](docs/architecture.md) を参照してください。

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [業界の変え方](docs/customize.md) | サイト名、分類、トピック、情報源、プロンプト、しきい値、モデル、ブランドを順に |
| [情報源](docs/sources.md) | 6 種類の情報源の設定、格付けと全文、外部からの送信インターフェース |
| [厳選と校正](docs/selection.md) | 資料が厳選になり日報・週報・月報に編まれるまで、自分のサンプルでの校正 |
| [出来事のまとめと関係の評価](docs/grouping.md) | 出来事の関係の判断、ペアの正解データでの評価 |
| [Agent による処理](docs/agent.md) | API を使わずに Agent がモデルの工程を処理するしくみ、作業のインターフェース、定期実行の例 |
| [デプロイ](docs/deploy.md) | Docker、ドメインと HTTPS、更新、バックアップ、費用 |
| [アーキテクチャ](docs/architecture.md) | 3 つのプロセス、変わらない規則、ディレクトリ、公開の出口 |

技術スタック：Node.js 24 · TypeScript · React Router（サーバーサイドレンダリング）· Fastify · PostgreSQL · pg-boss · Tailwind CSS · Docker Compose。

## ライセンス

[GPL-3.0](LICENSE)

> このサイトは [AIHOT](https://github.com/KKKKhazix/AIHOT/) のオープンソースフレームワーク（MIT ライセンス）をもとに、二輪業界向けに作り直したものです。
