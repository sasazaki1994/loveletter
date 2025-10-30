'use client';

import { Volume2, VolumeX } from "lucide-react";

import { useGameContext } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";

export function SoundControls() {
  const { muted, toggleMute, volume, setVolume } = useGameContext();

  return (
    <div
      className="flex items-center gap-3 rounded-full border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.7)] px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
      aria-label="サウンド設定"
    >
      <Button
        type="button"
        variant="ghost"
        className="h-8 w-8 p-0 text-[var(--color-accent-light)]"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? "ミュート解除" : "ミュート"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <label htmlFor="volume-slider" className="sr-only">
          音量
        </label>
        <input
          id="volume-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
          className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-[rgba(215,178,110,0.25)]" 
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          aria-label="音量スライダー"
        />
        <span className="w-8 text-right text-[var(--color-accent-light)]">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}

