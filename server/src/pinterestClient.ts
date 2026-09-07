import type { Request } from "express";
import { config } from "./config.js";
import type { PinterestPin, PinterestTokens } from "./types.js";

const API_BASE = "https://api.pinterest.com/v5";
const SCOPES = "boards:read,pins:read,user_accounts:read";

export class PinterestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id", config.pinterest.appId);
  url.searchParams.set("redirect_uri", config.pinterest.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

function basicAuthHeader(): string {
  const raw = `${config.pinterest.appId}:${config.pinterest.appSecret}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function requestToken(body: URLSearchParams): Promise<PinterestTokens> {
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new PinterestApiError(`Échec de l'authentification Pinterest : ${text}`, res.status);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

export function exchangeCodeForToken(code: string): Promise<PinterestTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.pinterest.redirectUri,
  });
  return requestToken(body);
}

export function refreshAccessToken(refreshToken: string): Promise<PinterestTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return requestToken(body);
}

/**
 * Renvoie un access token valide pour la session en cours, en le rafraîchissant
 * automatiquement (et en mettant à jour la session) s'il est expiré.
 */
export async function getValidAccessToken(req: Request): Promise<string> {
  const tokens = req.session.pinterest;
  if (!tokens) {
    throw new PinterestApiError("Non connecté à Pinterest.", 401);
  }

  const expiresSoon = tokens.expiresAt - Date.now() < 60_000;
  if (!expiresSoon) {
    return tokens.accessToken;
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  req.session.pinterest = refreshed;
  return refreshed.accessToken;
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new PinterestApiError(`Erreur API Pinterest (${path}) : ${text}`, res.status);
  }
  return (await res.json()) as T;
}

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  pin_count?: number;
  media?: { image_cover_url?: string };
}

export async function getUserAccount(accessToken: string) {
  return apiGet<{ username: string; profile_image?: string }>("/user_account", accessToken);
}

export async function listAllBoards(accessToken: string): Promise<PinterestBoard[]> {
  const boards: PinterestBoard[] = [];
  let bookmark: string | undefined;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (bookmark) query.set("bookmark", bookmark);
    const page = await apiGet<{ items: PinterestBoard[]; bookmark?: string }>(
      `/boards?${query.toString()}`,
      accessToken
    );
    boards.push(...page.items);
    bookmark = page.bookmark;
  } while (bookmark);

  return boards;
}

export interface PinterestSection {
  id: string;
  name: string;
}

export async function listBoardSections(
  accessToken: string,
  boardId: string
): Promise<PinterestSection[]> {
  const sections: PinterestSection[] = [];
  let bookmark: string | undefined;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (bookmark) query.set("bookmark", bookmark);
    const page = await apiGet<{ items: PinterestSection[]; bookmark?: string }>(
      `/boards/${boardId}/sections?${query.toString()}`,
      accessToken
    );
    sections.push(...page.items);
    bookmark = page.bookmark;
  } while (bookmark);

  return sections;
}

async function listPinsAtPath(
  accessToken: string,
  path: string,
  onPage?: (count: number) => void
): Promise<PinterestPin[]> {
  const pins: PinterestPin[] = [];
  let bookmark: string | undefined;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (bookmark) query.set("bookmark", bookmark);
    const page = await apiGet<{ items: PinterestPin[]; bookmark?: string }>(
      `${path}?${query.toString()}`,
      accessToken
    );
    pins.push(...page.items);
    onPage?.(pins.length);
    bookmark = page.bookmark;
  } while (bookmark);

  return pins;
}

export function listBoardPins(
  accessToken: string,
  boardId: string,
  onPage?: (count: number) => void
): Promise<PinterestPin[]> {
  return listPinsAtPath(accessToken, `/boards/${boardId}/pins`, onPage);
}

export function listSectionPins(
  accessToken: string,
  boardId: string,
  sectionId: string,
  onPage?: (count: number) => void
): Promise<PinterestPin[]> {
  return listPinsAtPath(accessToken, `/boards/${boardId}/sections/${sectionId}/pins`, onPage);
}
