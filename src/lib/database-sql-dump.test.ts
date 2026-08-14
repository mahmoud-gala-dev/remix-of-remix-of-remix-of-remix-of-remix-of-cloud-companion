import { describe, it, expect } from "vitest";
import { formatSqlValue, generateTableSql } from "./database-sql-dump";
import { parseSqlLiteral, parseSqlDump } from "./database-sql-import";

describe("Database SQL Dump & Import utilities", () => {
  describe("formatSqlValue", () => {
    it("formats primitives correctly", () => {
      expect(formatSqlValue(null)).toBe("NULL");
      expect(formatSqlValue(undefined)).toBe("NULL");
      expect(formatSqlValue(true)).toBe("TRUE");
      expect(formatSqlValue(false)).toBe("FALSE");
      expect(formatSqlValue(123)).toBe("123");
      expect(formatSqlValue(45.67)).toBe("45.67");
    });

    it("escapes single quotes in string values", () => {
      expect(formatSqlValue("Hello 'World'")).toBe("'Hello ''World'''");
      expect(formatSqlValue("O'Connor")).toBe("'O''Connor'");
    });

    it("formats arrays as postgres literals", () => {
      expect(formatSqlValue(["frontend", "ui"])).toBe("'{\"frontend\",\"ui\"}'");
    });

    it("formats objects as jsonb literals", () => {
      expect(formatSqlValue({ key: "val's" })).toBe('\'{"key":"val\'\'s"}\'::jsonb');
    });
  });

  describe("generateTableSql", () => {
    it("generates SQL with ON CONFLICT clause", () => {
      const rows = [
        { id: 1, name: "Project Alpha", key: "ALP" },
        { id: 2, name: "Project Beta", key: "BET" },
      ];
      const sql = generateTableSql("projects", rows, "id");
      expect(sql).toContain('INSERT INTO "projects"');
      expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
      expect(sql).toContain("'Project Alpha'");
      expect(sql).toContain("'Project Beta'");
      expect(sql).toContain("SELECT setval(pg_get_serial_sequence('\"projects\"', 'id')");
    });
  });

  describe("parseSqlLiteral", () => {
    it("parses booleans, numbers, nulls", () => {
      expect(parseSqlLiteral("NULL")).toBe(null);
      expect(parseSqlLiteral("TRUE")).toBe(true);
      expect(parseSqlLiteral("FALSE")).toBe(false);
      expect(parseSqlLiteral("42")).toBe(42);
      expect(parseSqlLiteral("3.14")).toBe(3.14);
    });

    it("parses escaped strings", () => {
      expect(parseSqlLiteral("'Hello ''World'''")).toBe("Hello 'World'");
      expect(parseSqlLiteral("'Simple text'")).toBe("Simple text");
    });

    it("parses jsonb literals", () => {
      expect(parseSqlLiteral('\'{"role":"admin"}\'::jsonb')).toEqual({ role: "admin" });
    });

    it("parses array literals", () => {
      expect(parseSqlLiteral("'{\"bug\",\"fix\"}'")).toEqual(["bug", "fix"]);
    });
  });

  describe("parseSqlDump", () => {
    it("parses generated SQL dump into table structures", () => {
      const sampleDump = `
        INSERT INTO "projects" ("id", "name", "key")
        VALUES
          (1, 'Project Alpha', 'ALP'),
          (2, 'Project Beta', 'BET')
        ON CONFLICT (id) DO UPDATE SET "name" = EXCLUDED."name", "key" = EXCLUDED."key";

        INSERT INTO "bugs" ("id", "title", "status", "project_id")
        VALUES
          (101, 'Bug in ''Login'' page', 'Open', 1)
        ON CONFLICT (id) DO NOTHING;
      `;

      const parsed = parseSqlDump(sampleDump);
      expect(parsed).toHaveLength(2);

      const projects = parsed.find((p) => p.tableName === "projects");
      expect(projects).toBeDefined();
      expect(projects?.rows).toHaveLength(2);
      expect(projects?.rows[0]).toEqual({ id: 1, name: "Project Alpha", key: "ALP" });
      expect(projects?.rows[1]).toEqual({ id: 2, name: "Project Beta", key: "BET" });

      const bugs = parsed.find((b) => b.tableName === "bugs");
      expect(bugs).toBeDefined();
      expect(bugs?.rows).toHaveLength(1);
      expect(bugs?.rows[0]).toEqual({
        id: 101,
        title: "Bug in 'Login' page",
        status: "Open",
        project_id: 1,
      });
    });
  });
});
