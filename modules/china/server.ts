// The China section's backend: its api for the page, and its place in the sitemap.
import { defineServerModule } from "@hotmoto/backend/modules";
import { looseQuery, sendJsonWithEtag, sendProblem } from "@hotmoto/api/http/respond";
import { siteHandler } from "@hotmoto/api/routes/site";
import { CHINA_MAX_PAGES, isChinaSection, loadChina } from "./backend/china.ts";

export default defineServerModule({
  name: "china",
  http: (app) => {
    app.get("/api/site/china", siteHandler(async (req, reply) => {
      const q = looseQuery(req);
      const section = q.section?.trim() || null;
      if (section && !isChinaSection(section)) return sendProblem(req, reply, { status: 404, code: "not_found", detail: "no such section" });
      const page = Math.min(Math.max(Number(q.page) || 1, 1), CHINA_MAX_PAGES);
      return sendJsonWithEtag(req, reply, await loadChina({ section, page }), { etagPrefix: "china", cacheControl: "public, max-age=60, s-maxage=60" });
    }));
  },
  sitemap: { pages: [{ loc: "/china", changefreq: "hourly", priority: 0.8 }] },
});
