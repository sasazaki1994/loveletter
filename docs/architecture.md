## Love Letter Inspired MVP アーキテクチャ概要

### 技術構成
- Next.js 14 (App Router) / TypeScript / Node ランタイム
- UI: shadcn/ui + Tailwind CSS 4
- アニメーション: framer-motion
- 効果音: howler.js
- データ永続化: Neon (Serverless Postgres) + Drizzle ORM (neon-http driver)
- 通信: HTTP ポーリング (1–2 秒)
- デプロイ: Vercel Hobby プラン想定

### ドメインモデル
- `Card` (id, name, rank, effectType, description, icon) — `data/cards.ts`
- `PlayerState` (id, nickname, seat, hand, shield, eliminated, lastActionAt)
- `GameState` (id, roomId, deck, discardPile, turnIndex, phase, round, revealedSetupCards, logs)
- `Room` (id, status, createdAt) + `players` (1–4 名)
- アクション: `playCard`, `chooseTarget`, `resolveEffect`, `advanceTurn`
- `GamePhase`: `waiting`, `draw`, `choose`, `resolve`, `cleanup`, `round_end`

### DB スキーマ (Drizzle)
- `rooms`
- `players`
- `games`
- `hands`
- `actions`
  - JSON カラムは Drizzle の `jsonb` 型を利用

### API ルート
- `POST /api/room/create` — 新規ルーム作成、プレイヤー登録
- `GET /api/game/state?roomId=...&playerId=...` — 現在のゲーム状態 (ETag / lastUpdated)
- `POST /api/game/action` — カード使用などのアクション。サーバ側でターン & フェーズ検証

### クライアント構成
- `/` ロビー: ルーム作成・参加 UI (`RoomLobby`)
- `/game/[roomId]`: メイン卓 UI
  - `GameTable`: テーブル背景、山札、捨て札、カードアニメーション
  - `PlayerHUD`: 名前・状態・捨て札履歴
  - `HandCard`: 手札カード (拡大/傾き)、ARIA アノテーション
  - `TurnBanner`: 現在ターン / 山札残枚数 / フェーズ
  - `ActionBar`: 決定・キャンセル・ヒント
  - `ResultDialog`: ラウンド結果表示
  - `LogPanel`: 右下固定スクロールログ

### ポーリング & ステート管理
- `useGamePolling(roomId, playerId, interval)` — ETAG ベースで差分取得
- `GameContext` プロバイダでゲーム状態・操作許可・サウンドキューを共有
- サウンドは `useSoundEffects` フック (howler.js) で再生
- Bot プレイヤーはサーバ側アクション処理時に自動でターン解決

### 描画テーマ
- ベースカラー: 深緑 `#102c2a`, 墨黒 `#141414`, 金 `#d7b26e`
- `globals.css` で質感テクスチャ (線形グラデ + ノイズ) を CSS カスタムプロパティとして定義
- フォント: 見出し `Crimson Text`, 本文 `Work Sans`

### アクセシビリティ
- キーボード操作: Focus リング, `aria-live="polite"` でターン更新通知
- 色覚対応: 状態アイコン + テキスト + アクセントマーカー
- 効果音は設定ダイアログで音量変更可能


