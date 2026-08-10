import { supabase } from "@/integrations/supabase/client";

export type MigrationCheck = {
  key: string;
  label: string;
  applied: boolean;
  detail: string;
};

async function checkBugTimeEntries(): Promise<MigrationCheck> {
  const { error } = await supabase.from("bug_time_entries").select("id", { head: true }).limit(1);
  return {
    key: "bug_time_entries",
    label: "Bug resolution time tracking",
    applied: !error,
    detail: error
      ? "Missing table or policies for developer resolution timers."
      : "Table is reachable.",
  };
}

async function checkDemoAccounts(): Promise<MigrationCheck> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .in("role", ["auditor", "monitor", "developer"])
    .limit(20);

  const roles = new Set((data ?? []).map((row) => String(row.role)));
  const hasOversightRoles = roles.has("auditor") && roles.has("monitor");

  return {
    key: "demo_roles",
    label: "Auditor / Monitor roles",
    applied: !error && hasOversightRoles,
    detail: error
      ? "The app_role enum likely does not include auditor/monitor yet."
      : hasOversightRoles
        ? "Oversight roles are present in user role data."
        : "Enum may exist, but demo auditor/monitor users are not seeded yet.",
  };
}

async function checkResolutionAnalytics(): Promise<MigrationCheck> {
  const { error } = await supabase
    .from("resolution_time_analytics")
    .select("bug_id", { head: true })
    .limit(1);

  return {
    key: "resolution_time_analytics",
    label: "Resolution analytics view",
    applied: !error,
    detail: error
      ? "Missing analytics view/RPC for admin and auditor resolution-time reporting."
      : "Analytics view is reachable.",
  };
}

export async function fetchMigrationChecks() {
  const checks = await Promise.all([
    checkBugTimeEntries(),
    checkDemoAccounts(),
    checkResolutionAnalytics(),
  ]);
  return checks;
}
