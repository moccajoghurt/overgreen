# Black Ghost Shapes Bug

## Symptom

Dark/black plant-shaped silhouettes (typically palms) appear on terrain where no plants exist, especially on rocks. First observed when shadow map throttling was introduced in fast mode.

## Timeline

1. Shadow throttle added (`world.tick % 30` + skip count-change check when `tickDelta > 1`)
2. Black ghost shapes appeared
3. Commit f311645 attempted a fix: added `addUpdateRange()` for dying/burning instances so GPU receives their data when partial uploads are active
4. Shapes went away (or became less frequent)
5. Performance improvements increased fast-mode throughput — shapes reappeared

## Two Possible Causes

### Theory A: Stale Shadow Map (most likely)

When `shadowMap.needsUpdate = false`, THREE.js reuses the last rendered shadow map. In fast mode, shadows only re-render every 30 ticks. During those 30 ticks:

- Plants die — their instance slots get swap-removed and reused for other plants
- The shadow map still projects shadows from the OLD plant positions
- These stale shadows appear as dark plant silhouettes on terrain
- Especially visible on rocks, where no real plants exist to mask the artifact

This explains why the bug correlates with shadow throttling, and why it got worse when our perf improvements made fast mode run more ticks per frame (more births/deaths between shadow updates = more stale shadows).

**Additional wrinkle:** in fast mode, the `% 30` check can be missed entirely. If `world.tick` jumps from e.g. 28 to 35 in one frame, `tick % 30 === 0` never fires. The shadow map stays frozen until the next hit, which could be 60+ ticks away. Fix: use `world.tick % 30 < tickDelta` instead of `world.tick % 30 === 0`.

### Theory B: Uninitialized GPU Instance Data (less likely now)

If `mesh.count` includes indices whose GPU buffers were never uploaded, those instances render with zero/stale data (black, wrong position). This was the f311645 bug — dying/burning instances written to CPU arrays but not covered by `addUpdateRange()`, so THREE.js partial upload mode skipped them.

This fix is still in place. The current code explicitly adds update ranges for the dying/burning region (indices `liveCount` through `count-1`) in both `incrementalUpdate` and `animationOnlyUpdate`. Reviewed the full data pipeline (swap-remove on death, birth append, dirty write loop) and all paths produce correct `addUpdateRange` calls.

## Suggested Fix

For Theory A, change the shadow throttle condition from:

```typescript
let shadowDirty = isFirstFrame || world.tick % 30 === 0;
```

to:

```typescript
let shadowDirty = isFirstFrame || world.tick % 30 < tickDelta;
```

This ensures the scheduled update is never skipped when ticks jump past the modulo boundary. If that's insufficient, reduce the interval (e.g. `% 15`) or add a count-change check that runs in fast mode too (the current `tickDelta <= 1` guard disables it entirely).
