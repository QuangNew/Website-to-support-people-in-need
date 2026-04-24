-- Track 1: guarded backfill for EF migration history
-- Verified against the currently configured database on 2026-04-18.
-- This script only inserts missing history rows when the expected physical schema already exists.
-- Do not run this blindly against a different environment without verifying the same conditions first.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Pings'
          AND column_name = 'ConditionImageUrl'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Pings'
          AND column_name = 'ContactName'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Pings'
          AND column_name = 'ContactPhone'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM "__EFMigrationsHistory"
        WHERE "MigrationId" = '20260417185856_AddPingContactSnapshotFields'
    ) THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260417185856_AddPingContactSnapshotFields', '10.0.4');
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'VerificationHistories'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'VerificationHistories'
          AND indexname = 'IX_VerificationHistories_UserId_Status'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'VerificationHistories'
          AND indexname = 'IX_VerificationHistories_UserId_SubmittedAt'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM "__EFMigrationsHistory"
        WHERE "MigrationId" = '20260418063104_AddVerificationHistory'
    ) THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260418063104_AddVerificationHistory', '10.0.4');
    END IF;
END $$;

COMMIT;