import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const AVATAR_STORAGE_KEY = "electropi.user.avatarUrl";

export type AvatarContextType = {
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
};

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [avatarUrl, setAvatarUrlState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(AVATAR_STORAGE_KEY) || "";
  });

  // Keep localStorage and Supabase profile in sync when avatar changes
  const setAvatarUrl = (url: string) => {
    const trimmed = url.trim();
    setAvatarUrlState(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) {
        window.localStorage.setItem(AVATAR_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(AVATAR_STORAGE_KEY);
      }
    }
  };

  // Sync avatar on auth initialization if user is logged in
  useEffect(() => {
    let mounted = true;
    async function loadUserAvatar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted && profile && (profile as { avatar_url?: string }).avatar_url) {
        const remoteAvatar = (profile as { avatar_url?: string }).avatar_url || "";
        if (remoteAvatar) {
          setAvatarUrlState(remoteAvatar);
          window.localStorage.setItem(AVATAR_STORAGE_KEY, remoteAvatar);
        }
      }
    }

    loadUserAvatar();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AvatarContext.Provider value={{ avatarUrl, setAvatarUrl }}>{children}</AvatarContext.Provider>
  );
}

/** Custom Hook to access global user avatar state across the app. */
export function useUserAvatar(): AvatarContextType {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error("useUserAvatar must be used within an AvatarProvider");
  }
  return context;
}
