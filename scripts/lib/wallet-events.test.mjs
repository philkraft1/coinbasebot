import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildPooledAppUrl,
  classifyAwalArgs,
  normalizeDatabaseUrl,
  redactArgs,
} from "./wallet-events.mjs";

test("redacts OTP on auth verify", () => {
  assert.deepEqual(redactArgs(["auth", "verify", "123456"]), ["auth", "verify", "[redacted]"]);
});

test("classifies trade and send", () => {
  const trade = classifyAwalArgs(["trade", "1", "usdc", "eth"]);
  assert.equal(trade.kind, "trade");
  assert.equal(trade.amount, 1);
  assert.equal(trade.fromAsset, "usdc");
  assert.equal(trade.toAsset, "eth");
  assert.equal(trade.chain, "base");

  const send = classifyAwalArgs(["send", "0.5", "0xabc", "--asset", "eth", "--chain", "base"]);
  assert.equal(send.kind, "send");
  assert.equal(send.amount, 0.5);
  assert.equal(send.recipient, "0xabc");
  assert.equal(send.fromAsset, "eth");
});

test("classifies auth login email and never stores the OTP", () => {
  const login = classifyAwalArgs(["auth", "login", "kraftcoding@gmail.com"]);
  assert.equal(login.kind, "auth_login");
  assert.equal(login.email, "kraftcoding@gmail.com");
  const verify = classifyAwalArgs(["auth", "verify", "999111"]);
  assert.equal(verify.kind, "auth_verify");
  assert.match(verify.command, /\[redacted\]/);
  assert.equal(verify.command.includes("999111"), false);
});

test("normalizeDatabaseUrl forces verify-full and drops channel_binding", () => {
  const url = normalizeDatabaseUrl(
    "postgresql://u:p@host/neondb?sslmode=require&channel_binding=require",
  );
  assert.match(url, /sslmode=verify-full/);
  assert.equal(url.includes("channel_binding"), false);
});

test("buildPooledAppUrl switches user to wallet_app and adds -pooler", () => {
  const url = buildPooledAppUrl(
    "postgresql://neondb_owner:secret@ep-example.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "app-pass",
  );
  const parsed = new URL(url);
  assert.equal(parsed.username, "wallet_app");
  assert.equal(parsed.password, "app-pass");
  assert.equal(parsed.hostname, "ep-example-pooler.c-4.us-east-2.aws.neon.tech");
});

test("security migration enables FORCE RLS and revokes PUBLIC", () => {
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../sql/wallet-security.sql"),
    "utf8",
  );
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on schema wallet from public/i);
  assert.match(sql, /grant select, insert on table wallet.events to wallet_app/i);
  assert.equal(/grant\s+(all|update|delete)/i.test(sql), false);
});
