#!/usr/bin/env node
/**
 * Build and validate the bundled package snapshot consumed by Short Circuit.
 *
 * The source of truth is registry.json + each package manifest + the package's
 * .lf/docs/test files. This script inlines those files into one JSON document so
 * the app can load packages without filesystem access or a runtime fetch.
 *
 * Macro and circuit bodies are never duplicated in the manifest. The manifest
 * points at a real source file; this build step embeds that file for offline use.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(join(root, "registry.json"), "utf8"));
const packages = [];

const IMPLEMENTATION_KEYS = ["body", "fold", "args", "minArgs", "maxArgs", "variadic"];

function fail(message) {
  throw new Error(`package validation failed: ${message}`);
}

for (const entry of registry.packages) {
  const manifestPath = join(root, entry.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const packageDir = dirname(manifestPath);
  const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));

  if (manifest.schema !== "shortcircuit.package/v1") {
    fail(`${manifestPath} does not use shortcircuit.package/v1`);
  }
  if (manifest.name !== packageJson.name) {
    fail(`${manifestPath} name ${manifest.name} does not match package.json ${packageJson.name}`);
  }
  if (manifest.version !== packageJson.version) {
    fail(`${manifestPath} version ${manifest.version} does not match package.json ${packageJson.version}`);
  }

  const exports = [];
  const seen = new Set();
  for (const item of manifest.exports) {
    const key = `${item.kind}:${item.name}`;
    if (seen.has(key)) fail(`${manifest.name} exports ${key} more than once`);
    seen.add(key);

    if (item.kind === "macro") {
      for (const forbidden of IMPLEMENTATION_KEYS) {
        if (forbidden in item) {
          fail(`${manifest.name} macro ${item.name} stores "${forbidden}" in the manifest; move it into ${item.source ?? "a .lf source"}`);
        }
      }
    }

    const source = await readFile(join(packageDir, item.source), "utf8");
    const declaration = item.kind === "macro"
      ? new RegExp(`\\bMACRO\\s+${item.name}\\s*\\(`)
      : new RegExp(`\\bCIRCUIT\\s+${item.name}\\b`);
    if (!declaration.test(source)) {
      fail(`${manifest.name} export ${item.name} is not declared in ${item.source}`);
    }
    const docs = item.docs ? await readFile(join(packageDir, item.docs), "utf8") : undefined;
    const tests = item.tests ? await readFile(join(packageDir, item.tests), "utf8") : undefined;
    exports.push({
      ...item,
      sourceText: source,
      ...(docs === undefined ? {} : { docsText: docs }),
      ...(tests === undefined ? {} : { testText: tests }),
    });
  }

  packages.push({ ...manifest, exports });
}

const bundle = {
  schema: "shortcircuit.packages/v1",
  generatedAt: new Date().toISOString(),
  packages,
};

await mkdir(join(root, "dist"), { recursive: true });
await writeFile(join(root, "dist", "packages.json"), `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote dist/packages.json (${packages.length} packages)`);
