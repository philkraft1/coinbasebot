import type { ChartPrefs } from "./prefs";

export type AuthUser = { id: string; username: string };

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

export function signup(username: string, password: string) {
  return api<{ user: AuthUser }>("/api/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string) {
  return api<{ user: AuthUser }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return api<{ ok: boolean }>("/api/logout", { method: "POST" });
}

export function fetchMe() {
  return api<{ user: AuthUser }>("/api/me");
}

export function fetchPreferences() {
  return api<{ prefs: ChartPrefs | null }>("/api/preferences");
}

export function savePreferences(prefs: ChartPrefs) {
  return api<{ prefs: ChartPrefs }>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}
