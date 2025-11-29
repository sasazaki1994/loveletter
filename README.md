# Love Letter Inspired Card Game

![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/license-Private-red)

愛の手紙（Love Letter）風のカードゲームを、Next.js とリアルタイム通信で実装した Web アプリケーションです。マルチプレイヤー対応、ボット対戦、リアルタイム状態同期、サウンドエフェクトを備えています。

## 概要

このプロジェクトは、中世テーマのドロー系カードゲームをブラウザ上で楽しめるようにしたものです。プレイヤーはルームを作成してボットと対戦でき、手札の管理や効果の解決はサーバサイドで処理されます。HTTP ポーリングと Server-Sent Events を使用してゲーム状態をリアルタイムで同期します。

**解決する課題：**
- プレイヤー同士の状態同期
- ゲームロジックの整合性確保
- レスポンシブな UI/UX

**対象読者：**
- フロントエンド・フルスタック開発者
- ゲーム開発に興味のあるエンジニア
- リアルタイムアプリケーションの実装例を探す方

## 主な機能

- **ルーム管理**: ゲームルームの作成・参加機能
- **ボット対戦**: 自動で動作する 3 体のボットプレイヤー
- **リアルタイム同期**: Server-Sent Events による状態更新（ETag ベース最適化）
- **カードゲームロジック**: 8 種類のカードと多様な効果（推測・比較・守護など）
- **サウンドエフェクト**: Howler.js による効果音・BGM
- **アニメーション**: Framer Motion によるカード操作アニメーション
- **アクセシビリティ**: キーボード操作、ARIA アノテーション、色覚対応
- **自動クリーンアップ**: 古いルームの定期削除

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ GameProvider │  │ GameStream   │  │ SoundEffects │  │
│  │  (Context)   │  │  (SSE/Poll)  │  │  (Howler)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                              │
│         └─────────────────┴──────────────────────────────┘
└───────────────────────────┬──────────────────────────────┘
                             │ HTTP /api/*
                             │ SSE /api/game/stream
┌────────────────────────────▼──────────────────────────────┐
│              Next.js API Routes (Server)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ /room/create │  │ /game/action │  │ /game/stream │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │            │
│         └─────────────────┴──────────────────┴────────────┘
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  GameService    │                       │
│                   │  - State Mgmt   │                       │
│                   │  - Action Logic │                       │
│                   └────────┬────────┘                       │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  State Cache    │                       │
│                   │  (ETag-based)   │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼────────────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │  Neon PostgreSQL  │
                   │  (Drizzle ORM)    │
                   │  - rooms          │
                   │  - players        │
                   │  - games          │
                   │  - hands          │
                   │  - actions        │
                   │  - logs           │
                   └───────────────────┘
```

### データフロー

1. **ルーム作成**: クライアント → `POST /api/room/create` → DB にルーム・プレイヤー作成 → ボット 3 体を自動追加
2. **ゲーム開始**: サーバ側でデッキ生成・シャッフル・初期手札配布
3. **状態取得**: クライアント → `GET /api/game/stream?roomId=...&playerId=...` → ETag で差分チェック → SSE で更新配信
4. **アクション送信**: クライアント → `POST /api/game/action` → サーバ側で検証・処理 → 状態更新 → キャッシュ無効化
5. **ボット処理**: サーバ側で自動アクション生成・実行

### 技術スタック

- **フロントエンド**: Next.js 14 (App Router), React 18, TypeScript
- **UI**: Tailwind CSS 4, shadcn/ui, Framer Motion
- **バックエンド**: Next.js API Routes, Node.js ランタイム
- **データベース**: Neon (Serverless PostgreSQL), Drizzle ORM
- **通信**: HTTP ポーリング、Server-Sent Events
- **サウンド**: Howler.js
- **テスト**: Playwright (モンキーテスト)
- **MCP**: Playwright MCP (Model Context Protocol) - AI によるブラウザ自動化

## クイックスタート

### 前提条件

- Node.js 20 以上
- npm / pnpm / yarn
- PostgreSQL データベース（Neon 推奨、ローカル PostgreSQL でも可）

### ローカル実行

1. **リポジトリをクローン**

```bash
git clone <repository-url>
cd loveletter
```

2. **依存関係をインストール**

```bash
npm install
# または
pnpm install
```

3. **環境変数を設定**

`.env.local` ファイルを作成し、以下の変数を設定してください：

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
# または Neon の場合
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require

NODE_ENV=development
```

4. **データベースマイグレーションを実行**

```bash
npm run db:push
# または
npm run db:migrate
```

5. **開発サーバーを起動**

```bash
npm run dev
```

6. **ブラウザで確認**

[http://localhost:3000](http://localhost:3000) にアクセスし、ルームを作成してゲームを開始してください。

### Docker 実行

**TODO: Dockerfile / docker-compose.yml の追加が必要**

現時点では Docker 設定は含まれていません。必要な場合は以下を検討してください：

- `Dockerfile` の作成
- `docker-compose.yml` で PostgreSQL コンテナを含める構成

## 設定

### 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `DATABASE_URL` | はい* | - | PostgreSQL 接続文字列（`NEON_DATABASE_URL` とどちらか一方） |
| `NEON_DATABASE_URL` | はい* | - | Neon PostgreSQL 接続文字列（`DATABASE_URL` とどちらか一方） |
| `NODE_ENV` | いいえ | `development` | 実行環境（`development` / `production`） |
| `WS_NO_BUFFER_UTIL` | いいえ | `1` | WebSocket 互換性設定（自動設定） |

\* `DATABASE_URL` または `NEON_DATABASE_URL` のいずれか一方が必須です。

### データベース接続

- **Neon**: SSL モードが自動で有効になります
- **ローカル PostgreSQL**: SSL は自動で無効化されます（URL パターンで判定）
- **その他のクラウド**: URL に `aws` / `gcp` / `azure` が含まれる場合、SSL が有効になります

### Playwright MCP 設定

このプロジェクトには Playwright MCP (Model Context Protocol) が導入されています。AI モデルがブラウザ操作を自動化できるようになります。

**設定方法**:

1. `mcp.json` ファイルがプロジェクトルートに配置されています
2. Cursor などの MCP 対応クライアントで、この設定ファイルを読み込むように設定してください
3. 設定例（Cursor の場合）:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["@playwright/mcp@latest"]
       }
     }
   }
   ```

**機能**:
- ブラウザの自動操作（ナビゲーション、クリック、フォーム入力など）
- スクリーンショット取得
- ページコンテンツの取得
- JavaScript 実行

詳細は [Playwright MCP ドキュメント](https://github.com/playwright-community/playwright-mcp) を参照してください。

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバーを起動（`localhost:3000`） |
| `npm run build` | 本番用ビルドを生成 |
| `npm run start` | 本番サーバーを起動（`build` 後に実行） |
| `npm run lint` | ESLint でコードチェック |
| `npm run db:generate` | Drizzle スキーマからマイグレーションファイルを生成 |
| `npm run db:migrate` | データベースマイグレーションを実行 |
| `npm run db:push` | スキーマをデータベースに直接プッシュ（開発用） |
| `npm run monkey:test` | Playwright モンキーテストを実行（ヘッドレス） |
| `npm run monkey:test:headed` | モンキーテストを実行（ブラウザ表示あり） |
| `npm run monkey:test:seed` | シード値を指定してモンキーテストを実行 |

## API

### ルーム作成

**エンドポイント**: `POST /api/room/create`

**リクエスト**:
```json
{
  "nickname": "プレイヤー名（1-24文字）"
}
```

**レスポンス**:
```json
{
  "roomId": "uuid",
  "playerId": "uuid",
  "gameId": "uuid"
}
```

### ゲーム状態取得

**エンドポイント**: `GET /api/game/stream?roomId={roomId}&playerId={playerId}`

**レスポンス（SSE）**:
```
event: state
data: {"state": {...}, "lastUpdated": "...", "etag": "..."}

event: error
data: {"error": "エラーメッセージ"}
```

### ゲームアクション送信

**エンドポイント**: `POST /api/game/action`

**リクエスト**:
```json
{
  "gameId": "uuid",
  "roomId": "uuid",
  "playerId": "uuid",
  "type": "play_card",
  "payload": {
    "cardId": "sentinel",
    "targetId": "uuid（オプション）",
    "guessedRank": 3
  }
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "message": "アクションが処理されました"
}
```

**レスポンス（エラー）**:
```json
{
  "success": false,
  "message": "エラーメッセージ",
  "detail": "詳細（開発環境のみ）"
}
```

### ルーム一覧取得

**エンドポイント**: `GET /api/room/list`

**レスポンス**:
```json
[
  {
    "id": "uuid",
    "status": "waiting" | "active" | "finished",
    "createdAt": "ISO 8601",
    "playerCount": 4
  }
]
```

### キャッシュ統計取得

**エンドポイント**: `GET /api/cache/stats`

**レスポンス**:
```json
{
  "size": 10,
  "hits": 150,
  "misses": 20
}
```

## 運用

### ログ

- **開発環境**: コンソールに詳細ログが出力されます（`NODE_ENV=development`）
- **本番環境**: エラーのみログ出力（詳細は環境変数で制御可能）
- **データベースログ**: Drizzle ORM のクエリログは開発環境のみ有効

### 監視

**TODO: メトリクス収集の実装が必要**

現時点では以下が未実装です：
- APM ツールとの連携（Sentry、Datadog など）
- カスタムメトリクスの収集
- アラート設定

推奨監視項目：
- ルーム作成数 / 時間
- アクティブルーム数
- API エラー率
- データベース接続プール使用率
- レスポンスタイム（P50/P95/P99）

### バックアップ

- **データベース**: Neon の自動バックアップ機能を利用（有料プラン）
- **ローカル運用時**: `pg_dump` で定期バックアップを推奨

### 障害対応

#### データベース接続エラー

```
Error: DATABASE_URL または NEON_DATABASE_URL が未設定です
```

**対処**: 環境変数を確認し、接続文字列が正しいか検証してください。

#### マイグレーションエラー

```bash
npm run db:push
# エラー: relation "rooms" already exists
```

**対処**: 既存スキーマを確認し、必要に応じて `db:migrate` を使用してください。

#### ゲーム状態が更新されない

**確認項目**:
1. SSE 接続が確立されているか（ブラウザ DevTools の Network タブで確認）
2. ETag が正しく返されているか
3. サーバ側のキャッシュが無効化されているか

**対処**: ブラウザをリロードし、再度ルームに参加してください。

#### ボットが動作しない

**対処**: サーバ側のログを確認し、ボットの自動アクション処理が正常に実行されているか確認してください。`lib/server/game-service.ts` のボット処理ロジックを検証してください。

## セキュリティ

### 認証・認可

**TODO: 認証機能の実装が必要**

現時点では認証機能は実装されていません。以下の機能追加を推奨します：

- セッション管理（JWT / NextAuth.js）
- ルームへの参加制限（オーナーのみ追加可能など）
- API レート制限

### 秘密情報の扱い

- **環境変数**: `.env.local` を `.gitignore` に含め、Git にコミットしない
- **データベース接続文字列**: 本番環境ではシークレット管理サービス（Vercel Secrets、AWS Secrets Manager など）を使用
- **API キー**: 現時点では外部 API キーは使用していません

### 権限モデル

- **プレイヤー**: 自分のルームでのみゲームアクションを実行可能
- **オブザーバー**: ゲーム状態の閲覧のみ（未実装）
- **ルームオーナー**: ルーム作成者（現時点では特別な権限なし）

### 入力検証

- **Zod スキーマ**: すべての API リクエストを Zod で検証
- **UUID 検証**: `roomId` / `playerId` / `gameId` は UUID 形式のみ受け付け
- **文字数制限**: ニックネームは 1-24 文字

## 開発

### ディレクトリ構成

```
loveletter/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   │   ├── room/          # ルーム管理 API
│   │   ├── game/          # ゲーム状態・アクション API
│   │   └── cache/         # キャッシュ統計 API
│   ├── game/[roomId]/     # ゲーム画面
│   └── page.tsx           # トップページ（ロビー）
├── components/            # React コンポーネント
│   ├── game/             # ゲーム関連 UI
│   ├── lobby/            # ロビー UI
│   └── ui/               # 汎用 UI（shadcn/ui）
├── lib/                   # ライブラリ・ユーティリティ
│   ├── client/           # クライアント側ユーティリティ
│   ├── db/               # データベース接続
│   ├── game/             # ゲームロジック（カード定義・デッキ・型）
│   ├── hooks/            # React Hooks
│   └── server/           # サーバ側ロジック（GameService など）
├── drizzle/              # Drizzle ORM
│   ├── migrations/       # マイグレーションファイル
│   └── schema.ts         # データベーススキーマ定義
├── public/               # 静的ファイル
│   └── sounds/           # 効果音・BGM
├── tests/                # テストファイル
│   └── monkey/           # Playwright モンキーテスト
└── docs/                 # ドキュメント
    └── architecture.md   # アーキテクチャ詳細
```

### コード規約

- **TypeScript**: `strict` モード有効
- **ESLint**: Next.js 標準設定を使用
- **命名規則**:
  - コンポーネント: PascalCase
  - 関数・変数: camelCase
  - 定数: UPPER_SNAKE_CASE
  - 型・インターフェース: PascalCase（`I` プレフィックスなし）

### テスト

#### モンキーテスト

Playwright を使用したランダム操作テスト：

```bash
# ヘッドレスモード
npm run monkey:test

# ブラウザ表示あり
npm run monkey:test:headed

# シード値を指定（再現性確保）
npm run monkey:test:seed
```

テスト結果は `artifacts/monkey/` に保存されます。

**TODO: ユニットテスト・統合テストの追加が必要**

現時点ではモンキーテストのみです。以下を追加することを推奨します：

- ゲームロジックのユニットテスト（Jest / Vitest）
- API エンドポイントの統合テスト
- コンポーネントのテスト（React Testing Library）

### ローカルデータベース

Neon 以外のローカル PostgreSQL を使用する場合：

1. **PostgreSQL をインストール・起動**

```bash
# macOS (Homebrew)
brew install postgresql@14
brew services start postgresql@14

# Ubuntu
sudo apt install postgresql-14
sudo systemctl start postgresql
```

2. **データベースを作成**

```bash
createdb loveletter
```

3. **環境変数を設定**

```bash
DATABASE_URL=postgresql://localhost:5432/loveletter
```

4. **マイグレーション実行**

```bash
npm run db:push
```

### シードデータ

**TODO: シード機能の実装が必要**

現時点では初期データの投入機能はありません。開発用のテストデータを作成する場合は、`scripts/seed.ts` などを追加してください。

## よくあるエラーと対処

### エラー: "DATABASE_URL または NEON_DATABASE_URL が未設定です"

**原因**: 環境変数が設定されていない、または `.env.local` が読み込まれていない。

**対処**:
1. `.env.local` ファイルがプロジェクトルートに存在するか確認
2. 環境変数の名前が `DATABASE_URL` または `NEON_DATABASE_URL` であるか確認
3. Next.js 開発サーバーを再起動

### エラー: "アクションに失敗しました" / 400 Bad Request

**原因**: 
- ターンが自分のものではない
- フェーズが `choose_card` ではない
- カードの使用条件を満たしていない（例: 対象が守護状態）

**対処**:
- ブラウザコンソールのエラーメッセージを確認
- 開発環境では `detail` フィールドに詳細情報が含まれる
- ゲーム状態をリロードして、現在のターン・フェーズを確認

### エラー: SSE 接続が切断される

**原因**: 
- ネットワーク不安定
- サーバ側のタイムアウト
- CORS 設定の問題

**対処**:
- ブラウザ DevTools の Network タブで SSE 接続を確認
- `use-game-stream.ts` のリトライロジックが動作しているか確認（最大 5 回リトライ）
- サーバ側ログを確認

### エラー: マイグレーションが失敗する

**原因**: 
- データベーススキーマが既に存在する
- 接続権限がない
- SSL 設定が不正

**対処**:
```bash
# スキーマを直接プッシュ（開発用）
npm run db:push

# または既存テーブルを削除してから再実行
# （本番環境では注意）
```

### ボットが反応しない

**原因**: サーバ側のボット処理が実行されていない可能性。

**対処**:
- `lib/server/game-service.ts` の `handleGameAction` でボット処理が呼ばれているか確認
- サーバ側ログでボットのアクション生成ロジックが実行されているか確認

## ライセンス

このプロジェクトはプライベートプロジェクトです。無断転載・複製を禁じます。

## 貢献

**TODO: コントリビューションガイドの追加が必要**

現時点ではコントリビューション手順は未定義です。参加を希望する場合は、プロジェクトオーナーに連絡してください。

## 変更履歴

**TODO: CHANGELOG.md の作成が必要**

変更履歴は `CHANGELOG.md` にまとめることを推奨します。現時点では未作成です。

---

## 参考リンク

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Drizzle ORM ドキュメント](https://orm.drizzle.team/)
- [Neon ドキュメント](https://neon.tech/docs)
- [アーキテクチャ詳細](./docs/architecture.md)
