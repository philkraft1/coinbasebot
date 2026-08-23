import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { hashPassword, normalizePassword, normalizeUsername, verifyPassword } from "./lib/credentials.ts";
import { cookieSecure, isServerlessRuntime, productionAuthError } from "./lib/runtime.ts";
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

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requestOriginAllowed(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  const configured = (process.env.AUTH_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!isServerlessRuntime()) {
    configured.push("http://127.0.0.1:43147", "http://localhost:43147");
  }
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() ||
    (isServerlessRuntime() ? "https" : "http");
  const host = request.headers.host;
  const sameOrigin = host ? `${protocol}://${host}` : "";
  return origin === sameOrigin || configured.includes(origin);
}

async function currentUser(request: FastifyRequest): Promise<SessionUser | null> {
  return readSession(request.cookies[SESSION_COOKIE]);
}

export function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_SEC,
    priority: "high" as const,
    secure: cookieSecure(),
  };
}

export function cookieClearOpts() {
  const { maxAge: _maxAge, ...options } = cookieOpts();
  return options;
}

function rejectIfAuthOffline(store: AuthStore, reply: FastifyReply): boolean {
  const production = productionAuthError();
  if (production) {
    void reply.code(503).send({ error: "Accounts are temporarily unavailable." });
    return true;
  }
  if (store.kind === "unavailable") {
    void reply.code(503).send({ error: "Accounts are temporarily unavailable." });
    return true;
  }
  return false;
}

export async function buildApp(opts: AppOptions = {}): Promise<{ app: FastifyInstance; store: AuthStore }> {
  const store = opts.store || (await openAuthStore());
  if (store.kind === "pglite") await migrateStore(store);
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    trustProxy: isServerlessRuntime() ? (_address: string, hop: number) => hop === 0 : false,
  });
  await app.register(cookie);
  const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
  const dummyPasswordHash = await hashPassword("ivory-dummy-password-never-used");

  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
  });

  app.addHook("preHandler", async (request, reply) => {
    if (MUTATING_METHODS.has(request.method) && !requestOriginAllowed(request)) {
      return reply.code(403).send({ error: "Request origin is not allowed." });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 500;
    const status = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    const message =
      status === 413
        ? "Request body is too large."
        : status < 500
          ? "The request could not be processed."
          : "Internal server error.";
    return reply.code(status).send({ error: message });
  });

  app.get("/api/health", async () =>
    isServerlessRuntime() ? { ok: true } : { ok: true, store: store.kind },
  );

  app.post("/api/signup", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
    const body = (request.body || {}) as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);
    if (
      !limiter.check(`signup:ip:${clientKey(request)}`) ||
      !limiter.check(`signup:user:${username?.toLowerCase() || "invalid"}`)
    ) {
      return reply.code(429).send({ error: "Too many signup attempts. Try again later." });
    }
    if (!username || !password) {
      return reply.code(400).send({
        error: "Username must be 3–32 letters, numbers, or underscores. Password must be at least 8 characters.",
      });
    }
    if (await findUserByUsername(store, username)) {
      return reply.code(409).send({ error: "That username is unavailable." });
    }
    let user: SessionUser;
    try {
      user = await createUser(store, username, await hashPassword(password));
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        return reply.code(409).send({ error: "That username is unavailable." });
      }
      throw error;
    }
    reply.setCookie(SESSION_COOKIE, await signSession(user), cookieOpts());
    return reply.code(201).send({ user });
  });

  app.post("/api/login", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
    const body = (request.body || {}) as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    const password = normalizePassword(body.password);
    if (
      !limiter.check(`login:ip:${clientKey(request)}`) ||
      !limiter.check(`login:user:${username?.toLowerCase() || "invalid"}`)
    ) {
      return reply.code(429).send({ error: "Too many login attempts. Try again later." });
    }
    if (!username || !password) {
      return reply.code(400).send({ error: "Enter a valid username and password." });
    }
    const row = await findUserByUsername(store, username);
    const passwordValid = await verifyPassword(row?.password_hash || dummyPasswordHash, password);
    if (!row || !passwordValid) {
      return reply.code(401).send({ error: "Username or password is incorrect." });
    }
    const user = { id: row.id, username: row.username };
    reply.setCookie(SESSION_COOKIE, await signSession(user), cookieOpts());
    return { user };
  });

  app.post("/api/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, cookieClearOpts());
    return { ok: true };
  });

  app.get("/api/me", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: "Not signed in." });
    return { user };
  });

  app.get("/api/preferences", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: "Not signed in." });
    return { prefs: await readPrefs(store, user.id) };
  });

  app.put("/api/preferences", async (request, reply) => {
    if (rejectIfAuthOffline(store, reply)) return;
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
