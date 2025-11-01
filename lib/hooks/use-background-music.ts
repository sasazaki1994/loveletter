'use client';

import { Howl } from 'howler';
import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_TRACK = '/sounds/celtic_theme.ogg';

const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

interface BackgroundMusicOptions {
  src?: string;
  volumeMultiplier?: number;
}

export function useBackgroundMusic(
  enabled: boolean,
  volume: number,
  options?: BackgroundMusicOptions,
) {
  const { src = DEFAULT_TRACK, volumeMultiplier = 0.55 } = options ?? {};

  const howlRef = useRef<Howl | null>(null);
  const enabledRef = useRef(enabled);
  const targetVolumeRef = useRef(clampVolume(volume * volumeMultiplier));

  enabledRef.current = enabled;
  targetVolumeRef.current = clampVolume(volume * volumeMultiplier);

  const tryStartPlayback = useCallback(() => {
    const instance = howlRef.current;
    if (!instance || !enabledRef.current) return;

    const desiredVolume = targetVolumeRef.current;

    if (instance.playing()) {
      instance.volume(desiredVolume);
      return;
    }

    try {
      instance.volume(desiredVolume);
      instance.play();
    } catch (error) {
      console.warn('[BGM] Playback start blocked or failed.', error);
    }
  }, []);

  useEffect(() => {
    const instance = new Howl({
      src: [src],
      loop: true,
      volume: targetVolumeRef.current,
      html5: true,
      preload: true,
    });

    howlRef.current = instance;

    const resumeOnInteraction = () => {
      tryStartPlayback();
      if (howlRef.current?.playing()) {
        window.removeEventListener('pointerdown', resumeOnInteraction);
        window.removeEventListener('keydown', resumeOnInteraction);
      }
    };

    const handleLoadError = (_id: number | undefined, error: unknown) => {
      console.error('[BGM] Failed to load background track.', error);
    };

    window.addEventListener('pointerdown', resumeOnInteraction, { passive: true });
    window.addEventListener('keydown', resumeOnInteraction);
    instance.on('loaderror', handleLoadError);

    if (enabledRef.current) {
      tryStartPlayback();
    }

    return () => {
      window.removeEventListener('pointerdown', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
      instance.off('loaderror', handleLoadError);
      if (instance.playing()) {
        instance.stop();
      }
      instance.unload();
      if (howlRef.current === instance) {
        howlRef.current = null;
      }
    };
  }, [src, tryStartPlayback]);

  useEffect(() => {
    const instance = howlRef.current;
    if (!instance) return;

    instance.volume(targetVolumeRef.current);
  }, [volume, volumeMultiplier]);

  useEffect(() => {
    const instance = howlRef.current;
    if (!instance) return;

    if (enabled) {
      tryStartPlayback();
    } else if (instance.playing()) {
      instance.stop();
    }
  }, [enabled, tryStartPlayback]);
}


