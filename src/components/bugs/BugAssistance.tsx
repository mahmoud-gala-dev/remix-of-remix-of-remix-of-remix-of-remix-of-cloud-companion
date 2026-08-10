import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HandHelping, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError, type Profile } from "@/lib/api";
import {
  ASSISTANCE_STATUSES,
  ASSISTANCE_STATUS_LABELS,
  assistanceStatusLabel,
  isAssistanceStatus,
  type AssistanceStatus,
  updateAssistanceRequestStatus,
} from "@/lib/assistance-requests";
import { nameFor, type ProfileMap } from "@/components/bugs/types";

type AssistanceRequest = {
  id: number;
  bug_id: number;
  requester_id: string;
  target_user_id: string;
  type: string;
  message: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
};

function relativeAssistanceTime(value: string | null | undefined) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function BugAssistance({
  bugId,
  currentUserId,
  profiles,
  profileMap,
}: {
  bugId: number;
  currentUserId: string | null;
  profiles: Profile[];
  profileMap: ProfileMap;
}) {
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [type, setType] = useState<"help" | "meeting">("help");
  const [message, setMessage] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["assistance-requests", bugId, currentUserId],
    queryFn: async () => {
      // Visible only to the requester and the teammate who was asked.
      let query = supabase.from("assistance_requests").select("*").eq("bug_id", bugId);
      if (currentUserId) {
        query = query.or(`requester_id.eq.${currentUserId},target_user_id.eq.${currentUserId}`);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as AssistanceRequest[];
    },
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Not signed in");
      if (!targetUserId) throw new Error("Choose a teammate");
      const { error } = await supabase.from("assistance_requests").insert({
        bug_id: bugId,
        requester_id: currentUserId,
        target_user_id: targetUserId,
        type,
        message: message.trim() || null,
        status: "pending",
      });
      // The teammate is notified by a database trigger on assistance_requests.
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      setMessage("");
      setTargetUserId("");
      queryClient.invalidateQueries({ queryKey: ["assistance-requests", bugId] });
      toast.success("Request sent");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: updateAssistanceRequestStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistance-requests", bugId] });
      toast.success("Assistance status updated");
    },
    onError: (err: Error) => toast.error(friendlyDbError(err)),
  });

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandHelping className="h-4 w-4" /> Ask for Assistance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Teammate" />
            </SelectTrigger>
            <SelectContent>
              {profiles
                .filter((p) => p.id !== currentUserId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.username}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as "help" | "meeting")}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="help">Ask for help</SelectItem>
              <SelectItem value="meeting">Request meeting</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional message..."
          rows={2}
        />
        <Button size="sm" disabled={createRequest.isPending} onClick={() => createRequest.mutate()}>
          {type === "meeting" ? (
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <HandHelping className="mr-1.5 h-3.5 w-3.5" />
          )}
          Send request
        </Button>

        <div className="space-y-2 pt-2">
          {requests.map((request) => {
            const canChangeStatus =
              currentUserId === request.target_user_id || currentUserId === request.requester_id;
            const status = isAssistanceStatus(request.status) ? request.status : "pending";

            return (
              <div
                key={request.id}
                className="flex flex-col gap-3 rounded-md border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="font-medium">{nameFor(profileMap, request.requester_id)}</span>
                    {" -> "}
                    <span className="font-medium">
                      {nameFor(profileMap, request.target_user_id)}
                    </span>
                    {" - "}
                    {request.type === "meeting" ? "meeting" : "help"}
                  </p>
                  {request.message && (
                    <p className="truncate text-muted-foreground">{request.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {relativeAssistanceTime(request.created_at)}
                    {request.responded_at
                      ? ` - Updated ${relativeAssistanceTime(request.responded_at)}`
                      : ""}
                  </p>
                </div>
                {canChangeStatus ? (
                  <Select
                    value={status}
                    onValueChange={(value) =>
                      updateStatus.mutate({
                        id: request.id,
                        status: value as AssistanceStatus,
                      })
                    }
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSISTANCE_STATUSES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {ASSISTANCE_STATUS_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{assistanceStatusLabel(request.status)}</Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
