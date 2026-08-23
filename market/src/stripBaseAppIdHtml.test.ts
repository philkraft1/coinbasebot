import assert from "node:assert/strict";
import { test } from "node:test";
import { stripBaseAppIdHtml } from "./stripBaseAppIdHtml.ts";

test("stripBaseAppIdHtml removes only the ownership tag", () => {
  const html = `<head>
    <meta charset="UTF-8" />
    <meta name="base:app_id" content="6a8a941d39d7d26f4bad1867" />
    <title>Ivory</title>
  </head>`;
  const stripped = stripBaseAppIdHtml(html);
  assert.equal(stripped.includes("base:app_id"), false);
  assert.equal(stripped.includes("6a8a941d39d7d26f4bad1867"), false);
  assert.equal(stripped.includes('<meta charset="UTF-8" />'), true);
  assert.equal(stripped.includes("<title>Ivory</title>"), true);
});
