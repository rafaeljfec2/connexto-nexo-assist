ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "active_execution_id" uuid,
  ADD COLUMN IF NOT EXISTS "last_event_seq" integer DEFAULT 0 NOT NULL;

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "client_message_id" uuid;

CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_client_message_uidx"
  ON "messages" ("conversation_id", "client_message_id");

CREATE TABLE IF NOT EXISTS "conversation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id"),
  "seq" integer NOT NULL,
  "type" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_events_conversation_seq_uidx"
  ON "conversation_events" ("conversation_id", "seq");

CREATE INDEX IF NOT EXISTS "conversation_events_conversation_idx"
  ON "conversation_events" ("conversation_id");
