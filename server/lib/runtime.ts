/** True on Vercel and other serverless hosts where the filesystem is ephemeral. */
export function isServerlessRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1" || Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Secure cookies on HTTPS hosts. Local http keeps Secure off unless forced. */
export function cookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_COOKIE_SECURE === "1" || env.VERCEL === "1";
}

/**
 * Production accounts need a real Postgres URL (encrypted RDS or a dedicated
 * Neon database) and a stable JWT secret. Never reuse wallet DATABASE_URL.
 */
export function productionAuthError(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isServerlessRuntime(env)) return null;
  if (!(env.AUTH_DATABASE_URL || "").trim()) {
    return "Accounts are not configured. Set AUTH_DATABASE_URL to encrypted RDS or a dedicated Neon database — not wallet DATABASE_URL.";
  }
  if (!(env.AUTH_SESSION_SECRET || "").trim()) {
    return "Accounts are not configured. Set AUTH_SESSION_SECRET so sessions survive serverless cold starts.";
  }
  return null;
}
