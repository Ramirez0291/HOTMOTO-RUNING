// What the China section's api (/api/site/china) answers its page.
import type { FeedItemSummary } from "@hotmoto/contracts/site";

export interface ChinaSection {
  key: string;
  label: string;
  /** Its reports, up to the pages the section offers. */
  total: number;
}

export type ChinaPage =
  /** Every section's latest reports, in the order of interest. */
  | { view: "overview"; sections: Array<ChinaSection & { items: FeedItemSummary[] }>; total: number }
  /** One section (or "all") a page at a time, newest first. */
  | { view: "list"; sections: ChinaSection[]; section: string; items: FeedItemSummary[]; page: number; pageCount: number; total: number };
