# Ideals & Idols: Pure Combinatorial Geometry Framework

A symbolic geometry system that represents abstract concepts (ideals, idols, identity) through pure combinatorial relationships using the `awk_valtype_t` type system. **No numeric coordinates** - all geometry emerges from symbolic set operations and graph topology.

## Quick Start

```bash
# Run the complete pipeline
./pipeline.sh

# Query the results
./query.sh mnemonics          # Show all balls
./query.sh edges              # Show all connections
./query.sh identities         # Show overlapping atoms
./query.sh ball hydrogen.yaml # Inspect a specific ball
```

## Core Concepts

### The awk_valtype_t Type System

Every symbolic element is tagged with one of these types:

```c
AWK_SCALAR     → Mnemonics (H, O, C, N) - atomic symbolic values
AWK_STRING     → Names, types, relations, equations
AWK_ARRAY      → Collections (neighbors, contains, shared atoms)
AWK_VALUE_COOKIE → Node references for graph connections
AWK_BOOL       → Boolean flags (is_adjacent, is_platonic, etc.)
AWK_STRNUM     → Hybrid values (can be symbol or count)
AWK_REGEX      → Pattern matching for symbolic equations
AWK_UNDEFINED  → Null/missing values
AWK_NUMBER     → Derived only (never stored directly)
```

### Balls, Spheres, and Observers

- **Balls (0D)**: YAML files defining atomic nodes with symbolic properties
- **Spheres**: Emergent structures from collections of connected balls
- **Ideals**: Covariant elements (vertices) - move with observer
- **Idols**: Contravariant elements (edges) - move inversely to observer
- **Identity**: Intersection volumes where ideals and idols overlap
- **Observers**: Centroids of identity spheres (intersubjective viewpoints)

## File Structure

```
hydrogen.yaml         # Ball definition (ideal)
oxygen.yaml           # Ball definition (ideal)
carbon.yaml           # Ball definition (idol)
nitrogen.yaml         # Ball definition (idol)

tokenize.awk          # YAML → awk_valtype_t tokens
extract_arrays.awk    # Expand AWK_ARRAY to AWK_SCALAR
build_adjacency.awk   # Build graph from neighbors
compute_intersection.awk  # Find shared atoms (identity)
find_path.awk         # BFS pathfinding (combinatorial distance)
recognize_shape.awk   # Identify polyhedra by signature

pipeline.sh           # Main orchestration script
query.sh              # Interactive query tool

CLAUDE.md             # Guide for AI assistants
```

## Pipeline Stages

### 1. Tokenization
Converts YAML balls to typed token streams:
```
hydrogen.yaml   mnemonic   H   AWK_SCALAR
hydrogen.yaml   type       ideal   AWK_STRING
hydrogen.yaml   contains   [H, proton]   AWK_ARRAY
```

### 2. Array Expansion
Expands arrays into individual scalars:
```
hydrogen.yaml   contains   H        AWK_SCALAR
hydrogen.yaml   contains   proton   AWK_SCALAR
```

### 3. Adjacency Graph
Builds symbolic graph structure:
```
hydrogen.yaml->oxygen.yaml   fromNode   hydrogen.yaml   AWK_VALUE_COOKIE
hydrogen.yaml->oxygen.yaml   toNode     oxygen.yaml     AWK_VALUE_COOKIE
hydrogen.yaml->oxygen.yaml   is_adjacent   true         AWK_BOOL
```

### 4. Identity Emergence
Finds shared atoms (set intersections):
```
hydrogen.yaml∩oxygen.yaml   shared_atoms   [proton]   AWK_ARRAY
```

### 5. Path Finding
Computes combinatorial distance (graph path length):
```
path   nodes    hydrogen.yaml -> carbon.yaml -> nitrogen.yaml   AWK_STRING
path   length   2   AWK_STRNUM
path   found    true   AWK_BOOL
```

### 6. Shape Recognition
Identifies polyhedra by combinatorial signature:
```
shape   vertex_count   4   AWK_STRNUM
shape   edge_count     10  AWK_STRNUM
shape   type           unknown   AWK_STRING
```

## Creating New Balls

Create a YAML file with this structure:

```yaml
- name: hydrogen
- type: ideal              # or "idol"
- mnemonic: H              # Single symbolic atom
- contains: [H, proton]    # Atoms in this ball
- neighbors: [oxygen, carbon]  # Connected balls
- boundary: tetrahedron    # Geometric constraint
```

Then re-run the pipeline:
```bash
./pipeline.sh
```

## Query Examples

```bash
# Show all AWK_SCALAR mnemonics
./query.sh scalars

# Show type of each ball
./query.sh types

# Find path between balls
./query.sh path hydrogen.yaml nitrogen.yaml

# Show what a ball contains
./query.sh contains hydrogen.yaml

# Show neighbors
./query.sh neighbors oxygen.yaml

# Show all identity intersections
./query.sh identities
```

## Pure Combinatorial Operations

All operations use **symbolic set theory** instead of numeric coordinates:

### Distance = Path Length
No `sqrt((x2-x1)^2 + (y2-y1)^2)` - just count edges:
```bash
# Distance is number of hops in graph
./query.sh path hydrogen.yaml nitrogen.yaml
# Output: length 2 (hydrogen -> carbon -> nitrogen)
```

### Position = Graph Connectivity
No (x,y,z) coordinates - position defined by what connects:
```yaml
neighbors: [oxygen, carbon]  # Defines topology, not coordinates
```

### Intersection = Set Intersection
No geometric overlap calculation - literal set operations:
```bash
# Find shared atoms between balls
awk '$2 == "shared_atoms"' identity.tsv
# Output: hydrogen∩oxygen shares [proton]
```

### Centroid = Symbolic Union
No `(Σx/n, Σy/n, Σz/n)` - union of symbolic atoms:
```bash
# Centroid of a face = union of vertex mnemonics
cat hydrogen.yaml oxygen.yaml carbon.yaml | grep contains
```

## Polyhedra Recognition

Shapes identified by **combinatorial invariants**:

| Shape | V | E | F | Signature |
|-------|---|---|---|-----------|
| Tetrahedron | 4 | 6 | 4 | All vertices degree 3 |
| Cube | 8 | 12 | 6 | All vertices degree 3 |
| Octahedron | 6 | 12 | 8 | All vertices degree 4 |

Euler's formula: `F = E - V + 2` (for convex polyhedra)

## Advanced: Extending to Higher Dimensions

### 4D Polytopes
Add more balls and check the signature:
- 5-cell: V=5, E=10, F=10, C=5 (cells)
- 16-cell: V=8, E=24, F=32, C=16

### k-Simplices
- 0-simplex: 1 ball (point)
- 1-simplex: 2 balls + edge (line)
- 2-simplex: 3 balls + 3 edges (triangle)
- 3-simplex: 4 balls + 6 edges (tetrahedron)
- k-simplex: (k+1) balls, fully connected

## Output Files

After running `./pipeline.sh`:

- **tokens.tsv**: Raw tokenized YAML data
- **expanded.tsv**: Arrays expanded to scalars
- **adjacency.tsv**: Graph structure (nodes + edges)
- **identity.tsv**: Identity intersections (shared atoms)
- **path.tsv**: Pathfinding results
- **shape.tsv**: Shape recognition data

All files use **tab-separated values** with columns:
```
<identifier>   <key>   <value>   <awk_valtype_t>
```

## Philosophy

This framework treats:
- **Geometry as pure topology** - no coordinates needed
- **Distance as connectivity** - count edges, not measure space
- **Position as relationships** - what connects, not where it sits
- **Identity as intersection** - symbolic overlap, not geometric
- **Observers as filters** - subgraphs of visible nodes

Everything is **symbols, sets, and graphs** - pure combinatorics.

## References

See `CLAUDE.md` for the full conceptual architecture including:
- Ideals vs Idols (covariant vs contravariant)
- Platonic and Archimedean solids mapping
- Observer centroids and intersubjective geometry
- Hopf fibers and dual snub rotations
- Complete philosophical framework
