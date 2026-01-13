#!/bin/bash
# Basic test suite for AtomStateTree

echo "=== AtomStateTree Test Suite ==="
echo

# Test 1: AWK State Manager - Zero State
echo "Test 1: Generate zero State256"
echo "ZERO" | ./atom_state_tree.awk | head -n 5
echo "... (256 total atoms)"
echo

# Test 2: AWK State Manager - Set and Get
echo "Test 2: Set and Get atoms"
cat <<'EOF' | ./atom_state_tree.awk
SET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L test_value
GET State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L
EOF
echo

# Test 3: AWK State Manager - Invalid path
echo "Test 3: Invalid path handling"
cat <<'EOF' | ./atom_state_tree.awk 2>&1
SET State.Invalid.Path bad_value
EOF
echo

# Test 4: Minimal Pairing Engine - 8 atoms
echo "Test 4: Build tree from 8 atoms"
echo "Atom1 Atom2 Atom3 Atom4 Atom5 Atom6 Atom7 Atom8" | ./atomtree.awk
echo

# Test 5: Minimal Pairing Engine - 4 atoms
echo "Test 5: Build tree from 4 atoms (Logic4)"
echo "A B C D" | ./atomtree.awk
echo

# Test 6: Python VM - Demo
echo "Test 6: Python VM Demo"
./atomvm.py demo
echo

echo "=== Tests Complete ==="
