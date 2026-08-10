-- Extra diagnostics for persistent auth sign-in failures.

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table IN ('users', 'identities')
ORDER BY event_object_table, trigger_name;

SELECT
  id,
  email,
  aud,
  role,
  encrypted_password IS NOT NULL AS has_password,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  confirmed_at IS NOT NULL AS confirmed,
  raw_app_meta_data,
  raw_user_meta_data,
  COALESCE(phone, '') AS phone,
  COALESCE(email_change, '') AS email_change
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
ORDER BY email;

SELECT
  ur.user_id,
  u.email,
  ur.role
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE lower(u.email) IN (
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
ORDER BY u.email;
