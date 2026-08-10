-- Run this if demo login still returns:
-- { code: "unexpected_failure", message: "Database error querying schema" }

SELECT
  column_name,
  data_type,
  is_nullable,
  is_generated,
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'identities'
ORDER BY ordinal_position;

SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  i.provider,
  i.provider_id,
  i.identity_data->>'sub' AS identity_sub,
  i.identity_data->>'email' AS identity_email
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
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
