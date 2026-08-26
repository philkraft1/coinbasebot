import type { ChartPrefs } from "./prefs";

export type AuthUser = { id: string; username: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.username === "string" &&
    value.username.length > 0
  );
}

export function authApiErrorMessage(status: number): string {
  if (status === 400) return "Check your username and password and try again.";
  if (status === 401) return "Username or password is incorrect.";
  if (status === 409) return "That username is unavailable.";
  if (status === 429) return "Too many attempts. Try again later.";
  if (status === 503) return "Accounts are temporarily unavailable.";
  return "The account request failed. Try again.";
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(authApiErrorMessage(response.ok ? 503 : response.status));
  }
  let body: { error?: string } & T = {} as { error?: string } & T;
  try {
    body = (await response.json()) as { error?: string } & T;
  } catch {
    // empty
  }
  if (!response.ok) {
    throw new Error(authApiErrorMessage(response.status));
  }
  return body;
}

function requireUser(result: { user?: unknown }): { user: AuthUser } {
  if (!isAuthUser(result.user)) throw new Error("The account response was invalid.");
  return { user: result.user };
}

export async function signup(username: string, password: string) {
  const result = await api<{ user?: unknown }>("/api/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return requireUser(result);
}

export async function login(username: string, password: string) {
  const result = await api<{ user?: unknown }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return requireUser(result);
}

export function logout() {
  return api<{ ok: boolean }>("/api/logout", { method: "POST" });
}

export async function fetchMe() {
  return requireUser(await api<{ user?: unknown }>("/api/me"));
}

export async function fetchPreferences() {
  const result = await api<{ prefs?: unknown }>("/api/preferences");
  if (!("prefs" in result) || (result.prefs !== null && !isRecord(result.prefs))) {
    throw new Error("The preferences response was invalid.");
  }
  return { prefs: result.prefs as ChartPrefs | null };
}

export function savePreferences(prefs: ChartPrefs) {
  return api<{ prefs: ChartPrefs }>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}
