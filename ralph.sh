#!/bin/bash
# Ralph Loop — fresh context per iteration, no compaction
# Usage: ./ralph.sh [MAX_ITERATIONS]                — create new worktree
#        ./ralph.sh [MAX_ITERATIONS] --resume NAME  — resume existing worktree
#
# Each iteration gets a completely fresh context window.
# Progress is tracked via git commits + RALPH-PROGRESS.md.

set -uo pipefail

# ── Parse arguments ──────────────────────────────────────
MAX_ITERATIONS=50
RESUME=""
while [ $# -gt 0 ]; do
  case "$1" in
    --resume) RESUME="$2"; shift 2 ;;
    *) MAX_ITERATIONS="$1"; shift ;;
  esac
done

if [ -n "$RESUME" ] && [ "$RESUME" != "next" ]; then
  # Resume existing worktree
  WORKTREE_DIR=".claude/worktrees/$RESUME"
  BRANCH="ralph/$RESUME"
  if [ ! -d "$WORKTREE_DIR" ]; then
    echo "ERROR: Worktree not found: $WORKTREE_DIR"
    echo "Available worktrees:"
    ls .claude/worktrees/ 2>/dev/null || echo "  (none)"
    exit 1
  fi
  echo "Resuming worktree: $WORKTREE_DIR (branch: $BRANCH)"
else
  # Create new worktree
  WORKTREE_NAME="ralph-$(date +%Y%m%d-%H%M%S)"
  WORKTREE_DIR=".claude/worktrees/$WORKTREE_NAME"
  BRANCH="ralph/$WORKTREE_NAME"
  echo "Creating worktree: $WORKTREE_DIR (branch: $BRANCH)"
  git worktree add "$WORKTREE_DIR" -b "$BRANCH"
fi

# ── Build the prompt ──────────────────────────────────────
PROMPT="$(cat RALPH.md)"

# ── Cleanup on exit ──────────────────────────────────────
cleanup() {
  echo ""
  echo "Ralph loop ended. Worktree preserved at: $WORKTREE_DIR"
  echo "Branch: $BRANCH"
  echo ""
  echo "To resume:          ./ralph.sh --resume $(basename "$WORKTREE_DIR")"
  echo "To review changes:  git log $BRANCH --oneline"
  echo "To diff vs main:    git diff main...$BRANCH"
  echo "To merge:           git merge $BRANCH"
  echo "To remove worktree: git worktree remove $WORKTREE_DIR"
}
trap cleanup EXIT

# ── Loop ──────────────────────────────────────────────────
echo ""
echo "Starting Ralph loop: max $MAX_ITERATIONS iterations"
echo "=========================================="

COMPLETED=0
for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  Ralph iteration $i / $MAX_ITERATIONS"
  echo "╚══════════════════════════════════════╝"
  echo ""

  # Run claude with fresh context each time
  # -p = print mode (non-interactive, fresh context)
  # Working directory = the worktree
  # Use tee to stream output live AND capture it for completion check
  OUTFILE=$(mktemp)
  (cd "$WORKTREE_DIR" && claude -p \
    --dangerously-skip-permissions \
    --model opus \
    "$PROMPT" \
    2>&1) | tee "$OUTFILE" || true

  # Check for completion promise
  if grep -q "RALPH_COMPLETE" "$OUTFILE"; then
    rm -f "$OUTFILE"
    echo ""
    echo "=========================================="
    echo "RALPH_COMPLETE signaled on iteration $i"
    echo "=========================================="
    COMPLETED=1
    break
  fi
  rm -f "$OUTFILE"

  # Small pause between iterations to avoid rate limits
  sleep 3
done

if [ "$COMPLETED" -eq 0 ]; then
  echo ""
  echo "Ralph loop hit max iterations ($MAX_ITERATIONS) without completing."
fi
