// Shared admin vocabulary.
export const KIND_LABEL: Record<string, string> = { rss: "RSS", web_list: "ウェブページ一覧", json_list: "JSON", x_search: "X", mp_account: "WeChat", external: "外部からの送信" };
export const MODE_LABEL: Record<string, string> = { editorial: "厳選", hot_signal: "話題のみ", isolated: "隔離" };
export const HEALTH_LABEL: Record<string, string> = { ok: "正常", degraded: "不安定", failing: "失敗", paused: "停止中", unknown: "未確認" };
export const VISIBILITY_LABEL: Record<string, string> = { public: "公開", "summary-only": "要約のみ", withdrawn: "取り下げ済み" };
export const FEEDBACK_STATUS: Record<string, string> = { new: "新規", triaged: "対応中", replied: "返信済み", resolved: "解決済み", spam: "スパム" };
export const TIER_LABEL: Record<string, string> = { T1: "T1", T1_5: "T1.5", T2: "T2", EXCLUDE_MP: "厳選の対象外" };
