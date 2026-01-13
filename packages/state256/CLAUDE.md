# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a theoretical research codebase for **AtomStateTree / State256 VM** - a novel virtual machine architecture based on geometric principles, dimensional nesting, and sphere-theoretic concepts. The architecture maps computational state to geometric structures (spheres and midspheres) and is designed for tri-architecture implementation (ESP32, ARM64, x86-64).

## Core Architecture Principles

### 1. Dimensional Hierarchy (8 Levels)

The system is organized as a hierarchy of nested relations, where each level represents a different scale:

```
Level 0: 256 Atoms      → Raw symbols/events
Level 1: 128 Relation2  → Pairings (a . b)
Level 2: 64  Logic4     → Constraints (4 atoms)
Level 3: 32  Closure8   → Closures (8 atoms)
Level 4: 16  Record16   → Identity (16 atoms)
Level 5: 8   Block32    → Block basis (32 atoms)
Level 6: 4   Context64  → Quadrants (Local/Remote/Proposed/Canonical)
Level 7: 2   Frame128   → Federation frames
Level 8: 1   State256   → Canonical shared state
```

### 2. Squarable vs Non-Squarable Dimensions

**Critical architectural distinction:**

- **Squarable dimensions** (4, 16, 64, 256): Map to **spheres** (S³, S¹⁵, S⁶³, S²⁵⁵), stored in **registers** for parallel processing
- **Non-squarable dimensions** (2, 8, 32, 128): Map to **midspheres** (tangency conditions), stored on **stack** for sequential ordering

This division optimizes for hardware execution:
- Register-based: Parallel SIMD operations
- Stack-based: Maintains causal ordering and proof chains

### 3. Canonical Path Grammar

Every atom lives at a fully-qualified path:
```
State.<Frame>.<Context>.<Block>.<Record>.<Closure>.<Logic>.<Relation>.<Atom>
```

Example:
```
State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L
```

Domain values:
- Frame: {FrameA, FrameB}
- Context: {Local, Remote, Proposed, Canonical}
- Block/Record/Closure/Logic/Relation: {1, 2}
- Atom: {L, R} (left/right leaf position)

### 4. Geometric Foundations

**Midsphere Theorem:** Every canonical polyhedron has a midsphere where all edges are tangent. This guarantees:
- Equal-length Hamiltonian cycles (for routing)
- Canonical forms via Möbius transformations
- Position-based routing without lookup tables

**Möbius Transforms:** Used to normalize any state to canonical form:
- Floating-point registers represent geometric positions, not numeric values
- FPU performs transformations to center spheres at origin
- Maintains tangency invariants under rotation

## Tri-Architecture Register Mapping

### ESP32 (Xtensa LX6 + ULP)
- **Logic4**: ULP coprocessor (4×16-bit registers, 8MHz, ultra-low power)
- **Record16**: AR0-AR15 (16×32-bit general purpose)
- **Context64**: F0-F15 (16×float for Möbius transforms)
- **State256**: Peripheral registers (memory-mapped I/O)

### ARM64 (AArch64)
- **Logic4**: V0 (single SIMD register, 4×32-bit)
- **Record16**: V0-V3 (4×SIMD registers)
- **Context64**: V0-V15 (16×SIMD registers)
- **State256**: V0-V31 (all 32 SIMD registers)

### x86-64
- **Logic4**: XMM0 (4×float)
- **Record16**: YMM0 + XMM1 + XMM2 (8+4+4 floats)
- **Context64**: ZMM0-ZMM3 (4×512-bit AVX-512)
- **State256**: ZMM0-ZMM15 (16×512-bit registers)

## Key Implementation Files (Theoretical)

The documentation describes these implementation components:

1. **atom_state_tree.awk**: Full State Manager with path validation, replay engine, and symbolic addressing
2. **atomtree.awk**: Minimal pairing engine that builds nested relations
3. **atomc.py**: Tri-architecture compiler (ESP32/ARM64/x64)
4. **atomvm_esp32.c**: ESP32 runtime with ULP coprocessor support
5. **atomvm_arm64.S**: ARM64 SIMD-optimized assembly
6. **atomvm_x64.asm**: x86-64 AVX-512 implementation

## Working with State256

### Zero State Initialization
Every atom starts as `Ø` (nil/empty). Generate zero state:
```bash
echo ZERO | ./atom_state_tree.awk
```

### Setting Atoms
```bash
echo "SET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L value" | ./atom_state_tree.awk
```

### Canonical Path Structure
Paths follow strict grammar with 9 components. Path validation ensures:
- Component order: State → Frame → Context → Block → Record → Closure → Logic → Relation → Atom
- Valid domain values at each level
- Deterministic ordering for replay

## Execution Model

1. **Forward Pass (Content)**: Data flows through squarable dimensions in registers
2. **Midsphere Calculation**: Stack transformations compute tangency conditions
3. **Möbius Canonicalization**: FPU transforms to canonical polyhedron
4. **Backward Pass (Identity)**: Stack verification generates Merkle proofs
5. **Hamiltonian Routing**: Equal-length cycles enable position-based routing

## Hash Propagation Models

### Merkle-Style (Diagonal)
- Single leaf update propagates up one spine
- Path-based: Relation2 → Logic4 → ... → State256
- Provides replay, proofs, causality

### Pfister-Style (Table/Face)
- Region-to-region composition
- Block-wise updates spread across face
- Enables federation: "my view × your view → shared view"

Both coexist: Merkle handles vertical (path), Pfister handles planar (blocks).

## Geometric Primitives (Without Numbers)

The system uses geometric relations rather than arithmetic:
- **Point**: (orientation, dimension, position)
- **Sphere**: (center, radius, dimension)
- **Midsphere**: (tangency_conditions, parent_sphere)
- **Möbius**: (transformation_matrix)
- **Polyhedron**: (vertices, edges, faces, midsphere)

Represented as bit patterns:
- Sign bit: orientation (forward/backward)
- Exponent: dimension level (1-8)
- Mantissa: geometric position in canonical form

## Development Notes

- This is primarily a **theoretical/architectural research project**
- No traditional build system (make/cmake) - implementations are described in documentation
- Focus is on mathematical foundations and hardware mapping, not practical deployment
- AWK scripts demonstrate core pairing and state management algorithms
- Compiler/VM implementations are architectural specifications rather than complete code

## Context Quadrants (Semantic Meaning)

The Context64 level has four semantic quadrants:
- **Local** (64 atoms): Local state/view
- **Remote** (64 atoms): Remote peer state
- **Proposed** (64 atoms): Proposed changes
- **Canonical** (64 atoms): Canonical/committed state

Frame distribution:
- **FrameA**: Contains Local and Remote contexts (federation)
- **FrameB**: Contains Proposed and Canonical contexts (consensus)
