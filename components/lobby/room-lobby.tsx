'use client';

import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlayerSession } from "@/lib/client/session";

export function RoomLobby() {
  const router = useRouter();
  const { session, setSession } = usePlayerSession();

  const [nickname, setNickname] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setCreateError("ニックネームを入力してください");
      return;
    }
    setCreateError(null);
    setCreateLoading(true);
    try {
      const response = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const payload = (await response.json()) as {
        roomId?: string;
        playerId?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        const errorMsg = payload.error ?? "作成に失敗しました";
        const detailMsg = payload.detail ? ` (${payload.detail})` : "";
        throw new Error(errorMsg + detailMsg);
      }
      
      if (!payload.roomId || !payload.playerId) {
        throw new Error("無効なレスポンスです。");
      }

      setSession({
        roomId: payload.roomId,
        playerId: payload.playerId,
        nickname: nickname.trim(),
      });
      router.push(`/game/${payload.roomId}`);
    } catch (error) {
      setCreateError((error as Error).message ?? "ルーム作成に失敗しました");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <span className="font-heading text-sm uppercase tracking-[0.6em] text-[rgba(215,178,110,0.75)]">
          Love Letter Inspired
        </span>
        <h1 className="font-heading text-5xl text-shadow-gold">
          Love Letter Reverie
        </h1>
        <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
          高級感あるフェルト卓で繰り広げられるミニマルな駆け引き。ニックネームを入力して即座にBot対戦を開始できます。
        </p>
      </header>

      <div className="grid gap-6">
        <Card className="relative overflow-hidden">
          <div className="noise-overlay" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Crown className="h-5 w-5 text-[var(--color-accent-light)]" />
              新しいラウンドを開く
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                ニックネーム
              </label>
              <Input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="例: Velvet Strategist"
                maxLength={24}
              />
              {createError && (
                <p className="text-sm text-[var(--color-warn-light)]">{createError}</p>
              )}
            </div>
            <Button onClick={handleCreateRoom} disabled={createLoading} className="w-full">
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bot対戦を開始"}
            </Button>
            {session && (
              <div className="rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(13,32,30,0.7)] p-4 text-sm text-[var(--color-text-muted)]">
                <p>既存のセッションがあります。</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[var(--color-accent-light)]">
                  <span>Room: {session.roomId}</span>
                  <span>Player: {session.nickname}</span>
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => router.push(`/game/${session.roomId}`)}
                  >
                  続きを再開
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

