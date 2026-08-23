import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  builderCodeSuffix,
  pngDimensions,
  validateConfig,
  validateHtmlDocument,
  validateManifest,
  validateVercelSecurityConfig,
} from "./base-app-check.mjs";

const config = JSON.parse(
  await readFile(new URL("../../config/base-app.json", import.meta.url), "utf8"),
);
const vercel = JSON.parse(
  await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
);

function validHtml() {
  const image = new URL(config.socialImagePath, config.origin).href;
  return `<!doctype html>
    <html>
      <head>
        <meta name="base:app_id" content="${config.appId}">
        <meta name="description" content="${config.description}">
        <meta property="og:title" content="${config.title}">
        <meta property="og:description" content="${config.socialDescription}">
        <meta property="og:type" content="website">
        <meta property="og:url" content="${config.origin}/">
        <meta property="og:image" content="${image}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${config.title}">
        <meta name="twitter:description" content="${config.socialDescription}">
        <meta name="twitter:image" content="${image}">
        <link rel="canonical" href="${config.origin}/">
        <link rel="manifest" href="${config.manifestPath}">
        <title>${config.title}</title>
      </head>
      <body><div id="root"></div></body>
    </html>`;
}

test("validates the Base project and ERC-8021 Builder Code config", () => {
  assert.equal(builderCodeSuffix(config.builderCode), config.builderCodeSuffix);
  assert.doesNotThrow(() => validateConfig(config));
  assert.throws(
    () => validateConfig({ ...config, builderCodeSuffix: "0xdeadbeef" }),
    /does not match/,
  );
});

test("validates locked installs, constrained proxy routes, and browser security headers", () => {
  assert.doesNotThrow(() => validateVercelSecurityConfig(vercel));
  const insecure = structuredClone(vercel);
  insecure.rewrites[0] = {
    source: "/coinbase-api/:path*",
    destination: "https://api.coinbase.com/:path*",
  };
  assert.throws(() => validateVercelSecurityConfig(insecure), /must be limited/);
});

test("validates the canonical Base App homepage metadata", () => {
  assert.doesNotThrow(() => validateHtmlDocument(validHtml(), config));
});

test("rejects a missing or duplicated Base app id", () => {
  const missing = validHtml().replace(/<meta name="base:app_id"[^>]*>/, "");
  assert.throws(() => validateHtmlDocument(missing, config), /exactly once/);

  const duplicate = validHtml().replace(
    "</head>",
    `<meta name="base:app_id" content="${config.appId}"></head>`,
  );
  assert.throws(() => validateHtmlDocument(duplicate, config), /exactly once/);
});

test("validates required manifest metadata and icons", () => {
  const manifest = {
    name: config.name,
    short_name: config.name,
    description: config.description,
    start_url: "/",
    display: "standalone",
    icons: config.assets
      .filter((asset) => asset.manifest)
      .map((asset) => ({
        src: asset.path,
        sizes: asset.sizes ?? `${asset.width}x${asset.height}`,
        type: asset.contentType,
      })),
  };
  assert.doesNotThrow(() => validateManifest(manifest, config));
  assert.throws(
    () => validateManifest({ ...manifest, icons: manifest.icons.slice(1) }, config),
    /manifest must include/,
  );
});

test("reads PNG dimensions without an image dependency", () => {
  const png = Buffer.alloc(24);
  png.set(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 0);
  png.writeUInt32BE(512, 16);
  png.writeUInt32BE(256, 20);
  assert.deepEqual(pngDimensions(png), { width: 512, height: 256 });
});
