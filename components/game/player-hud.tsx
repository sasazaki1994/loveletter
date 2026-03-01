import { Badge } from "@/components/ui/badge";
import { CardSymbol } from "@/components/icons/card-symbol";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import type { PlayerId, PlayerPublicState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Ban, Shield } from "lucide-react";

interface PlayerHUDProps {
  player: PlayerPublicState;
  isSelf: boolean;
  isActive: boolean;
  onSelectTarget?: (playerId: PlayerId) => void;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  targetReason?: string;
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
}: PlayerHUDProps) {
  const topDiscard = player.discardPile[player.discardPile.length - 1];
  const topCardDefinition = topDiscard ? CARD_DEFINITIONS[topDiscard] : undefined;

  const isDisabled = !selectable || isSelf || player.isEliminated || disabled;
  const isTargetable = selectable && !isDisabled;

  return (
    <button
      type="button"
      onClick={isTargetable ? () => onSelectTarget?.(player.id) : undefined}
      className={cn(
        "group relative flex w-[17rem] max-w-full flex-col gap-2 rounded-xl border px-3.5 py-3 text-left backdrop-blur-sm transition-all duration-200",
        "bg-[rgba(12,32,30,0.65)]/90 border-[rgba(215,178,110,0.25)]",

        // Targetable
        isTargetable &&
          "cursor-pointer hover:border-[rgba(215,178,110,0.65)] hover:bg-[rgba(22,45,41,0.92)] hover:shadow-[0_8px_18px_rgba(0,0,0,0.22)]",

        // Selected
        selected &&
          "z-10 border-[rgba(215,178,110,0.8)] bg-[rgba(26,52,46,0.96)] shadow-[0_0_0_1px_rgba(215,178,110,0.25),0_10px_20px_rgba(0,0,0,0.22)]",

        // Active Turn
        isActive &&
          !selected &&
          "border-[rgba(215,178,110,0.55)] ring-1 ring-[rgba(215,178,110,0.5)] ring-offset-2 ring-offset-[rgba(10,20,18,0.8)]",

        // Eliminated
        player.isEliminated && "border-dashed bg-black/40 opacity-50 grayscale",

        // Disabled but in selection mode (e.g. Shielded)
        selectable &&
          isDisabled &&
          !isSelf &&
          !player.isEliminated &&
          "cursor-not-allowed border-[rgba(247,184,184,0.28)] bg-[rgba(60,20,20,0.2)] opacity-80 grayscale-[0.25]"
      )}
      disabled={isDisabled}
      aria-pressed={selected}
    >
      {/* Floating Shield Icon */}
      {player.shield && !player.isEliminated && (
        <div className={cn(
          "absolute -right-2.5 -top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--color-surface)] shadow-lg",
          isTargetable ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
          selectable && isDisabled
            ? "border-[var(--color-warn-light)] bg-[rgba(60,20,20,0.9)] text-[var(--color-warn-light)]"
            : "text-[var(--color-accent)]"
        )}>
          <Shield className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Active Indicator Line */}
      {isActive && !player.isEliminated && (
        <div className="absolute bottom-4 left-0 top-4 w-[3px] rounded-r-full bg-[var(--color-accent)] shadow-[0_0_8px_rgba(215,178,110,0.5)]" />
      )}

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className={cn("font-heading text-lg tracking-wide", player.isEliminated ? "text-[var(--color-text-muted)] line-through decoration-[rgba(255,255,255,0.3)]" : "text-[var(--color-accent-light)]")}>
              {player.nickname}
            </p>
            {player.isBot && <Badge variant="outline" className="text-[9px] h-4 px-1 border-[rgba(255,255,255,0.2)] text-[var(--color-text-muted)]">BOT</Badge>}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] opacity-70 font-mono tracking-wide">{player.seat + 1}番席</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {player.isEliminated && <Badge variant="danger" className="text-[10px] h-5 shadow-sm">脱落</Badge>}
          {isActive && <Badge variant="default" className="text-[10px] h-5 shadow-[0_0_10px_rgba(215,178,110,0.35)]">手番</Badge>}
        </div>
      </div>

      {topCardDefinition ? (
        <div className={cn(
          "mt-2 ml-2 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs transition-colors",
          "border-[rgba(215,178,110,0.15)] bg-[rgba(0,0,0,0.3)] shadow-inner",
          player.isEliminated && "opacity-50"
        )}>
          <span className="rounded border border-[rgba(215,178,110,0.35)] bg-[rgba(20,48,45,0.8)] px-1.5 py-0.5 font-heading text-sm font-bold text-[var(--color-accent-light)] min-w-[1.5rem] text-center">
            {topCardDefinition.rank}
          </span>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <CardSymbol icon={topCardDefinition.icon} size={14} className="text-[var(--color-accent-light)] opacity-80" />
            <span className="truncate max-w-[8rem] font-medium">{topCardDefinition.name}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 ml-2 flex min-h-[2.8rem] items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.15)] text-[10px] text-[var(--color-text-muted)] opacity-60">
          捨て札なし
        </div>
      )}

      {selectable && isDisabled && targetReason && !player.isEliminated && !isSelf && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[rgba(60,20,20,0.6)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-warn-light)] animate-in fade-in slide-in-from-top-1">
           <Ban className="h-3 w-3 shrink-0" />
           <span>{targetReason}</span>
        </div>
      )}
      
      {isTargetable && (
        <div className="absolute inset-x-0 -bottom-8 text-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none lg:block hidden">
          <span className="text-[10px] text-[var(--color-accent-light)] bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm shadow-md border border-[rgba(215,178,110,0.3)]">
            選択する
          </span>
        </div>
      )}
    </button>
  );
}
