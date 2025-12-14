'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

interface PlayerSession {
  roomId: string;
  playerId: string;
  nickname: string;
  shortId?: string;
}

const STORAGE_KEY = "llr:session";

export function loadSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    // 同一ブラウザで複数タブ（=複数プレイヤー）を扱えるよう、tab-scope な sessionStorage を優先する
    // 互換: 旧localStorageに残っている場合は読み込みのみ行い、以後はsessionStorageへ移行
    const raw =
      window.sessionStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession;
    if (parsed.roomId && parsed.playerId) {
      // migrate to sessionStorage
      try {
        window.sessionStorage.setItem(STORAGE_KEY, raw);
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn("failed to load session", error);
    return null;
  }
}

export function saveSession(session: PlayerSession) {
  if (typeof window === "undefined") return;
  // セッション情報は最小限のみ保存（機密トークンは保存しない）
  const { roomId, playerId, nickname, shortId } = session;
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ roomId, playerId, nickname, shortId }),
  );
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  // 念のため旧キーも削除
  window.localStorage.removeItem(STORAGE_KEY);
}

export function usePlayerSession() {
  const [session, setSession] = useState<PlayerSession | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const updateSession = useCallback((value: PlayerSession | null) => {
    if (value) {
      saveSession(value);
      setSession(value);
    } else {
      clearSession();
      setSession(null);
    }
  }, []);

  return useMemo(
    () => ({
      session,
      setSession: updateSession,
    }),
    [session, updateSession],
  );
}

export type { PlayerSession };

