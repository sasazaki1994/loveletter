'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { CARD_DEFINITIONS } from '@/lib/game/cards';
import { CardArt } from '@/components/game/card-art';
import type { CardId, PlayerId } from '@/lib/game/types';

const SKIP_ARM_DELAY_MS = 250;

interface SeatPosition {
  x: number;
  y: number;
  valid: boolean;
}

interface HandRevealOverlayProps {
  finalHands: Record<PlayerId, CardId[]>;
  players: Array<{
    id: PlayerId;
    nickname: string;
    seat: number;
  }>;
  tableSize: { width: number; height: number };
  getSeatPosition: (seat: number) => SeatPosition;
  displayDurationMs?: number;
  onComplete: () => void;
}

export function HandRevealOverlay({
  finalHands,
  players,
  tableSize,
  getSeatPosition,
  displayDurationMs = 2500,
  onComplete,
}: HandRevealOverlayProps) {
  const completedRef = useRef(false);
  const [skipHintVisible, setSkipHintVisible] = useState(false);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    const timer = window.setTimeout(() => {
      complete();
    }, displayDurationMs);

    const armTimer = window.setTimeout(() => {
      setSkipHintVisible(true);
    }, Math.min(SKIP_ARM_DELAY_MS, Math.max(120, Math.round(displayDurationMs * 0.2))));

    const handleSkip = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent) {
        if (!["Enter", " ", "Escape"].includes(event.key)) return;
        event.preventDefault();
      }
      complete();
    };

    window.addEventListener('keydown', handleSkip);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(armTimer);
      window.removeEventListener('keydown', handleSkip);
      setSkipHintVisible(false);
    };
  }, [complete, displayDurationMs]);

  return (
    <div
      className="absolute inset-0 z-20"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        complete();
      }}
    >
      <AnimatePresence>
        {players.map((player) => {
          const hand = finalHands[player.id];
          if (!hand || hand.length === 0) return null;

          const seatPos = getSeatPosition(player.seat);
          if (!seatPos.valid) return null;

          return (
            <PlayerHandReveal
              key={player.id}
              playerId={player.id}
              nickname={player.nickname}
              hand={hand}
              position={seatPos}
            />
          );
        })}
      </AnimatePresence>
      {skipHintVisible && (
        <motion.div
          className="absolute inset-x-0 bottom-4 flex justify-center px-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <div className="rounded-full border border-[rgba(140,210,198,0.32)] bg-[rgba(10,28,26,0.82)] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-light)]">
            クリック / Enter でスキップ
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface PlayerHandRevealProps {
  playerId: PlayerId;
  nickname: string;
  hand: CardId[];
  position: SeatPosition;
}

function PlayerHandReveal({ playerId, nickname, hand, position }: PlayerHandRevealProps) {
  const positionStyle: CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
  };

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={positionStyle}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex flex-col items-center gap-2">
        {/* プレイヤー名ラベル */}
        <motion.div
          className="rounded-full border border-[rgba(140,210,198,0.4)] bg-[rgba(18,48,46,0.85)] px-3 py-1 text-xs text-[var(--color-accent-light)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
        >
          {nickname}
        </motion.div>

        {/* カード表示 */}
        <div className="flex gap-2">
          {hand.map((cardId, index) => {
            const definition = CARD_DEFINITIONS[cardId];
            
            return (
              <motion.div
                key={`${playerId}-${cardId}-${index}`}
                className="relative"
                initial={{ opacity: 0, scale: 0.6, rotateY: 0 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotateY: 360,
                }}
                transition={{
                  delay: 0.2 + index * 0.1,
                  duration: 0.8,
                  ease: 'easeOut',
                }}
                style={{
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="relative flex h-[5rem] w-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-[rgba(140,210,198,0.45)] bg-[rgba(12,36,34,0.92)] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                  <div className="absolute inset-0 overflow-hidden rounded-xl">
                    <CardArt cardId={definition.id} alt={`${definition.name} (${definition.rank})`} />
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.4)_65%,rgba(0,0,0,0.65)_100%)]" />
                  </div>
                  <motion.div
                    className="relative z-10 flex flex-col items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                  >
                    <span className="font-heading text-2xl text-[var(--color-accent-light)] drop-shadow">
                      {definition.rank}
                    </span>
                    <span className="text-[8px] text-[var(--color-text-muted)] opacity-85">
                      {definition.name}
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

