'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';

import type { CardId } from '@/lib/game/types';

interface CardArtProps {
  cardId: CardId;
  alt?: string;
  className?: string;
}

/**
 * カード背景アート。優先順で複数パスを試行:
 * 1) /cards/{cardId}.svg
 * 2) /cards/{cardId}.webp
 * 3) /cards/placeholder.svg
 * 4) /cards/placeholder.webp
 * 5) data-uri の最終フォールバック
 */
export function CardArt({ cardId, alt = '', className }: CardArtProps) {
  const candidates = useMemo(
    () => [
      `/cards/${cardId}.svg`,
      `/cards/${cardId}.webp`,
      `/cards/placeholder.svg`,
      `/cards/placeholder.webp`,
    ],
    [cardId],
  );

  const finalFallback = useMemo(() => {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3f39"/><stop offset="1" stop-color="#0e2a27"/></linearGradient></defs>` +
        `<rect width="512" height="768" rx="48" fill="url(#g)"/>` +
      `</svg>`,
    );
    return `data:image/svg+xml;charset=utf-8,${svg}`;
  }, []);

  const [index, setIndex] = useState(0);

  const handleError = useCallback(() => {
    setIndex((prev) => {
      if (prev + 1 < candidates.length) return prev + 1;
      return prev; // 末尾に到達
    });
  }, [candidates.length]);

  const src = index < candidates.length ? candidates[index] : finalFallback;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 40vw, (max-width: 1024px) 20vw, 200px"
      className={className}
      style={{ objectFit: 'cover' }}
      onError={handleError}
      priority={false}
    />
  );
}


