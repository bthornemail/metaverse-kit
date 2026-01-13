# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **symbolic geometry framework** project that maps abstract mathematical and philosophical concepts into computational structures. The core focus is on representing **ideals, idols, and identity** through geometric primitives (balls, spheres, polyhedra) in a coordinate-free, purely relational system.

## Conceptual Architecture

### Core Abstractions

1. **Ideals** - Represented as vertices of polyhedra and covariant spheres that move with observer reference frames
2. **Idols** - Represented as edges connecting vertices and contravariant balls that respond inversely to observer transformations
3. **Identity** - Emerges at intersection volumes where ideals and idols overlap, encoding idempotent relationships
4. **Observers** - Exist as centroids of overlapping identity spheres, representing intersubjective viewpoints

### Geometric Mappings

The framework uses a hierarchical system of geometric objects:

- **0D-4D Simplices & k-Simplices**: Minimal discrete units of shared observation
- **Platonic Solids**: Tetrahedron, cube, octahedron, dodecahedron, icosahedron for 3D discrete shifts
- **Archimedean Solids**:
  - 6 Archimedeans for 3D discrete shifts
  - 7 Archimedeans for 4D projections and higher-dimensional mappings
  - 2 Dual Snub shapes for rotors, rosettes, and Hopf fiber cyclic rotations
- **4D Polytopes**: 5-cell, 16-cell, 24-cell, 120-cell, 600-cell for observer space representations

### Data Structure Philosophy

The system is **coordinate-free** and **fully symbolic**:

- **Balls (nodes)**: Defined in YAML files as declarative atomic structures
- **Spheres**: Emergent from JSON Canvas AST grouping of balls
- **Edges**: Symbolic relationships expressed as binary quadratic forms or typed lambda calculus equations
- **Centroids**: Mnemonics or symbolic content that serve as I/O points
- **Geometry**: Derived purely from relational constraints, not numeric coordinates

## File Structure Conventions

### YAML Files (Balls/Declaratives)
YAML files represent atomic nodes with properties like:
- `name`: Identifier for the ball
- `type`: Either "ideal" or "idol"
- `relation`: Connection type (self, neighbor, etc.)
- `boundary`: Geometric constraint (tetrahedron, etc.)
- `mnemonic`: Symbolic atom/centroid marker

**Ideals vs Idols in Data Structures**:
- Ideals files: Keys treated as **array-indexed sets** (maintaining original order)
- Idols files: Keys treated as **character-indexed sets** (lexicographically sorted)

### JSONL Files (Node References)
Lightweight references to YAML ball definitions:
```jsonl
{"node": "hydrogen.yaml"}
{"node": "oxygen.yaml"}
```

### JSON Canvas Files (Spheres & Edges)
Defines symbolic relationships between balls with fields:
- `fromNode`/`toNode`: References to YAML files
- `fromSide`/`toSide`: Position on ball (top=Ideal or Idol, right=Ideal, bottom=Ideal and Idol, left=Idol)
- `fromEnd`/`toEnd`: Endpoint type (none=idol, arrow=ideal)
- `equation`: Symbolic constraint or binary quadratic form

### Observers (Raycasting Queries)
Symbolic queries that project into the relational geometry:
- Define `visible_nodes` arrays
- Express `query` strings for symbolic raycasting across combinatorial faces

## Key Operations

### Discrete Shifts
- **Edge traversal**: Updates an idol
- **Vertex traversal**: Updates an ideal
- **Tetrahedral shift**: Updates combined ideals/idols in higher-dimensional space
- **k-Simplex hop**: Minimal shared observation unit transition

### Cyclic/Rotational Shifts
- Hopf fibers: Continuous rotations preserving idempotence
- Dual snub rotations: Geodesic shifts maintaining observer overlap
- Rotors/rosettes: Cyclic symmetry transformations

## Processing Pipeline

The system is designed for **POSIX/awk manipulation**:

1. **Tokenization**: YAML/JSONL/JSON structures map to `awk_valtype_t` streams:
   - `AWK_STRING`: Names, types, relations
   - `AWK_SCALAR`: Mnemonics and atomic values
   - `AWK_VALUE_COOKIE`: Node references
   - `AWK_ARRAY`: Collections (visible_nodes, edges, etc.)

2. **Symbolic Processing**: Use standard POSIX tools:
   - `awk`: Extract and filter tokens, build adjacency matrices
   - `grep`: Search for patterns in symbolic atoms
   - `jq`: Query JSON structures for nodes, edges, observers
   - `sort`: Order idols lexicographically

3. **Adjacency Analysis**: Compare ideals and idols files to find references and build relational graphs

## Working with This Codebase

### When Modifying Structures

1. **Maintain Coordinate-Free Design**: Never introduce numeric x/y/z coordinates directly. Positions are derived from:
   - Group order index of ideals/idols in JSONL nodes
   - Width/height from number of lines/fields in files (like TLV encoding)
   - Relational distances between observer layers

2. **Preserve Symbolic Relationships**: Equations in edges should remain as symbolic expressions (binary quadratic forms, lambda calculus types, named identities like "BrahmaguptaFibonacciIdentity")

3. **Respect Type Distinctions**:
   - Ideals = covariant (move with observer)
   - Idols = contravariant (move inversely to observer)
   - Identity = intersection/overlap

### Analysis Scripts

When creating comparison or processing scripts (like `ball_diff.sh` mentioned in documentation):
- Extract keys/values maintaining proper indexing (array for ideals, character for idols)
- Find references between files by checking if ideal keys appear in idol values
- Output format: `[idealKey, idolValues(idealKey), idealValue]`

### Extending the Framework

To add new geometric structures:
1. Define YAML balls for vertices
2. Create JSONL node references
3. Add JSON Canvas edges with symbolic equations
4. Define observer queries for the new structure
5. Document the geometric interpretation (which faces/edges represent what concepts)

## Philosophical Context

This framework treats:
- **Directories/Documents as Polynomials**: Balls and spheres encapsulate boundaries and constraints
- **YAML as Declaratives**: Like .gitignore syntax for composing balls
- **Spheres as AST**: For parsing contents of balls
- **Contents as Centroids**: Mnemonic anchors for symbolic raycasting
- **Observer Queries**: Project from a point to faces described by Platonic/Archimedean/simplex geometry

The goal is **emergent geometry from pure symbolic relationships**, enabling intersubjective identity and idempotent observations without numeric grounding.
