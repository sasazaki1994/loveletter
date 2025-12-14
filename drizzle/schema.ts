import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roomStatusEnum = pgEnum("room_status", [
  "waiting",
  "active",
  "finished",
]);

export const playerRoleEnum = pgEnum("player_role", ["player", "observer"]);

export const gamePhaseEnum = pgEnum("game_phase", [
  "waiting",
  "setup",
  "draw",
  "choose_card",
  "resolve_effect",
  "await_response",
  "round_end",
  "finished",
]);

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  shortId: text("short_id").notNull().unique(),
  status: roomStatusEnum("status").notNull().default("waiting"),
  // マルチルームの作成者（ホスト）。開始権限の判定に利用する。
  // 循環参照を避けるため、作成時は NULL → host作成後に UPDATE で埋める。
  // NOTE: DB制約は migration(0003_add_room_host_player.sql) 側で付与している。
  // Drizzle の table 定義で players を参照すると rooms<->players の循環参照になり
  // TypeScript の型推論が崩れるため、ここでは references() を付けない。
  hostPlayerId: uuid("host_player_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    // アカウントに紐づくプレイヤー（Bot等はNULL）
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    nickname: text("nickname").notNull(),
    seat: integer("seat").notNull(),
    role: playerRoleEnum("role").notNull().default("player"),
    isBot: boolean("is_bot").notNull().default(false),
    isEliminated: boolean("is_eliminated").notNull().default(false),
    shield: boolean("shield").notNull().default(false),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    avatarSeed: text("avatar_seed"),
    authTokenHash: text("auth_token_hash"),
  },
  (table) => ({
    roomSeatUnique: uniqueIndex("players_room_id_seat_unique").on(table.roomId, table.seat),
  }),
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    phase: gamePhaseEnum("phase").notNull().default("waiting"),
    turnIndex: integer("turn_index").notNull().default(0),
    round: integer("round").notNull().default(1),
    deckState: jsonb("deck_state")
      .$type<{ drawPile: string[]; burnCard: string | null }>()
      .notNull()
      .$default(() => ({ drawPile: [], burnCard: null })),
    discardPile: jsonb("discard_pile").$type<string[]>().notNull().$default(() => []),
    revealedSetupCards: jsonb("revealed_setup_cards")
      .$type<string[]>()
      .notNull()
      .$default(() => []),
    activePlayerId: uuid("active_player_id").references(() => players.id),
    awaitingPlayerId: uuid("awaiting_player_id").references(() => players.id),
    result: jsonb("result")
      .$type<
        | {
            winnerIds: string[];
            reason: string;
            finalHands?: Record<string, string[]>;
          }
        | null
      >()
      .default(null),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    roomIdUnique: uniqueIndex("games_room_id_unique").on(table.roomId),
  }),
);

export const hands = pgTable("hands", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  cards: jsonb("cards").$type<string[]>().notNull().$default(() => []),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const logs = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => players.id),
  message: text("message").notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

