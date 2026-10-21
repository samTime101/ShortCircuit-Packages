# ADD4

`ADD4` adds two four-bit values and a one-bit carry.

- `a`, `b`: four-bit operands.
- `carry_in`: the carry entering bit 0.
- `sum`: the four-bit result.
- `carry_out`: the carry leaving bit 3.

The result is the low four bits. Use `carry_out` to chain adders.

```logicflow
result = ADD4(a, b, 0)
OUTPUT result.sum
OUTPUT result.carry_out
```
