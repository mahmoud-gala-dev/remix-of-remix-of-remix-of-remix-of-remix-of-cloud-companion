import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserAvatar } from "@/context/AvatarContext";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Avatar URLs for every teammate. Cached once per session and shared by chat,
 * comments and any other member list, so a saved avatar shows up everywhere.
 */
export function useAvatarMap() {
  const query = useQuery({
    queryKey: ["profile-avatars"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("profiles").select("id, avatar_url");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.avatar_url) map[row.id] = row.avatar_url;
      }
      return map;
    },
  });
  return query.data ?? {};
}

/** Member avatar that falls back to initials when no picture is set. */
export function UserAvatar({
  userId,
  name,
  className,
}: {
  userId: string | null | undefined;
  name: string;
  className?: string;
}) {
  const avatars = useAvatarMap();
  const { user } = useAuth();
  const { avatarUrl } = useUserAvatar();
  // The live context value keeps the signed-in user's own avatar instant.
  const src = userId && user?.id === userId ? avatarUrl || avatars[userId] : (userId ? avatars[userId] : "");
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <Avatar className={cn("h-8 w-8 shrink-0 border border-border/50", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}
