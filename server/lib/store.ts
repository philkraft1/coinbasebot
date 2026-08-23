import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { sanitizePrefs, type ChartPrefs } from "./prefs.ts";

export type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount: number };

export type AuthStore = {
  kind: "rds" | "pglite";
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(text: string): Promise<void>;
  close(): Promise<void>;
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const AUTH_SQL = join(ROOT, "sql/auth.sql");
const AUTH_SECURITY_SQL = join(ROOT, "sql/auth-security.sql");

export function normalizeAuthDatabaseUrl(raw: string): string {
  return raw
    .replace(/&channel_binding=require/g, "")
    .replace(/\?channel_binding=require&/, "?")
    .replace(/sslmode=require\b/, "sslmode=verify-full");
}

function sslForUrl(url: string): false | { rejectUnauthorized: boolean; ca?: string } {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get("sslmode") || "";
  const host = parsed.hostname;
  if (mode === "disable" || host === "127.0.0.1" || host === "localhost") return false;
  const caPath = (process.env.AUTH_DATABASE_SSL_CA || "").trim();
  if (caPath) {
    return { rejectUnauthorized: true, ca: readFileSync(caPath, "utf8") };
  }
  return { rejectUnauthorized: true };
}

export async function applySql(store: AuthStore, filePath: string) {
  await store.exec(readFileSync(filePath, "utf8"));
}

export async function migrateStore(store: AuthStore, ownerUrl = "") {
  await applySql(store, AUTH_SQL);
  if (!ownerUrl || store.kind === "pglite") return { roleCreated: false };
  const { randomBytes } = await import("node:crypto");
  const existing = await store.query<{ rolname: string }>(
    "select rolname from pg_roles where rolname = 'auth_app'",
  );
  let created = false;
  if (existing.rowCount === 0) {
    const password = randomBytes(24).toString("base64url");
    await store.query(`create role auth_app login password '${password}'`);
    created = true;
  }
  await applySql(store, AUTH_SECURITY_SQL);
  return { roleCreated: created };
}

export function createPgStore(connectionString: string): AuthStore {
  const url = normalizeAuthDatabaseUrl(connectionString);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: sslForUrl(url),
    max: 4,
  });
  return {
    kind: "rds",
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pool.query(text, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length };
    },
    async exec(text: string) {
      await pool.query(text);
    },
    async close() {
      await pool.end();
    },
  };
}

export async function createPgliteStore(dataDir = join(ROOT, ".data/auth")): Promise<AuthStore> {
  mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  return {
    kind: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const result = await db.query<T>(text, params);
      return { rows: result.rows, rowCount: result.rows.length };
    },
    async exec(text: string) {
      await db.exec(text);
    },
    async close() {
      await db.close();
    },
  };
}

export async function openAuthStore(opts?: { url?: string; pgliteDir?: string }): Promise<AuthStore> {
  const url = (opts?.url ?? process.env.AUTH_DATABASE_URL ?? "").trim();
  if (url) return createPgStore(url);
  return createPgliteStore(opts?.pgliteDir);
}

export async function findUserByUsername(store: AuthStore, username: string) {
  const result = await store.query<{ id: string; username: string; password_hash: string }>(
    "select id, username, password_hash from auth.users where lower(username) = lower($1)",
    [username],
  );
  return result.rows[0] || null;
}

export async function createUser(store: AuthStore, username: string, passwordHash: string) {
  const result = await store.query<{ id: string; username: string }>(
    "insert into auth.users (username, password_hash) values ($1, $2) returning id, username",
    [username, passwordHash],
  );
  return result.rows[0];
}

export async function readPrefs(store: AuthStore, userId: string): Promise<ChartPrefs | null> {
  const result = await store.query<{ chart: unknown }>(
    "select chart from auth.preferences where user_id = $1",
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (!row.chart || (typeof row.chart === "object" && Object.keys(row.chart as object).length === 0)) {
    return null;
  }
  return sanitizePrefs(row.chart);
}

export async function writePrefs(store: AuthStore, userId: string, prefs: ChartPrefs) {
  await store.query(
    `insert into auth.preferences (user_id, chart, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (user_id) do update set chart = excluded.chart, updated_at = now()`,
    [userId, JSON.stringify(prefs)],
  );
}
