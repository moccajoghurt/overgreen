## Dead Ends

| Approach                                      | Result                      | Why It Failed                                                          |
| --------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| JC coefficient 4.0 (up from 3.0)              | Hill H dropped to 2.32      | Too aggressive, kills species not just dominance                       |
| Facilitation 30% (up from 25%)                | Hill H dropped to 2.10      | Overpowers certain archetype combos, reduces species                   |
| Tree germination block on Hill                | Hill H=2.46, down from 2.69 | Removes entire archetype worth of diversity                            |
| Linear height penalty (not quadratic)         | Trees evolve short to dodge | Magnolia at woodiness 0.71 stays short, penalty ineffective            |
| Shade tolerance on Arid (full strength)       | Wildflower dominates Arid   | Forbs thrive everywhere regardless of terrain                          |
| HILL_MAINT_HEIGHT_MULT=2.5 (too high)         | Hill H=2.46                 | Kills shrubs along with trees                                          |
| HILL_MAINT_ROOT_MULT=4.0 (original)           | No shrubs on Hill           | Only grass+forb survive, too few archetypes                            |
| Global leaf efficiency bonus (not shade-only) | Hill=100% forbs             | Leaf bonus in full sun makes forbs dominate open terrain               |
| Shade tolerance using genome heightPriority   | Trees also got bonus        | Trees have moderate heightPriority (~0.45), got unintended shade bonus |
| Facilitation counting own archetype           | Trees among trees got bonus | Self-reinforcing monoculture                                           |

## Tools

- **Run experiment**: `npx tsx scripts/run-experiment.ts <scenario> --ticks 12000 --interval 500 --out file.json`
- **Check all 16 niches**: `node scripts/check-all-niches.cjs` (reads exp-temperate.json, exp-tropical.json, exp-med.json, exp-desert.json)
