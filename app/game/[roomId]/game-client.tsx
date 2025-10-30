'use client';

import { useMemo } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { GameBoard } from "@/components/game/game-board";
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

  const activeSession = useMemo(() => {
    if (session?.roomId === roomId) {
      return session;
    }
    return null;
  }, [roomId, session]);

  if (!activeSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">セッション未検出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--color-text-muted)]">
            <p>このルームに紐づくプレイヤーセッションが見つかりません。ロビーに戻って新しいラウンドを開始してください。</p>
            <Button onClick={() => router.push("/")} className="w-full">
              ロビーに戻る
            </Button>
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
    );
  }

  return (
    <GameProvider roomId={roomId} playerId={activeSession.playerId}>
      <GameBoard />
    </GameProvider>
  );
}

