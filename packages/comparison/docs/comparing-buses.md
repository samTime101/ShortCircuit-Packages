# Comparing buses

The comparison family answers one question: which of these two numbers is
bigger? Every member takes two buses of the same width and sets exactly one
of three flags.

- `eq`: the two values are the same.
- `lt`: the first value is smaller.
- `gt`: the first value is larger.

Exactly one flag is always high, so the three of them can never disagree.

## The family

| Export | Width | Built from |
| --- | --- | --- |
| `COMPARE1` | 1 bit | gates |
| `COMPARE2` | 2 bits | two `COMPARE1` |
| `COMPARE4` | 4 bits | two `COMPARE2` |
| `COMPARE8` | 8 bits | two `COMPARE4` |

Each width splits its bus in half and compares each half. The high half
decides the answer unless the two high halves are equal, and only then does
the low half get a say.

## Using one

```logicflow
CIRCUIT SortedPair
  INPUT a : BUS(4)
  INPUT b : BUS(4)

  compared = COMPARE4(a, b)

  hi = MUX(b, a, compared.gt)
  lo = MUX(a, b, compared.gt)

  OUTPUT hi
  OUTPUT lo
END
```

`compared.gt` is one when `a` is the larger of the two, so `MUX` picks `a`
for `hi` in that case and `b` otherwise.

## Going wider

A sixteen-bit comparison is the same shape again, using two `COMPARE8`:

```logicflow
CIRCUIT COMPARE16
  INPUT a : BUS(16)
  INPUT b : BUS(16)

  low = COMPARE8(a[7:0], b[7:0])
  high = COMPARE8(a[15:8], b[15:8])

  eq = AND(high.eq, low.eq)
  lt = OR(high.lt, AND(high.eq, low.lt))
  gt = OR(high.gt, AND(high.eq, low.gt))

  OUTPUT eq
  OUTPUT lt
  OUTPUT gt
END
```

## Signed values

These comparators read the bus as an unsigned number, so `1000` is fifteen,
not minus eight. To compare signed values, flip the top bit of both operands
first and compare the results as unsigned:

```logicflow
flipped_a = XOR(a, 0b1000)
flipped_b = XOR(b, 0b1000)
compared = COMPARE4(flipped_a, flipped_b)
```

Note the `0b` prefix. A bare `1000` is the decimal number one thousand, not
the binary mask.
