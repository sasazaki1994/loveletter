'use client';

import { Howl } from 'howler';
import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_TRACK = '/sounds/celtic_theme.ogg';

const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

interface BackgroundMusicOptions {
  src?: string; // 単一トラック（後方互換）
  tracks?: string[]; // 複数トラックを順次またはランダム再生
  volumeMultiplier?: number;
}

export function useBackgroundMusic(
  enabled: boolean,
  volume: number,
  options?: BackgroundMusicOptions,
) {
  const { src = DEFAULT_TRACK, tracks, volumeMultiplier = 0.55 } = options ?? {};

  const playlistRef = useRef<string[]>(tracks && tracks.length > 0 ? tracks : [src]);
  const howlRef = useRef<Howl | null>(null);
  const enabledRef = useRef(enabled);
  const targetVolumeRef = useRef(clampVolume(volume * volumeMultiplier));
  const currentIndexRef = useRef<number>(-1);

  enabledRef.current = enabled;
  targetVolumeRef.current = clampVolume(volume * volumeMultiplier);
  playlistRef.current = tracks && tracks.length > 0 ? tracks : [src];

  const pickNextIndex = useCallback(() => {
    const list = playlistRef.current;
    if (list.length <= 1) return 0;
    const prev = currentIndexRef.current;
    let idx = Math.floor(Math.random() * list.length);
    if (idx === prev) idx = (idx + 1) % list.length;
    return idx;
  }, []);

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
    const list = playlistRef.current;
    const multiple = list.length > 1;

    const createInstance = (index: number) => {
      const nextSrc = list[index];
      const instance = new Howl({
        src: [nextSrc],
        loop: !multiple,
        volume: targetVolumeRef.current,
        html5: true,
        preload: true,
      });
      return instance;
    };

    const wireAndPlay = (instance: Howl) => {
      howlRef.current = instance;
      const handleLoadError = (_id: number | undefined, error: unknown) => {
        console.error('[BGM] Failed to load background track.', error);
      };
      instance.on('loaderror', handleLoadError);

      if (multiple) {
        instance.on('end', () => {
          if (!enabledRef.current) return;
          const nextIndex = pickNextIndex();
          currentIndexRef.current = nextIndex;
          const next = createInstance(nextIndex);
          // 既存インスタンスをクリーンアップして差し替え
          const prev = howlRef.current;
          howlRef.current = next;
          try {
            prev?.off('loaderror');
            prev?.off('end');
            if (prev?.playing()) prev.stop();
            prev?.unload();
          } catch {}
          wireAndPlay(next);
          tryStartPlayback();
        });
      }

      tryStartPlayback();
      return () => {
        instance.off('loaderror');
        instance.off('end');
      };
    };

    // 初期インスタンス作成
    const initialIndex = pickNextIndex();
    currentIndexRef.current = initialIndex;
    const instance = createInstance(initialIndex);

    const unbindInstance = wireAndPlay(instance);

    const resumeOnInteraction = () => {
      tryStartPlayback();
      if (howlRef.current?.playing()) {
        window.removeEventListener('pointerdown', resumeOnInteraction);
        window.removeEventListener('keydown', resumeOnInteraction);
      }
    };

    window.addEventListener('pointerdown', resumeOnInteraction, { passive: true });
    window.addEventListener('keydown', resumeOnInteraction);

    return () => {
      window.removeEventListener('pointerdown', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
      unbindInstance();
      const current = howlRef.current;
      if (current?.playing()) current.stop();
      current?.unload();
      if (howlRef.current === current) howlRef.current = null;
    };
  }, [pickNextIndex, tryStartPlayback, volumeMultiplier, volume, enabled]);

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


