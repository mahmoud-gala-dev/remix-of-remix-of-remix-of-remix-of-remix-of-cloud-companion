import { describe, expect, it } from "vitest";
import {
  applyBugFilters,
  escapeOrValue,
  friendlyDbError,
  isSafeHttpUrl,
  isStoragePath,
  pageRange,
  priorityTone,
  statusTone,
  validateAttachmentFile,
  type BugQueryBuilder,
} from "@/lib/api";

type Call = [string, ...unknown[]];

function fakeBuilder() {
  const calls: Call[] = [];
  const builder: BugQueryBuilder = {
    eq: (c, v) => (calls.push(["eq", c, v]), builder),
    is: (c, v) => (calls.push(["is", c, v]), builder),
    or: (f) => (calls.push(["or", f]), builder),
  };
  return { builder, calls };
}

describe("presentation helpers", () => {
  it("statusTone maps known statuses to distinct tones", () => {
    expect(statusTone("Open")).toContain("destructive");
    expect(statusTone("In Progress")).toContain("info");
    expect(statusTone("Fixed")).toContain("success");
    expect(statusTone("Done")).toContain("success");
    expect(statusTone("Reopened")).toContain("warning");
    expect(statusTone("Closed")).toContain("muted");
  });

  it("priorityTone maps severity and priority values", () => {
    expect(priorityTone("Critical")).toContain("destructive");
    expect(priorityTone("Blocker")).toContain("destructive");
    expect(priorityTone("High")).toContain("warning");
    expect(priorityTone("Major")).toContain("warning");
    expect(priorityTone("Medium")).toContain("info");
    expect(priorityTone("Low")).toContain("muted");
  });
});

describe("pagination", () => {
  it("computes inclusive ranges for 1-based pages", () => {
    expect(pageRange(1, 20)).toEqual({ from: 0, to: 19 });
    expect(pageRange(3, 20)).toEqual({ from: 40, to: 59 });
  });

  it("clamps invalid page numbers to the first page", () => {
    expect(pageRange(0, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(-5, 10)).toEqual({ from: 0, to: 9 });
    expect(pageRange(Number.NaN, 10)).toEqual({ from: 0, to: 9 });
  });
});

describe("applyBugFilters", () => {
  it("ignores empty and 'All' filters", () => {
    const { builder, calls } = fakeBuilder();
    applyBugFilters(builder, { status: "All", priority: "", search: "   " });
    expect(calls).toEqual([]);
  });

  it("applies equality filters server-side", () => {
    const { builder, calls } = fakeBuilder();
    applyBugFilters(builder, {
      status: "Open",
      priority: "High",
      severity: "Blocker",
      module: "Auth",
      project: "7",
      assignee: "user-1",
    });
    expect(calls).toEqual([
      ["eq", "status", "Open"],
      ["eq", "priority", "High"],
      ["eq", "severity", "Blocker"],
      ["eq", "module", "Auth"],
      ["eq", "project_id", 7],
      ["eq", "assigned_to", "user-1"],
    ]);
  });

  it("supports the unassigned bucket and free-text search", () => {
    const { builder, calls } = fakeBuilder();
    applyBugFilters(builder, { assignee: "unassigned", search: "login" });
    expect(calls).toEqual([
      ["is", "assigned_to", null],
      ["or", "title.ilike.%login%,bug_id.ilike.%login%"],
    ]);
  });

  it("neutralises PostgREST metacharacters in search", () => {
    expect(escapeOrValue("a,b(c)")).toBe("a b c");
    const { builder, calls } = fakeBuilder();
    applyBugFilters(builder, { search: "a,b(c)" });
    expect(calls[0]?.[1]).toBe("title.ilike.%a b c%,bug_id.ilike.%a b c%");
  });
});

describe("attachment helpers", () => {
  it("only accepts http(s) links", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
  });

  it("detects storage paths versus inline/remote content", () => {
    expect(isStoragePath("uid/12/abc.png")).toBe(true);
    expect(isStoragePath("data:image/png;base64,AAA")).toBe(false);
    expect(isStoragePath("https://example.com/a.png")).toBe(false);
  });

  it("rejects oversized files and unsupported types", () => {
    expect(validateAttachmentFile({ name: "a.png", type: "image/png", size: 1000 })).toBeNull();
    expect(
      validateAttachmentFile({ name: "a.pdf", type: "application/pdf", size: 1000 }),
    ).toBeNull();
    expect(
      validateAttachmentFile({ name: "a.exe", type: "application/x-msdownload", size: 10 }),
    ).toMatch(/only images, videos, and PDF/i);
    expect(
      validateAttachmentFile({ name: "big.png", type: "image/png", size: 60 * 1024 * 1024 }),
    ).toMatch(/larger than/i);
  });
});

describe("friendlyDbError", () => {
  it("translates duplicate bug ids", () => {
    expect(
      friendlyDbError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "bugs_bug_id_key"',
      }),
    ).toBe("That Bug ID is already in use.");
  });

  it("translates RLS denials", () => {
    expect(
      friendlyDbError({ code: "42501", message: "new row violates row-level security policy" }),
    ).toMatch(/permission/i);
  });
});
