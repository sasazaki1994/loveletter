import type { ClientGameState } from "@/lib/game/types";

export interface CachedStateEntry {
  etag: string;
  state: ClientGameState | null;
  lastUpdated: string | null;
  expiresAt: number;
}

const STATE_CACHE = new Map<string, CachedStateEntry>();

export const STATE_CACHE_TTL_MS = 60_000;

export function getStateCache(roomId: string, now = Date.now()): CachedStateEntry | null {
  const entry = STATE_CACHE.get(roomId);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    STATE_CACHE.delete(roomId);
    return null;
  }

  return entry;
}

export function setStateCache(
  roomId: string,
  entry: Omit<CachedStateEntry, "expiresAt">,
  now = Date.now(),
): void {
  STATE_CACHE.set(roomId, {
    ...entry,
    expiresAt: now + STATE_CACHE_TTL_MS,
  });
}

export function invalidateStateCache(roomId: string): void {
  STATE_CACHE.delete(roomId);
}
