// サイトの名前と、読者に見える文言。別の業界に変えるときは、まずこのファイルを書き換える。
// 画面とバックエンドの両方がこれを読む。変更後は再ビルド（docker compose up --build）で反映される。
// ドメインはここに書かない：デプロイ時に環境変数 SITE_URL で設定する。

/**
 * 日付と時刻の基準：日報の締め、画面の日付と時刻、定期実行、運用アラートがすべてこれを読む。
 * 夏時間のない地域の固定オフセットで書く（offset は id の時差と一致させる）。label は文言に入る呼び名。
 */
export const TIME_ZONE = { id: "Asia/Tokyo", offset: "+09:00", label: "日本時間" } as const;

/**
 * 日報・週報・月報をいつ出すか（TIME_ZONE の時刻、HH:mm）：日報はこの時刻までの 24 時間を収め、週報は各週の翌月曜、
 * 月報は毎月 1 日に出る。スケジュール、締めの時間帯、欠号アラートと時刻に触れる文言はすべてこれを読む（public/ のファイルは
 * {{dailyTime}}、{{weeklyTime}}、{{monthlyTime}} と書く）。スケジュールは 30 分ごとに確認するので、正時か 30 分を書く。
 */
export const EDITION_TIMES = { daily: "08:00", weekly: "10:00", monthly: "10:30" };

/** 「毎日 08:00」「毎週月曜 10:00」「毎月 1 日 10:30」：文中に入る発行時刻。 */
export const EDITION_WHEN = {
  daily: `毎日 ${EDITION_TIMES.daily}`,
  weekly: `毎週月曜 ${EDITION_TIMES.weekly}`,
  monthly: `毎月 1 日 ${EDITION_TIMES.monthly}`,
};

export const SITE = {
  /** サイト名：ナビゲーション、ページタイトル、シェア画像、RSS、MCP、管理画面で使う。 */
  name: "NIRINHOT",
  /**
   * 業界名：既定の言い回しに組み込まれる（「二輪日報」「二輪ニュース」など）。
   * 「法律」「HR」などに変えると、画面の表記もそれに合わせて変わる。
   */
  subject: "二輪",
  /** トップページの完全なタイトル（ブラウザのタブ、検索結果）。 */
  homeTitle: "NIRINHOT — 二輪市場のHOT POINTSを定点観測 · 毎日の厳選と日報",
  /** トピック一覧（/topics）のタイトル。 */
  topicsTitle: "二輪トピック：メーカー、市場テーマ、コンテンツ形式ごとの最新動向",
  /** フィードバックフォームの入力欄の例文。 */
  feedbackExample: "例：あるキーワードで検索したところ……本当は……を探していました",
  /** 一言紹介：検索エンジン、シェアカード、RSS、llms.txt で使う。 */
  description: "国内外のメーカー発表、業界統計、二輪メディアを自動で見張り、モデルが要約・採点・厳選。同じ出来事の報道を一つにまとめ、二輪市場のHOT POINTSを毎朝の日報で定点観測します。",
  /** llms.txt の一言紹介の下に入る詳しい紹介（任意）。 */
  llmsIntro: null as string | null,
  /** 小さな一行：シェア画像やポスターの下部。 */
  tagline: "二輪市場のHOT POINTSを定点観測",
  /** 検索エンジンが読むキーワード（トップページの構造化データ）。 */
  keywords: ["バイクニュース", "二輪ニュース", "オートバイ", "二輪市場", "バイク新型車", "二輪販売台数"] as string[],
  /** サイトが収録を始めた年（構造化データの期間、任意）。 */
  since: null as string | null,
  /** 画面の言語（HTML lang、og:locale）。 */
  locale: "ja-JP",
  /**
   * 読者が読む言語（ISO 639-1）：モデルが書くタイトル・要約・翻訳の言語。この言語で書かれた原文は翻訳しない。
   * 対応しているのは "ja" と "zh"（packages/contracts/src/language.ts）。
   */
  language: "ja" as "ja" | "zh",
  /** 既定のドメイン。SITE_URL が設定されていないときだけ使う。 */
  defaultUrl: "http://localhost:3000",
  /** 標準アイコン（favicon.ico、icon.png、icon-192.png、apple-icon.png、logo.svg）以外にサイトのルートに置くアイコン。site/brand/ のファイル名（任意）。manifest.webmanifest や外部サイトが参照するときに使う。 */
  rootIcons: [] as string[],
  /**
   * MCP ツール名の接頭辞（小文字英字、数字、下線）。ツールは nirinhot_get_latest、nirinhot_search……になる。
   * 誰かが接続した後は変えない。
   */
  mcpPrefix: "nirinhot",
  /**
   * 公開インターフェース（MCP、OpenAPI、llms.txt）のバージョン。上げるだけで下げない。
   * 既存の項目や意味を変えたときはメジャーを上げ、デプロイの説明に書く。
   */
  interfaceVersion: "4.0.0",
  /** 外部向けの連絡先メール（任意）：llms.txt とレスポンスヘッダーに書く。 */
  contactEmail: null as string | null,
  /** フッターの小さな一行（任意）。 */
  footerNote: "AIHOT オープンソースフレームワークで動いています",
  /** 中国本土のサイトの ICP 届出番号（任意）。入れるとフッターに表示し、工業情報化部の届出システムにリンクする。 */
  icp: null as string | null,
  /** ソースコードの GitHub リポジトリ（任意）。入れるとサイドバー下部と「マイページ」下部に「GitHub でオープンソース」と表示する。 */
  github: null as string | null,
  /** 構造化データの運営者（検索エンジン向け）。 */
  organization: {
    name: "NIRINHOT",
    /** 創設者（任意）。 */
    founder: null as null | { name: string; alternateName?: string; jobTitle?: string; description?: string; url?: string },
  },
  /** 情報源を取得するときに名乗る名前とバージョン（User-Agent に入る）。他のサイトを名乗らない。 */
  crawlerName: "NIRINHOTBot/1.0",
} as const;

/** 利用規約とプライバシーポリシーの 2 ページ（本文は pages/ にある）。 */
export const POLICY = {
  terms: {
    /** ページ名：ナビゲーション、フッター、ページタイトルで使う。 */
    name: "利用規約",
    description: "本サイトのウェブサイト、RSS、公開 API、MCP の利用規約。",
    /** llms.txt でこのページを説明する一文（任意）。 */
    covers: null as string | null,
    /** Agent 接続ページの RSS・API 欄でそれぞれ示す利用上の注意（任意）。 */
    notes: null as null | { rss: string; api: string },
    /**
     * どの用途に事前の許諾が要るかを述べる文（任意）：llms は llms.txt「利用方法」の著作権の説明の後に、
     * agent は Agent 向け利用説明の「利用規約」の節の冒頭に入る。
     */
    license: null as null | { llms: string; agent: string },
    /**
     * 公開 API、RSS、OpenAPI ファイルで利用規約を示すレスポンスヘッダー（任意）：そのまま付け、このページを指す
     * Link ヘッダー（rel="terms-of-service"）も加える。ブラウザから呼ぶ側も読める。
     */
    headers: null as null | Record<string, string>,
  },
  privacy: {
    /** ページ名：ナビゲーション、フッター、ページタイトルで使う。 */
    name: "プライバシーポリシー",
    description: "本サイトがブラウザ内のデータ、フィードバック、アクセスログをどう扱うか。",
    /** llms.txt でこのページを説明する一文（任意）。 */
    covers: null as string | null,
  },
  /**
   * X の投稿そのものの文字と画像を全文として扱うか：扱うなら、全文表示が許可された記事（情報源が全文を許可し、
   * 本文も取得できた）でだけ表示する。扱わないなら、タイトルや要約と同じく常に表示する。
   */
  xPostIsFullText: true,
} as const;

/** 記事カードと詳細ページの言い回しと表示。 */
export const ITEM_COPY = {
  /** モデルが書く一文の呼び名：カード、詳細ページ、Markdown 出力、Agent への回答、グループ配信で使う。 */
  reasonLabel: "注目ポイント",
  /** 読者がウェブとシェア画像で AI の採点を見られるか。表示だけの設定：公開 API と MCP は score を含み、管理画面にも表示する。 */
  showScore: true,
};

/** About ページの QR コードカード。 */
interface ContactCard {
  kind: string;
  title: string;
  note: string;
  /** 外部からリンクされたルートのファイル名（任意）。例：qr-wechat.jpg。このアドレスは常に現在の QR コードに飛ぶ。 */
  alias?: string;
}

/** About ページの文言。数字（情報源数、収録数、厳選数、日報号数）はサイト内のリアルタイム統計で、ここには書かない。 */
export const ABOUT = {
  kicker: `${SITE.name} について`,
  /** ページの説明（検索結果、シェアカード）。 */
  description: `${SITE.name} について：${SITE.description}`,
  /** 大見出し：1 行目は通常色、2 行目は強調色。 */
  headline: ["二輪の世界は、毎日どこかで動いている。", "押さえるべきは、その中の数本だけ。"] as [string, string],
  /** 見出しの下の文。{sources} はリアルタイムの情報源数に置き換わり、統計が取れないときは sourcesFallback になる。 */
  lead: `${SITE.name} は {sources} の情報源を見張り、収集・統合・採点・厳選して、毎朝 ${spokenTime(EDITION_TIMES.daily)}に日報を届けます。無料・登録不要です。`,
  sourcesFallback: "数十",
  /** 情報源の流れのアニメーションの下にある 4 つの工程。 */
  steps: {
    collect: "メーカー公式、業界団体、国内外の二輪メディアのフィードやニュース一覧を巡回します。更新の多い情報源は 15 分おきに確認します。",
    store: "集めた記事はすべて保存し、同じ出来事の報道を一つにまとめます。話題度だけに数える情報源も含めて、ホットランキングはここから計算します。",
    select: `モデルがまず二輪業界の話か、実質的な情報があるかを見極め、日本語のタイトル・要約・${ITEM_COPY.reasonLabel}を書きます。広告記事や重複した転載は入りません。`,
    publish: `${EDITION_WHEN.daily}に日報、月曜に週報、毎月 1 日に月報を発行します。`,
  },
  /**
   * 運営者ブロック（任意）。null なら表示しない。
   * avatarSourceId：X アカウントの情報源の id。アイコンをそこから取る（任意）。
   * QR コードは管理画面の「設定」でアップロードするか、site/brand/contact/ に置く。QR コードがなければそのカードは表示しない。
   */
  maker: null as null | {
    name: string;
    avatarSourceId?: string | null;
    greeting: string[];
    wechat?: ContactCard;
    feishu?: ContactCard;
  },
  /** ページ下部の著作権と掲載取り下げの説明。間に「フィードバック」ページへのリンクが入る。 */
  copyright: [`${SITE.name} は要約と閲覧のための索引で、原文の著作権は各情報源に帰属します。情報源の方で、訂正・掲載取り下げ・表示方法の調整をご希望の場合は、`, "からご連絡ください。"] as [string, string],
  /** ページ下部「利用規約」リンクのアンカー id（任意）：外部の文書がこのアンカーを直接指しているなら入れ、以後変えない。 */
  termsAnchor: null as string | null,
} as const;

/** 管理画面で管理者に示す注意（任意）。 */
export const ADMIN = {
  /** 「フィードバック」ページのタイトルの下の一行。 */
  feedbackNote: null as string | null,
  /** フィードバックの送信元をブロックするときの確認ダイアログに添える、本サイトの決まり。 */
  banNote: null as string | null,
  /** 有料サービスのリクエスト上限を変えるときの確認ダイアログに添える、本サイトの決まり。 */
  budgetNote: null as string | null,
};

/** Agent 接続ページの例。 */
export const AGENT = {
  /** MCP ツール表の「検索」の行：何を検索できるか、どう聞けるか。 */
  search: { scope: "メーカー、車種、人物、テーマで直近 7 日を検索", ask: "このメーカーは最近何を発表した？" },
};

/** 日報・週報・月報の紙面の言い回し。 */
export const REPORTS = {
  /** 題字の下の発行者の一行。 */
  imprint: SITE.name.toUpperCase(),
  /** 題字の横の一語。 */
  motto: SITE.subject as string,
  /** 各レポートページの説明（検索結果、シェアカード）。句点なし。llms.txt で週報・月報を紹介するときにも使う。 */
  descriptions: {
    daily: `${SITE.name} が${EDITION_WHEN.daily}（${TIME_ZONE.label}）に発行する${withSubject("業界日報")}`,
    weekly: `毎週の${withSubject("業界まとめ")}`,
    monthly: `毎月の${withSubject("業界総まとめ")}`,
  },
  /**
   * 1 号に載る 1 本の呼び方（「4 件のトピック」）：トップ記事がないときの見出し（「この日の二輪トピック 4 件」）、題字と
   * バックナンバーの件数、週報・月報に総括がないときの一文、購読説明の「欄ごとに分けたトピック」で使う。
   */
  entry: { measure: "件", noun: "トピック" },
  /** 題字のその他の数字の後に付く言葉。厳選数と日報号数は About ページとトピックページでもこう書く。 */
  metricUnits: { sourcesCount: "の情報源", firstPartyEvents: "件の公式発表", selectedCount: "件の厳選", reportsCovered: "号の日報" },
  /** レポートのシェア画像の「全何件」の言い方。 */
  shareUnit: "件の主要ニュース",
};

/** 運用アラート（サイト管理者にだけ送る）のうち、デプロイごとに変わる言い回し。 */
export const ALERTS = {
  /** 何分間新しい記事が入らなければ「サイトが新しい内容を収録していない」と警告するか（最大 1 日）。環境変数 ALERT_QUIET_MINUTES が優先。 */
  quietMinutes: 360,
  /** 同じアラートで「ない」の後に添える、普段の収録量の一文。null なら書かない。 */
  usualFlow: null as string | null,
  /** worker が止まったときのアラートで、ログの見方。 */
  workerLogs: "worker のログを確認してください（docker compose logs worker）",
  /** あるモデルサービスが拒否したり枠を使い切ったりしたとき、アラートでどの工程が止まったかを言う。書いていないサービスは汎用の言い方。 */
  modelStops: {} as Record<string, string>,
};

/** 管理画面で情報源を新規作成するときの既定値。 */
export const SOURCE_DEFAULTS = {
  /** サイト内で全文を表示する。false なら要約と原文リンクだけ。 */
  siteFulltext: false,
};

/**
 * コミュニティサイトの情報源（情報源 id）：話題度を投稿したアカウント単位で数え、情報源全体で 1 つと数えない。
 * dev は dev.to の記事フィード、hn は Hacker News の投稿フィード。
 */
export const COMMUNITY_FEEDS: { dev: string[]; hn: string[] } = {
  dev: [],
  hn: [],
};

/** 各ページのシェア画像（/og/pages/*.png）の文字。トピック一覧の画像はトピック数から自動で作る。 */
export const CARDS: Record<string, { kicker: string; title: string; subtitle: string; accent?: "hot" | "amber" }> = {
  site: { kicker: SITE.name, title: SITE.tagline, subtitle: SITE.description },
  all: { kicker: `すべての${withSubject("ニュース")}`, title: "すべての情報源の最新ニュースを一か所で", subtitle: "各情報源の最新ニュースを時系列にまとめ、カテゴリやタグで絞り込めます。" },
  hot: { kicker: "ホットランキング", title: "この 48 時間、みんなが話題にしていること", subtitle: "話題度指数、トレンド、話題を形づくる公開情報源。", accent: "hot" },
  daily: { kicker: withSubject("日報"), title: `毎朝 ${spokenTime(EDITION_TIMES.daily)}、読み切れる${withSubject("日報")}`, subtitle: `前日の注目すべき${withSubject("ニュース")}。` },
  weekly: { kicker: withSubject("週報"), title: `1 週間の${REPORTS.entry.noun}を、まとめて把握`, subtitle: "今週の主な流れ、重要な発表、振り返る価値のある議論。" },
  monthly: { kicker: withSubject("月報"), title: "1 か月の変化", subtitle: "月間の主な流れと主要な出来事の振り返り。" },
  about: { kicker: "サイトについて", title: `${SITE.name} について`, subtitle: SITE.description },
  terms: { kicker: "利用規約", title: `${SITE.name} 利用規約`, subtitle: "ウェブサイト、API、RSS、MCP の利用範囲。" },
  privacy: { kicker: "プライバシーポリシー", title: `${SITE.name} プライバシーポリシー`, subtitle: "アクセスログ、ブラウザ内のデータ、フィードバックの扱い。" },
  changelog: { kicker: "更新履歴", title: `${SITE.name} 更新履歴`, subtitle: "機能の追加、改善、お知らせ、提供終了の記録。" },
  feedback: { kicker: "フィードバック", title: "改善できるところを教えてください", subtitle: "内容、機能、接続、または情報源からの訂正・掲載取り下げのご依頼。" },
  agent: { kicker: "Agent 接続", title: `${SITE.name} をあなたの Agent に`, subtitle: "MCP、RSS、API の 3 通り。匿名・読み取り専用で、API キーは不要です。" },
};

/** 公開インターフェースの利用ルールのうちデプロイごとに変わるもの：Agent 向け利用説明と llms.txt に書く。 */
export const ACCESS = {
  /** 同じ IP から 1 分あたりおよそ何回リクエストできるか。超えると 429 と Retry-After が返る（任意、デプロイのリバースプロキシが制限する）。null は制限なしで、説明にも書かない。 */
  ratePerMinute: null as number | null,
  /** プログラムでデータを同期する人に名乗ってほしい User-Agent（任意）。JSON インターフェースの説明の後に書く。 */
  userAgent: null as string | null,
};

/** このデプロイ自身の取り決め（任意）。 */
export const DEPLOYMENT = {
  /** 認証情報のグループファイル（models.env、collectors.env……）を置く既定のディレクトリ（リポジトリのルートからの相対パス）。環境変数 AIHOT_CREDENTIALS_DIR が優先し、どちらもなければ環境変数だけを読む。 */
  credentialsDir: null as string | null,
  /** 認証情報グループのファイル名（認証情報ディレクトリの下、任意）。書いていないグループは「グループ名.env」。例：models.env。 */
  credentialFiles: {} as Partial<Record<string, string>>,
  /** このデプロイが追加で必要とする認証情報（[グループ, 環境変数名]）。本番の API 起動時に確認する。既定では追加なし。 */
  requiredSecrets: [] as const,
  /** 本番の api が受け取る Host（CDN のオリジン用ドメイン、任意）。ローカル開発では、ウェブの開発サーバーが api に転送するリクエストもこれに置き換え、本番と揃える。 */
  originHost: null as string | null,
  /** リバースプロキシが未ログインの管理画面アクセスをログインに回すとき、元のアドレスを運ぶリクエストヘッダー（任意。ログイン後にそこへ戻る）。 */
  loginReturnHeader: null as string | null,
  /**
   * 画像プロキシが元サイトから画像を取る転送量の上限：超えるとキャッシュのない画像はこの 1 分か 1 日が過ぎるまで 503 を返し、
   * その日の枠を使い切ると運用日報に載る。null なら上限なし。環境変数 IMGPROXY_UPSTREAM_MB_PER_MINUTE、IMGPROXY_UPSTREAM_GB_PER_DAY が優先。
   */
  imageUpstreamBudget: null as null | { mbPerMinute: number; gbPerDay: number },
  /**
   * 実測でサーバーから直接接続すべきと分かった、送信プロキシ（EGRESS_PROXY_URL）を通さないドメイン。収集と画像で共用（任意）。
   * リダイレクトのたびに宛先ドメインで経路を選び直し、直接接続でも実際の接続先アドレスは確認する。
   */
  directFetchHosts: [] as string[],
  /**
   * 厳選の評価（scripts/eval-selection.ts）を引数なしで実行したときの正解データ：ファイル（リポジトリのルートからの相対）、抽出件数、使う分割、しきい値の走査範囲。
   * null なら .data/gold.jsonl の全サンプル（最大 200 件）を使い、40〜90 を走査する。
   */
  selectionGold: null as null | { file: string; sample: number; split: string; sweep: [number, number] },
};

/** RSS フィードの説明のうちサイトごとに変わる言い回し。 */
export const FEED_COPY = {
  /** 「すべてのニュース」フィードの説明で、未審査の内容、関連の低い記事、統合済みの重複記事のほかに含まないもの（任意）。 */
  allLeavesOut: [] as string[],
};

/**
 * 公開インターフェース（API、RSS、MCP）でウェブと異なるカテゴリ（任意）。公開後は変えない：インターフェースの引数と購読アドレスにカテゴリの key が入る。
 * merge：別のカテゴリに統合して公開するカテゴリ。key は業界パックのカテゴリ、値は統合先（公開インターフェースがウェブより 1 つ少ないとき）。
 * feedLabels：カテゴリ別 RSS のタイトルの名前。業界パックの feedLabel を置き換える（別のカテゴリに統合したときは名前も変えることが多い）。
 */
export const PUBLIC_CATEGORIES = {
  merge: {},
  feedLabels: {},
} as const;

/** 「二輪日報」のような言い回し：業界名と名詞の間は、英字の業界名なら半角スペースを入れ、日本語や中国語なら入れない。 */
export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}

/** 「すべての二輪」のような言い回し：業界名を前の語に続ける。英字の業界名なら前に半角スペース。noun は withSubject と同じように続ける。 */
export function subjectAfter(text: string, noun?: string): string {
  const gap = /^[A-Za-z0-9]/.test(SITE.subject) ? " " : "";
  return `${text}${gap}${noun ? withSubject(noun) : SITE.subject}`;
}

/** 「8 時」「10 時 30 分」：話し言葉の HH:mm。 */
function spokenTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return `${hour} 時${minute ? ` ${minute} 分` : ""}`;
}
