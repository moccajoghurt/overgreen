# Ralph Loop: Reach the Target Matrix

**You are in an iterative loop.** Check `RALPH-PROGRESS.md` and recent git history before starting. Build on previous work.

## Mission

Make the trait engine produce ecologically plausible results across 16 niches. Two hard goals:

1. **No obviously broken results.** Excluded subtypes must not appear in the top-5 of any niche. Palms in a German forest = failure.
2. **Right archetypes in the right places.** Each niche lists which archetypes should be "strong" — at least one subtype from that archetype should be competitive there. Forests need trees, deserts need succulents.

Which *specific* subtype wins within an archetype is left to evolution. Don't over-constrain — surprising results are fine as long as they're ecologically plausible.

## Scoreboard

```bash
npx tsx scripts/balance-tuning/target-score.ts        # overall score + per-gate breakdown
npx tsx scripts/balance-tuning/balance-matrix.ts       # top-5 per niche with modifiers
npx tsx scripts/balance-tuning/fitness-landscape.ts    # subtype stability (evolutionary attractors)
```

Run `target-score.ts` after every change.

## What You Can Change

You are empowered to make smart architectural calls when the data justifies them. The constraint is not "only change coefficients" — it's "stay within CLAUDE.md principles."

**Fair game:**
- Coefficient values, new rows, interaction terms, peaked traits in `src/simulation/trait-effects.ts`
- Layer 1 terrain/climate base values and new environment variables
- Subtype classifier weights in `src/types/subtypes.ts`
- SIM constants in `src/types/core.ts`
- Scoring methodology in `scripts/balance-tuning/target-score.ts` (if it's measuring the wrong thing)
- Genome selection strategy (if mean-based selection is the bottleneck, fix it)
- New trait engine mechanisms (quadratic terms, saturation curves) — as long as they're data-driven table entries, not hardcoded branches

**Red lines (from CLAUDE.md — never cross these):**
- Never add `if (terrain === X)` or `if (climate === Y)` in plant logic
- Never add archetype-specific germination blocks
- Never add subtype-specific bonuses (all differentiation flows through continuous env vars × genome traits)
- All niche differentiation must flow through the trait×envVar table

If you're unsure whether a change crosses a red line, ask: "Could this be expressed as a table row?" If yes, it's fine.

## Mandatory: Spawn an Architect Before You Start

**Before writing any code**, spawn a subagent with this prompt:

> You are the Architect. Your job is to be the creative, holistic thinker. Read these files: `RALPH-PROGRESS.md`, `target-matrix.md`, `CLAUDE.md`, `src/simulation/trait-effects.ts`, `src/types/subtypes.ts`. Then read the current `target-score.ts` output. Step back and think: what is the REAL problem? What approaches have been tried and failed? What hasn't been tried? Are we stuck in a local optimum of thinking? Write a strategic recommendation (max 1 page) — not coefficient values, but the high-level approach you'd take. Be bold. Question assumptions. Think from first principles.

**Do this every iteration**, before you write any code. The Architect sees what you can't when you're deep in coefficient math.

## Journal

Append to `RALPH-PROGRESS.md` before and after each iteration:
```
## Iteration N
### Hypothesis — What I think the problem is
### Changes — What I did
### Results — target-score.ts output
### Assessment — Did it work? What next?
```

Commit after each improvement.

## Completion

When `target-score.ts` shows:
- Exclusion gate: 100% (zero violations)
- Archetype gate: ≥90%
- Overall: ≥95%

<promise>RALPH_COMPLETE</promise>
