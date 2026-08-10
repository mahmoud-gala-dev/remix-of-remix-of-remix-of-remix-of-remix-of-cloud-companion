import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { seedDemoAccountsIfEmpty } from "@/lib/demo-seed.functions";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Sign in to the ElectroPI bug tracker to report, triage and resolve bugs with your QA team.",
      },
      { property: "og:title", content: "Sign in | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Sign in to the ElectroPI bug tracker for QA teams.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // If the workspace has zero users, create the demo accounts shown as buttons
  // below so the app is immediately usable. Server-side guarded: it is a no-op
  // as soon as a single account exists.
  const seedDemoAccounts = useServerFn(seedDemoAccountsIfEmpty);
  useEffect(() => {
    let cancelled = false;
    seedDemoAccounts({})
      .then((result) => {
        if (!cancelled && result?.seeded) {
          toast.success(`Created ${result.created} demo accounts. Password: ${DEMO_PASSWORD}`);
        }
      })
      .catch(() => {
        /* seeding is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [seedDemoAccounts]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Admins can deactivate accounts: refuse the session instead of letting a
    // deactivated user land in the workspace.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user!.id)
      .maybeSingle();
    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("This account has been deactivated by an administrator.");
      return;
    }

    setLoading(false);
    navigate({ to: "/dashboard" });
  };


  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const fillDemoAccount = (email: string) => {
    setEmail(email);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <ShieldAlert className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Electro<span className="text-gradient">PI</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bug tracking workspace for QA, developers and supervisors.
          </p>
        </div>

        <div className="panel p-6">
          <h2 className="text-xl font-bold tracking-tight mb-4 text-center">Sign in</h2>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="secondary"
                size="sm"
                className="justify-start"
                onClick={() => fillDemoAccount(account.email)}
              >
                {account.label}
              </Button>
            ))}
          </div>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
