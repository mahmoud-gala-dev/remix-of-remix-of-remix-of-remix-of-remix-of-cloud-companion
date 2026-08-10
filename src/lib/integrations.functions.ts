import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BugEventKind } from "@/lib/integrations.server";

type AuthedContext = {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    from: (table: string) => any;
  };
  userId: string;
};

async function requireAdmin(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Only admins can change integration settings.");
}

/** Full integration settings — admins only. */
export const fetchIntegrationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadSettings } = await import("@/lib/integrations.server");
    await requireAdmin(context as unknown as AuthedContext);
    const settings = await loadSettings();
    return {
      ...settings,
      has_firebase_service_account: Boolean(process.env["FIREBASE_SERVICE_ACCOUNT"]),
      has_github_webhook_secret: Boolean(process.env["GITHUB_WEBHOOK_SECRET"]),
      has_google_api_key: Boolean(process.env["GOOGLE_API_KEY"]),
    };
  });

/** Non-sensitive settings any signed-in user needs (push config, AI provider). */
export const fetchPublicSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { loadSettings, toPublicSettings } = await import("@/lib/integrations.server");
    return toPublicSettings(await loadSettings());
  });

export const updateIntegrationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = (input ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    const str = (key: string) => {
      if (!(key in data)) return;
      const value = data[key];
      patch[key] = typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    };
    const bool = (key: string) => {
      if (key in data) patch[key] = Boolean(data[key]);
    };
    str("slack_webhook_url");
    bool("slack_notify_created");
    bool("slack_notify_status");
    bool("slack_notify_assigned");
    str("github_repo");
    bool("github_auto_close");
    str("firebase_vapid_key");
    bool("push_enabled");
    if (typeof data["github_merged_status"] === "string" && data["github_merged_status"].trim())
      patch["github_merged_status"] = (data["github_merged_status"] as string).trim();
    if (typeof data["gemini_model"] === "string" && data["gemini_model"].trim())
      patch["gemini_model"] = (data["gemini_model"] as string).trim();
    if (data["ai_default_provider"] === "gemini" || data["ai_default_provider"] === "lovable")
      patch["ai_default_provider"] = data["ai_default_provider"];
    if (data["firebase_config"] && typeof data["firebase_config"] === "object")
      patch["firebase_config"] = data["firebase_config"];

    if (
      typeof patch["slack_webhook_url"] === "string" &&
      !/^https:\/\/[^/]*slack\.com\//.test(patch["slack_webhook_url"] as string)
    ) {
      throw new Error("Enter a valid https://hooks.slack.com/... webhook URL.");
    }
    if (
      typeof patch["github_repo"] === "string" &&
      !/^[\w.-]+\/[\w.-]+$/.test(patch["github_repo"] as string)
    ) {
      throw new Error("GitHub repository must look like owner/repo.");
    }
    return patch;
  })
  .handler(async ({ data, context }) => {
    const { saveSettings, toPublicSettings } = await import("@/lib/integrations.server");
    await requireAdmin(context as unknown as AuthedContext);
    return toPublicSettings(await saveSettings(data));
  });

/** Sends a test message to the configured Slack channel. */
export const sendSlackTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadSettings, postToSlack } = await import("@/lib/integrations.server");
    await requireAdmin(context as unknown as AuthedContext);
    const settings = await loadSettings();
    if (!settings.slack_webhook_url) throw new Error("Add a Slack webhook URL first.");
    await postToSlack(
      settings.slack_webhook_url,
      ":wave: Test message from the ElectroPI Bug Tracker. Slack notifications are working.",
    );
    return { ok: true };
  });

/**
 * Runs a live connectivity check for one integration and reports the exact
 * failure reason so admins can fix it without digging through logs.
 */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const target = (input as { target?: unknown })?.target;
    if (
      target !== "slack" &&
      target !== "github" &&
      target !== "firebase" &&
      target !== "ai"
    ) {
      throw new Error("Unknown integration.");
    }
    return { target };
  })
  .handler(async ({ data, context }) => {
    const { geminiComplete, loadSettings, lovableComplete, postToSlack } = await import(
      "@/lib/integrations.server"
    );
    await requireAdmin(context as unknown as AuthedContext);
    const settings = await loadSettings();
    const started = Date.now();

    const run = async (): Promise<string> => {
      if (data.target === "slack") {
        if (!settings.slack_webhook_url) throw new Error("No Slack webhook URL is saved yet.");
        await postToSlack(
          settings.slack_webhook_url,
          ":white_check_mark: Connection test from the ElectroPI Bug Tracker.",
        );
        return "Slack accepted the message — check the channel.";
      }

      if (data.target === "github") {
        if (!settings.github_repo) throw new Error("Set a default repository (owner/repo) first.");
        const token = process.env["GITHUB_TOKEN"];
        const res = await fetch(`https://api.github.com/repos/${settings.github_repo}`, {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "electropi-bug-tracker",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const body = await res.text();
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? `Repository "${settings.github_repo}" was not found or is private. For private repositories add a GITHUB_TOKEN secret.`
              : `GitHub replied [${res.status}]: ${body.slice(0, 200)}`,
          );
        }
        const repo = JSON.parse(body) as { full_name?: string; private?: boolean };
        const secret = process.env["GITHUB_WEBHOOK_SECRET"]
          ? "webhook secret configured"
          : "webhook secret missing — merges will be rejected";
        return `Reached ${repo.full_name ?? settings.github_repo}${repo.private ? " (private)" : ""}; ${secret}.`;
      }

      if (data.target === "firebase") {
        const config = (settings.firebase_config ?? {}) as Record<string, string>;
        const missing = ["apiKey", "projectId", "messagingSenderId", "appId"].filter(
          (key) => !config[key],
        );
        if (missing.length > 0) {
          throw new Error(`The Firebase web config is missing: ${missing.join(", ")}.`);
        }
        if (!settings.firebase_vapid_key) throw new Error("Add the Web Push (VAPID) certificate key.");
        const { verifyFirebase } = await import("@/lib/integrations.server");
        const { projectId } = await verifyFirebase();
        if (config["projectId"] && config["projectId"] !== projectId) {
          throw new Error(
            `The web config points at "${config["projectId"]}" but the server credentials belong to "${projectId}".`,
          );
        }
        return `Firebase Cloud Messaging is reachable for project ${projectId}.`;
      }

      const provider = settings.ai_default_provider;
      if (provider === "gemini") {
        const apiKey = process.env["GOOGLE_API_KEY"];
        if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured for the workspace.");
        await geminiComplete(apiKey, settings.gemini_model, "Reply with the single word: ok");
        return `Gemini responded using ${settings.gemini_model}.`;
      }
      await lovableComplete("Reply with the single word: ok");
      return "Lovable AI responded.";
    };

    try {
      const message = await run();
      return { ok: true as const, message, ms: Date.now() - started };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
      };
    }
  });

/** Fires the Slack + push notification for a bug event. Safe to call after any bug mutation. */
export const notifyBugEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = (input ?? {}) as Record<string, unknown>;
    const kind = data["kind"];
    if (kind !== "created" && kind !== "status" && kind !== "assigned") {
      throw new Error("Unsupported notification kind.");
    }
    const bugId = Number(data["bugId"]);
    if (!Number.isFinite(bugId)) throw new Error("A bug id is required.");
    const optional = (key: string) =>
      typeof data[key] === "string" ? (data[key] as string).slice(0, 200) : null;
    return {
      kind: kind as BugEventKind,
      bugId,
      fromStatus: optional("fromStatus"),
      toStatus: optional("toStatus"),
      origin: optional("origin"),
    };
  })
  .handler(async ({ data, context }) => {
    const { dispatchBugEvent } = await import("@/lib/integrations.server");
    const ctx = context as unknown as AuthedContext;
    const { data: bug, error } = await ctx.supabase
      .from("bugs")
      .select("id, bug_id, title, status, severity, priority, assigned_to, reported_by, project_id")
      .eq("id", data.bugId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bug) throw new Error("Bug not found.");

    const ids = [bug.assigned_to, bug.reported_by, ctx.userId].filter(Boolean) as string[];
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, username")
      .in("id", Array.from(new Set(ids)));
    const nameOf = (id: string | null) =>
      (profiles ?? []).find((p: { id: string }) => p.id === id)?.username ?? null;

    let project: string | null = null;
    if (bug.project_id) {
      const { data: row } = await ctx.supabase
        .from("projects")
        .select("name")
        .eq("id", bug.project_id)
        .maybeSingle();
      project = row?.name ?? null;
    }

    const recipients = [bug.assigned_to, bug.reported_by]
      .filter((id): id is string => Boolean(id) && id !== ctx.userId);

    return dispatchBugEvent(
      {
        kind: data.kind,
        bugKey: bug.bug_id,
        title: bug.title,
        actor: nameOf(ctx.userId),
        project,
        severity: bug.severity,
        priority: bug.priority,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus ?? bug.status,
        assignee: nameOf(bug.assigned_to),
        url: data.origin ? `${data.origin}/bugs/${bug.id}` : null,
      },
      recipients,
    );
  });

/* ------------------------------------------------------------------ *
 * Per-user AI keys + AI completion
 * ------------------------------------------------------------------ */

export const fetchMyAiStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthedContext;
    const { data: roleRow } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const role = (roleRow?.role as string | undefined) ?? null;
    const { data: keyRow } = await ctx.supabase
      .from("user_ai_keys")
      .select("provider, updated_at")
      .eq("user_id", ctx.userId)
      .eq("provider", "gemini")
      .maybeSingle();
    const { GEMINI_ONLY_ROLES, loadSettings } = await import("@/lib/integrations.server");
    const settings = await loadSettings();
    const geminiOnly = role ? GEMINI_ONLY_ROLES.includes(role) : false;
    return {
      role,
      geminiOnly,
      hasOwnKey: Boolean(keyRow),
      keyUpdatedAt: (keyRow?.updated_at as string | undefined) ?? null,
      effectiveProvider: geminiOnly ? "gemini" : settings.ai_default_provider,
      geminiModel: settings.gemini_model,
    };
  });

export const saveMyGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const key = (input as { apiKey?: unknown })?.apiKey;
    if (typeof key !== "string" || key.trim().length < 20) {
      throw new Error("Enter a valid Gemini API key.");
    }
    return { apiKey: key.trim() };
  })
  .handler(async ({ data, context }) => {
    const { encryptSecret } = await import("@/lib/integrations.server");
    const ctx = context as unknown as AuthedContext;
    const { error } = await ctx.supabase.from("user_ai_keys").upsert(
      {
        user_id: ctx.userId,
        provider: "gemini",
        api_key_ciphertext: encryptSecret(data.apiKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyGeminiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthedContext;
    const { error } = await ctx.supabase
      .from("user_ai_keys")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("provider", "gemini");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Runs a prompt through the provider that applies to the calling user. */
export const runAiPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const prompt = (input as { prompt?: unknown })?.prompt;
    if (typeof prompt !== "string" || prompt.trim().length < 3) {
      throw new Error("Enter a prompt of at least 3 characters.");
    }
    return { prompt: prompt.trim().slice(0, 8000) };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    const { decryptSecret, GEMINI_ONLY_ROLES, geminiComplete, loadSettings, lovableComplete } =
      await import("@/lib/integrations.server");
    const settings = await loadSettings();
    const { data: roleRow } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const role = (roleRow?.role as string | undefined) ?? null;
    const geminiOnly = role ? GEMINI_ONLY_ROLES.includes(role) : false;
    const provider = geminiOnly ? "gemini" : settings.ai_default_provider;

    if (provider === "gemini") {
      const { data: keyRow } = await ctx.supabase
        .from("user_ai_keys")
        .select("api_key_ciphertext")
        .eq("user_id", ctx.userId)
        .eq("provider", "gemini")
        .maybeSingle();
      const apiKey = keyRow?.api_key_ciphertext
        ? decryptSecret(keyRow.api_key_ciphertext as string)
        : process.env["GOOGLE_API_KEY"];
      if (!apiKey) {
        throw new Error(
          geminiOnly
            ? "Add your own Gemini API key in Settings to use the assistant."
            : "No Gemini API key is configured.",
        );
      }
      return { provider, text: await geminiComplete(apiKey, settings.gemini_model, data.prompt) };
    }

    return { provider: "lovable", text: await lovableComplete(data.prompt) };
  });

/* ------------------------------------------------------------------ *
 * Push device tokens
 * ------------------------------------------------------------------ */

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = (input ?? {}) as Record<string, unknown>;
    const token = data["token"];
    if (typeof token !== "string" || token.length < 20) throw new Error("Invalid device token.");
    return {
      token,
      platform: typeof data["platform"] === "string" ? (data["platform"] as string) : "web",
      userAgent: typeof data["userAgent"] === "string" ? (data["userAgent"] as string).slice(0, 300) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    const { error } = await ctx.supabase.from("device_tokens").upsert(
      {
        user_id: ctx.userId,
        token: data.token,
        platform: data.platform,
        user_agent: data.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const token = (input as { token?: unknown })?.token;
    if (typeof token !== "string" || !token) throw new Error("A device token is required.");
    return { token };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    const { error } = await ctx.supabase
      .from("device_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends a push notification to the caller's own devices — used by the "Test" button. */
export const sendPushTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthedContext;
    const { sendPushToUsers } = await import("@/lib/integrations.server");
    const sent = await sendPushToUsers(
      [ctx.userId],
      "ElectroPI Bug Tracker",
      "Push notifications are configured correctly.",
    );
    if (sent === 0) throw new Error("No device received the notification. Enable notifications on this device first.");
    return { sent };
  });

/* ------------------------------------------------------------------ *
 * GitHub link on a bug
 * ------------------------------------------------------------------ */

export const linkBugToGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const data = (input ?? {}) as Record<string, unknown>;
    const bugId = Number(data["bugId"]);
    if (!Number.isFinite(bugId)) throw new Error("A bug id is required.");
    if (data["clear"] === true) return { bugId, clear: true as const };
    const refType = data["refType"] === "issue" ? "issue" : "pr";
    const refNumber = Number(data["refNumber"]);
    if (!Number.isInteger(refNumber) || refNumber <= 0) {
      throw new Error("Enter the pull request or issue number.");
    }
    const repo = typeof data["repo"] === "string" ? data["repo"].trim() : "";
    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new Error("Repository must look like owner/repo.");
    }
    return { bugId, clear: false as const, refType, refNumber, repo: repo || null };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthedContext;
    if (data.clear) {
      const { error } = await ctx.supabase
        .from("bugs")
        .update({ github_repo: null, github_ref_type: null, github_ref_number: null, github_url: null })
        .eq("id", data.bugId);
      if (error) throw new Error(error.message);
      return { ok: true, github_url: null as string | null };
    }

    const { loadSettings } = await import("@/lib/integrations.server");
    const settings = await loadSettings();
    const repo = data.repo ?? settings.github_repo;
    if (!repo) throw new Error("Set a default GitHub repository in Admin settings first.");
    const url = `https://github.com/${repo}/${data.refType === "issue" ? "issues" : "pull"}/${data.refNumber}`;
    const { error } = await ctx.supabase
      .from("bugs")
      .update({
        github_repo: repo,
        github_ref_type: data.refType,
        github_ref_number: data.refNumber,
        github_url: url,
      })
      .eq("id", data.bugId);
    if (error) throw new Error(error.message);
    return { ok: true, github_url: url };
  });
