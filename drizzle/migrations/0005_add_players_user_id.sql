ALTER TABLE "players"
ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "players_user_id_idx" ON "players" ("user_id");


