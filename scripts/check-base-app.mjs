#!/usr/bin/env node

import { validateLiveBaseApp, validateStaticBaseApp } from "./lib/base-app-check.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

try {
  const liveUrl = option("--url");
  const result = liveUrl
    ? await validateLiveBaseApp(liveUrl)
    : await validateStaticBaseApp({ distDir: option("--dist") ?? "market/dist" });

  console.log(`Base App preflight passed: ${result.target}`);
  console.log(`Validated ${result.checks} metadata, route, manifest, and asset checks.`);
} catch (error) {
  console.error(`Base App preflight failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
