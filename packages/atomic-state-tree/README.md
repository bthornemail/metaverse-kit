# AtomStateTree: State256 Virtual Machine

A reference implementation of the State256 virtual machine architecture based on geometric principles, dimensional nesting, and sphere-theoretic concepts.

## Overview

AtomStateTree is a theoretical VM that organizes computational state as a hierarchy of nested geometric relations, mapping to hardware registers and stack in an optimal way:

- **Squarable dimensions** (4, 16, 64, 256) → Registers (parallel processing, spheres S³, S¹⁵, S⁶³, S²⁵⁵)
- **Non-squarable dimensions** (2, 8, 32, 128) → Stack (sequential ordering, midspheres)

## Architecture

### Dimensional Hierarchy

```
Level 0: 256 Atoms      → Raw symbols/events
Level 1: 128 Relation2  → Pairings (a . b)
Level 2: 64  Logic4     → Constraints (4 atoms, S³ sphere)
Level 3: 32  Closure8   → Closures (8 atoms, midsphere)
Level 4: 16  Record16   → Identity (16 atoms, S¹⁵ sphere)
Level 5: 8   Block32    → Block basis (32 atoms, midsphere)
Level 6: 4   Context64  → Quadrants (64 atoms, S⁶³ sphere)
Level 7: 2   Frame128   → Federation frames (128 atoms, midsphere)
Level 8: 1   State256   → Canonical state (256 atoms, S²⁵⁵ sphere)
```

### Canonical Path Format

Every atom has a fully-qualified path:
```
State.<Frame>.<Context>.<Block>.<Record>.<Closure>.<Logic>.<Relation>.<Atom>
```

Example:
```
State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L
```

Domain values:
- **Frame**: FrameA, FrameB
- **Context**: Local, Remote, Proposed, Canonical
- **Block**: Block1, Block2
- **Record**: Record1, Record2
- **Closure**: Closure1, Closure2
- **Logic**: Logic1, Logic2
- **Relation**: Relation1, Relation2
- **Atom**: L (left), R (right)

## Components

### 1. atom_state_tree.awk

Full State Manager with path validation and replay engine.

**Features:**
- Zero State256 generation (all atoms = Ø)
- Path validation against canonical grammar
- Deterministic replay
- Full symbolic addressing

**Usage:**

```bash
# Generate zero state
echo ZERO | ./atom_state_tree.awk

# Set atom values
cat <<'EOF' | ./atom_state_tree.awk
ZERO
SET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L CID:bafy...
SET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.R SIG:0xabc...
GET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L
DUMP
EOF

# From file
./atom_state_tree.awk < examples/simple.atoms
```

**Commands:**
- `ZERO` - Emit all 256 leaf assignments as "PUT <path> Ø"
- `SET <path> <value>` - Set a leaf to a value
- `GET <path>` - Print current value
- `DUMP` - Dump all leaves in canonical order

### 2. atomtree.awk

Minimal pairing engine that builds nested relations from flat atoms.

**Features:**
- Builds tree structure by recursive pairing
- Shows each dimensional level
- Demonstrates Relation2 → Logic4 → ... → State256 progression

**Usage:**

```bash
# Build tree from 8 atoms
echo "Atom1 Atom2 Atom3 Atom4 Atom5 Atom6 Atom7 Atom8" | ./atomtree.awk

# Build Logic4 (4 atoms)
echo "A B C D" | ./atomtree.awk

# Build State256 (256 atoms)
seq 1 256 | xargs echo | ./atomtree.awk
```

**Output:**
```
Level 0 (Atoms):
  Atom1
  Atom2
  ...

Level 1 (Relation2):
  (Atom1 . Atom2)
  (Atom3 . Atom4)
  ...

Level 2 (Logic4):
  ((Atom1 . Atom2) . (Atom3 . Atom4))
  ...

Final Root (State):
  (((Atom1 . Atom2) . (Atom3 . Atom4)) . ...)
```

### 3. atomvm.py

Python reference implementation demonstrating VM concepts.

**Features:**
- Register allocation for squarable dimensions
- Stack operations for non-squarable dimensions
- Path validation and leaf storage
- Tree building from flat atoms
- Interactive REPL

**Usage:**

```bash
# Run demo
./atomvm.py demo

# Generate zero state
./atomvm.py zero

# Interactive REPL
./atomvm.py
atomvm> zero
atomvm> set State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L test
atomvm> get State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L
atomvm> dump
atomvm> exit
```

**Python API:**

```python
from atomvm import AtomVM

vm = AtomVM()

# Initialize zero state
vm.zero_state()

# Set/get leaves
vm.set_leaf("State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L", "value")
value = vm.get_leaf("State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L")

# Load into registers
vm.load_to_logic4([1, 2, 3, 4])  # S³ sphere
vm.load_to_record16([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])  # S¹⁵

# Build tree from atoms
tree = vm.build_tree(["A", "B", "C", "D", "E", "F", "G", "H"])

# Stack operations (non-squarable dimensions)
vm.push_stack("value")
value = vm.pop_stack()
```

## Testing

Run the basic test suite:

```bash
./test_basic.sh
```

This will test:
1. Zero state generation
2. Set/Get operations
3. Invalid path handling
4. Tree building with different atom counts
5. Python VM functionality

## Examples

### Example 1: Simple State Management

```bash
./atom_state_tree.awk < examples/simple.atoms
```

### Example 2: Content-Addressable Storage

```bash
./atom_state_tree.awk < examples/merkle.atoms
```

### Example 3: Building Nested Structures

```bash
# Create Logic4 from 4 atoms
echo "sensor_1 sensor_2 sensor_3 sensor_4" | ./atomtree.awk

# Create Record16 from 16 atoms
seq 1 16 | xargs -I {} echo "atom_{}" | xargs echo | ./atomtree.awk
```

## Key Concepts

### Squarable vs Non-Squarable Dimensions

**Squarable** (4, 16, 64, 256):
- Map to n-spheres (S³, S¹⁵, S⁶³, S²⁵⁵)
- Stored in registers for parallel processing
- Represent geometric "position" not numeric "value"
- Enable SIMD operations on hardware

**Non-squarable** (2, 8, 32, 128):
- Map to midspheres (tangency conditions)
- Stored on stack for sequential ordering
- Maintain causal relationships
- Generate Merkle-style proofs

### Canonical Forms

The midsphere theorem guarantees that every State256 has a canonical form:
- All edges tangent to a single midsphere
- Möbius transformations normalize any state to canonical position
- Hamiltonian cycles have equal length (enables position-based routing)

### Context Quadrants

The Context64 level has semantic meaning:
- **Local** (64 atoms): Local state/view
- **Remote** (64 atoms): Remote peer state
- **Proposed** (64 atoms): Proposed changes
- **Canonical** (64 atoms): Canonical/committed state

Frames distribute contexts:
- **FrameA**: Local + Remote (federation)
- **FrameB**: Proposed + Canonical (consensus)

## Project Status

This is a **theoretical research implementation** demonstrating:
- Geometric principles in VM design
- Dimension-aware register allocation
- Hardware-optimal state representation
- Path-based addressing with validation

## Files

```
.
├── CLAUDE.md              # Guidance for AI assistants
├── README.md              # This file
├── atom_state_tree.awk    # Full state manager (AWK)
├── atomtree.awk           # Minimal pairing engine (AWK)
├── atomvm.py              # Python VM reference implementation
├── test_basic.sh          # Basic test suite
├── examples/
│   ├── simple.atoms       # Simple state management example
│   └── merkle.atoms       # Merkle-style hash example
└── Untitled *.md          # Architecture documentation

```

## License

This is a research/educational project. Use freely.

## References

See the architecture documentation in `CLAUDE.md` and `Untitled *.md` files for detailed theory:
- Dimensional hierarchy and nesting
- Midsphere theorem and canonical forms
- Möbius transformations
- Tri-architecture implementation (ESP32, ARM64, x86-64)
- Hamiltonian routing
- Merkle vs Pfister hash propagation
