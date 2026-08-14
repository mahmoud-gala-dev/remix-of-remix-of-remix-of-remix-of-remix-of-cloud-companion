import { describe, expect, it } from "vitest";
import {
  canAssignBug,
  canChangeBugStatus,
  canEditBug,
  canReportBugs,
  canViewBug,
  isMonitorRole,
  isStaffRole,
} from "@/lib/permissions";

const assignedBug = { reported_by: "tester-1", assigned_to: "developer-1" };
const unassignedBug = { reported_by: "tester-1", assigned_to: null };

describe("role permissions", () => {
  it("allows only reporting roles to create bugs", () => {
    expect(canReportBugs("admin")).toBe(true);
    expect(canReportBugs("supervisor")).toBe(true);
    expect(canReportBugs("tester")).toBe(true);
    expect(canReportBugs("developer")).toBe(false);
    expect(canReportBugs("auditor")).toBe(false);
    expect(canReportBugs("monitor")).toBe(false);
  });

  it("classifies staff and monitor roles separately", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("supervisor")).toBe(true);
    expect(isStaffRole("auditor")).toBe(false);
    expect(isMonitorRole("auditor")).toBe(true);
    expect(isMonitorRole("monitor")).toBe(true);
    expect(isMonitorRole("developer")).toBe(false);
  });

  it("lets auditors and monitors view assigned bugs without edit rights", () => {
    for (const role of ["auditor", "monitor"]) {
      const user = { id: `${role}-1`, role };
      expect(canViewBug(assignedBug, user)).toBe(true);
      expect(canEditBug(assignedBug, user)).toBe(false);
      expect(canChangeBugStatus(assignedBug, user)).toBe(false);
    }
  });

  it("prevents unrelated developers from viewing or editing assigned bugs", () => {
    const otherDeveloper = { id: "developer-2", role: "developer" };
    expect(canViewBug(assignedBug, otherDeveloper)).toBe(false);
    expect(canEditBug(assignedBug, otherDeveloper)).toBe(false);
    expect(canChangeBugStatus(assignedBug, otherDeveloper)).toBe(false);
  });

  it("allows assigned developers and reporters to update their own bug status", () => {
    expect(canChangeBugStatus(assignedBug, { id: "developer-1", role: "developer" })).toBe(true);
    expect(canChangeBugStatus(assignedBug, { id: "tester-1", role: "tester" })).toBe(true);
    expect(canEditBug(assignedBug, { id: "developer-1", role: "developer" })).toBe(true);
  });

  it("allows developers to claim/update unassigned bugs", () => {
    const developer = { id: "developer-2", role: "developer" };
    expect(canViewBug(unassignedBug, developer)).toBe(true);
    expect(canChangeBugStatus(unassignedBug, developer)).toBe(true);
    expect(canEditBug(unassignedBug, developer)).toBe(false);
  });

  it("handles assignment and re-assignment permissions correctly", () => {
    const assignedDev = { id: "developer-1", role: "developer" };
    const otherDev = { id: "developer-2", role: "developer" };
    const admin = { id: "admin-1", role: "admin" };
    const supervisor = { id: "supervisor-1", role: "supervisor" };
    const tester = { id: "tester-1", role: "tester" };
    const monitor = { id: "monitor-1", role: "monitor" };
    const auditor = { id: "auditor-1", role: "auditor" };

    // Staff, Testers, and Monitors/Auditors can assign bugs
    expect(canAssignBug(assignedBug, admin)).toBe(true);
    expect(canAssignBug(unassignedBug, admin)).toBe(true);
    expect(canAssignBug(assignedBug, supervisor)).toBe(true);
    expect(canAssignBug(assignedBug, tester)).toBe(true);
    expect(canAssignBug(unassignedBug, tester)).toBe(true);
    expect(canAssignBug(assignedBug, monitor)).toBe(true);
    expect(canAssignBug(assignedBug, auditor)).toBe(true);

    // Developers can NEVER assign or reassign bugs
    expect(canAssignBug(assignedBug, assignedDev)).toBe(false);
    expect(canAssignBug(unassignedBug, otherDev)).toBe(false);
    expect(canAssignBug(assignedBug, otherDev)).toBe(false);
  });
});

