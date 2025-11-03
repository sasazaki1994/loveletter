'use client';

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGameContext } from "@/components/game/game-provider";
import { CARD_DEFINITIONS } from "@/lib/game/cards";

export function ResultDialog() {
  const { state, refetch } = useGameContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dismissedResultId, setDismissedResultId] = useState<string | null>(null);
  const [scheduledId, setScheduledId] = useState<string | null>(null);
  const [firstSeenAt, setFirstSeenAt] = useState<number | null>(null);

  useEffect(() => {
    if (!state?.result) {
      setOpen(false);
      setDismissedResultId(null);
      setScheduledId(null);
      setFirstSeenAt(null);
      return;
    }

    // 既に閉じたリザルトの場合は再表示しない
    const resultId = `${state.id}-${state.result.winnerIds.join(',')}-${state.result.reason}`;
    if (resultId === dismissedResultId) {
      return;
    }

    // 同一リザルトに対して重複スケジュールを避ける
    if (scheduledId === resultId) {
      return;
    }
    setScheduledId(resultId);
    setFirstSeenAt(Date.now());

    // deck_exhausted は手札公開完了イベントで即時表示、保険でフォールバックタイマー
    if (state.result.reason === "deck_exhausted") {
      let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        setOpen(true);
      }, 5000);

      const onRevealComplete = (e: Event) => {
        try {
          const detail = (e as CustomEvent<{ gameId?: string }>).detail;
          if (!detail || detail.gameId !== state.id) return;
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          setOpen(true);
        } catch {
          // ignore
        }
      };

      window.addEventListener("hand_reveal_complete", onRevealComplete as EventListener);
      return () => {
        window.removeEventListener("hand_reveal_complete", onRevealComplete as EventListener);
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }

    // それ以外は軽い遅延後に表示
    const timer = setTimeout(() => setOpen(true), 1000);
    return () => clearTimeout(timer);
  }, [state?.result, state?.id, dismissedResultId, scheduledId]);

  // 最終フォールバック: 結果検出から一定時間たっても開かない場合は強制的に開く
  useEffect(() => {
    if (!state?.result || open || !firstSeenAt) return;
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      const elapsed = Date.now() - firstSeenAt;
      if (elapsed >= 8000) {
        setOpen(true);
        if (timeoutId) clearTimeout(timeoutId);
        if (rafId) cancelAnimationFrame(rafId);
        return;
      }
      rafId = requestAnimationFrame(check);
    };

    // 8秒のハードタイマーもセット
    timeoutId = setTimeout(() => {
      setOpen(true);
    }, 8500);

    rafId = requestAnimationFrame(check);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [firstSeenAt, open, state?.result]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && state?.result) {
      // ダイアログを閉じた時、このリザルトIDを記憶
      const resultId = `${state.id}-${state.result.winnerIds.join(',')}-${state.result.reason}`;
      setDismissedResultId(resultId);
    }
  };
  const winners = useMemo(() => {
    if (!state?.players) return [];
    const winnerIds = state.result?.winnerIds ?? [];
    return state.players.filter((player) => winnerIds.includes(player.id));
  }, [state?.players, state?.result?.winnerIds]);

  const placements = useMemo(() => {
    if (!state?.players || !state?.logs) return [];

    const winnerSet = new Set(state.result?.winnerIds ?? []);
    const playerMap = new Map(state.players.map((p) => [p.id, p]));
    const finalHands: Record<string, string[]> | undefined = (state.result as any)?.finalHands;

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
        // actorIdを優先的に使用（より正確）
        if (log.actorId && !processedIds.has(log.actorId) && !winnerSet.has(log.actorId)) {
          const player = playerMap.get(log.actorId);
          if (player && player.isEliminated) {
            eliminationOrder.push(log.actorId);
            processedIds.add(log.actorId);
            continue; // actorIdで処理できた場合は次のログへ
          }
        }
        
        // actorIdがない場合のみメッセージからプレイヤー名を抽出
        // より正確にマッチングするため、「が」や「は」の直前の名前を検出
        for (const player of state.players) {
          const patterns = [
            `${player.nickname}が脱落`,
            `${player.nickname}は脱落`,
            `${player.nickname}が自滅`,
            `${player.nickname}は自滅`
          ];
          const matched = patterns.some(pattern => log.message.includes(pattern));
          
          if (matched && !processedIds.has(player.id) && !winnerSet.has(player.id)) {
            eliminationOrder.push(player.id);
            processedIds.add(player.id);
            break; // 1つのログで1人のプレイヤーのみ処理
          }
        }
      }
    }

    // ログに記録されていない脱落プレイヤーを追加（念のため）
    // processedIdsを使用して重複を防ぐ
    const unloggedEliminated = state.players.filter(
      (p) => p.isEliminated && !winnerSet.has(p.id) && !processedIds.has(p.id)
    );
    // seat順でソートしてから追加（同位を防ぐため）
    unloggedEliminated.sort((a, b) => a.seat - b.seat);
    for (const player of unloggedEliminated) {
      eliminationOrder.push(player.id);
      processedIds.add(player.id);
    }

    // すべての脱落プレイヤーIDのセットを作成（重複チェック用）
    const allEliminatedIds = new Set(eliminationOrder);

    // 勝者を1位として配置
    const winners = state.players.filter((p) => winnerSet.has(p.id));
    
    // 脱落順で順位付け（早い順から下位へ）
    // 1位: 勝者（seat順で順位付け）
    // 2位以降: 生存者（脱落していない非勝者） - 通常は存在しないが念のため
    // その後: 脱落した人（早い脱落が下位）
    const placements: Array<{ place: number; players: typeof state.players }> = [];
    
    let currentPlace = 1;
    
    // 1位: 勝者（seat順で個別に順位付けして同位を防ぐ）
    if (winners.length > 0) {
      const sortedWinners = [...winners].sort((a, b) => a.seat - b.seat);
      for (const winner of sortedWinners) {
        placements.push({ place: currentPlace, players: [winner] });
        currentPlace += 1;
      }
    }

    // 生存者（脱落していない非勝者）を順位付け
    const survivors = state.players.filter(
      (p) => !p.isEliminated && !winnerSet.has(p.id) && !allEliminatedIds.has(p.id)
    );
    if (survivors.length > 0) {
      // 山札尽きの場合はfinalHandsのランクで降順ソート、それ以外はseat順
      const reason = state.result?.reason;
      const sortedSurvivors = [...survivors].sort((a, b) => {
        if (reason === "deck_exhausted" && finalHands) {
          const aCards = finalHands[a.id] ?? [];
          const bCards = finalHands[b.id] ?? [];
          const aRank = aCards.length > 0 ? CARD_DEFINITIONS[aCards[0] as keyof typeof CARD_DEFINITIONS]?.rank ?? 0 : 0;
          const bRank = bCards.length > 0 ? CARD_DEFINITIONS[bCards[0] as keyof typeof CARD_DEFINITIONS]?.rank ?? 0 : 0;
          if (bRank !== aRank) return bRank - aRank; // 高ランクを先に
          return a.seat - b.seat;
        }
        return a.seat - b.seat;
      });
      for (const survivor of sortedSurvivors) {
        placements.push({ place: currentPlace, players: [survivor] });
        currentPlace += 1;
      }
    }

    // 脱落したプレイヤーを脱落順（早い順）で配置
    // 重複を防ぐためにprocessedIdsを使用
    const processedEliminatedIds = new Set<string>();
    for (const eliminatedId of eliminationOrder) {
      // 既に処理済みまたは生存者リストに含まれている場合はスキップ
      if (processedEliminatedIds.has(eliminatedId)) continue;
      
      const player = playerMap.get(eliminatedId);
      if (player && player.isEliminated && !winnerSet.has(player.id)) {
        placements.push({ 
          place: currentPlace, 
          players: [player] 
        });
        processedEliminatedIds.add(eliminatedId);
        currentPlace += 1;
      }
    }

    return placements;
  }, [state?.players, state?.logs, state?.result?.winnerIds]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                {placements.map((entry, index) => (
                  <li key={`place-${entry.place}-${index}`}>
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

