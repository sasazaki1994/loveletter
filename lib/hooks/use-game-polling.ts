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

export function useGamePolling({
  roomId,
  playerId,
  interval = 1200,
}: UseGamePollingOptions): UseGamePollingResult {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const etagRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasResolvedRef = useRef(false);

  const fetchState = useCallback(async () => {
    if (!roomId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!hasResolvedRef.current) {
      setLoading(true);
    }

    let aborted = false;

    try {
      const params = new URLSearchParams({ roomId });
      if (playerId) params.set("playerId", playerId);
      const response = await fetch(`/api/game/state?${params.toString()}`, {
        headers:
          etagRef.current
            ? {
                "If-None-Match": etagRef.current,
              }
            : undefined,
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 304) {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setError(null);
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
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        aborted = true;
        return;
      }
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError((err as Error).message ?? "通信エラーが発生しました");
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
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!roomId) return () => {};
    timerRef.current = setInterval(() => {
      fetchState().catch((err) => console.error(err));
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
    };
  }, [fetchState, interval, roomId]);

  const refetch = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  return useMemo(
    () => ({ state, loading, error, refetch, lastUpdated }),
    [state, loading, error, refetch, lastUpdated],
  );
}

