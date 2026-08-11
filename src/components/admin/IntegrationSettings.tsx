import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Bell,
  Github,
  MessageSquare,
  Sparkles,
  Send,
  PlugZap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUG_STATUSES } from "@/lib/api";
import {
  fetchIntegrationSettings,
  sendSlackTest,
  testIntegration,
  updateIntegrationSettings,
} from "@/lib/integrations.functions";
import { CopyBlock, SetupSteps } from "./IntegrationSetupGuide";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
] as const;

type TestTarget = "slack" | "github" | "firebase" | "ai";

type TestResult = { ok: boolean; message: string; ms: number };

type FormState = {
  slack_webhook_url: string;
  slack_notify_created: boolean;
  slack_notify_status: boolean;
  slack_notify_assigned: boolean;
  github_repo: string;
  github_auto_close: boolean;
  github_merged_status: string;
  push_enabled: boolean;
  firebase_config: string;
  firebase_vapid_key: string;
  ai_default_provider: string;
  gemini_model: string;
};

const FIREBASE_CONFIG_SAMPLE = `{
  "apiKey": "AIza…",
  "authDomain": "your-app.firebaseapp.com",
  "projectId": "your-app",
  "storageBucket": "your-app.appspot.com",
  "messagingSenderId": "000000000000",
  "appId": "1:000000000000:web:abc123"
}`;

/** Admin-only panel for Slack, GitHub, Firebase push and AI provider configuration. */
export function IntegrationSettings() {
  const queryClient = useQueryClient();
  const load = useServerFn(fetchIntegrationSettings);
  const save = useServerFn(updateIntegrationSettings);
  const slackTest = useServerFn(sendSlackTest);
  const runTest = useServerFn(testIntegration);
  const [form, setForm] = useState<FormState | null>(null);
  const [results, setResults] = useState<Partial<Record<TestTarget, TestResult>>>({});
  const [testing, setTesting] = useState<TestTarget | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const settingsQuery = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => load(),
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setForm({
      slack_webhook_url: s.slack_webhook_url ?? "",
      slack_notify_created: s.slack_notify_created,
      slack_notify_status: s.slack_notify_status,
      slack_notify_assigned: s.slack_notify_assigned,
      github_repo: s.github_repo ?? "",
      github_auto_close: s.github_auto_close,
      github_merged_status: s.github_merged_status,
      push_enabled: s.push_enabled,
      firebase_config: JSON.stringify(s.firebase_config ?? {}, null, 2),
      firebase_vapid_key: s.firebase_vapid_key ?? "",
      ai_default_provider: s.ai_default_provider,
      gemini_model: s.gemini_model,
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (state: FormState) => {
      let firebaseConfig: Record<string, string> = {};
      if (state.firebase_config.trim()) {
        try {
          firebaseConfig = JSON.parse(state.firebase_config) as Record<string, string>;
        } catch {
          throw new Error("The Firebase config must be valid JSON.");
        }
      }
      return save({
        data: {
          slack_webhook_url: state.slack_webhook_url,
          slack_notify_created: state.slack_notify_created,
          slack_notify_status: state.slack_notify_status,
          slack_notify_assigned: state.slack_notify_assigned,
          github_repo: state.github_repo,
          github_auto_close: state.github_auto_close,
          github_merged_status: state.github_merged_status,
          push_enabled: state.push_enabled,
          firebase_config: firebaseConfig,
          firebase_vapid_key: state.firebase_vapid_key,
          ai_default_provider: state.ai_default_provider,
          gemini_model: state.gemini_model,
        },
      });
    },
    onSuccess: () => {
      toast.success("Integration settings saved");
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const slackTestMutation = useMutation({
    mutationFn: () => slackTest(),
    onSuccess: () => toast.success("Test message sent to Slack"),
    onError: (error: Error) => toast.error(error.message),
  });

  const test = async (target: TestTarget) => {
    setTesting(target);
    try {
      const result = (await runTest({ data: { target } })) as TestResult;
      setResults((current) => ({ ...current, [target]: result }));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResults((current) => ({ ...current, [target]: { ok: false, message, ms: 0 } }));
      toast.error(message);
    } finally {
      setTesting(null);
    }
  };

  if (settingsQuery.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-destructive">
          {(settingsQuery.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (settingsQuery.isLoading || !form) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading integration settings…
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const secrets = settingsQuery.data;

  const TestButton = ({ target, label }: { target: TestTarget; label: string }) => (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={testing !== null}
        onClick={() => test(target)}
      >
        {testing === target ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <PlugZap className="me-2 h-4 w-4" />
        )}
        {label}
      </Button>
      <TestOutcome result={results[target]} />
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" /> Slack notifications
          </CardTitle>
          <CardDescription>
            Send a message to a Slack channel when bugs are reported, reassigned, or change status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SetupSteps
            steps={[
              "Open Slack API → Your Apps and create an app for your workspace.",
              "Enable “Incoming Webhooks”, then click “Add New Webhook to Workspace”.",
              "Pick the channel that should receive bug alerts and authorise it.",
              "Copy the generated webhook URL and paste it below, then run the test.",
            ]}
            links={[
              { label: "Slack apps dashboard", href: "https://api.slack.com/apps" },
              {
                label: "Incoming webhooks guide",
                href: "https://api.slack.com/messaging/webhooks",
              },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="slack-webhook">Webhook URL</Label>
            <Input
              id="slack-webhook"
              placeholder="https://hooks.slack.com/services/T000/B000/xxxx"
              value={form.slack_webhook_url}
              onChange={(event) => set("slack_webhook_url", event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleRow
              label="New bug reported"
              checked={form.slack_notify_created}
              onChange={(value) => set("slack_notify_created", value)}
            />
            <ToggleRow
              label="Status changed"
              checked={form.slack_notify_status}
              onChange={(value) => set("slack_notify_status", value)}
            />
            <ToggleRow
              label="Bug assigned"
              checked={form.slack_notify_assigned}
              onChange={(value) => set("slack_notify_assigned", value)}
            />
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={slackTestMutation.isPending || !form.slack_webhook_url}
              onClick={() => slackTestMutation.mutate()}
            >
              {slackTestMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="me-2 h-4 w-4" />
              )}
              Send test message
            </Button>
            <TestButton target="slack" label="Test connection" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" /> GitHub
          </CardTitle>
          <CardDescription>
            Link bugs to a pull request or issue, and move them automatically when the pull request
            is merged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SetupSteps
            steps={[
              "In your repository open Settings → Webhooks → Add webhook.",
              "Paste the payload URL below and set the content type to application/json.",
              "Generate a strong random secret, paste it into GitHub, and save it as the GITHUB_WEBHOOK_SECRET secret in this project.",
              "Under “Let me select individual events” tick Pull requests and Issues, then save.",
              "For private repositories also add a GITHUB_TOKEN secret with repo read access.",
            ]}
            links={[
              {
                label: "GitHub webhook docs",
                href: "https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks",
              },
              {
                label: "Create a personal access token",
                href: "https://github.com/settings/tokens",
              },
            ]}
          />
          <CopyBlock label="Payload URL" value={`${origin}/api/public/github-webhook`} />
          <CopyBlock label="Content type" value="application/json" />
          <CopyBlock
            label="Generate a webhook secret (run locally)"
            value="openssl rand -hex 32"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="github-repo">Default repository</Label>
              <Input
                id="github-repo"
                placeholder="owner/repo"
                value={form.github_repo}
                onChange={(event) => set("github_repo", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status after merge</Label>
              <Select
                value={form.github_merged_status}
                onValueChange={(value) => set("github_merged_status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUG_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ToggleRow
            label="Update linked bugs automatically on merge"
            checked={form.github_auto_close}
            onChange={(value) => set("github_auto_close", value)}
          />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Webhook secret:
            <Badge variant={secrets?.has_github_webhook_secret ? "default" : "outline"}>
              {secrets?.has_github_webhook_secret ? "configured" : "missing"}
            </Badge>
          </p>
          <TestButton target="github" label="Test connection" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Push notifications (Firebase)
          </CardTitle>
          <CardDescription>
            Device tokens are stored per user in the database, so notifications reach the reporter
            and the assignee on every device they enable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SetupSteps
            steps={[
              "Create a project in the Firebase console and add a Web app to it.",
              "Copy the web app config object and paste it below as JSON.",
              "In Project settings → Cloud Messaging generate a Web Push certificate and paste the key pair below.",
              "In Project settings → Service accounts generate a new private key and save the whole JSON file as the FIREBASE_SERVICE_ACCOUNT secret.",
              "Save the settings, run the connection test, then enable notifications on your device below.",
            ]}
            links={[
              { label: "Firebase console", href: "https://console.firebase.google.com/" },
              {
                label: "Web push setup guide",
                href: "https://firebase.google.com/docs/cloud-messaging/js/client",
              },
            ]}
          />
          <ToggleRow
            label="Push notifications enabled"
            checked={form.push_enabled}
            onChange={(value) => set("push_enabled", value)}
          />
          <CopyBlock label="Config template" value={FIREBASE_CONFIG_SAMPLE} />
          <div className="space-y-2">
            <Label htmlFor="firebase-config">Firebase web config (JSON)</Label>
            <Textarea
              id="firebase-config"
              rows={9}
              className="font-mono text-xs"
              value={form.firebase_config}
              onChange={(event) => set("firebase_config", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vapid">Web Push certificate key (VAPID)</Label>
            <Input
              id="vapid"
              value={form.firebase_vapid_key}
              onChange={(event) => set("firebase_vapid_key", event.target.value)}
              placeholder="BNc…"
            />
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Server credentials (FIREBASE_SERVICE_ACCOUNT):
            <Badge variant={secrets?.has_firebase_service_account ? "default" : "outline"}>
              {secrets?.has_firebase_service_account ? "configured" : "missing"}
            </Badge>
          </p>
          <TestButton target="firebase" label="Test connection" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> AI provider
          </CardTitle>
          <CardDescription>
            Choose the default assistant provider. Testers, monitors and auditors always use Gemini
            with their own key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SetupSteps
            steps={[
              "Lovable AI works out of the box — no key required.",
              "For Gemini, create an API key in Google AI Studio.",
              "Save it as the GOOGLE_API_KEY secret for a shared workspace key, or let each user add a personal key below.",
            ]}
            links={[
              { label: "Google AI Studio", href: "https://aistudio.google.com/app/apikey" },
              {
                label: "Gemini model list",
                href: "https://ai.google.dev/gemini-api/docs/models",
              },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Default provider</Label>
              <Select
                value={form.ai_default_provider}
                onValueChange={(value) => set("ai_default_provider", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI (no key needed)</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gemini model</Label>
              <Select value={form.gemini_model} onValueChange={(value) => set("gemini_model", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Shared Gemini key (GOOGLE_API_KEY):
            <Badge variant={secrets?.has_google_api_key ? "default" : "outline"}>
              {secrets?.has_google_api_key ? "configured" : "missing"}
            </Badge>
          </p>
          <TestButton target="ai" label="Test connection" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          Save integration settings
        </Button>
      </div>
    </div>
  );
}

function TestOutcome({ result }: { result?: TestResult | undefined }) {
  if (!result) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
        result.ok
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
      role="status"
    >
      {result.ok ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span className="break-words">
        {result.message}
        {result.ms > 0 && <span className="opacity-70"> · {result.ms} ms</span>}
      </span>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
