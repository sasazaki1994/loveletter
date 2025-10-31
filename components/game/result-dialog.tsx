'use client';

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGameContext } from "@/components/game/game-provider";

export function ResultDialog() {
  const { state, refetch } = useGameContext();
  const router = useRouter();

  const open = Boolean(state?.result);
  const winners = useMemo(() => {
    if (!state?.players) return [];
    const winnerIds = state.result?.winnerIds ?? [];
    return state.players.filter((player) => winnerIds.includes(player.id));
  }, [state]);

  const placements = useMemo(() => {
    if (!state?.players || !state?.logs) return [];

    const winnerSet = new Set(state.result?.winnerIds ?? []);
    const playerMap = new Map(state.players.map((p) => [p.id, p]));

    // ログから脱落順を判定
    const eliminationOrder: string[] = [];
    const processedIds = new Set<string>();

    // 時系列順（古い順）でログを処理
    const sortedLogs = [...state.logs].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const log of sortedLogs) {
      // 「脱落しました」または「自滅しました」のメッセージを検出
      if (log.message.includes('脱落しました') || log.message.includes('自滅しました')) {
        // メッセージからプレイヤー名を抽出してプレイヤーIDに変換
        for (const player of state.players) {
          if (log.message.includes(player.nickname) && !processedIds.has(player.id)) {
            // 勝者でない場合のみ追加
            if (!winnerSet.has(player.id)) {
              eliminationOrder.push(player.id);
              processedIds.add(player.id);
            }
          }
        }
        // actorIdが脱落したプレイヤーの場合（自滅など）
        if (log.actorId && !processedIds.has(log.actorId) && !winnerSet.has(log.actorId)) {
          const player = playerMap.get(log.actorId);
          if (player && player.isEliminated) {
            eliminationOrder.push(log.actorId);
            processedIds.add(log.actorId);
          }
        }
      }
    }

    // ログに記録されていない脱落プレイヤーを追加（念のため）
    const loggedEliminations = new Set(eliminationOrder);
    for (const player of state.players) {
      if (player.isEliminated && !winnerSet.has(player.id) && !loggedEliminations.has(player.id)) {
        eliminationOrder.push(player.id);
      }
    }

    // 勝者を1位として配置
    const winners = state.players.filter((p) => winnerSet.has(p.id));
    
    // 脱落順で順位付け（早い順から下位へ）
    // 1位: 勝者
    // 2位: 生存者（脱落していない非勝者） - 通常は存在しないが念のため
    // 3位以降: 脱落した人（早い脱落が下位）
    const placements: Array<{ place: number; players: typeof state.players }> = [];
    
    let currentPlace = 1;
    
    // 1位: 勝者
    if (winners.length > 0) {
      placements.push({ place: currentPlace, players: winners });
      currentPlace += 1;
    }

    // 2位: まだ脱落していない非勝者（生存者）
    const survivors = state.players.filter(
      (p) => !p.isEliminated && !winnerSet.has(p.id)
    );
    if (survivors.length > 0) {
      placements.push({ place: currentPlace, players: survivors });
      currentPlace += 1;
    }

    // 3位以降: 脱落したプレイヤーを脱落順（早い順）で配置
    for (const eliminatedId of eliminationOrder) {
      const player = playerMap.get(eliminatedId);
      if (player) {
        placements.push({ 
          place: currentPlace, 
          players: [player] 
        });
        currentPlace += 1;
      }
    }

    return placements;
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
                : "次のラウンドが開始されるまでお待ちください。"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-[var(--color-text-muted)]">
          {placements.length > 0 ? (
            <div>
              <h4 className="font-heading text-xl text-[var(--color-accent-light)]">順位</h4>
              <ol className="mt-3 space-y-3 text-base">
                {placements.map((entry) => (
                  <li key={entry.place}>
                    <div className="font-semibold text-[var(--color-accent-light)]">
                      {entry.place}位
                    </div>
                    <ul className="mt-1 space-y-1 text-[var(--color-text-muted)]">
                      {entry.players.map((player) => (
                        <li key={player.id}>{player.nickname}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p>今回のラウンドは引き分けでした。</p>
          )}

          <div className="grid gap-2">
            <Button fullWidth onClick={() => refetch()}>
              最新状況を確認
            </Button>
            <Button variant="outline" fullWidth onClick={() => router.push("/")}>
              ホームに戻る
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

