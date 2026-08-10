export type UserRole = "admin" | "developer" | "tester" | "supervisor" | "auditor" | "monitor";

export type UserStatus = "active" | "inactive" | "pending";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string | undefined;
  isMock?: boolean;
}

export interface CreateUserData {
  username: string;
  email: string;
  password?: string | undefined;
  role: UserRole;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  inactiveUsers: number;
  roleDistribution: Record<UserRole, number>;
}

export type ExportFormat = "json" | "csv";

export interface ImportSummary {
  successCount: number;
  failureCount: number;
  errors: string[];
}
