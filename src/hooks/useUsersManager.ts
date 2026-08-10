import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { CreateUserData, User, UserRole, UserStats } from "@/types/user-management";
import {
  createManagedUser,
  createMockUsers,
  deleteManagedUser,
  deleteMockUsers as deleteMockUsersFn,
  listManagedUsers,
  setUserActive as setUserActiveFn,
  setUserRole as setUserRoleFn,
} from "@/lib/users.functions";

const EMPTY: User[] = [];

/**
 * Database-backed account management for the admin dashboard. Status changes
 * here are what block a deactivated user from using the app, so they must be
 * persisted, never kept in localStorage.
 */
export function useUsersManager() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchUsers = useServerFn(listManagedUsers);
  const createUser = useServerFn(createManagedUser);
  const deleteUser = useServerFn(deleteManagedUser);
  const setActive = useServerFn(setUserActiveFn);
  const setRole = useServerFn(setUserRoleFn);
  const addMocks = useServerFn(createMockUsers);
  const removeMocks = useServerFn(deleteMockUsersFn);

  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: async () => (await fetchUsers()) as User[],
    retry: false,
  });

  const users = (usersQuery.data ?? EMPTY) as User[];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
  }, [queryClient]);

  const filteredUsers = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        user.username.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const stats: UserStats = useMemo(() => {
    const roleDistribution: Record<UserRole, number> = {
      admin: 0,
      developer: 0,
      tester: 0,
      supervisor: 0,
      auditor: 0,
      monitor: 0,
    };
    let activeUsers = 0;
    let inactiveUsers = 0;
    let adminUsers = 0;
    for (const user of users) {
      if (user.status === "active") activeUsers += 1;
      else inactiveUsers += 1;
      if (user.role === "admin") adminUsers += 1;
      roleDistribution[user.role] = (roleDistribution[user.role] ?? 0) + 1;
    }
    return { totalUsers: users.length, activeUsers, adminUsers, inactiveUsers, roleDistribution };
  }, [users]);

  const addUserMutation = useMutation({
    mutationFn: async (payload: CreateUserData) =>
      createUser({
        data: {
          username: payload.username,
          email: payload.email,
          ...(payload.password ? { password: payload.password } : {}),
          role: payload.role,
        },
      }),
    onSuccess: (result) => {
      invalidate();
      if (result?.generatedPassword) {
        toast.success(`Account created. Temporary password: ${result.generatedPassword}`);
      } else {
        toast.success("Account created.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Account deleted.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatusMutation = useMutation({
    mutationFn: async (input: { userId: string; isActive: boolean }) => setActive({ data: input }),
    onSuccess: (_r, input) => {
      invalidate();
      toast.success(input.isActive ? "Account activated." : "Account deactivated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setRoleMutation = useMutation({
    mutationFn: async (input: { userId: string; role: UserRole }) => setRole({ data: input }),
    onSuccess: () => {
      invalidate();
      toast.success("Role updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addUser = useCallback(
    (data: CreateUserData) => {
      addUserMutation.mutate(data);
    },
    [addUserMutation],
  );

  const importUsers = useCallback(
    (imported: User[]) => {
      if (!Array.isArray(imported) || imported.length === 0) {
        throw new Error("Imported data is invalid or empty.");
      }
      const existing = new Set(users.map((u) => u.email.toLowerCase()));
      const fresh = imported.filter((u) => u.email && !existing.has(u.email.toLowerCase()));
      if (fresh.length === 0) {
        toast.info("Every imported account already exists.");
        return;
      }
      void (async () => {
        let created = 0;
        for (const candidate of fresh) {
          try {
            await createUser({
              data: {
                username: candidate.username || candidate.email.split("@")[0]!,
                email: candidate.email,
                role: candidate.role,
              },
            });
            created += 1;
          } catch {
            // Skip accounts the backend rejects and keep importing the rest.
          }
        }
        invalidate();
        toast.success(`Imported ${created} of ${fresh.length} accounts.`);
      })();
    },
    [createUser, invalidate, users],
  );

  const mockUsersCount = useMemo(
    () => users.filter((u) => u.username.startsWith("mock_")).length,
    [users],
  );

  const addMockUsers = useCallback(
    (count = 5) => {
      void addMocks({ data: { count } })
        .then((result) => {
          invalidate();
          toast.success(`Created ${result.created} mock accounts.`);
        })
        .catch((error: Error) => toast.error(error.message));
    },
    [addMocks, invalidate],
  );

  const deleteMockUsers = useCallback(() => {
    const snapshot = mockUsersCount;
    void removeMocks()
      .then((result) => {
        invalidate();
        toast.success(`Deleted ${result.deleted} mock accounts.`);
      })
      .catch((error: Error) => toast.error(error.message));
    return snapshot;
  }, [invalidate, mockUsersCount, removeMocks]);

  return {
    users: filteredUsers,
    allUsers: users,
    stats,
    mockUsersCount,
    isLoading: usersQuery.isLoading,
    error: usersQuery.error as Error | null,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    addUser,
    deleteUser: (userId: string) => deleteUserMutation.mutate(userId),
    setUserActive: (userId: string, isActive: boolean) =>
      setStatusMutation.mutate({ userId, isActive }),
    setUserRole: (userId: string, role: UserRole) => setRoleMutation.mutate({ userId, role }),
    importUsers,
    addMockUsers,
    deleteMockUsers,
  };
}
