#!/bin/bash
# query.sh - Query the combinatorial geometry using awk_valtype_t types

show_usage() {
    cat << EOF
Usage: $0 <command> [args]

Commands:
    scalars              - Show all AWK_SCALAR mnemonics
    strings              - Show all AWK_STRING values
    arrays               - Show all AWK_ARRAY collections
    cookies              - Show all AWK_VALUE_COOKIE references
    bools                - Show all AWK_BOOL flags

    mnemonics            - Show all ball mnemonics
    types                - Show types of all balls
    edges                - Show all graph edges
    identities           - Show all identity intersections
    path <from> <to>     - Find path between two balls

    ball <name>          - Show all properties of a ball
    neighbors <name>     - Show neighbors of a ball
    contains <name>      - Show what atoms a ball contains

Examples:
    $0 mnemonics
    $0 path hydrogen.yaml nitrogen.yaml
    $0 ball oxygen.yaml
    $0 neighbors hydrogen.yaml
EOF
}

if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
    scalars)
        echo "=== AWK_SCALAR Values ==="
        awk -F'\t' '$4 == "AWK_SCALAR" {print $1 "\t" $2 "\t" $3}' expanded.tsv
        ;;

    strings)
        echo "=== AWK_STRING Values ==="
        awk -F'\t' '$4 == "AWK_STRING" {print $1 "\t" $2 "\t" $3}' expanded.tsv
        ;;

    arrays)
        echo "=== AWK_ARRAY Collections ==="
        awk -F'\t' '$4 == "AWK_ARRAY" {print $1 "\t" $2 "\t" $3}' identity.tsv
        ;;

    cookies)
        echo "=== AWK_VALUE_COOKIE References ==="
        awk -F'\t' '$4 == "AWK_VALUE_COOKIE" {print $1 "\t" $2 "\t" $3}' adjacency.tsv | head -20
        ;;

    bools)
        echo "=== AWK_BOOL Flags ==="
        awk -F'\t' '$4 == "AWK_BOOL" {print $1 "\t" $2 "\t" $3}' adjacency.tsv path.tsv shape.tsv 2>/dev/null
        ;;

    mnemonics)
        echo "=== Ball Mnemonics ==="
        awk -F'\t' '$2 == "mnemonic" && $4 == "AWK_SCALAR" {print $1 " → " $3}' expanded.tsv
        ;;

    types)
        echo "=== Ball Types ==="
        awk -F'\t' '$2 == "type" && $4 == "AWK_STRING" {print $1 " → " $3}' expanded.tsv
        ;;

    edges)
        echo "=== Graph Edges ==="
        awk -F'\t' '$2 == "fromNode" && $4 == "AWK_VALUE_COOKIE" {
            edge_id = $1
            from = $3
            getline
            if ($2 == "toNode") {
                print from " -> " $3
            }
        }' adjacency.tsv
        ;;

    identities)
        echo "=== Identity Intersections ==="
        awk -F'\t' '$2 == "shared_atoms" && $4 == "AWK_ARRAY" {
            print $1 " shares: " $3
        }' identity.tsv
        ;;

    path)
        if [ $# -ne 2 ]; then
            echo "Usage: $0 path <from> <to>"
            exit 1
        fi
        FROM="$1"
        TO="$2"
        echo "=== Path from $FROM to $TO ==="
        START="$FROM" TARGET="$TO" awk -f find_path.awk adjacency.tsv
        ;;

    ball)
        if [ $# -ne 1 ]; then
            echo "Usage: $0 ball <name>"
            exit 1
        fi
        BALL="$1"
        echo "=== Properties of $BALL ==="
        awk -F'\t' -v ball="$BALL" '$1 == ball {print "  " $2 " = " $3 " (" $4 ")"}' expanded.tsv
        ;;

    neighbors)
        if [ $# -ne 1 ]; then
            echo "Usage: $0 neighbors <name>"
            exit 1
        fi
        BALL="$1"
        echo "=== Neighbors of $BALL ==="
        awk -F'\t' -v ball="$BALL" '$1 == ball && $2 == "neighbors" && $4 == "AWK_SCALAR" {print "  " $3}' expanded.tsv
        ;;

    contains)
        if [ $# -ne 1 ]; then
            echo "Usage: $0 contains <name>"
            exit 1
        fi
        BALL="$1"
        echo "=== Atoms contained in $BALL ==="
        awk -F'\t' -v ball="$BALL" '$1 == ball && $2 == "contains" && $4 == "AWK_SCALAR" {print "  " $3}' expanded.tsv
        ;;

    *)
        echo "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
