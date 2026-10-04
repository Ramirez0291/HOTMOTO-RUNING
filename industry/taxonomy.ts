// この業界の分類体系：カテゴリ、タグの語彙、企業（主体）の名簿、取り違えを防ぐ身元辞書。
// モデルはここの語彙でタグを付け、トピックページ（topics.json）はタグで分類し、絞り込みバーはカテゴリでまとめる。
// 業界を変えるとき：カテゴリの key は URL に出る（/all?category=…）ので公開後は変えない。タグと名簿はいつでも増減できる。

/**
 * ウェブのカテゴリ（絞り込みバー、カードの角ラベル、カテゴリ別 RSS）。key は URL とインターフェースでの身元で、公開後は変えない。
 * section は日報の節の見出し（複数のカテゴリで 1 節を共有でき、ここの順に並ぶ）。guide は構造化のモデルに、このカテゴリに
 * 何を入れるか、隣のカテゴリとの境目はどこかを伝える（全体の分類原則は prompts/structure.md）。
 * commentary は論評系（試乗記・解説・コラム）を示す：日報が報じた出来事に論評系の続報が来ても、速報 1 行だけにする（報じた情報源が十分に多いときを除く）。
 * カテゴリが付かなかった資料は、日報で key が industry の最初のカテゴリの節に入る（なければ最後の節）。
 * feedLabel はカテゴリ別 RSS のタイトルの名前（書かなければ label）。公開インターフェース・RSS・MCP で別カテゴリに統合して出すときは site/site.ts の PUBLIC_CATEGORIES に書く。
 */
export const CATEGORIES = [
  { key: "new-models", label: "新型車", feedLabel: "新型車・モデルチェンジ", section: "新型車・モデルチェンジ", guide: "市販車の新型発表・発売、フルモデルチェンジ、マイナーチェンジ、追加グレード、カラー変更、価格改定、受注開始、生産終了。メーカーが示したコンセプトモデルや市販予定車も含む。新型車の試乗記は review、新型車を使ったレース参戦は motorsports。" },
  { key: "market", label: "市場", feedLabel: "販売・決算・市場データ", section: "販売・決算・市場データ", guide: "販売・登録・出荷・生産台数の統計、メーカーの決算と業績予想、販売計画、市場シェア、地域別の市場動向、需要予測。数字が中心の記事はここ。数字を使った論評は opinion。" },
  { key: "policy", label: "規制", feedLabel: "規制・政策・リコール", section: "規制・政策・リコール", guide: "排出ガス・騒音などの規制、新基準原付・免許制度・道路交通法の改正、補助金や税制、行政の方針、リコール・改善対策の届け出、業界団体の政策提言。規制に合わせた新型車の発表は new-models。" },
  { key: "industry", label: "業界", feedLabel: "業界動向", section: "業界動向", guide: "すでに起きた企業の動き：提携・買収・合弁、工場や生産体制、人事、販売網や販売店の展開、電動化・新技術の事業戦略、訴訟、業界団体の活動。当事者が投稿した発表でも、態度を含むだけで論評にはならない。" },
  { key: "gear", label: "用品・パーツ", feedLabel: "用品・カスタムパーツ", section: "用品・カスタムパーツ", guide: "ヘルメット、ウェア、ブーツ、グローブ、タイヤ、マフラーなどのカスタムパーツ、電装・通信機器、純正アクセサリーの新製品と、用品・アフターパーツ業界の動き。車両本体の新型は new-models。" },
  { key: "motorsports", label: "レース", feedLabel: "モータースポーツ", section: "モータースポーツ", guide: "MotoGP、スーパーバイク世界選手権、鈴鹿 8 耐、全日本ロードレース、モトクロス、トライアル、ラリーレイドなどの結果、チャンピオン決定、チーム・ライダーの契約、参戦体制、レギュレーション。" },
  { key: "events", label: "イベント", feedLabel: "イベント・ツーリング", section: "イベント・ツーリング", guide: "モーターサイクルショー、メーカーやクラブのライダーイベント、試乗会、ツーリングルート、観光施策、ライダー向けキャンペーン。ショーで発表された新型車そのものは new-models。" },
  { key: "review", label: "インプレ", section: "インプレ・論評", guide: "読者が選ぶときや乗るときの参考になる試乗記、比較テスト、長期レポート、メンテナンスや装備の使い方、技術解説。新型の発表そのものは new-models、態度や予測だけで具体的な評価がないものは opinion。", commentary: true },
  { key: "opinion", label: "論評", section: "インプレ・論評", guide: "書き手の解釈・判断・主張・予測・コラム、インタビューでの見解が中心のもの。市場を語っていても自動的に market にはならず、書き手が有名人でも自動的に opinion にはならない。", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * この業界で最も注目される発表（二輪では新型車）：日報の題字の「N 車種の新モデル」、分類変更後の既刊レポートの修正がこれで数える。
 * category はカテゴリ、tag はタグで、両方一致したものだけ数える。unit は数字の後に付く。
 * そういう発表がない業界は null にすると、題字にこの数を出さない。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "new-models", tag: "新型車", unit: "車種の新モデル" };

/** 週報・月報の総括で、記事の中に出典がなくても書いてよい業界の一般語（小文字）。サイト名は自動で含まれる。 */
export const PLAIN_TERMS: readonly string[] = ["ev", "abs", "cc", "suv", "ceo", "ipo"];

/**
 * 内容理解の工程が各資料に付ける「内容タイプ」（prompts/content-understanding.md に書いてあり、タイプを変えたらそのプロンプトも合わせる）。
 * 採点プロンプト（prompts/selection-score.md）はタイプごとに 5 つの軸へ異なる重みを付ける。
 */
export const ITEM_TYPES = ["model_release", "market_data", "regulation", "industry_event", "gear_launch", "motorsport", "event", "review_explainer", "opinion_analysis"] as const;

// ── タグの語彙 ────────────────────────────────────────────────────────────────────────────

/** 各資料の最初のタグは、必ずこの「分類タグ」のどれか。 */
export const CATEGORY_TAGS = [
  "新型車", "モデルチェンジ", "価格改定", "販売・登録台数", "決算・業績", "市場動向", "規制・法改正", "リコール", "業界動向", "提携・買収", "人事",
  "用品・パーツ", "モータースポーツ", "イベント", "試乗・インプレ", "解説", "論評・インタビュー", "その他",
] as const;

/** 任意のテーマタグ。 */
export const TOPIC_TAGS = [
  "電動化", "バッテリー交換", "新基準原付", "スクーター", "125cc", "250cc", "大型二輪", "スポーツ", "アドベンチャー", "クルーザー", "ネオクラシック", "オフロード",
  "安全技術", "コネクテッド", "カーボンニュートラル燃料", "排ガス規制", "免許制度", "ヘルメット", "タイヤ", "カスタム", "ツーリング",
  "日本市場", "インド市場", "ASEAN市場", "中国市場", "欧州市場", "北米市場", "MotoGP", "WSBK", "鈴鹿8耐", "モトクロス",
] as const;

/** 任意の実体タグ（企業、団体）。 */
export const ENTITY_TAGS = ["ホンダ", "ヤマハ", "スズキ", "カワサキ", "ハーレーダビッドソン", "BMW", "ドゥカティ", "トライアンフ", "KTM", "ロイヤルエンフィールド"] as const;

/** モデルがよく書く言い換えを、語彙の表記に揃える。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  新車: "新型車", 新型: "新型車", 新モデル: "新型車", ニューモデル: "新型車", 発売: "新型車", 新型発表: "新型車", コンセプトモデル: "新型車",
  マイナーチェンジ: "モデルチェンジ", フルモデルチェンジ: "モデルチェンジ", カラーチェンジ: "モデルチェンジ", 年式変更: "モデルチェンジ",
  値上げ: "価格改定", 値下げ: "価格改定", 価格変更: "価格改定",
  販売台数: "販売・登録台数", 登録台数: "販売・登録台数", 出荷台数: "販売・登録台数", 生産台数: "販売・登録台数", 統計: "販売・登録台数",
  決算: "決算・業績", 業績: "決算・業績", 業績予想: "決算・業績", 市場: "市場動向", 市場データ: "市場動向", シェア: "市場動向",
  規制: "規制・法改正", 法改正: "規制・法改正", 政策: "規制・法改正", 行政: "規制・法改正", 補助金: "規制・法改正",
  改善対策: "リコール", サービスキャンペーン: "リコール",
  業界: "業界動向", 企業動向: "業界動向", 提携: "提携・買収", 買収: "提携・買収", 合弁: "提携・買収", 出資: "提携・買収", 協業: "提携・買収",
  用品: "用品・パーツ", パーツ: "用品・パーツ", カスタムパーツ: "用品・パーツ", ウェア: "用品・パーツ", アクセサリー: "用品・パーツ", アフターパーツ: "用品・パーツ",
  レース: "モータースポーツ", 二輪レース: "モータースポーツ", ショー: "イベント", モーターサイクルショー: "イベント",
  試乗: "試乗・インプレ", 試乗記: "試乗・インプレ", インプレ: "試乗・インプレ", インプレッション: "試乗・インプレ", レビュー: "試乗・インプレ", 比較テスト: "試乗・インプレ",
  技術解説: "解説", ハウツー: "解説", メンテナンス: "解説",
  論評: "論評・インタビュー", コラム: "論評・インタビュー", インタビュー: "論評・インタビュー", 意見: "論評・インタビュー",
  ev: "電動化", 電動: "電動化", 電動バイク: "電動化", 電動二輪: "電動化", 原付: "新基準原付", "原付一種": "新基準原付",
  "superbike": "WSBK", スーパーバイク: "WSBK", 鈴鹿8時間耐久: "鈴鹿8耐", motocross: "モトクロス",
  honda: "ホンダ", yamaha: "ヤマハ", suzuki: "スズキ", kawasaki: "カワサキ", "harley-davidson": "ハーレーダビッドソン", ハーレー: "ハーレーダビッドソン",
  "bmw motorrad": "BMW", ducati: "ドゥカティ", triumph: "トライアンフ", "royal enfield": "ロイヤルエンフィールド",
};

// ── 企業と主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 企業トピック：id → 表示名、カードに出すタグ（null は entity:<id> だけで分類）、別名。
 * aliases は構造化のモデルに見せる。otherNames は企業自身の別の呼び方（公式アカウント名、子ブランド）で、
 * 事実の主体を発表元に結び付けるときにも認める。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; otherNames?: string[] }> = {
  honda: { name: "ホンダ", displayTag: "ホンダ", aliases: ["Honda", "ホンダ", "本田技研工業", "HRC"], otherNames: ["Honda Motor", "本田技研", "Honda Racing Corporation", "ホンダモーターサイクルジャパン", "Honda Motorcycle Japan"] },
  yamaha: { name: "ヤマハ発動機", displayTag: "ヤマハ", aliases: ["Yamaha", "ヤマハ", "ヤマハ発動機"], otherNames: ["Yamaha Motor", "ヤマハ発動機販売", "ワイズギア", "Y's GEAR"] },
  suzuki: { name: "スズキ", displayTag: "スズキ", aliases: ["Suzuki", "スズキ"], otherNames: ["Suzuki Motor", "スズキ株式会社"] },
  kawasaki: { name: "カワサキモータース", displayTag: "カワサキ", aliases: ["Kawasaki", "カワサキ", "カワサキモータース"], otherNames: ["Kawasaki Motors", "カワサキモータースジャパン", "川崎重工業", "Kawasaki Heavy Industries"] },
  harley: { name: "ハーレーダビッドソン", displayTag: "ハーレーダビッドソン", aliases: ["Harley-Davidson", "ハーレーダビッドソン", "ハーレー"], otherNames: ["Harley-Davidson Japan", "ハーレーダビッドソン ジャパン", "LiveWire", "ライブワイヤー"] },
  bmw: { name: "BMW Motorrad", displayTag: "BMW", aliases: ["BMW Motorrad", "BMWモトラッド", "BMW"], otherNames: ["BMW Motorrad Japan"] },
  ducati: { name: "ドゥカティ", displayTag: "ドゥカティ", aliases: ["Ducati", "ドゥカティ"], otherNames: ["Ducati Japan", "ドゥカティ ジャパン"] },
  triumph: { name: "トライアンフ", displayTag: "トライアンフ", aliases: ["Triumph", "トライアンフ"], otherNames: ["Triumph Motorcycles", "トライアンフモーターサイクルズジャパン"] },
  ktm: { name: "KTM", displayTag: "KTM", aliases: ["KTM", "Pierer Mobility", "ピエラ・モビリティ"], otherNames: ["Husqvarna Motorcycles", "ハスクバーナ・モーターサイクルズ", "GASGAS", "ガスガス"] },
  "royal-enfield": { name: "ロイヤルエンフィールド", displayTag: "ロイヤルエンフィールド", aliases: ["Royal Enfield", "ロイヤルエンフィールド", "Eicher Motors"] },
  piaggio: { name: "ピアッジオ", displayTag: null, aliases: ["Piaggio", "ピアッジオ", "Vespa", "ベスパ", "Aprilia", "アプリリア", "Moto Guzzi", "モト・グッツィ"], otherNames: ["Piaggio Group", "ピアッジオグループ"] },
  hero: { name: "ヒーロー・モトコープ", displayTag: null, aliases: ["Hero MotoCorp", "ヒーロー・モトコープ"], otherNames: ["Vida"] },
  bajaj: { name: "バジャージ・オート", displayTag: null, aliases: ["Bajaj Auto", "Bajaj", "バジャージ"] },
  tvs: { name: "TVSモーター", displayTag: null, aliases: ["TVS Motor", "TVS"], otherNames: ["Norton Motorcycles", "ノートン"] },
  cfmoto: { name: "CFMOTO", displayTag: null, aliases: ["CFMOTO", "CFモト", "春風動力"] },
  yadea: { name: "Yadea", displayTag: null, aliases: ["Yadea", "ヤディア", "雅迪"] },
  gogoro: { name: "Gogoro", displayTag: null, aliases: ["Gogoro", "ゴゴロ"] },
  gachaco: { name: "Gachaco", displayTag: null, aliases: ["Gachaco", "ガチャコ"] },
  shoei: { name: "SHOEI", displayTag: null, aliases: ["SHOEI", "ショウエイ"] },
  arai: { name: "アライヘルメット", displayTag: null, aliases: ["Arai", "アライヘルメット"] },
  bridgestone: { name: "ブリヂストン", displayTag: null, aliases: ["Bridgestone", "ブリヂストン"], otherNames: ["BATTLAX", "バトラックス"] },
  dunlop: { name: "ダンロップ", displayTag: null, aliases: ["Dunlop", "ダンロップ", "住友ゴム工業"] },
  jama: { name: "日本自動車工業会", displayTag: null, aliases: ["日本自動車工業会", "自工会", "JAMA"] },
  acem: { name: "ACEM（欧州二輪車工業会）", displayTag: null, aliases: ["ACEM", "欧州二輪車工業会"] },
};

/**
 * 身元辞書：要約とタイトルに出る企業は原文にも出ていなければならず、そうでなければ元のタイトルに戻し要約を捨てる（モデルによる取り違えを防ぐ）。
 * 業界にこの問題がなければ空配列でよい。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "honda", name: "ホンダ", patterns: [/\bhonda\b|ホンダ|本田技研|\bHRC\b/i] },
  { id: "yamaha", name: "ヤマハ", patterns: [/\byamaha\b|ヤマハ/i] },
  { id: "suzuki", name: "スズキ", patterns: [/\bSuzuki\s+Motor\b|スズキ/, /\bsuzuki\b/i] },
  { id: "kawasaki", name: "カワサキ", patterns: [/\bkawasaki\b|カワサキ|川崎重工/i] },
  { id: "harley", name: "ハーレーダビッドソン", patterns: [/harley|ハーレー|\blivewire\b|ライブワイヤー/i] },
  { id: "bmw", name: "BMW", patterns: [/\bBMW\b/] },
  { id: "ducati", name: "ドゥカティ", patterns: [/\bducati\b|ドゥカティ/i] },
  { id: "triumph", name: "トライアンフ", patterns: [/\bTriumph\b|トライアンフ/] },
  { id: "ktm", name: "KTM", patterns: [/\bKTM\b|pierer|ピエラ|husqvarna|ハスクバーナ|gasgas|ガスガス/i] },
  { id: "royal-enfield", name: "ロイヤルエンフィールド", patterns: [/royal\s?enfield|ロイヤル\s?エンフィールド|\beicher\b/i] },
  { id: "piaggio", name: "ピアッジオ", patterns: [/piaggio|ピアッジオ|\bvespa\b|ベスパ|aprilia|アプリリア|moto\s?guzzi|グッツィ/i] },
  { id: "hero", name: "ヒーロー・モトコープ", patterns: [/hero\s?motocorp|ヒーロー・?モトコープ/i] },
  { id: "bajaj", name: "バジャージ", patterns: [/\bbajaj\b|バジャージ/i] },
  { id: "tvs", name: "TVS", patterns: [/\bTVS\b/] },
  { id: "cfmoto", name: "CFMOTO", patterns: [/cf\s?moto|CFモト|春風/i] },
  { id: "yadea", name: "Yadea", patterns: [/\byadea\b|ヤディア|雅迪/i] },
  { id: "gogoro", name: "Gogoro", patterns: [/gogoro|ゴゴロ/i] },
  { id: "gachaco", name: "Gachaco", patterns: [/gachaco|ガチャコ/i] },
  { id: "shoei", name: "SHOEI", patterns: [/\bSHOEI\b|ショウエイ/i] },
  { id: "arai", name: "アライ", patterns: [/\bArai\b|アライヘルメット/] },
  { id: "bridgestone", name: "ブリヂストン", patterns: [/bridgestone|ブリヂストン|battlax|バトラックス/i] },
  { id: "dunlop", name: "ダンロップ", patterns: [/dunlop|ダンロップ/i] },
  { id: "bimota", name: "ビモータ", patterns: [/\bbimota\b|ビモータ/i] },
  { id: "mv-agusta", name: "MV アグスタ", patterns: [/mv\s?agusta|MVアグスタ/i] },
  { id: "benelli", name: "ベネリ", patterns: [/\bbenelli\b|ベネリ/i] },
  { id: "kymco", name: "キムコ", patterns: [/\bkymco\b|キムコ/i] },
  { id: "zero", name: "Zero Motorcycles", patterns: [/zero\s+motorcycles/i] },
];

/** これらのドメインの記事は、発表元が対応する企業（GitHub のようなホスティングは含めない）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "honda", domains: ["honda.co.jp", "global.honda", "honda.com"] },
  { entityId: "yamaha", domains: ["yamaha-motor.com", "yamaha-motor.co.jp"] },
  { entityId: "suzuki", domains: ["suzuki.co.jp", "globalsuzuki.com"] },
  { entityId: "kawasaki", domains: ["kawasaki-motors.com"] },
  { entityId: "harley", domains: ["harley-davidson.com"] },
  { entityId: "bmw", domains: ["bmw-motorrad.com", "bmw-motorrad.jp"] },
  { entityId: "ducati", domains: ["ducati.com"] },
  { entityId: "triumph", domains: ["triumphmotorcycles.com", "triumphmotorcycles.co.jp"] },
  { entityId: "royal-enfield", domains: ["royalenfield.com"] },
  { entityId: "ktm", domains: ["ktm.com"] },
  { entityId: "acem", domains: ["acem.eu"] },
];

/** 原文にこう書かれていても、対応する企業に触れたとみなす。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
