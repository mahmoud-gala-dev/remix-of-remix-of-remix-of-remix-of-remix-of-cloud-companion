/**
 * Server-only helpers for the Slack, GitHub, Firebase push and AI integrations.
 * Never import this file from browser code.
 */
import { createCipheriv, createDecipheriv, createHash, createSign, randomBytes } from "node:crypto";

export type AppSettings = {
  id: number;
  slack_webhook_url: string | null;
  slack_notify_created: boolean;
  slack_notify_status: boolean;
  slack_notify_assigned: boolean;
  github_repo: string | null;
  github_auto_close: boolean;
  github_merged_status: string;
  firebase_config: Record<string, string>;
  firebase_vapid_key: string | null;
  push_enabled: boolean;
  ai_default_provider: string;
  gemini_model: string;
  updated_at: string;
};

export type PublicSettings = {
  push_enabled: boolean;
  firebase_config: Record<string, string>;
  firebase_vapid_key: string | null;
  ai_default_provider: string;
  gemini_model: string;
  github_repo: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadSettings(): Promise<AppSettings> {
  const db = await admin();
  const { data, error } = await db.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Integration settings row is missing.");
  return data as unknown as AppSettings;
}

export function toPublicSettings(s: AppSettings): PublicSettings {
  return {
    push_enabled: s.push_enabled,
    firebase_config: (s.firebase_config ?? {}) as Record<string, string>,
    firebase_vapid_key: s.firebase_vapid_key,
    ai_default_provider: s.ai_default_provider,
    gemini_model: s.gemini_model,
    github_repo: s.github_repo,
  };
}

export async function saveSettings(patch: Record<string, unknown>) {
  const db = await admin();
  const { error } = await db
    .from("app_settings")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", 1);
  if (error) throw new Error(error.message);
  return loadSettings();
}

export async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin role required.");
}

/* ------------------------------------------------------------------ *
 * Slack
 * ------------------------------------------------------------------ */

export function isSlackWebhook(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith("slack.com");
  } catch {
    return false;
  }
}

export async function postToSlack(webhookUrl: string, text: string, blocks?: unknown[]) {
  if (!isSlackWebhook(webhookUrl)) throw new Error("Slack webhook URL is not a valid slack.com URL.");
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blocks ? { text, blocks } : { text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack rejected the message [${res.status}]: ${body.slice(0, 300)}`);
  }
  return true;
}

export type BugEventKind = "created" | "status" | "assigned" | "github_merged";

export type BugEventPayload = {
  kind: BugEventKind;
  bugKey: string;
  title: string;
  actor?: string | null;
  project?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  assignee?: string | null;
  severity?: string | null;
  priority?: string | null;
  url?: string | null;
};

export function slackMessageFor(p: BugEventPayload): string {
  const who = p.actor ? ` by *${p.actor}*` : "";
  const head = `*${p.bugKey}* — ${p.title}`;
  switch (p.kind) {
    case "created":
      return `:bug: New bug reported${who}\n${head}${p.severity ? `\nSeverity: ${p.severity}` : ""}${p.priority ? ` · Priority: ${p.priority}` : ""}${p.project ? `\nProject: ${p.project}` : ""}${p.url ? `\n${p.url}` : ""}`;
    case "status":
      return `:arrows_counterclockwise: Status changed${who}\n${head}\n${p.fromStatus ?? "?"} → *${p.toStatus ?? "?"}*${p.url ? `\n${p.url}` : ""}`;
    case "assigned":
      return `:bust_in_silhouette: Bug assigned${who}\n${head}\nAssigned to: *${p.assignee ?? "Unassigned"}*${p.url ? `\n${p.url}` : ""}`;
    case "github_merged":
      return `:white_check_mark: Pull request merged — bug moved to *${p.toStatus ?? "Fixed"}*\n${head}${p.url ? `\n${p.url}` : ""}`;
  }
}

function slackEventEnabled(s: AppSettings, kind: BugEventKind) {
  if (kind === "created") return s.slack_notify_created;
  if (kind === "assigned") return s.slack_notify_assigned;
  return s.slack_notify_status;
}

/** Sends the Slack + push notifications for one bug event. Never throws. */
export async function dispatchBugEvent(payload: BugEventPayload, pushUserIds: string[] = []) {
  let slack: "sent" | "skipped" | "failed" = "skipped";
  let push: "sent" | "skipped" | "failed" = "skipped";
  let settings: AppSettings | null = null;
  try {
    settings = await loadSettings();
  } catch (error) {
    console.error("dispatchBugEvent: cannot load settings", error);
    return { slack, push };
  }

  if (settings.slack_webhook_url && slackEventEnabled(settings, payload.kind)) {
    try {
      await postToSlack(settings.slack_webhook_url, slackMessageFor(payload));
      slack = "sent";
    } catch (error) {
      slack = "failed";
      console.error("Slack notification failed:", error);
    }
  }

  if (settings.push_enabled && pushUserIds.length > 0) {
    try {
      const sent = await sendPushToUsers(pushUserIds, `${payload.bugKey}`, slackMessageFor(payload).replace(/[*_:`]/g, ""), payload.url ?? undefined);
      push = sent > 0 ? "sent" : "skipped";
    } catch (error) {
      push = "failed";
      console.error("Push notification failed:", error);
    }
  }

  return { slack, push };
}

/* ------------------------------------------------------------------ *
 * Firebase Cloud Messaging (HTTP v1)
 * ------------------------------------------------------------------ */

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

async function fcmAccessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Verifies the Firebase service account by exchanging a token with Google. */
export async function verifyFirebase() {
  const sa = serviceAccount();
  if (!sa) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is missing or is not valid JSON with client_email, private_key and project_id.",
    );
  }
  await fcmAccessToken(sa);
  return { projectId: sa.project_id };
}

/** Sends a push notification to every registered device of the given users. Returns how many succeeded. */
export async function sendPushToUsers(userIds: string[], title: string, body: string, url?: string) {
  const sa = serviceAccount();
  if (!sa) {
    console.warn("sendPushToUsers: FIREBASE_SERVICE_ACCOUNT is not configured; skipping push.");
    return 0;
  }
  const db = await admin();
  const { data, error } = await db
    .from("device_tokens")
    .select("token, user_id")
    .in("user_id", Array.from(new Set(userIds)));
  if (error) throw new Error(error.message);
  const tokens = (data ?? []).map((row) => (row as { token: string }).token);
  if (tokens.length === 0) return 0;

  const accessToken = await fcmAccessToken(sa);
  let sent = 0;
  const stale: string[] = [];
  for (const token of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body: body.slice(0, 400) },
          webpush: url ? { fcmOptions: { link: url } } : undefined,
        },
      }),
    });
    if (res.ok) sent += 1;
    else {
      const text = await res.text();
      console.error(`FCM send failed [${res.status}]: ${text.slice(0, 300)}`);
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) stale.push(token);
    }
  }
  if (stale.length > 0) await db.from("device_tokens").delete().in("token", stale);
  return sent;
}

/* ------------------------------------------------------------------ *
 * AI key storage (encrypted at rest)
 * ------------------------------------------------------------------ */

function encKey() {
  const raw = process.env["AI_KEY_ENC_SECRET"];
  if (!raw) throw new Error("AI_KEY_ENC_SECRET is not configured.");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(stored: string) {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/* ------------------------------------------------------------------ *
 * AI providers
 * ------------------------------------------------------------------ */

export async function geminiComplete(apiKey: string, model: string, input: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: input }] }] }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Gemini request failed [${res.status}]: ${text.slice(0, 400)}`);
  try {
    const json = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const answer = (json.candidates ?? [])
      .flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    return answer || "The model returned an empty answer.";
  } catch {
    return text.slice(0, 4000);
  }
}


/** Lovable AI Gateway, streamed server-side and returned as one string. */
export async function lovableComplete(input: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      input,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });
  if (!res.ok || !res.body) {
    const body = res.body ? await res.text() : "";
    if (res.status === 429) throw new Error("Lovable AI rate limit reached. Please try again shortly.");
    if (res.status === 402) throw new Error("Lovable AI credits are exhausted. Add credits to continue.");
    throw new Error(`Lovable AI request failed [${res.status}]: ${body.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let reasoning = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const event = JSON.parse(raw) as { type?: string; delta?: string };
        if (event.type === "response.output_text.delta") answer += event.delta ?? "";
        else if (event.type === "response.reasoning_summary_text.delta") reasoning += event.delta ?? "";
      } catch {
        /* ignore keep-alives */
      }
    }
  }
  return answer.trim() || reasoning.trim() || "The model returned an empty answer.";
}

/** Roles that may only use their own Gemini key. */
export const GEMINI_ONLY_ROLES = ["tester", "monitor", "auditor"];
