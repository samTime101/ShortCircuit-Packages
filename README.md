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
| `@shortcircuit/arithmetic` | `HALF_ADDER`, `FULL_ADDER` |

The `gates` package uses value macros: each gate is a small NAND expression.
The `arithmetic` package uses ordinary `.lf` circuits.

## Registry

`registry.json` points at each package manifest. `dist/packages.json` is the
bundled snapshot the app can load offline. It is generated from the manifests
and circuit sources.

## Package layout

```text
packages/
  gates/
    manifest.json
    docs/
    tests/
  arithmetic/
    manifest.json
    circuits/
      half-adder/circuit.lf
      full-adder/circuit.lf
```

Every package owns its docs, examples and tests. The app reads the manifest for
editor completion and hover metadata; it compiles the `.lf` sources only when
the package is used.

## License

MIT. See the main Short Circuit repository.
