'use client';

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Crown, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGameContext } from "@/components/game/game-provider";
import { CARD_DEFINITIONS } from "@/lib/game/cards";
import { cn } from "@/lib/utils";

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
    const timer = setTimeout(() => {
        setOpen(true);
    }, 1000);
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
  }, [state]);

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
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-md">
        <div className="relative overflow-hidden rounded-3xl border border-[rgba(215,178,110,0.4)] bg-[rgba(12,28,26,0.95)] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* Decorative background elements */}
          <div className="pointer-events-none absolute inset-0 bg-app-pattern opacity-30" />
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 bg-[radial-gradient(circle,rgba(215,178,110,0.15)_0%,transparent_70%)] blur-2xl" />
          
          <DialogHeader className="relative z-10 mb-6 text-center">
            <DialogTitle className="font-heading text-4xl text-[var(--color-accent-light)] text-shadow-gold">
              {state?.result?.reason === "deck_exhausted" ? "Round Finished" : "Round Finished"}
            </DialogTitle>
            <DialogDescription className="text-[var(--color-text-muted)]">
              {state?.result?.reason === "deck_exhausted"
                ? "山札が尽きました。手札の強さで勝敗を決します。"
                : state?.result?.reason === "elimination"
                  ? "生存者が1名となり、ラウンドが終了しました。"
                  : "ラウンドが終了しました。"}
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 space-y-6">
            {placements.length > 0 ? (
              <div className="space-y-4">
                <ol className="space-y-3">
                  {placements.map((entry, index) => (
                    <li 
                      key={`place-${entry.place}-${index}`}
                      className="relative"
                    >
                      {entry.place === 1 && (
                         <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[rgba(215,178,110,0.5)] via-transparent to-[rgba(215,178,110,0.5)] opacity-30 blur-sm" />
                      )}
                      
                      <div className={cn(
                        "relative flex flex-col gap-2 rounded-xl border p-3 transition-all",
                        entry.place === 1
                          ? "border-[rgba(215,178,110,0.6)] bg-[rgba(30,50,45,0.8)] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
                          : "border-[rgba(255,255,255,0.08)] bg-[rgba(20,35,33,0.4)]"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-xl font-bold",
                            entry.place === 1
                              ? "bg-gradient-to-br from-[var(--color-accent)] to-[#b08d55] text-[#0f2d2a] shadow-lg"
                              : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-muted)]"
                          )}>
                            {entry.place === 1 ? <Crown className="h-5 w-5" /> : entry.place}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "font-heading text-lg",
                                entry.place === 1 ? "text-[var(--color-accent-light)]" : "text-[var(--color-text-muted)]"
                              )}>
                                {entry.place === 1 ? "Winner" : `${entry.place}th Place`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <ul className="space-y-2 pl-[3.25rem]">
                          {entry.players.map((player) => (
                            <li 
                              key={player.id} 
                              className="flex items-center justify-between rounded-lg bg-[rgba(0,0,0,0.2)] px-3 py-2 text-sm"
                            >
                              <span className={cn(entry.place === 1 ? "font-bold text-[var(--color-text)]" : "text-[var(--color-text-muted)]")}>
                                {player.nickname}
                              </span>
                              {state?.result?.finalHands && state.result.finalHands[player.id] && (
                                <div className="flex items-center gap-2 text-xs text-[var(--color-accent-light)]">
                                  {state.result.finalHands[player.id].map((cardId) => {
                                    const def = CARD_DEFINITIONS[cardId as keyof typeof CARD_DEFINITIONS];
                                    return def ? (
                                      <span key={cardId} className="flex items-center gap-1 rounded bg-[rgba(215,178,110,0.15)] px-1.5 py-0.5">
                                        <span className="font-heading font-bold">{def.rank}</span>
                                        <span className="truncate max-w-[4rem]">{def.name}</span>
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-center text-[var(--color-text-muted)]">今回のラウンドは引き分けでした。</p>
            )}

            <div className="grid gap-3 pt-2">
              <Button 
                fullWidth 
                onClick={() => refetch()}
                className="h-11 text-base shadow-[0_0_20px_rgba(215,178,110,0.25)]"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                最新状況を確認
              </Button>
              <Button 
                variant="ghost" 
                fullWidth 
                onClick={() => router.push("/")}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                ホームに戻る
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
