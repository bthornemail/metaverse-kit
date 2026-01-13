#!/usr/bin/awk -f
# tokenize.awk - Convert YAML balls to awk_valtype_t stream

BEGIN {
    FS = ":"
    OFS = "\t"
}

# Parse YAML and emit typed tokens
/^- name:/ {
    gsub(/^- name: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "name", $0, "AWK_STRING"
}

/^- type:/ {
    gsub(/^- type: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "type", $0, "AWK_STRING"
}

/^- mnemonic:/ {
    gsub(/^- mnemonic: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "mnemonic", $0, "AWK_SCALAR"
}

/^- relation:/ {
    gsub(/^- relation: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "relation", $0, "AWK_STRING"
}

/^- boundary:/ {
    gsub(/^- boundary: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "boundary", $0, "AWK_STRING"
}

/^- contains:/ {
    gsub(/^- contains: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "contains", $0, "AWK_ARRAY"
}

/^- neighbors:/ {
    gsub(/^- neighbors: /, "", $0)
    gsub(/^ +| +$/, "", $0)
    print FILENAME, "neighbors", $0, "AWK_ARRAY"
}
