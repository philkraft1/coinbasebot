import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match?.[1] ?? null;
}

function tags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function metaValues(html, key) {
  return tags(html, "meta")
    .filter((tag) => attribute(tag, "name") === key || attribute(tag, "property") === key)
    .map((tag) => attribute(tag, "content"));
}

function linkValues(html, rel) {
  return tags(html, "link")
    .filter((tag) => attribute(tag, "rel") === rel)
    .map((tag) => attribute(tag, "href"));
}

function titleValue(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null;
}

function expectOne(values, expected, label) {
  invariant(values.length === 1, `${label} must appear exactly once (found ${values.length})`);
  invariant(values[0] === expected, `${label} must be "${expected}" (found "${values[0]}")`);
}

export function pngDimensions(buffer) {
  invariant(buffer.length >= 24, "PNG is too small to contain dimensions");
  invariant(buffer.subarray(1, 4).toString("ascii") === "PNG", "Asset is not a PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function validateHtmlDocument(html, config) {
  const canonicalUrl = `${config.origin}/`;
  expectOne(metaValues(html, "base:app_id"), config.appId, "base:app_id");
  expectOne(metaValues(html, "description"), config.description, "description");
  expectOne(metaValues(html, "og:title"), config.title, "og:title");
  expectOne(metaValues(html, "og:description"), config.socialDescription, "og:description");
  expectOne(metaValues(html, "og:type"), "website", "og:type");
  expectOne(metaValues(html, "og:url"), canonicalUrl, "og:url");
  expectOne(
    metaValues(html, "og:image"),
    new URL(config.socialImagePath, config.origin).href,
    "og:image",
  );
  expectOne(metaValues(html, "twitter:card"), "summary_large_image", "twitter:card");
  expectOne(metaValues(html, "twitter:title"), config.title, "twitter:title");
  expectOne(
    metaValues(html, "twitter:description"),
    config.socialDescription,
    "twitter:description",
  );
  expectOne(
    metaValues(html, "twitter:image"),
    new URL(config.socialImagePath, config.origin).href,
    "twitter:image",
  );
  expectOne(linkValues(html, "canonical"), canonicalUrl, "canonical link");
  expectOne(linkValues(html, "manifest"), config.manifestPath, "manifest link");
  invariant(titleValue(html) === config.title, `title must be "${config.title}"`);
  invariant(html.includes('id="root"'), "HTML must contain the React root element");
}

export function validateManifest(manifest, config) {
  invariant(manifest.name === config.name, `manifest name must be "${config.name}"`);
  invariant(manifest.short_name === config.name, `manifest short_name must be "${config.name}"`);
  invariant(
    manifest.description === config.description,
    `manifest description must be "${config.description}"`,
  );
  invariant(manifest.start_url === "/", "manifest start_url must be /");
  invariant(manifest.display === "standalone", "manifest display must be standalone");
  invariant(Array.isArray(manifest.icons), "manifest icons must be an array");

  for (const asset of config.assets.filter((item) => item.manifest)) {
    const icon = manifest.icons.find((item) => item.src === asset.path);
    invariant(icon, `manifest must include ${asset.path}`);
    invariant(icon.type === asset.contentType, `${asset.path} manifest type must be ${asset.contentType}`);
    if (asset.sizes) {
      invariant(icon.sizes === asset.sizes, `${asset.path} manifest size must be ${asset.sizes}`);
    } else if (asset.width && asset.height) {
      invariant(
        icon.sizes === `${asset.width}x${asset.height}`,
        `${asset.path} manifest size must be ${asset.width}x${asset.height}`,
      );
    }
  }
}

async function readConfig(rootDir) {
  const path = resolve(rootDir, "config/base-app.json");
  return JSON.parse(await readFile(path, "utf8"));
}

async function validateAssetBuffer(buffer, asset) {
  if (asset.contentType === "image/png") {
    const dimensions = pngDimensions(buffer);
    invariant(
      dimensions.width === asset.width && dimensions.height === asset.height,
      `${asset.path} must be ${asset.width}x${asset.height} (found ${dimensions.width}x${dimensions.height})`,
    );
  }
  if (asset.contentType === "image/svg+xml") {
    invariant(buffer.toString("utf8").includes("<svg"), `${asset.path} must contain SVG markup`);
  }
}

export async function validateStaticBaseApp({
  rootDir = process.cwd(),
  distDir = "market/dist",
} = {}) {
  const config = await readConfig(rootDir);
  const outputDir = resolve(rootDir, distDir);
  const html = await readFile(resolve(outputDir, "index.html"), "utf8");
  validateHtmlDocument(html, config);

  const manifest = JSON.parse(
    await readFile(resolve(outputDir, config.manifestPath.slice(1)), "utf8"),
  );
  validateManifest(manifest, config);

  for (const asset of config.assets) {
    const buffer = await readFile(resolve(outputDir, asset.path.slice(1)));
    await validateAssetBuffer(buffer, asset);
  }

  return {
    target: outputDir,
    checks: 2 + config.assets.length,
    config,
  };
}

async function fetchOk(url, expectedType) {
  const response = await fetch(url, {
    headers: { "user-agent": "ivory-base-app-check/1.0" },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  invariant(response.ok, `${url} returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  invariant(
    contentType.toLowerCase().startsWith(expectedType.toLowerCase()),
    `${url} must return ${expectedType} (found ${contentType || "no content-type"})`,
  );
  return { response, buffer: Buffer.from(await response.arrayBuffer()) };
}

export async function validateLiveBaseApp(url, { rootDir = process.cwd() } = {}) {
  const config = await readConfig(rootDir);
  const target = new URL(url);
  invariant(target.protocol === "https:", "Live Base App URL must use HTTPS");
  target.pathname = "/";
  target.search = "";
  target.hash = "";

  const root = await fetchOk(target, "text/html");
  validateHtmlDocument(root.buffer.toString("utf8"), config);

  const manifestUrl = new URL(config.manifestPath, target);
  const manifestResponse = await fetchOk(manifestUrl, "application/manifest+json");
  validateManifest(JSON.parse(manifestResponse.buffer.toString("utf8")), config);

  for (const asset of config.assets) {
    const assetResponse = await fetchOk(new URL(asset.path, target), asset.contentType);
    await validateAssetBuffer(assetResponse.buffer, asset);
  }

  for (const route of config.routes.filter((path) => path !== "/")) {
    const routeResponse = await fetchOk(new URL(route, target), "text/html");
    invariant(
      routeResponse.buffer.toString("utf8").includes('id="root"'),
      `${route} must return the Ivory app shell`,
    );
  }

  return {
    target: target.href,
    checks: 2 + config.assets.length + config.routes.length - 1,
    config,
  };
}
