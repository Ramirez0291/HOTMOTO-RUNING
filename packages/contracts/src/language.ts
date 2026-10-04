// The site's reading language (site/site.ts SITE.language): which texts are already written in it, so
// the writing steps keep them as they are and the translator leaves them alone. Japanese and Chinese
// both write in Han characters: kana marks Japanese, and the simplified forms below mark Chinese.
import { SITE } from "@aihot/site";

export const SITE_LANGUAGE = SITE.language;

const HAN = /[一-鿿]/;
const KANA = /[぀-ヿ]/;
const HANGUL = /[가-힯]/;
/** Simplified forms frequent in Chinese text that Japanese writes otherwise (这 這, 们, 发 発, 车 車…). */
const SIMPLIFIED = /[这们个为发动说时对过还车门电马见长东问开关让给从现种样么进业经务产]/;

function looksJapanese(s: string): boolean {
  if (HANGUL.test(s)) return false;
  return KANA.test(s) || (HAN.test(s) && !SIMPLIFIED.test(s));
}

function looksChinese(s: string): boolean {
  return HAN.test(s) && !KANA.test(s) && !HANGUL.test(s);
}

/** The text is written in the site's language (a title or a post, judged as a whole). */
export function inSiteLanguage(s: string): boolean {
  return SITE_LANGUAGE === "ja" ? looksJapanese(s) : looksChinese(s);
}

/** The share of a text's characters (spaces aside) in the site language's own script. */
export function siteScriptShare(s: string): number {
  const own = SITE_LANGUAGE === "ja" ? /[぀-ヿ一-鿿]/g : /[一-鿿]/g;
  const total = s.replace(/\s+/g, "").length;
  return total === 0 ? 0 : (s.match(own) ?? []).length / total;
}

/**
 * An article written in the site's language: its language says so, or its text opens in that language
 * and it is not marked English. Every exit shows such a body as it is; the translator skips it.
 */
export function isSiteLanguageBody(language: string | null | undefined, sample: string | null | undefined): boolean {
  if (language === SITE_LANGUAGE) return true;
  if (language === "en") return false;
  const opening = (sample ?? "").slice(0, 400);
  return SITE_LANGUAGE === "ja" ? KANA.test(opening) && looksJapanese(opening) : HAN.test(opening);
}
