import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * GitHub webhook receiver. Configure it in the repository under
 * Settings → Webhooks with content type `application/json`, the same secret as
 * GITHUB_WEBHOOK_SECRET, and the "Pull requests" + "Issues" events.
 *
 * When a linked pull request is merged, every bug pointing at that PR moves to
 * the configured status, and the change is recorded in the bug history.
 */
export const Route = createFileRoute("/api/public/github-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["GITHUB_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("github-webhook: GITHUB_WEBHOOK_SECRET is not configured");
          return new Response("Webhook not configured", { status: 503 });
        }

        const raw = await request.text();
        const signature = request.headers.get("x-hub-signature-256") ?? "";
        const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = request.headers.get("x-github-event");
        if (event === "ping") return Response.json({ ok: true, pong: true });
        if (event !== "pull_request" && event !== "issues") {
          return Response.json({ ok: true, ignored: event });
        }

        let payload: {
          action?: string;
          repository?: { full_name?: string };
          pull_request?: { number?: number; merged?: boolean; title?: string; html_url?: string };
          issue?: { number?: number; state?: string; title?: string; html_url?: string };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const repo = payload.repository?.full_name ?? null;
        const merged = event === "pull_request" && payload.action === "closed" && payload.pull_request?.merged === true;
        const issueClosed = event === "issues" && payload.action === "closed";
        if (!repo || (!merged && !issueClosed)) {
          return Response.json({ ok: true, ignored: `${event}.${payload.action ?? "unknown"}` });
        }

        const refNumber = merged ? payload.pull_request?.number : payload.issue?.number;
        const refUrl = merged ? payload.pull_request?.html_url : payload.issue?.html_url;
        if (!refNumber) return Response.json({ ok: true, ignored: "missing reference number" });

        const { loadSettings, dispatchBugEvent } = await import("@/lib/integrations.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const settings = await loadSettings();
        if (!settings.github_auto_close) {
          return Response.json({ ok: true, skipped: "auto-close disabled" });
        }

        const { data: bugs, error } = await supabaseAdmin
          .from("bugs")
          .select("id, bug_id, title, status, assigned_to, reported_by")
          .eq("github_repo", repo)
          .eq("github_ref_number", refNumber)
          .eq("github_ref_type", merged ? "pr" : "issue");
        if (error) {
          console.error("github-webhook: bug lookup failed", error);
          return new Response("Lookup failed", { status: 500 });
        }
        if (!bugs || bugs.length === 0) {
          return Response.json({ ok: true, matched: 0 });
        }

        const nextStatus = settings.github_merged_status;
        const updated: string[] = [];

        for (const bug of bugs) {
          if (bug.status === nextStatus) continue;
          const { error: updateError } = await supabaseAdmin
            .from("bugs")
            .update({ status: nextStatus, updated_at: new Date().toISOString() } as never)
            .eq("id", bug.id);
          if (updateError) {
            console.error(`github-webhook: could not update bug ${bug.bug_id}`, updateError);
            continue;
          }
          updated.push(bug.bug_id);

          await supabaseAdmin.from("bug_history").insert({
            bug_id: bug.id,
            field: "status",
            old_value: bug.status,
            new_value: nextStatus,
            user_id: null,
          } as never);

          const recipients = [bug.assigned_to, bug.reported_by].filter(Boolean) as string[];
          if (recipients.length > 0) {
            await supabaseAdmin.from("notifications").insert(
              recipients.map((userId) => ({
                user_id: userId,
                bug_id: bug.id,
                bug_title: bug.title,
                type: "status",
                message: `${bug.bug_id} moved to ${nextStatus} — ${merged ? "pull request" : "issue"} #${refNumber} was ${merged ? "merged" : "closed"}.`,
              })) as never,
            );
          }

          await dispatchBugEvent(
            {
              kind: "github_merged",
              bugKey: bug.bug_id,
              title: bug.title,
              toStatus: nextStatus,
              url: refUrl ?? null,
            },
            recipients,
          );
        }

        return Response.json({ ok: true, matched: bugs.length, updated });
      },
    },
  },
});
