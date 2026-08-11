import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Database, KeyRound, LogOut, UserRound, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MockDataControls } from "@/components/admin/MockDataControls";
import { UserIntegrationSettings } from "@/components/settings/UserIntegrationSettings";
import { DatabaseMigrationPanel } from "@/components/admin/DatabaseMigrationPanel";
import { IntegrationSettings } from "@/components/admin/IntegrationSettings";
import { useUsersManager } from "@/hooks/useUsersManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/auth";
import { friendlyDbError, isSafeHttpUrl } from "@/lib/api";
import { useUserAvatar } from "@/context/AvatarContext";

export const NOTIFICATION_POLLING_KEY = "electropi.notifications.polling";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Update your ElectroPI profile, password and notification preferences.",
      },
      { property: "og:title", content: "Settings | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Update your ElectroPI profile, password and notification preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
  errorComponent: ({ error }: { error: Error }) => (
    <p className="p-6 text-sm text-destructive">Could not load settings: {error.message}</p>
  ),
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">Page not found.</p>,
});

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(40, "Username must be under 40 characters"),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(8, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

function AvatarSection({ username }: { username: string }) {
  const { avatarUrl, setAvatarUrl } = useUserAvatar();
  const [inputUrl, setInputUrl] = useState(avatarUrl);

  useEffect(() => {
    setInputUrl(avatarUrl);
  }, [avatarUrl]);

  const handleSaveAvatar = async () => {
    const trimmed = inputUrl.trim();
    if (trimmed && !isSafeHttpUrl(trimmed)) {
      toast.error("Please enter a valid http:// or https:// image URL.");
      return;
    }
    setAvatarUrl(trimmed);

    // Save to Supabase profile if signed in
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase
        .from("profiles")
        .update({ avatar_url: trimmed || null } as never)
        .eq("id", auth.user.id);
    }

    toast.success("Profile picture updated!");
  };

  return (
    <div className="space-y-3 border-b border-border pb-4">
      <Label className="text-sm font-medium">Developer Profile Picture (Avatar URL)</Label>
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border border-border">
          {inputUrl ? <AvatarImage src={inputUrl} alt={username} /> : null}
          <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
            {username.substring(0, 2).toUpperCase() || "??"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Input
            placeholder="Paste avatar image URL (e.g. https://...)"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveAvatar}>
              <ImageIcon className="me-1.5 h-3.5 w-3.5" /> Save Avatar
            </Button>
            {inputUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setInputUrl("");
                  setAvatarUrl("");
                  toast.info("Avatar cleared");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [polling, setPolling] = useState(true);
  const { addMockUsers, deleteMockUsers, mockUsersCount, allUsers } = useUsersManager();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPolling(window.localStorage.getItem(NOTIFICATION_POLLING_KEY) !== "off");
  }, []);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { username: user?.username ?? "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const saveProfile = useMutation({
    mutationFn: async (values: z.infer<typeof profileSchema>) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ username: values.username })
        .eq("id", user.id);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profile updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePassword = useMutation({
    mutationFn: async (values: z.infer<typeof passwordSchema>) => {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      passwordForm.reset({ password: "", confirm: "" });
      toast.success("Password changed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const togglePolling = (next: boolean) => {
    setPolling(next);
    window.localStorage.setItem(NOTIFICATION_POLLING_KEY, next ? "on" : "off");
    toast.success(next ? "Notification polling enabled" : "Notification polling disabled");
  };

  const handleSignOut = async () => {
    await signOut(queryClient);
    navigate({ to: "/", replace: true });
  };

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, password and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4" aria-hidden="true" /> Profile
          </CardTitle>
          <CardDescription>
            Your avatar image and display name across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AvatarSection username={user?.username ?? "User"} />
          <div className="space-y-2">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={user?.email ?? ""} readOnly disabled />
          </div>
          <Form {...profileForm}>
            <form
              className="space-y-4"
              onSubmit={profileForm.handleSubmit((v) => saveProfile.mutate(v))}
            >
              <FormField
                control={profileForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" aria-hidden="true" /> Password
          </CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              className="space-y-4"
              onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))}
            >
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "Updating…" : "Change password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <section id="integration-settings" className="space-y-4 border-t border-border/60 pt-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Integration settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage device notifications and your personal AI integration.
          </p>
        </div>
        <UserIntegrationSettings />
      </section>

      {user?.role === "admin" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" aria-hidden="true" /> Database Migrations
              </CardTitle>
              <CardDescription>
                Check required database setup and copy the SQL for migrations that still need to be
                applied.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DatabaseMigrationPanel />
            </CardContent>
          </Card>


          <section className="space-y-4 border-t border-border/60 pt-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Workspace integrations</h2>
              <p className="text-sm text-muted-foreground">
                Connect Slack, GitHub and push notifications, choose the AI provider, and test each
                connection.
              </p>
            </div>
            <IntegrationSettings />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" aria-hidden="true" /> Mock & Demo Data
              </CardTitle>
              <CardDescription>
                One-click controls to seed or delete mock records across all system tables (Users,
                Projects, Bugs, Tasks, Notifications).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MockDataControls
                onAddMockUsers={addMockUsers}
                onDeleteMockUsers={deleteMockUsers}
                mockUsersCount={mockUsersCount}
                totalUsersCount={allUsers.length}
              />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Control background activity in the app.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Notification polling</p>
            <p className="text-sm text-muted-foreground">
              Refresh the notifications list automatically every 30 seconds.
            </p>
          </div>
          <Switch
            checked={polling}
            onCheckedChange={togglePolling}
            aria-label="Toggle notification polling"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="me-2 h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
