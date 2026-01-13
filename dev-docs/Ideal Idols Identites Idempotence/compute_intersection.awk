#!/usr/bin/awk -f
# compute_intersection.awk - Find shared atoms between balls (pure combinatorics)

BEGIN {
    FS = "\t"
    OFS = "\t"
}

# Collect all 'contains' atoms per file
$2 == "contains" && $4 == "AWK_SCALAR" {
    atoms[$1][$3] = 1
    files[$1] = 1
}

END {
    # Compare all pairs
    n = 0
    for (file1 in files) file_array[n++] = file1

    for (i = 0; i < n; i++) {
        for (j = i + 1; j < n; j++) {
            file1 = file_array[i]
            file2 = file_array[j]

            # Find intersection
            intersection = ""
            count = 0
            for (atom in atoms[file1]) {
                if (atom in atoms[file2]) {
                    if (intersection != "") intersection = intersection ","
                    intersection = intersection atom
                    count++
                }
            }

            if (intersection != "") {
                # Emit identity as AWK_ARRAY of shared atoms
                identity_id = file1 "∩" file2
                print identity_id, "shared_atoms", "[" intersection "]", "AWK_ARRAY"
                print identity_id, "intersection_count", count, "AWK_STRNUM"
                print identity_id, "emerges_from", file1, "AWK_VALUE_COOKIE"
                print identity_id, "emerges_from", file2, "AWK_VALUE_COOKIE"
            }
        }
    }
}
