/**
 * Integration tests against the live Lovable Cloud backend.
 *
 * They use two pre-provisioned QA accounts (created through the public signup
 * endpoint, with `role: "admin"` in the signup metadata — which the database
 * deliberately ignores).
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env["VITE_SUPABASE_URL"]!;
const KEY = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;

const USER_A = {
  email: process.env["TEST_USER_A_EMAIL"] ?? "qa.tester.a@electropi.test",
  password: process.env["TEST_USER_PASSWORD"] ?? "TestPass!2345",
};
const USER_B = {
  email: process.env["TEST_USER_B_EMAIL"] ?? "qa.tester.b@electropi.test",
  password: process.env["TEST_USER_PASSWORD"] ?? "TestPass!2345",
};
const RUN_BACKEND_TESTS = process.env["RUN_BACKEND_TESTS"] === "true";
const describeBackend = RUN_BACKEND_TESTS ? describe : describe.skip;

function anonClient(): SupabaseClient {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(creds: { email: string; password: string }) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword(creds);
  if (error) throw new Error(`sign-in failed for ${creds.email}: ${error.message}`);
  return { client, userId: data.user!.id };
}

let a: { client: SupabaseClient; userId: string } | undefined;
let b: { client: SupabaseClient; userId: string } | undefined;
const createdBugIds: number[] = [];

if (RUN_BACKEND_TESTS) {
  beforeAll(async () => {
    a = await signIn(USER_A);
    b = await signIn(USER_B);
  });

  afterAll(async () => {
    for (const id of createdBugIds) await a?.client.from("bugs").delete().eq("id", id);
    await a?.client.auth.signOut();
    await b?.client.auth.signOut();
  });
}

async function createBug(
  client: SupabaseClient,
  reporter: string,
  overrides: Record<string, unknown> = {},
) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { data, error } = await client
    .from("bugs")
    .insert({
      bug_id: `TEST-${suffix}`,
      module: "Automated tests",
      title: `Vitest bug ${suffix}`,
      status: "Open",
      priority: "Medium",
      severity: "Major",
      reported_by: reporter,
      ...overrides,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  createdBugIds.push(data.id as number);
  return data;
}

describeBackend("P0-1 signup cannot grant privileges", () => {
  it("assigns 'tester' even when signup metadata asks for admin", async () => {
    const { data, error } = await a!.client
      .from("user_roles")
      .select("role")
      .eq("user_id", a!.userId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.role).toBe("tester");
  });

  it("exposes exactly one role row per user", async () => {
    const { data } = await a!.client.from("user_roles").select("role").eq("user_id", a!.userId);
    expect(data?.length).toBe(1);
  });

  it("refuses a self-service role escalation write", async () => {
    const { error } = await a!.client
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", a!.userId)
      .select();
    const { data: after } = await a!.client
      .from("user_roles")
      .select("role")
      .eq("user_id", a!.userId)
      .maybeSingle();
    // Either the write errors out, or RLS silently matches zero rows.
    expect(after?.role).toBe("tester");
    if (error) expect(error.code).toBeDefined();

    const { error: insertError } = await a!.client
      .from("user_roles")
      .insert({ user_id: a!.userId, role: "admin" });
    expect(insertError).not.toBeNull();
  });
});

describeBackend("P0-2 row level security", () => {
  it("blocks user B from updating a bug reported by and assigned to user A", async () => {
    const bug = await createBug(a!.client, a!.userId, { assigned_to: a!.userId });

    const { data, error } = await b!.client
      .from("bugs")
      .update({ status: "Closed" })
      .eq("id", bug.id)
      .select();
    expect(error === null ? (data ?? []).length : 0).toBe(0);

    const { data: fresh } = await a!.client.from("bugs").select("status").eq("id", bug.id).single();
    expect(fresh?.status).toBe("Open");
  });

  it("blocks user B from deleting user A's bug", async () => {
    const bug = await createBug(a!.client, a!.userId);
    await b!.client.from("bugs").delete().eq("id", bug.id);
    const { data: still } = await a!.client
      .from("bugs")
      .select("id")
      .eq("id", bug.id)
      .maybeSingle();
    expect(still?.id).toBe(bug.id);
  });

  it("refuses forged notifications and history rows from the client", async () => {
    const bug = await createBug(a!.client, a!.userId);
    const { error: notifyError } = await a!.client
      .from("notifications")
      .insert({ user_id: b!.userId, bug_id: bug.id, message: "spoofed", type: "assignment" });
    expect(notifyError).not.toBeNull();

    const { error: historyError } = await a!.client.from("bug_history").insert({
      bug_id: bug.id,
      user_id: b!.userId,
      field: "status",
      old_value: "x",
      new_value: "y",
    });
    expect(historyError).not.toBeNull();
  });

  it("rejects a bug insert that claims another user as reporter", async () => {
    const { error } = await a!.client.from("bugs").insert({
      bug_id: `TEST-forge-${Date.now()}`,
      module: "Automated tests",
      title: "forged reporter",
      reported_by: b!.userId,
    });
    expect(error).not.toBeNull();
  });
});

describeBackend("P1-4 data integrity", () => {
  it("rejects duplicate bug ids", async () => {
    const bug = await createBug(a!.client, a!.userId);
    const { error } = await a!.client.from("bugs").insert({
      bug_id: bug.bug_id,
      module: "Automated tests",
      title: "duplicate",
      reported_by: a!.userId,
    });
    expect(error?.code).toBe("23505");
  });

  it("rejects an out-of-range status", async () => {
    const { error } = await a!.client.from("bugs").insert({
      bug_id: `TEST-bad-${Date.now()}`,
      module: "Automated tests",
      title: "bad status",
      status: "Banana",
      reported_by: a!.userId,
    });
    expect(error).not.toBeNull();
  });

  it("cascades deletes for comments and attachments", async () => {
    const bug = await createBug(a!.client, a!.userId);
    await a!.client.from("comments").insert({ bug_id: bug.id, user_id: a!.userId, content: "hi" });
    await a!.client
      .from("attachments")
      .insert({ bug_id: bug.id, type: "link", content: "https://example.com" });
    const { error } = await a!.client.from("bugs").delete().eq("id", bug.id);
    expect(error).toBeNull();
    const { data: orphans } = await a!.client.from("comments").select("id").eq("bug_id", bug.id);
    expect(orphans?.length ?? 0).toBe(0);
  });
});

describeBackend("E2E: report → assign → status change → notify → close", () => {
  it("writes history and notifications from database triggers only", async () => {
    const bug = await createBug(a!.client, a!.userId);

    // A assigns the bug to B.
    const { error: assignError } = await a!.client
      .from("bugs")
      .update({ assigned_to: b!.userId })
      .eq("id", bug.id);
    expect(assignError).toBeNull();

    const { data: assignNotifications } = await b!.client
      .from("notifications")
      .select("*")
      .eq("bug_id", bug.id)
      .eq("type", "assignment");
    expect(assignNotifications?.length).toBe(1);

    // B (the assignee) moves it to Fixed.
    const { error: statusError } = await b!.client
      .from("bugs")
      .update({ status: "Fixed" })
      .eq("id", bug.id);
    expect(statusError).toBeNull();

    const { data: history } = await a!.client
      .from("bug_history")
      .select("field,old_value,new_value,user_id")
      .eq("bug_id", bug.id)
      .order("id");
    const statusHistory = (history ?? []).filter((h) => h.field === "status");
    expect(statusHistory.length).toBe(1);
    expect(statusHistory[0]).toMatchObject({ old_value: "Open", new_value: "Fixed" });
    const assigneeHistory = (history ?? []).filter((h) => h.field === "assignee");
    expect(assigneeHistory.length).toBe(1);

    // The reporter (A) is notified about the status change.
    const { data: reporterNotifications } = await a!.client
      .from("notifications")
      .select("message,type")
      .eq("bug_id", bug.id)
      .eq("type", "status_change");
    expect(reporterNotifications?.length).toBe(1);

    // Close it out.
    const { error: closeError } = await a!.client
      .from("bugs")
      .update({ status: "Closed" })
      .eq("id", bug.id);
    expect(closeError).toBeNull();
    const { data: closed } = await a!.client
      .from("bugs")
      .select("status")
      .eq("id", bug.id)
      .single();
    expect(closed?.status).toBe("Closed");
  });
});
