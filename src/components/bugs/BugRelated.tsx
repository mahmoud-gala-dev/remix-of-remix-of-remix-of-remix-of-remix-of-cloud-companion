import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { GitBranch, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBugs, statusTone } from "@/lib/api";

export function BugRelated({ bugId, canManage }: { bugId: number; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: relations = [] } = useQuery({
    queryKey: ["bug-relations", bugId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_relations")
        .select("*")
        .or(`source_id.eq.${bugId},related_id.eq.${bugId}`);
      if (error) throw error;
      return data;
    },
  });

  const { data: allBugs = [] } = useQuery({ queryKey: ["bugs"], queryFn: fetchBugs });

  const relatedIds = relations.map((r) => (r.source_id === bugId ? r.related_id : r.source_id));
  const relatedBugs = allBugs.filter((b) => relatedIds.includes(b.id));
  const linkable = allBugs.filter((b) => b.id !== bugId && !relatedIds.includes(b.id));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bug-relations", bugId] });

  const addRelation = useMutation({
    mutationFn: async (relatedId: number) => {
      const { error } = await supabase
        .from("bug_relations")
        .insert({ source_id: bugId, related_id: relatedId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeRelation = useMutation({
    mutationFn: async (relatedId: number) => {
      const { error } = await supabase
        .from("bug_relations")
        .delete()
        .or(
          `and(source_id.eq.${bugId},related_id.eq.${relatedId}),and(source_id.eq.${relatedId},related_id.eq.${bugId})`,
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" /> Related Bugs
        </CardTitle>
        {canManage && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="me-1 h-3.5 w-3.5" /> Link bug
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search bugs..." />
                <CommandList>
                  <CommandEmpty>No bugs found.</CommandEmpty>
                  <CommandGroup>
                    {linkable.map((b) => (
                      <CommandItem key={b.id} onSelect={() => addRelation.mutate(b.id)}>
                        <span className="truncate">
                          {b.bug_id} — {b.title}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {relatedBugs.length === 0 && (
          <p className="text-sm text-muted-foreground">No related bugs</p>
        )}
        {relatedBugs.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <Link
              to="/bugs/$id"
              params={{ id: String(b.id) }}
              className="min-w-0 flex-1 truncate text-sm hover:text-primary"
            >
              <span className="font-medium">{b.bug_id}</span> — {b.title}
            </Link>
            <Badge variant="outline" className={statusTone(b.status)}>
              {b.status}
            </Badge>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => removeRelation.mutate(b.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
