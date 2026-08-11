import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Bug,
  ClipboardList,
  FolderKanban,
  GitCompare,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  MessagesSquare,
  ShieldAlert,
  Timer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, signOut } from "@/lib/auth";
import { fetchChatActivity, unreadByProject } from "@/lib/chat";
import { useUserAvatar } from "@/context/AvatarContext";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bugs", label: "Bugs", icon: Bug },
  { to: "/compare", label: "Compare Excel", icon: GitCompare },
  { to: "/tasks", label: "Priority Tasks", icon: ClipboardList },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/chat", label: "Team Chat", icon: MessagesSquare },
  { to: "/activity", label: "Activity Feed", icon: Activity },
  { to: "/resolution-times", label: "Resolution Times", icon: Timer },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  const { data: chatActivity = [] } = useQuery({
    queryKey: ["chat-activity"],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: () => fetchChatActivity(),
  });

  const chatUnread = Object.values(unreadByProject(chatActivity, user?.id)).reduce(
    (total, count) => total + count,
    0,
  );

  const mobileTabs = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/bugs", label: "Bugs", icon: Bug },
    { to: "/tasks", label: "Tasks", icon: ClipboardList },
    { to: "/chat", label: "Chat", icon: MessagesSquare },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/settings", label: "More", icon: Settings },
  ];

  const navItems = [
    ...baseNav,
    ...(user?.role === "admin" ? [{ to: "/users", label: "Users", icon: Users }] : []),
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = async () => {
    setMobileOpen(false);
    await signOut(queryClient);
    navigate({ to: "/", replace: true });
  };

  const navList = (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.to || location.pathname.startsWith(item.to + "/");
        const badgeCount = item.to === "/chat" ? chatUnread : 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            <item.icon className="mr-3 h-5 w-5" aria-hidden="true" />
            {item.label}
            {badgeCount > 0 && !isActive && (
              <Badge className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px]">
                {badgeCount > 99 ? "99+" : badgeCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );


  const { avatarUrl } = useUserAvatar();

  const userFooter = (
    <div className="border-t border-sidebar-border p-4">
      <div className="mb-4 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={user?.username ?? "User Avatar"} /> : null}
          <AvatarFallback className="bg-primary/15 font-medium text-primary">
            {user?.username?.substring(0, 2).toUpperCase() ?? "??"}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{user?.username ?? "…"}</span>
          <span className="text-xs uppercase text-muted-foreground">{user?.role ?? ""}</span>
        </div>
      </div>
      <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <ShieldAlert className="mr-2 h-6 w-6 text-primary" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">ElectroPI</span>
        </div>
        {navList}
        {userFooter}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0">
                <SheetTitle className="flex h-16 items-center border-b border-sidebar-border px-6 text-lg font-bold">
                  <ShieldAlert className="mr-2 h-6 w-6 text-primary" aria-hidden="true" />
                  ElectroPI
                </SheetTitle>
                {navList}
                {userFooter}
              </SheetContent>
            </Sheet>
            <ShieldAlert className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="text-lg font-bold">ElectroPI</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            <Link
              to="/notifications"
              className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6 md:pb-6">{children}</main>

        {/* Mobile bottom tab bar — native app feel on small screens */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Primary mobile"
        >
          {mobileTabs.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            const showDot = item.to === "/chat" && chatUnread > 0 && !isActive;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {showDot && (
                    <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-card bg-destructive" />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
