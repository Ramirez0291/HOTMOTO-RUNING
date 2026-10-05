// The China section on the web: an entry at the end of the sidebar's コンテンツ and a tab in the phone tab bar.
import type { SVGProps } from "react";
import type { WebModule } from "@hotmoto/web/modules";

/** A globe, in the stroke of the engine's icons. */
function IconChina({ size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z" />
    </svg>
  );
}

export default {
  name: "china",
  sidebar: { section: "コンテンツ", items: [{ to: "/china", label: "中国", icon: IconChina }] },
  tabs: [{ key: "china", to: "/china", label: "中国", icon: IconChina }],
} satisfies WebModule;
