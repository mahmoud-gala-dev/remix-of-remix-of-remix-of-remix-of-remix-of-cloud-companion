import { supabase } from "@/integrations/supabase/client";

export const ASSISTANCE_STATUSES = [
  "pending",
  "received",
  "commented",
  "resolved",
  "declined",
] as const;

export type AssistanceStatus = (typeof ASSISTANCE_STATUSES)[number];

export const ASSISTANCE_STATUS_LABELS: Record<AssistanceStatus, string> = {
  pending: "Pending",
  received: "Received",
  commented: "Commented",
  resolved: "Resolved",
  declined: "Declined",
};

export function isAssistanceStatus(value: string): value is AssistanceStatus {
  return ASSISTANCE_STATUSES.includes(value as AssistanceStatus);
}

export function assistanceStatusLabel(value: string) {
  return isAssistanceStatus(value) ? ASSISTANCE_STATUS_LABELS[value] : value;
}

function respondedAtFor(status: AssistanceStatus) {
  return status === "pending" ? null : new Date().toISOString();
}

export async function updateAssistanceRequestStatus({
  id,
  status,
}: {
  id: number;
  status: AssistanceStatus;
}) {
  const { error } = await supabase
    .from("assistance_requests")
    .update({ status, responded_at: respondedAtFor(status) })
    .eq("id", id);

  if (error) throw error;
}

export async function markAssistanceReceivedForBug({
  bugId,
  targetUserId,
}: {
  bugId: number;
  targetUserId: string;
}) {
  const { error } = await supabase
    .from("assistance_requests")
    .update({ status: "received", responded_at: new Date().toISOString() })
    .eq("bug_id", bugId)
    .eq("target_user_id", targetUserId)
    .eq("status", "pending");

  if (error) throw error;
}

export async function markAssistanceCommentedForBug({
  bugId,
  targetUserId,
}: {
  bugId: number;
  targetUserId: string;
}) {
  const { error } = await supabase
    .from("assistance_requests")
    .update({ status: "commented", responded_at: new Date().toISOString() })
    .eq("bug_id", bugId)
    .eq("target_user_id", targetUserId)
    .in("status", ["pending", "received"]);

  if (error) throw error;
}
