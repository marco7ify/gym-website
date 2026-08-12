# Final fix report — GATOR, Echo, and Walkthrough editing

Date: 2026-08-12

Baseline: `663d36464895b5f79f543f4b34ed52ad8241b6db`

Final-fix commit: the amended `fix: close GATOR Echo walkthrough review findings` commit returned with delivery (`git show --format=%H`).

Scope: every Important and Minor item in `final-review-findings.md`; no finding parked.

## Finding → fix → covering test

| # | Finding | Fix | Covering regression |
|---|---|---|---|
| 1 | Signed-coordinate corruption | `splitTotalFtToFtIn()` now encodes negative fractions as floor-feet plus positive inches. Walkthrough nudging builds the exact signed ft/in candidate first and uses that same object for effective rectangles, hard-conflict validation, and commit. Vertical movement preserves the signed X representation. | `coarse movement preserves signed extension coordinates on either axis`; `Fine movement validates and commits the same signed candidate` in `tests/walkthrough-editing.test.js`. Rendered app QA moved a GATOR in a real left extension from X `-3′0″` to `-3′6″` coarse and `-3′5″` Fine, then changed Y while X stayed `-3′5″`. |
| 2 | Cross-layout Undo contamination and modal focus isolation | Undo snapshots include `activeLayoutId`; a different active layout clears/rejects the undo with `reason: "layout-changed"` without modifying that layout. Layout creation/duplication resets editor transients. Walkthrough is a native `<dialog>` opened with `showModal()`, receives initial focus, prevents background focus, and restores the launcher after Exit or Escape. | `Walkthrough undo cannot overwrite a different active layout`; `the Walkthrough uses a browser-modal dialog with isolated initial focus` in `tests/walkthrough-editing.test.js`. Normal-app QA observed the active element inside the dialog, Tab remaining inside, and launcher focus restored after both close paths. |
| 3 | GATOR pad discontinuity | Seat/back/head share one `-0.55` incline; endpoints are computed so the seat/back top-edge gap is two inches and back/head meet. All three supports terminate at their pad undersides. | `keeps the GATOR pads as one supported incline with a visible two-inch seat gap` in `tests/equipment-profiles.test.js`; real-Three assertions in `publishes the complete GATOR semantic mesh contract through real Three primitives`. Focused GATOR render visually confirms the connected incline and supports. |
| 4 | Echo fan plane and missing semantics | Both 12-spoke fans and six grille segments per face lie in the housing YZ planes. Added stable `echo-main-frame` and `echo-fan-grille` tags while reusing geometry/material resources. | `exposes the complete Echo Rower signature`; `keeps Echo spokes and grille coplanar with each per-side YZ fan face`; real-Three Echo semantic-contract test. Focused side/front render shows a readable circular fan and complete longitudinal frame. |
| 5 | Wall-run clamping, preview validity, and occlusion | Wall hits retain run start/end. Candidate creation clamps inside that exact run, normalizes and validates once, and preview uses the same candidate and world transform. Too-short/gap/exterior hits hide the preview and publish invalid. Wall picking raycasts visible equipment plus wall edit surfaces and only accepts a wall when it is the nearest hit. | `wall feature creation clamps to the exact clicked wall run`; `...rejects a clicked run shorter...`; `wall preview clamps and validates...`; `wall preview rejects...`; `keeps wall edit surfaces out of door, garage, and missing base-wall gaps`; `foreground equipment occludes wall edits until the wall is visible`. |
| 6 | No route back to wall-add tools | Selected equipment and wall-feature panels contain native, labelled “Back to wall tools” buttons. Blank Edit-mode clicks clear selection and render once. This keeps sequential wall addition in Walkthrough. | `selected equipment and wall features provide a path back to wall tools`; `blank Edit clicks clear selected equipment and return to wall placement`. Normal-app QA used the Back action and added Mirror, LED strip, then Wood slat panel without leaving Walkthrough. |
| 7 | Rotation feedback disconnected | Walkthrough rotation calls the shared rotation command without its render, copies the shared success/warning/error into editor status, commits undo only on acceptance, then renders once. The selected panel displays current `0°`/`90°` orientation. | Rotation success, soft-warning, and hard-rejection assertions in `rotation commits only validated candidates` and `rotation announces accepted clearance warnings in the Walkthrough live region`. Normal-app QA observed `Rotated Rogue Echo Rower 90°.` and `Orientation: 90°`, and separately a literal overlap rejection. |
| 8 | Echo feet float | Front and rear stabilizer box centers are one half-height above the local floor. | `grounds both Echo stabilizing feet rather than relying on its wheels`; real-Three min-Y assertions for both feet. |
| 9 | Garage real-Three runner stale assets | Garage runner now loads `app.js?v=87` and `view3d.js?v=43`; outer runner and all affected runtime/test assets received new cache URLs. | Runtime-cache regression `loads the garage real-Three runner against current app and view sources`, plus the final cache gate. |
| 10 | Directional accessible names omit active step | All four directional controls announce direction plus `6 inches` or `1 inch` from the live movement mode. | `directional movement names announce the current step size`. |

## Browser-observed RED → GREEN chronology

The RED observations below were taken before the production fix for each covered behavior. The model work was handled explicitly: the model agent first added tests only; the exact baseline production file was still present when both model RED pages were observed; production geometry was authorized only afterward.

- GATOR/Echo logic RED: `http://127.0.0.1:4193/tests/planner-logic-runner.html?final-fix-red=2` — GATOR endpoint/support assertions and Echo semantic/plane/floor assertions failed on baseline geometry.
- GATOR/Echo real-Three RED: `http://127.0.0.1:4193/tests/equipment-dispatch-3d-runner.html?final-fix-red=1` — the equivalent real-mesh geometry/semantic assertions failed.
- Walkthrough logic RED: the planner logic runner reported failures for negative signed parts, cross-layout undo, modal isolation, rotation live status/orientation, exact run handling, clear-selection path, and step-aware labels before their production changes.
- Wall real-Three RED: `http://127.0.0.1:4193/tests/wall-features-3d-runner.html?final-fix-red=1` — baseline preview lacked exact run-bound candidate behavior and exterior rejection.
- Cache RED 1: `http://127.0.0.1:4197/tests/runtime-cache-runner.html?final-fix-cache-red=1` — expectations were advanced before the first production/test URL transition.
- Cache RED 2: `http://127.0.0.1:4198/tests/runtime-cache-runner.html?final-fix-cache-red=2` — final inner test/runner URL expectations were advanced before those URLs.

Focused GREEN pages after implementation:

- Planner: `http://127.0.0.1:4197/tests/planner-logic-runner.html?final-fix-green=4` — all tests passed.
- Cache: `http://127.0.0.1:4198/tests/runtime-cache-runner.html?final-fix-cache-green=2` — all tests passed.
- Wall real-Three: `http://127.0.0.1:4198/tests/wall-features-3d-runner.html?final-fix-green=2` — all tests passed.
- Equipment real-Three: `http://127.0.0.1:4198/tests/equipment-dispatch-3d-runner.html?final-fix-green=3` — all tests passed.
- Garage real-Three: `http://127.0.0.1:4198/tests/garage-door-3d-runner.html?final-fix-green=1` — all tests passed.

## Rendered acceptance

Normal app URL used for the main visual session: `http://127.0.0.1:4198/index.html?final-fix-normal-app-qa=2`.

- `final-fix-gator-render.jpg`: focused real Three GATOR view; coherent inclined seat/back/head train, visible small seat gap, connected supports, full grounded assembly.
- `final-fix-echo-render.jpg`: focused Echo side/front view; two-sided radial fan reads as a circle rather than collapsing, with main frame, rail, seat, and grounded stabilizers visible.
- `final-fix-walkthrough-edit.jpg`: native Edit dialog with selected Echo, orientation row, 6-inch directional controls, Back action, and literal hard-conflict rotation status.
- `final-fix-rotation-success.jpg`: rendered accepted Echo rotation with `Orientation: 90°` and `Rotated Rogue Echo Rower 90°.` in the live region.
- `final-fix-wall-tools.jpg`: third of three same-session wall additions selected after Mirror → LED strip → Wood slat panel, using Back between adds.
- `final-fix-signed-extension.jpg`: GATOR selected in a left extension at signed X `-3′5″`, Fine mode active; changing Y to `1′1″` left X unchanged.
- Modal checks: opening left focus inside the native dialog; an attempted Tab stayed inside; underlying layout controls did not accept focus; Exit and Escape each restored the `Enter walkthrough` launcher.
- Wall preview occlusion was exercised in the browser real-Three equipment gate: the foreground equipment hit returned no wall target, then the same ray after removing the blocker resolved the exact wall hit. Exact near-edge/too-short/gap preview state was exercised in the browser wall real-Three gate.

These JPGs are ignored local SDD evidence files beside this report, not production assets.

## Preservation and resource contracts

- Saved GATOR record remains 26×58×53 inches. The real-Three suite byte-compares all three saved GATOR placement sources before/after rendering and asserts their canonical/world footprints, centers, rotations, and validity.
- Saved Echo remains 26×99 inches with 16-inch canonical seat height; visual height remains separate. The same suite byte-compares the saved item before/after rendering.
- GATOR stays within the approved 58 meshes / 6 materials / 26 geometries.
- Echo stays within the approved 72 meshes / 8 materials / 30 geometries.
- Stable semantic tags and one-click-target-per-mesh/dispose-once lifecycle contracts pass across two full real-Three lifecycles.

## Final gates

Fresh final sweep (all observed in the browser; every page had an empty console log):

1. Runtime cache — `http://127.0.0.1:4201/tests/runtime-cache-runner.html?final-gate=20260812-3-fresh-origin` — **All tests passed.**
2. Planner logic — `http://127.0.0.1:4201/tests/planner-logic-runner.html?final-gate=20260812-3-fresh-origin` — `data-complete=true`, `data-failures=0`, **All tests passed.**
3. Equipment real-Three — `http://127.0.0.1:4198/tests/equipment-dispatch-3d-runner.html?final-gate=20260812-6-settled` — **All tests passed.**
4. Wall real-Three — `http://127.0.0.1:4198/tests/wall-features-3d-runner.html?final-gate=20260812-fast-poll` — **All tests passed.**
5. Garage real-Three — `http://127.0.0.1:4198/tests/garage-door-3d-runner.html?final-gate=20260812-7-settled` — **All tests passed.**
6. Normal app — main visual session and signed-extension/rotation follow-up both returned `[]` from the browser console log.

Static final checks:

- `node --check` for every changed JavaScript file — exit 0.
- `git diff --check` — exit 0.

## Commit and concerns

Commit: the amended `fix: close GATOR Echo walkthrough review findings` commit returned with delivery; the report is part of that commit.

Concerns: none known in the implemented scope. Browser controller reads can time out while the synchronous real-Three runners own the page main thread; the final results above were read after each runner settled and are page-observed results, not inferred from the timeout. The focused app QA intentionally modified only its browser-local test data; no saved fixture/source record changed.
