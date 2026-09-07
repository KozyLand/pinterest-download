export interface PinterestTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

declare module "express-session" {
  interface SessionData {
    pinterest?: PinterestTokens;
    oauthState?: string;
  }
}

export interface PinterestImageVariant {
  width: number;
  height: number;
  url: string;
}

export interface PinterestPin {
  id: string;
  link?: string;
  images?: Record<string, PinterestImageVariant>;
}

export interface PinItem {
  pinId: string;
  pinUrl: string;
  imageUrl: string;
  width: number;
  height: number;
  section: string;
  extension: string;
}

export interface SyncJob {
  id: string;
  boardId: string;
  boardName: string;
  status: "running" | "done" | "error";
  fetched: number;
  items: PinItem[];
  duplicatesSkipped: number;
  error?: string;
}

export interface ZipItemStatus {
  filename: string;
  pinUrl: string;
  imageUrl: string;
  section: string;
  status: "ok" | "indisponible";
}
