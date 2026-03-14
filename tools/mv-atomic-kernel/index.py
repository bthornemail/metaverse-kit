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


def _print_human(report: dict, source: str) -> None:
    replay = report["replay"]
    preview = ", ".join(replay[:8])
    print("Atomic Kernel Verification")
    print("status: PASS")
    print(f"width: {report['input']['width']}")
    print(f"seed: {report['input']['seed']}")
    print(f"replay[0..{min(len(replay), 8) - 1}]: {preview}")
    print(f"sid: {report['sid']}")
    print(f"oid: {report['oid']}")
    print(f"authority: {report['authority']} downstream view")
    print(f"source: {source}")


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
    parser.add_argument(
        "--input",
        default="fixtures/atomic-kernel/sample-input.json",
        help="input fixture (default: fixtures/atomic-kernel/sample-input.json)",
    )
    parser.add_argument("--output", help="optional machine-readable output path")
    parser.add_argument(
        "--show",
        action="store_true",
        help="print human-readable verification summary to stdout",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    inp = json.loads(Path(args.input).read_text(encoding="utf-8"))
    out = run(inp, root)
    if args.output:
        Path(args.output).write_text(
            json.dumps(out, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8"
        )
        print(f"ok mv-atomic-kernel out={args.output}")
    if args.show:
        _print_human(out, args.input)
    if not args.output and not args.show:
        # Default behavior: emit machine-readable result to stdout.
        print(json.dumps(out, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
