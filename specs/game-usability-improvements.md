# Game Usability Improvements

## Purpose
初回プレイヤーが迷わず開始でき、進行中の状況と結果を理解し、すぐ再挑戦できる体験を強化する。

## Current problems
- ゲーム画面内で目的・基本ルール・操作が常時参照しにくい。
- 進行状況（状態/進捗/ラウンド）の認知が弱く、次アクションが分かりづらい。
- 直前アクションの結果と次に何をすべきかの導線が弱い。
- 結果表示のテスト識別子が不足し、E2Eで品質担保しづらい。

## User value
- 初回プレイ成功率の向上。
- 認知負荷の低減（何が起きたか・次に何をするかが明確）。
- リトライ行動の促進。

## Scope
- ゲーム画面に Header / Rule Panel / Action Feedback を最小追加。
- リザルトパネルとリトライボタンに test id を追加。
- 既存ロジックを維持したまま表示改善。
- E2Eテストで主要UIの表示を担保。

## Non-goals
- ルール/勝敗ロジックの全面改修。
- DBスキーマ変更。
- 新モード・ランキング・実績機能追加。

## Security requirements
- `playerId` を指定した状態取得（`/api/game/state`, `/api/game/stream`）は、アカウント所有者または正しい `X-Player-Token` を必須とする。
- `authTokenHash` が `null` のプレイヤーに対する例外認可は許可しない（bot部屋を含む）。
- 認可失敗時は `401 Unauthorized` を返し、秘匿情報（手札/peek情報）を返却しない。

## UI requirements
- `game-header` にゲーム名・状態・進捗・ラウンドを表示。
- `game-rule-panel` に目的/基本操作/勝利条件を表示。
- `game-action-feedback` に直前ログと次アクションヒントを表示。
- `game-result-panel` と `game-retry-button` を結果UIへ付与。

## Game state requirements
- 状態表示は `state.phase`・`isMyTurn`・`state.result` を解釈して表示。
- 進捗表示は破綻しないよう null-safe に表示する。
- 結果表示中は再戦導線を維持する。

## Balance requirements
- 今回はバランス数値を変更しない。
- 行動結果の可視化のみ改善対象。

## Accessibility requirements
- 文章で状態を伝え、色依存を避ける。
- 既存ボタンのキーボード操作を阻害しない。
- 小画面でも読める文字サイズを維持。

## Test requirements
- ルールパネル表示確認。
- ゲームヘッダー/状態/スコア表示確認。
- アクションフィードバック表示確認。
- リザルトパネルおよび再戦ボタン存在確認。

## Acceptance references
- `acceptance/game-usability-improvements.feature`
