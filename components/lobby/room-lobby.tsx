'use client';

import { useEffect, useMemo, useState } from "react";
import { Crown, DoorOpen, Loader2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePlayerSession } from "@/lib/client/session";

interface RoomInfo {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  playerCount: number;
}

export function RoomLobby() {
  const router = useRouter();
  const { session, setSession } = usePlayerSession();

  const [nickname, setNickname] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchRooms = async () => {
      try {
        setRoomsLoading(true);
        const response = await fetch("/api/room/list", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("ルーム情報を取得できませんでした");
        }
        const payload = (await response.json()) as { rooms: RoomInfo[] };
        if (mounted) setRooms(payload.rooms ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setRoomsLoading(false);
      }
    };

    fetchRooms().catch(console.error);
    const timer = setInterval(() => fetchRooms().catch(console.error), 7000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

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

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim() || !joinNickname.trim()) {
      setJoinError("ルームIDとニックネームを入力してください");
      return;
    }
    setJoinLoading(true);
    setJoinError(null);
    try {
      const response = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: joinRoomId.trim(),
          nickname: joinNickname.trim(),
          role: "observer",
        }),
      });
      const payload = (await response.json()) as { roomId: string; playerId: string };
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "参加に失敗しました");
      }

      setSession({
        roomId: payload.roomId,
        playerId: payload.playerId,
        nickname: joinNickname.trim(),
      });
      router.push(`/game/${payload.roomId}`);
    } catch (error) {
      setJoinError((error as Error).message ?? "ルーム参加に失敗しました");
    } finally {
      setJoinLoading(false);
    }
  };

  const statusLabel = useMemo(
    () =>
      new Map([
        ["waiting", "待機中"],
        ["active", "対戦中"],
        ["finished", "終了"],
      ]),
    [],
  );

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
          高級感あるフェルト卓で繰り広げられるミニマルな駆け引き。ニックネームを入力して即座にBot対戦を開始、または既存ルームを観戦できます。
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
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
                    続きを観戦/再開
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="noise-overlay" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-5 w-5 text-[var(--color-accent-light)]" />
              ルームに参加 / 観戦
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  ルームID
                </label>
                <Input
                  value={joinRoomId}
                  onChange={(event) => setJoinRoomId(event.target.value)}
                  placeholder="UUID形式"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  ニックネーム
                </label>
                <Input
                  value={joinNickname}
                  onChange={(event) => setJoinNickname(event.target.value)}
                  placeholder="観戦者名"
                />
              </div>
            </div>
            {joinError && <p className="text-sm text-[var(--color-warn-light)]">{joinError}</p>}
            <Button onClick={handleJoinRoom} disabled={joinLoading} className="w-full" variant="outline">
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "観戦者として参加"}
            </Button>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-heading text-lg text-[var(--color-accent-light)]">
                公開ルーム一覧
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                最新12件を表示しています。観戦時は read-only で進行に追従します。
              </p>
            </div>
            <div className="space-y-3 text-sm">
              {roomsLoading && (
                <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> 更新中...
                </div>
              )}
              {!roomsLoading && rooms.length === 0 && (
                <p className="text-[var(--color-text-muted)]">現在アクティブなルームはありません。</p>
              )}
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgba(215,178,110,0.2)] bg-[rgba(12,32,30,0.6)] px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[var(--color-text-muted)]">
                      {room.id}
                    </span>
                    <span className="text-sm text-[var(--color-accent-light)]">
                      {statusLabel.get(room.status) ?? room.status}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      プレイヤー: {room.playerCount}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-8 gap-2 px-3 text-xs"
                    onClick={() => setJoinRoomId(room.id)}
                  >
                    <DoorOpen className="h-4 w-4" /> ルームIDをセット
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

