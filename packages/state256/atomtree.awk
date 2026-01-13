#!/usr/bin/awk -f
# atomtree.awk
# Minimal pairing engine: builds nested relations from flat atoms
# Usage: echo "a b c d e f g h" | awk -f atomtree.awk

function pair(a, b) {
    return "(" a " . " b ")"
}

function hash(x) {
    # placeholder: structural hash
    # replace with sha256 via command if you want
    return "H[" x "]"
}

BEGIN {
    level = 0
}

{
    for (i = 1; i <= NF; i++) {
        cur[i] = $i
    }
    n = NF
}

END {
    # Show initial level
    printf "\nLevel %d (Atoms):\n", level
    for (i = 1; i <= n; i++) {
        printf "  %s\n", cur[i]
    }
    level++

    while (n > 1) {
        printf "\nLevel %d", level
        if (level == 1) printf " (Relation2):\n"
        else if (level == 2) printf " (Logic4):\n"
        else if (level == 3) printf " (Closure8):\n"
        else if (level == 4) printf " (Record16):\n"
        else if (level == 5) printf " (Block32):\n"
        else if (level == 6) printf " (Context64):\n"
        else if (level == 7) printf " (Frame128):\n"
        else if (level == 8) printf " (State256):\n"
        else printf ":\n"

        next_n = 0
        for (i = 1; i <= n; i += 2) {
            if (i+1 <= n) {
                p = pair(cur[i], cur[i+1])
            } else {
                p = cur[i]  # odd carry
            }
            next_n = next_n + 1
            nxt[next_n] = p
        }

        # Print current level
        for (i = 1; i <= next_n; i++) {
            printf "  %s\n", nxt[i]
        }

        delete cur
        for (i = 1; i <= next_n; i++) {
            cur[i] = nxt[i]
            delete nxt[i]
        }
        n = next_n
        level++
    }

    printf "\nFinal Root (State):\n  %s\n", cur[1]
}
