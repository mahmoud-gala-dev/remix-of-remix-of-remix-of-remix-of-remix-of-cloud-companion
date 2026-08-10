import React, { useCallback, useState } from "react";
import { Trash2, Mail, Calendar, AlertTriangle, Power, PowerOff } from "lucide-react";
import type { User, UserRole } from "@/types/user-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface UserTableProps {
  users: User[];
  onDeleteUser: (userId: string) => void;
  onToggleActive?: (userId: string, isActive: boolean) => void;
  onChangeRole?: (userId: string, role: UserRole) => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "tester", label: "Tester (QA)" },
  { value: "supervisor", label: "Supervisor" },
  { value: "auditor", label: "Auditor" },
  { value: "monitor", label: "Monitor" },
];

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onDeleteUser,
  onToggleActive,
  onChangeRole,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = useCallback(() => {
    if (!deletingId) return;
    try {
      onDeleteUser(deletingId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, onDeleteUser]);

  const getStatusBadge = (status: User["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          >
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">
            Inactive
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">
            Pending
          </Badge>
        );
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-32 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No users found matching current filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{user.username}</span>
                        {(user.isMock || user.username.startsWith("mock_")) && (
                          <Badge
                            variant="outline"
                            className="border-purple-500/30 bg-purple-500/10 px-1.5 py-0 text-[10px] font-medium text-purple-600 dark:text-purple-400"
                          >
                            Mock
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {onChangeRole ? (
                      <Select
                        value={user.role}
                        onValueChange={(value) => onChangeRole(user.id, value as UserRole)}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{user.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {onToggleActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={
                            user.status === "active"
                              ? "h-8 w-8 text-amber-600 hover:bg-amber-500/10"
                              : "h-8 w-8 text-emerald-600 hover:bg-emerald-500/10"
                          }
                          onClick={() => onToggleActive(user.id, user.status !== "active")}
                          title={user.status === "active" ? "Deactivate account" : "Activate account"}
                          aria-label={
                            user.status === "active"
                              ? `Deactivate ${user.username}`
                              : `Activate ${user.username}`
                          }
                        >
                          {user.status === "active" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingId(user.id)}
                        title="Delete Account"
                        aria-label={`Delete ${user.username}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Account Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this user account? This action cannot be
              undone and will revoke the user's dashboard access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
