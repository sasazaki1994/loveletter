export type PlayerId = string;
export type RoomId = string;
export type GameId = string;

export type CardId =
  | "sentinel"
  | "oracle"
  | "duelist"
  | "warder"
  | "legate"
  | "arbiter"
  | "vizier"
  | "emissary";

export type CardEffectType =
  | "guess_eliminate"
  | "peek"
  | "compare"
  | "shield"
  | "force_discard"
  | "swap_hands"
  | "conditional_discard"
  | "self_eliminate";

export interface CardDefinition {
  id: CardId;
  name: string;
  rank: number;
  copies: number;
  effectType: CardEffectType;
  description: string;
  icon: CardIconId;
  target?: CardTargetOption;
  requiresGuess?: boolean;
  cannotTargetShielded?: boolean;
  notes?: string;
}

export type CardIconId =
  | "mask"
  | "eye"
  | "swords"
  | "shield"
  | "quill"
  | "balance"
  | "crown"
  | "flame";

export type CardTargetOption =
  | "self"
  | "opponent"
  | "any"
  | "none";

export type GamePhase =
  | "waiting"
  | "setup"
  | "draw"
  | "choose_card"
  | "resolve_effect"
  | "await_response"
  | "round_end"
  | "finished";

export interface PlayerPublicState {
  id: PlayerId;
  nickname: string;
  seat: number;
  isBot: boolean;
  shield: boolean;
  isEliminated: boolean;
  discardPile: CardId[];
  handCount: number;
  lastActiveAt: string;
}

export interface PlayerPrivateState extends PlayerPublicState {
  hand: CardId[];
}

export interface GameLogEntry {
  id: string;
  timestamp: string;
  message: string;
  actorId?: PlayerId;
  icon?: CardIconId | "info" | "alert";
}

export interface GameState {
  id: GameId;
  roomId: RoomId;
  phase: GamePhase;
  turnIndex: number;
  round: number;
  createdAt: string;
  updatedAt: string;
  drawPileCount: number;
  topDiscard?: CardId;
  discardPile: CardId[];
  revealedSetupCards: CardId[];
  players: PlayerPublicState[];
  activePlayerId?: PlayerId;
  awaitingPlayerId?: PlayerId;
  logs: GameLogEntry[];
  result?: {
    winnerIds: PlayerId[];
    reason: string;
  } | null;
}

export interface FullGameState extends GameState {
  players: PlayerPrivateState[];
  drawPile: CardId[];
}

export type ClientGameState = GameState & {
  self?: PlayerPrivateState;
  hand?: CardId[];
};

export type GameActionType =
  | "play_card"
  | "guess"
  | "choose_target"
  | "end_turn"
  | "resign";

export interface GameActionPayload {
  cardId?: CardId;
  targetId?: PlayerId;
  guessedRank?: number;
  effectChoice?: string;
}

export interface GameActionRequest {
  gameId: GameId;
  roomId: RoomId;
  playerId: PlayerId;
  type: GameActionType;
  payload?: GameActionPayload;
}

export interface GameActionResult {
  success: boolean;
  message?: string;
  state?: ClientGameState;
}

export type GameVisibility = "player" | "observer" | "owner";

export interface ResolvedEffect {
  eliminatedPlayers?: PlayerId[];
  shieldedPlayers?: PlayerId[];
  revealedCard?: CardId;
  swapped?: [PlayerId, PlayerId];
  forcedDiscard?: { playerId: PlayerId; discarded: CardId; drawn?: CardId };
}

export interface PollingResponse {
  state: ClientGameState | null;
  etag: string;
  lastUpdated: string | null;
}

