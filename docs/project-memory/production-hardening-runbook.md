# Production Hardening Runbook

Date: 2026-08-10

## Notification Fanout

Current implementation uses database triggers for bug audit and notification rows, plus client-side polling/realtime-style refresh in the app shell.

Scale path:

1. Keep database-owned notification writes for bug status/assignment/comment events.
2. Add Supabase Edge Function or project webhook only when notification volume requires async fanout.
3. The worker should read new notification rows, send email/chat/push delivery, and mark delivery attempts in a dedicated `notification_deliveries` table.
4. Keep browser clients read-only for delivery state; do not expose service-role keys.

## Secure Migration Status Endpoint

Browser code must not execute DDL or hold service-role credentials.

Recommended deployment model:

1. Store Supabase service role in server-only hosting secrets.
2. Expose a server route that returns a read-only migration checklist.
3. Only admins may call it.
4. The endpoint may check tables/views/functions, but must not execute arbitrary SQL.

The current admin panel intentionally provides copyable SQL and client-safe checks only.

## Enterprise SSO And Role Provisioning

Recommended Supabase configuration:

1. Enable SAML/OIDC provider in Supabase Auth.
2. Map IdP groups to `public.user_roles` through a server-side provisioning job.
3. Keep `app_role` values restricted to:
   - `admin`
   - `developer`
   - `tester`
   - `supervisor`
   - `auditor`
   - `monitor`
4. Audit all role changes through `bug_history` or a dedicated `role_history` table before enterprise rollout.

## Rate Limiting And Abuse Controls

Recommended controls:

1. Configure Supabase Auth rate limits for sign-in, OTP, password reset, and sign-up endpoints.
2. Disable public sign-up unless the business flow explicitly requires it.
3. Use CAPTCHA on public auth forms if sign-up remains enabled.
4. Put Cloudflare/WAF rate limits in front of the hosted app for public routes.
5. Monitor auth failures and unexpected demo-account usage.
