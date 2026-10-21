# XNOR

Bitwise exclusive NOR. With two inputs this is an equality check.

```logicflow
same = XNOR(a, b)
```

Package expansion:

```text
XNOR(a, b, ...) = NOT(XOR(a, b, ...))
```
