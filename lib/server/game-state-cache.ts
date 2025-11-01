import type { ClientGameState } from "@/lib/game/types";
import { emitRoomUpdate } from "@/lib/server/game-update-events";

export interface CachedStateEntry {
  etag: string;
  state: ClientGameState | null;
  lastUpdated: string | null;
  expiresAt: number;
  accessedAt: number;
}

// 共通状態（全プレイヤー共通の情報）
interface CachedCommonState {
  gameId: string;
  updatedAt: string;
  etag: string;
  expiresAt: number;
  accessedAt: number;
}

// キャッシュキー生成関数
function getCacheKey(roomId: string, playerId?: string): string {
  return playerId ? `${roomId}:${playerId}` : `${roomId}:common`;
}

// プレイヤー別状態キャッシュ
const STATE_CACHE = new Map<string, CachedStateEntry>();
// 共通状態キャッシュ（プレイヤー固有情報を除く）
const COMMON_STATE_CACHE = new Map<string, CachedCommonState>();

export const STATE_CACHE_TTL_MS = 30_000; // 30秒に短縮（より頻繁な更新に対応）
export const COMMON_STATE_CACHE_TTL_MS = 10_000; // 共通状態は10秒

// キャッシュ統計
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

const cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  size: 0,
};

// 定期的なクリーンアップ（60秒ごと）
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupTimer(): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    // プレイヤー別キャッシュのクリーンアップ
    for (const [key, entry] of STATE_CACHE.entries()) {
      if (entry.expiresAt <= now) {
        STATE_CACHE.delete(key);
        cleaned++;
      }
    }

    // 共通状態キャッシュのクリーンアップ
    for (const [key, entry] of COMMON_STATE_CACHE.entries()) {
      if (entry.expiresAt <= now) {
        COMMON_STATE_CACHE.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      cacheStats.evictions += cleaned;
      cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;
    }
  }, 60_000); // 60秒ごとにクリーンアップ
}

// 初期化時にクリーンアップタイマーを開始
if (typeof globalThis !== "undefined") {
  startCleanupTimer();
}

export function getStateCache(
  roomId: string,
  playerId?: string,
  now = Date.now(),
): CachedStateEntry | null {
  const key = getCacheKey(roomId, playerId);
  const entry = STATE_CACHE.get(key);
  
  if (!entry) {
    cacheStats.misses++;
    return null;
  }

  if (entry.expiresAt <= now) {
    STATE_CACHE.delete(key);
    cacheStats.misses++;
    cacheStats.evictions++;
    cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;
    return null;
  }

  // アクセス時刻を更新（LRU的な管理）
  entry.accessedAt = now;
  cacheStats.hits++;
  return entry;
}

export function getCommonStateCache(
  roomId: string,
  now = Date.now(),
): CachedCommonState | null {
  const key = getCacheKey(roomId);
  const entry = COMMON_STATE_CACHE.get(key);
  
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    COMMON_STATE_CACHE.delete(key);
    cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;
    return null;
  }

  entry.accessedAt = now;
  return entry;
}

export function setStateCache(
  roomId: string,
  entry: Omit<CachedStateEntry, "expiresAt" | "accessedAt">,
  playerId?: string,
  now = Date.now(),
): void {
  const key = getCacheKey(roomId, playerId);
  STATE_CACHE.set(key, {
    ...entry,
    expiresAt: now + STATE_CACHE_TTL_MS,
    accessedAt: now,
  });
  cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;
}

export function setCommonStateCache(
  roomId: string,
  commonState: Omit<CachedCommonState, "expiresAt" | "accessedAt">,
  now = Date.now(),
): void {
  const key = getCacheKey(roomId);
  COMMON_STATE_CACHE.set(key, {
    ...commonState,
    expiresAt: now + COMMON_STATE_CACHE_TTL_MS,
    accessedAt: now,
  });
  cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;
}

/**
 * ルーム全体のキャッシュを無効化（全プレイヤー分）
 */
export function invalidateStateCache(roomId: string): void {
  const keysToDelete: string[] = [];
  
  // 該当するroomIdの全キャッシュエントリを削除
  for (const key of STATE_CACHE.keys()) {
    if (key.startsWith(`${roomId}:`)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    STATE_CACHE.delete(key);
  }
  
  // 共通状態キャッシュも削除
  COMMON_STATE_CACHE.delete(getCacheKey(roomId));
  
  cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;

  emitRoomUpdate(roomId);
}

/**
 * 特定プレイヤーのキャッシュのみを無効化
 */
export function invalidatePlayerCache(roomId: string, playerId: string): void {
  const key = getCacheKey(roomId, playerId);
  STATE_CACHE.delete(key);
  cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;

  emitRoomUpdate(roomId);
}

/**
 * キャッシュ統計を取得（開発/モニタリング用）
 */
export function getCacheStats(): Readonly<CacheStats> {
  return {
    ...cacheStats,
    size: STATE_CACHE.size + COMMON_STATE_CACHE.size,
  };
}

/**
 * キャッシュ統計をリセット
 */
export function resetCacheStats(): void {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.evictions = 0;
  cacheStats.size = STATE_CACHE.size + COMMON_STATE_CACHE.size;
}
