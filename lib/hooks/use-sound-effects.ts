'use client';

import { Howl } from "howler";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SoundKey =
  | "card_draw"
  | "card_place"
  | "card_flip"
  | "card_shuffle"
  | "rank1"
  | "swap"
  | "peek"
  | "swords"
  | "confirm"
  | "shield"
  | "deny"
  | "turn_chime"
  | "win"
  | "lose";

interface SoundVariant {
  sources: string[];
  allowPitchVariation?: boolean;
}

const SOUND_MANIFEST: Record<SoundKey, SoundVariant[]> = {
  card_draw: [
    {
      sources: ["/sounds/card_draw.mp3"],
      allowPitchVariation: false,
    },
  ],
  card_place: [
    {
      sources: ["/sounds/card_place.mp3"],
      allowPitchVariation: false,
    },
  ],
  card_flip: [
    {
      sources: ["/sounds/card_flip_1.mp3"],
      allowPitchVariation: false,
    },
    {
      sources: ["/sounds/card_flip_2.mp3"],
      allowPitchVariation: false,
    },
    {
      sources: ["/sounds/card_flip_3.mp3"],
      allowPitchVariation: false,
    },
  ],
  card_shuffle: [
    {
      sources: ["/sounds/card_shuffle_1.mp3"],
      allowPitchVariation: false,
    },
    {
      sources: ["/sounds/card_shuffle_2.mp3"],
      allowPitchVariation: false,
    },
  ],
  rank1: [
    {
      sources: ["/sounds/hit_2.mp3"],
      allowPitchVariation: false,
    },
  ],
  swap: [
    {
      sources: ["/sounds/warp.mp3"],
      allowPitchVariation: false,
    },
  ],
  peek: [
    {
      sources: ["/sounds/recall_past.mp3"],
      allowPitchVariation: false,
    },
  ],
  swords: [
    {
      sources: ["/sounds/sword_slash_2.mp3"],
      allowPitchVariation: false,
    },
  ],
  confirm: [
    {
      sources: ["/sounds/confirm.wav"],
      allowPitchVariation: false,
    },
  ],
  shield: [
    {
      sources: ["/sounds/shield_block.mp3", "/sounds/shield.wav"],
    },
  ],
  deny: [
    {
      sources: ["/sounds/deny.wav"],
    },
  ],
  turn_chime: [
    {
      sources: ["/sounds/turn_chime.wav"],
    },
  ],
  win: [
    {
      sources: ["/sounds/win.wav"],
    },
  ],
  lose: [
    {
      sources: ["/sounds/fall_thud.mp3"],
      allowPitchVariation: false,
    },
  ],
};

export function useSoundEffects(defaultVolume = 0.4) {
  const [volume, setVolume] = useState(defaultVolume);
  const [muted, setMuted] = useState(false);
  const registryRef = useRef<Map<SoundKey, Howl[]>>(new Map());

  useEffect(() => {
    const registry = registryRef.current;
    return () => {
      registry.forEach((howls) => {
        howls.forEach((howl) => howl.unload());
      });
      registry.clear();
    };
  }, []);

  const play = useCallback(
    (key: SoundKey, options?: { volume?: number; pitchVariation?: boolean }) => {
      if (muted) return;
      const registry = registryRef.current;
      let howls = registry.get(key);
      const variants = SOUND_MANIFEST[key];
      if (!variants || variants.length === 0) {
        console.warn(`[Sound] Missing manifest entry for key: ${key}`);
        return;
      }
      if (!howls) {
        howls = variants.map((variant) =>
          new Howl({
            src: variant.sources,
            volume,
            preload: true,
          }),
        );
        registry.set(key, howls);
      }

      const index = howls.length > 1 ? Math.floor(Math.random() * howls.length) : 0;
      const howl = howls[index];
      const variant = variants[index];

      const allowPitchVariation = options?.pitchVariation ?? variant.allowPitchVariation ?? true;

      let rate = 1.0;
      if (allowPitchVariation) {
        rate = 0.95 + Math.random() * 0.1;
      }

      const resolvedVolume = options?.volume ?? volume;
      howl.volume(resolvedVolume);
      howl.stop();

      const soundId = howl.play();
      if (soundId !== undefined) {
        howl.rate(rate, soundId);
      }
    },
    [muted, volume],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const setVolumeSafe = useCallback((value: number) => {
    setVolume(Math.min(1, Math.max(0, value)));
  }, []);

  return useMemo(
    () => ({ play, volume, setVolume: setVolumeSafe, muted, toggleMute }),
    [muted, play, setVolumeSafe, toggleMute, volume],
  );
}

export type { SoundKey };

