# COMPARE2

`COMPARE2` compares two two-bit values.

- `a`, `b`: two-bit operands.
- `eq`: one when `a` and `b` are the same.
- `lt`: one when `a` is less than `b`.
- `gt`: one when `a` is greater than `b`.

Exactly one of `eq`, `lt` and `gt` is high.

```logicflow
compared = COMPARE2(a, b)
OUTPUT compared.eq
```

The high bit decides on its own unless the two high bits are equal, and only
then does the low bit get a say.
