'use client';

import { Howl } from "howler";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SoundKey =
  | "card_draw"
  | "card_place"
  | "confirm"
  | "shield"
  | "deny"
  | "turn_chime"
  | "win"
  | "lose";

const SOUND_MANIFEST: Record<SoundKey, string> = {
  card_draw: "/sounds/card_draw.wav",
  card_place: "/sounds/card_place.wav",
  confirm: "/sounds/confirm.wav",
  shield: "/sounds/shield.wav",
  deny: "/sounds/deny.wav",
  turn_chime: "/sounds/turn_chime.wav",
  win: "/sounds/win.wav",
  lose: "/sounds/lose.wav",
};

export function useSoundEffects(defaultVolume = 0.4) {
  const [volume, setVolume] = useState(defaultVolume);
  const [muted, setMuted] = useState(false);
  const registryRef = useRef<Map<SoundKey, Howl>>(new Map());

  useEffect(() => {
    const registry = registryRef.current;
    return () => {
      registry.forEach((howl) => howl.unload());
      registry.clear();
    };
  }, []);

  const play = useCallback(
    (key: SoundKey, options?: { volume?: number }) => {
      if (muted) return;
      const registry = registryRef.current;
      let howl = registry.get(key);
      if (!howl) {
        howl = new Howl({
          src: [SOUND_MANIFEST[key]],
          volume,
          preload: true,
        });
        registry.set(key, howl);
      }
      howl.volume(options?.volume ?? volume);
      howl.stop();
      howl.play();
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

