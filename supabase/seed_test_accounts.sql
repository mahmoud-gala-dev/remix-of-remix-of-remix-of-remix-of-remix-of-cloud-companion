-- Demo accounts for ElectroPI Bug Tracker.
-- Run the whole file in Supabase SQL Editor.
--
-- Login credentials:
--   admin@test.com      / TestPass!2345
--   creator@test.com    / TestPass!2345
--   creator2@test.com   / TestPass!2345
--   tester@test.com     / TestPass!2345
--   supervisor@test.com / TestPass!2345
--   developer@test.com  / TestPass!2345
--   developer2@test.com / TestPass!2345
--   auditor@test.com    / TestPass!2345
--   monitor@test.com    / TestPass!2345

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  account record;
  account_id uuid;
  identities_id_type text;
BEGIN
  SELECT data_type INTO identities_id_type
  FROM information_schema.columns
  WHERE table_schema = 'auth'
    AND table_name = 'identities'
    AND column_name = 'id';

  FOR account IN
    SELECT *
    FROM (
      VALUES
        ('admin@test.com', 'admin'::public.app_role, 'Admin Demo'),
        ('creator@test.com', 'admin'::public.app_role, 'Project Creator Demo'),
        ('creator2@test.com', 'admin'::public.app_role, 'Project Creator Two'),
        ('tester@test.com', 'tester'::public.app_role, 'Tester Demo'),
        ('supervisor@test.com', 'supervisor'::public.app_role, 'Supervisor Demo'),
        ('developer@test.com', 'developer'::public.app_role, 'Developer Demo'),
        ('developer2@test.com', 'developer'::public.app_role, 'Developer Two Demo'),
        ('auditor@test.com', 'auditor'::public.app_role, 'Auditor Demo'),
        ('monitor@test.com', 'monitor'::public.app_role, 'Monitor Demo')
    ) AS accounts(email, app_role, username)
  LOOP
    SELECT u.id INTO account_id
    FROM auth.users u
    WHERE lower(u.email) = lower(account.email)
    LIMIT 1;

    IF account_id IS NOT NULL THEN
      DELETE FROM auth.identities WHERE user_id = account_id;
      DELETE FROM public.user_roles WHERE user_id = account_id;
      DELETE FROM public.profiles WHERE id = account_id;
      DELETE FROM auth.users WHERE id = account_id;
    END IF;

    account_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      is_sso_user,
      created_at,
      updated_at
    )
    VALUES (
      account_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      lower(account.email),
      extensions.crypt('TestPass!2345', extensions.gen_salt('bf', 10)),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('username', account.username),
      false,
      false,
      now(),
      now()
    );

    IF identities_id_type = 'uuid' THEN
      INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        account_id::text,
        account_id,
        jsonb_build_object(
          'sub', account_id::text,
          'email', lower(account.email),
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );
    ELSE
      INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        account_id::text,
        account_id::text,
        account_id,
        jsonb_build_object(
          'sub', account_id::text,
          'email', lower(account.email),
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );
    END IF;

    INSERT INTO public.profiles (id, username)
    VALUES (account_id, account.username)
    ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (account_id, account.app_role)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
