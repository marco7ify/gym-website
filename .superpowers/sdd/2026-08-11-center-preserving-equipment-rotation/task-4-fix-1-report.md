# Task 4 fix round 1 report — staging rotation boundaries

## Scope

Addressed both findings from `task-4-review.md` on baseline `93bfc66`:

- Added command-level staging rotation coverage for a contained staging rotation and a staging-boundary rejection.
- Advanced the runtime-cache test query and used a fresh iframe URL for cache-contract evidence.

## TDD evidence

1. Added the two staging command assertions before production edits and ran the logic runner at `rotation-staging-red-1`.
2. The fresh browser RED showed the temporary test-only coverage marker was absent and, more importantly, exposed the real boundary defect: the candidate crossing the room-to-staging gap was reported inside the room.
3. Replaced `rectInsideRoom()` point sampling with complete rectangle coverage across the valid room/staging union. This retains valid contiguous layouts while rejecting any uncovered gap.
4. Ran the fresh logic runner at `rotation-staging-green-1`: `All tests passed.` with `data-failures="0"`.
5. Updated the cache-contract test first. Its fresh browser RED expected `gltf-runtime.js?v=24` and `app.js?v=79` but observed the prior `v=23` and `v=78` values.
6. Bumped only `app.js` in `gltf-runtime.js` and the runtime module entry in `index.html`, then advanced the cache-test script query and the iframe URL. The fresh cache runner at `rotation-staging-cache-green-2` reported `All tests passed.` with `data-failures="0"`.

## Behavior covered

- A 4 × 2 ft non-square item fully within the staging strip rotates, stays fully within staging, renders once, and preserves its center within `1/1200 ft`.
- A staging-edge rotation that would bridge the 0.75 ft room/staging gap returns `{ok:false,reason:"hard-invalid"}`, reports the existing `outside-room` conflict, leaves the instance byte-for-byte unchanged, records the error status, and renders once.

## QA record

Updated `design-qa.md` to distinguish the successful in-staging command from the rejected staging-boundary command.

## Verification

- Fresh browser logic runner: `All tests passed.` / `0` failures.
- Fresh browser runtime-cache runner: `All tests passed.` / `0` failures.
- `node --check app.js`
- `node --check tests/rotation.test.js`
- `node --input-type=module --check < gltf-runtime.js`
- `git diff --check`

## Self-review

- The staging fixture uses literal room/staging geometry and exercises the real rotation command, not a mocked command result.
- The full-rectangle check catches the observed gap-spanning mutation: returning to point-only validation makes the boundary command test fail.
- Cache versions changed only for the modified `app.js` classic script and the modified runtime module entry; `layout.js` and `events.js` versions remain unchanged.
