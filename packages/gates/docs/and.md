# AND

Bitwise AND. Variadic: all inputs are combined by one gate.

```logicflow
y = AND(a, b)
y3 = AND(a, b, c)
```

Package expansion:

```text
AND(a, b, ...) = NOT(NAND(a, b, ...))
```
