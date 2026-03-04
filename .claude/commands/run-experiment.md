Run a headless simulation experiment using the CLI runner and analyze the results.

$ARGUMENTS should be a scenario id (e.g., "experiment-monoculture") optionally followed by flags. If empty, use `--list` to show available scenarios and ask which one to run.

## Steps

1. Run the experiment, saving JSON to a temp file:
```bash
npx tsx scripts/run-experiment.ts <scenario-id> [--ticks N] [--interval N] > experiment-result.json
```
Defaults: `--ticks 3000`, `--interval 250`

2. Summarize the result using the diagnostic summarizer:
```bash
node scripts/summarize-diagnostic.cjs experiment-result.json
```

3. Read the summarizer output and analyze:
   - **Population dynamics**: seasonal cycles, carrying capacity, boom/bust patterns
   - **Evolution**: which species won and why (genome traits vs terrain fit), species loss rate
   - **Resource pressure**: water stress, shading competition, seed success rates
   - **Potential simulation issues**: anything that looks like a bug (e.g. 100% shading, implausible energy values, extinction spirals)
   - **Trait evolution**: genome drift in top species across snapshots

4. Clean up:
```bash
rm experiment-result.json
```

Do NOT read the raw JSON file directly — always use the summarizer script.
