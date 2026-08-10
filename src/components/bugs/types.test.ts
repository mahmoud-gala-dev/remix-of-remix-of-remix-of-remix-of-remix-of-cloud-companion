import { describe, expect, it } from "vitest";
import { nameFor, profilesToMap } from "@/components/bugs/types";
import type { Profile } from "@/lib/api";

const profile = (id: string, username: string): Profile => ({
  id,
  username,
  created_at: "2026-01-01T00:00:00Z",
  avatar_url: null,
  is_active: true,
});

describe("profilesToMap", () => {
  it("returns an empty map for undefined input", () => {
    expect(profilesToMap(undefined)).toEqual({});
  });

  it("maps ids to usernames", () => {
    expect(
      profilesToMap([profile("aaaaaaaa-1111", "ada"), profile("bbbbbbbb-2222", "linus")]),
    ).toEqual({
      "aaaaaaaa-1111": "ada",
      "bbbbbbbb-2222": "linus",
    });
  });

  it("falls back to a short id when the username is missing", () => {
    const broken = { ...profile("ccccccccdddd", ""), username: null } as unknown as Profile;
    expect(profilesToMap([broken])["ccccccccdddd"]).toBe("cccccccc");
  });
});

describe("nameFor", () => {
  const map = profilesToMap([profile("aaaaaaaa-1111", "ada")]);

  it("labels missing ids as Unassigned", () => {
    expect(nameFor(map, null)).toBe("Unassigned");
    expect(nameFor(map, undefined)).toBe("Unassigned");
  });

  it("resolves known ids", () => {
    expect(nameFor(map, "aaaaaaaa-1111")).toBe("ada");
  });

  it("falls back to a truncated id for unknown users", () => {
    expect(nameFor(map, "ffffffff-9999")).toBe("ffffffff");
  });
});
