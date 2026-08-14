import { beforeEach, describe, expect, it } from "vitest";
import {
  addDevLocalNote,
  clearDevLocalNotes,
  deleteDevLocalNote,
  getDevLocalNotes,
  updateDevLocalNote,
} from "./dev-local-notes";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

function setBrowserStorage() {
  const localStorage = createStorage();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });
  return localStorage;
}

describe("dev-local-notes storage", () => {
  beforeEach(async () => {
    setBrowserStorage();
    await clearDevLocalNotes();
  });

  it("adds and retrieves local developer notes for a bug", async () => {
    const note1 = await addDevLocalNote({
      bugId: 294,
      title: "Root cause found",
      content: "Found issue in token validation handler",
      category: "investigation",
    });

    const note2 = await addDevLocalNote({
      bugId: 294,
      title: "Proposed fix",
      content: "Add null check before dispatching action",
      category: "solution",
    });

    const otherBugNote = await addDevLocalNote({
      bugId: 100,
      title: "Other note",
      content: "Notes for bug 100",
      category: "general",
    });

    const notes294 = await getDevLocalNotes(294);
    expect(notes294.length).toBe(2);
    expect(notes294.map((n) => n.id)).toContain(note1.id);
    expect(notes294.map((n) => n.id)).toContain(note2.id);
    expect(notes294.map((n) => n.id)).not.toContain(otherBugNote.id);
  });

  it("updates an existing note", async () => {
    const note = await addDevLocalNote({
      bugId: 294,
      title: "Initial title",
      content: "Initial content",
      category: "general",
    });

    const updated = await updateDevLocalNote(note.id, {
      title: "Updated title",
      content: "Updated content",
      category: "code",
    });

    expect(updated.title).toBe("Updated title");
    expect(updated.content).toBe("Updated content");
    expect(updated.category).toBe("code");

    const notes = await getDevLocalNotes(294);
    expect(notes[0]?.title).toBe("Updated title");
  });

  it("deletes a note", async () => {
    const note = await addDevLocalNote({
      bugId: 294,
      content: "To be deleted",
    });

    let notes = await getDevLocalNotes(294);
    expect(notes.length).toBe(1);

    await deleteDevLocalNote(note.id);

    notes = await getDevLocalNotes(294);
    expect(notes.length).toBe(0);
  });
});
