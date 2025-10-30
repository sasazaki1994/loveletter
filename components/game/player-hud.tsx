import { Badge } from "@/components/ui/badge";
import { CardSymbol } from "@/components/icons/card-symbol";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { PlayerId, PlayerPublicState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

interface PlayerHUDProps {
  player: PlayerPublicState;
  isSelf: boolean;
  isActive: boolean;
  onSelectTarget?: (playerId: PlayerId) => void;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  targetReason?: string;
  drawPileCount?: number;
}

export function PlayerHUD({
  player,
  isSelf,
  isActive,
  onSelectTarget,
  selectable,
  selected,
  disabled,
  targetReason,
  drawPileCount,
}: PlayerHUDProps) {
  const topDiscard = player.discardPile[player.discardPile.length - 1];
  const topCardDefinition = topDiscard ? CARD_DEFINITIONS[topDiscard] : undefined;

  const isDisabled = !selectable || isSelf || player.isEliminated || disabled;

  const visibleDiscards = player.discardPile.slice(-4);
  const hiddenDiscardCount = player.discardPile.length - visibleDiscards.length;

  return (
    <button
      type="button"
      onClick={selectable ? () => onSelectTarget?.(player.id) : undefined}
      className={cn(
        "group flex w-[17rem] max-w-full flex-col gap-2 rounded-2xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.65)]/80 px-4 py-3 text-left transition-all",
        selectable && !isSelf && "hover:border-[var(--color-accent)] hover:bg-[rgba(18,42,39,0.8)]",
        selected && "border-[var(--color-accent)] shadow-[0_0_24px_rgba(215,178,110,0.35)]",
        isActive && "ring-1 ring-[var(--color-accent)]",
        isSelf && "opacity-100",
        player.isEliminated && "opacity-60 grayscale",
        selectable && isDisabled && !player.isEliminated && "cursor-not-allowed opacity-70",
      )}
      disabled={isDisabled}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-heading text-lg text-[var(--color-accent-light)]">
              {player.nickname}
            </p>
            {player.isBot && <Badge variant="outline">BOT</Badge>}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            座席 {player.seat + 1} • 手札 {player.handCount} 枚
          </p>
        </div>
        <div className="flex gap-2">
          {player.shield && <Badge variant="shield">防御中</Badge>}
          {player.isEliminated && <Badge variant="danger">脱落</Badge>}
          {isActive && <Badge variant="default">手番</Badge>}
        </div>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Discard</p>
          <div className="mt-1 flex min-h-[2.5rem] items-center">
            {visibleDiscards.length > 0 ? (
              <div className="flex items-end">
                {visibleDiscards.map((card, index) => {
                  const def = CARD_DEFINITIONS[card];
                  return (
                    <div
                      key={`${card}-${index}`}
                      className="relative -ml-6 flex h-12 w-8 items-center justify-center rounded-xl border border-[rgba(215,178,110,0.4)] bg-gradient-to-br from-[rgba(34,70,65,0.95)] via-[rgba(24,54,50,0.95)] to-[rgba(16,36,33,0.98)] text-[var(--color-accent-light)] shadow-[0_10px_22px_rgba(0,0,0,0.45)] first:ml-0"
                      title={def ? `${def.name} (${def.rank})` : undefined}
                    >
                      {def ? (
                        <span className="font-heading text-lg" aria-hidden>
                          {def.rank}
                        </span>
                      ) : (
                        <span className="text-xs">?</span>
                      )}
                    </div>
                  );
                })}
                {hiddenDiscardCount > 0 && (
                  <span className="ml-2 text-xs text-[var(--color-text-muted)]">+{hiddenDiscardCount}</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">捨て札なし</span>
            )}
          </div>
        </div>
        {typeof drawPileCount === "number" && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Draw</p>
            <div className="mt-1 flex min-h-[2.5rem] items-center gap-2">
              <div className="relative h-12 w-9">
                {[0, 1, 2].map((layer) => (
                  <span
                    key={`draw-layer-${layer}`}
                    className="absolute bottom-0 left-0 h-10 w-7 rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.85)] shadow-[0_10px_22px_rgba(0,0,0,0.45)]"
                    style={{ transform: `translate(${layer * 6}px, ${layer * -4}px)` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">残り {drawPileCount} 枚</span>
            </div>
          </div>
        )}
      </div>
      {topCardDefinition ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.55)] px-3 py-2 text-xs">
          <span className="rounded-full border border-[rgba(215,178,110,0.35)] bg-[rgba(20,48,45,0.8)] px-2 py-1 font-heading text-sm text-[var(--color-accent-light)]">
            {topCardDefinition.rank}
          </span>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <CardSymbol icon={topCardDefinition.icon} size={20} className="text-[var(--color-accent-light)]" />
            <span>{topCardDefinition.name}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">公開された捨て札はありません。</p>
      )}
      {selectable && targetReason && !player.isEliminated && (
        <p className="text-[10px] text-[var(--color-text-muted)]">{targetReason}</p>
      )}
    </button>
  );
}

