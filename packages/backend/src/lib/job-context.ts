// The queue job a piece of work runs in (jobs/queue.ts), for work that must find its job again later: a
// step that waits on an agent's answer (providers/agent.ts) has its job sent again when the answer arrives.
import { AsyncLocalStorage } from "node:async_hooks";

export interface JobRef {
  queue: string;
  id: string;
}

export const jobContext = new AsyncLocalStorage<JobRef>();
