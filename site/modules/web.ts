// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@hotmoto/web/modules";
import china from "@hotmoto/china/web";

export const WEB_MODULES: readonly WebModule[] = [china];
