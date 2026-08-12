# Task 2 fix round 1 report — signature roller proportions

Baseline: `0b2a4ba` (`feat: add exact recovery and cardio models`)

## RED evidence

- Fresh browser logic runner: `http://127.0.0.1:4173/tests/planner-logic-runner.html?task2-fix1-red=1`
- Result: failed as expected before model edits. The new deterministic probe assertions reported: `X16 needs one tagged rear roller` and `GATOR needs four tagged elevated foam rollers`.

## Changes

- Added inert `signature` options captured by the focused fake probe; no renderer placement, collision, or orientation code changed.
- X16: tagged its true rear cylinder and increased its transverse length from `0.06H` (4.4 in) to `0.61W` (23.2 in), matching the `0.61W` belt and remaining within the rigid envelope.
- GATOR: tagged all four elevated head/back foam cylinders and increased each diameter from `0.11W` (2.9 in) to `0.15H` (8.0 in). Their existing local positions remain elevated (`0.68H`/`0.77H`) and at the local `-Z` head/back end (`-0.25D`/`-0.31D`).
- Added behavior-level assertions for X16 rear-roller count, cylinder identity, belt-width length, and rear placement; GATOR foam-roller count, cylinder identity, `0.14–0.17H` diameter, elevated height, and local back/head placement.

## GREEN evidence

- Fresh browser logic runner: `http://127.0.0.1:4173/tests/planner-logic-runner.html?task2-fix1-green=1` → `All tests passed.`
- Browser console: zero warnings/errors.
- The same full logic runner includes the rotated rigid-envelope assertions. Its green result confirms the corrected, rotated cylinders remain inside their measured envelopes.
- `node --check equipment-models.js` → exit 0.
- `node --check tests/equipment-profiles.test.js` → exit 0.
- `git diff --check 0b2a4ba` → exit 0.

## Scope

Changed only `equipment-models.js`, the focused equipment-model probe test, and this report. No placement, collision, fallback, or orientation behavior changed.
