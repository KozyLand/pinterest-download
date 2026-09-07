import { randomUUID } from "node:crypto";
import type { SyncJob } from "../types.js";

const jobs = new Map<string, SyncJob>();

export function createJob(boardId: string, boardName: string): SyncJob {
  const job: SyncJob = {
    id: randomUUID(),
    boardId,
    boardName,
    status: "running",
    fetched: 0,
    items: [],
    duplicatesSkipped: 0,
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): SyncJob | undefined {
  return jobs.get(id);
}
