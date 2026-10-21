# Short Circuit Packages

The package registry for **Short Circuit** and the **LogicFlow** language.

Short Circuit keeps only a tiny kernel:

- `NAND`
- constants, wires, ports and buses
- structural wiring (`CONCAT`, `SLICE`, `BROADCAST`, ...)
- `CIRCUIT` composition
- `STATE` and clock edges

Everything that can be built from those fundamentals belongs here.

## Packages

| Package | Provides |
|---|---|
| `@shortcircuit/gates` | `NOT`, `AND`, `OR`, `BUFFER`, `NOR`, `XOR`, `XNOR` |
| `@shortcircuit/arithmetic` | `HALF_ADDER`, `FULL_ADDER`, `ADD4`, `ADD8` |
| `@shortcircuit/selection` | `MUX` |

The `gates` package uses value macros. Each macro is a real `.lf` source file:

```logicflow
MACRO AND(a, b, ...)
  BODY NOT(NAND(a, b, ...))
END
```

The `arithmetic` package uses ordinary `.lf` circuits.

## Format

See [SPEC.md](SPEC.md) for the package format and [`schemas/`](schemas/) for the
JSON Schemas. `scripts/build.mjs` validates the manifest before it writes the
bundled snapshot.

The short version:

- `package.json` is Node metadata.
- `manifest.json` is catalog metadata and source pointers.
- `macros/<name>/macro.lf` contains macro implementations.
- `circuits/<name>/circuit.lf` contains composite circuits.
- `docs/` and `tests/` are package-owned.
- Macro bodies are never stored in the manifest.

## Registry

`registry.json` points at each package manifest. `dist/packages.json` is the
bundled snapshot the app can load offline. It is generated from the manifests,
macro sources, circuit sources, docs, and tests.

```bash
node scripts/build.mjs
```

## Package layout

```text
packages/
  gates/
    package.json
    manifest.json
    macros/
      and/macro.lf
      not/macro.lf
      or/macro.lf
      ...
    docs/
    tests/
  arithmetic/
    package.json
    manifest.json
    circuits/
      half-adder/circuit.lf
      full-adder/circuit.lf
      add4/circuit.lf
      add8/circuit.lf
  selection/
    package.json
    manifest.json
    macros/
      mux/macro.lf
    tests/
```

Every package owns its docs, examples and tests. The app reads the manifest for
editor completion and hover metadata; it parses the `.lf` sources for
implementation.

## License

MIT. See the main Short Circuit repository.
