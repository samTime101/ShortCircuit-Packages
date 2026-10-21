#!/usr/bin/env node
/**
 * Build the bundled package snapshot consumed by Short Circuit.
 *
 * The source of truth is registry.json + each package manifest + the package's
 * .lf/docs/test files. This script inlines those files into one JSON document so
 * the app can load packages without filesystem access or a runtime fetch.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(join(root, "registry.json"), "utf8"));
const packages = [];

for (const entry of registry.packages) {
  const manifestPath = join(root, entry.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const packageDir = dirname(manifestPath);
  const exports = [];

  for (const item of manifest.exports) {
    if (item.kind !== "circuit") {
      exports.push(item);
      continue;
    }

    const source = await readFile(join(packageDir, item.source), "utf8");
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
