ALTER TABLE "execution_events"
  ADD COLUMN IF NOT EXISTS "confidence" text;

ALTER TABLE "execution_events"
  DROP CONSTRAINT IF EXISTS "execution_events_confidence_check";

ALTER TABLE "execution_events"
  ADD CONSTRAINT "execution_events_confidence_check"
  CHECK (
    "confidence" IS NULL
    OR "confidence" IN ('high', 'medium', 'low')
  );
