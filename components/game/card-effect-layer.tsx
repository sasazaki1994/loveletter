'use client';

import { useEffect, useMemo, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { CardSymbol } from '@/components/icons/card-symbol';
import { CARD_DEFINITIONS } from '@/lib/game/cards';
import type { CardEffectType, CardId, CardIconId, PlayerId } from '@/lib/game/types';

const BASE_DISPLAY_DURATION_MS = 2200;
const EFFECT_DURATION_SCALE = 1.25;

// エフェクトタイプごとの表示時間（ミリ秒）
function getDisplayDuration(effectType: CardEffectType, hasResult: boolean): number {
  let base = BASE_DISPLAY_DURATION_MS;
  switch (effectType) {
    case 'peek':
      base = hasResult ? 4500 : 3500;
      break;
    case 'guess_eliminate':
      base = 3500;
      break;
    case 'compare':
      base = 3500;
      break;
    case 'force_discard':
      base = 3000;
      break;
    case 'swap_hands':
      base = 3000;
      break;
    default:
      base = BASE_DISPLAY_DURATION_MS;
  }
  return Math.round(base * EFFECT_DURATION_SCALE);
}

interface SeatPosition {
  x: number;
  y: number;
  valid: boolean;
}

interface CardEffectEventMetadata {
  guess?: {
    success: boolean;
  };
  peek?: {
    revealedCardId: CardId;
    targetNickname?: string;
  };
  forcedDiscard?: {
    discardedCardIds: CardId[];
  };
  shielded?: {
    playerIds: PlayerId[];
  };
}

export interface CardEffectEvent {
  id: string;
  cardId: CardId;
  effectType: CardEffectType;
  actorId?: PlayerId;
  actorSeat?: number;
  actorNickname?: string;
  targetId?: PlayerId;
  targetSeat?: number;
  targetNickname?: string;
  eliminatedPlayerIds?: PlayerId[];
  eliminatedSeats?: number[];
  createdAt: number;
  metadata?: CardEffectEventMetadata;
}

interface CardEffectLayerProps {
  events: CardEffectEvent[];
  tableSize: { width: number; height: number };
  getSeatPosition: (seat: number) => SeatPosition;
  onEventComplete: (eventId: string) => void;
}

export function CardEffectLayer({ events, tableSize, getSeatPosition, onEventComplete }: CardEffectLayerProps) {
  const cappedEvents = events.length > 5 ? events.slice(-5) : events;
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <AnimatePresence initial={false}>
        {cappedEvents.map((event) => (
          <EffectItem
            key={event.id}
            event={event}
            tableSize={tableSize}
            getSeatPosition={getSeatPosition}
            onEventComplete={onEventComplete}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface EffectItemProps {
  event: CardEffectEvent;
  tableSize: { width: number; height: number };
  getSeatPosition: (seat: number) => SeatPosition;
  onEventComplete: (eventId: string) => void;
}

function EffectItem({ event, tableSize, getSeatPosition, onEventComplete }: EffectItemProps) {
  const prefersReducedMotion = useReducedMotion();
  // エフェクトが結果を持っているかどうかを判定
  const hasResult = useMemo(() => {
    switch (event.effectType) {
      case 'peek':
        return Boolean(event.metadata?.peek?.revealedCardId);
      case 'guess_eliminate':
        return Boolean(event.metadata?.guess);
      case 'force_discard':
        return Boolean(event.metadata?.forcedDiscard?.discardedCardIds?.length);
      case 'compare':
        return Boolean(event.eliminatedSeats?.length !== undefined);
      default:
        return true;
    }
  }, [event.effectType, event.metadata, event.eliminatedSeats]);

  useEffect(() => {
    const duration = Math.round(
      getDisplayDuration(event.effectType, hasResult) * (prefersReducedMotion ? 0.6 : 1),
    );
    const timer = window.setTimeout(() => onEventComplete(event.id), duration);
    return () => window.clearTimeout(timer);
  }, [event.id, event.effectType, hasResult, onEventComplete, prefersReducedMotion]);

  const actorPos = useMemo(() => resolveSeatPosition(event.actorSeat, getSeatPosition), [event.actorSeat, getSeatPosition]);
  const targetPos = useMemo(() => resolveSeatPosition(event.targetSeat, getSeatPosition), [event.targetSeat, getSeatPosition]);
  const eliminatedPositions = useMemo(
    () =>
      (event.eliminatedSeats ?? [])
        .map((seat) => resolveSeatPosition(seat, getSeatPosition))
        .filter((pos): pos is SeatPosition => Boolean(pos)),
    [event.eliminatedSeats, getSeatPosition],
  );

  const definition = CARD_DEFINITIONS[event.cardId];

  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {renderEffectVisual({
        event,
        actorPos,
        targetPos,
        eliminatedPositions,
        tableSize,
        definition,
        reducedMotion: !!prefersReducedMotion,
      })}
    </motion.div>
  );
}

function renderEffectVisual({
  event,
  actorPos,
  targetPos,
  eliminatedPositions,
  tableSize,
  definition,
  reducedMotion,
}: {
  event: CardEffectEvent;
  actorPos: SeatPosition | null;
  targetPos: SeatPosition | null;
  eliminatedPositions: SeatPosition[];
  tableSize: { width: number; height: number };
  definition?: (typeof CARD_DEFINITIONS)[CardId];
  reducedMotion: boolean;
}) {
  const icon = definition?.icon;

  switch (event.effectType) {
    case 'guess_eliminate':
      return renderGuessEffect(event, targetPos, actorPos, icon);
    case 'peek':
      return renderPeekEffect(event, targetPos, actorPos, icon, reducedMotion);
    case 'compare':
      return renderCompareEffect(event, actorPos, targetPos, eliminatedPositions, tableSize, icon);
    case 'shield':
      return renderShieldEffect(actorPos, icon, reducedMotion);
    case 'force_discard':
      return renderForceDiscardEffect(event, targetPos, icon);
    case 'swap_hands':
      return renderSwapEffect(actorPos, targetPos, icon, tableSize, reducedMotion);
    case 'conditional_discard':
      return renderConditionalDiscardEffect(actorPos, icon, reducedMotion);
    case 'self_eliminate':
      return renderSelfEliminateEffect(actorPos, eliminatedPositions, icon);
    default:
      return null;
  }
}

function renderGuessEffect(
  event: CardEffectEvent,
  targetPos: SeatPosition | null,
  actorPos: SeatPosition | null,
  icon?: CardIconId,
) {
  if (!targetPos) return null;
  const guessSuccess = event.metadata?.guess?.success ?? false;

  return (
    <>
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={positionStyle(targetPos)}
        initial={{ scale: 0.65, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: [0, 3, -2, 0] }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <div className="relative h-[6.75rem] w-[6.75rem] rounded-full border border-[rgba(255,140,140,0.5)] bg-[rgba(40,12,12,0.45)] shadow-[0_0_30px_rgba(255,70,70,0.4)]">
          <div className="absolute inset-3 rounded-full border border-[rgba(255,178,178,0.35)]" />
          <div className="absolute left-1/2 top-4 h-12 w-px -translate-x-1/2 bg-[rgba(255,178,178,0.6)]" />
          <div className="absolute left-4 top-1/2 h-px w-12 -translate-y-1/2 bg-[rgba(255,178,178,0.6)]" />
          <div className="absolute right-4 top-1/2 h-px w-12 -translate-y-1/2 bg-[rgba(255,178,178,0.6)]" />
          <div className="absolute left-1/2 bottom-4 h-12 w-px -translate-x-1/2 bg-[rgba(255,178,178,0.6)]" />
          {guessSuccess && (
            <motion.div
              className="absolute inset-0 rounded-full bg-[rgba(255,60,60,0.45)] blur-md"
              initial={{ scale: 0.3, opacity: 0.3 }}
              animate={{ scale: [0.3, 1.2, 1.5], opacity: [0.3, 0.75, 0] }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          )}
        </div>
      </motion.div>
      {actorPos && (
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={positionStyle(actorPos)}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: [-6, 0], opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[rgba(255,210,160,0.42)] bg-[rgba(28,18,12,0.72)] px-3 py-1 text-xs uppercase tracking-[0.36em] text-[var(--color-accent-light)]">
              Guess
            </span>
            {guessSuccess && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3, ease: 'easeOut' }}
                className="flex items-center justify-center rounded-full bg-[rgba(255,100,80,0.25)] p-1"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="h-3.5 w-3.5 text-[rgba(255,140,120,0.9)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 6L7 15l-5-5" />
                </svg>
              </motion.div>
            )}
          </div>
          {icon && (
            <motion.div
              className="mt-2 rounded-full border border-[rgba(255,210,160,0.35)] bg-[rgba(24,46,42,0.78)] p-2 shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.75, opacity: 0 }}
            >
              <CardSymbol icon={icon} size={24} className="text-[var(--color-accent-light)]" />
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
}

function renderPeekEffect(
  event: CardEffectEvent,
  targetPos: SeatPosition | null,
  actorPos: SeatPosition | null,
  icon?: CardIconId,
  reducedMotion?: boolean,
) {
  if (!targetPos) return null;
  const peekMeta = event.metadata?.peek;
  const revealedDefinition = peekMeta ? CARD_DEFINITIONS[peekMeta.revealedCardId] : undefined;
  const isSuccess = Boolean(revealedDefinition);

  return (
    <>
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={positionStyle(targetPos)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="relative w-64 rounded-3xl border border-[rgba(130,210,198,0.45)] bg-[rgba(12,36,34,0.92)] px-6 py-5 text-center shadow-[0_28px_52px_rgba(0,0,0,0.45)]">
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-[rgba(90,170,160,0.22)] via-transparent to-[rgba(20,60,55,0.55)]"
            initial={{ opacity: 0.35 }}
            animate={reducedMotion ? undefined : { opacity: [0.35, 0.6, 0.3] }}
            transition={reducedMotion ? undefined : { duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
          />
          <div className="relative text-[var(--color-accent-light)]">
            <div className="flex items-center justify-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.42em] opacity-75">Veil</p>
              {isSuccess && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3, ease: 'easeOut' }}
                  className="flex items-center justify-center rounded-full bg-[rgba(90,200,170,0.25)] p-1"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5 text-[rgba(90,240,200,0.9)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 6L7 15l-5-5" />
                  </svg>
                </motion.div>
              )}
            </div>
            <p className="mt-1 text-sm opacity-80">{peekMeta?.targetNickname ?? event.targetNickname ?? 'Unknown'} の手札</p>
            {revealedDefinition ? (
              <motion.div
                className="mt-3 flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
              >
                <span className="font-heading text-4xl drop-shadow">{revealedDefinition.rank}</span>
                <span className="text-sm opacity-85">{revealedDefinition.name}</span>
              </motion.div>
            ) : (
              <span className="mt-3 inline-block rounded-full border border-[rgba(255,255,255,0.22)] px-3 py-1 text-xs text-[rgba(255,255,255,0.72)]">
                Hidden
              </span>
            )}
          </div>
        </div>
      </motion.div>
      {actorPos && icon && (
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={positionStyle(actorPos)}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1, rotate: [0, 6, -4, 0] }}
          exit={{ opacity: 0, scale: 0.75 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="rounded-full border border-[rgba(140,210,198,0.4)] bg-[rgba(18,48,46,0.78)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.4)]">
            <CardSymbol icon={icon} size={26} className="text-[var(--color-accent-light)]" />
          </div>
        </motion.div>
      )}
    </>
  );
}

function renderCompareEffect(
  event: CardEffectEvent,
  actorPos: SeatPosition | null,
  targetPos: SeatPosition | null,
  eliminatedPositions: SeatPosition[],
  tableSize: { width: number; height: number },
  icon?: CardIconId,
) {
  if (!actorPos || !targetPos) return null;
  const midpoint = midpointBetween(actorPos, targetPos, tableSize);

  return (
    <>
      {[actorPos, targetPos].map((pos, index) => (
        <motion.div
          key={`compare-ring-${index}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={positionStyle(pos)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.75, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="h-[6.5rem] w-[6.5rem] rounded-full border border-[rgba(255,210,150,0.45)] bg-[rgba(30,18,12,0.55)] shadow-[0_0_28px_rgba(255,195,140,0.35)]" />
        </motion.div>
      ))}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={positionStyle(midpoint)}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: [0.7, 1.05, 1], opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-2 rounded-full border border-[rgba(255,212,160,0.42)] bg-[rgba(30,18,12,0.72)] px-3.5 py-1.5 text-[var(--color-accent-light)]">
          <CardSymbol icon="swords" size={22} className="text-[var(--color-accent-light)]" />
        </div>
      </motion.div>
      {eliminatedPositions.map((pos, index) => (
        <motion.div
          key={`compare-elim-${index}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={positionStyle(pos)}
          initial={{ scale: 0.4, opacity: 0.5 }}
          animate={{ scale: [0.4, 1.15, 1.45], opacity: [0.5, 0.8, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="h-[6rem] w-[6rem] rounded-full bg-[rgba(255,70,60,0.45)] blur-[10px]" />
        </motion.div>
      ))}
    </>
  );
}

function renderShieldEffect(actorPos: SeatPosition | null, icon?: CardIconId, reducedMotion?: boolean) {
  if (!actorPos) return null;
  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={positionStyle(actorPos)}
      initial={{ scale: 0.75, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.75, opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="relative h-[6.75rem] w-[6.75rem] rounded-full border border-[rgba(140,220,210,0.5)] bg-[rgba(15,36,34,0.65)] shadow-[0_0_34px_rgba(110,200,190,0.35)]">
        <motion.div
          className="pointer-events-none absolute inset-4 rounded-full border border-[rgba(110,200,190,0.35)]"
          animate={reducedMotion ? undefined : { rotate: 360 }}
          transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.8, ease: 'linear' }}
        />
        <motion.div
          className="pointer-events-none absolute inset-1 rounded-full border border-[rgba(180,235,226,0.22)]"
          animate={reducedMotion ? undefined : { rotate: -360 }}
          transition={reducedMotion ? undefined : { repeat: Infinity, duration: 5.4, ease: 'linear' }}
        />
        {icon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CardSymbol icon={icon} size={28} className="text-[var(--color-accent-light)]" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function renderForceDiscardEffect(
  event: CardEffectEvent,
  targetPos: SeatPosition | null,
  icon?: CardIconId,
) {
  if (!targetPos) return null;
  const discardedCards = event.metadata?.forcedDiscard?.discardedCardIds ?? [];
  const scatter = [
    { x: -18, y: -22, rotate: -14 },
    { x: 16, y: -12, rotate: 10 },
    { x: -10, y: 14, rotate: -6 },
  ];

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={positionStyle(targetPos)}
      initial={{ scale: 0.82, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="relative h-[6.75rem] w-[6.75rem] rounded-[28px] border border-[rgba(255,205,150,0.4)] bg-[rgba(30,18,12,0.65)] shadow-[0_22px_44px_rgba(0,0,0,0.45)]">
        {scatter.map((offset, index) => (
          <motion.div
            key={`discard-card-${index}`}
            className="absolute h-12 w-8 rounded-[12px] border border-[rgba(255,205,150,0.35)] bg-[rgba(58,36,22,0.82)] shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${offset.rotate}deg)`,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.3 + index * 0.05, ease: 'easeOut' }}
          >
            {discardedCards[index] && (
              <div className="flex h-full flex-col items-center justify-center text-[10px] text-[var(--color-accent-light)]">
                <span className="font-heading text-base drop-shadow">
                  {CARD_DEFINITIONS[discardedCards[index]].rank}
                </span>
              </div>
            )}
          </motion.div>
        ))}
        {icon && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <CardSymbol icon={icon} size={28} className="text-[var(--color-accent-light)]" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function renderSwapEffect(
  actorPos: SeatPosition | null,
  targetPos: SeatPosition | null,
  icon: CardIconId | undefined,
  tableSize: { width: number; height: number },
  reducedMotion?: boolean,
) {
  if (!actorPos || !targetPos) return null;
  const midpoint = midpointBetween(actorPos, targetPos, tableSize);

  return (
    <>
      {[actorPos, targetPos].map((pos, index) => (
        <motion.div
          key={`swap-ring-${index}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={positionStyle(pos)}
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <motion.div
            className="relative h-[6.25rem] w-[6.25rem] rounded-full border border-[rgba(255,205,150,0.4)] bg-[rgba(30,18,12,0.55)]"
            animate={reducedMotion ? undefined : { rotate: index === 0 ? 360 : -360 }}
            transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.2, ease: 'linear' }}
          >
            <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(110,200,190,0.35)]" />
            <div className="absolute inset-2 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-[var(--color-accent-light)]">
                <path
                  fill="currentColor"
                  d="M7 7h7V4l5 5-5 5v-3H7V7zm10 10h-7v3l-5-5 5-5v3h7v4z"
                />
              </svg>
            </div>
          </motion.div>
        </motion.div>
      ))}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={positionStyle(midpoint)}
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-2 rounded-full border border-[rgba(255,205,150,0.42)] bg-[rgba(30,18,12,0.7)] px-4 py-1 text-xs uppercase tracking-[0.32em] text-[var(--color-accent-light)]">
          Swap
          {icon && <CardSymbol icon={icon} size={20} className="text-[var(--color-accent-light)]" />}
        </div>
      </motion.div>
    </>
  );
}

function renderConditionalDiscardEffect(actorPos: SeatPosition | null, icon?: CardIconId, reducedMotion?: boolean) {
  if (!actorPos) return null;
  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={positionStyle(actorPos)}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.75, opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="relative h-[6.5rem] w-[6.5rem] rounded-full border border-[rgba(255,210,170,0.32)] bg-[rgba(30,20,16,0.55)]">
        <motion.div
          className="pointer-events-none absolute inset-3 rounded-full bg-[rgba(255,210,170,0.28)] blur-lg"
          animate={reducedMotion ? undefined : { opacity: [0.4, 0.22, 0.48] }}
          transition={reducedMotion ? undefined : { duration: 1.2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
        {icon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CardSymbol icon={icon} size={24} className="text-[var(--color-accent-light)]" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function renderSelfEliminateEffect(
  actorPos: SeatPosition | null,
  eliminatedPositions: SeatPosition[],
  icon?: CardIconId,
) {
  if (!actorPos) return null;
  return (
    <>
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={positionStyle(actorPos)}
        initial={{ scale: 0.6, opacity: 0.4 }}
        animate={{ scale: [0.6, 1.25, 1.5], opacity: [0.4, 0.8, 0] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      >
        <div className="h-[7rem] w-[7rem] rounded-full bg-[rgba(255,80,40,0.5)] blur-[12px]" />
      </motion.div>
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={positionStyle(actorPos)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.75, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="relative h-[6.5rem] w-[6.5rem] rounded-full border border-[rgba(255,150,110,0.45)] bg-[rgba(32,16,12,0.62)] shadow-[0_0_34px_rgba(255,120,70,0.35)]">
          {icon && (
            <div className="absolute inset-0 flex items-center justify-center">
              <CardSymbol icon={icon} size={26} className="text-[var(--color-accent-light)]" />
            </div>
          )}
        </div>
      </motion.div>
      {eliminatedPositions.map((pos, index) => (
        <motion.div
          key={`self-elim-${index}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={positionStyle(pos)}
          initial={{ scale: 0.4, opacity: 0.5 }}
          animate={{ scale: [0.4, 1.1, 1.45], opacity: [0.5, 0.8, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          <div className="h-[6rem] w-[6rem] rounded-full bg-[rgba(255,70,60,0.45)] blur-[10px]" />
        </motion.div>
      ))}
    </>
  );
}

function resolveSeatPosition(
  seat: number | undefined,
  getSeatPosition: (seat: number) => SeatPosition,
): SeatPosition | null {
  if (typeof seat !== 'number') return null;
  const pos = getSeatPosition(seat);
  return pos && pos.valid ? pos : null;
}

function positionStyle(pos: SeatPosition): CSSProperties {
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  };
}

function midpointBetween(a: SeatPosition, b: SeatPosition, tableSize: { width: number; height: number }): SeatPosition {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    valid: a.valid && b.valid,
  };
}

