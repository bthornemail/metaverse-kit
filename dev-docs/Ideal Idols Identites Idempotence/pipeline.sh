#!/bin/bash
# pipeline.sh - Complete pure combinatorial processing pipeline

set -e  # Exit on error

echo "========================================="
echo "Pure Combinatorial Geometry Pipeline"
echo "Using awk_valtype_t Type System"
echo "========================================="
echo ""

# Step 1: Tokenize YAML balls to AWK types
echo "=== STEP 1: TOKENIZATION ==="
echo "Converting YAML balls to awk_valtype_t token stream..."
awk -f tokenize.awk hydrogen.yaml oxygen.yaml carbon.yaml nitrogen.yaml > tokens.tsv

echo "Sample tokens:"
head -10 tokens.tsv
echo ""
echo "Total tokens: $(wc -l < tokens.tsv)"
echo ""

# Step 2: Expand arrays
echo "=== STEP 2: ARRAY EXPANSION ==="
echo "Expanding AWK_ARRAY types to AWK_SCALAR elements..."
awk -f extract_arrays.awk tokens.tsv > expanded.tsv

echo "Sample expanded tokens:"
head -10 expanded.tsv
echo ""
echo "Total expanded tokens: $(wc -l < expanded.tsv)"
echo ""

# Step 3: Build adjacency graph
echo "=== STEP 3: ADJACENCY GRAPH ==="
echo "Building symbolic adjacency using AWK_VALUE_COOKIE references..."
awk -f build_adjacency.awk expanded.tsv > adjacency.tsv

echo "Sample adjacency data:"
head -15 adjacency.tsv
echo ""
echo "Total adjacency entries: $(wc -l < adjacency.tsv)"
echo ""

# Step 4: Find intersections (identity emergence)
echo "=== STEP 4: IDENTITY EMERGENCE ==="
echo "Computing set intersections (shared atoms between balls)..."
awk -f compute_intersection.awk expanded.tsv > identity.tsv

if [ -s identity.tsv ]; then
    echo "Identity spheres found:"
    cat identity.tsv
    echo ""
else
    echo "No shared atoms found between balls."
    echo ""
fi

# Step 5: Find path (combinatorial distance)
echo "=== STEP 5: PATH FINDING ==="
echo "Finding symbolic path from hydrogen.yaml to nitrogen.yaml..."
START="hydrogen.yaml" TARGET="nitrogen.yaml" awk -f find_path.awk adjacency.tsv > path.tsv

echo "Path result:"
cat path.tsv
echo ""

# Step 6: Recognize shape
echo "=== STEP 6: SHAPE RECOGNITION ==="
echo "Analyzing combinatorial signature of the graph..."
cat adjacency.tsv | awk -f recognize_shape.awk > shape.tsv

echo "Shape analysis:"
cat shape.tsv
echo ""

# Step 7: Summary statistics
echo "========================================="
echo "SUMMARY"
echo "========================================="
echo ""

echo "Balls (nodes):"
grep "AWK_SCALAR" expanded.tsv | grep "mnemonic" | awk '{print "  - " $1 " (mnemonic: " $3 ")"}'
echo ""

echo "Types:"
grep "type" expanded.tsv | grep "AWK_STRING" | awk '{print "  - " $1 ": " $3}'
echo ""

echo "Adjacency count:"
echo "  - Edges: $(grep 'is_adjacent' adjacency.tsv | wc -l)"
echo ""

echo "Identity intersections:"
identity_count=$(grep 'shared_atoms' identity.tsv 2>/dev/null | wc -l)
echo "  - Found: $identity_count"
echo ""

echo "Shape classification:"
shape_type=$(grep "^shape.*type" shape.tsv | awk '{print $3}')
is_platonic=$(grep "is_platonic" shape.tsv | awk '{print $3}')
echo "  - Type: $shape_type"
echo "  - Is Platonic: $is_platonic"
echo ""

echo "========================================="
echo "Pipeline complete!"
echo "========================================="
echo ""
echo "Output files:"
echo "  - tokens.tsv      : Raw tokenized data"
echo "  - expanded.tsv    : Expanded arrays"
echo "  - adjacency.tsv   : Graph structure"
echo "  - identity.tsv    : Intersection data"
echo "  - path.tsv        : Path finding results"
echo "  - shape.tsv       : Shape recognition"
