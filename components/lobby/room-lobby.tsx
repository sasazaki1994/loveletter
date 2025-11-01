'use client';

import { useMemo, useState } from "react";
import { BookOpen, Crown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlayerSession } from "@/lib/client/session";
import { CARD_POOL } from "@/lib/game/cards";

export function RoomLobby() {
  const router = useRouter();
  const { session, setSession } = usePlayerSession();

  const [nickname, setNickname] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const sortedCards = useMemo(
    () => [...CARD_POOL].sort((a, b) => a.rank - b.rank),
    [],
  );

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
                  <li>Princess 相当のカードを捨て札にすると、自主的であっても脱落します。</li>
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

