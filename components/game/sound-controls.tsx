'use client';

import { Volume2, VolumeX, Settings, Check } from "lucide-react";
import { useState } from "react";

import { useGameContext } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function SoundControls() {
  const { 
    muted, 
    toggleMute, 
    volume, 
    setVolume, 
    tempo, 
    setTempo 
  } = useGameContext();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-full border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.7)] p-0 text-[var(--color-accent-light)] shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:bg-[rgba(20,45,40,0.8)]"
          aria-label="設定"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-[rgba(215,178,110,0.3)] bg-[rgba(12,28,26,0.95)] text-[var(--color-text)] backdrop-blur-xl sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl text-[var(--color-accent-light)]">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Volume Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-[var(--color-text-muted)]">Master Volume</Label>
              <div className="flex items-center gap-2">
                <span className="w-8 text-right text-xs text-[var(--color-accent-light)]">
                  {muted ? "Mute" : `${Math.round(volume * 100)}%`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-[var(--color-accent-light)] hover:bg-[rgba(255,255,255,0.1)]"
                  onClick={toggleMute}
                  aria-pressed={muted}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="relative pt-2">
              <input
                type="range"
                min={0}
                max={100}
                disabled={muted}
                value={Math.round(volume * 100)}
                onChange={(event) => setVolume(Number(event.target.value) / 100)}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[rgba(255,255,255,0.1)] accent-[var(--color-accent)] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Tempo Section */}
          <div className="space-y-3 border-t border-[rgba(255,255,255,0.1)] pt-4">
            <Label className="text-sm font-medium text-[var(--color-text-muted)]">Game Tempo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTempo("normal")}
                className={`
                  relative flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all
                  ${tempo === "normal" 
                    ? "border-[var(--color-accent)] bg-[rgba(215,178,110,0.15)] text-[var(--color-accent-light)]" 
                    : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--color-text-muted)] hover:bg-[rgba(255,255,255,0.05)]"}
                `}
              >
                <span>Normal</span>
                {tempo === "normal" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setTempo("fast")}
                className={`
                  relative flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all
                  ${tempo === "fast" 
                    ? "border-[var(--color-accent)] bg-[rgba(215,178,110,0.15)] text-[var(--color-accent-light)]" 
                    : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--color-text-muted)] hover:bg-[rgba(255,255,255,0.05)]"}
                `}
              >
                <span>Fast</span>
                {tempo === "fast" && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] opacity-70">
              * Fastモードでは演出時間が短縮され、Botの思考時間が早くなります。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
