# Task 2 report — safe center-preserving rotation

## Scope

Implemented Task 2 from `task-2-brief.md` on reviewed Task 1 baseline `859667f`.

- Added `rotatedInstanceCandidate(inst,item)`, which toggles orientation while preserving the footprint center and rounds only to 1/1200 ft (0.01 inch).
- Added `setLayoutActionStatus()` and `rotateLayoutInstance90(instId)` with the required not-found, hard-invalid, soft-conflict, and valid result contracts.
- Replaced the delegated and SVG rotation toggles with the shared command. The SVG pointer path prevents default behavior and propagation before rotating.
- Kept hard conflicts non-mutating, retained soft clearance conflicts as red invalid states, and issued exactly one render for every command outcome.

## Tests

- Candidate center preservation for the X16-style 5.825 x 3.175 ft footprint.
- Four successive candidates return within 0.01 inch and restore orientation.
- Command contracts, transient status tone/message, hard no-mutation, soft invalid state, and one render per path.
- Both delegated-click and SVG-pointer rotation paths use the guarded command. The SVG test was mutation-checked: it failed when the pointer guard was temporarily removed and passed after restoration.

## Browser evidence

- Fresh pre-change UI check reproduced the defect: rotating a non-square selected item left its X/Y origin unchanged, shifting its center.
- Fresh logic-runner RED recorded the missing candidate/command APIs before production edits.
- Fresh post-change logic runner completed with `data-complete="true"`, `data-failures="0"`, `All tests passed.`, and no warning/error console entries.

## Verification

- `node --check app.js`
- `node --check events.js`
- `node --check tests/rotation.test.js`
- `git diff --check`

All commands succeeded. No later-task toolbar, keyboard, CSS, cache, or persistence work was added.
