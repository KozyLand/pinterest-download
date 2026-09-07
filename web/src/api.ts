export interface AuthStatus {
  connected: boolean;
  username?: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  pinCount: number;
  coverUrl: string | null;
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  authStatus: () => request<AuthStatus>("/auth/status"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  listBoards: () => request<{ boards: Board[] }>("/api/boards"),
  startSync: (boardId: string, boardName: string) =>
    request<{ jobId: string }>(`/api/boards/${boardId}/sync`, {
      method: "POST",
      body: JSON.stringify({ boardName }),
    }),
  getJob: (jobId: string) => request<SyncJob>(`/api/jobs/${jobId}`),
  zipUrl: (jobId: string) => `/api/jobs/${jobId}/zip`,
};
