'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClientGameState, PollingResponse } from "@/lib/game/types";

interface UseGamePollingOptions {
  roomId: string;
  playerId?: string;
  interval?: number;
}

interface UseGamePollingResult {
  state: ClientGameState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: string | null;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 8000;

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  if (error instanceof Error) {
    return error.name === 'NetworkError' || error.message.includes('network') || error.message.includes('Failed to fetch');
  }
  return false;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useGamePolling({
  roomId,
  playerId,
  interval = 1200,
}: UseGamePollingOptions): UseGamePollingResult {
  const BOT_POLL_INTERVAL = 350;
  const [state, setState] = useState<ClientGameState | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const etagRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasResolvedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchState = useCallback(async (isRetry = false) => {
    if (!roomId) return;

    // リトライ中は既存のタイマーをクリア
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!hasResolvedRef.current && !isRetry) {
      setLoading(true);
    }

    let aborted = false;

    try {
      const params = new URLSearchParams({ roomId });
      if (playerId) params.set("playerId", playerId);
      const headers: Record<string, string> = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      if (playerId) headers["X-Player-Id"] = playerId;
      const response = await fetch(`/api/game/state?${params.toString()}`, {
        headers,
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 304) {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setError(null);
          retryCountRef.current = 0; // 成功時はリトライカウントをリセット
        }
        return;
      }

      if (response.status === 404) {
        if (requestId === requestIdRef.current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          etagRef.current = null;
          setState(null);
          setLastUpdated(null);
          setError(null);
          hasResolvedRef.current = true;
          retryCountRef.current = 0;
        }
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "状態取得に失敗しました");
      }

      const payload = (await response.json()) as PollingResponse;

      if (requestId !== requestIdRef.current) {
        return;
      }

      etagRef.current = response.headers.get("ETag");
      setState(payload.state);
      setLastUpdated(payload.lastUpdated);
      setError(null);
      hasResolvedRef.current = true;
      retryCountRef.current = 0; // 成功時はリトライカウントをリセット
    } catch (err) {
      if (isAbortError(err)) {
        aborted = true;
        return;
      }
      if (requestId !== requestIdRef.current) {
        return;
      }

      // AbortErrorは無視、それ以外のエラーを処理
      const errorMessage = err instanceof Error ? err.message : "通信エラーが発生しました";
      
      // ネットワークエラーでリトライ可能な場合
      if (isNetworkError(err) && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1),
          MAX_RETRY_DELAY
        );
        
        // リトライ前に短時間エラーを表示
        setError("接続が不安定です。再試行中...");
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchState(true).catch(() => {
            // 最終的なリトライ失敗時の処理は下記のelseブロックで行う
          });
        }, delay);
        return;
      }

      // リトライ不可能または上限に達した場合
      if (retryCountRef.current >= MAX_RETRIES) {
        setError("接続が回復しませんでした。ページを再読み込みしてください。");
      } else {
        setError(errorMessage);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        if (aborted && !hasResolvedRef.current) {
          return;
        }
        setLoading(false);
      }
    }
  }, [playerId, roomId]);

  useEffect(() => {
    fetchState(false);
  }, [fetchState]);

  const isBotTurn = useMemo(() => {
    if (!state) return false;
    if (!state.players || state.players.length === 0) return false;

    const playerMap = new Map(state.players.map((p) => [p.id, p]));
    const activeIsBot = state.activePlayerId ? playerMap.get(state.activePlayerId)?.isBot : false;
    const awaitingIsBot = state.awaitingPlayerId
      ? playerMap.get(state.awaitingPlayerId)?.isBot
      : false;

    return Boolean(activeIsBot || awaitingIsBot);
  }, [state]);

  const effectiveInterval = useMemo(() => {
    if (!isBotTurn) return interval;
    return Math.min(interval, BOT_POLL_INTERVAL);
  }, [interval, isBotTurn]);

  useEffect(() => {
    if (!roomId) return () => {};
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    timerRef.current = setInterval(() => {
      fetchState(false).catch((err) => {
        // AbortErrorはログに記録しない
        if (!isAbortError(err)) {
          console.error('[Polling]', err);
        }
      });
    }, effectiveInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
      abortRef.current?.abort();
    };
  }, [effectiveInterval, fetchState, roomId]);

  useEffect(() => {
    if (!isBotTurn) return undefined;

    const timeoutId = setTimeout(() => {
      fetchState(false).catch((err) => {
        // AbortErrorはログに記録しない
        if (!isAbortError(err)) {
          console.error('[Bot Polling]', err);
        }
      });
    }, Math.min(effectiveInterval, BOT_POLL_INTERVAL));

    return () => {
      clearTimeout(timeoutId);
    };
  }, [effectiveInterval, fetchState, isBotTurn]);

  const refetch = useCallback(async () => {
    retryCountRef.current = 0; // 手動リフレッシュ時はリトライカウントをリセット
    await fetchState(false);
  }, [fetchState]);

  return useMemo(
    () => ({ state, loading, error, refetch, lastUpdated }),
    [state, loading, error, refetch, lastUpdated],
  );
}

