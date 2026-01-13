#!/bin/bash
# demo.sh - Interactive demonstration of pure combinatorial geometry

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Pure Combinatorial Geometry Framework Demo                 ║"
echo "║   No coordinates - only symbols, sets, and relationships     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if pipeline has been run
if [ ! -f expanded.tsv ]; then
    echo "Running pipeline first..."
    ./pipeline.sh > /dev/null 2>&1
    echo ""
fi

echo "=== 1. Show all balls (awk_valtype_t = AWK_SCALAR) ==="
./query.sh mnemonics
echo ""

echo "=== 2. Classify balls as ideals or idols ==="
./query.sh types
echo ""

echo "=== 3. Graph topology (symbolic adjacency) ==="
./query.sh edges
echo ""

echo "=== 4. Identity emergence (set intersection) ==="
echo "Finding shared atoms between balls..."
./query.sh identities
echo ""

echo "=== 5. Combinatorial distance (no coordinates!) ==="
echo "Path from hydrogen to nitrogen:"
./query.sh path hydrogen.yaml nitrogen.yaml | grep "nodes\|length"
echo ""

echo "=== 6. Inspect a ball (all AWK types) ==="
./query.sh ball oxygen.yaml
echo ""

echo "=== 7. Query by type ==="
echo "All AWK_BOOL flags:"
awk -F'\t' '$4 == "AWK_BOOL" {print $1 "\t" $2 " = " $3}' adjacency.tsv path.tsv shape.tsv 2>/dev/null | head -5
echo ""

echo "=== 8. Combinatorial signature ==="
echo "Shape recognition (purely from graph invariants):"
awk -F'\t' '$1 == "shape" && $2 ~ /count|type|platonic/ {print "  " $2 " = " $3}' shape.tsv
echo ""

echo "=== 9. Symbolic set operations ==="
echo "Atoms in hydrogen:"
./query.sh contains hydrogen.yaml
echo ""
echo "Atoms in oxygen:"
./query.sh contains oxygen.yaml
echo ""
echo "Their intersection (identity):"
awk -F'\t' '$1 ~ /hydrogen.*oxygen/ && $2 == "shared_atoms" {print "  " $3}' identity.tsv
echo ""

echo "=== 10. Graph degree analysis (pure combinatorics) ==="
echo "Neighbors per ball:"
for ball in hydrogen.yaml oxygen.yaml carbon.yaml nitrogen.yaml; do
    count=$(awk -F'\t' -v b="$ball" '$1 == b && $2 == "neighbors" && $4 == "AWK_SCALAR"' expanded.tsv | wc -l)
    mnemonic=$(awk -F'\t' -v b="$ball" '$1 == b && $2 == "mnemonic" {print $3}' expanded.tsv)
    echo "  $ball ($mnemonic): degree $count"
done
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Key Insight: All geometry derived from pure relations!     ║"
echo "║   - No (x,y,z) coordinates                                    ║"
echo "║   - Distance = graph path length (edge count)                 ║"
echo "║   - Position = connectivity pattern                           ║"
echo "║   - Centroid = symbolic union of atoms                        ║"
echo "║   - Identity = set intersection                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "Try these commands:"
echo "  ./query.sh mnemonics"
echo "  ./query.sh path hydrogen.yaml nitrogen.yaml"
echo "  ./query.sh ball <ballname>"
echo "  ./query.sh neighbors <ballname>"
echo "  ./query.sh identities"
echo ""
echo "Or explore the raw data:"
echo "  less expanded.tsv      # All tokens with awk_valtype_t tags"
echo "  less adjacency.tsv     # Graph structure"
echo "  less identity.tsv      # Set intersections"
