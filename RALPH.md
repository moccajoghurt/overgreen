# Ralph Loop: Reach the Target Matrix

**You are in an iterative loop.** Check `RALPH-PROGRESS.md` and recent git history before starting. Build on previous work.

## Mission

Make the trait engine in `src/simulation/trait-effects.ts` produce fitness rankings that match `target-matrix.md`. 16 niches × 40 subtypes, each classified as Dominant/Common/Minor/Absent.

## Mandatory: Spawn an Architect Before You Start

**Before writing any code**, spawn a subagent with this prompt:

> You are the Architect. Your job is to be the creative, holistic thinker. Read these files: `RALPH-PROGRESS.md`, `target-matrix.md`, `CLAUDE.md`, `src/simulation/trait-effects.ts`, `src/types/subtypes.ts`. Then read the current `target-score.ts` output. Step back and think: what is the REAL problem? What approaches have been tried and failed? What hasn't been tried? Are we stuck in a local optimum of thinking? Write a strategic recommendation (max 1 page) — not coefficient values, but the high-level approach you'd take. Be bold. Question assumptions. Think from first principles.

**Do this every iteration**, before you write any code. The Architect sees what you can't when you're deep in coefficient math.

## Scoreboard

```bash
npx tsx scripts/balance-tuning/target-score.ts        # overall score + per-gate breakdown
npx tsx scripts/balance-tuning/balance-matrix.ts       # top-5 per niche with modifiers
npx tsx scripts/balance-tuning/fitness-landscape.ts    # subtype stability (evolutionary attractors)
```

Run `target-score.ts` after every change. Current baseline: **~69% overall, dominant gate ~24%**.

## What You Can Change

Anything in `src/simulation/trait-effects.ts`:
- Coefficient values on existing rows
- Add new rows (trait × envVar combinations, interactions)
- Adjust Layer 1 terrain/climate base values
- Add new environment variables if needed

Also allowed:
- Subtype classifier weights in `src/types/subtypes.ts` (if classifier and trait engine are misaligned)
- SIM constants in `src/types/core.ts` (if sim dynamics override trait predictions)

Read `CLAUDE.md` for architecture rules. Never add `if (terrain === X)` branches.

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

When `target-score.ts` shows >85% overall with no gate below 70%:
<promise>RALPH_COMPLETE</promise>
