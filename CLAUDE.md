# Overgreen — Claude Code Instructions

## Development

- Vite dev server handles incremental compilation — do NOT run `npx tsc --noEmit` or `npx vite build` for routine checks. Both are slow and unnecessary during development. The dev server surfaces errors on its own. Only use these when absolutely necessary (e.g. major refactors touching many files, or verifying a production build before deploy).
