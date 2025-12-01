# マルチプレイヤーテストガイド

このドキュメントでは、マルチプレイヤー機能をテストする方法を説明します。

## テスト環境

- **テストフレームワーク**: Playwright
- **設定ファイル**: `playwright.config.ts`
- **テストディレクトリ**: `tests/e2e/`

## テストの実行方法

### 基本的な実行

```bash
# ヘッドレスモードで実行
pnpm run e2e:test

# ブラウザを表示して実行（デバッグ用）
pnpm run e2e:test:headed

# CI環境用
pnpm run e2e:ci
```

### 特定のテストファイルを実行

```bash
# 2人対戦テストのみ実行
npx playwright test tests/e2e/two-player-join.spec.ts

# リロード復帰テストのみ実行
npx playwright test tests/e2e/reconnect-resume.spec.ts
```

### テスト実行時の注意点

- テスト実行前に開発サーバーが起動している必要があります（`playwright.config.ts`の`webServer`設定で自動起動されます）
- デフォルトのベースURLは `http://localhost:3100` です
- テストはシリアルモード（`mode: "serial"`）で実行されるため、順次実行されます

## 基本的なテストパターン

### 1. 2人対戦の基本フロー

`two-player-join.spec.ts` を参考に、以下の手順でテストします：

```typescript
// 1) APIでホストがルーム作成
const resCreate = await request.post("/api/room/create-human", {
  data: { nickname: "HostE2E" },
});
const hostInfo = await resCreate.json();

// 2) APIで参加者がジョイン
const resJoin = await request.post("/api/room/join", {
  data: { roomId: hostInfo.shortId ?? hostInfo.roomId, nickname: "GuestE2E" },
});
const guestInfo = await resJoin.json();

// 3) ホストがゲーム開始
const resStart = await request.post("/api/room/start", {
  headers: {
    "X-Player-Id": hostInfo.playerId,
    "X-Player-Token": hostInfo.playerToken,
    "Content-Type": "application/json",
  },
  data: { roomId: hostInfo.roomId },
});

// 4) 複数のブラウザコンテキストで異なるプレイヤーをシミュレート
const ctxA = await browser.newContext();
const pageA = await ctxA.newPage();
// localStorageにセッション情報を設定
await pageA.addInitScript(([roomId, playerId, nickname, token, shortId]) => {
  window.localStorage.setItem(
    "llr:session",
    JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }),
  );
}, [hostInfo.roomId, hostInfo.playerId, "HostE2E", hostInfo.playerToken, hostInfo.shortId]);
await pageA.goto(`${baseURL}/game/${hostInfo.roomId}`);

const ctxB = await browser.newContext();
const pageB = await ctxB.newPage();
// 同様に参加者のセッションを設定
await pageB.addInitScript(...);
await pageB.goto(`${baseURL}/game/${hostInfo.roomId}`);

// 5) サーバー状態の同期を確認
await waitForServerState(request, hostInfo.roomId, { id: hostInfo.playerId, token: hostInfo.playerToken }, 20000);
await waitForServerState(request, hostInfo.roomId, { id: guestInfo.playerId, token: guestInfo.playerToken }, 20000);
```

### 2. セッション管理の注意点

- **localStorageの設定**: `addInitScript`でページ読み込み前にセッション情報を設定
- **フォールバック処理**: セッション未検出エラーが出た場合は、`evaluate`で再設定してリロード
- **認証トークン**: 人間プレイヤーは`X-Player-Id`と`X-Player-Token`ヘッダーが必要

### 3. サーバー状態の確認

`waitForServerState`ヘルパー関数を使用して、ゲーム状態が準備完了になるまで待機：

```typescript
const state = await waitForServerState(
  request,
  roomId,
  { id: playerId, token: playerToken },
  20000 // タイムアウト（ミリ秒）
);
```

### 4. アクション送信のテスト

プレイヤーのアクション（カード使用など）を送信してテスト：

```typescript
const resAction = await request.post("/api/game/action", {
  headers: {
    "X-Player-Id": playerId,
    "X-Player-Token": playerToken,
    "Content-Type": "application/json",
  },
  data: {
    gameId: gameId,
    roomId: roomId,
    playerId: playerId,
    type: "play_card", // または "resign" など
    payload: { cardId, targetId, guessedRank },
  },
});
```

### 5. UI同期の確認

複数のブラウザで同じゲーム状態が表示されることを確認：

```typescript
// ゲームテーブルが表示されることを確認
await expect(pageA.getByRole('region', { name: 'ゲームテーブル' })).toBeVisible();
await expect(pageB.getByRole('region', { name: 'ゲームテーブル' })).toBeVisible();

// URLが正しいことを確認
await expect(pageA).toHaveURL(new RegExp(`/game/${roomId}$`));
await expect(pageB).toHaveURL(new RegExp(`/game/${roomId}$`));
```

## テストシナリオ例

### シナリオ1: 基本的な2人対戦

1. ホストがルーム作成
2. 参加者がジョイン
3. ゲーム開始
4. 両プレイヤーがゲーム画面に到達
5. サーバー状態が同期されていることを確認

**参考**: `tests/e2e/two-player-join.spec.ts`

### シナリオ2: リロード後の状態復帰

1. ゲーム開始
2. プレイヤーがリロード
3. セッション情報から状態が復帰することを確認

**参考**: `tests/e2e/reconnect-resume.spec.ts`

### シナリオ3: フルゲームフロー

1. 2人対戦を開始
2. アクションを送信
3. ゲーム終了まで進行
4. リザルト表示を確認

**参考**: `tests/e2e/deterministic-fullgame.spec.ts`

### シナリオ4: ランダムプレイ

1. ボット対戦を開始
2. ランダムなアクションを送信
3. ゲームが正常に進行することを確認

**参考**: `tests/e2e/random-play.spec.ts`

## ヘルパー関数

`tests/e2e/fixtures.ts`に以下のヘルパー関数が定義されています：

- `waitForGameUI(page, timeoutMs)`: ゲームUIが表示されるまで待機
- `createBotRoomViaUI(page, nickname)`: UI経由でボットルームを作成
- `createBotRoomViaAPI(request, nickname, opts)`: API経由でボットルームを作成
- `waitForServerState(request, roomId, player, timeoutMs)`: サーバー状態が準備完了になるまで待機

## ベストプラクティス

1. **シリアルモード**: `test.describe.configure({ mode: "serial" })`でテストを順次実行
2. **タイムアウト設定**: ネットワーク待機には十分なタイムアウトを設定（20秒以上推奨）
3. **エラーハンドリング**: セッション未検出などのエラーはフォールバック処理を実装
4. **状態確認**: APIでサーバー状態を確認してからUIの検証を行う
5. **リソースクリーンアップ**: テスト終了時にブラウザコンテキストを閉じる

## トラブルシューティング

### セッション未検出エラー

```typescript
if (await page.getByText('セッション未検出').isVisible().catch(() => false)) {
  await page.evaluate(([roomId, playerId, nickname, token, shortId]) => {
    localStorage.setItem('llr:session', JSON.stringify({ roomId, playerId, nickname, playerToken: token, shortId }));
  }, [roomId, playerId, nickname, token, shortId]);
  await page.reload();
}
```

### サーバー状態が準備完了しない

- タイムアウトを延長する
- ポーリング間隔を確認（デフォルトは500ms）
- APIエンドポイントが正しく動作しているか確認

### 複数プレイヤーの同期が取れない

- 各プレイヤーの`playerId`と`playerToken`が正しく設定されているか確認
- サーバー状態の`activePlayerId`を確認してターンが正しく回っているか検証
