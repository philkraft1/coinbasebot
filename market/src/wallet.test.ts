import assert from "node:assert/strict";
import { test } from "node:test";
import { shortenAddress, walletErrorMessage } from "./wallet.ts";

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
