# Final review fix round 1 report — preserve rotation control focus

## Scope

Fixed both Important findings from `final-review.md` on baseline `dad3fd5`.

- The Plan/Split toolbar and inspector Rotate buttons now carry distinct semantic `data-focus-key` values. Focus capture prefers that unique identity, so each native button regains focus after its own render.
- SVG quick-rotate no longer invokes the command during `pointerdown`. The existing delegated click route is now the single pointer activation path, while the SVG keydown path remains responsible for Enter and Space.
- Advanced the logic-runner cache keys for changed app, layout, events, and rotation-test assets. Updated the production cache chain only for changed classic scripts and its runtime parent.

## TDD evidence

### RED

Fresh browser logic runner at `http://127.0.0.1:4173/tests/planner-logic-runner.html?rotation-final-fix-1-red-3` completed with five focused failures and no console logs:

- SVG pointerdown-to-click sequence expected one rotated result but received the original orientation, exposing the double command.
- Plan/Split and inspector markup lacked distinct focus identities.
- Toolbar focus restoration resolved to the inspector control.

An independent controller captured the same strict RED result: `complete=true`, `failures=5`, `logs=[]`.

### GREEN

Fresh browser logic runner at `?rotation-final-fix-1-final` reported `All tests passed.` with no warnings or errors.

New coverage exercises a complete SVG `pointerdown` then bubbling `click` sequence and asserts one render plus one 90-degree result. It also renders the real duplicate Plan/Split and inspector buttons, verifies distinct keys, and verifies focus restoration for both controls.

## Normal-app verification

- Plan toolbar pointer activation rotated a valid selected RX3 item from `4 × 2.667 ft` to `2.667 × 4 ft`, showed success feedback, and restored focus to `plan-toolbar-rotate:<id>`.
- Inspector pointer activation returned it to `4 × 2.667 ft`, showed success feedback, and restored focus to `inspector-rotate:<id>`.
- A real SVG click rotated the selected item once to `2.667 × 4 ft` with the success status still visible.
- SVG Enter and the `R` shortcut each rotated once in the normal app.
- The normal app had no console warnings or errors. The runtime-cache runner passed; its hidden iframe emitted the known environment-only `MutationObserver.observe` message, while the normal app remained clean.

## Final checks

- Logic runner: passed.
- Runtime-cache runner: passed.
- Syntax checks: `app.js`, `events.js`, `layout.js`, `render.js`, `view3d.js`, `tests/rotation.test.js`, and module-mode `gltf-runtime.js`.
- `git diff --check`: passed.
