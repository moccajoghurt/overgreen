# Ralph Loop

**You are in a loop.** Read `RALPH-PROGRESS.md` (create if missing) and recent git history first.

## Mission

Make `target-score.ts` pass. Two gates:

1. **Exclusion (60%):** Excluded subtypes must not appear in a niche's top-5.
2. **Archetype (40%):** Each niche's listed archetypes need ≥1 competitive subtype in top-5.

Done when: exclusion 100%, archetype ≥90%, overall ≥95%.

## Score

```bash
npx tsx scripts/balance-tuning/target-score.ts
```

Run after every change.

## Scope

You can change anything in the engine as long as CLAUDE.md principles hold. The test: "Could this be expressed as a table row?" If yes, it's fine.

Key files: `src/simulation/trait-effects.ts`, `src/types/subtypes.ts`, `src/types/core.ts`, `target-matrix.md`.

**Never:** `if (terrain === X)` branches, archetype-specific germination blocks, subtype-specific bonuses.

## Process

1. **Architect first.** Before coding, spawn a subagent to read `RALPH-PROGRESS.md`, `target-matrix.md`, `CLAUDE.md`, `src/simulation/trait-effects.ts`, `src/types/subtypes.ts`, and the current score. It should think strategically about what to try next — not coefficients, but approach.

2. **Journal.** Append to `RALPH-PROGRESS.md`:
```
## Iteration N
### Hypothesis
### Changes
### Results
### Assessment
```

3. **Commit** after each improvement.

<promise>RALPH_COMPLETE</promise>
