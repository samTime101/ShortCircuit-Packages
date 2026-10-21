import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  defaultExportName,
  packageDirectoryName,
  parseDependencies,
  scaffoldPackage,
  validateExportName,
  validatePackageName,
  validateVersion,
} from "./package.mjs";

async function makeRoot() {
  const root = await mkdtemp(join(tmpdir(), "shortcircuit-package-"));
  await writeFile(
    join(root, "registry.json"),
    `${JSON.stringify({ schema: "shortcircuit.registry/v1", packages: [] }, null, 2)}\n`,
  );
  return root;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("validates scoped npm-style package names", () => {
  assert.equal(validatePackageName("@acme/parity"), "@acme/parity");
  assert.equal(validatePackageName(" @acme/parity "), "@acme/parity");
  assert.equal(validatePackageName("@scope/pkg.name"), "@scope/pkg.name");
  assert.throws(() => validatePackageName("parity"), /Invalid package name/);
  assert.throws(() => validatePackageName("@Acme/parity"), /Invalid package name/);
  assert.throws(() => validatePackageName("@acme/"), /Invalid package name/);
  assert.throws(() => validatePackageName("../parity"), /Invalid package name/);
});

test("derives package directories and export names", () => {
  assert.equal(packageDirectoryName("@acme/parity"), "parity");
  assert.equal(defaultExportName("@acme/parity"), "PARITY");
  assert.equal(defaultExportName("@acme/my-gate"), "MY_GATE");
  assert.equal(defaultExportName("@acme/3bit"), "_3BIT");
  assert.equal(validateExportName("PARITY3"), "PARITY3");
  assert.equal(validateExportName(" PARITY3 "), "PARITY3");
  assert.throws(() => validateExportName("3PARITY"), /Invalid export name/);
  assert.equal(validateVersion("1.2.3"), "1.2.3");
  assert.equal(validateVersion(" 1.2.3 "), "1.2.3");
  assert.throws(() => validateVersion("1.2"), /Invalid version/);
});

test("parses and deduplicates dependency lists", () => {
  assert.deepEqual(
    parseDependencies("@shortcircuit/gates, @shortcircuit/arithmetic @shortcircuit/gates"),
    ["@shortcircuit/gates", "@shortcircuit/arithmetic"],
  );
  assert.deepEqual(parseDependencies(""), []);
  assert.throws(() => parseDependencies("@shortcircuit/gates, nope"), /Invalid package name/);
});

test("scaffolds a macro package, tests, docs, and registry entry", async () => {
  const root = await makeRoot();
  try {
    const result = await scaffoldPackage({
      root,
      name: "@acme/parity",
      exportName: "PARITY3",
      kind: "macro",
      description: "Three-input parity.",
      version: "0.2.0",
      license: "Apache-2.0",
      dependencies: "@shortcircuit/gates",
      autoImport: true,
    });

    const manifest = await readJson(result.manifestPath);
    assert.equal(manifest.schema, "shortcircuit.package/v1");
    assert.equal(manifest.name, "@acme/parity");
    assert.equal(manifest.version, "0.2.0");
    assert.equal(manifest.recommendedAutoImport, true);
    assert.equal(manifest.description, "Three-input parity.");
    assert.equal(manifest.tests, "tests/parity.test.lf");
    assert.deepEqual(manifest.dependencies, { "@shortcircuit/gates": "^0.1.0" });
    assert.equal(manifest.exports.length, 1);
    assert.equal(manifest.exports[0].kind, "macro");
    assert.equal(manifest.exports[0].name, "PARITY3");
    assert.equal(manifest.exports[0].source, "macros/parity3/macro.lf");
    assert.equal(manifest.exports[0].docs, "docs/parity3.md");

    const packageJson = await readJson(join(result.packageDir, "package.json"));
    assert.equal(packageJson.name, "@acme/parity");
    assert.equal(packageJson.version, "0.2.0");
    assert.equal(packageJson.license, "Apache-2.0");
    assert.deepEqual(packageJson.dependencies, { "@shortcircuit/gates": "^0.1.0" });

    assert.match(await readFile(result.sourcePath, "utf8"), /MACRO PARITY3\(a, b\)/);
    assert.match(await readFile(result.docsPath, "utf8"), /# PARITY3/);
    assert.match(await readFile(result.testPath, "utf8"), /CIRCUIT PARITY3_TEST/);

    const registry = await readJson(join(root, "registry.json"));
    assert.deepEqual(registry.packages, [
      {
        name: "@acme/parity",
        version: "0.2.0",
        manifest: "packages/parity/manifest.json",
      },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scaffolds a circuit package with port metadata", async () => {
  const root = await makeRoot();
  try {
    const result = await scaffoldPackage({
      root,
      name: "@acme/display",
      exportName: "SEGMENT",
      kind: "circuit",
      description: "Seven-segment helper.",
    });

    const manifest = await readJson(result.manifestPath);
    assert.equal(manifest.exports[0].kind, "circuit");
    assert.equal(manifest.exports[0].source, "circuits/segment/circuit.lf");
    assert.equal(manifest.exports[0].docs, "circuits/segment/docs.md");
    assert.deepEqual(manifest.exports[0].ports, {
      inputs: [
        { name: "a", width: 1 },
        { name: "b", width: 1 },
      ],
      outputs: [{ name: "y", width: 1 }],
    });
    assert.match(await readFile(result.sourcePath, "utf8"), /CIRCUIT SEGMENT/);
    assert.match(await readFile(result.testPath, "utf8"), /gate = SEGMENT\(a, b\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skips the registry when requested", async () => {
  const root = await makeRoot();
  try {
    const result = await scaffoldPackage({
      root,
      name: "@acme/local",
      exportName: "LOCAL",
      register: false,
    });
    assert.equal(result.registered, false);
    const registry = await readJson(join(root, "registry.json"));
    assert.deepEqual(registry.packages, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects duplicates unless force is set", async () => {
  const root = await makeRoot();
  try {
    await scaffoldPackage({
      root,
      name: "@acme/parity",
      exportName: "PARITY",
    });
    await assert.rejects(
      scaffoldPackage({ root, name: "@acme/parity", exportName: "PARITY2" }),
      /already registered/,
    );
    await assert.rejects(
      scaffoldPackage({
        root,
        name: "@acme/parity",
        exportName: "PARITY2",
        register: false,
      }),
      /already exists/,
    );

    const result = await scaffoldPackage({
      root,
      name: "@acme/parity",
      exportName: "PARITY2",
      version: "0.2.0",
      force: true,
    });
    const manifest = await readJson(result.manifestPath);
    assert.equal(manifest.exports[0].name, "PARITY2");
    const registry = await readJson(join(root, "registry.json"));
    assert.equal(registry.packages.length, 1);
    assert.equal(registry.packages[0].version, "0.2.0");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
