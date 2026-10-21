#!/usr/bin/env node
/**
 * Package authoring CLI for the Short Circuit package registry.
 *
 * This script intentionally has no runtime dependencies so it works from a
 * fresh checkout of the registry, or from the submodule inside the main repo.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(scriptDirectory, "..");

const NAME_PATTERN = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const EXPORT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export class PackageCliError extends Error {
  constructor(message) {
    super(message);
    this.name = "PackageCliError";
  }
}

function fail(message) {
  throw new PackageCliError(message);
}

export function validatePackageName(name) {
  const value = typeof name === "string" ? name.trim() : name;
  if (typeof value !== "string" || !NAME_PATTERN.test(value)) {
    fail(
      `Invalid package name "${value ?? ""}". Use a scoped npm-style name such as @acme/parity.`,
    );
  }
  return value;
}

export function packageDirectoryName(name) {
  validatePackageName(name);
  const base = name.includes("/") ? name.slice(name.indexOf("/") + 1) : name;
  return base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "package"
  );
}

export function defaultExportName(name) {
  const directory = packageDirectoryName(name);
  const upper = directory.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return /^[A-Z_]/.test(upper) ? upper : `_${upper}`;
}

export function validateExportName(name) {
  const value = typeof name === "string" ? name.trim() : name;
  if (typeof value !== "string" || !EXPORT_PATTERN.test(value)) {
    fail(
      `Invalid export name "${value ?? ""}". Use a LogicFlow name such as PARITY3 or MyCircuit.`,
    );
  }
  return value;
}

export function validateVersion(version) {
  const value = typeof version === "string" ? version.trim() : version;
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    fail(`Invalid version "${value ?? ""}". Use SemVer, for example 0.1.0.`);
  }
  return value;
}

export function parseDependencies(raw) {
  if (raw === undefined || raw === null || raw === "") return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
  const dependencies = [];
  for (const value of values) {
    const name = value.trim();
    if (!name) continue;
    validatePackageName(name);
    if (!dependencies.includes(name)) dependencies.push(name);
  }
  return dependencies;
}

function parseYesNo(value) {
  return /^y(?:es)?$/i.test(String(value).trim());
}

function parseFlags(argv) {
  const flags = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    if (!body) continue;
    const equals = body.indexOf("=");
    if (equals !== -1) {
      flags[body.slice(0, equals)] = body.slice(equals + 1);
      continue;
    }
    if (body === "yes" || body === "force" || body === "auto-import" || body === "no-registry") {
      flags[body] = true;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[body] = next;
      index += 1;
      continue;
    }
    flags[body] = true;
  }
  return { flags, positionals };
}

function usage() {
  return `Short Circuit package CLI

Usage:
  npm run package:init
  npm run package:init -- --name @acme/parity
  npm run package:build
  npm run package:test
  npm run package:check
  npm run package:list

Commands:
  init      Create a package, docs, tests, and a registry entry.
  build     Validate manifests and rebuild dist/packages.json.
  test      Build, then run the package tests in the main Short Circuit repo.
  check     Build and test in one command.
  list      List the packages in registry.json.
  help      Show this message.

Init options:
  --name <@scope/name>       Package name. Prompts when omitted.
  --export <NAME>            Public macro or circuit name.
  --kind <macro|circuit>     Export kind. Default: macro.
  --description <text>       Catalog description.
  --version <semver>         Package version. Default: 0.1.0.
  --license <id>             License identifier. Default: MIT.
  --dependencies <list>      Comma-separated package names.
  --auto-import              Enable recommendedAutoImport.
  --no-registry              Do not edit registry.json.
  --force                    Replace an existing package directory.
  --yes                      Use defaults and never prompt.

Examples:
  npm run package:init
  npm run package:init -- --name @acme/parity --export PARITY3 --kind macro
  npm run package:init -- --name @acme/display --kind circuit --yes
  npm run package:check
`;
}

function initUsage() {
  return `${usage()}
Interactive init asks for the package name, export name, kind, description,
version, license, dependencies, and whether to auto-import. Press Enter to accept
the value in brackets.
`;
}

class Prompter {
  constructor() {
    this.readline = createInterface({ input, output });
  }

  async ask(label, defaultValue = "") {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    const answer = (await this.readline.question(`${label}${suffix}: `)).trim();
    return answer || defaultValue;
  }

  close() {
    this.readline.close();
  }
}

function packageJsonFor(options) {
  const value = {
    name: options.name,
    version: options.version,
    description: options.description,
    license: options.license,
  };
  if (options.dependencies.length > 0) {
    value.dependencies = Object.fromEntries(
      options.dependencies.map((dependency) => [dependency, "^0.1.0"]),
    );
  }
  return value;
}

function manifestFor(options) {
  const macro = options.kind === "macro";
  const slug = slugify(options.exportName);
  const source = macro
    ? `macros/${slug}/macro.lf`
    : `circuits/${slug}/circuit.lf`;
  const docs = macro ? `docs/${slug}.md` : `circuits/${slug}/docs.md`;
  const tests = `tests/${packageDirectoryName(options.name)}.test.lf`;
  const exportEntry = {
    kind: options.kind,
    name: options.exportName,
    source,
    group: macro ? "Macros" : "Circuits",
    summary: options.description,
    docs,
    examples: macro
      ? [`y = ${options.exportName}(a, b)`]
      : [`inst = ${options.exportName}(a, b)`, `y = inst.y`],
    ...(macro ? { widthRule: "Result width = common input width" } : {}),
    ...(macro
      ? {}
      : {
          ports: {
            inputs: [
              { name: "a", width: 1 },
              { name: "b", width: 1 },
            ],
            outputs: [{ name: "y", width: 1 }],
          },
        }),
  };
  return {
    schema: "shortcircuit.package/v1",
    name: options.name,
    version: options.version,
    engine: "^0.1.0",
    recommendedAutoImport: options.autoImport,
    description: options.description,
    ...(options.dependencies.length > 0
      ? {
          dependencies: Object.fromEntries(
            options.dependencies.map((dependency) => [dependency, "^0.1.0"]),
          ),
        }
      : {}),
    tests,
    exports: [exportEntry],
  };
}

function macroSource(name) {
  return `MACRO ${name}(a, b)
  BODY NAND(a, b)
END
`;
}

function circuitSource(name) {
  return `CIRCUIT ${name}
  INPUT a
  INPUT b

  y = NAND(a, b)

  OUTPUT y
END
`;
}

function macroDocs(name) {
  return `# ${name}

Describe what \`${name}\` does.

This scaffold uses the kernel \`NAND\` operation. Replace the body and this
documentation with the real behavior.

\`\`\`logicflow
y = ${name}(a, b)
\`\`\`
`;
}

function circuitDocs(name) {
  return `# ${name}

Describe what \`${name}\` does.

## Ports

| Port | Direction | Width |
| --- | --- | --- |
| \`a\` | input | 1 |
| \`b\` | input | 1 |
| \`y\` | output | 1 |

This scaffold uses the kernel \`NAND\` operation. Replace the circuit and this
documentation with the real behavior.
`;
}

function macroTest(name) {
  return `CIRCUIT ${name}_TEST
  INPUT a
  INPUT b

  y = ${name}(a, b)

  OUTPUT y
END

TEST ${name}_TEST
  CASE "both high"
    INPUT a = 1
    INPUT b = 1
    EXPECT y = 0
  END

  CASE "one high"
    INPUT a = 1
    INPUT b = 0
    EXPECT y = 1
  END
END
`;
}

function circuitTest(name) {
  return `CIRCUIT ${name}_TEST
  INPUT a
  INPUT b

  gate = ${name}(a, b)
  y = gate.y

  OUTPUT y
END

TEST ${name}_TEST
  CASE "both high"
    INPUT a = 1
    INPUT b = 1
    EXPECT y = 0
  END

  CASE "one high"
    INPUT a = 1
    INPUT b = 0
    EXPECT y = 1
  END
END
`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readRegistry(root) {
  const path = join(root, "registry.json");
  if (!existsSync(path)) {
    return { schema: "shortcircuit.registry/v1", packages: [] };
  }
  const registry = await readJson(path);
  if (registry.schema !== "shortcircuit.registry/v1" || !Array.isArray(registry.packages)) {
    fail(`${path} is not a shortcircuit.registry/v1 registry.`);
  }
  return registry;
}

/**
 * Create a package directory and optionally register it.
 *
 * Exported for tests and for hosts that want to wrap the CLI.
 */
export async function scaffoldPackage(options) {
  const root = resolve(options.root);
  const name = validatePackageName(options.name);
  const exportName = validateExportName(options.exportName);
  const kind = String(options.kind ?? "macro").trim().toLowerCase();
  if (kind !== "macro" && kind !== "circuit") {
    fail(`Unknown export kind "${kind}". Use macro or circuit.`);
  }
  const version = validateVersion(options.version ?? "0.1.0");
  const description = String(options.description ?? "A Short Circuit package.").trim() ||
    "A Short Circuit package.";
  const license = String(options.license ?? "MIT").trim() || "MIT";
  const dependencies = parseDependencies(options.dependencies);
  if (dependencies.includes(name)) fail("A package cannot depend on itself.");
  const autoImport = options.autoImport === true;
  const force = options.force === true;
  const register = options.register !== false;

  const directory = packageDirectoryName(name);
  const packageDir = join(root, "packages", directory);
  const manifestRelative = `packages/${directory}/manifest.json`;
  const registry = register ? await readRegistry(root) : null;
  const existing = registry?.packages.find((entry) => entry.name === name);
  const manifestConflict = registry?.packages.find(
    (entry) => entry.name !== name && entry.manifest === manifestRelative,
  );
  if (manifestConflict) {
    fail(`registry.json already points ${manifestConflict.manifest} at ${manifestConflict.name}.`);
  }
  if (existing && !force) {
    fail(`Package ${name} is already registered. Use --force to replace it.`);
  }
  if (existsSync(packageDir) && !force) {
    fail(`Package directory ${packageDir} already exists. Use --force to replace it.`);
  }
  if (existsSync(packageDir)) await rm(packageDir, { recursive: true, force: true });

  const manifest = manifestFor({
    name,
    exportName,
    kind,
    version,
    description,
    license,
    dependencies,
    autoImport,
  });
  const exportEntry = manifest.exports[0];
  const sourcePath = join(packageDir, exportEntry.source);
  const docsPath = join(packageDir, exportEntry.docs);
  const testPath = join(packageDir, manifest.tests);
  const source = kind === "macro" ? macroSource(exportName) : circuitSource(exportName);
  const docs = kind === "macro" ? macroDocs(exportName) : circuitDocs(exportName);
  const tests = kind === "macro" ? macroTest(exportName) : circuitTest(exportName);

  await mkdir(packageDir, { recursive: true });
  await writeJson(join(packageDir, "package.json"), packageJsonFor({
    name,
    version,
    description,
    license,
    dependencies,
  }));
  await writeJson(join(packageDir, "manifest.json"), manifest);
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, source);
  await mkdir(dirname(docsPath), { recursive: true });
  await writeFile(docsPath, docs);
  await mkdir(dirname(testPath), { recursive: true });
  await writeFile(testPath, tests);

  if (register) {
    registry.packages = registry.packages.filter((entry) => entry.name !== name);
    registry.packages.push({ name, version, manifest: manifestRelative });
    await writeJson(join(root, "registry.json"), registry);
  }

  return {
    packageDir,
    manifestPath: join(packageDir, "manifest.json"),
    sourcePath,
    docsPath,
    testPath,
    registered: register,
  };
}

async function commandInit(argv) {
  const { flags } = parseFlags(argv);
  if (flags.help) {
    process.stdout.write(initUsage());
    return 0;
  }
  const interactive = flags.yes !== true && Boolean(process.stdin.isTTY);
  const prompter = interactive ? new Prompter() : null;
  try {
    let name = typeof flags.name === "string" ? flags.name : undefined;
    if (!name) {
      if (!interactive) {
        fail("Missing --name. Run interactively or pass --name @scope/package.");
      }
      name = await prompter.ask("What is the name of the package? (e.g. @acme/parity)");
    }
    name = validatePackageName(name);

    let exportName = typeof flags.export === "string" ? flags.export : undefined;
    let kind = typeof flags.kind === "string" ? flags.kind : undefined;
    let description = typeof flags.description === "string" ? flags.description : undefined;
    let version = typeof flags.version === "string" ? flags.version : undefined;
    let license = typeof flags.license === "string" ? flags.license : undefined;
    let dependencies = flags.dependencies !== undefined ? String(flags.dependencies) : undefined;
    let autoImport = flags["auto-import"] === true ? true : undefined;

    if (interactive) {
      if (exportName === undefined) {
        exportName = await prompter.ask("Public export name", defaultExportName(name));
      }
      if (kind === undefined) {
        kind = await prompter.ask("Export kind (macro or circuit)", "macro");
      }
      if (description === undefined) {
        description = await prompter.ask("Description", "A Short Circuit package.");
      }
      if (version === undefined) {
        version = await prompter.ask("Version", "0.1.0");
      }
      if (license === undefined) {
        license = await prompter.ask("License", "MIT");
      }
      if (dependencies === undefined) {
        dependencies = await prompter.ask("Dependencies (comma-separated, blank for none)", "");
      }
      if (autoImport === undefined) {
        autoImport = parseYesNo(
          await prompter.ask("Auto-import without an IMPORT? (y/N)", "n"),
        );
      }
    }

    exportName = exportName ?? defaultExportName(name);
    kind = (kind ?? "macro").trim().toLowerCase();
    description = description ?? "A Short Circuit package.";
    version = version ?? "0.1.0";
    license = license ?? "MIT";
    dependencies = dependencies ?? "";
    autoImport = autoImport ?? false;

    if (kind !== "macro" && kind !== "circuit") {
      fail(`Unknown export kind "${kind}". Use macro or circuit.`);
    }

    const result = await scaffoldPackage({
      root: packageRoot,
      name,
      exportName,
      kind,
      description,
      version,
      license,
      dependencies,
      autoImport,
      register: flags["no-registry"] !== true,
      force: flags.force === true,
    });

    const relative = (path) => path.slice(packageRoot.length + 1);
    process.stdout.write(`\nCreated ${name}\n\n`);
    process.stdout.write(`  ${relative(result.manifestPath)}\n`);
    process.stdout.write(`  ${relative(result.sourcePath)}\n`);
    process.stdout.write(`  ${relative(result.docsPath)}\n`);
    process.stdout.write(`  ${relative(result.testPath)}\n\n`);
    if (!result.registered) {
      process.stdout.write("Skipped registry.json because --no-registry was used.\n\n");
    }
    process.stdout.write("Next:\n");
    process.stdout.write(`  1. Replace the scaffold in ${relative(result.sourcePath)}\n`);
    process.stdout.write("  2. npm run package:build\n");
    process.stdout.write("  3. npm run package:test\n");
    if (!autoImport) {
      process.stdout.write(
        `\nUse it with: IMPORT "${name}" (or add AS Alias for qualified access).\n`,
      );
    }
    return 0;
  } finally {
    prompter?.close();
  }
}

function runBuild() {
  process.stdout.write("Building package bundle...\n");
  const result = spawnSync(process.execPath, [join(packageRoot, "scripts", "build.mjs")], {
    cwd: packageRoot,
    stdio: "inherit",
  });
  if (result.error) {
    process.stderr.write(`Could not run the package build: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

function findMainRoot() {
  const configured = process.env.SHORTCIRCUIT_ROOT;
  if (configured) {
    const root = resolve(configured);
    if (existsSync(join(root, "packages", "engine", "src", "index.ts"))) return root;
    fail(`SHORTCIRCUIT_ROOT does not point at a Short Circuit checkout: ${root}`);
  }
  let directory = packageRoot;
  while (true) {
    if (
      existsSync(join(directory, "packages", "engine", "src", "index.ts")) &&
      existsSync(join(directory, "package.json"))
    ) {
      return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function runPackageTests() {
  const mainRoot = findMainRoot();
  if (!mainRoot) {
    process.stderr.write(
      "Could not find the Short Circuit main repository.\n" +
        "Run this from vendor/ShortCircuit-Packages inside the main repo, or set\n" +
        "SHORTCIRCUIT_ROOT=/path/to/ShortCircuit.\n",
    );
    return 1;
  }
  process.stdout.write(`Running package tests from ${mainRoot}...\n`);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["run", "test:packages"], {
    cwd: mainRoot,
    stdio: "inherit",
  });
  if (result.error) {
    process.stderr.write(`Could not run package tests: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

function commandBuild() {
  return runBuild();
}

function commandTest() {
  const build = runBuild();
  if (build !== 0) return build;
  return runPackageTests();
}

function commandCheck() {
  return commandTest();
}

async function commandList() {
  const registry = await readRegistry(packageRoot);
  if (registry.packages.length === 0) {
    process.stdout.write("No packages registered.\n");
    return 0;
  }
  process.stdout.write("Packages:\n");
  for (const entry of registry.packages) {
    const manifestPath = join(packageRoot, entry.manifest);
    let detail = "";
    if (existsSync(manifestPath)) {
      try {
        const manifest = await readJson(manifestPath);
        const exports = Array.isArray(manifest.exports) ? manifest.exports : [];
        detail = ` (${exports.length} export${exports.length === 1 ? "" : "s"})`;
      } catch {
        detail = " (invalid manifest)";
      }
    } else {
      detail = " (manifest missing)";
    }
    process.stdout.write(`  ${entry.name}@${entry.version}${detail}\n`);
  }
  return 0;
}

async function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case "init":
      return commandInit(rest);
    case "build":
      return commandBuild();
    case "test":
      return commandTest();
    case "check":
      return commandCheck();
    case "list":
      return commandList();
    case "help":
    case undefined:
      process.stdout.write(usage());
      return 0;
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${usage()}`);
      return 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
