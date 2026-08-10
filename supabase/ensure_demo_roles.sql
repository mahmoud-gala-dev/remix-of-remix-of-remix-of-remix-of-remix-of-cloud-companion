-- Run this first in Supabase SQL Editor, then run seed_test_accounts.sql
-- in a separate query execution after this one succeeds.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'monitor';
