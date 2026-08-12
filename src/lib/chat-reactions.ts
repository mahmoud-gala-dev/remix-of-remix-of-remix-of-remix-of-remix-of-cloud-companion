import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

export type MessageReaction = Database["public"]["Tables"]["message_reactions"]["Row"];

/** Quick-access emoji shown in the reaction bar and the composer picker. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "✅", "👀"] as const;

export const EMOJI_PALETTE = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😎", "🤔",
  "😐", "😴", "😢", "😡", "🤯", "🥳", "🤝", "🙏",
  "👍", "👎", "👏", "💪", "🙌", "✌️", "👌", "👀",
  "❤️", "🔥", "⭐", "✅", "❌", "⚠️", "🎯", "🚀",
  "🐛", "🛠️", "💡", "📌", "📎", "📊", "⏱️", "🎉",
] as const;

export async function fetchReactions(messageIds: number[]): Promise<MessageReaction[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", messageIds);
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

/** Adds the emoji, or removes it when the same user already reacted with it. */
export async function toggleReaction(input: {
  messageId: number;
  userId: string;
  emoji: string;
  existingId?: number | null;
}) {
  if (input.existingId) {
    const { error } = await supabase.from("message_reactions").delete().eq("id", input.existingId);
    if (error) throw new Error(friendlyDbError(error));
    return;
  }
  const { error } = await supabase.from("message_reactions").insert({
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
  });
  if (error) throw new Error(friendlyDbError(error));
}

export type ReactionGroup = { emoji: string; count: number; mine: number | null; users: string[] };

/** Groups reactions of one message by emoji, flagging the current user's own. */
export function groupReactions(
  reactions: MessageReaction[],
  messageId: number,
  userId: string | undefined,
): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  reactions
    .filter((reaction) => Number(reaction.message_id) === messageId)
    .forEach((reaction) => {
      const group = groups.get(reaction.emoji) ?? {
        emoji: reaction.emoji,
        count: 0,
        mine: null,
        users: [],
      };
      group.count += 1;
      group.users.push(reaction.user_id);
      if (userId && reaction.user_id === userId) group.mine = Number(reaction.id);
      groups.set(reaction.emoji, group);
    });
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}
