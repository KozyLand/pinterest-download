import { Router } from "express";
import {
  getValidAccessToken,
  listBoardPins,
  listBoardSections,
  listSectionPins,
  PinterestApiError,
} from "../pinterestClient.js";
import { dedupeItems } from "../lib/dedupe.js";
import { extensionFromUrl, pickBestImage } from "../lib/imageResolution.js";
import { createJob, getJob } from "../lib/jobStore.js";
import type { PinItem } from "../types.js";

export const syncRouter = Router();

syncRouter.post("/boards/:boardId/sync", async (req, res) => {
  const { boardId } = req.params;
  const boardName = typeof req.body?.boardName === "string" ? req.body.boardName : boardId;

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(req);
  } catch (err) {
    const status = err instanceof PinterestApiError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : "Erreur inconnue" });
    return;
  }

  const job = createJob(boardId, boardName);
  res.json({ jobId: job.id });

  // Récupération en arrière-plan : on répond tout de suite avec le jobId,
  // et le front suit la progression via /api/jobs/:id.
  runSync(job.id, boardId, accessToken).catch((err) => {
    const current = getJob(job.id);
    if (current) {
      current.status = "error";
      current.error = err instanceof Error ? err.message : "Erreur inconnue";
    }
  });
});

async function runSync(jobId: string, boardId: string, accessToken: string) {
  const job = getJob(jobId);
  if (!job) return;

  const sections = await listBoardSections(accessToken, boardId);
  const pinSection = new Map<string, string>();

  for (const section of sections) {
    const sectionPins = await listSectionPins(accessToken, boardId, section.id);
    for (const pin of sectionPins) {
      pinSection.set(pin.id, section.name);
    }
  }

  const allPins = await listBoardPins(accessToken, boardId, (count) => {
    job.fetched = count;
  });

  const items: PinItem[] = [];
  for (const pin of allPins) {
    const best = pickBestImage(pin.images);
    if (!best) continue;

    items.push({
      pinId: pin.id,
      pinUrl: pin.link || `https://www.pinterest.com/pin/${pin.id}/`,
      imageUrl: best.url,
      width: best.width,
      height: best.height,
      section: pinSection.get(pin.id) ?? "Sans section",
      extension: extensionFromUrl(best.url),
    });
  }

  const { unique, duplicatesSkipped } = dedupeItems(items);

  job.items = unique;
  job.duplicatesSkipped = duplicatesSkipped;
  job.fetched = unique.length;
  job.status = "done";
}

syncRouter.get("/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job introuvable." });
    return;
  }
  res.json(job);
});
