import assert from "node:assert/strict";
import { test } from "node:test";
import { BASE_APP_ID, ensureBaseAppIdMeta } from "./baseAppMeta.ts";

function fakeDoc() {
  const nodes: Array<{ attrs: Record<string, string>; setAttribute(name: string, value: string): void }> = [];
  const make = () => {
    const node = {
      attrs: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        node.attrs[name] = value;
      },
    };
    return node;
  };
  return {
    nodes,
    head: {
      appendChild(node: (typeof nodes)[number]) {
        nodes.push(node);
      },
    },
    querySelector(selector: string) {
      if (selector !== 'meta[name="base:app_id"]') return null;
      return nodes.find((node) => node.attrs.name === "base:app_id") || null;
    },
    createElement() {
      return make();
    },
  };
}

test("ensureBaseAppIdMeta inserts and then updates the ownership tag", () => {
  const doc = fakeDoc();
  ensureBaseAppIdMeta(doc);
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.nodes[0].attrs.name, "base:app_id");
  assert.equal(doc.nodes[0].attrs.content, BASE_APP_ID);
  ensureBaseAppIdMeta(doc);
  assert.equal(doc.nodes.length, 1);
});
