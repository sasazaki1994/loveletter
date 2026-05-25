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

## Beta variant policy

β版では、variant cards は以下のみ有効化する。

Supported:
- Feint
- Wager
- Marquise

Disabled / hidden:
- Insight
- Standoff
- Ambush

Disabled cards are not shown in the room creation UI and are ignored by the server if submitted through API payloads.  
They remain future work and must not enter the deck in beta.

## Future work
- `effectChoice` は将来の選択式効果（例: ambush swap/keep）で利用する拡張ポイント。
- Ambush / Insight / Standoff を本実装する場合は、サーバ契約・bot判断・UI選択・秘匿情報管理を同時に更新する。

## Card effect engine (pure rules)
- カード効果の「判定」を `lib/game/rules/card-effect-engine.ts` に分離する。
- 同 engine は DB / Next.js / drizzle に依存しない pure function として維持する。
- engine は以下を返す:
  - 効果発動可否 (`effectActivated`)
  - 追記ログの意味情報 (`logSuffix`)
  - 脱落候補 (`eliminatedPlayerIds`)
  - 永続化命令 (`instructions`: action追加, shield付与, hand swap, force_discard判定)

## Server responsibility
- `lib/server/game-service.ts` は transaction と永続化を担当する。
- `handlePlayCard` は rules engine の結果を受け取り、DB 更新（actions / hands / games / logs / players）を実行する。
- `force_discard` の山札/手札更新は DB 依存処理として server に残す。

## This phase goal
- 本PRは新機能追加ではなく、既存挙動維持のままテスト可能性を上げる基盤整備。
- `effectChoice` は future work のまま。
- Insight / Standoff / Ambush は未実装ポリシーを維持する。


## Contract tests
- `tests/contracts/card-effect-engine.test.ts`: Sentinel/Feint/Wager/Oracle/Duelist/Warder/Legate/Arbiter/Vizier/Marquise/Emissary の契約を検証。
- `tests/contracts/forced-card-rules.test.ts`: Vizier / Marquise の強制使用優先順位を検証。
- `tests/contracts/bot-choice.test.ts`: 強制ルール適用時の bot 選択と通常時の低ランク選択を検証。
- `tests/contracts/variant-support.test.ts`: supported/unsupported variant の境界を検証。
- `tests/contracts/api-action-contract.test.ts`: API入力schemaの境界条件（UUID/rank/type）を検証。

## API contract
- `app/api/game/action/schema.ts` に action/payload schema を分離し、API route と契約テストの共通契約として利用。
- 未認証・playerId不一致・room非参加は `401` を返す方針を維持。

## bot-action authorization
- `/api/game/bot-action` は room参加者認証を必須化。
- player token / user session による認可検証を通過しない呼び出しは `401`。

## unsupported variants
- `ambush` / `insight` / `standoff` は引き続き deck へ投入しない（選択されても無効化）。


### Supported variant matrix

| variant | status | note |
|---|---|---|
| feint | supported | reveal contract covered |
| wager | supported | reveal contract covered |
| marquise | supported | forced-play rule active |
| insight | unsupported | 未実装（山札2枚操作） |
| standoff | unsupported | 未実装（discard仕様未確定） |
| ambush | unsupported | 未実装（effectChoice必須仕様は future work） |

## Observer status (beta)
- `player_role=observer` はデータモデル上存在するが、観戦フローは future work。
- observer は状態閲覧境界の検証対象であり、play_card 実行は拒否されるべき。


## Acceptance scenarios (beta hardening)
- Bot連続ターン:
  - Given bot room and bot active turn
  - When room participant calls `/api/game/bot-action`
  - Then bot plays valid card and turn progresses (or game finishes)
  - And API does not return 500
- 2人戦セットアップ:
  - Given two human players and game start
  - Then `revealedSetupCards.length === 3`
  - And `drawPileCount` reflects burn/revealed/initial-hands/first-draw processing
  - And burn card is not exposed in public state or any player hand view

## Bot Match Contract

Bot戦は 1 人の人間プレイヤーと 3 人の Bot で進行する。

- Bot は自分の手番で必ず合法手を選ぶ
- Bot は強制カードルールを破らない
- Bot は脱落済み / shield 中 / handCount=0 の対象を不正に選ばない
- Bot は可能な限り Emissary を避ける（強制時・唯一選択時は除く）
- Sentinel / Feint / Wager の推測ランクは 1 を選ばない
- Bot 手番が連続しても一定上限 (`MAX_BOT_CHAIN_ACTIONS`) 内で進行し、ループで詰まらない
- round は山札切れ・脱落・勝敗確定まで進行できる
- bot-action が失敗しても UI から手動再試行できる
