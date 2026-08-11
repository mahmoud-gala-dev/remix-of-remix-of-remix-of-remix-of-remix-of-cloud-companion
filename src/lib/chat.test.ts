import { describe, expect, it } from "vitest";
import {
  activeMentionQuery,
  applyMention,
  extractMentions,
  mentionsUser,
  splitMentions,
  unreadByProject,
} from "@/lib/chat";

describe("chat mentions", () => {
  it("extracts unique lowercase mentions", () => {
    expect(extractMentions("hi @Sara and @sara and @dev_1")).toEqual(["sara", "dev_1"]);
  });

  it("detects a mention of the current user case-insensitively", () => {
    expect(mentionsUser("ping @Sara please", "sara")).toBe(true);
    expect(mentionsUser("ping @other", "sara")).toBe(false);
    expect(mentionsUser("ping @sara", null)).toBe(false);
  });

  it("splits text into mention and plain segments", () => {
    expect(splitMentions("hey @sara ok")).toEqual([
      { text: "hey ", mention: false },
      { text: "@sara", mention: true },
      { text: " ok", mention: false },
    ]);
  });

  it("reads the mention token being typed", () => {
    expect(activeMentionQuery("hello @sa", 9)).toBe("sa");
    expect(activeMentionQuery("hello world", 11)).toBeNull();
  });

  it("completes the typed mention token", () => {
    const result = applyMention("hello @sa", 9, "sara");
    expect(result.value).toBe("hello @sara ");
    expect(result.caret).toBe(12);
  });
});

describe("unreadByProject", () => {
  const rows = [
    { project_id: 1, user_id: "other", created_at: "2026-08-11T10:00:00Z" },
    { project_id: 1, user_id: "me", created_at: "2026-08-11T10:05:00Z" },
    { project_id: 2, user_id: "other", created_at: "2026-08-11T09:00:00Z" },
  ];

  it("ignores own messages and already seen messages", () => {
    expect(unreadByProject(rows, "me", { "2": "2026-08-11T09:30:00Z" })).toEqual({ 1: 1 });
  });

  it("counts everything when nothing was seen", () => {
    expect(unreadByProject(rows, "me", {})).toEqual({ 1: 1, 2: 1 });
  });
});
