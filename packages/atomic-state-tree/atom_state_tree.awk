#!/usr/bin/awk -f
# POSIX awk
#
# AtomStateTree: symbolic State256 "zero tree" + replay.
#
# Commands on stdin:
#   ZERO              -> emits all leaf assignments as "PUT <path> Ø"
#   SET <path> <value...> -> sets a leaf to a value (symbolic)
#   GET <path>        -> prints current value
#   DUMP              -> dumps all leaves in canonical order
#
# Determinism:
#   - canonical enumeration order
#   - SET is idempotent for same value
#   - replay = fold over ordered events (you choose your ordering rule upstream)

BEGIN {
    init_domains()

    # default: if you run with no stdin, print a hint
    if (ARGC == 1) {
        print "Usage:"
        print "  echo ZERO | awk -f atom_state_tree.awk"
        print "  printf 'ZERO\\nSET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L H:abc\\nDUMP\\n' | awk -f atom_state_tree.awk"
    }
}

# ---------------------------
# Domain initialization
# ---------------------------

function init_domains() {
    Frames[1]="FrameA";      Frames[2]="FrameB"
    Contexts[1]="Local";     Contexts[2]="Remote";
    Contexts[3]="Proposed";  Contexts[4]="Canonical"
    Blocks[1]="Block1";      Blocks[2]="Block2"
    Records[1]="Record1";    Records[2]="Record2"
    Closures[1]="Closure1";  Closures[2]="Closure2"
    Logics[1]="Logic1";      Logics[2]="Logic2"
    Relations[1]="Relation1"; Relations[2]="Relation2"
    AtomSides[1]="L";        AtomSides[2]="R"
}

# ---------------------------
# Canonical leaf enumeration
# ---------------------------

function leaf_path(frame, ctx, block, record, closure, logic, rel, side) {
    return "State." frame "." ctx "." block "." record "." closure "." logic "." rel "." side
}

function emit_zero_tree(    f,c,b,r,cl,l,re,s,p) {
    for (f=1; f<=2; f++)
    for (c=1; c<=4; c++)
    for (b=1; b<=2; b++)
    for (r=1; r<=2; r++)
    for (cl=1; cl<=2; cl++)
    for (l=1; l<=2; l++)
    for (re=1; re<=2; re++)
    for (s=1; s<=2; s++) {
        p = leaf_path(Frames[f], Contexts[c], Blocks[b], Records[r],
                      Closures[cl], Logics[l], Relations[re], AtomSides[s])
        if (!(p in Leaf)) Leaf[p] = "Ø"
        print "PUT " p " " Leaf[p]
    }
}

function dump_tree(    f,c,b,r,cl,l,re,s,p) {
    for (f=1; f<=2; f++)
    for (c=1; c<=4; c++)
    for (b=1; b<=2; b++)
    for (r=1; r<=2; r++)
    for (cl=1; cl<=2; cl++)
    for (l=1; l<=2; l++)
    for (re=1; re<=2; re++)
    for (s=1; s<=2; s++) {
        p = leaf_path(Frames[f], Contexts[c], Blocks[b], Records[r],
                      Closures[cl], Logics[l], Relations[re], AtomSides[s])
        if (!(p in Leaf)) Leaf[p] = "Ø"
        print "PUT " p " " Leaf[p]
    }
}

# ---------------------------
# Path validation
# ---------------------------

function in_domain(x, arr, n,    i) {
    for (i=1; i<=n; i++)
        if (arr[i] == x) return 1
    return 0
}

function is_valid_path(path,    parts, n) {
    n = split(path, parts, ".")
    if (n != 9) return 0
    if (parts[1] != "State") return 0
    if (!in_domain(parts[2], Frames, 2)) return 0
    if (!in_domain(parts[3], Contexts, 4)) return 0
    if (!in_domain(parts[4], Blocks, 2)) return 0
    if (!in_domain(parts[5], Records, 2)) return 0
    if (!in_domain(parts[6], Closures, 2)) return 0
    if (!in_domain(parts[7], Logics, 2)) return 0
    if (!in_domain(parts[8], Relations, 2)) return 0
    if (!in_domain(parts[9], AtomSides, 2)) return 0
    return 1
}

# ---------------------------
# Mutation / replay primitives
# ---------------------------

function set_leaf(path, value) {
    if (!is_valid_path(path)) {
        print "ERR invalid_path " path > "/dev/stderr"
        return 0
    }
    if (value == "") value = "Ø"
    Leaf[path] = value
    print "OK " path
    return 1
}

function get_leaf(path) {
    if (!is_valid_path(path)) {
        print "ERR invalid_path " path > "/dev/stderr"
        return
    }
    if (!(path in Leaf)) Leaf[path] = "Ø"
    print "VAL " path " " Leaf[path]
}

# ---------------------------
# Input command parser
# ---------------------------

{
    cmd = $1

    if (cmd == "ZERO") {
        emit_zero_tree()
        next
    }

    if (cmd == "DUMP") {
        dump_tree()
        next
    }

    if (cmd == "GET") {
        path = $2
        get_leaf(path)
        next
    }

    if (cmd == "SET") {
        path = $2
        # value may contain spaces; rebuild from $3..$NF
        value = ""
        for (i=3; i<=NF; i++) {
            if (i > 3) value = value " "
            value = value $i
        }
        set_leaf(path, value)
        next
    }

    if (cmd == "" || cmd ~ /^#/) next

    print "ERR unknown_command " cmd > "/dev/stderr"
}
