## Goal

Achieve the 16-niche target matrix (4 terrains × 4 climates) where each niche produces its realistic full spectrum of coexisting plant subtypes (see target-matrix.md).

## Approach

Each iteration follows this flow:

1. **Matrix A** — List all mechanics required for the target diversity (from ecology theory).
2. **Matrix B** — Catalog every mechanic the sim currently has, with status: working / broken / too weak / free fitness.
3. **Gap analysis** — Compare A vs B. Categorize gaps as Blocking / Important / Nice-to-have based on how many independent coexistence axes they add.
4. **Expert review** — Send both matrices + gap to two subagent domain experts (ecologist + simulation theorist). They challenge priorities, identify omissions, and correct design errors.
5. **Update & implement** — Synthesize expert feedback, update the gap, implement the top-priority fixes.
6. **Run experiments** — Run validation experiments, compare results against target-matrix.md.
7. **Repeat** — Feed results back into step 2 (Matrix B now reflects the updated sim) and iterate.

Don't be afraid to add or remove systems.
Use the following experiments to prove your changes worked.

## Validation Experiments

All 16 terrain×climate niches covered by 5 experiments, each 80×80 with 35×35 pockets (1,225 cells). Run at 5,000 ticks (snapshot every 500) during tuning iterations. Final validation at 10,000 ticks to confirm long-term stability.
You are allowed to tweak tick duration to your liking for faster results or more reliable results.

| Experiment                              | Climate       | Niches                        |
| --------------------------------------- | ------------- | ----------------------------- |
| `experiment-terrain-quad`               | Temperate     | Soil/Hill/Wetland/Arid × Temp |
| `experiment-terrain-quad-tropical`      | Tropical      | Soil/Hill/Wetland/Arid × Trop |
| `experiment-terrain-quad-mediterranean` | Mediterranean | Soil/Hill/Wetland/Arid × Med  |
| `experiment-terrain-quad-desert`        | Desert        | Soil/Hill/Wetland/Arid × Des  |

20 pockets total, 16 unique niches. The 4 overlapping Soil× niches cross-validate between terrain and zone quads. For each pocket, compare dominant/common/minor subtypes against target-matrix.md targets. Success = every pocket's dominant subtypes match the target matrix and at least 8 subtypes coexist per niche (Shannon H ≥ 2.5).

Reiterate the process (Matrix A, B, gap, expert review, implementation) until the experiments confirm the target's realistic full spectrum.
