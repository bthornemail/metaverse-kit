#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
make-demo-gif.sh

Usage:
  bash scripts/make-demo-gif.sh record-cast [cast_file]
  bash scripts/make-demo-gif.sh cast-to-gif [cast_file] [gif_file]
  bash scripts/make-demo-gif.sh mp4-to-gif [mp4_file] [gif_file]

Defaults:
  cast_file: tester.cast
  gif_file:  tester.gif
  mp4_file:  tester.mp4

Notes:
  - cast-to-gif requires: asciinema cast + agg
  - mp4-to-gif requires: ffmpeg
EOF
}

cmd="${1:-help}"
case "$cmd" in
  help|-h|--help)
    usage
    exit 0
    ;;

  record-cast)
    cast_file="${2:-tester.cast}"
    command -v asciinema >/dev/null 2>&1 || { echo "ERROR: asciinema not found"; exit 2; }
    asciinema rec "$cast_file" -c ./scripts/demo-tester-flow.sh
    echo "ok recorded cast: $cast_file"
    ;;

  cast-to-gif)
    cast_file="${2:-tester.cast}"
    gif_file="${3:-tester.gif}"
    command -v agg >/dev/null 2>&1 || { echo "ERROR: agg not found"; exit 2; }
    [[ -f "$cast_file" ]] || { echo "ERROR: cast not found: $cast_file"; exit 2; }
    agg "$cast_file" "$gif_file"
    echo "ok gif created: $gif_file"
    ;;

  mp4-to-gif)
    mp4_file="${2:-tester.mp4}"
    gif_file="${3:-tester.gif}"
    palette="$(mktemp)"
    trap 'rm -f "$palette"' EXIT
    command -v ffmpeg >/dev/null 2>&1 || { echo "ERROR: ffmpeg not found"; exit 2; }
    [[ -f "$mp4_file" ]] || { echo "ERROR: mp4 not found: $mp4_file"; exit 2; }
    ffmpeg -y -i "$mp4_file" -vf "fps=12,scale=1280:-1:flags=lanczos,palettegen=stats_mode=diff" "$palette"
    ffmpeg -y -i "$mp4_file" -i "$palette" -lavfi "fps=12,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "$gif_file"
    echo "ok gif created from mp4: $gif_file"
    ;;

  *)
    echo "ERROR: unknown command: $cmd" >&2
    usage >&2
    exit 2
    ;;
esac
