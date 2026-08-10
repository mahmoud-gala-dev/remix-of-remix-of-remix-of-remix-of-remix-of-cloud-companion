import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Loads .env into process.env so integration tests can reach the backend. */
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue?.replace(/^["']|["']$/g, "") ?? "";
  }
}
