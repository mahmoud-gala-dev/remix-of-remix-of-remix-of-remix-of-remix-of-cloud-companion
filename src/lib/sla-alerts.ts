import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";

export type SlaScanResult = {
  breached_bugs: number;
  notifications_created: number;
  ran_at: string;
};

/**
 * Runs the SLA breach check on demand. The database also runs it hourly; this
 * only lets oversight roles refresh alerts immediately. Non-staff callers are
 * rejected by the database function itself.
 */
export async function runSlaBreachScan(): Promise<SlaScanResult> {
  const { data, error } = await supabase.rpc("run_sla_breach_scan");
  if (error) throw new Error(friendlyDbError(error));
  const result = (data ?? {}) as Partial<SlaScanResult>;
  return {
    breached_bugs: result.breached_bugs ?? 0,
    notifications_created: result.notifications_created ?? 0,
    ran_at: result.ran_at ?? new Date().toISOString(),
  };
}
