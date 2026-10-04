# 出来事のまとめと関係の評価

サイトはまずタイトルと要約で直近 2 週間の候補の事実を呼び出し（ベクトルのサービスを設定していればベクトルで、なければ文字の重なりで比べる）、次にモデルに報道どうしの関係を判断させ、同時にその報道が厳選済みの内容に対して新しい情報を持つかも判断させます（点数が足りた報道はこれを通って厳選に入ります。[厳選と校正](selection.md) を参照）。関係の定義と本番のプロンプトは `industry/prompts/group-*.md`、コードの入口は `packages/backend/src/events/relate.ts` と `group.ts` です。

4 つの関係：

- `SAME_OCCURRENCE`：同じ 1 つの実際の出来事。例：同じ新型車の発表の公式リリースとメディアの報道。
- `SAME_STORY`：同じ 1 つの出来事ではないが、同じ具体的な出来事の直接の進展。例：発表の後の受注開始、試乗記、回答。
- `UNRELATED`：別のこと。主体、車種、話題が同じでも。
- `ROUNDUP`：一方が複数の話題を含むまとめ。

## 自分のラベル付きサンプルでペアの判定を評価する

`scripts/eval-relations.ts` は 2 本の報道の間のペアの関係の判定だけを評価します。本番の `PAIR_SYSTEM`、`pairUser()`、`PairSchema`、プロンプトのバージョンをそのまま使うので、プロンプトが変われば評価も変わります。候補の呼び出しはやり直さず、結果を出来事のまとめに書き戻すこともしません。

自分のラベル付きデータは `.data/` に置きます（このディレクトリは Git に入りません）。`industry/relation-gold.example.jsonl` に架空の例が 4 件あります。1 行に 1 件：

```json
{"caseId":"release-001","a":{"title":"...","source":"...","firstParty":true,"publishedAt":"2026-09-01T10:00:00+09:00","summary":"..."},"b":{"title":"...","source":"...","firstParty":false,"publishedAt":"2026-09-01T10:20:00+09:00","summary":"..."},"samplingContext":{"benchmarkSplit":"development","samplingStratum":"same-release"},"gold":{"relation":"SAME_OCCURRENCE"}}
```

`a`、`b` には本番の `ReportView` と同じ任意の `frame` も付けられます：

```json
{"subject":"Acme Motor","action":"発表","object":"Trail 650","occurredAt":"2026-09-01"}
```

紛らわしい境界のサンプルを開発用に入れ、一部を `benchmarkSplit: "holdout"` として最後の確認に残すことをおすすめします。`samplingStratum` は任意の誤り分析用のラベルで、モデルの入力には影響しません。

### 実行

通常のデプロイの方法でデータベースとモデルを設定してから実行します：

```bash
node --env-file=.env scripts/eval-relations.ts --gold .data/relation-gold.jsonl --split development
```

既定では、いまの `groupReview` の機能が選んでいるモデルを使います。設定済みの複数のモデルを明示して比べることもできます：

```bash
node --env-file=.env scripts/eval-relations.ts --gold .data/relation-gold.jsonl --models default,deepseek-flash --split development --n 200 --seed 7 --thresholds 0.75,0.8
```

使える引数：

| 引数 | 既定値 | 説明 |
|---|---:|---|
| `--gold` | `.data/relation-gold.jsonl` | JSONL の正解データ |
| `--models` | いまの `groupReview` のモデル | カンマ区切りのモデルのキー |
| `--split` | `all` | `development`、`holdout`、または独自の分割 |
| `--n` | `200` | 最大何件評価するか |
| `--seed` | `7` | 決定的な抽出のシード |
| `--concurrency` | `6` | 並列のモデルのリクエスト数 |
| `--thresholds` | `0.75,0.8` | 出来事レベルの結び付きの確信度のしきい値 |

完全なレポートは `.data/eval/relations-*.json` に書きます。モデルごとに次が得られます：

- 4 × 4 の混同行列。
- 種類ごとの適合率 / 再現率 / F1 / 件数。
- 全体の正解率とマクロ F1。
- `SAME_OCCURRENCE` か `SAME_STORY` を正例としたときの、確信度のしきい値ごとの 2 値の適合率 / 再現率 / F1。
- モデルのエラー、token の使用量、提供元の平均の所要時間、実時間。
- 各ケースの判断、確信度、違い、受領記録の id。

モデルの呼び出しは既存の受領記録と予算の仕組みを通ります。同じモデル・プロンプト・入力での繰り返しの評価は既存の受領記録を再利用し、同じ実行の中で入力が同じサンプルは 1 回のリクエストの結果を共有してそれぞれの正解で採点し、失敗も共有して、その実行の中で重ねてリクエストしません。`reused` には共有した結果と既存の受領記録の再利用が含まれます。評価は独立した `eval_relation_pair` の用途を使い、本番のまとめの統計には混ざりません。

token の使用量と平均の所要時間は、レポートが参照する受領記録に対応するすべてのリクエストの試行（以前に解析に失敗した応答を含む）を合計します。同じ受領記録を複数のサンプルで重ねて数えることはありません。キャッシュでの再実行もこれらの履歴の使用量を表示し、今回新たにかかった費用ではありません。

CI は JSONL の解析、決定的な抽出、指標、そしてローカルのモデルの代役での並列の再利用と再試行の使用量の集計を検証し、外部のモデルのサービスにはアクセスしません。
