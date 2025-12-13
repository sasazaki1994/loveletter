ALTER TABLE "rooms"
ADD COLUMN IF NOT EXISTS "host_player_id" uuid;

DO $$
BEGIN
  ALTER TABLE "rooms"
    ADD CONSTRAINT "rooms_host_player_id_fk"
    FOREIGN KEY ("host_player_id") REFERENCES "players"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;


