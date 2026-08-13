import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";

export const DEV_NOTE_KINDS = ["code", "checklist", "mindmap"] as const;
export type DevNoteKind = (typeof DEV_NOTE_KINDS)[number];

export type DevNote = {
  id: number;
  bug_id: number;
  author_id: string;
  kind: DevNoteKind;
  title: string;
  content: string;
  language: string;
  created_at: string;
  updated_at: string;
};

export const CODE_LANGUAGES = [
  "ts",
  "tsx",
  "js",
  "python",
  "sql",
  "bash",
  "json",
  "html",
  "css",
] as const;

type NoteRow = Omit<DevNote, "kind"> & { kind: string };

function toNote(row: NoteRow): DevNote {
  const kind = DEV_NOTE_KINDS.includes(row.kind as DevNoteKind)
    ? (row.kind as DevNoteKind)
    : "code";
  return { ...row, kind };
}

export async function fetchDevNotes(bugId: number): Promise<DevNote[]> {
  const { data, error } = await supabase
    .from("bug_dev_notes")
    .select("*")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(friendlyDbError(error));
  return ((data ?? []) as NoteRow[]).map(toNote);
}

export async function createDevNote(input: {
  bugId: number;
  authorId: string;
  kind: DevNoteKind;
  title: string;
  content: string;
  language: string;
}) {
  const { error } = await supabase.from("bug_dev_notes").insert({
    bug_id: input.bugId,
    author_id: input.authorId,
    kind: input.kind,
    title: input.title.trim(),
    content: input.content,
    language: input.language,
  });
  if (error) throw new Error(friendlyDbError(error));
}

export async function updateDevNote(id: number, patch: Partial<Pick<DevNote, "title" | "content">>) {
  const { error } = await supabase.from("bug_dev_notes").update(patch).eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

export async function deleteDevNote(id: number) {
  const { error } = await supabase.from("bug_dev_notes").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

export type MindNode = { label: string; children: MindNode[] };

/**
 * Turns indented plain text into a tree so a developer can sketch a mind map
 * without leaving the textarea. Two spaces (or a tab) per level.
 */
export function parseMindMap(content: string): MindNode[] {
  const roots: MindNode[] = [];
  const stack: { depth: number; node: MindNode }[] = [];
  for (const rawLine of content.split("\n")) {
    if (!rawLine.trim()) continue;
    const expanded = rawLine.replace(/\t/g, "  ");
    const indent = expanded.length - expanded.trimStart().length;
    const depth = Math.floor(indent / 2);
    const node: MindNode = { label: expanded.trim().replace(/^[-*]\s*/, ""), children: [] };
    while (stack.length && stack[stack.length - 1]!.depth >= depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else roots.push(node);
    stack.push({ depth, node });
  }
  return roots;
}

export type ChecklistItem = { text: string; done: boolean };

/** Checklist lines: `[x] done thing` / `- pending thing`. */
export function parseChecklist(content: string): ChecklistItem[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^[-*]?\s*\[( |x|X)\]\s*(.*)$/.exec(line);
      if (match) return { text: match[2] ?? "", done: match[1]?.toLowerCase() === "x" };
      return { text: line.replace(/^[-*]\s*/, ""), done: false };
    });
}

/** Serialises checklist items back to the stored text form. */
export function stringifyChecklist(items: ChecklistItem[]) {
  return items.map((item) => `[${item.done ? "x" : " "}] ${item.text}`).join("\n");
}
