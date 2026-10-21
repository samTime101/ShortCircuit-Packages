# OR

Bitwise OR. Variadic: the result is 1 when any input bit is 1.

```logicflow
y = OR(a, b)
y3 = OR(a, b, c)
```

The package folds the internal binary helper `OR2` across the inputs.
