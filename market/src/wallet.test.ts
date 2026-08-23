import assert from "node:assert/strict";
import { test } from "node:test";
import { shortenAddress, walletConnectorLabel, walletErrorMessage } from "./wallet.ts";

test("shortenAddress keeps a 0x prefix and last four", () => {
  assert.equal(shortenAddress("0xD10d7eA8B847110f3bbf71781ABefbac01517b82"), "0xD10d…7b82");
  assert.equal(shortenAddress("0xabc"), "0xabc");
});

test("walletErrorMessage keeps internal wallet details out of the navbar", () => {
  assert.equal(
    walletErrorMessage(new Error("User rejected the request.\nDetails: popup closed\nVersion: viem@2")),
    "Connection cancelled.",
  );
  assert.equal(
    walletErrorMessage(new Error("RPC unavailable\nVersion: viem@2")),
    "Wallet connection failed. Try again.",
  );
});

test("walletConnectorLabel makes the selected provider explicit and bounds untrusted names", () => {
  assert.equal(walletConnectorLabel({ id: "baseAccount", name: "Injected" }), "Base Account");
  assert.equal(
    walletConnectorLabel({ id: "injected", name: "Example\u0000 Wallet with an extremely long name" }),
    "Browser wallet · Example Wallet with an extremely",
  );
  assert.equal(walletConnectorLabel(undefined), "Wallet");
});
