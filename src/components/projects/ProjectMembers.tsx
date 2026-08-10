import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type ProjectMember = {
  id: number;
  user_id: string;
};

async function fetchProjectMembers(projectId: number): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from("project_developers")
    .select("id, user_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectMember[];
}

type ProjectMembersProps = {
  projectId: number;
  profiles: Profile[];
  canManage: boolean;
};

export function ProjectMembers({ projectId, profiles, canManage }: ProjectMembersProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["project-developers", projectId],
    queryFn: () => fetchProjectMembers(projectId),
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const available = profiles.filter((p) => !memberIds.has(p.id));

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("project_developers")
        .insert({ project_id: projectId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-developers", projectId] });
      setOpen(false);
      toast.success("Member added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: number) => {
      const { error } = await supabase.from("project_developers").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-developers", projectId] });
      toast.success("Member removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Team members ({members.length})
        </CardTitle>
        {canManage && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Add member
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search users..." />
                <CommandList>
                  <CommandEmpty>No users available.</CommandEmpty>
                  <CommandGroup>
                    {available.map((p) => (
                      <CommandItem key={p.id} onSelect={() => addMember.mutate(p.id)}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                              {p.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{p.username}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const profile = profiles.find((p) => p.id === member.user_id);
              const username = profile?.username ?? member.user_id.slice(0, 8);
              return (
                <Badge
                  key={member.id}
                  variant="secondary"
                  className="flex items-center gap-1.5 px-2.5 py-1.5"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-primary/15 text-[9px] text-primary">
                      {username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-normal">{username}</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => removeMember.mutate(member.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      aria-label={`Remove ${username}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
