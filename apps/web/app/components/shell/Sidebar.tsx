import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { SITE } from "@hotmoto/site";
import { Wordmark } from "@hotmoto/site/brand/Logo.tsx";
import { useChangelogSeen } from "../../lib/local-state";
import { sidebar, sidebarIsActive, type NavItem } from "./nav";
import { ThemeSwitch } from "./ThemeSwitch";
import { IconGithub } from "../icons";

/** True while the changelog has an entry newer than the one this reader last opened. */
export function useChangelogDot(latestVersion: string | null): boolean {
  const seen = useChangelogSeen();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !latestVersion) return false;
  return !seen || seen < latestVersion;
}

function SideLink({ item, dot }: { item: NavItem; dot: boolean }) {
  const { pathname } = useLocation();
  const isActive = sidebarIsActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      prefetch="intent"
      aria-current={isActive ? "page" : undefined}
      className={`group flex h-10 items-center gap-2.5 rounded-tile px-2 text-[14px] transition-[box-shadow,color,background-color] duration-200 ${
        isActive ? "neu-inset font-semibold text-accent" : "font-medium text-ink-3 hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-thumb)]"
      }`}
    >
      <span
        className={`grid size-[26px] shrink-0 place-items-center rounded-full transition-[box-shadow,color,background-image] duration-200 ${
          isActive ? "neu-primary" : "bg-surface shadow-[var(--shadow-thumb)] group-hover:text-accent"
        }`}
      >
        <Icon size={15} />
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
      {dot && item.changelog && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-hot" aria-label="新しい更新があります" />}
    </Link>
  );
}

export function Sidebar({ changelogVersion }: { changelogVersion: string | null }) {
  const dot = useChangelogDot(changelogVersion);
  return (
    <aside className="sticky top-0 hidden h-dvh w-[180px] shrink-0 flex-col bg-sidebar px-3 pb-3.5 pt-6 lg:flex">
      <Link to="/" className="mb-4 flex h-[50px] items-center px-1 text-ink" aria-label={`${SITE.name} トップ`}>
        <Wordmark size={26} />
      </Link>
      <nav className="scrollbar-thin -mx-3 flex-1 overflow-y-auto px-3 pb-2" aria-label="メインナビゲーション">
        {sidebar().map((section) => (
          <div key={section.title}>
            <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-medium tracking-[0.08em] text-ink-4">{section.title}</div>
            <div className="flex flex-col gap-1.5">
              {section.items.map((item) => (
                <SideLink key={item.to} item={item} dot={dot} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-2 space-y-2.5 px-1 pt-1">
        {SITE.github && (
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            className="neu-raised mx-1 flex h-[34px] items-center justify-center gap-1.5 rounded-full text-[12.5px] text-ink-3 hover:text-accent"
          >
            <IconGithub size={14} />
            GitHub でオープンソース
          </a>
        )}
        <ThemeSwitch className="mx-1" />
        {SITE.icp && (
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="block px-2 text-[10px] text-ink-4 hover:text-ink-3">
            {SITE.icp}
          </a>
        )}
      </div>
    </aside>
  );
}
