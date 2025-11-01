import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
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
  status: roomStatusEnum("status").notNull().default("waiting"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
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
});

export const games = pgTable("games", {
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
});

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

