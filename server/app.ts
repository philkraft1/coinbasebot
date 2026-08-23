import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { hashPassword, normalizePassword, normalizeUsername, verifyPassword } from "./lib/credentials.ts";
import { cookieSecure, productionAuthError } from "./lib/runtime.ts";
import { createRateLimiter } from "./lib/rate-limit.ts";
import { sanitizePrefs } from "./lib/prefs.ts";
import { readSession, SESSION_COOKIE, SESSION_TTL_SEC, signSession, type SessionUser } from "./lib/session.ts";
import {
  createUser,
  findUserByUsername,
  migrateStore,
  openAuthStore,
  readPrefs,
  writePrefs,
  type AuthStore,
} from "./lib/store.ts";

export type AppOptions = {
  store?: AuthStore;
  sessionSecretPath?: string;
};

function clientKey(request: FastifyRequest): string {
  return request.ip || "local";
}

async function currentUser(request: FastifyRequest): Promise<SessionUser | null> {
  return readSession(request.cookies[SESSION_COOKIE]);
}

export function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SEC,
    secure: cookieSecure(),
  };
}

function rejectIfAuthOffline(store: AuthStore, reply: FastifyReply): boolean {
  const production = productionAuthError();
  if (production) {
    void reply.code(503).send({ error: production });
    return true;
  }
  if (store.kind === "unavailable") {
    void reply.code(503).send({
      error:
        "Accounts are not configured. Set AUTH_DATABASE_URL to encrypted RDS or a dedicated Neon database — not wallet DATABASE_URL.",
    });
    return true;
  }
  return false;
}

export async function buildApp(opts: AppOptions = {}): Promise<{ app: FastifyInstance; store: AuthStore }> {
  const store = opts.store || (await openAuthStore());
  await migrateStore(store, process.env.AUTH_DATABASE_URL_OWNER || "");
  const app = Fastify({ logger: false });
  await app.register(cookie);
  const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });

  app.get("/api/health", async () => ({ ok: true, store: store.kind }));

  app.post("/api/signup", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
    if (!limiter.check(`signup:${clientKey(request)}`)) {
      return reply.code(429).send({ error: "Too many signup attempts. Try again later." });
    }
    const body = (request.body || {}) as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);
    if (!username || !password) {
      return reply.code(400).send({
        error: "Username must be 3–32 letters, numbers, or underscores. Password must be at least 8 characters.",
      });
    }
    if (await findUserByUsername(store, username)) {
      return reply.code(409).send({ error: "That username is already taken." });
    }
    const user = await createUser(store, username, await hashPassword(password));
    reply.setCookie(SESSION_COOKIE, await signSession(user), cookieOpts());
    return reply.code(201).send({ user });
  });

  app.post("/api/login", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
    if (!limiter.check(`login:${clientKey(request)}`)) {
      return reply.code(429).send({ error: "Too many login attempts. Try again later." });
    }
    const body = (request.body || {}) as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);
    if (!username || !password) {
      return reply.code(400).send({ error: "Enter a valid username and password." });
    }
    const row = await findUserByUsername(store, username);
    if (!row || !(await verifyPassword(row.password_hash, password))) {
      return reply.code(401).send({ error: "Username or password is incorrect." });
    }
    const user = { id: row.id, username: row.username };
    reply.setCookie(SESSION_COOKIE, await signSession(user), cookieOpts());
    return { user };
  });

  app.post("/api/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", async (request, reply) => {
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: "Not signed in." });
    return { user };
  });

  app.get("/api/preferences", async (request, reply) => {
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: "Not signed in." });
    return { prefs: await readPrefs(store, user.id) };
  });

  app.put("/api/preferences", async (request, reply) => {
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: "Not signed in." });
    const prefs = sanitizePrefs(request.body);
    await writePrefs(store, user.id, prefs);
    return { prefs };
  });

  app.addHook("onClose", async () => {
    await store.close();
  });

  return { app, store };
}
