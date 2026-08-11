import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchUserRoleMap, type Profile } from "@/lib/api";

const UNASSIGNED = "unassigned";

/**
 * Searchable assignee picker.
 *
 * The candidate list is intentionally narrow: once a bug is assigned, only the
 * assigned developer is offered, so an assignment cannot be silently handed to
 * somebody else. While the bug is unassigned, every developer is selectable.
 */
export function AssigneeSelect({
  profiles,
  value,
  disabled,
  onChange,
}: {
  profiles: Profile[];
  value: string | null;
  disabled?: boolean;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const { data: roleMap } = useQuery({
    queryKey: ["user-role-map"],
    queryFn: fetchUserRoleMap,
    staleTime: 60_000,
  });

  const candidates = useMemo(() => {
    const active = profiles.filter((profile) => profile.is_active !== false);
    if (value) return active.filter((profile) => profile.id === value);
    return active.filter((profile) => (roleMap ?? {})[profile.id] === "developer");
  }, [profiles, roleMap, value]);

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((profile) => profile.username.toLowerCase().includes(query));
  }, [candidates, term]);

  const selected = profiles.find((profile) => profile.id === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTerm("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between bg-background font-normal"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected?.username ?? "Unassigned"}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="relative border-b border-border/70 p-2">
          <Search className="absolute left-4 top-4 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search developers…"
            className="h-8 ps-7 text-sm"
          />
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-1">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-start text-sm hover:bg-muted"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span className="text-muted-foreground">Unassigned</span>
              {!value && <Check className="h-4 w-4 text-primary" />}
            </button>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No developer found.</p>
            ) : (
              filtered.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-start text-sm hover:bg-muted"
                  onClick={() => {
                    onChange(profile.id === UNASSIGNED ? null : profile.id);
                    setOpen(false);
                  }}
                >
                  <span>{profile.username}</span>
                  {value === profile.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
