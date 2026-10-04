// Worker process: queues and schedules for collection, processing, events, reports and ops, and the site's
// modules (site/modules/server.ts).
import { assertProductionSecrets } from "@hotmoto/backend/config";
import { closeDb } from "@hotmoto/backend/db";
import { getBoss, stopBoss, workModuleQueues } from "@hotmoto/backend/jobs/queue";
import { installModules } from "@hotmoto/backend/modules";
import { SERVER_MODULES } from "@hotmoto/site/modules/server";
import { registerContentJobs } from "@hotmoto/backend/jobs/content";
import { registerSourceJobs } from "@hotmoto/backend/jobs/sources";
import { registerEventJobs } from "@hotmoto/backend/jobs/events";
import { registerNotifyJobs } from "@hotmoto/backend/jobs/notify";
import { registerPublicationJobs } from "@hotmoto/backend/jobs/publication";
import { registerSchedules } from "./schedules.ts";
import { ensureContentTargets } from "@hotmoto/backend/notify/deliver";
import { startHeartbeat } from "@hotmoto/backend/operations/heartbeat";

installModules(SERVER_MODULES);
assertProductionSecrets([["auth", "IMG_PROXY_SIGN_SECRET"]]);

await ensureContentTargets();
const boss = await getBoss();
await registerContentJobs(boss);
if (process.env.COLLECT_ENABLED === "true") await registerSourceJobs(boss);
await registerEventJobs(boss);
await registerNotifyJobs(boss);
await registerPublicationJobs(boss);
await workModuleQueues(boss);
await registerSchedules(boss);
const heartbeat = startHeartbeat("worker");
console.log(JSON.stringify({ level: "info", msg: "worker started", pid: process.pid }));

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({ level: "info", msg: "worker stopping" }));
  clearInterval(heartbeat);
  await stopBoss();
  await closeDb();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
