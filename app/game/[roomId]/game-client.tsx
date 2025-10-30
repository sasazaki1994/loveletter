'use client';

import { useMemo, useState } from "react";
import { Loader2, LogOut } from "lucide-react";

import { GameBoard } from "@/components/game/game-board";
import { GameProvider } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePlayerSession } from "@/lib/client/session";

interface GameClientProps {
  roomId: string;
}

export function GameClient({ roomId }: GameClientProps) {
  const { session, setSession } = usePlayerSession();
  const [nickname, setNickname] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSession = useMemo(() => {
    if (session?.roomId === roomId) {
      return session;
    }
    return null;
  }, [roomId, session]);

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError("ニックネームを入力してください");
      return;
    }
    setJoinLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, nickname: nickname.trim(), role: "observer" }),
      });
      const payload = (await response.json()) as { roomId: string; playerId: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "参加に失敗しました");
      }
      setSession({ roomId, playerId: payload.playerId, nickname: nickname.trim() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoinLoading(false);
    }
  };

  if (!activeSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">ルームに参加</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--color-text-muted)]">
            <p>
              このルームを観戦するにはニックネームを入力してください。既に参加済みのセッションがある場合はロビーから再度アクセスしてください。
            </p>
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">ニックネーム</label>
              <Input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} />
              {error && <p className="text-sm text-[var(--color-warn-light)]">{error}</p>}
            </div>
            <Button onClick={handleJoin} disabled={joinLoading} className="w-full">
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "観戦を開始"}
            </Button>
            {session && session.roomId !== roomId && (
              <>
                <Separator />
                <div className="space-y-2 text-left">
                  <p className="text-xs text-[var(--color-text-muted)]">他ルームのセッションが記録されています:</p>
                  <div className="flex items-center justify-between rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.7)] px-3 py-2 text-xs">
                    <span>Room {session.roomId}</span>
                    <Button
                      variant="ghost"
                      className="h-8 gap-2 px-3 text-xs"
                      onClick={() => setSession(null)}
                    >
                      <LogOut className="h-4 w-4" /> セッションをクリア
                    </Button>
                  </div>
                </div>
              </>
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

