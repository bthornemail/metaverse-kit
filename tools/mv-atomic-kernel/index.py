#!/usr/bin/env python3
"""Thin downstream adapter over the public atomic_kernel.* API."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def _bootstrap_import_path(root: Path) -> None:
    """Allow local workspace dependency while preserving public import surface."""
    extra = os.environ.get("ATOMIC_KERNEL_PYTHONPATH", "").strip()
    if extra:
        sys.path.insert(0, extra)
        return
    sibling = (root / ".." / "atomic-kernel").resolve()
    if sibling.exists():
        sys.path.insert(0, str(sibling))


def _hex_u32(n: int) -> str:
    return f"0x{n:08x}"


def run(payload: dict, root: Path) -> dict:
    _bootstrap_import_path(root)

    # Public boundary only.
    import atomic_kernel as ak  # noqa: PLC0415

    replay = ak.replay(int(payload["width"]), int(payload["seed"], 16), int(payload["steps"]))
    sid = ak.compute_typed_sid(str(payload["sid_type"]), str(payload["canonical"]))

    clock = payload["clock"]
    next_clock = ak.advance_clock(
        {
            "frame": int(clock["frame"]),
            "tick": int(clock["tick"]),
            "control": int(clock["control"]),
        }
    )
    oid = ak.compute_oid(next_clock, sid, payload.get("prev_oid"))

    return {
        "v": "metaverse-kit.atomic-kernel.adapter.v1",
        "authority": "advisory",
        "input": payload,
        "replay": [_hex_u32(v) for v in replay],
        "sid": sid,
        "next_clock": next_clock,
        "oid": oid,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    inp = json.loads(Path(args.input).read_text(encoding="utf-8"))
    out = run(inp, root)
    Path(args.output).write_text(json.dumps(out, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"ok mv-atomic-kernel out={args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
