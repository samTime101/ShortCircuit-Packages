# COMPARE1

`COMPARE1` compares two one-bit values.

- `a`, `b`: one-bit operands.
- `eq`: one when `a` and `b` are the same.
- `lt`: one when `a` is less than `b`.
- `gt`: one when `a` is greater than `b`.

Exactly one of `eq`, `lt` and `gt` is high.

```logicflow
compared = COMPARE1(a, b)
OUTPUT compared.eq
```

This is the leaf of the comparison family. `COMPARE2`, `COMPARE4` and
`COMPARE8` split a bus in half and compare each half, so a wider comparison
is a few lines rather than a new circuit from scratch.
