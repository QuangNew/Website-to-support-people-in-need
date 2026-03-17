-- Clear demo/test pings from database
-- Run this in Supabase SQL Editor or via psql

-- Delete all pings (use with caution in production)
DELETE FROM "Pings";

-- Reset auto-increment counter
ALTER SEQUENCE "Pings_Id_seq" RESTART WITH 1;

-- Optional: Delete only test pings created before a specific date
-- DELETE FROM "Pings" WHERE "CreatedAt" < '2026-03-17';

-- Optional: Delete pings without associated users (orphaned test data)
-- DELETE FROM "Pings" WHERE "UserId" NOT IN (SELECT "Id" FROM "AspNetUsers");
