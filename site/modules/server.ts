// The backend of the site's modules, installed by the api and the worker when they start (site/modules/index.ts).
import type { ServerModule } from "@hotmoto/backend/modules";
import china from "@hotmoto/china/server";

export const SERVER_MODULES: readonly ServerModule[] = [china];
