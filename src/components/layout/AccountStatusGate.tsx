import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/lib/auth";

/**
 * Blocks the whole authenticated area when an admin has deactivated the
 * account. The session is ended so the user cannot keep browsing with a
 * cached session.
 */
export function AccountStatusGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const blocked = !!user && user.isActive === false;

  useEffect(() => {
    if (!blocked) return;
    void signOut(queryClient);
  }, [blocked, queryClient]);

  if (!blocked) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15">
          <ShieldOff className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Account deactivated</h1>
        <p className="text-sm text-muted-foreground">
          Your account has been deactivated by an administrator, so you cannot access the workspace.
          Please contact an admin if you think this is a mistake.
        </p>
        <Button onClick={() => navigate({ to: "/", replace: true })}>Back to sign in</Button>
      </div>
    </div>
  );
}
