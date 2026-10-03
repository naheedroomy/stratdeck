import type { Category, StrategySummary } from "../../src/core/types.js";
export interface Library {
  guildId: string | null;
  categories: Category[];
  strategies: StrategySummary[];
}
export interface SyncStatus {
  lastSuccessfulSync: string | null;
  lastSuccessfulReconciliation: string | null;
  strategyCount: number;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && path !== "/session")
      window.dispatchEvent(new Event("session-expired"));
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.error ?? "Unable to connect. Please try again.",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
