import { describe, expect, it } from "vitest";
import { taskStatusTone } from "./InteractiveStatusEditor";
import { relativeCommentTime } from "../bugs/BugComments";

describe("taskStatusTone", () => {
  it("returns warning tone for Pending status", () => {
    expect(taskStatusTone("Pending")).toContain("bg-warning");
  });

  it("returns info tone for In Progress status", () => {
    expect(taskStatusTone("In Progress")).toContain("bg-info");
  });

  it("returns success tone for Done status", () => {
    expect(taskStatusTone("Done")).toContain("bg-success");
  });

  it("returns muted tone for unknown status", () => {
    expect(taskStatusTone("Unknown")).toContain("bg-muted");
  });
});

describe("relativeCommentTime", () => {
  it("returns 'Just now' for missing date inputs", () => {
    expect(relativeCommentTime(null)).toBe("Just now");
    expect(relativeCommentTime(undefined)).toBe("Just now");
    expect(relativeCommentTime("")).toBe("Just now");
  });

  it("returns 'Just now' for invalid date strings", () => {
    expect(relativeCommentTime("not-a-date")).toBe("Just now");
  });

  it("formats valid dates properly with relative distance", () => {
    const recentDate = new Date(Date.now() - 60000).toISOString();
    expect(relativeCommentTime(recentDate)).toContain("ago");
  });
});
