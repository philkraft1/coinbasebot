import assert from "node:assert/strict";
import { test } from "node:test";
import { shortenAddress } from "./wallet.ts";

test("shortenAddress keeps a 0x prefix and last four", () => {
  assert.equal(shortenAddress("0xD10d7eA8B847110f3bbf71781ABefbac01517b82"), "0xD10d…7b82");
  assert.equal(shortenAddress("0xabc"), "0xabc");
});
