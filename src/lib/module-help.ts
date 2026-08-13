import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";

/**
 * Sends a help request about a documentation module. The database function
 * notifies every admin and supervisor.
 */
export async function requestModuleHelp({
  module,
  message,
}: {
  module: string;
  message: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc("request_module_help", {
    _module: module,
    _message: message,
  });
  if (error) throw new Error(friendlyDbError(error));
  return Number(data ?? 0);
}
