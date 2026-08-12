import { RefreshCw, Save, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BUG_PRIORITIES, BUG_SEVERITIES, BUG_STATUSES, type Profile, type Project } from "@/lib/api";
import type { SavedFilter } from "@/lib/saved-filters";

export type BugFilterState = {
  search: string;
  module: string;
  status: string;
  priority: string;
  severity: string;
  project: string;
  assignee: string;
};

export const EMPTY_BUG_FILTERS: BugFilterState = {
  search: "",
  module: "All",
  status: "All",
  priority: "All",
  severity: "All",
  project: "All",
  assignee: "All",
};

export function hasActiveBugFilters(value: BugFilterState) {
  return (
    !!value.search.trim() ||
    value.module !== "All" ||
    value.status !== "All" ||
    value.priority !== "All" ||
    value.severity !== "All" ||
    value.project !== "All" ||
    value.assignee !== "All"
  );
}

/**
 * Filter surface for the bug list: module tabs, the search / dropdown row and the
 * saved-filter bar. Fully controlled — the page owns the state so it can mirror it
 * into the URL for shareable links.
 */
export function BugFilters({
  value,
  onChange,
  onReset,
  modules,
  projects,
  profiles,
  savedFilters,
  savedFilterName,
  onSavedFilterNameChange,
  onSaveFilter,
  onApplySavedFilter,
  onDeleteSavedFilter,
}: {
  value: BugFilterState;
  onChange: (patch: Partial<BugFilterState>) => void;
  onReset: () => void;
  modules: string[];
  projects: Project[] | undefined;
  profiles: Profile[] | undefined;
  savedFilters: SavedFilter<BugFilterState>[];
  savedFilterName: string;
  onSavedFilterNameChange: (name: string) => void;
  onSaveFilter: () => void;
  onApplySavedFilter: (filter: SavedFilter<BugFilterState>) => void;
  onDeleteSavedFilter: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Tabs value={value.module} onValueChange={(v) => onChange({ module: v })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="All">All</TabsTrigger>
          {modules.map((m) => (
            <TabsTrigger key={m} value={m}>
              {m}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder="Search by title or bug ID..."
            value={value.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
        <Select value={value.status} onValueChange={(v) => onChange({ status: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {BUG_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.priority} onValueChange={(v) => onChange({ priority: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All priorities</SelectItem>
            {BUG_PRIORITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.severity} onValueChange={(v) => onChange({ severity: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All severities</SelectItem>
            {BUG_SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.project} onValueChange={(v) => onChange({ project: v })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All projects</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.assignee} onValueChange={(v) => onChange({ assignee: v })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {(profiles ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveBugFilters(value) && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RefreshCw className="me-2 h-4 w-4" />
            Reset filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <Input
          value={savedFilterName}
          onChange={(event) => onSavedFilterNameChange(event.target.value)}
          placeholder="Saved filter name"
          className="h-9 w-48"
        />
        <Button type="button" variant="outline" size="sm" onClick={onSaveFilter}>
          <Save className="me-2 h-4 w-4" />
          Save filter
        </Button>
        {savedFilters.length > 0 && (
          <Select
            value=""
            onValueChange={(id) => {
              const filter = savedFilters.find((item) => item.id === id);
              if (filter) onApplySavedFilter(filter);
            }}
          >
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Load saved filter" />
            </SelectTrigger>
            <SelectContent>
              {savedFilters.map((filter) => (
                <SelectItem key={filter.id} value={filter.id}>
                  {filter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {savedFilters.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => onDeleteSavedFilter(filter.id)}
            aria-label={`Delete saved filter ${filter.name}`}
          >
            <Trash2 className="me-1 h-3.5 w-3.5" />
            {filter.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
