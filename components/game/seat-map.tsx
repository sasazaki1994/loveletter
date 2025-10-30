import type { ClientGameState } from "@/lib/game/types";

interface SeatMapProps {
  state: ClientGameState | null;
  selfId?: string;
}

const POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 50, y: 85 },
  1: { x: 15, y: 50 },
  2: { x: 50, y: 15 },
  3: { x: 85, y: 50 },
};

export function SeatMap({ state, selfId }: SeatMapProps) {
  if (!state) return null;

  return (
    <div className="relative h-40 w-40 rounded-full border border-[rgba(215,178,110,0.2)] bg-[rgba(12,32,30,0.7)] shadow-inner">
      <div className="absolute inset-[18%] rounded-full border border-[rgba(215,178,110,0.2)]" />
      {state.players.map((player) => {
        const pos = POSITIONS[player.seat] ?? { x: 50, y: 50 };
        const isSelf = player.id === selfId;
        return (
          <div
            key={player.id}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
            className={`absolute flex h-9 min-w-[3rem] items-center justify-center rounded-full border px-3 text-xs ${isSelf ? "border-[var(--color-accent)] text-[var(--color-accent-light)]" : "border-[rgba(215,178,110,0.25)] text-[var(--color-text-muted)]"} ${player.isEliminated ? "opacity-60" : ""}`}
            aria-label={`${player.nickname} 座席 ${player.seat + 1}`}
          >
            {player.nickname}
          </div>
        );
      })}
    </div>
  );
}

