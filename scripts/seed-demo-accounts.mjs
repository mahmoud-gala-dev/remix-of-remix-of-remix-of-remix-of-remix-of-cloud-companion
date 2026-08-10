import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "TestPass!2345";

const demoAccounts = [
  { email: "admin@test.com", role: "admin", username: "Admin Demo" },
  { email: "creator@test.com", role: "admin", username: "Project Creator Demo" },
  { email: "creator2@test.com", role: "admin", username: "Project Creator Two" },
  { email: "tester@test.com", role: "tester", username: "Tester Demo" },
  { email: "supervisor@test.com", role: "supervisor", username: "Supervisor Demo" },
  { email: "developer@test.com", role: "developer", username: "Developer Demo" },
  { email: "developer2@test.com", role: "developer", username: "Developer Two Demo" },
  { email: "auditor@test.com", role: "auditor", username: "Auditor Demo" },
  { email: "monitor@test.com", role: "monitor", username: "Monitor Demo" },
];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Use a local env var, not the browser publishable key.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertDemoAccount(account) {
  const existing = await findUserByEmail(account.email);
  const attributes = {
    email: account.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { username: account.username },
    app_metadata: { provider: "email", providers: ["email"] },
  };

  const authResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, attributes)
    : await supabase.auth.admin.createUser(attributes);

  if (authResult.error) throw authResult.error;
  const user = authResult.data.user;
  if (!user) throw new Error(`No auth user returned for ${account.email}`);

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username: account.username }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: account.role }, { onConflict: "user_id" });
  if (roleError) throw roleError;

  return { email: account.email, id: user.id, role: account.role };
}

console.log("Seeding ElectroPI demo accounts with Supabase Admin API...");

for (const account of demoAccounts) {
  try {
    const result = await upsertDemoAccount(account);
    console.log(`OK ${result.email} -> ${result.role} (${result.id})`);
  } catch (error) {
    console.error(`FAILED ${account.email}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error("Demo account seeding finished with errors.");
} else {
  console.log(`Done. Demo password: ${DEMO_PASSWORD}`);
}
