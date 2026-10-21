# Short Circuit Package Format v1

This document is the normative format for packages in the Short Circuit
registry. It is intentionally source-first: implementations live in `.lf` and
Markdown files, not in JSON strings.

## 1. Package directory

```text
packages/<name>/
  package.json
  manifest.json
  macros/
    <macro-name>/macro.lf
  circuits/
    <circuit-name>/
      circuit.lf
      docs.md
      test.lf
  docs/
    <topic>.md
  tests/
    <package>.test.lf
```

`package.json` is ordinary Node package metadata. It declares the package name,
version, license, and dependencies. It is not used by the compiler at runtime.

`manifest.json` is the catalog manifest. It lists the package's public exports
and points at source, docs, and tests. It MUST NOT contain macro bodies, circuit
bodies, or any other implementation copied out of a source file.

## 2. Registry

JSON Schema: [`schemas/registry.schema.json`](schemas/registry.schema.json).

`registry.json` lists the packages known to the package manager.

```json
{
  "schema": "shortcircuit.registry/v1",
  "packages": [
    {
      "name": "@shortcircuit/gates",
      "version": "0.1.0",
      "manifest": "packages/gates/manifest.json"
    }
  ]
}
```

The registry is static. The app MUST NOT discover packages by scraping GitHub
folders or by calling the GitHub directory API.

## 3. Package manifest

JSON Schema: [`schemas/package-manifest.schema.json`](schemas/package-manifest.schema.json).
The schema forbids `body`, `fold`, `args`, `minArgs`, `maxArgs`, and
`variadic`; those are parsed from the macro source.

```json
{
  "schema": "shortcircuit.package/v1",
  "name": "@shortcircuit/gates",
  "version": "0.1.0",
  "engine": "^0.1.0",
  "recommendedAutoImport": true,
  "description": "Basic logic gates built from NAND.",
  "exports": [
    {
      "kind": "macro",
      "name": "AND",
      "source": "macros/and/macro.lf",
      "group": "Basic Logic Gates",
      "summary": "Bitwise AND.",
      "docs": "docs/and.md",
      "examples": ["y = AND(a, b)"]
    },
    {
      "kind": "circuit",
      "name": "HALF_ADDER",
      "source": "circuits/half-adder/circuit.lf",
      "group": "Arithmetic Circuits",
      "summary": "One-bit half adder.",
      "docs": "circuits/half-adder/docs.md",
      "tests": "circuits/half-adder/test.lf",
      "ports": {
        "inputs": [
          { "name": "a", "width": 1 },
          { "name": "b", "width": 1 }
        ],
        "outputs": [
          { "name": "sum", "width": 1 },
          { "name": "carry", "width": 1 }
        ]
      }
    }
  ]
}
```

Rules:

- `schema` MUST be `shortcircuit.package/v1`.
- `name` MUST match the package name in `package.json`.
- `version` MUST be SemVer.
- `exports` MUST be non-empty.
- Every export MUST have a unique `kind` + `name` pair.
- Every export MUST point at an existing `source`.
- A macro source MUST declare a `MACRO` with the export's `name`.
- A circuit source MUST contain a `CIRCUIT` with the export's `name`.
- `tests` at the package level points at package-wide tests that exercise
  multiple exports.
- `docs`, `tests`, `group`, `summary`, and `examples` are optional catalog
  metadata.
- `internal: true` hides an export from docs and completions while keeping it
  available to other package sources.
- `ports` is optional catalog metadata. The compiler still reads the real
  `INPUT`/`OUTPUT` declarations from the circuit source.

The app builds completions, hover cards, and the docs index from the manifest
plus the parsed macro declarations. Source fetching is only needed when a
package is enabled or compiled.

## 4. Macro source files

Macro sources are real LogicFlow files with one or more `MACRO` declarations.

```logicflow
// packages/gates/macros/and/macro.lf
MACRO AND(a, b, ...)
  BODY NOT(NAND(a, b, ...))
END
```

```logicflow
// packages/gates/macros/xor/macro.lf
MACRO XOR(a, b, ...)
  FOLD XOR2
END
```

Grammar:

```ebnf
macro-file  = { macro-decl } ;
macro-decl  = "MACRO" identifier "("
                [ param { "," param } [ "," "..." ] ]
              ")"
              ( "BODY" expression | "FOLD" identifier )
              "END" ;
param       = identifier ;
```

Semantics:

- `BODY` is one expression using the normal LogicFlow expression grammar.
- `FOLD` names a binary macro. A variadic call is reduced left-to-right.
  `XOR(a, b, c)` becomes `XOR2(XOR2(a, b), c)`.
- `...` MUST be the final parameter. The named parameters are the minimum
  arity; the remaining arguments are the fold/rest arguments.
- Macro arguments are evaluated once as typed references. Referencing a
  parameter twice expands the reference, not the caller's source expression.
- Macro bodies cannot contain `STATE`, assignments, tests, circuits, or
  imports. Use a helper macro for a named intermediate value.
- Macro bodies have no `let` binding in v1. Duplicate a subexpression or name a
  helper macro instead.
- A macro file may contain multiple declarations. The declaration named by the
  manifest is the public export; other declarations are internal helpers unless
  the manifest lists them too.
- Comments are ordinary LogicFlow comments.
- The source file is the only place the body exists. The bundled snapshot
  embeds it as `sourceText`; the manifest never does.

## 5. Circuit source files

Circuit sources are ordinary `.lf` circuits.

```logicflow
CIRCUIT HALF_ADDER
  INPUT a
  INPUT b

  sum = XOR(a, b)
  carry = AND(a, b)

  OUTPUT sum
  OUTPUT carry
END
```

A circuit package file may use fundamentals, package macros, and other package
circuits. It cannot add simulator opcodes.

## 6. Docs and tests

- `docs` points at Markdown owned by the package.
- `tests` points at a `.lf` file containing `TEST`/`CASE`/`EXPECT` blocks.
- A package-level `tests` file complements per-circuit tests and is embedded as
  `testText` in the bundle.
- Package docs are rendered by the app's docs shell.
- Package tests run against the same compiler and simulator as user tests.
- A test file may define test-only wrapper circuits, but it must not redefine a
  public export.

## 7. Bundled snapshot

JSON Schema: [`schemas/bundle.schema.json`](schemas/bundle.schema.json).
`scripts/build.mjs` validates that manifests and package metadata agree, forbids
implementation keys in macro manifest entries, verifies that each source
declares the exported name, and then writes the snapshot.

`dist/packages.json` is generated from the registry, manifests, and source
files:

```json
{
  "schema": "shortcircuit.packages/v1",
  "generatedAt": "2026-10-21T00:00:00.000Z",
  "packages": [
    {
      "schema": "shortcircuit.package/v1",
      "name": "@shortcircuit/gates",
      "version": "0.1.0",
      "exports": [
        {
          "kind": "macro",
          "name": "AND",
          "source": "macros/and/macro.lf",
          "sourceText": "MACRO AND(a, b, ...)\n  BODY NOT(NAND(a, b, ...))\nEND\n",
          "group": "Basic Logic Gates",
          "summary": "Bitwise AND.",
          "docs": "docs/and.md",
          "docsText": "# AND\n...",
          "examples": ["y = AND(a, b)"]
        }
      ]
    }
  ]
}
```

The snapshot is for offline first-run use and for hosts that cannot fetch files
at runtime. It is generated, never edited by hand.

## 8. Versioning

- `shortcircuit.registry/v1` covers registry layout.
- `shortcircuit.package/v1` covers manifest layout.
- `shortcircuit.packages/v1` covers the bundled snapshot.
- Macro source syntax is part of `shortcircuit.package/v1`.
- Breaking source syntax or manifest changes require a new schema version.
