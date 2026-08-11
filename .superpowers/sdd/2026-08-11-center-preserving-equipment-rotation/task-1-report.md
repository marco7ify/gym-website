# Task 1 report — structured placement conflicts

## Scope

Implemented Task 1 from `task-1-brief.md` on baseline `befdcf5c5b916ee5010e701a3d6658eab9aef369`.

- Added `hardPlacementConflict(instId, baseRect)` with structured, first-conflict records for outside-room, reserved-area body, door clearance, and equipment-body overlap.
- Kept `isHardInvalidPlacement(instId, baseRect)` as the existing boolean interface by delegating to the structured resolver.
- Added `state.layoutActionStatus = null` only to transient application state; no persisted layout, normalization, duplication, or export schema changed.
- Added deterministic browser logic tests and loaded them before `GymTests.finish()`.

## Preserved placement semantics

- Conflict priority remains outside room, fully-contained staging exemption, configured areas in layout order, then equipment in layout order.
- Reserved-area body remains ahead of the same area's door-clearance check.
- `reservedAreaKindsBlockPlacement` continues to gate both area-body and door-clearance conflicts, including the intentional empty-array exemption.
- Equipment hard conflicts compare body rectangles only; clearance/deadspace overlap remains soft.
- Missing equipment items remain ignored, the target instance remains excluded, and strict edge-touch behavior remains unchanged.
- Existing drag release code still consumes the unchanged boolean wrapper.

## TDD evidence

### RED

Controller browser checkpoint:

- URL: `http://127.0.0.1:4173/tests/planner-logic-runner.html?task1-red=1`
- `data-complete="true"`
- `data-failures="8"`
- Seven conflict/resolver tests failed because `hardPlacementConflict` was undefined.
- The transient-state test failed with `Expected null, received undefined`.
- Existing wall-feature tests remained green; console logs were empty.

### GREEN

Controller browser checkpoint:

- URL: `http://127.0.0.1:4173/tests/planner-logic-runner.html?task1-green=1`
- `data-complete="true"`
- `data-failures="0"`
- Result text: `All tests passed.`
- Console warning/error output: none.

## Verification

- `node --check app.js`
- `node --check tests/rotation.test.js`
- `git diff --check`

All commands exited successfully before staging. No rotation command, UI control, production cache key, or package dependency was changed.
