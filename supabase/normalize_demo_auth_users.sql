-- Normalize demo auth.users rows after manual SQL seeding.
-- Run this if auth.identities looks correct but sign-in still returns:
-- { code: "unexpected_failure", message: "Database error querying schema" }

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users
SET
  aud = 'authenticated',
  role = 'authenticated',
  encrypted_password = extensions.crypt('TestPass!2345', extensions.gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmed_at = COALESCE(confirmed_at, email_confirmed_at, now()),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone = COALESCE(phone, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
  raw_user_meta_data = jsonb_build_object(
    'username',
    CASE lower(email)
      WHEN 'admin@test.com' THEN 'Admin Demo'
      WHEN 'creator@test.com' THEN 'Project Creator Demo'
      WHEN 'creator2@test.com' THEN 'Project Creator Two'
      WHEN 'tester@test.com' THEN 'Tester Demo'
      WHEN 'supervisor@test.com' THEN 'Supervisor Demo'
      WHEN 'developer@test.com' THEN 'Developer Demo'
      WHEN 'developer2@test.com' THEN 'Developer Two Demo'
      WHEN 'auditor@test.com' THEN 'Auditor Demo'
      WHEN 'monitor@test.com' THEN 'Monitor Demo'
      ELSE split_part(email, '@', 1)
    END
  ),
  updated_at = now()
WHERE lower(email) IN (
  'admin@test.com',
  'creator@test.com',
  'creator2@test.com',
  'tester@test.com',
  'supervisor@test.com',
  'developer@test.com',
  'developer2@test.com',
  'auditor@test.com',
  'monitor@test.com'
);

UPDATE auth.identities i
SET
  provider = 'email',
  identity_data = jsonb_build_object(
    'sub', u.id::text,
    'email', lower(u.email),
    'email_verified', true,
    'phone_verified', false
  ),
  updated_at = now()
FROM auth.users u
WHERE i.user_id = u.id
  AND lower(u.email) IN (
    'admin@test.com',
    'creator@test.com',
    'creator2@test.com',
    'tester@test.com',
    'supervisor@test.com',
    'developer@test.com',
    'developer2@test.com',
    'auditor@test.com',
    'monitor@test.com'
  );

INSERT INTO public.profiles (id, username)
SELECT
  id,
  COALESCE(NULLIF(raw_user_meta_data->>'username', ''), split_part(email, '@', 1))
FROM auth.users
WHERE lower(email) IN (
  'admin@test.com',
  'creator@test.com',
  'creator2@test.com',
  'tester@test.com',
  'supervisor@test.com',
  'developer@test.com',
  'developer2@test.com',
  'auditor@test.com',
  'monitor@test.com'
)
ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username;

INSERT INTO public.user_roles (user_id, role)
SELECT id,
  CASE lower(email)
    WHEN 'admin@test.com' THEN 'admin'::public.app_role
    WHEN 'creator@test.com' THEN 'admin'::public.app_role
    WHEN 'creator2@test.com' THEN 'admin'::public.app_role
    WHEN 'tester@test.com' THEN 'tester'::public.app_role
    WHEN 'supervisor@test.com' THEN 'supervisor'::public.app_role
    WHEN 'developer@test.com' THEN 'developer'::public.app_role
    WHEN 'developer2@test.com' THEN 'developer'::public.app_role
    WHEN 'auditor@test.com' THEN 'auditor'::public.app_role
    WHEN 'monitor@test.com' THEN 'monitor'::public.app_role
    ELSE 'tester'::public.app_role
  END
FROM auth.users
WHERE lower(email) IN (
  'admin@test.com',
  'creator@test.com',
  'creator2@test.com',
  'tester@test.com',
  'supervisor@test.com',
  'developer@test.com',
  'developer2@test.com',
  'auditor@test.com',
  'monitor@test.com'
)
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role;

NOTIFY pgrst, 'reload schema';
