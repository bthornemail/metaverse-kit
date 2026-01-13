#!/usr/bin/awk -f
# extract_arrays.awk - Extract and expand AWK_ARRAY types

BEGIN {
    FS = "\t"
    OFS = "\t"
}

$4 == "AWK_ARRAY" {
    file = $1
    key = $2
    value = $3

    # Strip brackets and split
    gsub(/[\[\]]/, "", value)
    gsub(/,[ \t]+/, ",", value)  # Remove spaces after commas
    gsub(/[ \t]+,/, ",", value)  # Remove spaces before commas
    n = split(value, items, ",")

    # Emit each array element as AWK_SCALAR
    for (i = 1; i <= n; i++) {
        gsub(/^[ \t]+|[ \t]+$/, "", items[i])  # trim
        if (items[i] != "") {
            print file, key, items[i], "AWK_SCALAR"
        }
    }
    next  # Don't pass through the original AWK_ARRAY line
}

# Pass through non-array tokens
$4 != "AWK_ARRAY" {
    print $0
}
