import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "developer" | "tester" | "supervisor" | "auditor" | "monitor";

export type CurrentUser = {
  id: string;
  email: string | null;
  username: string;
  role: AppRole;
  /** Admins can deactivate accounts; deactivated users are signed straight out. */
  isActive: boolean;
};


export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (_event === "SIGNED_OUT") queryClient.clear();
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return { session, loading };
}

async function loadCurrentUser(user: User): Promise<CurrentUser> {
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("username, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    username: profile?.username ?? user.email?.split("@")[0] ?? "user",
    role: (roleRow?.role as AppRole) ?? "tester",
    isActive: profile?.is_active !== false,
  };
}


/** Current signed-in user with profile + role. Returns null while signed out. */
export function useAuth() {
  const { session, loading } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["current-user", userId],
    enabled: !!session?.user,
    queryFn: () => loadCurrentUser(session!.user),
    staleTime: 60_000,
  });

  return {
    user: query.data ?? null,
    session,
    isLoading: loading || (!!session && query.isLoading),
  };
}

/** Sign-out hygiene: stop in-flight fetches, drop cached data, then end the session. */
export async function signOut(queryClient?: {
  cancelQueries: () => Promise<void>;
  clear: () => void;
}) {
  if (queryClient) {
    await queryClient.cancelQueries();
    queryClient.clear();
  }
  await supabase.auth.signOut();
}
