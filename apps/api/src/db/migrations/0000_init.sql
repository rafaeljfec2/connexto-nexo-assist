CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "area" text NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "help_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "error_codes" text[] DEFAULT '{}' NOT NULL,
  "is_demo" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "number" text NOT NULL UNIQUE,
  "employee_id" uuid NOT NULL REFERENCES "users"("id"),
  "type" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "error_code" text,
  "priority" text NOT NULL,
  "status" text NOT NULL,
  "due_at" timestamptz NOT NULL,
  "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tickets_employee_idx" ON "tickets" ("employee_id");

CREATE TABLE IF NOT EXISTS "ticket_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id"),
  "from_status" text,
  "to_status" text NOT NULL,
  "note" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "users"("id"),
  "status" text DEFAULT 'with_agent' NOT NULL,
  "analyst_id" uuid REFERENCES "users"("id"),
  "employee_message_count" integer DEFAULT 0 NOT NULL,
  "summary" text,
  "busy_until" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id"),
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" ("conversation_id");

CREATE TABLE IF NOT EXISTS "drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id"),
  "version" integer NOT NULL,
  "action" text NOT NULL,
  "payload" jsonb NOT NULL,
  "ticket_id" uuid,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "execution_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id"),
  "execution_id" uuid NOT NULL,
  "message_id" uuid,
  "intent" text,
  "tool" text,
  "rule" text,
  "result" text NOT NULL,
  "justification" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" text NOT NULL,
  "kind" text NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "operations_operation_id_uidx" ON "operations" ("operation_id");

CREATE TABLE IF NOT EXISTS "seed_meta" (
  "id" text PRIMARY KEY,
  "applied_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
