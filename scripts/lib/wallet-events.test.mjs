import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyAwalArgs, redactArgs } from "./wallet-events.mjs";

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
