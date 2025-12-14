'use client';

import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { GameBoard } from "@/components/game/game-board";
import { GameEffectsProvider } from "@/components/game/game-effects-provider";
import { GameProvider } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerSession } from "@/lib/client/session";

interface GameClientProps {
  roomId: string;
}

export function GameClient({ roomId }: GameClientProps) {
  const { session, setSession } = usePlayerSession();
  const router = useRouter();
  const [hasGame, setHasGame] = useState<boolean>(false);

  const activeSession = useMemo(() => {
    if (session?.roomId === roomId) {
      return session;
    }
    return null;
  }, [roomId, session]);

  // ゲーム開始前（waiting）はゲーム画面側で参加/開始まで完結させるため、
  // 「セッション未検出」オーバーレイはゲーム開始後のみ表示する。
  useEffect(() => {
    if (hasGame) return;
    let timer: number | null = null;
    const check = async () => {
      try {
        const res = await fetch(`/api/game/state?roomId=${encodeURIComponent(roomId)}`, {
          method: "GET",
          headers: { "Cache-Control": "no-store" },
        });
        const json = (await res.json()) as { state?: unknown };
        const next = Boolean(json?.state);
        setHasGame(next);
        if (next && timer) {
          window.clearInterval(timer);
          timer = null;
        }
      } catch {
        // 失敗時は従来通りオーバーレイを出しやすい方へ（hasGame=true扱い）にはしない
        setHasGame(false);
      }
    };
    void check();
    timer = window.setInterval(check, 2000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [roomId, hasGame]);

  const showSessionNotice = !activeSession && hasGame;

  return (
    <GameProvider roomId={roomId} playerId={activeSession?.playerId}>
      <GameEffectsProvider>
        {showSessionNotice && (
          <div className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4 sm:top-6">
            <Card className="pointer-events-auto w-full max-w-2xl shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl">セッション未検出</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-[var(--color-text-muted)]">
                <p>
                  このルームに紐づくプレイヤーセッションが見つかりませんでした。現在は読み取り専用モードで表示しています。
                  操作するにはロビーに戻ってセッションを作成し直してください。
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => router.push(`/?join=${encodeURIComponent(roomId)}&mode=multi`)}
                    className="sm:flex-1"
                  >
                    ロビーに戻って参加する
                  </Button>
                  <Button variant="outline" onClick={() => router.refresh()} className="sm:flex-1">
                    再読み込み
                  </Button>
                </div>
                {session && session.roomId !== roomId && (
                  <div className="space-y-2 text-left">
                    <p className="text-xs text-[var(--color-text-muted)]">他ルームのセッションが記録されています:</p>
                    <div className="flex items-center justify-between rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.7)] px-3 py-2 text-xs">
                      <span>Room {session.roomId}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          className="h-8 gap-2 px-3 text-xs"
                          onClick={() => router.push(`/game/${session.roomId}`)}
                        >
                          続きを再開
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 gap-2 px-3 text-xs"
                          onClick={() => setSession(null)}
                        >
                          <LogOut className="h-4 w-4" /> セッションをクリア
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        <GameBoard />
      </GameEffectsProvider>
    </GameProvider>
  );
}

