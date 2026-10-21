# NOR

Bitwise NOR: high only when every input bit is low.

```logicflow
y = NOR(a, b)
```

Package expansion:

```text
NOR(a, b, ...) = NOT(OR(a, b, ...))
```
