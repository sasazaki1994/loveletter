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
    /** ラウンド開始カットイン表示（ms） */
    roundCutinMs: number;
    /** ラウンド開始から自ターン告知までの追従遅延（ms） */
    roundToTurnCutinDelayMs: number;
    /** 山札切れ時の手札公開表示（ms） */
    handRevealMs: number;
    /** 通常リザルトの表示遅延（ms） */
    resultDialogDelayMs: number;
    /** 手札公開待ちのフォールバック表示（ms） */
    resultRevealFallbackMs: number;
    /** リザルト強制表示までの待ち時間（ms） */
    resultHardFallbackMs: number;
  }
> = {
  normal: {
    effectScale: 1.0,
    botTurnDelayMs: 2000,
    turnCutinMs: 1600,
    roundCutinMs: 1400,
    roundToTurnCutinDelayMs: 1800,
    handRevealMs: 2500,
    resultDialogDelayMs: 1000,
    resultRevealFallbackMs: 5000,
    resultHardFallbackMs: 8000,
  },
  fast: {
    effectScale: 0.65,
    botTurnDelayMs: 350,
    turnCutinMs: 900,
    roundCutinMs: 750,
    roundToTurnCutinDelayMs: 1100,
    handRevealMs: 1200,
    resultDialogDelayMs: 250,
    resultRevealFallbackMs: 1600,
    resultHardFallbackMs: 2500,
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
  roundCutinMs: number;
  roundToTurnCutinDelayMs: number;
  handRevealMs: number;
  resultDialogDelayMs: number;
  resultRevealFallbackMs: number;
  resultHardFallbackMs: number;
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
      roundCutinMs: preset.roundCutinMs,
      roundToTurnCutinDelayMs: preset.roundToTurnCutinDelayMs,
      handRevealMs: preset.handRevealMs,
      resultDialogDelayMs: preset.resultDialogDelayMs,
      resultRevealFallbackMs: preset.resultRevealFallbackMs,
      resultHardFallbackMs: preset.resultHardFallbackMs,
    }),
    [
      preset.botTurnDelayMs,
      preset.effectScale,
      preset.handRevealMs,
      preset.resultDialogDelayMs,
      preset.resultHardFallbackMs,
      preset.resultRevealFallbackMs,
      preset.roundCutinMs,
      preset.roundToTurnCutinDelayMs,
      preset.turnCutinMs,
      setTempo,
      tempo,
      toggleTempo,
    ],
  );
}


