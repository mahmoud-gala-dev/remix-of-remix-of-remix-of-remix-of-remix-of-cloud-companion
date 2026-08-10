-- Removes broken demo accounts from auth/public tables.
-- Run this first if /auth/v1/token returns "Database error querying schema".

DO $$
DECLARE
  demo_user_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO demo_user_ids
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
  );

  DELETE FROM auth.identities
  WHERE user_id = ANY(demo_user_ids)
     OR lower(identity_data->>'email') IN (
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

  DELETE FROM public.user_roles
  WHERE user_id = ANY(demo_user_ids);

  DELETE FROM public.profiles
  WHERE id = ANY(demo_user_ids);

  DELETE FROM auth.users
  WHERE id = ANY(demo_user_ids);
END $$;
