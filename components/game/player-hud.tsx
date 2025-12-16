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
        "group relative flex w-[17rem] max-w-full flex-col gap-2 rounded-2xl border transition-all duration-300 px-4 py-3 text-left backdrop-blur-sm",
        "bg-[rgba(12,32,30,0.65)]/90 border-[rgba(215,178,110,0.25)]",
        
        // Targetable (Pulse animation)
        isTargetable && "animate-[pulse-gold_2s_ease-in-out_infinite] hover:bg-[rgba(25,50,45,0.9)] cursor-pointer hover:border-[var(--color-accent)] hover:shadow-[0_0_16px_rgba(215,178,110,0.15)]",
        
        // Selected
        selected && "border-[var(--color-accent)] bg-[rgba(20,45,40,0.95)] shadow-[0_0_24px_rgba(215,178,110,0.4)] scale-[1.02] z-10",
        
        // Active Turn
        isActive && !selected && "ring-1 ring-[var(--color-accent)] ring-offset-2 ring-offset-[rgba(10,20,18,0.8)] border-[rgba(215,178,110,0.6)] shadow-[0_0_15px_rgba(215,178,110,0.2)]",
        
        // Eliminated
        player.isEliminated && "opacity-50 grayscale border-dashed bg-black/40",
        
        // Disabled but in selection mode (e.g. Shielded)
        selectable && isDisabled && !isSelf && !player.isEliminated && "cursor-not-allowed opacity-80 grayscale-[0.3] border-[rgba(247,184,184,0.3)] bg-[rgba(60,20,20,0.2)]"
      )}
      disabled={isDisabled}
      aria-pressed={selected}
    >
      {/* Floating Shield Icon */}
      {player.shield && !player.isEliminated && (
        <div className={cn(
          "absolute -right-3 -top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--color-surface)] shadow-lg transition-transform duration-300",
          isTargetable ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
          selectable && isDisabled ? "scale-110 border-[var(--color-warn-light)] text-[var(--color-warn-light)] bg-[rgba(60,20,20,0.9)]" : "text-[var(--color-accent)]"
        )}>
          <Shield className="h-4 w-4" />
        </div>
      )}

      {/* Active Indicator Line */}
      {isActive && !player.isEliminated && (
        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-[var(--color-accent)] shadow-[0_0_8px_rgba(215,178,110,0.6)]" />
      )}

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className={cn("font-heading text-lg tracking-wide", player.isEliminated ? "text-[var(--color-text-muted)] line-through decoration-[rgba(255,255,255,0.3)]" : "text-[var(--color-accent-light)]")}>
              {player.nickname}
            </p>
            {player.isBot && <Badge variant="outline" className="text-[9px] h-4 px-1 border-[rgba(255,255,255,0.2)] text-[var(--color-text-muted)]">BOT</Badge>}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] opacity-70 font-mono tracking-wide">Seat {player.seat + 1}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {player.isEliminated && <Badge variant="danger" className="text-[10px] h-5 shadow-sm">Eliminated</Badge>}
          {isActive && <Badge variant="default" className="text-[10px] h-5 shadow-[0_0_10px_rgba(215,178,110,0.4)] animate-pulse">Turn</Badge>}
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
          No Discards
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
