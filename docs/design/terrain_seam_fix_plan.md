# Terrain seam fix plan — ValeCoast / FrostTerraces `it.fails`

This document scopes the real fix for the two `it.fails` in
`tests/terrain_window_seams.test.ts` (the `applyValeCoast` strait/border
seams and the `applyFrostTerraces` band/corridor seams). It is the
handoff for a dedicated world-geometry task. **Do not blindly apply a
global shore grade** — see "What does NOT work" below; a blanket pass
was measured to make the cliffs *worse*.

## Root cause (measured)

`WATER_LEVEL = -4.3` (`src/sim/world.ts:83`). The ridden surface is
`max(groundHeight, waterLevelAt)`. `waterLevelAt` (`world.ts:167`) returns
`waterLevel()` inside open sea and `-Infinity` outside. `isOpenSeaAt`
(`world.ts:128`) decides sea-ness from a **hard** per-1yd-cell threshold
`terrainHeightSansEdits(cx+0.5, cz+0.5, seed) < waterLevel()`.

Where that contour cuts a coast, the **dry lip** sits just below
`waterLevel` (e.g. `groundHeight ≈ -4.74`) while the **wet side** reads the
water plane (`-4.3`). The ridden surface therefore steps:

- **ValeCoast** — Farshore strait at `x = 178, z = 148`: measured
  ridden step **0.44yd** (test `MAX_STEP = 0.35`).
- **FrostTerraces** — Frostveil at `z = 1924, x = 102`: measured ridden
  step **0.69yd**.

The coast/terrace appliers themselves are smooth across these lines; the
cliff is the **open-sea contour**, not an applier hard-edge. This is the
same seam class already fixed for `applyStripFlankCoast` and `greenSeamT`,
but at a **water-body boundary** rather than an applier window.

## What does NOT work

A blanket open-sea `gradeShoreBand` pass (mirroring `applyLakeShoreGrading`
with a "near open sea" weight from `isOpenSeaAt` neighbour probes)
**regresses**: measured VALE max step went from 0.44 → **1.591** at
`z = 150`, and FROST only improved to 0.58. The natural coast slope is
carefully tuned; a global grade reshapes it and creates worse cliffs
elsewhere. (Implementation note: that attempt also hit infinite recursion
— `isOpenSeaAt` re-enters `terrainHeightUnpadded` via
`terrainHeightSansEdits`; any future attempt must guard that re-entry.)

## Proposed fix (per-coast tuning)

The correct approach is to grade the **specific carve sites** that drop the
dry lip below the waterline, so the seabed meets `waterLevel` gradually at
those contours — the same "skirt" idiom the already-fixed appliers use:

1. **Farshore strait (`applyStarterMoat`, `world.ts:1714`)** — the border
   strait carve at `x ∈ [177,196]` drops the seabed to `WATER_LEVEL - 5`
   and releases north of `z = 158`. At `z = 148` the dry lip (where
   `isOpenSeaAt` flips false) is left at `-4.74`. Add a graded shore that
   lifts the carved seabed to `WATER_LEVEL` across a narrow band at the
   north fade edge (`z ∈ [148, 158]`), releasing to zero by `z = 158`, so
   the dry lip meets the water plane. Keep the deep barrier water intact
   for `z < 148`.
2. **Frostveil (`applyFrostTerraces`, `world.ts:2815`, and the Frostveil
   coast carver)** — at `z = 1924` (and the band/corridor edges
   `z = 1460/1856`, `x = ±92/±178`) the open-sea contour cuts the
   terraced benches. Add a graded shore at those contours so the dry lip
   ramps to `waterLevel`.
3. **Validation gate (mandatory before merge):**
   - `WOC_SKIP_PRETEST=1 npx vitest run tests/terrain_window_seams.test.ts`
     — promote the two `it.fails` to real `it` only once green.
   - `WOC_SKIP_PRETEST=1 npx vitest run tests/world_grid.test.ts`
   - `WOC_SKIP_PRETEST=1 npx vitest run tests/border_ridge_skirt.test.ts`
   - Full parity: `UPDATE_PARITY=1 npx vitest run tests/parity` (or the
     `gate_select` bar) — any seed-pinned terrain change must keep the
     golden trace green.

## Acceptance

- Both `it.fails` promoted to `it` and passing.
- `world_grid`, `border_ridge_skirt`, and `parity` all green (no seed
  regression).
- No other `tests/terrain_window_seams.test.ts` line newly fails.

## Related

- PR #14 documents this root cause inline in the test file.
- `applyLakeShoreGrading` (`world.ts:3827`) + `gradeShoreBand`
  (`world.ts:3818`) are the proven graded-shore primitives to reuse.
