'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

export type TempoMode = "normal" | "fast";

const STORAGE_KEY = "llr:tempo";

const TEMPO_PRESETS: Record<
  TempoMode,
  {
    /** 演出表示時間スケール（FX/オーバーレイ等） */
    effectScale: number;
    /** ボット手番トリガー遅延（ms） */
    botTurnDelayMs: number;
    /** ターン開始カットイン表示（ms） */
    turnCutinMs: number;
  }
> = {
  normal: {
    effectScale: 1.0,
    botTurnDelayMs: 2000,
    turnCutinMs: 2000,
  },
  fast: {
    effectScale: 0.65,
    botTurnDelayMs: 350,
    turnCutinMs: 900,
  },
};

function isTempoMode(value: unknown): value is TempoMode {
  return value === "normal" || value === "fast";
}

export interface TempoSettings {
  tempo: TempoMode;
  setTempo: (next: TempoMode) => void;
  toggleTempo: () => void;
  effectScale: number;
  botTurnDelayMs: number;
  turnCutinMs: number;
}

export function useTempoSettings(): TempoSettings {
  const [tempo, setTempoState] = useState<TempoMode>("normal");

  // 初回: localStorage から復元
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (isTempoMode(raw)) {
        setTempoState(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  // 変更: localStorage へ保存 + タブ間同期
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, tempo);
    } catch {
      // ignore
    }
  }, [tempo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return;
      if (e.key !== STORAGE_KEY) return;
      if (!isTempoMode(e.newValue)) return;
      setTempoState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTempo = useCallback((next: TempoMode) => {
    setTempoState(next);
  }, []);

  const toggleTempo = useCallback(() => {
    setTempoState((prev) => (prev === "fast" ? "normal" : "fast"));
  }, []);

  const preset = useMemo(() => TEMPO_PRESETS[tempo], [tempo]);

  return useMemo(
    () => ({
      tempo,
      setTempo,
      toggleTempo,
      effectScale: preset.effectScale,
      botTurnDelayMs: preset.botTurnDelayMs,
      turnCutinMs: preset.turnCutinMs,
    }),
    [preset.botTurnDelayMs, preset.effectScale, preset.turnCutinMs, setTempo, tempo, toggleTempo],
  );
}


