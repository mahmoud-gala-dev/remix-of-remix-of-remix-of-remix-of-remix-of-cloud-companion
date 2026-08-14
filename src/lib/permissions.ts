import type { Bug } from "@/lib/api";

export type AppRole = "admin" | "developer" | "tester" | "supervisor" | "auditor" | "monitor";

/** Only testers, admins and supervisors may file new bugs. Developers may not. */
export function canReportBugs(role: string | null | undefined) {
  return role === "tester" || role === "admin" || role === "supervisor";
}

export function isStaffRole(role: string | null | undefined) {
  return role === "admin" || role === "supervisor";
}

export function isMonitorRole(role: string | null | undefined) {
  return role === "auditor" || role === "monitor";
}

/** Admins, supervisors, testers and monitors may create and assign priority tasks. */
export function canCreateTasks(role: string | null | undefined) {
  return role === "admin" || role === "supervisor" || role === "tester" || role === "monitor";
}


/**
 * A user can view a bug if:
 * 1. User is staff (admin / supervisor) or tester, OR
 * 2. User is the bug's reporter, OR
 * 3. User is the bug's assigned developer, OR
 * 4. The bug is unassigned (assigned_to is null or empty).
 *
 * CRITICAL RULE: If a bug is assigned to a specific developer, OTHER developers CANNOT view it.
 */
export function canViewBug(
  bug: Pick<Bug, "reported_by" | "assigned_to">,
  user: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!user?.id) return true;
  if (
    user.role === "admin" ||
    user.role === "supervisor" ||
    user.role === "tester" ||
    isMonitorRole(user.role)
  ) {
    return true;
  }
  if (bug.reported_by && bug.reported_by === user.id) return true;
  if (bug.assigned_to && bug.assigned_to === user.id) return true;

  // If assigned to another developer/user, hide from other developers
  if (bug.assigned_to && bug.assigned_to !== user.id) return false;

  // Unassigned bugs can be viewed so developers can claim them
  return true;
}

/**
 * Developers, reporters, assignees and staff may change a bug's status.
 * CRITICAL RULE: If a bug is assigned to a specific developer/user, ONLY that assigned user
 * (or reporter/staff) can edit its status. No OTHER developer may edit it.
 * If the bug is unassigned, any developer can update/claim its status.
 */
export function canChangeBugStatus(
  bug: Pick<Bug, "reported_by" | "assigned_to">,
  user: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!user?.id) return false;
  if (isStaffRole(user.role)) return true;
  if (bug.reported_by && bug.reported_by === user.id) return true;
  if (bug.assigned_to && bug.assigned_to === user.id) return true;

  // If assigned to a specific developer, other developers CANNOT edit it
  if (bug.assigned_to && bug.assigned_to !== user.id) return false;

  // If unassigned, developers can edit status
  return user.role === "developer";
}

/**
 * General bug editing (Priority, Severity, Assignee, Module, Notes, Tags) is ONLY allowed for:
 * 1. Staff (admin / supervisor)
 * 2. Reporter
 * 3. Assignee
 *
 * General developers CANNOT edit all bug data unless they are reporter/assignee/staff.
 */
export function canEditBug(
  bug: Pick<Bug, "reported_by" | "assigned_to">,
  user: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!user?.id) return false;
  if (isStaffRole(user.role)) return true;
  if (bug.reported_by && bug.reported_by === user.id) return true;
  if (bug.assigned_to && bug.assigned_to === user.id) return true;

  return false;
}

/**
 * Full bug/task detail editing (Priority, Severity, Assignee, Module, ...).
 * Developers are explicitly excluded: they may never reassign a bug to another
 * developer nor rewrite its specification — even when it is assigned to them.
 * Allowed: staff (admin / supervisor) and the reporter (tester).
 */
export function canEditBugDetails(
  bug: Pick<Bug, "reported_by" | "assigned_to">,
  user: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!user?.id) return false;
  if (isStaffRole(user.role)) return true;
  if (user.role === "developer") return false;
  return Boolean(bug.reported_by && bug.reported_by === user.id);
}

/**
 * Assignee editing / re-assignment permissions:
 * 1. Staff (admin / supervisor) may assign or reassign any bug.
 * 2. Reporter (tester) may assign or reassign their reported bugs.
 * 3. Developers may assign unassigned bugs or reassign bugs currently assigned to them.
 * 4. Other developers may NOT reassign bugs assigned to another developer.
 */
export function canAssignBug(
  bug: Pick<Bug, "reported_by" | "assigned_to">,
  user: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!user?.id) return false;
  if (isStaffRole(user.role)) return true;
  if (bug.reported_by && bug.reported_by === user.id) return true;
  if (user.role === "developer") {
    // Developers can assign unassigned bugs or reassign their own assigned bugs
    if (!bug.assigned_to || bug.assigned_to === user.id) return true;
  }
  return false;
}

/**
 * Lightweight collaboration fields (Tags, Notes) — open to staff, the reporter
 * and the assigned developer.
 */
export function canEditBugTagsNotes(
  bug: Pick<Bug, "reported_by" | "assigned_to">,
  user: { id?: string | null; role?: string | null } | null | undefined,
): boolean {
  return canEditBug(bug, user);
}

