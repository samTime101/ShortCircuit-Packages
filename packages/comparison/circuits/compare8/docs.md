# COMPARE8

`COMPARE8` compares two eight-bit values.

- `a`, `b`: eight-bit operands.
- `eq`: one when `a` and `b` are the same.
- `lt`: one when `a` is less than `b`.
- `gt`: one when `a` is greater than `b`.

Exactly one of `eq`, `lt` and `gt` is high.

```logicflow
compared = COMPARE8(a, b)
OUTPUT compared.eq
```

The bus is split into two halves, and each half is compared on its own. The
high half decides unless the two high halves are equal.
