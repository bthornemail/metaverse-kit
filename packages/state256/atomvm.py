#!/usr/bin/env python3
"""
AtomVM: State256 Virtual Machine (Python reference implementation)

Demonstrates the core concepts:
- Dimensional hierarchy (Atom → Relation2 → Logic4 → ... → State256)
- Squarable dimensions in registers (4, 16, 64, 256)
- Non-squarable dimensions on stack (2, 8, 32, 128)
- Path-based addressing with validation
"""

import sys
from typing import Dict, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum


class Dimension(Enum):
    """Dimensional levels in the hierarchy"""
    ATOM1 = 1
    RELATION2 = 2    # Stack (non-squarable)
    LOGIC4 = 4       # Register (squarable) - S³ sphere
    CLOSURE8 = 8     # Stack (non-squarable)
    RECORD16 = 16    # Register (squarable) - S¹⁵ sphere
    BLOCK32 = 32     # Stack (non-squarable)
    CONTEXT64 = 64   # Register (squarable) - S⁶³ sphere
    FRAME128 = 128   # Stack (non-squarable)
    STATE256 = 256   # Register (squarable) - S²⁵⁵ sphere


@dataclass
class AtomPath:
    """Canonical path to an atom in State256"""
    frame: str       # FrameA, FrameB
    context: str     # Local, Remote, Proposed, Canonical
    block: str       # Block1, Block2
    record: str      # Record1, Record2
    closure: str     # Closure1, Closure2
    logic: str       # Logic1, Logic2
    relation: str    # Relation1, Relation2
    atom: str        # L, R

    @classmethod
    def from_string(cls, path_str: str) -> Optional['AtomPath']:
        """Parse canonical path string"""
        parts = path_str.split('.')
        if len(parts) != 9 or parts[0] != "State":
            return None

        try:
            return cls(
                frame=parts[1],
                context=parts[2],
                block=parts[3],
                record=parts[4],
                closure=parts[5],
                logic=parts[6],
                relation=parts[7],
                atom=parts[8]
            )
        except:
            return None

    def to_string(self) -> str:
        """Convert to canonical path string"""
        return f"State.{self.frame}.{self.context}.{self.block}.{self.record}.{self.closure}.{self.logic}.{self.relation}.{self.atom}"

    def validate(self) -> bool:
        """Validate path components against domain"""
        valid_frames = {"FrameA", "FrameB"}
        valid_contexts = {"Local", "Remote", "Proposed", "Canonical"}
        valid_blocks = {"Block1", "Block2"}
        valid_records = {"Record1", "Record2"}
        valid_closures = {"Closure1", "Closure2"}
        valid_logics = {"Logic1", "Logic2"}
        valid_relations = {"Relation1", "Relation2"}
        valid_atoms = {"L", "R"}

        return (
            self.frame in valid_frames and
            self.context in valid_contexts and
            self.block in valid_blocks and
            self.record in valid_records and
            self.closure in valid_closures and
            self.logic in valid_logics and
            self.relation in valid_relations and
            self.atom in valid_atoms
        )


@dataclass
class VMState:
    """Virtual machine state with registers and stack"""
    # Registers for squarable dimensions
    logic4: List[Union[str, int, float]] = field(default_factory=lambda: ["Ø"] * 4)
    record16: List[Union[str, int, float]] = field(default_factory=lambda: ["Ø"] * 16)
    context64: List[Union[str, int, float]] = field(default_factory=lambda: ["Ø"] * 64)
    state256: List[Union[str, int, float]] = field(default_factory=lambda: ["Ø"] * 256)

    # Stack for non-squarable dimensions
    stack: List[Union[str, int, float]] = field(default_factory=list)

    # Leaf storage (full State256 tree)
    leaves: Dict[str, Union[str, int, float]] = field(default_factory=dict)

    # Program counter
    pc: int = 0


class AtomVM:
    """State256 Virtual Machine"""

    def __init__(self):
        self.state = VMState()
        self._init_domains()

    def _init_domains(self):
        """Initialize valid domain values"""
        self.frames = ["FrameA", "FrameB"]
        self.contexts = ["Local", "Remote", "Proposed", "Canonical"]
        self.blocks = ["Block1", "Block2"]
        self.records = ["Record1", "Record2"]
        self.closures = ["Closure1", "Closure2"]
        self.logics = ["Logic1", "Logic2"]
        self.relations = ["Relation1", "Relation2"]
        self.atoms = ["L", "R"]

    def zero_state(self) -> List[str]:
        """Generate zero State256 (all atoms = Ø)"""
        paths = []
        for frame in self.frames:
            for context in self.contexts:
                for block in self.blocks:
                    for record in self.records:
                        for closure in self.closures:
                            for logic in self.logics:
                                for relation in self.relations:
                                    for atom in self.atoms:
                                        path = f"State.{frame}.{context}.{block}.{record}.{closure}.{logic}.{relation}.{atom}"
                                        self.state.leaves[path] = "Ø"
                                        paths.append(path)
        return paths

    def set_leaf(self, path: str, value: Union[str, int, float]) -> bool:
        """Set a leaf value with path validation"""
        atom_path = AtomPath.from_string(path)
        if not atom_path or not atom_path.validate():
            print(f"ERROR: Invalid path: {path}", file=sys.stderr)
            return False

        self.state.leaves[path] = value if value != "" else "Ø"
        return True

    def get_leaf(self, path: str) -> Optional[Union[str, int, float]]:
        """Get a leaf value"""
        atom_path = AtomPath.from_string(path)
        if not atom_path or not atom_path.validate():
            print(f"ERROR: Invalid path: {path}", file=sys.stderr)
            return None

        return self.state.leaves.get(path, "Ø")

    def load_to_logic4(self, values: List[Union[str, int, float]]):
        """Load values into Logic4 registers (S³ sphere)"""
        for i in range(min(4, len(values))):
            self.state.logic4[i] = values[i]

    def load_to_record16(self, values: List[Union[str, int, float]]):
        """Load values into Record16 registers (S¹⁵ sphere)"""
        for i in range(min(16, len(values))):
            self.state.record16[i] = values[i]

    def load_to_context64(self, batch: int, values: List[Union[str, int, float]]):
        """Load batch into Context64 registers (S⁶³ sphere)"""
        if 0 <= batch < 4:
            start = batch * 16
            for i in range(min(16, len(values))):
                self.state.context64[start + i] = values[i]

    def load_to_state256(self, batch: int, values: List[Union[str, int, float]]):
        """Load batch into State256 registers (S²⁵⁵ sphere)"""
        if 0 <= batch < 16:
            start = batch * 16
            for i in range(min(16, len(values))):
                self.state.state256[start + i] = values[i]

    def push_stack(self, value: Union[str, int, float]):
        """Push to stack (for non-squarable dimensions)"""
        self.state.stack.append(value)

    def pop_stack(self) -> Optional[Union[str, int, float]]:
        """Pop from stack"""
        return self.state.stack.pop() if self.state.stack else None

    def pair(self, a: Union[str, int, float], b: Union[str, int, float]) -> str:
        """Create a Relation2 pair (midsphere operation)"""
        return f"({a} . {b})"

    def build_tree(self, atoms: List[Union[str, int, float]]) -> str:
        """Build nested relation tree from flat atoms"""
        if not atoms:
            return "Ø"

        current = atoms[:]
        level = 0

        while len(current) > 1:
            next_level = []
            for i in range(0, len(current), 2):
                if i + 1 < len(current):
                    next_level.append(self.pair(current[i], current[i + 1]))
                else:
                    next_level.append(current[i])  # odd carry
            current = next_level
            level += 1

        return current[0] if current else "Ø"

    def dump_state(self):
        """Dump current VM state"""
        print("=== VM State ===")
        print(f"\nLogic4 (S³): {self.state.logic4}")
        print(f"Record16 (S¹⁵): {self.state.record16}")
        print(f"Context64 (S⁶³) [first 8]: {self.state.context64[:8]}...")
        print(f"State256 (S²⁵⁵) [first 8]: {self.state.state256[:8]}...")
        print(f"\nStack (depth={len(self.state.stack)}): {self.state.stack[-5:] if len(self.state.stack) > 5 else self.state.stack}")
        print(f"Leaves stored: {len(self.state.leaves)}")


def main():
    """CLI interface for AtomVM"""
    vm = AtomVM()

    if len(sys.argv) > 1:
        # Execute commands from arguments
        command = sys.argv[1]

        if command == "zero":
            paths = vm.zero_state()
            print(f"Generated {len(paths)} zero atoms")
            for i, path in enumerate(paths[:5]):
                print(f"  {path} = Ø")
            print(f"  ... and {len(paths) - 5} more")

        elif command == "demo":
            print("=== AtomVM Demo ===\n")

            # Demo 1: Build a tree from atoms
            print("1. Building tree from 8 atoms:")
            atoms = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]
            tree = vm.build_tree(atoms)
            print(f"   Input: {atoms}")
            print(f"   Tree: {tree}\n")

            # Demo 2: Load into registers
            print("2. Loading into Logic4 registers (S³ sphere):")
            vm.load_to_logic4([1, 2, 3, 4])
            print(f"   Logic4: {vm.state.logic4}\n")

            # Demo 3: Set and get leaves
            print("3. Setting leaf values:")
            path1 = "State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.L"
            path2 = "State.FrameA.Local.Block1.Record1.Closure1.Logic1.Relation1.R"
            vm.set_leaf(path1, "CID:bafy...")
            vm.set_leaf(path2, "SIG:0xabc...")
            print(f"   {path1} = {vm.get_leaf(path1)}")
            print(f"   {path2} = {vm.get_leaf(path2)}\n")

            # Demo 4: Stack operations
            print("4. Stack operations (non-squarable dimensions):")
            vm.push_stack("Relation1")
            vm.push_stack("Relation2")
            pair = vm.pair(vm.pop_stack(), vm.pop_stack())
            print(f"   Created pair: {pair}\n")

            # Demo 5: Dump state
            print("5. Current VM state:")
            vm.dump_state()

        else:
            print(f"Unknown command: {command}")
            print("Usage: python3 atomvm.py [zero|demo]")

    else:
        # Interactive REPL
        print("AtomVM Interactive REPL")
        print("Commands: zero, set <path> <value>, get <path>, dump, exit")
        print()

        while True:
            try:
                line = input("atomvm> ").strip()
                if not line:
                    continue

                parts = line.split(None, 2)
                cmd = parts[0].lower()

                if cmd == "exit" or cmd == "quit":
                    break
                elif cmd == "zero":
                    paths = vm.zero_state()
                    print(f"Generated {len(paths)} zero atoms")
                elif cmd == "set" and len(parts) >= 3:
                    path = parts[1]
                    value = parts[2]
                    if vm.set_leaf(path, value):
                        print(f"OK {path}")
                elif cmd == "get" and len(parts) >= 2:
                    path = parts[1]
                    value = vm.get_leaf(path)
                    if value is not None:
                        print(f"{path} = {value}")
                elif cmd == "dump":
                    vm.dump_state()
                elif cmd == "help":
                    print("Commands:")
                    print("  zero - Initialize zero State256")
                    print("  set <path> <value> - Set leaf value")
                    print("  get <path> - Get leaf value")
                    print("  dump - Dump VM state")
                    print("  exit - Exit REPL")
                else:
                    print(f"Unknown command: {cmd}")

            except EOFError:
                break
            except KeyboardInterrupt:
                print("\nInterrupted")
                break
            except Exception as e:
                print(f"Error: {e}")


if __name__ == "__main__":
    main()
