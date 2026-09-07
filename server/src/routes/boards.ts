import { Router } from "express";
import { getValidAccessToken, listAllBoards, PinterestApiError } from "../pinterestClient.js";

export const boardsRouter = Router();

boardsRouter.get("/", async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req);
    const boards = await listAllBoards(accessToken);
    res.json({
      boards: boards.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description ?? "",
        pinCount: b.pin_count ?? 0,
        coverUrl: b.media?.image_cover_url ?? null,
      })),
    });
  } catch (err) {
    const status = err instanceof PinterestApiError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : "Erreur inconnue" });
  }
});
