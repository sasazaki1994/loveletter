'use client';

import { useMemo } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGameContext } from "@/components/game/game-provider";

export function ResultDialog() {
  const { state, refetch } = useGameContext();

  const open = Boolean(state?.result);
  const winners = useMemo(() => {
    if (!state?.players) return [];
    const winnerIds = state.result?.winnerIds ?? [];
    return state.players.filter((player) => winnerIds.includes(player.id));
  }, [state]);

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-3xl">ラウンド終了</DialogTitle>
          <DialogDescription>
            {state?.result?.reason === "deck_exhausted"
              ? "山札が尽きたため手札が高いプレイヤーが勝利しました。"
              : state?.result?.reason === "elimination"
                ? "最後の生存者が勝者となりました。"
                : "次のラウンド開始までは観戦状態です。"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-[var(--color-text-muted)]">
          {winners.length > 0 ? (
            <div>
              <h4 className="font-heading text-xl text-[var(--color-accent-light)]">勝者</h4>
              <ul className="mt-2 space-y-1">
                {winners.map((winner) => (
                  <li key={winner.id}>{winner.nickname}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>今回のラウンドは引き分けでした。</p>
          )}

          <Button className="w-full" onClick={() => refetch()}>
            最新状況を確認
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

