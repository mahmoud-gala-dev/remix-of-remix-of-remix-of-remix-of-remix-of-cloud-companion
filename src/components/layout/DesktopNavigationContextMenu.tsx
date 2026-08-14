import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bug,
  ChevronDown,
  ClipboardList,
  Clock,
  Compass,
  Copy,
  FolderKanban,
  GitCompare,
  Inbox,
  Languages,
  LayoutDashboard,
  Lightbulb,
  MessagesSquare,
  PieChart,
  RotateCcw,
  Settings,
  Timer,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type QuickProject = {
  id: number;
  name: string;
  key: string;
  status: string | null;
};

export function DesktopNavigationContextMenu({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, direction } = useI18n();

  const isArabic = language === "ar";

  const { data: projects = [] } = useQuery<QuickProject[]>({
    queryKey: ["projects-quick-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, key, status")
        .order("name", { ascending: true })
        .limit(12);
      if (error) return [];
      return (data ?? []) as QuickProject[];
    },
  });

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    toast.success(isArabic ? "تم نسخ رابط الصفحة إلى الحافظة" : "Page link copied to clipboard");
  };

  const handleToggleLang = () => {
    const next = isArabic ? "en" : "ar";
    setLanguage(next);
    toast.info(next === "ar" ? "تم التبديل إلى العربية" : "Switched to English");
  };

  return (
    <ContextMenu dir={direction}>
      <ContextMenuTrigger asChild>
        <div className="flex flex-1 flex-col overflow-hidden min-h-0 w-full">
          {children}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="hidden md:block w-64 shadow-2xl backdrop-blur-md bg-popover/98 border-border/80 rounded-xl p-1.5">
        <div className="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {isArabic ? "التنقل السريع" : "Quick Navigation"}
        </div>
        <ContextMenuSeparator />

        {/* ── Submenu 1: Workspace & Overview ─────────────────────────── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span>{isArabic ? "مساحة العمل والرئيسية" : "Workspace & Overview"}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "لوحة التحكم" : "Dashboard"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/my-work" })}
            >
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "مهامي" : "My Work"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/activity" })}
            >
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "سجل النشاط" : "Activity Feed"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/notifications" })}
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "الإشعارات" : "Notifications"}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Submenu 2: Bugs & Quality ───────────────────────────────── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <Bug className="h-4 w-4 text-destructive" />
            <span>{isArabic ? "إدارة الأخطاء والجودة" : "Bugs & Tracking"}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/bugs" })}
            >
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "قائمة الأخطاء" : "Bug Tracker"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/compare" })}
            >
              <GitCompare className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "مقارنة إكسل" : "Compare Excel"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/resolution-times" })}
            >
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "أوقات الحل" : "Resolution Times"}</span>
            </ContextMenuItem>
            {(user?.role === "developer" || user?.role === "admin") && (
              <ContextMenuItem
                className="gap-2.5 rounded-lg py-2 cursor-pointer"
                onClick={() => navigate({ to: "/pomodoro" })}
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{isArabic ? "مؤقت بومودورو" : "Pomodoro Focus"}</span>
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Submenu 3: Projects & Team (With Added Projects) ──────────── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <FolderKanban className="h-4 w-4 text-info" />
            <span>{isArabic ? "المشاريع والتعاون" : "Projects & Team"}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-64 max-h-[85vh] overflow-y-auto rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium"
              onClick={() => navigate({ to: "/projects" })}
            >
              <FolderKanban className="h-4 w-4 text-primary" />
              <span>{isArabic ? "جميع المشاريع" : "All Projects"}</span>
            </ContextMenuItem>

            {projects.length > 0 && (
              <>
                <ContextMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isArabic ? "المشاريع المضافة" : "Added Projects"}
                </div>
                {projects.map((proj) => (
                  <ContextMenuItem
                    key={proj.id}
                    className="gap-2 rounded-lg py-1.5 cursor-pointer justify-between"
                    onClick={() =>
                      navigate({ to: "/projects/$id", params: { id: String(proj.id) } })
                    }
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs font-medium">{proj.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                      {proj.key}
                    </span>
                  </ContextMenuItem>
                ))}
              </>
            )}

            <ContextMenuSeparator />
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/tasks" })}
            >
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "المهام ذات الأولوية" : "Priority Tasks"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/chat" })}
            >
              <MessagesSquare className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "شات الفريق" : "Team Chat"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/improvements" })}
            >
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "تحسينات السكربتات" : "Script Improvements"}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Submenu 4: Analytics & Reports ──────────────────────────── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <BarChart3 className="h-4 w-4 text-success" />
            <span>{isArabic ? "التحليلات والتقارير" : "Analytics & Reports"}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/analytics" })}
            >
              <PieChart className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "التحليلات الشاملة" : "Analytics"}</span>
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/reports" })}
            >
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "تقارير الأخطاء" : "Reports"}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Submenu 5: System & Settings ────────────────────────────── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>{isArabic ? "الإدارة والمساعدة" : "System & Settings"}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/docs" })}
            >
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "التوثيق والمساعدة" : "Documentation"}</span>
            </ContextMenuItem>
            {user?.role === "admin" && (
              <ContextMenuItem
                className="gap-2.5 rounded-lg py-2 cursor-pointer"
                onClick={() => navigate({ to: "/users" })}
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{isArabic ? "إدارة المستخدمين" : "Users Management"}</span>
              </ContextMenuItem>
            )}
            <ContextMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/settings" })}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "الإعدادات" : "Settings"}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* ── Quick Tools ─────────────────────────────────────────────── */}
        <ContextMenuItem className="gap-2.5 rounded-lg py-2 cursor-pointer" onClick={handleCopyLink}>
          <Copy className="h-4 w-4 text-muted-foreground" />
          <span>{isArabic ? "نسخ رابط الصفحة" : "Copy Page Link"}</span>
        </ContextMenuItem>
        <ContextMenuItem className="gap-2.5 rounded-lg py-2 cursor-pointer" onClick={handleToggleLang}>
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span>{isArabic ? "Switch to English" : "التبديل إلى العربية"}</span>
        </ContextMenuItem>
        <ContextMenuItem
          className="gap-2.5 rounded-lg py-2 cursor-pointer text-muted-foreground"
          onClick={() => window.location.reload()}
        >
          <RotateCcw className="h-4 w-4" />
          <span>{isArabic ? "تحديث الصفحة" : "Reload Page"}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Clickable Desktop Header Quick Navigation Menu with the same rich submenus + Added Projects
 */
export function DesktopQuickNavDropdown() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, direction } = useI18n();
  const isArabic = language === "ar";

  const { data: projects = [] } = useQuery<QuickProject[]>({
    queryKey: ["projects-quick-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, key, status")
        .order("name", { ascending: true })
        .limit(12);
      if (error) return [];
      return (data ?? []) as QuickProject[];
    },
  });

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium border-border/70 hover:bg-accent/80 transition-all rounded-lg"
        >
          <Compass className="h-3.5 w-3.5 text-primary" />
          <span>{isArabic ? "التنقل السريع" : "Quick Nav"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 shadow-2xl bg-popover/98 backdrop-blur-md border-border/80 rounded-xl p-1.5"
      >
        <div className="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {isArabic ? "أقسام النظام" : "System Sections"}
        </div>
        <DropdownMenuSeparator />

        {/* ── Submenu 1: Workspace & Overview ─────────────────────────── */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span>{isArabic ? "مساحة العمل والرئيسية" : "Workspace & Overview"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "لوحة التحكم" : "Dashboard"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/my-work" })}
            >
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "مهامي" : "My Work"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/activity" })}
            >
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "سجل النشاط" : "Activity Feed"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/notifications" })}
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "الإشعارات" : "Notifications"}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* ── Submenu 2: Bugs & Tracking ──────────────────────────────── */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <Bug className="h-4 w-4 text-destructive" />
            <span>{isArabic ? "إدارة وتتبع الأخطاء" : "Bugs & Tracking"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/bugs" })}
            >
              <Bug className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "قائمة الأخطاء" : "Bug Tracker"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/compare" })}
            >
              <GitCompare className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "مقارنة إكسل" : "Compare Excel"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/resolution-times" })}
            >
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "أوقات الحل" : "Resolution Times"}</span>
            </DropdownMenuItem>
            {(user?.role === "developer" || user?.role === "admin") && (
              <DropdownMenuItem
                className="gap-2.5 rounded-lg py-2 cursor-pointer"
                onClick={() => navigate({ to: "/pomodoro" })}
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{isArabic ? "مؤقت بومودورو" : "Pomodoro Focus"}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* ── Submenu 3: Projects & Collaboration (With Added Projects) ─ */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <FolderKanban className="h-4 w-4 text-info" />
            <span>{isArabic ? "المشاريع والتعاون" : "Projects & Team"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 max-h-[85vh] overflow-y-auto rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium"
              onClick={() => navigate({ to: "/projects" })}
            >
              <FolderKanban className="h-4 w-4 text-primary" />
              <span>{isArabic ? "جميع المشاريع" : "All Projects"}</span>
            </DropdownMenuItem>

            {projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isArabic ? "المشاريع المضافة" : "Added Projects"}
                </div>
                {projects.map((proj) => (
                  <DropdownMenuItem
                    key={proj.id}
                    className="gap-2 rounded-lg py-1.5 cursor-pointer justify-between"
                    onClick={() =>
                      navigate({ to: "/projects/$id", params: { id: String(proj.id) } })
                    }
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs font-medium">{proj.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                      {proj.key}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/tasks" })}
            >
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "المهام ذات الأولوية" : "Priority Tasks"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/chat" })}
            >
              <MessagesSquare className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "شات الفريق" : "Team Chat"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/improvements" })}
            >
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "تحسينات السكربتات" : "Script Improvements"}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* ── Submenu 4: Analytics & Reports ──────────────────────────── */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <BarChart3 className="h-4 w-4 text-success" />
            <span>{isArabic ? "التحليلات والتقارير" : "Analytics & Reports"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/analytics" })}
            >
              <PieChart className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "التحليلات الشاملة" : "Analytics"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/reports" })}
            >
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "تقارير الأخطاء" : "Reports"}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* ── Submenu 5: System & Settings ────────────────────────────── */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5 rounded-lg py-2 cursor-pointer">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>{isArabic ? "الإدارة والمساعدة" : "System & Settings"}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 rounded-xl p-1.5 shadow-2xl bg-popover/98 border-border/80">
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/docs" })}
            >
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "التوثيق والمساعدة" : "Documentation"}</span>
            </DropdownMenuItem>
            {user?.role === "admin" && (
              <DropdownMenuItem
                className="gap-2.5 rounded-lg py-2 cursor-pointer"
                onClick={() => navigate({ to: "/users" })}
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{isArabic ? "إدارة المستخدمين" : "Users Management"}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="gap-2.5 rounded-lg py-2 cursor-pointer"
              onClick={() => navigate({ to: "/settings" })}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>{isArabic ? "الإعدادات" : "Settings"}</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default DesktopNavigationContextMenu;
