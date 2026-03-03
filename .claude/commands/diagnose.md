Analyze the latest overgreen diagnostic file.

Steps:
1. Run `node scripts/summarize-diagnostic.cjs $ARGUMENTS` to get the pre-processed summary. If $ARGUMENTS is empty, the script auto-finds the most recent `overgreen-diagnostic-*.json` in the project root.
2. Read the script output — it contains the full timeline, species evolution, death causes, and auto-detected patterns.
3. Provide analysis covering:
   - **Population dynamics**: seasonal cycles, carrying capacity, boom/bust patterns
   - **Evolution**: which species won and why (genome traits vs terrain fit), species loss rate
   - **Resource pressure**: water stress, shading competition, seed success rates
   - **Potential simulation issues**: anything that looks like a bug (e.g. 100% shading, implausible energy values, extinction spirals)
   - **Tuning suggestions**: if asked, recommend SIM constant changes based on the data

Do NOT read the raw JSON file directly — always use the summarizer script.
