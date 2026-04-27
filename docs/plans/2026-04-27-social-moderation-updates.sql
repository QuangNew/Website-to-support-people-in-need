-- Social moderation updates for post approval, delete reasons, and nested replies.
-- Run manually in Supabase SQL Editor. This script is idempotent.

ALTER TABLE "Comments"
ADD COLUMN IF NOT EXISTS "ParentCommentId" integer NULL;

CREATE INDEX IF NOT EXISTS "IX_Comments_ParentCommentId"
ON "Comments" ("ParentCommentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FK_Comments_Comments_ParentCommentId'
  ) THEN
    ALTER TABLE "Comments"
    ADD CONSTRAINT "FK_Comments_Comments_ParentCommentId"
    FOREIGN KEY ("ParentCommentId")
    REFERENCES "Comments" ("Id")
    ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE "Posts"
ADD COLUMN IF NOT EXISTS "DeletedReason" character varying(500) NULL,
ADD COLUMN IF NOT EXISTS "IsApproved" boolean NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS "ApprovedByAdminId" text NULL,
ADD COLUMN IF NOT EXISTS "RejectedAt" timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS "RejectedByAdminId" text NULL,
ADD COLUMN IF NOT EXISTS "RejectionReason" character varying(500) NULL;

UPDATE "Posts"
SET "IsApproved" = TRUE
WHERE "IsApproved" IS NULL;

CREATE INDEX IF NOT EXISTS "IX_Posts_IsApproved_IsDeleted_CreatedAt"
ON "Posts" ("IsApproved", "IsDeleted", "CreatedAt" DESC);

CREATE INDEX IF NOT EXISTS "IX_Posts_RejectedAt"
ON "Posts" ("RejectedAt");

CREATE INDEX IF NOT EXISTS "IX_Posts_ApprovedByAdminId"
ON "Posts" ("ApprovedByAdminId");

CREATE INDEX IF NOT EXISTS "IX_Posts_RejectedByAdminId"
ON "Posts" ("RejectedByAdminId");
