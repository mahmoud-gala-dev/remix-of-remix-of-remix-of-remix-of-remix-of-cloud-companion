import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, BellOff, KeyRound, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  deleteMyGeminiKey,
  fetchMyAiStatus,
  fetchPublicSettings,
  registerDeviceToken,
  removeDeviceToken,
  saveMyGeminiKey,
  sendPushTest,
} from "@/lib/integrations.functions";
import { isPushSupported, notificationPermission, requestPushToken } from "@/lib/push";

const TOKEN_STORAGE_KEY = "electropi.push.token";

/** Lets each user enable push notifications on this device and store their own Gemini key. */
export function UserIntegrationSettings() {
  const queryClient = useQueryClient();
  const loadPublic = useServerFn(fetchPublicSettings);
  const loadAi = useServerFn(fetchMyAiStatus);
  const register = useServerFn(registerDeviceToken);
  const unregister = useServerFn(removeDeviceToken);
  const pushTest = useServerFn(sendPushTest);
  const saveKey = useServerFn(saveMyGeminiKey);
  const deleteKey = useServerFn(deleteMyGeminiKey);

  const [apiKey, setApiKey] = useState("");
  const [localToken, setLocalToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLocalToken(window.localStorage.getItem(TOKEN_STORAGE_KEY));
    }
  }, []);

  const publicSettings = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => loadPublic(),
  });
  const aiStatus = useQuery({ queryKey: ["my-ai-status"], queryFn: () => loadAi() });

  const enablePush = useMutation({
    mutationFn: async () => {
      const settings = publicSettings.data;
      if (!settings?.push_enabled) throw new Error("Push notifications are disabled by an admin.");
      const token = await requestPushToken(
        settings.firebase_config,
        settings.firebase_vapid_key ?? "",
      );
      await register({ data: { token, platform: "web", userAgent: navigator.userAgent } });
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setLocalToken(token);
    },
    onSuccess: () => toast.success("Notifications enabled on this device"),
    onError: (error: Error) => toast.error(error.message),
  });

  const disablePush = useMutation({
    mutationFn: async () => {
      if (!localToken) return;
      await unregister({ data: { token: localToken } });
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      setLocalToken(null);
    },
    onSuccess: () => toast.success("Notifications disabled on this device"),
    onError: (error: Error) => toast.error(error.message),
  });

  const testPush = useMutation({
    mutationFn: () => pushTest(),
    onSuccess: (result) => toast.success(`Test notification sent to ${result.sent} device(s)`),
    onError: (error: Error) => toast.error(error.message),
  });

  const storeKey = useMutation({
    mutationFn: () => saveKey({ data: { apiKey } }),
    onSuccess: () => {
      setApiKey("");
      toast.success("Gemini API key saved");
      queryClient.invalidateQueries({ queryKey: ["my-ai-status"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dropKey = useMutation({
    mutationFn: () => deleteKey(),
    onSuccess: () => {
      toast.success("Gemini API key removed");
      queryClient.invalidateQueries({ queryKey: ["my-ai-status"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permission = notificationPermission();
  const pushAvailable = isPushSupported() && Boolean(publicSettings.data?.push_enabled);
  const ai = aiStatus.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Device notifications
          </CardTitle>
          <CardDescription>
            Get an alert on this device when a bug is assigned to you or one of your bugs changes
            status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushAvailable ? (
            <p className="text-sm text-muted-foreground">
              {publicSettings.isLoading
                ? "Checking notification settings…"
                : isPushSupported()
                  ? "Push notifications are not enabled for this workspace yet."
                  : "This browser does not support push notifications."}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={localToken ? "default" : "outline"}>
                  {localToken ? "Enabled on this device" : "Not enabled"}
                </Badge>
                {permission === "denied" && (
                  <Badge variant="destructive">Blocked in browser settings</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {localToken ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disablePush.isPending}
                      onClick={() => disablePush.mutate()}
                    >
                      {disablePush.isPending ? (
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      ) : (
                        <BellOff className="me-2 h-4 w-4" />
                      )}
                      Turn off
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={testPush.isPending}
                      onClick={() => testPush.mutate()}
                    >
                      {testPush.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      Send test notification
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    disabled={enablePush.isPending || permission === "denied"}
                    onClick={() => enablePush.mutate()}
                  >
                    {enablePush.isPending ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="me-2 h-4 w-4" />
                    )}
                    Enable notifications
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> AI assistant
          </CardTitle>
          <CardDescription>
            {ai?.geminiOnly
              ? "Your role uses Google Gemini with your own API key."
              : "The workspace default provider is used unless you add your own Gemini key."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Provider in use:</span>
            <Badge variant="secondary">
              {ai?.effectiveProvider === "gemini" ? `Gemini · ${ai.geminiModel}` : "Lovable AI"}
            </Badge>
            {ai?.hasOwnKey && <Badge variant="outline">Personal key saved</Badge>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="gemini-key">Your Gemini API key</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="gemini-key"
                type="password"
                autoComplete="off"
                placeholder="AIza…"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <Button
                onClick={() => storeKey.mutate()}
                disabled={storeKey.isPending || apiKey.trim().length < 20}
              >
                {storeKey.isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="me-2 h-4 w-4" />
                )}
                Save key
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a key in Google AI Studio. It is encrypted before it is stored and never shown
              again.
            </p>
          </div>
          {ai?.hasOwnKey && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={dropKey.isPending}
              onClick={() => dropKey.mutate()}
            >
              {dropKey.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="me-2 h-4 w-4" />
              )}
              Remove my key
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
