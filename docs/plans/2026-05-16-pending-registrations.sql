BEGIN;

CREATE TABLE IF NOT EXISTS "PendingRegistrations" (
    "Id" uuid NOT NULL,
    "UserName" character varying(50) NOT NULL,
    "NormalizedUserName" character varying(50) NOT NULL,
    "Email" character varying(256) NOT NULL,
    "NormalizedEmail" character varying(256) NOT NULL,
    "FullName" character varying(200) NOT NULL,
    "PasswordHash" text NOT NULL,
    "VerificationCode" character varying(6) NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LastSentAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PendingRegistrations" PRIMARY KEY ("Id")
);

CREATE INDEX IF NOT EXISTS "IX_PendingRegistrations_ExpiresAt"
    ON "PendingRegistrations" ("ExpiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_PendingRegistrations_NormalizedEmail"
    ON "PendingRegistrations" ("NormalizedEmail");

CREATE UNIQUE INDEX IF NOT EXISTS "IX_PendingRegistrations_NormalizedUserName"
    ON "PendingRegistrations" ("NormalizedUserName");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260516120000_AddPendingRegistrations', '10.0.7')
ON CONFLICT ("MigrationId") DO NOTHING;

COMMIT;
