export const DEMO_PASSWORD = "TestPass!2345";

export type DemoAccount = {
  label: string;
  email: string;
  username: string;
  role: "admin" | "developer" | "tester" | "supervisor" | "auditor" | "monitor";
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Creator 1", email: "creator@test.com", username: "Project Creator Demo", role: "admin" },
  {
    label: "Creator 2",
    email: "creator2@test.com",
    username: "Project Creator Two",
    role: "admin",
  },
  { label: "Admin", email: "admin@test.com", username: "Admin Demo", role: "admin" },
  {
    label: "Developer 1",
    email: "developer@test.com",
    username: "Developer Demo",
    role: "developer",
  },
  {
    label: "Developer 2",
    email: "developer2@test.com",
    username: "Developer Two Demo",
    role: "developer",
  },
  { label: "Auditor", email: "auditor@test.com", username: "Auditor Demo", role: "auditor" },
  { label: "Monitor", email: "monitor@test.com", username: "Monitor Demo", role: "monitor" },
  { label: "Tester", email: "tester@test.com", username: "Tester Demo", role: "tester" },
  {
    label: "Supervisor",
    email: "supervisor@test.com",
    username: "Supervisor Demo",
    role: "supervisor",
  },
];
