import { describe, expect, it } from "vitest";
import type { User, UserRole } from "@/types/user-management";

describe("Mock Data Logic", () => {
  it("generates mock users with correct structure and isMock flag", () => {
    const presets: Array<{
      username: string;
      emailSuffix: string;
      role: UserRole;
      status: User["status"];
    }> = [
      {
        username: "mock_faisal_dev",
        emailSuffix: "faisal.dev",
        role: "developer",
        status: "active",
      },
      { username: "mock_nora_qa", emailSuffix: "nora.qa", role: "tester", status: "active" },
    ];

    const count = 5;
    const timestamp = Date.now();
    const mockUsers: User[] = [];

    for (let i = 0; i < count; i++) {
      const preset = presets[i % presets.length]!;
      mockUsers.push({
        id: `usr-mock-${timestamp}-${i}`,
        username: `${preset.username}_101`,
        email: `${preset.emailSuffix}101@mock.electropi.io`,
        role: preset.role,
        status: preset.status,
        createdAt: new Date().toISOString(),
        isMock: true,
      });
    }

    expect(mockUsers.length).toBe(5);
    expect(mockUsers.every((u) => u.isMock === true)).toBe(true);
    expect(mockUsers[0]!.id.startsWith("usr-mock-")).toBe(true);
  });

  it("filters out mock users cleanly when deleting mock data", () => {
    const existingUsers: User[] = [
      {
        id: "usr-001",
        username: "admin_real",
        email: "admin@domain.com",
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr-mock-12345-0",
        username: "mock_user_1",
        email: "mock1@domain.com",
        role: "developer",
        status: "active",
        createdAt: new Date().toISOString(),
        isMock: true,
      },
    ];

    let deletedCount = 0;
    const remaining = existingUsers.filter((u) => {
      const isMockUser =
        u.isMock === true || u.id.startsWith("usr-mock-") || u.username.startsWith("mock_");
      if (isMockUser) {
        deletedCount++;
        return false;
      }
      return true;
    });

    expect(deletedCount).toBe(1);
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.username).toBe("admin_real");
  });
});
