#!/usr/bin/awk -f
# recognize_shape.awk - Identify polyhedra by combinatorial signature

BEGIN {
    FS = "\t"
    OFS = "\t"
}

# Count vertices (nodes)
$2 == "node_ref" && $4 == "AWK_VALUE_COOKIE" {
    vertices[$3] = 1
}

# Count edges
$2 == "is_adjacent" && $4 == "AWK_BOOL" && $3 == "true" {
    edges[$1] = 1
}

# Calculate vertex degrees
$2 == "fromNode" && $4 == "AWK_VALUE_COOKIE" {
    edge_id = $1
    from = $3
    degree[from]++
}

$2 == "toNode" && $4 == "AWK_VALUE_COOKIE" {
    edge_id = $1
    to = $3
    degree[to]++
}

END {
    V = length(vertices)
    E = length(edges)

    # Calculate average degree
    total_degree = 0
    min_degree = 999999
    max_degree = 0
    for (v in degree) {
        total_degree += degree[v]
        if (degree[v] < min_degree) min_degree = degree[v]
        if (degree[v] > max_degree) max_degree = degree[v]
    }

    if (V > 0) {
        avg_degree = total_degree / V
    } else {
        avg_degree = 0
    }

    # Euler characteristic: F = E - V + 2 (for convex polyhedra)
    F = E - V + 2

    # Emit combinatorial signature
    print "shape", "vertex_count", V, "AWK_STRNUM"
    print "shape", "edge_count", E, "AWK_STRNUM"
    print "shape", "face_count", F, "AWK_STRNUM"
    print "shape", "avg_degree", avg_degree, "AWK_STRNUM"
    print "shape", "min_degree", min_degree, "AWK_STRNUM"
    print "shape", "max_degree", max_degree, "AWK_STRNUM"

    # Pattern match to shape type (using combinatorial signature)
    if (V == 4 && E == 6 && F == 4) {
        print "shape", "type", "tetrahedron", "AWK_STRING"
        print "shape", "is_platonic", "true", "AWK_BOOL"
        print "shape", "category", "simplex_3D", "AWK_STRING"
    } else if (V == 8 && E == 12 && F == 6) {
        print "shape", "type", "cube", "AWK_STRING"
        print "shape", "is_platonic", "true", "AWK_BOOL"
        print "shape", "category", "platonic", "AWK_STRING"
    } else if (V == 6 && E == 12 && F == 8) {
        print "shape", "type", "octahedron", "AWK_STRING"
        print "shape", "is_platonic", "true", "AWK_BOOL"
        print "shape", "category", "platonic", "AWK_STRING"
    } else if (V == 20 && E == 30 && F == 12) {
        print "shape", "type", "dodecahedron", "AWK_STRING"
        print "shape", "is_platonic", "true", "AWK_BOOL"
        print "shape", "category", "platonic", "AWK_STRING"
    } else if (V == 12 && E == 30 && F == 20) {
        print "shape", "type", "icosahedron", "AWK_STRING"
        print "shape", "is_platonic", "true", "AWK_BOOL"
        print "shape", "category", "platonic", "AWK_STRING"
    } else {
        print "shape", "type", "unknown", "AWK_STRING"
        print "shape", "is_platonic", "false", "AWK_BOOL"
        print "shape", "category", "custom", "AWK_STRING"
    }

    # Check if all vertices have same degree (vertex-transitive)
    if (V > 0 && min_degree == max_degree) {
        print "shape", "is_vertex_transitive", "true", "AWK_BOOL"
    } else {
        print "shape", "is_vertex_transitive", "false", "AWK_BOOL"
    }
}
