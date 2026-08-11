# Center-Preserving Equipment Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give selected equipment an obvious Rotate 90° control and `R` shortcut that preserve the item center, reject hard conflicts, and retain soft-clearance warnings consistently across Plan and 3D.

**Architecture:** Extend the existing placement domain with a structured hard-conflict resolver, then route every rotation entry point through one event-layer command. Keep transient action feedback outside persisted layouts, render two native controls plus the existing SVG affordance, and install a single guarded keyboard listener at script load rather than during each render.

**Tech Stack:** Vanilla JavaScript/HTML/CSS, existing layout geometry helpers, dependency-free browser logic tests from the wall-feature plan, localStorage persistence through the existing render cycle, and browser accessibility/interaction verification.

## Global Constraints

- Execute this plan after `2026-08-11-wall-features-and-layout3-decoration.md`, which creates the shared test runner.
- Preserve the equipment center to within 0.01 inch; do not use grid snapping during rotation.
- A hard-invalid rotation changes no persisted instance field.
- A soft deadspace/clearance conflict commits the rotation with `__invalid:true` and the existing red warning.
- Staging keeps its current free-overlap semantics.
- Button, SVG glyph, inspector control, and `R` shortcut must call the same command.
- Ignore `R` while typing, dragging, using a dialog, using 3D-only mode, or using Walkthrough/pointer lock.
- Do not add an undo stack or change the existing autosave lifecycle.
- Add no package-manager dependency.
- Existing dirty worktree changes are user work; inspect and stage only task-owned hunks.

## File Structure

- Modify `app.js` — structured hard-conflict details, pure center-preserving candidate math, transient status state, and focus restoration for native buttons.
- Modify `events.js` — shared rotation command, all click routing, and singleton `R` shortcut.
- Modify `layout.js` — selected-item toolbar, inspector action, live status, and accessible SVG glyph.
- Modify `index.html` — toolbar, button, status, focus, and responsive styles.
- Modify `tests/planner-logic-runner.html` — load the rotation test file.
- Create `tests/rotation.test.js` — center math, hard/soft validation, and command-result assertions.
- Modify `gltf-runtime.js` — bump only changed classic-script cache keys after verification.

---

### Task 1: Expose structured placement conflicts without changing drag behavior

**Files:**
- Modify: `app.js:1380-1439,2400-2463`
- Create: `tests/rotation.test.js`
- Modify: `tests/planner-logic-runner.html`

**Interfaces:**
- Consumes: `rectInsideRoom()`, `areaRect()`, `doorClearanceRect()`, `effectiveRectForInst()`, and the current placement settings.
- Produces: `hardPlacementConflict(instId, baseRect)` and unchanged boolean `isHardInvalidPlacement(instId, baseRect)`.

- [ ] **Step 1: Write failing conflict-detail tests**

Add the test script before `GymTests.finish()` and test exact result shapes:

```js
GymTests.test("reports outside-room hard conflict",()=>{
  const conflict=hardPlacementConflict("target",{x:-.1,y:1,w:2,h:2});
  GymTests.equal(conflict.kind,"outside-room");
});

GymTests.test("boolean hard validation delegates to conflict details",()=>{
  GymTests.equal(isHardInvalidPlacement("target",{x:-.1,y:1,w:2,h:2}),true);
});
```

Use isolated snapshots of `state.layout` and restore them after each test. Add cases for reserved-area body overlap, door-clearance overlap, equipment-body overlap, staging exemption, and a clean placement returning `null`.

- [ ] **Step 2: Run the test runner and verify the new function is missing**

Open `http://127.0.0.1:4173/tests/planner-logic-runner.html`. Expected: failures identify `hardPlacementConflict` as undefined while existing wall-feature tests remain green.

- [ ] **Step 3: Implement the structured resolver**

Add:

```js
function hardPlacementConflict(instId, baseRect){
  const r=room();
  if(!rectInsideRoom(baseRect)){
    return {kind:"outside-room",message:"Can’t rotate here — the equipment would extend outside the room."};
  }
  if(rectInsideRect(baseRect,r.staging||layoutStagingRect(r))) return null;
  // Run the same configured area, door-clearance, and equipment-body checks
  // currently present in isHardInvalidPlacement and return the named record.
  return null;
}

function isHardInvalidPlacement(instId,baseRect){
  return !!hardPlacementConflict(instId,baseRect);
}
```

Reserved-area records include `{kind:"reserved-area",areaId,message}`; door clearance uses `{kind:"door-clearance",areaId,message}`; equipment overlap uses `{kind:"equipment-overlap",instanceId,itemId,message}`. Use the area label or other equipment name in the message.

- [ ] **Step 4: Add transient action state**

Add `layoutActionStatus:null` beside the other non-persisted UI fields in `state`. Its only valid shape is:

```js
{instId, tone:"success"|"warning"|"error", message}
```

Do not add it to `DEFAULT_LAYOUT`, exports, or layout duplication.

- [ ] **Step 5: Run regression tests and syntax checks**

Require all logic tests to pass, then run:

```bash
node --check app.js
node --check tests/rotation.test.js
git diff --check
```

- [ ] **Step 6: Commit conflict diagnostics**

Stage only the conflict/status hunks and rotation test, inspect the cached diff, then commit:

```bash
git commit -m "refactor: expose layout placement conflicts"
```

---

### Task 2: Centralize rotation and preserve the center

**Files:**
- Modify: `app.js:2117-2157`
- Modify: `events.js:1-20,2082-2095,2540-2570`
- Modify: `tests/rotation.test.js`

**Interfaces:**
- Consumes: `instanceDims()`, total-coordinate helpers, `hardPlacementConflict()`, `effectiveRectForInst()`, and `isInvalidPlacement()`.
- Produces: `rotatedInstanceCandidate(inst,item)`, `setLayoutActionStatus()`, and `rotateLayoutInstance90(instId)`.

- [ ] **Step 1: Write failing center-preservation tests**

Test a 5.825×3.175-ft rotated X16-style footprint at x=6.5, y=0:

```js
GymTests.test("rotation candidate preserves center",()=>{
  const item={unit:"ft",length:5.825,width:3.175,height:6.1083};
  const inst={id:"x16",itemId:"x16-item",xFt:6.5,xIn:0,yFt:0,yIn:0,rotated:true};
  const before=instanceDims(inst,item);
  const next=rotatedInstanceCandidate(inst,item);
  const after=instanceDims(next,item);
  GymTests.closeTo(instXTotalFt(inst)+before.w/2,instXTotalFt(next)+after.w/2,1/1200);
  GymTests.closeTo(instYTotalFt(inst)+before.h/2,instYTotalFt(next)+after.h/2,1/1200);
});
```

Rotate a candidate four times and assert its coordinates and orientation return to the original within 0.01 inch.

- [ ] **Step 2: Implement pure candidate math**

Add:

```js
function rotatedInstanceCandidate(inst,item){
  const oldDims=instanceDims(inst,item);
  const candidate={...inst,rotated:!inst.rotated};
  const newDims=instanceDims(candidate,item);
  const x=instXTotalFt(inst)+(oldDims.w-newDims.w)/2;
  const y=instYTotalFt(inst)+(oldDims.h-newDims.h)/2;
  const clean=n=>Math.round(n*1200)/1200;
  return {...candidate,xFt:clean(x),xIn:0,yFt:clean(y),yIn:0};
}
```

The 1/1200-ft precision is 0.01 inch and removes only floating-point noise.

- [ ] **Step 3: Write failing command tests for hard and soft outcomes**

Create fixtures and assert these exact return contracts:

```js
{ok:false,reason:"not-found"}
{ok:false,reason:"hard-invalid",conflict}
{ok:true,reason:"soft-conflict",instance}
{ok:true,reason:"rotated",instance}
```

Before invoking the command in the logic runner, install `window.render=()=>{ window.__rotationRenderCount=(window.__rotationRenderCount||0)+1; };`. For hard invalid, deep-compare the original instance before and after. For soft invalid, assert `instance.__invalid===true`. Reset the counter before each case and assert the command renders exactly once.

- [ ] **Step 4: Implement the shared command**

Near `refreshInstInvalid()`, add `setLayoutActionStatus()` and `rotateLayoutInstance90()`. Find the instance and item, build the candidate, reject any `hardPlacementConflict()`, otherwise calculate the soft state with `isInvalidPlacement()`, replace the instance once, set a named success/warning/error status, call `render()` once, and return the contract above.

Use these messages:

- Valid: `Rotated {name} 90°.`
- Soft: `Rotated 90°. Clearance overlaps another item, so it is shown in red.`
- Missing: `That equipment is no longer in this layout.`
- Hard: the message returned by `hardPlacementConflict()`.

- [ ] **Step 5: Replace both duplicated toggle implementations**

At the delegated click handler and SVG pointer handler, call `rotateLayoutInstance90(id)`. In the SVG handler call `preventDefault()` and `stopPropagation()` before the command so one pointer gesture cannot start a drag or rotate twice.

- [ ] **Step 6: Run all command tests and commit**

Run the logic runner, `node --check app.js`, `node --check events.js`, and `git diff --check`. Stage only the rotation command hunks and commit:

```bash
git commit -m "feat: add safe center-preserving rotation"
```

---

### Task 3: Add visible controls, feedback, and keyboard access

**Files:**
- Modify: `layout.js:452-487,540-757,948-1040,1211-1333`
- Modify: `events.js:3141-3165`
- Modify: `app.js:2504-2545`
- Modify: `index.html:2038-2205,2820-2890`
- Modify: `tests/rotation.test.js`

**Interfaces:**
- Consumes: `rotateLayoutInstance90()` and `state.layoutActionStatus`.
- Produces: visible toolbar/inspector buttons, one live status region, and singleton `wireLayoutRotationShortcut()`.

- [ ] **Step 1: Write failing rendered-markup tests**

With one selected fixture, assert `layoutPanel()` contains:

```text
class="selectedEquipmentToolbar"
data-action="rotateInst"
aria-keyshortcuts="R"
↻ Rotate 90°
role="status"
aria-live="polite"
```

Assert no selected item means no toolbar. Assert a status for another instance is not rendered as the current selection’s message.

- [ ] **Step 2: Render the Plan toolbar and inspector action**

Inside `.spatialPlanPane`, between `.spatialPaneLabel` and `.svgWrap`, render:

```html
<div class="selectedEquipmentToolbar" role="group" aria-label="Selected equipment actions">
  <span class="selectedEquipmentToolbarLabel">Selected: …</span>
  <button type="button" class="planRotateBtn" data-action="rotateInst" data-id="…" aria-keyshortcuts="R">
    ↻ Rotate 90° <kbd>R</kbd>
  </button>
</div>
```

Show it in `plan` and `split`, not 3D-only. Add the same full-text native button beside Remove in the selected-item inspector header and remove the old buried Rotate row.

- [ ] **Step 3: Make the SVG affordance accessible and display feedback**

Keep the small SVG glyph for pointer users but add `role="button"`, `tabindex="0"`, `aria-label="Rotate 90°"`, and `<title>Rotate 90°</title>`. Render matching success/warning/error text under the toolbar. Add one `.srOnly` live region at the end of `layoutPanel()` whose content is limited to a status matching the selected instance ID.

- [ ] **Step 4: Add responsive and focus-visible styling**

Add `.selectedEquipmentToolbar`, `.selectedEquipmentToolbarLabel`, `.planRotateBtn`, `.selectedEquipmentStatus`, tone variants, `kbd`, and `.srOnly`. Native rotate buttons must be at least 44px high, wrap cleanly on mobile, and have a visible `:focus-visible` ring.

- [ ] **Step 5: Extend focus preservation to buttons**

Allow `captureFocus()` to capture a focused `button` when it has an ID or stable `data-action` plus `data-id`. Keep text selection handling limited to inputs/textarea. Assert a focused inspector Rotate button is restored after a successful render.

- [ ] **Step 6: Write and implement shortcut guard tests**

Extract:

```js
function layoutRotationShortcutAllowed(event,target=document.activeElement)
```

Test false for repeat, modifiers, non-`KeyR`, non-layout tab, no selection, 3D-only mode, active drag, Walkthrough, pointer lock, input/textarea/select/contenteditable, and open dialog. Test true on the page in Plan and Split.

- [ ] **Step 7: Install one keyboard listener at script load**

Implement `wireLayoutRotationShortcut()` with a `window.__layoutRotationShortcutWired` guard. Only call `preventDefault()` after every guard passes, then rotate the selected item. Do not install it inside `wireMain()`, which runs after every render.

- [ ] **Step 8: Run accessibility checks and commit**

Run the test runner, syntax checks, and `git diff --check`. In the browser, tab to both native buttons, activate with Enter/Space, and verify `R` fires once. Commit:

```bash
git commit -m "feat: add accessible rotation controls"
```

---

### Task 4: Verify all rotation paths and cache-bust changed scripts

**Files:**
- Modify: `gltf-runtime.js:20-29`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: the completed shared rotation command and controls.
- Produces: verified identical behavior from all four entry points.

- [ ] **Step 1: Run automated checks**

```bash
node --check app.js
node --check events.js
node --check layout.js
node --check render.js
node --check view3d.js
node --input-type=module --check < gltf-runtime.js
git diff --check
```

Require the logic runner to report zero failures.

- [ ] **Step 2: Verify valid and cyclic rotation**

On a duplicate layout, record a selected item’s center, rotate from toolbar, inspector, SVG, and shortcut, and verify each preserves center within 0.01 inch. Four rotations must return to the original orientation and coordinates. Reload must preserve the result and update 3D orientation.

- [ ] **Step 3: Verify every rejection and warning path**

Test outside-room, door/reserved-area, equipment-body overlap, and staging boundary rejection. Confirm original position/orientation stays byte-for-byte unchanged. Create a clearance-only overlap and confirm rotation commits with `__invalid:true` and a red warning.

- [ ] **Step 4: Verify shortcut suppression matrix**

Confirm `R` does nothing in text inputs, textareas, selects, contenteditable, dialogs, active drag, Walkthrough, pointer lock, 3D-only mode, with modifiers, or on repeat. Confirm no repeated listeners after at least ten renders.

- [ ] **Step 5: Verify console, responsive layout, and cache versions**

Check desktop and narrow mobile widths, require zero console errors, and bump only `app.js`, `layout.js`, and `events.js` query versions in `gltf-runtime.js`.

- [ ] **Step 6: Record QA and commit**

Add the center tolerance, conflict matrix, shortcut matrix, and zero-error result to `design-qa.md`, inspect the cached diff, and commit:

```bash
git commit -m "test: verify equipment rotation workflow"
```
