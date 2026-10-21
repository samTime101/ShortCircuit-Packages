# MUX

`MUX(zero, one, select)` selects between two values.

- `select = 0` returns `zero`.
- `select = 1` returns `one`.
- `zero` and `one` must have the same width.
- `select` is one bit. `BROADCAST` repeats it to the width of the selected values.

The macro expands to NAND-derived gates:

```logicflow
OR(AND(zero, NOT(BROADCAST(select, zero))), AND(one, BROADCAST(select, zero)))
```
