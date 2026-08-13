import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  createdAt: string;
  lastLogin?: string | undefined;
  isMock?: boolean;
};

const ROLES = ["admin", "developer", "tester", "supervisor", "auditor", "monitor"] as const;
type Role = (typeof ROLES)[number];

const asRole = (value: unknown): Role =>
  ROLES.includes(value as Role) ? (value as Role) : "tester";

type AuthedContext = {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  userId: string;
};

/** Throws unless the calling user holds the admin role (checked as that user). */
async function assertAdmin(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Only admins can manage user accounts.");
}

const isMockName = (username: string) => username.startsWith("mock_");

/** Full account list (auth email + profile + role). Admin only. */
export const listManagedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });
    if (error) throw new Error(error.message);

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, is_active"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));

    return (list?.users ?? []).map((u) => {
      const profile = profileById.get(u.id);
      const username = profile?.username ?? u.email?.split("@")[0] ?? "user";
      return {
        id: u.id,
        username,
        email: u.email ?? "",
        role: asRole(roleByUser.get(u.id)),
        status: profile?.is_active === false ? "inactive" : "active",
        createdAt: u.created_at ?? new Date().toISOString(),
        lastLogin: u.last_sign_in_at ?? undefined,
        isMock: isMockName(username),
      };
    });
  });

/** Enable or disable an account. Disabled accounts cannot use the app. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; isActive: boolean }) => {
    if (!input?.userId) throw new Error("userId is required");
    return { userId: input.userId, isActive: !!input.isActive };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    if (data.userId === (context as unknown as AuthedContext).userId && !data.isActive) {
      throw new Error("You cannot deactivate your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Replace a user's single role. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!ROLES.includes(input.role as Role)) throw new Error("Unknown role");
    return { userId: input.userId, role: input.role as Role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Create a real account with a profile and role. */
export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; email: string; password?: string; role: string }) => {
    const username = (input?.username ?? "").trim();
    const email = (input?.email ?? "").trim();
    if (!username || !email) throw new Error("Username and email are required.");
    if (!ROLES.includes(input.role as Role)) throw new Error("Unknown role");
    return {
      username,
      email,
      password: input.password?.trim() || null,
      role: input.role as Role,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const password = data.password ?? `Ep-${crypto.randomUUID().slice(0, 12)}!`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, username: data.username }, { onConflict: "id" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });

    return { id: created.user.id, generatedPassword: data.password ? null : password };
  });

/** Permanently delete an account. */
export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    await assertAdmin(ctx);
    if (data.userId === ctx.userId) throw new Error("You cannot delete your own account.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins ?? []).map((r) => r.user_id);
    if (adminIds.includes(data.userId) && adminIds.length <= 1) {
      throw new Error("Cannot delete the last admin account in the system.");
    }

    // Clean up relations & unassign bugs when a user account is deleted
    await supabaseAdmin.from("bugs").update({ assigned_to: null }).eq("assigned_to", data.userId);
    await supabaseAdmin.from("project_developers").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Create demo accounts prefixed with `mock_`. */
export const createMockUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { count?: number }) => ({
    count: Math.min(Math.max(Number(input?.count ?? 5) || 5, 1), 10),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const presets: { name: string; role: Role }[] = [
      { name: "alex_dev", role: "developer" },
      { name: "sarah_qa", role: "tester" },
      { name: "emma_sup", role: "supervisor" },
      { name: "david_dev", role: "developer" },
      { name: "lisa_qa", role: "tester" },
      { name: "youssef_monitor", role: "monitor" },
      { name: "mona_auditor", role: "auditor" },
    ];

    let created = 0;
    for (let i = 0; i < data.count; i += 1) {
      const preset = presets[i % presets.length]!;
      const suffix = Math.floor(100 + Math.random() * 900);
      const username = `mock_${preset.name}_${suffix}`;
      const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
        email: `${preset.name}${suffix}@mock.electropi.io`,
        password: `Mock-${crypto.randomUUID().slice(0, 10)}!`,
        email_confirm: true,
        user_metadata: { username },
      });
      if (error || !user.user) continue;
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: user.user.id, username }, { onConflict: "id" });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user.user.id);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user.user.id, role: preset.role });
      created += 1;
    }
    return { created };
  });

/** Remove every account whose username starts with `mock_`. */
export const deleteMockUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AuthedContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .like("username", "mock_%");

    let deleted = 0;
    for (const profile of profiles ?? []) {
      await supabaseAdmin.from("bugs").update({ assigned_to: null }).eq("assigned_to", profile.id);
      await supabaseAdmin.from("project_developers").delete().eq("user_id", profile.id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
      if (!error) deleted += 1;
    }
    return { deleted };
  });
