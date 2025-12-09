-- players: 座席重複防止
CREATE UNIQUE INDEX IF NOT EXISTS "players_room_id_seat_unique" ON "players" ("room_id", "seat");

-- games: 1ルーム1ゲームを強制
CREATE UNIQUE INDEX IF NOT EXISTS "games_room_id_unique" ON "games" ("room_id");

