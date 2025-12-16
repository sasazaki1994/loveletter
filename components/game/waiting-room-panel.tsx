'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoomIdDisplay } from "@/components/ui/room-id-display";
import { RoomQrShare } from "@/components/ui/room-qr-share";
import { usePlayerSession } from "@/lib/client/session";

type RoomStatePayload = {
  id: string;
  shortId: string;
  status: "waiting" | "active" | "finished";
  hostPlayerId: string | null;
  playerCount: number;
  players: Array<{ id: string; nickname: string; seat: number; isBot: boolean; lastActiveAt: string }>;
  hasGame: boolean;
  gameId: string | null;
};

export function WaitingRoomPanel({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { session, setSession } = usePlayerSession();
  const [room, setRoom] = useState<RoomStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);

  const inRoomSession = session?.roomId === roomId;
  const hasOtherSession = Boolean(session && session.roomId !== roomId);

  const isHost = useMemo(() => {
    if (!inRoomSession) return false;
    if (!room?.hostPlayerId) return false;
    return session?.playerId === room.hostPlayerId;
  }, [inRoomSession, room?.hostPlayerId, session?.playerId]);

  const canStart = Boolean(
    room &&
      inRoomSession &&
      isHost &&
      room.status === "waiting" &&
      room.playerCount >= 2,
  );

  const fetchRoomState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/room/state?roomId=${encodeURIComponent(roomId)}`, {
        method: "GET",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json()) as Partial<RoomStatePayload> & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRoom(json as RoomStatePayload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // 初回 + ポーリング（待機中は参加人数が変わる）
  useEffect(() => {
    let timer: number | null = null;
    const run = async () => {
      await fetchRoomState();
      timer = window.setInterval(fetchRoomState, 2000);
    };
    run();
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [fetchRoomState]);

  const handleJoin = useCallback(async () => {
    if (joining) return;
    if (!nickname.trim()) {
      setError("ニックネームを入力してください");
      return;
    }
    if (hasOtherSession) {
      setError("別ルームのセッションがあります。「セッションを破棄」してから参加してください。");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, nickname: nickname.trim() }),
      });
      const json = (await res.json()) as { roomId?: string; playerId?: string; shortId?: string; error?: string; detail?: string };
      if (!res.ok || !json.roomId || !json.playerId) {
        const detail = json.detail ? ` (${json.detail})` : "";
        throw new Error((json.error ?? "参加に失敗しました") + detail);
      }
      setSession({ roomId: json.roomId, playerId: json.playerId, nickname: nickname.trim(), shortId: json.shortId });
      setError(null);
      // 待機UIはそのまま、ゲーム開始後に自動遷移（stateが生える）
    } catch (e) {
      setError(e instanceof Error ? e.message : "参加に失敗しました");
    } finally {
      setJoining(false);
    }
  }, [hasOtherSession, joining, nickname, roomId, setSession]);

  const handleStart = useCallback(async () => {
    if (!canStart || starting) return;
    setStarting(true);
    try {
      if (!session?.playerId) {
        throw new Error("セッションが見つかりません。");
      }
      const res = await fetch("/api/room/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Player-Id": session.playerId,
        },
        body: JSON.stringify({ roomId }),
      });
      const json = (await res.json()) as { gameId?: string; error?: string; detail?: string };
      if (!res.ok) {
        const detail = (json as any).detail ? ` (${(json as any).detail})` : "";
        throw new Error((json.error ?? "開始に失敗しました") + detail);
      }
      setError(null);
      // GameProvider(SSE)がstateを拾うまで、軽くリフレッシュして加速
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "開始に失敗しました");
    } finally {
      setStarting(false);
    }
  }, [canStart, roomId, router, session?.playerId, starting]);

  const title = room?.status === "active" ? "ゲーム進行中" : room?.status === "finished" ? "ゲーム終了" : "ルーム待機中";

  const shareId = room?.shortId ?? roomId;

  return (
    <div className="grid h-screen w-full place-items-center overflow-hidden px-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Users className="h-6 w-6 text-[var(--color-accent-light)]" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-[var(--color-text-muted)]">
            {room?.status === "waiting"
              ? "参加人数が揃ったら、ホストがこの画面からゲームを開始できます。"
              : room?.status === "active"
                ? "このルームは進行中です。プレイヤーとしての参加はできません（観戦モード）。"
                : "このルームは終了しています。"}
          </p>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_auto] lg:items-start">
            <RoomIdDisplay roomId={shareId} />
            <RoomQrShare roomId={shareId} compact className="lg:justify-self-end" />
          </div>

          <div className="rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.6)] px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--color-text-muted)]">参加人数</span>
              <span className="font-mono text-[var(--color-accent-light)]">
                {room ? `${room.playerCount} / 4` : "-- / 4"}
              </span>
            </div>
            <div className="mt-3 grid max-h-[12rem] gap-2 overflow-y-auto pr-1 scrollbar-thin">
              {(room?.players ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border border-[rgba(215,178,110,0.18)] bg-[rgba(9,22,20,0.65)] px-3 py-2 text-xs"
                >
                  <span className="truncate text-[var(--color-text)]">
                    {p.nickname} {p.isBot ? "(Bot)" : ""}
                  </span>
                  <span className="font-mono text-[var(--color-text-muted)]">Seat {p.seat + 1}</span>
                </div>
              ))}
              {room && room.players.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">まだ参加者がいません。</p>
              )}
            </div>
          </div>

          {!inRoomSession && room?.status === "waiting" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  ニックネーム
                </label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="例: Velvet Strategist"
                  maxLength={24}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleJoin} disabled={joining || loading} className="sm:flex-1">
                  {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "このルームに参加"}
                </Button>
                {hasOtherSession && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSession(null);
                      setError(null);
                    }}
                    className="sm:flex-1"
                  >
                    セッションを破棄
                  </Button>
                )}
              </div>
            </div>
          )}

          {inRoomSession && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(9,22,20,0.65)] px-4 py-3 text-sm">
                <span className="text-[var(--color-text-muted)]">あなた</span>
                <span className="font-mono text-[var(--color-accent-light)]">{session?.nickname}</span>
              </div>
              {room?.status === "waiting" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {isHost ? (
                    <Button onClick={handleStart} disabled={!canStart || starting || loading} className="sm:flex-1">
                      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "ゲーム開始（ホスト）"}
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled className="sm:flex-1">
                      ホストの開始待ち
                    </Button>
                  )}
                  <Button variant="outline" onClick={fetchRoomState} disabled={loading} className="sm:flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "更新"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              状態を確認中...
            </div>
          )}
          {error && <p className="text-sm text-[var(--color-warn-light)]">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}


