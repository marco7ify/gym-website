# Layout Selection, Focus Mode, and Placed Equipment Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the stuck compact-drawer overlay, make Focus Canvas truly full width, and add an equipment-library scope that shows only items placed in the active layout.

**Architecture:** Keep all new behavior in transient `layoutWorkspace` state. Add one pure core helper for placed-item scoping, render the scope before the existing filters, and close compact drawers at the two state transitions that currently leave them stale. Fix focus sizing with a late, higher-specificity CSS rule so it wins without restructuring the established layout code.

**Tech Stack:** Browser JavaScript, HTML template strings, CSS Grid, Node `node:test`, in-app Browser QA.

## Global Constraints

- Do not change persisted item records, layout instances, 3D rendering, placement validation, or saved layout schemas.
- **All equipment** remains the default library scope.
- Search, category, brand, and rack filters apply after the placed-only scope.
- Clearing a selection and entering Focus Canvas must close compact drawers and remove their backdrop.
- Existing selection remains preserved when entering and leaving Focus Canvas.
- No saved equipment or layout data may be deleted or rewritten by these controls.

---

### Task 1: Pure placed-equipment scope

**Files:**
- Modify: `tests/layout-editor-core.test.cjs`
- Modify: `layout-editor-core.js`

**Interfaces:**
- Consumes: item records shaped as `{id:string}` and active layout instances shaped as `{itemId:string}`.
- Produces: `scopeEquipment(items, instances, scope)` returning the input-order item subset; `workspaceDefaults().equipmentScope` with value `"all"`.

- [ ] **Step 1: Write failing scope and default-state tests**

Add tests that assert:

```js
test("scopeEquipment returns unique placed items in original library order", () => {
  const instances=[{itemId:"c"},{itemId:"a"},{itemId:"c"},{itemId:"missing"}];
  assert.deepEqual(core.scopeEquipment(items,instances,"placed").map(item=>item.id),["a","c"]);
});

test("scopeEquipment keeps all items by default and handles an empty layout", () => {
  assert.deepEqual(core.scopeEquipment(items,[],"all"),items);
  assert.deepEqual(core.scopeEquipment(items,[],"placed"),[]);
});
```

Update the existing workspace-default expectation to include `equipmentScope:"all"`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/layout-editor-core.test.cjs`

Expected: FAIL because `scopeEquipment` is undefined and `equipmentScope` is missing.

- [ ] **Step 3: Implement the pure helper and transient default**

Add:

```js
function scopeEquipment(items,instances,scope="all"){
  if(scope!=="placed") return items||[];
  const placedIds=new Set((instances||[]).map(instance=>instance.itemId).filter(Boolean));
  return (items||[]).filter(item=>placedIds.has(item.id));
}
```

Set `equipmentScope:"all"` in `workspaceDefaults()` and export `scopeEquipment`.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `node --test tests/layout-editor-core.test.cjs`

Expected: all core tests pass.

- [ ] **Step 5: Commit the pure state and filtering layer**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git commit -m "feat: add placed equipment library scope"
```

### Task 2: Drawer cleanup and Focus Canvas sizing

**Files:**
- Modify: `events.js`
- Modify: `index.html`
- Test: `tests/planner-logic-runner.html` through browser interaction

**Interfaces:**
- Consumes: `state.layoutWorkspace.libraryDrawerOpen`, `state.layoutWorkspace.inspectorDrawerOpen`, and `state.layoutFocusMode`.
- Produces: clear-selection and focus actions with both drawer flags false; `.layoutWorkspace.layoutFocusMode` with one full-width grid column.

- [ ] **Step 1: Capture the failing browser assertions**

At a compact viewport, select the first `g[data-type="inst"]`, activate Clear, and record that `.workspaceDrawerBackdrop` remains visible. At desktop width, measure `.layoutCanvasCard` before and after Focus Canvas and record that its focused width falls to approximately `260px`.

- [ ] **Step 2: Make the smallest event-state correction**

In the `toggle_layout_focus` route, set both drawer flags false before toggling focus. In `layout_clear_selection`, set `inspectorDrawerOpen=false` before rendering:

```js
state.layoutWorkspace.libraryDrawerOpen=false;
state.layoutWorkspace.inspectorDrawerOpen=false;
```

The clear-selection route only needs to close the inspector, but closing both on focus prevents either drawer backdrop from surviving the mode change.

- [ ] **Step 3: Add the winning focus-mode CSS rule**

After the standard `.layoutWorkspace.layout3col` declaration, add:

```css
.layoutWorkspace.layout3col.layoutFocusMode {
  grid-template-columns: minmax(0, 1fr);
}

.layoutWorkspace.layout3col.layoutFocusMode > .layoutCanvasCard {
  grid-column: 1;
  width: 100%;
}
```

- [ ] **Step 4: Verify the two regressions in the browser**

At compact width, Clear must leave no visible `.workspaceDrawerBackdrop` and the inspector must lose `isOpen`. At desktop width, Focus Canvas must hide both sidebars and make the canvas wider than its normal center column; Show panels must restore the normal workspace.

- [ ] **Step 5: Run syntax and shared planner tests**

Run:

```bash
node --check events.js
node --test tests/layout-editor-core.test.cjs
```

Then load `tests/planner-logic-runner.html` and require `data-failures="0"`.

- [ ] **Step 6: Commit the regression fixes**

```bash
git add events.js index.html
git commit -m "fix: restore layout selection and focus behavior"
```

### Task 3: In-this-layout equipment library control

**Files:**
- Modify: `layout.js`
- Modify: `events.js`
- Modify: `index.html`
- Test: `tests/planner-logic-runner.html` through browser interaction

**Interfaces:**
- Consumes: `LayoutEditorCore.scopeEquipment(rows,state.layout.instances,state.layoutWorkspace.equipmentScope)`.
- Produces: action `layoutEquipmentScope` with `data-scope="all|placed"`; a two-option segmented control; scoped empty-state copy.

- [ ] **Step 1: Establish the pre-change browser failure**

Confirm the equipment library contains no `layoutEquipmentScope` controls and that an unplaced item remains visible because no placed-only scope is available.

- [ ] **Step 2: Scope rows before applying existing filters**

In `layoutPanel`, derive:

```js
const equipmentScope=state.layoutWorkspace?.equipmentScope==="placed"?"placed":"all";
const scopedRows=LayoutEditorCore.scopeEquipment(rows,state.layout.instances,equipmentScope);
const filteredRows=LayoutEditorCore.filterEquipment(scopedRows,{...},{rackPatternInfo});
```

Keep the complete `rows` collection for total counts and for category/brand option discovery so changing scope never erases available filter choices.

- [ ] **Step 3: Render the segmented scope control and contextual count**

Above search, render two buttons with `aria-pressed`:

```html
<div class="layoutEquipmentScope" role="group" aria-label="Equipment list scope">
  <button data-action="layoutEquipmentScope" data-scope="all">All equipment</button>
  <button data-action="layoutEquipmentScope" data-scope="placed">In this layout</button>
</div>
```

Show `${scopedRows.length} of ${rows.length} items` in placed scope and `${rows.length} items` in all scope.

- [ ] **Step 4: Add the event route**

Handle only the exact values `all` and `placed`:

```js
if(t.dataset.action==="layoutEquipmentScope"){
  const scope=t.dataset.scope;
  if(!["all","placed"].includes(scope)) return;
  state.layoutWorkspace.equipmentScope=scope;
  state.layoutExpandedItemId=null;
  render();
  return;
}
```

- [ ] **Step 5: Style the control using the existing visual system**

Add a compact two-column segmented group with existing border, background, primary-light, and text tokens. The active option uses the same warm selected treatment as category filters; both controls remain at least `36px` high.

- [ ] **Step 6: Add contextual empty-state copy**

When placed scope is active and `state.layout.instances` is empty, render “No equipment is placed yet.” Otherwise keep “No equipment matches” and the Clear filters action. Clearing filters must not change `equipmentScope`.

- [ ] **Step 7: Verify filter behavior in the browser**

Switch to In this layout and assert all visible quick-add equipment IDs belong to `state.layout.instances`. Confirm an unplaced known item disappears, a placed item remains with its placed count, search narrows placed results, and All equipment restores the full list.

- [ ] **Step 8: Commit the library scope UI**

```bash
git add layout.js events.js index.html
git commit -m "feat: filter layout library to placed equipment"
```

### Task 4: Full regression verification and handoff

**Files:**
- Verify: all modified runtime and test files

**Interfaces:**
- Consumes: the completed behavior from Tasks 1-3.
- Produces: a clean working tree with evidence that existing planner and 3D flows remain healthy.

- [ ] **Step 1: Run static verification**

Run:

```bash
node --check app.js
node --check events.js
node --check layout.js
node --check render.js
node --check layout-editor-core.js
node --check panels.js
node --check view3d.js
node --check walkthrough-editing.js
node --check wall-features.js
node --check garage-doors.js
node --test tests/*.cjs
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Run all browser test runners**

Require `data-complete="true"` and `data-failures="0"` for:

- `tests/planner-logic-runner.html`
- `tests/garage-door-3d-runner.html`
- `tests/equipment-dispatch-3d-runner.html`
- `tests/wall-features-3d-runner.html`
- `tests/runtime-cache-runner.html`

- [ ] **Step 3: Run desktop and compact interaction QA**

Verify page identity, meaningful DOM, no framework overlay, no relevant console errors/warnings, selection then Clear, Focus Canvas then Show panels, placed-only scope, search within that scope, and restoration to All equipment. Capture a final desktop screenshot and a compact screenshot.

- [ ] **Step 4: Review the diff for scope and safety**

Confirm the diff contains no file deletions, no persisted layout-schema changes, and no unrelated edits. Confirm the working tree contains only the intended implementation before the final commit.

- [ ] **Step 5: Commit any final test-only adjustments**

If verification required test fixture or cache-contract adjustments, commit only those files:

```bash
git add tests
git commit -m "test: cover layout workspace controls"
```

If no adjustments were needed, do not create an empty commit.
