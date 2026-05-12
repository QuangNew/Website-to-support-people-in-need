-- Add API-key health and cooldown fields for round-robin failover.
ALTER TABLE "ApiKeys"
ADD COLUMN IF NOT EXISTS "FailureCount" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "LastFailedAt" timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS "CooldownUntil" timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS "LastErrorCode" character varying(80) NULL,
ADD COLUMN IF NOT EXISTS "LastErrorMessage" character varying(240) NULL;

-- Normalize legacy provider names to canonical backend values.
UPDATE "ApiKeys"
SET "Provider" = 'OpenAI'
WHERE "Provider" IN ('GPT', 'OpenAI', '2', '3');

UPDATE "ApiKeys"
SET "Provider" = 'Anthropic'
WHERE "Provider" IN ('Claude', 'Anthropic', '1', '4');

UPDATE "ApiKeys"
SET "Provider" = 'Gemini'
WHERE "Provider" IN ('Gemini', '0');

UPDATE "ApiKeys"
SET "Provider" = 'NvidiaNim'
WHERE "Provider" IN ('NVIDIA', 'NIM', 'NVIDIA NIM', 'NvidiaNIM', 'Nvidia NIM', 'NvidiaNim', '5');

-- Normalize old invalid OpenAI suggestions to documented Chat Completions model IDs.
UPDATE "ApiKeys"
SET "Model" = 'gpt-5.1'
WHERE "Provider" = 'OpenAI'
  AND "Model" IN ('gpt-5-4', 'GPT-5-4', 'GPT-5.4');

UPDATE "ApiKeys"
SET "Model" = 'gpt-5.1'
WHERE "Provider" = 'OpenAI'
  AND "Model" IN ('gpt-5-5', 'GPT-5-5', 'GPT-5.5');

UPDATE "ApiKeys"
SET "Model" = 'gpt-5-mini'
WHERE "Provider" = 'OpenAI'
  AND "Model" IN ('GPT-5-mini', 'GPT-5-Mini', 'gpt-5 Mini', 'gpt-5 mini');

-- Normalize old invalid Anthropic suggestions to documented snapshot IDs.
UPDATE "ApiKeys"
SET "Model" = 'claude-3-5-haiku-20241022'
WHERE "Provider" = 'Anthropic'
  AND "Model" IN ('claude-haiku-4-5', 'claude-haiku-4.5', 'Claude Haiku 4.5');

UPDATE "ApiKeys"
SET "Model" = 'claude-sonnet-4-20250514'
WHERE "Provider" = 'Anthropic'
  AND "Model" IN ('claude-sonnet-4-6', 'claude-sonnet-4.6', 'Claude Sonnet 4.6');

UPDATE "ApiKeys"
SET "Model" = 'claude-opus-4-20250514'
WHERE "Provider" = 'Anthropic'
  AND "Model" IN ('claude-opus-4-7', 'claude-opus-4.7', 'Claude Opus 4.7');

-- Normalize NVIDIA NIM model IDs to hosted NIM namespaced values.
UPDATE "ApiKeys"
SET "Model" = 'meta/llama-3.1-8b-instruct'
WHERE "Provider" = 'NvidiaNim'
  AND "Model" IN ('minimax-m2.7', 'minimaxai / minimax-m2.7', 'minimaxai/minimax-m2.7');

UPDATE "ApiKeys"
SET "Model" = 'meta/llama-4-maverick-17b-128e-instruct'
WHERE "Provider" = 'NvidiaNim'
  AND "Model" IN (
    'llama-4-maverick-17b-128e-instruct',
    'meta / llama-4-maverick-17b-128e-instruct',
    'meta/llama-4-maverick-17b-128e-instruct'
  );

-- Normalize Gemini REST-prefixed model values.
UPDATE "ApiKeys"
SET "Model" = regexp_replace("Model", '^models/', '')
WHERE "Provider" = 'Gemini'
  AND "Model" LIKE 'models/%';

UPDATE "ApiKeys"
SET "Model" = 'gemini-2.5-flash'
WHERE "Provider" = 'Gemini'
  AND "Model" IN ('gemini-3-flash', 'gemini-3-flash-preview');

-- Clear old failure state after normalizing providers/models.
UPDATE "ApiKeys"
SET
  "FailureCount" = 0,
  "LastFailedAt" = NULL,
  "CooldownUntil" = NULL,
  "LastErrorCode" = NULL,
  "LastErrorMessage" = NULL;

-- Index active-key rotation and provider/model filtering.
CREATE INDEX IF NOT EXISTS "IX_ApiKeys_ActiveRotation"
ON "ApiKeys" ("CooldownUntil", "LastUsedAt", "UsageCount", "Id")
WHERE "IsActive" = TRUE;

CREATE INDEX IF NOT EXISTS "IX_ApiKeys_ActiveProviderModel"
ON "ApiKeys" ("Provider", "Model")
WHERE "IsActive" = TRUE;

-- Verify the final API key state.
SELECT
  "Id",
  "Provider",
  "Label",
  "Model",
  "IsActive",
  "UsageCount",
  "FailureCount",
  "LastUsedAt",
  "LastFailedAt",
  "CooldownUntil",
  "LastErrorCode"
FROM "ApiKeys"
ORDER BY "Id";

SELECT "Provider", "Model", COUNT(*)
FROM "ApiKeys"
GROUP BY "Provider", "Model"
ORDER BY "Provider", "Model";
