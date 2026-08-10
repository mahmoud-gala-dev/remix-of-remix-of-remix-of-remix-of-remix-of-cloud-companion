import { createServerFn } from "@tanstack/react-start";

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demo-accounts";

/**
 * Creates the demo login accounts, but ONLY when the workspace has no users at
 * all. The zero-user guard is what makes this safe to expose publicly: as soon
 * as a single account exists the function becomes a no-op.
 */
export const seedDemoAccountsIfEmpty = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });
  if (listError) throw new Error(listError.message);
  if ((existing?.users?.length ?? 0) > 0) {
    return { seeded: false, created: 0, reason: "users-exist" as const };
  }

  let created = 0;
  for (const account of DEMO_ACCOUNTS) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: account.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { username: account.username },
    });
    if (error || !data.user) continue;

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: data.user.id, username: account.username }, { onConflict: "id" });

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.user.id);
    for (const row of roleRows ?? []) {
      await supabaseAdmin.from("user_roles").delete().eq("id", row.id);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: account.role });
    created += 1;
  }

  return { seeded: created > 0, created, reason: "seeded" as const };
});
