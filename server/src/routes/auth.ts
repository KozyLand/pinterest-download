import { randomUUID } from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getUserAccount,
  getValidAccessToken,
  PinterestApiError,
} from "../pinterestClient.js";

export const authRouter = Router();

authRouter.get("/pinterest", (req, res) => {
  const state = randomUUID();
  req.session.oauthState = state;
  res.redirect(buildAuthorizeUrl(state));
});

authRouter.get("/pinterest/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`${config.webOrigin}/?auth_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || typeof code !== "string" || state !== req.session.oauthState) {
    res.redirect(`${config.webOrigin}/?auth_error=state_invalide`);
    return;
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    req.session.pinterest = tokens;
    delete req.session.oauthState;
    res.redirect(`${config.webOrigin}/`);
  } catch (err) {
    const message = err instanceof PinterestApiError ? err.message : "Erreur inconnue";
    res.redirect(`${config.webOrigin}/?auth_error=${encodeURIComponent(message)}`);
  }
});

authRouter.get("/status", async (req, res) => {
  if (!req.session.pinterest) {
    res.json({ connected: false });
    return;
  }

  try {
    const accessToken = await getValidAccessToken(req);
    const account = await getUserAccount(accessToken);
    res.json({ connected: true, username: account.username });
  } catch {
    req.session.pinterest = undefined;
    res.json({ connected: false });
  }
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
