#!/usr/bin/awk -f
# build_adjacency.awk - Build symbolic adjacency using AWK_VALUE_COOKIE references

BEGIN {
    FS = "\t"
    OFS = "\t"
}

# Collect all nodes as VALUE_COOKIEs
$2 == "name" && $4 == "AWK_STRING" {
    nodes[$3] = $1
    node_files[$1] = 1
}

# Collect neighbor relationships
$2 == "neighbors" && $4 == "AWK_SCALAR" {
    from = $1
    to_name = $3
    neighbors[from][to_name] = 1
}

END {
    # Emit node references
    for (file in node_files) {
        print file, "node_ref", file, "AWK_VALUE_COOKIE"
    }

    # Emit edges
    for (from_file in neighbors) {
        for (to_name in neighbors[from_file]) {
            # Find the file for this neighbor name
            to_file = ""
            for (name in nodes) {
                if (name == to_name) {
                    to_file = nodes[name]
                    break
                }
            }

            if (to_file != "") {
                edge_id = from_file "->" to_file
                print edge_id, "fromNode", from_file, "AWK_VALUE_COOKIE"
                print edge_id, "toNode", to_file, "AWK_VALUE_COOKIE"
                print edge_id, "is_adjacent", "true", "AWK_BOOL"
            }
        }
    }
}
