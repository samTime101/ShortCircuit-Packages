# OR

Bitwise OR. Variadic: all inputs are combined by one gate.

```logicflow
y = OR(a, b)
y3 = OR(a, b, c)
```

Package expansion:

```text
OR(a, b, ...) = NAND(NOT(a), NOT(b), ...)
```
