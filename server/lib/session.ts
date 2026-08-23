import { createSecretKey, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { jwtVerify, SignJWT } from "jose";
import { isServerlessRuntime } from "./runtime.ts";

export const SESSION_COOKIE = "cb_session";
export const SESSION_TTL_SEC = 60 * 60 * 24;
export const MIN_SESSION_SECRET_BYTES = 32;
const SESSION_ISSUER = "ivory-auth";
const SESSION_AUDIENCE = "ivory-web";

export type SessionUser = { id: string; username: string };

function persistDevSecret(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8").trim();
  } catch {
    const secret = randomBytes(32).toString("base64url");
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, secret, { mode: 0o600 });
    return secret;
  }
}

export function sessionSecret(devSecretPath = ".data/session.secret"): Uint8Array {
  const fromEnv = (process.env.AUTH_SESSION_SECRET || "").trim();
  if (fromEnv) {
    const encoded = new TextEncoder().encode(fromEnv);
    if (encoded.byteLength < MIN_SESSION_SECRET_BYTES) {
      throw new Error(`AUTH_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_BYTES} bytes.`);
    }
    return encoded;
  }
  if (isServerlessRuntime()) {
    throw new Error("AUTH_SESSION_SECRET is required in production (Vercel / serverless).");
  }
  return new TextEncoder().encode(persistDevSecret(devSecretPath));
}

export async function signSession(user: SessionUser, secret = sessionSecret()): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(createSecretKey(secret));
}

export async function readSession(token: string | undefined, secret?: Uint8Array): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, createSecretKey(secret ?? sessionSecret()), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const id = typeof payload.sub === "string" ? payload.sub : "";
    const username = typeof payload.username === "string" ? payload.username : "";
    if (!id || !username) return null;
    return { id, username };
  } catch {
    return null;
  }
}
