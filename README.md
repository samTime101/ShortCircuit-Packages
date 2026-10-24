# Short Circuit Packages

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/samTime101/ShortCircuit/blob/main/LICENSE)

> **The official package registry for Short Circuit and the LogicFlow language.**

Short Circuit keeps a minimal kernel: `NAND`, constants, wires, ports, buses, structural wiring (`CONCAT`, `SLICE`, `BROADCAST`, ...), `CIRCUIT` composition, and `STATE`/clock edges.

**Everything else lives here** — gates, arithmetic, selection, comparison, and community packages — all built from those fundamentals as real `.lf` source files.

---

## Available Packages

| Package | Exports | Description |
|---------|---------|-------------|
| `@shortcircuit/gates` | `NOT`, `AND`, `OR`, `BUFFER`, `NOR`, `XOR`, `XNOR` | Core logic macros (NAND-derived) |
| `@shortcircuit/arithmetic` | `HALF_ADDER`, `FULL_ADDER`, `ADD4`, `ADD8` | Combinational adder circuits |
| `@shortcircuit/selection` | `MUX` | Multiplexer macro |

> **Note**: The web studio bundles these by default. The CLI requires explicit `shortcircuit package install` before use.

---

## Package Format

See [SPEC.md](SPEC.md) for the full specification and [`schemas/`](schemas/) for JSON Schemas.

### Structure

```
packages/<name>/
├─ package.json        # Node metadata (name, version, deps)
├─ manifest.json       # Catalog metadata + source pointers
├─ macros/
│  └─ <name>/
│     └─ macro.lf      # Macro implementation (value macros)
├─ circuits/
│  └─ <name>/
│     └─ circuit.lf    # Circuit implementation (composite circuits)
├─ docs/
│  └─ <name>.md        # Per-export documentation
└─ tests/
   └─ <name>.test.lf   # Package test suite
```

### Key Principles

- **Source-first**: Implementations live in `.lf` files. The manifest contains only catalog metadata and source pointers — **never** macro bodies or circuit bodies.
- **Self-contained**: Each package owns its docs, examples, and tests.
- **Validated builds**: `scripts/build.mjs` validates manifests against schemas, checks that exports match source declarations, and verifies docs/tests exist.

---

## Registry

- `registry.json` — Index of packages (name, version, manifest path)
- `dist/packages.json` — Bundled snapshot for offline loading (generated from manifests + sources + docs + tests)

```bash
# Build the bundled snapshot
node scripts/build.mjs
# → Wrote dist/packages.json (3 packages)
```

The web studio loads `dist/packages.json`. The CLI resolves packages from the registry at install time.

---

## Quick Start: Create a Package

### Prerequisites

```bash
# Clone main repo with package submodule
git clone --recurse-submodules https://github.com/samTime101/ShortCircuit.git
cd ShortCircuit
npm ci

# Verify bundle builds
cd vendor/ShortCircuit-Packages
node scripts/build.mjs
```

### Option A: Scaffold with CLI (Recommended)

```bash
# From main repo root
npm run package:init

# Or from package repo
cd vendor/ShortCircuit-Packages
npm run package:init
```

Interactive prompts (or pass flags for non-interactive):

```bash
npm run package:init -- \
  --name @acme/parity \
  --export PARITY3 \
  --kind macro \
  --description "Three-input parity built from NAND." \
  --dependencies @shortcircuit/gates \
  --auto-import \
  --yes
```

| Flag | Description |
|------|-------------|
| `--name <@scope/name>` | Scoped package name (required) |
| `--export <NAME>` | Public export name (default: upper-case dir name) |
| `--kind <macro\|circuit>` | Export kind (default: `macro`) |
| `--description <text>` | Catalog description |
| `--version <semver>` | Package version (default: `0.1.0`) |
| `--license <id>` | License identifier (default: `MIT`) |
| `--dependencies <list>` | Comma-separated package names |
| `--auto-import` | Set `recommendedAutoImport: true` |
| `--no-registry` | Don't edit `registry.json` |
| `--force` | Replace existing package dir/entry |
| `--yes` | Accept defaults, never prompt |

### Option B: Manual Creation

The CLI generates exactly these files — useful for understanding or hand-editing:

#### 1. Directory Layout

```bash
mkdir -p packages/parity/macros/parity3
mkdir -p packages/parity/docs
mkdir -p packages/parity/tests
```

```
packages/parity/
├─ package.json
├─ manifest.json
├─ macros/
│  └─ parity3/
│     └─ macro.lf
├─ docs/
│  └─ parity3.md
└─ tests/
   └─ parity.test.lf
```

#### 2. `package.json`

```json
{
  "name": "@acme/parity",
  "version": "0.1.0",
  "description": "Three-input parity built from the Short Circuit gates package.",
  "license": "MIT",
  "dependencies": {
    "@shortcircuit/gates": "^0.1.0"
  }
}
```

#### 3. Macro Source: `macros/parity3/macro.lf`

```logicflow
MACRO PARITY3(a, b, c)
  BODY XOR(a, b, c)
END
```

`XOR` comes from `@shortcircuit/gates` (declared in dependencies).

#### 4. Manifest: `manifest.json`

```json
{
  "schema": "shortcircuit.package/v1",
  "name": "@acme/parity",
  "version": "0.1.0",
  "engine": "^0.1.0",
  "recommendedAutoImport": true,
  "description": "Three-input parity built from NAND-derived gates.",
  "dependencies": {
    "@shortcircuit/gates": "^0.1.0"
  },
  "tests": "tests/parity.test.lf",
  "exports": [
    {
      "kind": "macro",
      "name": "PARITY3",
      "source": "macros/parity3/macro.lf",
      "group": "Parity",
      "summary": "One when an odd number of inputs are high.",
      "docs": "docs/parity3.md",
      "examples": ["y = PARITY3(a, b, c)"],
      "widthRule": "Result width = common input width"
    }
  ]
}
```

**Manifest Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `schema` | Yes | Always `"shortcircuit.package/v1"` |
| `name`, `version` | Yes | Must match `package.json` |
| `engine` | Yes | Compatible engine version range |
| `recommendedAutoImport` | No | `true` = available without explicit `IMPORT` in studio |
| `dependencies` | No | Package names whose exports this package uses |
| `tests` | No | Package-wide test file path |
| `exports[]` | Yes | Public macros/circuits (see below) |
| `internal[]` | No | Hidden exports (usable by package sources only) |

**Export Entry Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `kind` | Yes | `"macro"` or `"circuit"` |
| `name` | Yes | Public export name (must match source declaration) |
| `source` | Yes | Path to `.lf` file |
| `group` | No | Category for docs/completions |
| `summary` | No | One-line description |
| `docs` | No | Path to markdown doc |
| `examples[]` | No | Usage snippets for hover/completions |
| `widthRule` | No | Human-readable width behavior |
| `ports` | Circuit only | Catalog metadata for ports (compiler reads real ports from source) |

#### 5. Documentation: `docs/parity3.md`

```markdown
# PARITY3

`PARITY3(a, b, c)` returns one when an odd number of its three inputs are high.

- `a`, `b`, `c`: one-bit or bus inputs of the same width.
- Result: the common input width.

```logicflow
y = PARITY3(a, b, c)
```
```

#### 6. Tests: `tests/parity.test.lf`

```logicflow
CIRCUIT PARITY3_TEST
  INPUT a
  INPUT b
  INPUT c

  y = PARITY3(a, b, c)

  OUTPUT y
END

TEST PARITY3_TEST
  CASE "no inputs high"
    INPUT a = 0
    INPUT b = 0
    INPUT c = 0
    EXPECT y = 0
  END

  CASE "one input high"
    INPUT a = 1
    INPUT b = 0
    INPUT c = 0
    EXPECT y = 1
  END

  CASE "two inputs high"
    INPUT a = 1
    INPUT b = 1
    INPUT c = 0
    EXPECT y = 0
  END

  CASE "three inputs high"
    INPUT a = 1
    INPUT b = 1
    INPUT c = 1
    EXPECT y = 1
  END
END
```

The test wrapper circuit is test-only — must not redefine a public export.

#### 7. Register in `registry.json`

```json
{
  "schema": "shortcircuit.registry/v1",
  "packages": [
    { "name": "@shortcircuit/gates", "version": "0.1.0", "manifest": "packages/gates/manifest.json" },
    { "name": "@shortcircuit/arithmetic", "version": "0.1.0", "manifest": "packages/arithmetic/manifest.json" },
    { "name": "@shortcircuit/selection", "version": "0.1.0", "manifest": "packages/selection/manifest.json" },
    { "name": "@acme/parity", "version": "0.1.0", "manifest": "packages/parity/manifest.json" }
  ]
}
```

The registry is static — packages are not discovered by scanning directories.

---

## Build & Test

```bash
# From vendor/ShortCircuit-Packages
npm run package:build   # Validate + rebuild dist/packages.json
npm run package:test    # Build + run all package tests
npm run package:check   # Build + test in one command
npm run package:list    # Show registered packages and export counts
```

`package:test` runs `npm run test:packages` in the main repo. If the package repo is outside the main checkout:

```bash
SHORTCIRCUIT_ROOT=/path/to/ShortCircuit npm run package:test
```

Or run directly from main repo:

```bash
cd ../..
npx vitest run packages/engine/test/packages.test.ts
```

---

## Using a Package in a Circuit

If `recommendedAutoImport: true` (set via `--auto-import`):

```logicflow
CIRCUIT Odd
  INPUT a
  INPUT b
  INPUT c

  y = PARITY3(a, b, c)

  OUTPUT y
END
```

Explicit import (always valid):

```logicflow
IMPORT "@acme/parity" AS parity

CIRCUIT Odd
  INPUT a
  INPUT b
  INPUT c

  y = parity.PARITY3(a, b, c)

  OUTPUT y
END
```

If `recommendedAutoImport: false`, explicit import is required.

---

## Committing & Publishing

### 1. Commit Package Repo

```bash
git -C vendor/ShortCircuit-Packages add -A
git -C vendor/ShortCircuit-Packages commit -m "feat: add parity package"
git -C vendor/ShortCircuit-Packages push origin main
```

### 2. Update Submodule Pointer in Main Repo

```bash
git add vendor/ShortCircuit-Packages
git commit -m "chore: update package submodule"
git push origin main
```

**Important**: The main repo must point at the package commit containing the built `dist/packages.json`; otherwise CI and deployments fail.

---

## Using Custom Packages Outside the Registry

Hosts can load a different bundle via the compiler API:

```ts
import { compile, type PackageBundle } from "@shortcircuit/engine";

const bundle: PackageBundle = {
  schema: "shortcircuit.packages/v1",
  packages: [
    // Manifests with embedded sourceText/docsText/testText (like dist/packages.json)
  ],
};

const result = compile(source, {
  packages: bundle,
  disableDefaultPackages: false,  // true = only supplied bundle
});
```

`packages` accepts a full `PackageBundle` or an array of manifests.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '../../../vendor/ShortCircuit-Packages/dist/packages.json'` | Submodule missing | `git submodule update --init --recursive` |
| `package validation failed: ... is not declared in ...` | Export name in manifest ≠ source declaration | Ensure names match exactly |
| `package validation failed: ... does not match package.json ...` | `name`/`version` mismatch between `package.json` and `manifest.json` | Sync both files |
| `E601` / duplicate export | Two packages export same name | Rename or disable one package |
| `E602 Cannot import ...` | Package not installed/disabled | Enable in studio Packages manager or add correct `IMPORT` |
| `E200 ... is reserved` | User signal/circuit name conflicts with enabled package export | Rename user item or disable package |
| Test wrapper fails to compile | Wrapper uses wrong export name or missing dependency | Check wrapper and `manifest.json` dependencies |

---

## Minimal Checklist

```
[ ] Run npm run package:init (or create packages/<name>/ by hand)
[ ] Put implementations in .lf files
[ ] Point every export at its source file
[ ] Add docs (docs/<export>.md) and tests (tests/<export>.test.lf)
[ ] Add manifest to registry.json (package:init does this by default)
[ ] Run npm run package:build
[ ] Run npm run package:test
[ ] Commit and push package repository
[ ] Commit updated submodule pointer in main repository
```

---

## License

MIT — see the main [Short Circuit repository](https://github.com/samTime101/ShortCircuit).

---

## Links

- **Main Repository**: [github.com/samTime101/ShortCircuit](https://github.com/samTime101/ShortCircuit)
- **Package Format Spec**: [SPEC.md](SPEC.md)
- **JSON Schemas**: [`schemas/`](schemas/)
- **Package Authoring Guide**: [../docs/PACKAGES.md](../docs/PACKAGES.md)