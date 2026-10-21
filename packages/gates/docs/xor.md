# XOR

Bitwise exclusive OR. Variadic: the result is 1 where an odd number of input
bits are 1.

```logicflow
y = XOR(a, b)
parity = XOR(a, b, c)
```

The package folds the internal binary helper `XOR2` across the inputs. Each
binary step is built from NAND.
