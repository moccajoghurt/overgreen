#!/bin/bash
# Ralph Loop — fresh context per iteration, no compaction
# Usage: ./ralph.sh [MAX_ITERATIONS]
#
# Runs in a git worktree so main repo stays clean.
# Each iteration gets a completely fresh context window.
# Progress is tracked via git commits + RALPH-PROGRESS.md.

set -euo pipefail

MAX_ITERATIONS="${1:-50}"
WORKTREE_NAME="ralph-$(date +%Y%m%d-%H%M%S)"
WORKTREE_DIR=".claude/worktrees/$WORKTREE_NAME"
BRANCH="ralph/$WORKTREE_NAME"

# ── Create worktree ───────────────────────────────────────
echo "Creating worktree: $WORKTREE_DIR (branch: $BRANCH)"
git worktree add "$WORKTREE_DIR" -b "$BRANCH"

# ── Build the prompt ──────────────────────────────────────
# RALPH.md has the loop instructions; task.md and target-matrix.md
# are read by claude from the worktree during each iteration.
PROMPT="$(cat RALPH.md)"

# ── Cleanup on exit ──────────────────────────────────────
cleanup() {
  echo ""
  echo "Ralph loop ended. Worktree preserved at: $WORKTREE_DIR"
  echo "Branch: $BRANCH"
  echo ""
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
