'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClientGameState } from "@/lib/game/types";

interface UseGameStreamOptions {
  roomId: string;
  playerId?: string;
}

interface UseGameStreamResult {
  state: ClientGameState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  reconnect: () => Promise<void>;
  lastUpdated: string | null;
  clearError: () => void;
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 16000;
const CONNECTION_TIMEOUT_MS = 10000;

interface StreamEventData {
  state: ClientGameState | null;
  lastUpdated: string | null;
  etag: string;
  timestamp: string;
}

interface StreamErrorData {
  error: string;
  timestamp: string;
}

export function useGameStream({
  roomId,
  playerId,
}: UseGameStreamOptions): UseGameStreamResult {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const etagRef = useRef<string | null>(null);
  const hasResolvedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const fetchOnce = useCallback(async () => {
    if (!roomId || !isMountedRef.current) return;

    // 初回はローディング表示（以降の手動更新でのチラつきは避ける）
    if (!hasResolvedRef.current) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ roomId });
      if (playerId) params.set("playerId", playerId);

      const headers: Record<string, string> = {
        "Cache-Control": "no-store",
      };
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      if (playerId) headers["X-Player-Id"] = playerId;

      const res = await fetch(`/api/game/state?${params.toString()}`, {
        method: "GET",
        headers,
        cache: "no-store",
        credentials: "include",
      });

      if (res.status === 304) {
        if (isMountedRef.current) {
          setError(null);
          setLoading(false);
          hasResolvedRef.current = true;
        }
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as {
        state?: ClientGameState | null;
        lastUpdated?: string | null;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error ?? payload.detail ?? `HTTP ${res.status} ${res.statusText}`);
      }

      const nextEtag = res.headers.get("ETag");
      if (nextEtag) etagRef.current = nextEtag;

      if (isMountedRef.current) {
        setState((payload.state ?? null) as ClientGameState | null);
        setLastUpdated(payload.lastUpdated ?? null);
        setError(null);
        setLoading(false);
        hasResolvedRef.current = true;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : "状態取得に失敗しました";
      setError(message);
      setLoading(false);
      hasResolvedRef.current = true;
    }
  }, [roomId, playerId]);

  const connect = useCallback(() => {
    if (!roomId || !isMountedRef.current) return;

    // 既存の接続を閉じる
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // リトライタイマーをクリア
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // 接続タイムアウトをクリア
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    try {
      const params = new URLSearchParams({ roomId });
      if (playerId) params.set("playerId", playerId);
      const eventSource = new EventSource(`/api/game/stream?${params.toString()}`, {
        withCredentials: true,
      });
      eventSourceRef.current = eventSource;

      // 接続タイムアウト設定
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnectedRef.current && isMountedRef.current) {
          eventSource.close();
          setError("接続がタイムアウトしました。再試行中...");
          retryCountRef.current += 1;
          
          const delay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1),
            MAX_RETRY_DELAY
          );
          
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, delay);
        }
      }, CONNECTION_TIMEOUT_MS);

      // データ受信
      eventSource.addEventListener("message", (event) => {
        if (!isMountedRef.current) return;

        try {
          const data = JSON.parse(event.data) as StreamEventData;
          
          clearTimeout(connectionTimeoutRef.current!);
          connectionTimeoutRef.current = null;
          
          setIsConnected(true);
          if (data.etag) etagRef.current = data.etag;
          setState(data.state);
          setLastUpdated(data.lastUpdated);
          setError(null);
          setLoading(false);
          hasResolvedRef.current = true;
          retryCountRef.current = 0; // 成功時はリトライカウントをリセット
        } catch (err) {
          console.error("[SSE] Parse error:", err);
          if (isMountedRef.current) {
            setError("データの解析に失敗しました");
            setLoading(false);
            hasResolvedRef.current = true;
          }
        }
      });

      // カスタムエラーイベント（サーバー側から送信されたエラー）
      eventSource.addEventListener("sse_error", (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data || "{}") as StreamErrorData;
          if (data.error) {
            setError(data.error);
            setLoading(false);
            setIsConnected(false);
            hasResolvedRef.current = true;
          }
        } catch {
          // パースエラーは無視（通常のエラーハンドリングに委ねる）
        }
      });

      // エラーイベント（接続エラー）
      eventSource.onerror = () => {
        if (!isMountedRef.current) return;

        // EventSourceのreadyStateをチェック
        if (eventSource.readyState === EventSource.CLOSED) {
          // ストリームが閉じられた（サーバー側でエラーまたは正常終了）
          if (isMountedRef.current) {
            setIsConnected(false);
            
            // リトライ可能な場合
            if (retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current += 1;
              setError("接続が切断されました。再接続中...");
              
              const delay = Math.min(
                INITIAL_RETRY_DELAY * Math.pow(2, retryCountRef.current - 1),
                MAX_RETRY_DELAY
              );
              
              retryTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  connect();
                }
              }, delay);
            } else {
              setError("接続が回復しませんでした。ページを再読み込みしてください。");
              setLoading(false);
              hasResolvedRef.current = true;
            }
          }
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          // 再接続中
          if (isMountedRef.current && !isConnectedRef.current) {
            setError("再接続中...");
          }
        }
      };

      // オープンイベント
      eventSource.addEventListener("open", () => {
        if (!isMountedRef.current) return;
        
        clearTimeout(connectionTimeoutRef.current!);
        connectionTimeoutRef.current = null;
        
        setIsConnected(true);
        setError(null);
      });
    } catch (err) {
      console.error("[SSE] Connection error:", err);
      if (isMountedRef.current) {
        setError("ストリーム接続に失敗しました");
        setLoading(false);
        hasResolvedRef.current = true;
      }
    }
  }, [roomId, playerId]);

  // 初回接続
  useEffect(() => {
    isMountedRef.current = true;
    hasResolvedRef.current = false;
    etagRef.current = null;
    void fetchOnce();
    connect();

    return () => {
      isMountedRef.current = false;
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [connect, fetchOnce]);

  // roomIdまたはplayerIdが変更された場合の再接続
  useEffect(() => {
    if (eventSourceRef.current && isMountedRef.current) {
      hasResolvedRef.current = false;
      etagRef.current = null;
      void fetchOnce();
      connect();
    }
  }, [roomId, playerId, connect, fetchOnce]);

  const refetch = useCallback(async () => {
    // 最新状態を単発で取得（SSE再接続はしない）
    await fetchOnce();
  }, [fetchOnce]);

  const reconnect = useCallback(async () => {
    // SSE再接続（必要なら単発取得も併用）
    retryCountRef.current = 0;
    if (isMountedRef.current) {
      connect();
      // 初期表示や遅延時の保険として単発取得も行う
      await fetchOnce();
    }
  }, [connect, fetchOnce]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return useMemo(
    () => ({ state, loading, error, refetch, reconnect, lastUpdated, clearError }),
    [state, loading, error, refetch, reconnect, lastUpdated, clearError],
  );
}

