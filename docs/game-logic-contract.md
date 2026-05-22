# Game Logic Contract (server authoritative)

## Scope
- 通常カード効果の成否判定はサーバー(`handlePlayCard`)を正とする。
- クライアントのガードは UX 向上目的であり、最終判定ではない。

## Forced-play rules
1. **Vizier 強制廃棄**
   - 手札に `vizier` と `arbiter` または `legate` が同時にある場合、`vizier` を優先して出す必要がある。
2. **Marquise 強制使用**
   - 手札に `marquise` があり、手札ランク合計が 12 以上の場合、`marquise` を優先して出す必要がある。

※ 判定ロジックは `lib/game/forced-card-rules.ts` に集約し、server/client/bot で共通利用する。

## Optional variant support policy
### Supported
- `feint`
- `wager`
- `marquise`

### Disabled / ignored (room create で受け取っても適用しない)
- `insight` (山札2枚操作が未実装)
- `standoff` (説明と実装の意味差分が未整理)
- `ambush` (effectChoice swap/keep 未実装)

## Future work
- `effectChoice` は将来の選択式効果（例: ambush swap/keep）で利用する拡張ポイント。
- Ambush / Insight / Standoff を本実装する場合は、サーバ契約・bot判断・UI選択・秘匿情報管理を同時に更新する。
