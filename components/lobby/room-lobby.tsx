'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Crown, Loader2, QrCode } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoomIdDisplay } from "@/components/ui/room-id-display";
import { RoomQrShare } from "@/components/ui/room-qr-share";
import { RoomQrScanner } from "@/components/ui/room-qr-scanner";
import { usePlayerSession } from "@/lib/client/session";
import { CARD_POOL } from "@/lib/game/cards";
import { isValidShortRoomId, normalizeRoomId } from "@/lib/utils/room-id";

export function RoomLobby() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, setSession } = usePlayerSession();

  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [nickname, setNickname] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Multiplayer UI state
  const [mpNickname, setMpNickname] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [rooms, setRooms] = useState<Array<{ id: string; shortId?: string; status: string; createdAt: string; playerCount: number }>>([]);
  const [showRoomCreatedDialog, setShowRoomCreatedDialog] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [showRooms, setShowRooms] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [variants, setVariants] = useState<Record<string, boolean>>({
    feint: false,
    insight: false,
    standoff: false,
    wager: false,
    ambush: false,
    marquise: false,
  });

  const sortedCards = useMemo(
    () => [...CARD_POOL].sort((a, b) => a.rank - b.rank),
    [],
  );

  const multiSectionRef = useRef<HTMLDivElement | null>(null);
  const mpNicknameInputRef = useRef<HTMLInputElement | null>(null);
  const joinRoomIdInputRef = useRef<HTMLInputElement | null>(null);
  const multiLandingHandledRef = useRef(false);

  // 招待リンク (?join=XXXX) からルームIDを埋め込む
  useEffect(() => {
    const invite = searchParams.get("join") ?? searchParams.get("room");
    const mode = searchParams.get("mode");
    if (invite) {
      const normalized = normalizeRoomId(invite);
      setJoinRoomId((prev) => (prev ? prev : normalized));
    }
    const shouldSurfaceMulti = invite || mode?.toLowerCase() === "multi";
    if (shouldSurfaceMulti && !multiLandingHandledRef.current) {
      multiLandingHandledRef.current = true;
      const scrollTarget = multiSectionRef.current;
      const focusTarget = mpNicknameInputRef.current ?? joinRoomIdInputRef.current;
      window.requestAnimationFrame(() => {
        scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
          focusTarget?.focus({ preventScroll: true });
        }, 120);
      });
    }
  }, [searchParams, setJoinRoomId]);

  // アカウント状態を取得（任意）
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { method: "GET", headers: { "Cache-Control": "no-store" } })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setUser((j as any)?.user ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleAuth = useCallback(async () => {
    if (authLoading) return;
    if (!authUsername.trim() || !authPassword) {
      setAuthError("ユーザー名とパスワードを入力してください。");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });
      const json = (await res.json()) as { user?: { id: string; username: string }; error?: string; detail?: string };
      if (!res.ok || !json.user) {
        const detail = json.detail ? ` (${json.detail})` : "";
        throw new Error((json.error ?? "認証に失敗しました") + detail);
      }
      setUser(json.user);
      setAuthPassword("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "認証に失敗しました");
    } finally {
      setAuthLoading(false);
    }
  }, [authLoading, authMode, authPassword, authUsername]);

  const handleLogout = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const extractRoomIdFromValue = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      const fromParams = url.searchParams.get("join") ?? url.searchParams.get("room");
      if (fromParams) return normalizeRoomId(fromParams);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const maybeId = pathParts[pathParts.length - 1];
      if (maybeId) {
        const normalized = normalizeRoomId(maybeId);
        if (isValidShortRoomId(normalized) || normalized.length >= 12) {
          return normalized;
        }
      }
    } catch {
      // not a URL; fall through to raw handling
    }
    const normalizedRaw = normalizeRoomId(trimmed);
    if (isValidShortRoomId(normalizedRaw) || normalizedRaw.length >= 12) {
      return normalizedRaw;
    }
    return null;
  }, []);

  const handleQrDetected = useCallback(
    (rawValue: string) => {
      const extracted = extractRoomIdFromValue(rawValue);
      if (!extracted) {
        setMpError("QRコードからルームIDを読み取れませんでした");
        return;
      }
      setJoinRoomId(extracted);
      setMpError(null);
      setQrScannerOpen(false);
      setTimeout(() => {
        joinRoomIdInputRef.current?.focus({ preventScroll: true });
      }, 80);
    },
    [extractRoomIdFromValue],
  );

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setCreateError("ニックネームを入力してください");
      return;
    }
    setCreateError(null);
    setCreateLoading(true);
    try {
      const enabledVariants = Object.keys(variants).filter((k) => variants[k]);
      const response = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), variants: enabledVariants }),
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

  const handleCreateHumanRoom = async () => {
    if (!mpNickname.trim()) {
      setMpError("ニックネームを入力してください");
      return;
    }
    if (session?.roomId) {
      setMpError(
        "既存のセッションがあります。同じブラウザで別プレイヤーとして参加するとホスト権限/認証が上書きされるため、別端末/シークレットで参加するか、下の「セッションを破棄」を押してから続行してください。",
      );
      return;
    }
    setMpError(null);
    setMpLoading(true);
    try {
      const response = await fetch("/api/room/create-human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: mpNickname.trim() }),
      });
      const payload = (await response.json()) as {
        roomId?: string;
        shortId?: string;
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
        nickname: mpNickname.trim(),
        shortId: payload.shortId,
      });
      // ルームIDを表示するダイアログを表示（短いIDを優先）
      setCreatedRoomId(payload.shortId ?? payload.roomId);
      setShowRoomCreatedDialog(true);
    } catch (error) {
      setMpError((error as Error).message ?? "ルーム作成に失敗しました");
    } finally {
      setMpLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!mpNickname.trim() || !joinRoomId.trim()) {
      setMpError("ルームIDとニックネームを入力してください");
      return;
    }
    if (session?.roomId) {
      setMpError(
        "既存のセッションがあります。同じブラウザで別プレイヤーとして参加するとホスト権限/認証が上書きされるため、別端末/シークレットで参加するか、下の「セッションを破棄」を押してから続行してください。",
      );
      return;
    }
    setMpError(null);
    setMpLoading(true);
    try {
      const response = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: joinRoomId.trim(), nickname: mpNickname.trim() }),
      });
      const payload = (await response.json()) as {
        roomId?: string;
        shortId?: string;
        playerId?: string;
        seat?: number;
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        const errorMsg = payload.error ?? "参加に失敗しました";
        const detailMsg = payload.detail ? ` (${payload.detail})` : "";
        throw new Error(errorMsg + detailMsg);
      }
      if (!payload.roomId || !payload.playerId) {
        throw new Error("無効なレスポンスです。");
      }
      setSession({
        roomId: payload.roomId,
        playerId: payload.playerId,
        nickname: mpNickname.trim(),
        shortId: payload.shortId,
      });
      router.push(`/game/${payload.roomId}`);
    } catch (error) {
      setMpError((error as Error).message ?? "参加に失敗しました");
    } finally {
      setMpLoading(false);
    }
  };

  const handleStartRoom = async () => {
    if (!session?.roomId || !session.playerId) return;
    setMpLoading(true);
    try {
      const response = await fetch("/api/room/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Player-Id": session.playerId,
        },
        body: JSON.stringify({ roomId: session.roomId }),
      });
      const payload = (await response.json()) as { gameId?: string; error?: string };
      if (!response.ok) {
        const errorMsg = payload.error ?? "開始に失敗しました";
        const detailMsg = (payload as any).detail ? ` (${(payload as any).detail})` : "";
        throw new Error(errorMsg + detailMsg);
      }
      router.push(`/game/${session.roomId}`);
    } catch (error) {
      setMpError((error as Error).message ?? "開始に失敗しました");
    } finally {
      setMpLoading(false);
    }
  };

  const handleLoadRooms = async () => {
    if (showRooms) {
      setShowRooms(false);
      return;
    }
    setRoomsLoading(true);
    try {
      const response = await fetch("/api/room/list");
      const data = await response.json();
      setRooms(Array.isArray(data) ? data : []);
      setShowRooms(true);
    } catch (error) {
      setMpError("ルーム一覧の取得に失敗しました");
    } finally {
      setRoomsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <span className="font-heading text-sm uppercase tracking-[0.6em] text-[rgba(215,178,110,0.75)]">
          Love Letter Inspired
        </span>
        <h1 className="font-heading text-4xl text-shadow-gold sm:text-5xl">
          Love Letter Reverie
        </h1>
        <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
          高級感あるフェルト卓で繰り広げられるミニマルな駆け引き。ニックネームを入力して即座にBot対戦を開始できます。
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            variant="outline"
            className="h-9 px-4 text-xs"
            onClick={() => setRulesOpen((prev) => !prev)}
          >
            {rulesOpen ? "ルールガイドを隠す" : "ルールガイドを開く"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6">
        {rulesOpen && (
          <Card className="relative overflow-hidden">
            <div className="noise-overlay" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <BookOpen className="h-5 w-5 text-[var(--color-accent-light)]" />
                ゲームの流れと勝利条件
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-[var(--color-text-muted)]">
              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-[0.4em] text-[rgba(215,178,110,0.75)]">基本ルール</h2>
                <ul className="list-disc space-y-1 leading-relaxed pl-5">
                  <li>各プレイヤーは常に手札1枚を保持し、手番開始時に山札から1枚引いて2枚になります。</li>
                  <li>2枚のうち1枚を選んで公開し、カードに書かれた効果をただちに解決します。</li>
                  <li>効果の解決後、手札は再び1枚となり次のプレイヤーへ手番が移ります。</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-[0.4em] text-[rgba(215,178,110,0.75)]">脱落と防御</h2>
                <ul className="list-disc space-y-1 leading-relaxed pl-5">
                  <li>カード効果で条件を満たしたプレイヤーは即座に脱落し、以降の手番を失います。</li>
                  <li>守護効果中のプレイヤーは対象にできません。守護が切れると再びターゲット可能です。</li>
                  <li>Emissary 相当のカードを捨て札にすると、自主的であっても脱落します。</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-[0.4em] text-[rgba(215,178,110,0.75)]">ラウンド終了と勝利</h2>
                <ul className="list-disc space-y-1 leading-relaxed pl-5">
                  <li>山札が尽きるか、1人を除き全員が脱落するとラウンドが終了します。</li>
                  <li>複数人生存している場合は、手札のランクが最も高いプレイヤーが勝利します。</li>
                  <li>同点なら捨て札の合計ランクが高い方が勝利。それでも同点なら直近手番が遅い方が勝ちます。</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-[0.4em] text-[rgba(215,178,110,0.75)]">操作ヒント</h2>
                <ul className="list-disc space-y-1 leading-relaxed pl-5">
                  <li>キーボードの Tab / Shift + Tab で操作対象を移動できます。</li>
                  <li>Enter で選択したカードを使用、Esc で選択状態を解除できます。</li>
                  <li>アクションバーの「カード効果ヒント」から各カードの詳細を確認できます。</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-[0.4em] text-[rgba(215,178,110,0.75)]">カード効果一覧</h2>
                <ul className="space-y-2">
                  {sortedCards.map((card) => (
                    <li
                      key={card.id}
                      className="rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.6)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-baseline gap-3">
                        <CardSymbol icon={card.icon} size={18} className="text-[var(--color-accent-light)] translate-y-0.5" />
                        <p className="font-heading text-base text-[var(--color-accent-light)]">
                          {card.name}
                        </p>
                        <span className="text-xs uppercase tracking-[0.35em] text-[rgba(215,178,110,0.75)]">
                          Rank {card.rank}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.4em] text-[rgba(215,178,110,0.55)]">
                          Copies {card.copies}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
                        {card.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </CardContent>
          </Card>
        )}

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
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                差し替えオプション（各ランク1枚）
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-2">
                {[
                  { id: "feint", label: "Rank1: Feint (推測→公開)" },
                  { id: "insight", label: "Rank2: Insight (山札2枚操作)" },
                  { id: "standoff", label: "Rank3: Standoff (公開比較)" },
                  { id: "wager", label: "Rank4: Wager (推測→公開)" },
                  { id: "ambush", label: "Rank6: Ambush (密やかな交換)" },
                  { id: "marquise", label: "Rank7: Marquise (合計12以上は強制)" },
                ].map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={variants[opt.id] ?? false}
                      onChange={(e) =>
                        setVariants((prev) => ({ ...prev, [opt.id]: e.target.checked }))
                      }
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreateRoom} disabled={createLoading} className="w-full">
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bot対戦を開始"}
            </Button>
            <div className="h-px bg-[rgba(215,178,110,0.25)]" />
            <div className="grid gap-4" ref={multiSectionRef}>
              <div className="rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.55)] p-4 text-sm text-[var(--color-text-muted)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-[var(--color-accent-light)]">アカウント</span>
                  {user ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{user.username}</span>
                      <Button variant="outline" className="h-8 px-3 text-xs" onClick={handleLogout} disabled={authLoading}>
                        ログアウト
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant={authMode === "login" ? "primary" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => setAuthMode("login")}
                        disabled={authLoading}
                      >
                        ログイン
                      </Button>
                      <Button
                        variant={authMode === "signup" ? "primary" : "outline"}
                        className="h-8 px-3 text-xs"
                        onClick={() => setAuthMode("signup")}
                        disabled={authLoading}
                      >
                        登録
                      </Button>
                    </div>
                  )}
                </div>
                {!user && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Input
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="username"
                      maxLength={32}
                    />
                    <Input
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="password"
                      type="password"
                      maxLength={128}
                    />
                    <Button onClick={handleAuth} disabled={authLoading} className="w-full">
                      {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : authMode === "signup" ? "登録して続行" : "ログインして続行"}
                    </Button>
                  </div>
                )}
                {authError && <p className="mt-2 text-xs text-[var(--color-warn-light)]">{authError}</p>}
                <p className="mt-2 text-xs leading-relaxed">
                  ログインしてマルチ参加すると、従来の player Cookie（llr_pid/llr_ptk）に依存せず、
                  <span className="text-[var(--color-accent-light)]">同一ブラウザでもタブごとに別プレイヤー</span>を扱えます（テスト用途向け）。
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">マルチ用ニックネーム</label>
                <Input
                  ref={mpNicknameInputRef}
                  value={mpNickname}
                  onChange={(e) => setMpNickname(e.target.value)}
                  placeholder="例: Velvet Strategist"
                  maxLength={24}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button onClick={handleCreateHumanRoom} disabled={mpLoading} className="w-full">
                  {mpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "マルチ部屋を作成"}
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    ref={joinRoomIdInputRef}
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Room ID を入力"
                    className="sm:flex-1"
                  />
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button onClick={handleJoinRoom} disabled={mpLoading} className="w-full sm:w-auto">
                    参加
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setQrScannerOpen(true)}
                    disabled={mpLoading}
                    className="w-full sm:w-auto"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    QR読取
                  </Button>
                </div>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                {user
                  ? "ログイン中は同一ブラウザでもタブを分ければ参加できます（ただし同一アカウントで複数席を操作できます）。実運用のマルチは別アカウント/別端末を推奨します。"
                  : "未ログインのまま同一ブラウザで複数人が参加すると、player Cookieが上書きされてホストが開始できなくなることがあります。2人目以降は別端末/別ブラウザ/シークレット、またはログインを推奨します。"}
              </p>
              {mpError && <p className="text-sm text-[var(--color-warn-light)]">{mpError}</p>}
              {session?.roomId && (
                <Button variant="outline" onClick={handleStartRoom} disabled={mpLoading} className="w-full">
                  {mpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "この部屋でゲーム開始 (ホスト)"}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">公開ルーム</label>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={handleLoadRooms}
                  disabled={roomsLoading}
                >
                  {roomsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : showRooms ? (
                    "非表示"
                  ) : (
                    "表示"
                  )}
                </Button>
              </div>
              {showRooms && (
                <div className="grid gap-2">
                  {rooms.length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)]">現在参加可能なルームはありません。</p>
                  )}
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-2 rounded border border-[rgba(215,178,110,0.25)] bg-[rgba(12,32,30,0.6)] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="truncate">
                      Room {r.shortId ?? r.id.slice(0, 8)} · {r.status} · {r.playerCount} 人
                    </span>
                    <Button
                      variant="ghost"
                      className="h-8 w-full px-3 text-xs sm:w-auto"
                      onClick={() => setJoinRoomId(r.shortId ?? r.id)}
                    >
                      参加準備
                    </Button>
                  </div>
                ))}
                </div>
              )}
            </div>
            {session && (
              <div className="rounded-lg border border-[rgba(215,178,110,0.25)] bg-[rgba(13,32,30,0.7)] p-4 text-sm text-[var(--color-text-muted)]">
                <p>既存のセッションがあります。</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[var(--color-accent-light)]">
                  <span>Room: {session.shortId ?? session.roomId}</span>
                  <span>Player: {session.nickname}</span>
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => router.push(`/game/${session.roomId}`)}
                  >
                  続きを再開
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      setSession(null);
                      setMpError(null);
                    }}
                  >
                    セッションを破棄
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RoomQrScanner open={qrScannerOpen} onOpenChange={setQrScannerOpen} onDetected={handleQrDetected} />

      {/* ルーム作成成功ダイアログ */}
      <Dialog open={showRoomCreatedDialog} onOpenChange={setShowRoomCreatedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ルームが作成されました</DialogTitle>
            <DialogDescription>
              他のプレイヤーを招待するために、ルームIDを共有してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createdRoomId && (
              <div className="space-y-3">
                <RoomIdDisplay roomId={createdRoomId} />
                <RoomQrShare roomId={createdRoomId} />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRoomCreatedDialog(false);
                }}
                className="flex-1"
              >
                閉じる
              </Button>
              <Button
                onClick={() => {
                  setShowRoomCreatedDialog(false);
                  // ゲームページへの遷移は必ず UUID の roomId を使用（短いIDは共有用）
                  router.push(`/game/${session?.roomId ?? createdRoomId ?? ""}`);
                }}
                className="flex-1"
              >
                ゲームページへ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

