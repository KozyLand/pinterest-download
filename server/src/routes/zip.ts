import { Router } from "express";
import archiver from "archiver";
import { getJob } from "../lib/jobStore.js";
import type { ZipItemStatus } from "../types.js";

export const zipRouter = Router();

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: ZipItemStatus[]): string {
  const header = ["fichier", "lien_pin", "lien_image_originale", "section", "statut"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [row.filename, row.pinUrl, row.imageUrl, row.section, row.status]
        .map((v) => csvEscape(v))
        .join(",")
    );
  }
  return lines.join("\n");
}

/**
 * On construit le ZIP entièrement en mémoire avant de répondre : ça permet de
 * renvoyer, en en-tête, la liste des pins qui ont échoué (téléchargement réel,
 * jamais simulé) afin que le front puisse les afficher sans avoir à parser le
 * ZIP. Acceptable pour des tableaux de taille raisonnable (quelques centaines
 * d'images) ; pas de stockage disque, tout reste en RAM le temps de la requête.
 */
zipRouter.post("/jobs/:jobId/zip", async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job introuvable." });
    return;
  }

  const requestedIds: string[] = Array.isArray(req.body?.pinIds) ? req.body.pinIds : [];
  const idSet = new Set(requestedIds);
  const selected = job.items.filter((item) => idSet.has(item.pinId));

  if (selected.length === 0) {
    res.status(400).json({ error: "Aucune image sélectionnée." });
    return;
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  archive.on("warning", () => {});

  const rows: ZipItemStatus[] = [];
  const failedPinIds: string[] = [];
  const usedFilenames = new Set<string>();

  for (const item of selected) {
    let filename = `${item.pinId}.${item.extension}`;
    let suffix = 1;
    while (usedFilenames.has(filename)) {
      filename = `${item.pinId}-${suffix}.${item.extension}`;
      suffix += 1;
    }

    try {
      const response = await fetch(item.imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      archive.append(buffer, { name: filename });
      usedFilenames.add(filename);
      rows.push({
        filename,
        pinUrl: item.pinUrl,
        imageUrl: item.imageUrl,
        section: item.section,
        status: "ok",
      });
    } catch {
      failedPinIds.push(item.pinId);
      rows.push({
        filename: "",
        pinUrl: item.pinUrl,
        imageUrl: item.imageUrl,
        section: item.section,
        status: "indisponible",
      });
    }
  }

  archive.append(toCsv(rows), { name: "sources.csv" });
  await archive.finalize();
  const zipBuffer = Buffer.concat(chunks);

  const safeName = job.boardName.replace(/[^a-z0-9-_]+/gi, "_") || "tableau";
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.zip"`);
  res.setHeader("Content-Length", String(zipBuffer.length));
  res.setHeader("X-Failed-Pin-Ids", encodeURIComponent(failedPinIds.join(",")));
  res.setHeader("Access-Control-Expose-Headers", "X-Failed-Pin-Ids");
  res.end(zipBuffer);
});
