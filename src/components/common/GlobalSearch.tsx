import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bug, ClipboardList, FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EMPTY_SEARCH_RESULTS, globalSearch } from "@/lib/global-search";

/** Debounces a value so typing does not fire one query per keystroke. */
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Global ⌘K / Ctrl+K palette searching bugs, projects and priority tasks. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // event.key can be undefined with IME composition events.
      if (!event.key) return;
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = useQuery({
    queryKey: ["global-search", debounced],
    enabled: open && debounced.trim().length >= 2,
    queryFn: () => globalSearch(debounced),
    staleTime: 15_000,
  });

  const results = query.data ?? EMPTY_SEARCH_RESULTS;
  const hasResults = useMemo(
    () => results.bugs.length + results.projects.length + results.tasks.length > 0,
    [results],
  );

  const go = (to: () => void) => {
    setOpen(false);
    setTerm("");
    to();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search bugs, projects and tasks"
        className="hidden gap-2 text-muted-foreground sm:flex"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs">Search…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Search bugs, projects and tasks"
        className="text-muted-foreground sm:hidden"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Search bugs, projects, tasks…"
        />
        <CommandList>
          {term.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : query.isFetching && !hasResults ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : query.isError ? (
            <CommandEmpty>Search failed. Please try again.</CommandEmpty>
          ) : !hasResults ? (
            <CommandEmpty>No matches found.</CommandEmpty>
          ) : null}

          {results.bugs.length > 0 && (
            <CommandGroup heading="Bugs">
              {results.bugs.map((hit) => (
                <CommandItem
                  key={`bug-${hit.id}`}
                  value={`bug-${hit.id}-${hit.label}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/bugs/$id", params: { id: String(hit.id) } }))
                  }
                >
                  <Bug className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{hit.label}</span>
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {hit.sublabel}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.projects.length > 0 && (
            <CommandGroup heading="Projects">
              {results.projects.map((hit) => (
                <CommandItem
                  key={`project-${hit.id}`}
                  value={`project-${hit.id}-${hit.label}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/projects/$id", params: { id: String(hit.id) } }))
                  }
                >
                  <FolderKanban className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{hit.label}</span>
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {hit.sublabel}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.tasks.length > 0 && (
            <CommandGroup heading="Priority tasks">
              {results.tasks.map((hit) => (
                <CommandItem
                  key={`task-${hit.id}`}
                  value={`task-${hit.id}-${hit.label}`}
                  onSelect={() => go(() => navigate({ to: "/tasks" }))}
                >
                  <ClipboardList className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{hit.label}</span>
                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                    {hit.sublabel}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
