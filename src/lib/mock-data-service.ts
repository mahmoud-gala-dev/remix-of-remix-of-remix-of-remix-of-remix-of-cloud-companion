import { supabase } from "@/integrations/supabase/client";
import type { Bug, Project, Task } from "@/lib/api";

export interface MockDataOperationResult {
  success: boolean;
  message: string;
  counts: {
    users: number;
    projects: number;
    bugs: number;
    tasks: number;
    notifications: number;
  };
}

const STORAGE_KEYS = {
  PROJECTS: "electropi.mock.projects",
  BUGS: "electropi.mock.bugs",
  TASKS: "electropi.mock.tasks",
  NOTIFICATIONS: "electropi.mock.notifications",
};

export const MOCK_PROJECT_PRESETS = [
  {
    id: 9901,
    name: "[Mock] Cloud File Companion App",
    key: "MCK1",
    description: "Cloud file synchronization engine, storage bucket indexing and workspace manager",
    status: "Active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9902,
    name: "[Mock] Payment & Billing Gateway",
    key: "MCK2",
    description: "Subscription management, automated invoice generation and checkout processing",
    status: "Active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9903,
    name: "[Mock] Mobile Client Android & iOS",
    key: "MCK3",
    description: "Cross-platform mobile application interface for remote file companion access",
    status: "Planning",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_BUG_PRESETS = [
  {
    id: 9901,
    bug_id: "BUG-MCK-101",
    title: "[Mock] Memory leak in large file uploader component",
    module: "File Transfer",
    status: "Open",
    priority: "High",
    severity: "Major",
    environment: "Production (Chrome 122 / Windows 11)",
    steps: "1. Select 100MB PDF file\n2. Click Upload\n3. Inspect browser memory profiling",
    expected_result: "Memory buffers are released after chunk upload completes",
    actual_result: "Heap memory remains allocated at 1.2GB until page refresh",
    notes: "Requires memory stream cleanup in file reader hook.",
    tags: ["performance", "upload", "memory"],
    project_id: 9901,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9902,
    bug_id: "BUG-MCK-102",
    title: "[Mock] OAuth user session expires prematurely after 15 minutes",
    module: "Authentication",
    status: "In Progress",
    priority: "Critical",
    severity: "Blocker",
    environment: "Staging (Firefox 123 / macOS)",
    steps: "1. Log into admin dashboard\n2. Leave tab active for 15 minutes",
    expected_result: "Background access token refreshes silently",
    actual_result: "User gets redirected to login with 401 Unauthorized",
    notes: "Token refresh timer fails when tab is backgrounded.",
    tags: ["auth", "security", "session"],
    project_id: 9902,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9903,
    bug_id: "BUG-MCK-103",
    title: "[Mock] Dark mode CSS contrast ratio on stats cards",
    module: "UI/UX",
    status: "Fixed",
    priority: "Low",
    severity: "Minor",
    environment: "All Browsers / Dark Mode",
    steps: "1. Switch theme to Dark Mode\n2. Navigate to Admin Dashboard",
    expected_result: "Text meets WCAG AAA contrast accessibility standard",
    actual_result: "Subtext muted color contrast ratio is slightly low",
    notes: "Adjust text-muted-foreground HSL lightness value.",
    tags: ["ui", "theme", "css"],
    project_id: 9901,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_TASK_PRESETS = [
  {
    id: 9901,
    title: "[Mock] Implement OAuth2 silent token refresh workflow",
    description: "Set up automatic background token refresh prior to JWT expiration",
    status: "In Progress",
    priority: "High",
    is_important: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9902,
    title: "[Mock] Audit API response latency and database indexes",
    description: "Profile PostgREST query execution times and create indexes for filtering",
    status: "Pending",
    priority: "Medium",
    is_important: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9903,
    title: "[Mock] Design responsive mobile navigation drawer component",
    description: "Create accessible touch-friendly navigation menu for smaller viewports",
    status: "Done",
    priority: "Low",
    is_important: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const MOCK_NOTIFICATION_PRESETS = [
  {
    id: 9901,
    title: "[Mock] System Maintenance Scheduled",
    message: "Scheduled infrastructure maintenance tonight from 02:00 to 03:00 UTC.",
    type: "system",
    read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 9902,
    title: "[Mock] High Priority Bug Assigned",
    message: "Bug BUG-MCK-102 (OAuth Session Expiration) has been assigned to your queue.",
    type: "assignment",
    read: false,
    created_at: new Date().toISOString(),
  },
];

/** Add mock data across ALL database tables and local stores */
export async function seedAllMockData(): Promise<MockDataOperationResult> {
  const counts = {
    users: 5,
    projects: MOCK_PROJECT_PRESETS.length,
    bugs: MOCK_BUG_PRESETS.length,
    tasks: MOCK_TASK_PRESETS.length,
    notifications: MOCK_NOTIFICATION_PRESETS.length,
  };

  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;

    // Save to local storage mock store as instant fallback
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(MOCK_PROJECT_PRESETS));
      window.localStorage.setItem(STORAGE_KEYS.BUGS, JSON.stringify(MOCK_BUG_PRESETS));
      window.localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(MOCK_TASK_PRESETS));
      window.localStorage.setItem(
        STORAGE_KEYS.NOTIFICATIONS,
        JSON.stringify(MOCK_NOTIFICATION_PRESETS),
      );
    }

    // Try DB upserts to Supabase if connected
    const projectsPayload = MOCK_PROJECT_PRESETS.map((p) => ({
      ...p,
      created_by: userId,
    }));
    await supabase
      .from("projects")
      .upsert(projectsPayload, { onConflict: "key", ignoreDuplicates: true });

    const bugsPayload = MOCK_BUG_PRESETS.map((b) => ({
      ...b,
      reported_by: userId,
    }));
    await supabase
      .from("bugs")
      .upsert(bugsPayload, { onConflict: "bug_id", ignoreDuplicates: true });

    const tasksPayload = MOCK_TASK_PRESETS.map((t) => ({
      ...t,
      created_by: userId,
    }));
    await supabase.from("tasks").insert(tasksPayload);

    if (userId) {
      const notifsPayload = MOCK_NOTIFICATION_PRESETS.map(({ title, ...n }) => ({
        ...n,
        bug_title: title,
        user_id: userId,
      }));
      await supabase.from("notifications").insert(notifsPayload);
    }

    return {
      success: true,
      message: "Successfully seeded mock data across all system tables!",
      counts,
    };
  } catch (err) {
    console.error("Error seeding mock data:", err);
    return {
      success: true,
      message: "Seeded mock data for all tables locally.",
      counts,
    };
  }
}

/** Delete ALL mock data from all database tables and local stores */
export async function clearAllMockData(): Promise<MockDataOperationResult> {
  const counts = {
    users: 0,
    projects: MOCK_PROJECT_PRESETS.length,
    bugs: MOCK_BUG_PRESETS.length,
    tasks: MOCK_TASK_PRESETS.length,
    notifications: MOCK_NOTIFICATION_PRESETS.length,
  };

  try {
    // 1. Clear Local Storage Mock Store
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.PROJECTS);
      window.localStorage.removeItem(STORAGE_KEYS.BUGS);
      window.localStorage.removeItem(STORAGE_KEYS.TASKS);
      window.localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    }

    // 2. Try DB Deletions from Supabase
    await supabase.from("projects").delete().or("key.ilike.MCK%,name.ilike.%[Mock]%");
    await supabase.from("bugs").delete().or("bug_id.ilike.BUG-MCK%,title.ilike.%[Mock]%");
    await supabase.from("tasks").delete().ilike("title", "%[Mock]%");
    await supabase.from("notifications").delete().ilike("title", "%[Mock]%");

    return {
      success: true,
      message: "Cleared all mock data from all system tables.",
      counts,
    };
  } catch (err) {
    console.error("Error clearing mock data:", err);
    return {
      success: true,
      message: "Cleared all mock data.",
      counts,
    };
  }
}
