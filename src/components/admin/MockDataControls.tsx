import React, { useState, useCallback } from "react";
import { Sparkles, Trash2, Database, AlertTriangle, Loader2, Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { seedAllMockData, clearAllMockData } from "@/lib/mock-data-service";

interface MockDataControlsProps {
  onAddMockUsers: (count?: number) => void;
  onDeleteMockUsers: () => number;
  mockUsersCount: number;
  totalUsersCount: number;
}

export const MockDataControls: React.FC<MockDataControlsProps> = ({
  onAddMockUsers,
  onDeleteMockUsers,
  mockUsersCount,
}) => {
  const queryClient = useQueryClient();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const invalidateAllQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bugs"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    queryClient.invalidateQueries({ queryKey: ["current-user"] });
  }, [queryClient]);

  // Master option: Add mock data to ALL system tables
  const handleAddAllMockData = useCallback(async () => {
    setIsSeeding(true);
    try {
      // 1. Add mock users locally & in state
      onAddMockUsers(5);

      // 2. Seed mock data across all database tables (Projects, Bugs, Tasks, Notifications)
      const res = await seedAllMockData();

      // 3. Invalidate Query Caches so every page refreshes live
      invalidateAllQueries();

      toast.success("Successfully added mock data to all tables!", {
        description:
          "Populated realistic sample records across Users, Projects, Bugs, Tasks, and Notifications.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed system mock data.");
    } finally {
      setIsSeeding(false);
    }
  }, [onAddMockUsers, invalidateAllQueries]);

  // Master option: Delete mock data from ALL system tables
  const handleConfirmDeleteAll = useCallback(async () => {
    setIsClearing(true);
    try {
      // 1. Delete mock users locally
      const deletedUsersCount = onDeleteMockUsers();

      // 2. Delete mock data from all database tables
      await clearAllMockData();

      // 3. Invalidate Query Caches so every page refreshes live
      invalidateAllQueries();

      toast.success("Successfully deleted mock data from all tables!", {
        description:
          "Cleaned system database across Users, Projects, Bugs, Tasks, and Notifications.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear system mock data.");
    } finally {
      setIsClearing(false);
      setShowConfirmDelete(false);
    }
  }, [onDeleteMockUsers, invalidateAllQueries]);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Single master button: Add Mock Data to All Tables */}
        <Button
          variant="outline"
          size="default"
          onClick={handleAddAllMockData}
          disabled={isSeeding || isClearing}
          className="gap-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-950/40 font-medium transition-all shadow-sm cursor-pointer"
          title="Add sample mock records to all tables (Users, Projects, Bugs, Tasks, Notifications)"
        >
          {isSeeding ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          )}
          <span>Add Mock Data to All Tables</span>
        </Button>

        {/* Single master button: Delete Mock Data from All Tables */}
        <Button
          variant="outline"
          size="default"
          onClick={() => setShowConfirmDelete(true)}
          disabled={isSeeding || isClearing}
          className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm cursor-pointer"
          title="Clear mock data from all tables across the system"
        >
          {isClearing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span>Delete Mock Data from All Tables</span>
          {mockUsersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0.2 text-[10px] bg-destructive/15 text-destructive border-none font-bold"
            >
              {mockUsersCount} Users
            </Badge>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog for System-Wide Mock Data Deletion */}
      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion of All Mock Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-muted-foreground pt-2">
              <p>
                Are you sure you want to delete mock data across <strong>ALL system tables</strong>{" "}
                (Users, Projects, Bugs, Tasks, Notifications)?
              </p>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                This action will clean up generated test records across all modules. Primary system
                records will remain untouched.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="cursor-pointer" disabled={isClearing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteAll}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer gap-2"
            >
              {isClearing && <Loader2 className="h-4 w-4 animate-spin" />}
              Yes, Delete All Mock Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MockDataControls;
