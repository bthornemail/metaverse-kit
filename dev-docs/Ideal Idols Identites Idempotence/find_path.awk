#!/usr/bin/awk -f
# find_path.awk - BFS path finding - pure symbolic, no numbers except path length

BEGIN {
    FS = "\t"
    OFS = "\t"
    if (START == "") START = "hydrogen.yaml"
    if (TARGET == "") TARGET = "nitrogen.yaml"
}

# Build adjacency list from edges
$2 == "fromNode" && $4 == "AWK_VALUE_COOKIE" {
    edge_id = $1
    from_node = $3
    edge_from[edge_id] = from_node
}

$2 == "toNode" && $4 == "AWK_VALUE_COOKIE" {
    edge_id = $1
    to_node = $3
    from_node = edge_from[edge_id]
    adj[from_node][to_node] = 1
}

END {
    # BFS initialization
    queue[0] = START
    visited[START] = 1
    parent[START] = ""
    qhead = 0
    qtail = 1

    # BFS traversal
    found = 0
    while (qhead < qtail) {
        current = queue[qhead++]

        if (current == TARGET) {
            # Found! Reconstruct path
            path_length = 0
            node = TARGET
            path = ""

            while (node != "") {
                if (path != "") path = node " -> " path
                else path = node
                node = parent[node]
                path_length++
            }

            print "path", "nodes", path, "AWK_STRING"
            print "path", "length", path_length - 1, "AWK_STRNUM"
            print "path", "found", "true", "AWK_BOOL"
            print "path", "start", START, "AWK_VALUE_COOKIE"
            print "path", "target", TARGET, "AWK_VALUE_COOKIE"
            found = 1
            exit
        }

        # Explore neighbors
        for (neighbor in adj[current]) {
            if (!(neighbor in visited)) {
                visited[neighbor] = 1
                parent[neighbor] = current
                queue[qtail++] = neighbor
            }
        }
    }

    # Not found
    if (!found) {
        print "path", "found", "false", "AWK_BOOL"
        print "path", "start", START, "AWK_VALUE_COOKIE"
        print "path", "target", TARGET, "AWK_VALUE_COOKIE"
    }
}
