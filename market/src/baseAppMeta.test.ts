import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASE_APP_ID,
  ensureBaseAppIdMeta,
  isHomePath,
  removeBaseAppIdMeta,
  syncBaseAppIdMeta,
} from "./baseAppMeta.ts";

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
      removeChild(node: (typeof nodes)[number]) {
        const index = nodes.indexOf(node);
        if (index >= 0) nodes.splice(index, 1);
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

test("isHomePath is only the site root", () => {
  assert.equal(isHomePath("/"), true);
  assert.equal(isHomePath("/spot"), false);
  assert.equal(isHomePath("/login"), false);
  assert.equal(isHomePath("/index.html"), false);
});

test("syncBaseAppIdMeta keeps the tag on home and removes it elsewhere", () => {
  const doc = fakeDoc();
  syncBaseAppIdMeta("/", doc);
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.nodes[0].attrs.content, BASE_APP_ID);

  syncBaseAppIdMeta("/spot", doc);
  assert.equal(doc.nodes.length, 0);

  syncBaseAppIdMeta("/login", doc);
  assert.equal(doc.nodes.length, 0);

  syncBaseAppIdMeta("/", doc);
  assert.equal(doc.nodes.length, 1);
});

test("removeBaseAppIdMeta is a no-op when the tag is missing", () => {
  const doc = fakeDoc();
  assert.equal(removeBaseAppIdMeta(doc), null);
  assert.equal(doc.nodes.length, 0);
});
