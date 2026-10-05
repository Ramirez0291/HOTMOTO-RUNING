// /china: China's two-wheeler market as a section of its own. The overview shows each section's latest reports
// in the order of interest (policy first); ?section=<key> lists one section, ?section=all every China report.
import { Link, redirect, useLoaderData, type LoaderFunctionArgs, type MetaArgs } from "react-router";
import { SITE, withSubject } from "@hotmoto/site";
import { edgeTtl, loadOr404 } from "@hotmoto/web/lib/api.server";
import { listPath, pageMeta } from "@hotmoto/web/lib/seo";
import { DayList, Pagination } from "@hotmoto/web/features/feed/DayList";
import { PillTabs } from "@hotmoto/web/components/ui/Tabs";
import { EmptyState } from "@hotmoto/web/components/ui/Page";
import { IconChevronRight } from "@hotmoto/web/components/icons";
import { PhoneBar } from "@hotmoto/web/components/shell/PhoneBar";
import type { Screen } from "@hotmoto/web/components/shell/screens";
import type { ChinaPage } from "../types.ts";

export const handle: Screen = { tab: "china", name: "中国" };

const TITLE = `中国の${withSubject("ニュース")}`;
const LEAD = "中国の二輪市場を、政策・規制、生産・販売データ、資本・企業動向、新製品の順に追います。";

export function headers() {
  return edgeTtl(60);
}

function hrefOf(section: string | null, page = 1) {
  return listPath("/china", { section, page: page > 1 ? page : null });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const section = url.searchParams.get("section")?.trim() || null;
  const page = Math.min(Math.max(Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1), 50);
  const data = await loadOr404<ChinaPage>(listPath("/api/site/china", { section, page: section && page > 1 ? page : null }), { signal: request.signal });
  // Past the last page: the last page.
  if (data.view === "list" && data.total > 0 && data.page > data.pageCount) throw redirect(hrefOf(data.section, data.pageCount));
  return { data };
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  const data = loaderData?.data;
  const list = data?.view === "list" ? data : null;
  const label = list ? list.sections.find((s) => s.key === list.section)?.label : null;
  return pageMeta({
    title: label ? `${label} · ${TITLE}` : TITLE,
    description: `${SITE.name} の中国欄。${LEAD}`,
    path: list ? hrefOf(list.section, list.page) : "/china",
  });
}

export default function ChinaPageView() {
  const { data } = useLoaderData<typeof loader>();
  const sections = data.view === "overview" ? data.sections : data.sections.filter((s) => s.key !== "all");
  const allTotal = data.view === "overview" ? data.total : data.sections.find((s) => s.key === "all")!.total;
  const tabs = [
    { key: "overview", label: "概要", to: "/china" },
    ...sections.map((s) => ({ key: s.key, label: s.label, to: hrefOf(s.key), count: s.total })),
    { key: "all", label: "すべて", to: hrefOf("all"), count: allTotal },
  ];

  return (
    <div className="pb-10">
      <PhoneBar title="中国" large sub={LEAD} />
      <header className="hidden pb-4 pt-1 lg:block">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{TITLE}</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-3">{LEAD}</p>
      </header>
      <PillTabs size="sm" layoutId="china-sections" label="中国欄の区分" active={data.view === "overview" ? "overview" : data.section} items={tabs} className="mb-5" />

      {allTotal === 0 ? (
        <div className="lg:card">
          <EmptyState title="中国の記事はまだありません">
            「中国市場」のタグが付いた記事と、管理画面で「中国」のタグを付けた情報源の記事がここに入ります。
          </EmptyState>
        </div>
      ) : data.view === "overview" ? (
        data.sections.map((s, i) => (
          <section key={s.key} aria-labelledby={`china-${s.key}`} className="mb-8">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id={`china-${s.key}`} className="text-[18px] font-semibold text-ink">
                <span className="num mr-1.5 text-accent">{i + 1}</span>
                {s.label}
                <span className="num ml-2 text-[13px] font-normal text-ink-4">{s.total >= 2000 ? "2000+" : s.total} 件</span>
              </h2>
              {s.total > s.items.length && (
                <Link to={hrefOf(s.key)} className="flex shrink-0 items-center text-[13px] font-medium text-accent hover:underline">
                  すべて見る <IconChevronRight size={14} />
                </Link>
              )}
            </div>
            {s.items.length ? <DayList items={s.items} /> : <p className="py-3 text-[13.5px] text-ink-4">この区分にはまだ記事がありません。</p>}
          </section>
        ))
      ) : (
        <>
          {data.items.length ? <DayList items={data.items} /> : (
            <div className="lg:card"><EmptyState title="この区分にはまだ記事がありません">ほかの区分を見てください。</EmptyState></div>
          )}
          <Pagination page={data.page} pageCount={data.pageCount} href={(p) => hrefOf(data.section, p)} />
        </>
      )}
    </div>
  );
}
