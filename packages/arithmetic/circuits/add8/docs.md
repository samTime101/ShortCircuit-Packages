# ADD8

`ADD8` adds two eight-bit values and a one-bit carry.

- `a`, `b`: eight-bit operands.
- `carry_in`: the carry entering bit 0.
- `sum`: the eight-bit result.
- `carry_out`: the carry leaving bit 7.

`ADD8` is two `ADD4` circuits chained by their carry.

```logicflow
result = ADD8(a, b, 0)
OUTPUT result.sum
OUTPUT result.carry_out
```
