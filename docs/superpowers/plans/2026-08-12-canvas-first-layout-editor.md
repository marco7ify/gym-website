# Canvas-First Layout Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Layout page's long document flow with a canvas-first workspace containing an independently scrollable equipment library, persistent canvas, contextual inspector, and in-layout equipment-details editor.

**Architecture:** Preserve the existing dependency-free, classic-script application and its state/render/event flow. Add one small UMD-style pure-helper module for testable layout-editor logic, decompose `layoutPanel()` into focused render functions, reuse one equipment-form renderer in Wishlist and Layout, and keep all durable layout data backward-compatible.

**Tech Stack:** HTML, CSS, classic browser JavaScript, SVG, Three.js, browser `localStorage`, Node.js built-in `node:test`, and the Codex in-app Browser for rendered workflow verification.

## Global Constraints

- Preserve the current Gym Planner visual language and all existing layout data, calculations, placement rules, 3D behavior, walkthrough behavior, and import/export behavior.
- Do not replace the existing SVG plan renderer, Three.js scene, classic-script architecture, or no-framework setup.
- Do not add external runtime or test dependencies.
- Do not change the export schema; all new workspace state is transient and excluded from JSON exports.
- Wide desktop is `1180px` and above; compact desktop/tablet is `760–1179px`; mobile is below `760px`.
- Touch targets are at least `44px × 44px`; status is never conveyed only by color; reduced-motion preferences remain respected.
- The worktree already contains unrelated, uncommitted 3D and equipment-model changes. Never discard, overwrite, stage, or commit those changes accidentally. Stage only the files listed for the current task and inspect `git diff --cached --name-only` before every commit.
- The current untracked `gltf-runtime.js` belongs to the existing dirty-worktree baseline and must not be staged by this feature. Load `layout-editor-core.js` directly from `index.html` before `gltf-runtime.js`, which guarantees it exists before `app.js` is dynamically loaded.

---

## File Structure

### New files

- `layout-editor-core.js` — pure, environment-independent helpers for filtering, selection routing, draft comparison, duplication, and centering.
- `tests/layout-editor-core.test.cjs` — Node built-in tests for `layout-editor-core.js`.

### Modified files

- `app.js` — initialize transient layout-workspace state and expose placement helper adapters that use the pure core.
- `layout.js` — render the library, canvas workspace, contextual inspector, page tools, drawers, sheets, and equipment-details editor.
- `panels.js` — split `itemForm()` into reusable grouped sections used by Wishlist and Layout.
- `events.js` — handle search/filter state, inspector/page-tool actions, duplicate/center, drawer/dialog lifecycle, dirty drafts, and keyboard/focus behavior.
- `render.js` — preserve new scroll containers and focus targets across re-renders.
- `index.html` — style the three-region workspace, responsive drawers/sheets, sticky editor actions, states, and accessibility behavior.
- `ARCHITECTURE.md` — document the new helper module and layout-editor component boundaries.

---

## Spec Coverage Map

- **Problem, goals, and non-goals:** enforced by Global Constraints and the scope of Tasks 1–8.
- **Information architecture:** Tasks 2–4 build the library, canvas workspace, contextual inspector, and page tools.
- **Equipment placement inspector:** Tasks 4–5 add placement controls, duplicate, center, and removal actions.
- **Full equipment details:** Task 6 adds the shared grouped equipment form and in-layout details editor.
- **Page-level tools:** Task 4 keeps layout-wide controls available when no equipment item is selected.
- **Interaction and state behavior:** Tasks 2–6 define selection, draft, placement, editor, and persistence transitions.
- **Responsive behavior:** Task 7 converts the side regions into accessible drawers and a mobile bottom sheet.
- **Accessibility:** Task 7 covers keyboard operation, focus management, dialog semantics, and announcements.
- **Architecture:** Tasks 1–7 introduce the pure core, state boundary, view models, and shared form contract; Task 8 documents them.
- **Testing Strategy and Acceptance Criteria:** every task uses red-green verification, with the complete regression and acceptance pass in Task 8.

---

### Task 1: Pure Layout-Editor Core and Test Harness

**Files:**
- Create: `layout-editor-core.js`
- Create: `tests/layout-editor-core.test.cjs`
- Modify: `index.html:2914-2920`

**Interfaces:**
- Consumes: plain item, layout, instance, room-rectangle, and draft objects.
- Produces: `window.LayoutEditorCore` and `module.exports` with `filterEquipment`, `selectionType`, `clonePlacement`, `centerPlacement`, and `draftChanged`.

- [ ] **Step 1: Write the failing core-helper tests**

```js
// tests/layout-editor-core.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../layout-editor-core.js");

const items = [
  {id:"a", name:"Functional Trainer", brand:"Rogue", category:"Cable", rackHolePattern:""},
  {id:"b", name:"Power Rack", brand:"REP", category:"Racks", rackHolePattern:"3x3-1"},
  {id:"c", name:"Adjustable Bench", brand:"REP", category:"Benches", rackHolePattern:""},
];

test("filterEquipment combines query, category, and brand", () => {
  assert.deepEqual(
    core.filterEquipment(items, {query:"rack", category:"Racks", brand:"REP"}).map(x=>x.id),
    ["b"]
  );
});

test("selectionType returns the one active layout selection", () => {
  assert.equal(core.selectionType({selectedInstId:"i1"}), "equipment");
  assert.equal(core.selectionType({selectedAreaId:"a1"}), "area");
  assert.equal(core.selectionType({}), "none");
});

test("clonePlacement creates a new selected-ready instance without transient flags", () => {
  const source = {id:"i1", itemId:"a", xFt:3, xIn:0, yFt:4, yIn:0, rotated:true, __invalid:true};
  assert.deepEqual(core.clonePlacement(source, "i2"), {
    id:"i2", itemId:"a", xFt:3, xIn:0, yFt:4, yIn:0, rotated:true,
  });
});

test("centerPlacement centers the measured footprint in a room rectangle", () => {
  assert.deepEqual(
    core.centerPlacement({x:0,y:0,w:20,h:16}, {w:4,h:6}),
    {xFt:8, xIn:0, yFt:5, yIn:0}
  );
});

test("draftChanged compares normalized serializable values", () => {
  assert.equal(core.draftChanged({name:"Rack", qty:1}, {name:"Rack", qty:1}), false);
  assert.equal(core.draftChanged({name:"Rack", qty:2}, {name:"Rack", qty:1}), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/layout-editor-core.test.cjs`
Expected: FAIL with `Cannot find module '../layout-editor-core.js'`.

- [ ] **Step 3: Implement the minimal UMD helper API**

```js
// layout-editor-core.js
(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  root.LayoutEditorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  function filterEquipment(items, filters={}){
    const query = String(filters.query||"").trim().toLowerCase();
    return (items||[]).filter(item=>{
      const haystack = `${item.name||""} ${item.brand||""}`.toLowerCase();
      if(query && !haystack.includes(query)) return false;
      if(filters.category && filters.category!=="All" && item.category!==filters.category) return false;
      if(filters.brand && filters.brand!=="All" && item.brand!==filters.brand) return false;
      return true;
    });
  }

  function selectionType(layout={}){
    const ordered = [
      ["selectedInstId","equipment"], ["selectedAreaId","area"],
      ["selectedOutletId","outlet"], ["selectedWallExtId","wall-extension"],
      ["selectedCeilingZoneId","ceiling-zone"], ["selectedFloorZoneId","floor-zone"],
      ["selectedFlooringId","flooring"],
    ];
    return ordered.find(([key])=>layout[key])?.[1] || "none";
  }

  function clonePlacement(source, id){
    const keep = ["itemId","xFt","xIn","yFt","yIn","rotated","deadspaceFt","deadspaceIn","deadspaceSides"];
    return keep.reduce((copy,key)=>{
      if(source[key] !== undefined) copy[key] = Array.isArray(source[key]) ? [...source[key]] : source[key];
      return copy;
    }, {id});
  }

  function centerPlacement(roomRect, footprint){
    const x = roomRect.x + Math.max(0, (roomRect.w-footprint.w)/2);
    const y = roomRect.y + Math.max(0, (roomRect.h-footprint.h)/2);
    return {xFt:Math.floor(x), xIn:Math.round((x-Math.floor(x))*12), yFt:Math.floor(y), yIn:Math.round((y-Math.floor(y))*12)};
  }

  function draftChanged(a,b){ return JSON.stringify(a||{}) !== JSON.stringify(b||{}); }
  return {filterEquipment, selectionType, clonePlacement, centerPlacement, draftChanged};
});
```

- [ ] **Step 4: Load the helper before application state**

Add the classic helper immediately before the existing module runtime in `index.html`:

```html
<script src="./layout-editor-core.js?v=1"></script>
<script type="module" src="gltf-runtime.js?v=20"></script>
```

- [ ] **Step 5: Run the tests and syntax checks**

Run: `node --test tests/layout-editor-core.test.cjs && node --check layout-editor-core.js`
Expected: 5 tests PASS and every syntax check exits 0.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p index.html
git diff --cached --name-only
git diff --cached -- index.html
git commit -m "test: add layout editor core helpers"
```

### Task 2: Workspace State and Three-Region Desktop Shell

**Files:**
- Modify: `app.js:1380-1440`
- Modify: `layout.js:130-1210`
- Modify: `render.js:10-48`
- Modify: `index.html:850-915,1960-2035,2640-2760`
- Test: `tests/layout-editor-core.test.cjs`

**Interfaces:**
- Consumes: `LayoutEditorCore.selectionType(layout)` from Task 1 and existing selection panel functions.
- Produces: transient `state.layoutWorkspace`, `buildLayoutViewModel(rows,currency)`, `layoutEquipmentLibrary(model)`, `layoutCanvasWorkspace(model)`, `layoutContextInspector(model)`, `layoutCoveragePanel(coverage,currency)`, and stable scroll selectors `.layoutEquipmentScroll` and `.layoutInspectorScroll`.

- [ ] **Step 1: Add a failing state-default test**

Append to `tests/layout-editor-core.test.cjs`:

```js
test("workspaceDefaults contains only transient UI state", () => {
  assert.deepEqual(core.workspaceDefaults(), {
    search:"", inspectorMode:"auto", libraryDrawerOpen:false,
    inspectorDrawerOpen:false, detailsEditorOpen:false,
    detailsEditorItemId:null, detailsEditorDirty:false,
    detailsEditorBaseline:null, discardEditorConfirmOpen:false,
    returnFocusSelector:"", status:null,
    openPageTool:"layout", openAdvancedSection:"",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/layout-editor-core.test.cjs`
Expected: FAIL because `core.workspaceDefaults` is not a function.

- [ ] **Step 3: Add `workspaceDefaults()` and initialize transient state**

Add to `layout-editor-core.js` and export it:

```js
function workspaceDefaults(){
  return {
    search:"", inspectorMode:"auto", libraryDrawerOpen:false,
    inspectorDrawerOpen:false, detailsEditorOpen:false,
    detailsEditorItemId:null, detailsEditorDirty:false,
    detailsEditorBaseline:null, discardEditorConfirmOpen:false,
    returnFocusSelector:"", status:null,
    openPageTool:"layout", openAdvancedSection:"",
  };
}
```

Initialize in `app.js` without placing it in `persist()` or export payloads:

```js
layoutWorkspace: LayoutEditorCore.workspaceDefaults(),
```

- [ ] **Step 4: Extract the workspace render boundaries**

Refactor `layoutPanel(rows, currency)` to compose focused functions:

```js
function layoutPanel(rows, currency){
  const model = buildLayoutViewModel(rows, currency);
  return `
    <div class="layoutWorkspace ${state.layoutFocusMode?"isFocusMode":""}">
      ${layoutEquipmentLibrary(model)}
      ${layoutCanvasWorkspace(model)}
      ${layoutContextInspector(model)}
    </div>
    ${state.layoutFocusMode ? "" : layoutCoveragePanel(model.coverage, currency)}
    ${equipmentDetailsEditor(currency)}
  `;
}
```

Move existing calculation code into `buildLayoutViewModel()` without changing its calculations. Move the existing `centerCanvas` markup into `layoutCanvasWorkspace()`. Keep the current SVG markup byte-for-byte where practical during this task.

- [ ] **Step 5: Add desktop workspace CSS and scroll preservation**

Replace the current `.layout3col` desktop rules with:

```css
.layoutWorkspace{
  display:grid;
  grid-template-columns:260px minmax(520px,1fr) 320px;
  gap:14px;
  align-items:stretch;
  height:calc(100vh - 245px);
  min-height:620px;
  margin-top:20px;
}
.layoutEquipmentLibrary,.layoutContextInspector,.layoutCanvasCard{min-height:0;margin:0}
.layoutEquipmentScroll,.layoutInspectorScroll{height:100%;overflow:auto;overscroll-behavior:contain}
.layoutCanvasCard{position:static;display:flex;flex-direction:column}
.layoutWorkspace.isFocusMode{grid-template-columns:minmax(0,1fr)}
.layoutWorkspace.isFocusMode>.layoutEquipmentLibrary,
.layoutWorkspace.isFocusMode>.layoutContextInspector{display:none}
```

Add `.layoutEquipmentScroll` and `.layoutInspectorScroll` to `SCROLL_PRESERVE_SELECTORS` in `render.js`.

- [ ] **Step 6: Run tests and inspect the first desktop render**

Run: `node --test tests/layout-editor-core.test.cjs && node --check app.js && node --check layout.js && node --check render.js`
Expected: all tests PASS and syntax checks exit 0.

Open the app at `http://127.0.0.1:4173/`, switch to Layout, and verify at `1440×900`:

- Equipment, canvas, and inspector columns are all visible.
- The canvas stays visible while each side region scrolls.
- Existing Plan, Split, 3D, Focus canvas, staging, compare, and walkthrough controls still render.

- [ ] **Step 7: Commit only Task 2 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p app.js layout.js render.js index.html
git diff --cached --name-only
git diff --cached
git commit -m "feat: add canvas-first layout workspace"
```

### Task 3: Searchable Equipment Library with Stable State

**Files:**
- Modify: `layout-editor-core.js`
- Modify: `tests/layout-editor-core.test.cjs`
- Modify: `layout.js: equipment library functions introduced in Task 2`
- Modify: `events.js:1016-1410,1950-1975`
- Modify: `index.html: layout equipment-library styles`

**Interfaces:**
- Consumes: `LayoutEditorCore.filterEquipment(items, filters)` and existing item/card calculations.
- Produces: actions `layout_search`, `layout_clear_filters`, existing `layoutCatFilter`, and `addInst` with stable library state.

- [ ] **Step 1: Add failing no-brand and rack-filter tests**

```js
test("filterEquipment supports no-brand and rack metadata filters", () => {
  const pattern = item => item.id==="b" ? {uprightSize:"3×3",holeSize:"1 in"} : null;
  assert.deepEqual(core.filterEquipment(items,{brand:"__noBrand__"},{rackPatternInfo:pattern}), []);
  assert.deepEqual(
    core.filterEquipment(items,{category:"Racks",upright:"3×3",hole:"1 in"},{rackPatternInfo:pattern}).map(x=>x.id),
    ["b"]
  );
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="no-brand" tests/layout-editor-core.test.cjs`
Expected: FAIL because rack and no-brand filters are not implemented.

- [ ] **Step 3: Extend the filter helper**

```js
function filterEquipment(items, filters={}, deps={}){
  const query = String(filters.query||"").trim().toLowerCase();
  return (items||[]).filter(item=>{
    const haystack = `${item.name||""} ${item.brand||""}`.toLowerCase();
    if(query && !haystack.includes(query)) return false;
    if(filters.category && filters.category!=="All" && item.category!==filters.category) return false;
    if(filters.brand==="__noBrand__" && String(item.brand||"").trim()) return false;
    if(filters.brand && !["All","__noBrand__"].includes(filters.brand) && item.brand!==filters.brand) return false;
    const pattern = deps.rackPatternInfo?.(item);
    if(filters.upright && filters.upright!=="All" && pattern?.uprightSize!==filters.upright) return false;
    if(filters.hole && filters.hole!=="All" && pattern?.holeSize!==filters.hole) return false;
    return true;
  });
}
```

- [ ] **Step 4: Render the search and empty state**

At the top of `layoutEquipmentLibrary()` add:

```html
<label class="layoutSearchField">
  <span class="srOnly">Search equipment</span>
  <input type="search" data-action="layout_search" value="${escapeAttr(state.layoutWorkspace.search)}" placeholder="Search equipment…" />
</label>
```

Render the existing category, brand, upright, and hole filters beneath it. When no items match, render:

```html
<div class="layoutLibraryEmpty" role="status">
  <strong>No equipment matches</strong>
  <span>Try another search or clear the current filters.</span>
  <button class="btn" data-action="layout_clear_filters">Clear filters</button>
</div>
```

- [ ] **Step 5: Wire search and clear actions without resetting scroll**

In the delegated `input` handler:

```js
if(t.dataset.action==="layout_search"){
  state.layoutWorkspace.search=t.value;
  render();
  return;
}
```

In the delegated click handler:

```js
if(t.dataset.action==="layout_clear_filters"){
  state.layoutWorkspace.search="";
  state.layoutSelectedCategory="All";
  state.layoutSelectedBrand="All";
  state.layoutFilterUpright="All";
  state.layoutFilterHole="All";
  render();
  return;
}
```

Keep `toggleExpandItem`, `setItemTab`, `toggleCompareLayout`, and `addInst` behavior. After `addInst`, the new instance remains selected and the library search/filter/scroll state remains unchanged.

- [ ] **Step 6: Run tests and browser interaction proof**

Run: `node --test tests/layout-editor-core.test.cjs && node --check events.js && node --check layout.js`
Expected: all tests PASS and syntax checks exit 0.

In the browser: search `Target`, add it, confirm the placed count increments, the new plan instance is selected, and the library does not jump to the top.

- [ ] **Step 7: Commit only Task 3 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p layout.js events.js index.html
git diff --cached --name-only
git diff --cached
git commit -m "feat: add stable layout equipment library"
```

### Task 4: Contextual Inspector and Page-Level Tools

**Files:**
- Modify: `layout.js: contextual inspector and selection panels`
- Modify: `events.js: selection and page-tool handlers`
- Modify: `index.html: inspector status and accordion styles`
- Test: `tests/layout-editor-core.test.cjs`

**Interfaces:**
- Consumes: `LayoutEditorCore.selectionType(layout)` and all existing `selected*Panel()` functions.
- Produces: `layoutContextInspector(model)`, `layoutPageTools(model)`, and actions `layout_clear_selection` and `layout_page_tool`.

- [ ] **Step 1: Expand the failing selection-routing test**

```js
test("selectionType routes every existing selection", () => {
  const cases = [
    ["selectedInstId","equipment"], ["selectedAreaId","area"],
    ["selectedOutletId","outlet"], ["selectedWallExtId","wall-extension"],
    ["selectedCeilingZoneId","ceiling-zone"], ["selectedFloorZoneId","floor-zone"],
    ["selectedFlooringId","flooring"],
  ];
  for(const [key,type] of cases) assert.equal(core.selectionType({[key]:"id"}),type);
});
```

- [ ] **Step 2: Run the focused test and verify the first unsupported case fails**

Run: `node --test --test-name-pattern="routes every" tests/layout-editor-core.test.cjs`
Expected: FAIL if any current selection key is missing from `selectionType`.

- [ ] **Step 3: Complete selection routing and compose the inspector**

```js
function layoutContextInspector(model){
  const type=LayoutEditorCore.selectionType(state.layout);
  const body={
    equipment:()=>selectedEquipmentPanel(model.selectedInst),
    area:()=>selectedAreaPanel(model.selectedArea),
    outlet:()=>selectedOutletPanel(model.selectedOutlet),
    "wall-extension":()=>selectedWallExtPanel(model.selectedWallExt),
    "ceiling-zone":()=>selectedCeilingZonePanel(model.selectedCeilZone),
    "floor-zone":()=>selectedFloorZonePanel(model.selectedFloorZone),
    flooring:()=>selectedFlooringPanel(model.selectedFlooring),
    none:()=>layoutPageTools(model),
  }[type]();
  return `<aside class="layoutContextInspector" aria-label="Layout inspector">
    <div class="layoutInspectorScroll">${body}</div>
  </aside>`;
}
```

Remove selected-object panels from the equipment-library markup. Add a close-selection button to every selected panel through a shared header renderer:

```html
<button class="iconBtn" data-action="layout_clear_selection" aria-label="Clear selection">×</button>
```

- [ ] **Step 4: Move page tools into no-selection accordions**

Compose the existing Layout, View Settings, Layout Tools, room dimensions, areas, outlets, zones, flooring, editor unit, grid contrast, and dimension-overlay controls under `layoutPageTools()`. Use buttons with `aria-expanded` and `data-panel`:

```html
<button class="layoutToolHeading" data-action="layout_page_tool" data-panel="view" aria-expanded="false">
  <span>View settings</span><span aria-hidden="true">⌄</span>
</button>
```

Do not change the underlying action names for existing controls.

- [ ] **Step 5: Wire selection clearing and accordion state**

```js
if(t.dataset.action==="layout_clear_selection"){
  clearAllSelections();
  render();
  return;
}
if(t.dataset.action==="layout_page_tool"){
  const next=t.dataset.panel||"layout";
  state.layoutWorkspace.openPageTool=state.layoutWorkspace.openPageTool===next ? "" : next;
  render();
  return;
}
```

Clicking empty SVG space must call `clearAllSelections()` only when the pointer did not begin on a selectable object or resize handle.

- [ ] **Step 6: Run tests and selection workflow checks**

Run: `node --test tests/layout-editor-core.test.cjs && node --check layout.js && node --check events.js`
Expected: all tests PASS and syntax checks exit 0.

In the browser, select equipment, an area, outlet, wall extension, ceiling zone, floor zone, and flooring piece. Confirm the right inspector changes in place and the document scroll position remains constant. Clear selection and confirm the previously open page-tool accordion returns.

- [ ] **Step 7: Commit only Task 4 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p layout.js events.js index.html
git diff --cached --name-only
git diff --cached
git commit -m "feat: add contextual layout inspector"
```

### Task 5: Reordered Equipment Inspector, Duplicate, and Center

**Files:**
- Modify: `app.js: placement helper area near layout geometry functions`
- Modify: `layout.js:1211-1334`
- Modify: `events.js:1950-2120`
- Modify: `index.html: inspector sections and status styles`
- Test: `tests/layout-editor-core.test.cjs`

**Interfaces:**
- Consumes: `LayoutEditorCore.clonePlacement()`, `LayoutEditorCore.centerPlacement()`, existing `instanceDims()`, `effectiveRectForInst()`, `isHardInvalidPlacement()`, `isInvalidPlacement()`, `refreshInstInvalid()`, and `clearAllSelections()`.
- Produces: `duplicatePlacement(instId): {ok:boolean, instance?:object, message:string}`, `centerPlacementInRoom(instId): {ok:boolean, message:string}`, and `updateInstancePlacement(instId,patch): {ok:boolean,message:string}` plus actions `duplicateInst`, `centerInst`, and `toggle_layout_advanced`.

- [ ] **Step 1: Add failing edge-case tests for clone and center**

```js
test("clonePlacement deep-copies clearance sides", () => {
  const source={id:"i1",itemId:"a",xFt:1,yFt:2,deadspaceSides:["front"]};
  const copy=core.clonePlacement(source,"i2");
  copy.deadspaceSides.push("left");
  assert.deepEqual(source.deadspaceSides,["front"]);
});

test("centerPlacement normalizes twelve inches into the next foot", () => {
  assert.deepEqual(core.centerPlacement({x:0,y:0,w:9.99,h:9.99},{w:2,h:2}), {xFt:4,xIn:0,yFt:4,yIn:0});
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test --test-name-pattern="deep-copies|normalizes" tests/layout-editor-core.test.cjs`
Expected: at least one FAIL until array copying and inch carry normalization are correct.

- [ ] **Step 3: Correct pure clone and center normalization**

Use and export a converter so the browser adapter can store normalized positions:

```js
function splitFeet(value){
  let ft=Math.floor(value);
  let inch=Math.round((value-ft)*12);
  if(inch===12){ ft+=1; inch=0; }
  return {ft,inch};
}
```

Add `splitFeet` to the returned `LayoutEditorCore` API. Return deep-copied arrays from `clonePlacement()` and normalized feet/inches from `centerPlacement()`.

- [ ] **Step 4: Implement validated placement adapters**

In `app.js`, implement duplication by cloning, offsetting one foot diagonally, scanning the existing placement grid when needed, validating with current hard-placement rules, appending only a valid result, and selecting it. Return a plain result object instead of alerting. Define these adapters before `duplicatePlacement()`:

```js
function placementPoint(inst,x,y){
  const sx=LayoutEditorCore.splitFeet(snap(x));
  const sy=LayoutEditorCore.splitFeet(snap(y));
  return {...inst,xFt:sx.ft,xIn:sx.in,yFt:sy.ft,yIn:sy.in};
}

function placementHardInvalid(inst){
  const item=getItemById(inst.itemId);
  if(!item) return true;
  return isHardInvalidPlacement(inst.id,effectiveRectForInst(inst,item).base);
}

function findValidPlacementNear(source,offsetX=1,offsetY=1){
  const startX=instXTotalFt(source)+offsetX;
  const startY=instYTotalFt(source)+offsetY;
  const offsets=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[2,0],[0,2],[-2,0],[0,-2]];
  for(const [dx,dy] of offsets){
    const candidate=placementPoint(source,startX+dx,startY+dy);
    if(!placementHardInvalid(candidate)) return {
      xFt:candidate.xFt,xIn:candidate.xIn,yFt:candidate.yFt,yIn:candidate.yIn,
    };
  }
  return null;
}
```

```js
function duplicatePlacement(instId){
  const source=(state.layout.instances||[]).find(x=>x.id===instId);
  if(!source) return {ok:false,message:"The selected equipment is no longer available."};
  const candidate=LayoutEditorCore.clonePlacement(source,uid("inst"));
  const point=findValidPlacementNear(candidate,1,1);
  if(!point) return {ok:false,message:"No valid nearby space is available for a duplicate."};
  Object.assign(candidate,point,{__invalid:false});
  state.layout.instances=[...(state.layout.instances||[]),candidate];
  clearAllSelections(); state.layout.selectedInstId=candidate.id;
  return {ok:true,instance:candidate,message:"Duplicate added."};
}
```

Implement centering against the base room rectangle. Apply the candidate to a copy first; reject it if current hard-placement validation fails; otherwise mutate the instance and refresh soft-invalid status:

```js
function centerPlacementInRoom(instId){
  const source=(state.layout.instances||[]).find(x=>x.id===instId);
  const item=source&&getItemById(source.itemId);
  if(!source||!item) return {ok:false,message:"The selected equipment is no longer available."};
  const baseRoom=room().rects.find(x=>x.id==="base")||{x:0,y:0,w:room().W,h:room().L};
  const point=LayoutEditorCore.centerPlacement(baseRoom,instanceDims(source,item));
  const candidate={...source,...point};
  if(placementHardInvalid(candidate)) return {ok:false,message:"The center position is blocked."};
  const er=effectiveRectForInst(candidate,item);
  candidate.__invalid=isInvalidPlacement(candidate.id,er.base,er.eff);
  state.layout.instances=(state.layout.instances||[]).map(x=>x.id===instId?candidate:x);
  return {ok:true,message:candidate.__invalid?"Centered with a clearance warning.":"Centered in the room."};
}
```

Route exact position edits through a validated adapter so hard-invalid values never replace the last valid placement:

```js
function updateInstancePlacement(instId,patch){
  const source=(state.layout.instances||[]).find(x=>x.id===instId);
  const item=source&&getItemById(source.itemId);
  if(!source||!item) return {ok:false,message:"The selected equipment is no longer available."};
  const candidate={...source,...patch};
  const er=effectiveRectForInst(candidate,item);
  if(isHardInvalidPlacement(candidate.id,er.base)) return {ok:false,message:"That position is outside the room or overlaps a blocked object."};
  candidate.__invalid=isInvalidPlacement(candidate.id,er.base,er.eff);
  state.layout.instances=(state.layout.instances||[]).map(x=>x.id===instId?candidate:x);
  return {ok:true,message:candidate.__invalid?"Position saved with a clearance warning.":"Position saved."};
}
```

Update the `inst_x_ft`, `inst_x_in`, `inst_y_ft`, and `inst_y_in` handlers to build a patch and call this adapter. When it returns `ok:false`, leave state unchanged, store an `invalid` inline status, render, and restore focus to the rejected field. Deadspace edits continue using current soft-warning behavior.

- [ ] **Step 5: Reorder `selectedEquipmentPanel()`**

Render sections in this exact order:

1. Header and placement status.
2. Rotate, Duplicate, and Center quick actions.
3. X/Y position and measured footprint.
4. Deadspace override, sides, and clearance visibility.
5. Ceiling and power checks.
6. Product link.
7. Collapsed 3D Model and Local GLB sections.
8. Edit equipment details.
9. Remove from this layout.

Use semantic headings and buttons at least 44 pixels high. Move the existing 3D fields without changing their data attributes.

- [ ] **Step 6: Wire actions and inline status**

```js
if(t.dataset.action==="duplicateInst" || t.dataset.action==="centerInst"){
  const result=t.dataset.action==="duplicateInst"
    ? duplicatePlacement(t.dataset.id)
    : centerPlacementInRoom(t.dataset.id);
  state.layoutWorkspace.status={kind:result.ok?"saved":"invalid",message:result.message};
  render();
  return;
}
if(t.dataset.action==="toggle_layout_advanced"){
  const key=t.dataset.section||"";
  state.layoutWorkspace.openAdvancedSection=state.layoutWorkspace.openAdvancedSection===key?"":key;
  render();
  return;
}
```

- [ ] **Step 7: Run tests and placement workflows**

Run: `node --test tests/layout-editor-core.test.cjs && node --check app.js && node --check layout.js && node --check events.js`
Expected: all tests PASS and syntax checks exit 0.

In the browser, prove valid and invalid outcomes for duplicate and center; verify Rotate, X/Y, deadspace, ceiling, power, model, and remove controls still update the selected instance without moving the page.

- [ ] **Step 8: Commit only Task 5 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p app.js layout.js events.js index.html
git diff --cached --name-only
git diff --cached
git commit -m "feat: improve layout placement inspector"
```

### Task 6: Shared Grouped Equipment Form and In-Layout Details Editor

**Files:**
- Modify: `panels.js:281-506`
- Modify: `layout.js: equipmentDetailsEditor()`
- Modify: `events.js:47-260,1400-1680`
- Modify: `app.js: transient editor state only`
- Modify: `index.html: dialog/editor styles`
- Test: `tests/layout-editor-core.test.cjs`

**Interfaces:**
- Consumes: existing `state.draft`, `state.editingId`, `readDraftFromForm()`, item normalization, image/GLB upload flows, and `LayoutEditorCore.draftChanged()`.
- Produces: `equipmentFormSections(currency,{context})`, `equipmentDetailsEditor(currency)`, `openLayoutEquipmentEditor(itemId)`, `closeLayoutEquipmentEditor({force})`, and actions `open_layout_item_editor`, `close_layout_item_editor`, `save_layout_item_editor`.

- [ ] **Step 1: Add a failing normalized dirty-state test**

```js
test("draftChanged ignores object key order but detects nested changes", () => {
  assert.equal(core.draftChanged({name:"Rack",tags:["Back"],qty:1},{qty:1,tags:["Back"],name:"Rack"}),false);
  assert.equal(core.draftChanged({name:"Rack",tags:["Back"]},{name:"Rack",tags:["Back","Legs"]}),true);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="key order" tests/layout-editor-core.test.cjs`
Expected: FAIL because raw `JSON.stringify` treats key order as meaningful.

- [ ] **Step 3: Implement stable normalization for dirty comparison**

```js
function stableValue(value){
  if(Array.isArray(value)) return value.map(stableValue);
  if(value && typeof value==="object") return Object.keys(value).sort().reduce((out,key)=>{
    out[key]=stableValue(value[key]); return out;
  },{});
  return value;
}
function draftChanged(a,b){ return JSON.stringify(stableValue(a||{}))!==JSON.stringify(stableValue(b||{})); }
```

- [ ] **Step 4: Extract one reusable grouped form renderer**

Refactor `itemForm(currency)` so it calls:

```js
function equipmentFormSections(currency,{context="wishlist"}={}){
  return [
    equipmentBasicsSection(currency,context),
    equipmentMeasurementsSection(currency,context),
    equipmentCostPowerSection(currency,context),
    equipmentRackSection(currency,context),
    equipmentMedia3dSection(currency,context),
    equipmentExerciseSection(currency,context),
    equipmentNotesColorSection(currency,context),
  ].join("");
}
```

Wishlist keeps its current card shell and uses `context:"wishlist"`. The in-layout editor uses `context:"layout"`. All input IDs and data attributes used by `readDraftFromForm()` remain identical so save logic is shared.

- [ ] **Step 5: Render the in-layout editor dialog**

```js
function equipmentDetailsEditor(currency){
  if(!state.layoutWorkspace.detailsEditorOpen) return "";
  const item=getItemById(state.layoutWorkspace.detailsEditorItemId);
  if(!item) return "";
  return `<div class="equipmentEditorOverlay" role="presentation">
    <section class="equipmentEditor" role="dialog" aria-modal="true" aria-labelledby="equipmentEditorTitle">
      <header><h2 id="equipmentEditorTitle">Edit ${escapeHtml(item.name)}</h2>
        <button class="iconBtn" data-action="close_layout_item_editor" aria-label="Close equipment editor">×</button>
      </header>
      <div class="equipmentEditorBody">${equipmentFormSections(currency,{context:"layout"})}</div>
      <footer>
        <button class="btn" data-action="close_layout_item_editor">Cancel</button>
        <button class="btn primary" data-action="save_layout_item_editor" ${String(state.draft.name||"").trim()?"":"disabled"}>Save changes</button>
      </footer>
    </section>
  </div>`;
}
```

- [ ] **Step 6: Extract one save function and implement open, dirty close, and save lifecycle**

Extract the current `saveItemBtn` record-update logic into a non-rendering function used by both Wishlist and Layout:

```js
function commitEquipmentDraft(payload,itemId){
  if(!String(payload.name||"").trim()) return {ok:false,message:"Item name is required."};
  const lower=new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
  if(payload.category&&!lower.has(payload.category.toLowerCase())) state.categories.push(payload.category);
  if(itemId){
    const existing=state.items.find(x=>x.id===itemId);
    if(!existing) return {ok:false,message:"This equipment record no longer exists."};
    const previousAssetRef=String(existing.model3dAssetRef||"");
    state.items=state.items.map(x=>x.id===itemId?{...existing,...payload,id:itemId}:x);
    setPendingDraftModelAsset("");
    if(previousAssetRef&&previousAssetRef!==payload.model3dAssetRef) removeUnreferencedModelAsset(previousAssetRef);
    return {ok:true,item:state.items.find(x=>x.id===itemId)};
  }
  const item={...DEFAULT_ITEM,...payload,id:uid("item"),createdAt:Date.now()};
  state.items=[item,...state.items];
  setPendingDraftModelAsset("");
  return {ok:true,item};
}
```

Open and close the in-layout editor with explicit state:

```js
function openLayoutEquipmentEditor(itemId){
  const item=getItemById(itemId);
  if(!item) return;
  discardPendingDraftModelAsset();
  state.editingId=itemId;
  state.draft={...DEFAULT_ITEM,...item};
  Object.assign(state.layoutWorkspace,{
    detailsEditorOpen:true, detailsEditorItemId:itemId,
    detailsEditorBaseline:deepCopy(state.draft), detailsEditorDirty:false,
    discardEditorConfirmOpen:false,
    returnFocusSelector:`[data-action="open_layout_item_editor"][data-id="${itemId}"]`,
  });
  render();
}

function resetLayoutEquipmentEditor(){
  discardPendingDraftModelAsset();
  state.editingId=null;
  state.draft={...DEFAULT_ITEM};
  Object.assign(state.layoutWorkspace,{
    detailsEditorOpen:false,detailsEditorItemId:null,detailsEditorBaseline:null,
    detailsEditorDirty:false,discardEditorConfirmOpen:false,
  });
}

function closeLayoutEquipmentEditor({force=false}={}){
  const current=state.layoutWorkspace.detailsEditorOpen ? readDraftFromForm() : state.draft;
  const dirty=LayoutEditorCore.draftChanged(current,state.layoutWorkspace.detailsEditorBaseline);
  if(dirty&&!force){ state.layoutWorkspace.discardEditorConfirmOpen=true; render(); return false; }
  const focusSelector=state.layoutWorkspace.returnFocusSelector;
  resetLayoutEquipmentEditor();
  render();
  requestAnimationFrame(()=>document.querySelector(focusSelector)?.focus());
  return true;
}
```

Render a nested confirmation dialog when `discardEditorConfirmOpen` is true, with `data-action="keep_layout_item_editing"` and `data-action="discard_layout_item_changes"`. **Keep editing** only closes the confirmation. **Discard changes** calls `closeLayoutEquipmentEditor({force:true})`. Do not use browser `confirm()`.

Wire save through the shared commit function:

```js
if(t.dataset.action==="save_layout_item_editor"){
  const payload=readDraftFromForm();
  const result=commitEquipmentDraft(payload,state.layoutWorkspace.detailsEditorItemId);
  if(!result.ok){
    state.layoutWorkspace.status={kind:"invalid",message:result.message};
    render();
    requestAnimationFrame(()=>$("#f_name")?.focus());
    return;
  }
  const focusSelector=state.layoutWorkspace.returnFocusSelector;
  resetLayoutEquipmentEditor();
  state.layoutWorkspace.status={kind:"saved",message:"Equipment details saved."};
  render();
  requestAnimationFrame(()=>document.querySelector(focusSelector)?.focus());
  return;
}
```

Update the existing Wishlist `saveItemBtn` branch to call `commitEquipmentDraft(readDraftFromForm(),state.editingId)`, then perform its existing reset and render behavior.

- [ ] **Step 7: Add sticky layout and focus styles**

```css
.equipmentEditorOverlay{position:fixed;inset:0;z-index:400;background:rgba(15,23,42,.5);display:flex;justify-content:flex-end}
.equipmentEditor{width:min(620px,100vw);height:100%;background:#fff;display:grid;grid-template-rows:auto minmax(0,1fr) auto;box-shadow:-24px 0 60px rgba(15,23,42,.24)}
.equipmentEditorBody{overflow:auto;padding:18px}
.equipmentEditor>header,.equipmentEditor>footer{background:#fff;border-color:var(--border);padding:14px 18px}
.equipmentEditor>header{border-bottom:1px solid var(--border)}
.equipmentEditor>footer{border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}
```

- [ ] **Step 8: Run tests and edit/save/cancel workflows**

Run: `node --test tests/layout-editor-core.test.cjs && node --check panels.js && node --check layout.js && node --check events.js`
Expected: all tests PASS and syntax checks exit 0.

In the browser:

- Open equipment details from a selected placement.
- Confirm Save and Cancel remain visible while the form body scrolls.
- Edit and save name/dimensions; confirm the selected placement remains selected and Plan/3D refresh.
- Make a dirty edit, cancel, choose Keep editing, cancel again, choose Discard changes, and verify the saved record is unchanged.
- Confirm focus returns to the editor trigger.

- [ ] **Step 9: Commit only Task 6 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p panels.js layout.js events.js app.js index.html
git diff --cached --name-only
git diff --cached
git commit -m "feat: edit equipment within layout workspace"
```

### Task 7: Responsive Drawers, Mobile Sheet, and Accessibility

**Files:**
- Modify: `layout.js: responsive triggers and wrappers`
- Modify: `events.js: drawer/dialog keyboard and focus handling`
- Modify: `render.js: focus restoration`
- Modify: `index.html: responsive and accessibility styles`
- Test: `tests/layout-editor-core.test.cjs`

**Interfaces:**
- Consumes: `state.layoutWorkspace.libraryDrawerOpen`, `inspectorDrawerOpen`, existing selection state, and Task 6 dialog lifecycle.
- Produces: actions `toggle_layout_library`, `toggle_layout_inspector`, `close_layout_drawer`; helpers `closeLayoutDrawers()` and `containFocus(event,root)`; Escape handling; compact and mobile presentation.

- [ ] **Step 1: Add a failing drawer-state reducer test**

```js
test("toggleDrawer keeps compact drawers mutually exclusive", () => {
  let state={libraryDrawerOpen:false,inspectorDrawerOpen:false};
  state=core.toggleDrawer(state,"library");
  assert.deepEqual(state,{libraryDrawerOpen:true,inspectorDrawerOpen:false});
  state=core.toggleDrawer(state,"inspector");
  assert.deepEqual(state,{libraryDrawerOpen:false,inspectorDrawerOpen:true});
  state=core.toggleDrawer(state,"inspector");
  assert.deepEqual(state,{libraryDrawerOpen:false,inspectorDrawerOpen:false});
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test --test-name-pattern="mutually exclusive" tests/layout-editor-core.test.cjs`
Expected: FAIL because `toggleDrawer` is not defined.

- [ ] **Step 3: Implement and export the drawer reducer**

```js
function toggleDrawer(state,which){
  const next={libraryDrawerOpen:false,inspectorDrawerOpen:false};
  if(which==="library") next.libraryDrawerOpen=!state.libraryDrawerOpen;
  if(which==="inspector") next.inspectorDrawerOpen=!state.inspectorDrawerOpen;
  return {...state,...next};
}
```

- [ ] **Step 4: Render compact toolbar triggers and drawer semantics**

Above the workspace render:

```html
<div class="layoutMobileToolbar">
  <button class="btn" data-action="toggle_layout_library" aria-expanded="false">Equipment <span class="countBadge">${model.rows.length}</span></button>
  <button class="btn" data-action="toggle_layout_inspector" aria-expanded="false">Inspector <span class="srOnly">for ${escapeHtml(model.selectionLabel)}</span></button>
</div>
```

At `760–1179px`, present library and inspector as right/left modal side drawers. Below `760px`, present the library as a full-height sheet and the inspector as a bottom sheet with a collapsed header and quick actions.

- [ ] **Step 5: Wire mutual exclusion, Escape, focus trap, and restoration**

Use `LayoutEditorCore.toggleDrawer()` for trigger actions. Store the opening trigger in `state.layoutWorkspace.returnFocusSelector`. On drawer/dialog open, focus its heading or first control. Define the shared close and focus-containment helpers:

```js
function closeLayoutDrawers(){
  const selector=state.layoutWorkspace.returnFocusSelector;
  state.layoutWorkspace.libraryDrawerOpen=false;
  state.layoutWorkspace.inspectorDrawerOpen=false;
  render();
  requestAnimationFrame(()=>document.querySelector(selector)?.focus());
}

function containFocus(event,root){
  if(event.key!=="Tab"||!root) return;
  const controls=[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(el=>el.offsetParent!==null);
  if(!controls.length){ event.preventDefault(); root.focus(); return; }
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){ event.preventDefault(); last.focus(); }
  else if(!event.shiftKey&&document.activeElement===last){ event.preventDefault(); first.focus(); }
}
```

Wire the drawer click actions through the pure reducer:

```js
if(t.dataset.action==="toggle_layout_library"||t.dataset.action==="toggle_layout_inspector"){
  const which=t.dataset.action==="toggle_layout_library"?"library":"inspector";
  state.layoutWorkspace=LayoutEditorCore.toggleDrawer(state.layoutWorkspace,which);
  state.layoutWorkspace.returnFocusSelector=`[data-action="${t.dataset.action}"]`;
  render();
  requestAnimationFrame(()=>document.querySelector(which==="library"?".layoutLibraryDrawer":".layoutInspectorDrawer")?.focus());
  return;
}
if(t.dataset.action==="close_layout_drawer"){
  closeLayoutDrawers();
  return;
}
```

In the delegated key handler, choose the active `.equipmentEditor`, `.layoutLibraryDrawer`, or `.layoutInspectorDrawer` and call `containFocus(e,activeRoot)` before other Tab handling. On Escape, close the topmost editor/drawer, then restore focus to the trigger.

Add a single document key handler guard:

```js
if(e.key==="Escape"){
  if(state.layoutWorkspace.detailsEditorOpen){ closeLayoutEquipmentEditor({force:false}); return; }
  if(state.layoutWorkspace.libraryDrawerOpen||state.layoutWorkspace.inspectorDrawerOpen){ closeLayoutDrawers(); return; }
}
```

- [ ] **Step 6: Add responsive and accessible semantics and CSS**

Implement exact breakpoints from Global Constraints. Add `.srOnly`, `:focus-visible` outlines, 44-pixel minimum controls in drawers/inspector, a non-color icon/text status treatment, overscroll containment, and reduced-motion overrides. At 200% zoom, switch to the compact drawer layout rather than horizontally clipping the three columns.

Render saved/warning/invalid messages inside `<div role="status" aria-live="polite" aria-atomic="true">`. Give modal drawers `role="dialog" aria-modal="true"` only at breakpoints where they overlay the canvas. Give the dirty-draft confirmation `role="alertdialog"`, focus its **Keep editing** button on open, and connect every validation summary item to its field with an anchor or `aria-describedby`.

- [ ] **Step 7: Run tests and responsive accessibility checks**

Run: `node --test tests/layout-editor-core.test.cjs && node --check layout.js && node --check events.js && node --check render.js`
Expected: all tests PASS and syntax checks exit 0.

Browser checks:

- `1440×900`: persistent three columns.
- `1024×768`: canvas plus mutually exclusive side drawers.
- `390×844`: equipment full-height sheet and inspector bottom sheet.
- Keyboard-only: open/close drawers and editor, traverse controls, Escape, focus restoration.
- Browser zoom 200%: no hidden Save, Cancel, Equipment, or Inspector controls.
- Reduced motion: drawer/editor transitions become effectively immediate.

- [ ] **Step 8: Commit only Task 7 files**

```bash
git add layout-editor-core.js tests/layout-editor-core.test.cjs
git add -p layout.js events.js render.js index.html
git diff --cached --name-only
git diff --cached
git commit -m "feat: make layout workspace responsive and accessible"
```

### Task 8: Final Regression and Documentation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify only if a verified defect requires it: `app.js`, `panels.js`, `layout.js`, `events.js`, `render.js`, `index.html`, `layout-editor-core.js`
- Test: `tests/layout-editor-core.test.cjs`

**Interfaces:**
- Consumes: the completed workspace and all existing planner flows.
- Produces: fresh automated and rendered verification evidence, final cache versions, and architecture documentation.

- [ ] **Step 1: Run the complete automated baseline**

Run:

```bash
node --test tests/layout-editor-core.test.cjs
node --check layout-editor-core.js
node --check app.js
node --check panels.js
node --check layout.js
node --check events.js
node --check render.js
```

Expected: every test PASS and every syntax check exits 0.

- [ ] **Step 2: Run the core rendered interaction loop at desktop size**

Using the in-app Browser at `1440×900`, verify:

1. Page URL/title and meaningful Layout content.
2. No framework/error overlay.
3. No relevant console warnings or errors.
4. Search → add → select → reposition → rotate → duplicate → clearance → full details edit → save → remove.
5. Selection changes do not move document scroll.
6. Library and inspector scroll positions survive re-renders.
7. Plan, Split, 3D, Focus canvas, staging, compare, and walkthrough still respond.

Capture screenshots for no selection, equipment selected, full editor open, compact drawer, and mobile bottom sheet.

- [ ] **Step 3: Run existing non-equipment inspector regressions**

Create/select/edit/remove an area, outlet, wall extension, ceiling zone, floor zone, and flooring piece. Switch layouts, duplicate a layout, and exercise export/import with a disposable exported file. Confirm no durable workspace-only fields appear in the JSON.

- [ ] **Step 4: Fix each observed defect test-first**

For a pure-state defect, add the smallest failing case to `tests/layout-editor-core.test.cjs`, run it to confirm failure, implement the fix, and rerun the suite. For a DOM-only defect, record the exact Browser reproduction and add a stable semantic state check after the fix.

- [ ] **Step 5: Update architecture docs**

Add `layout-editor-core.js` to the architecture dependency order and document:

- Three-region layout composition.
- Context inspector routing.
- Shared equipment-form sections.
- Transient versus durable state.
- Desktop, compact, and mobile modes.

- [ ] **Step 6: Repeat full verification after final edits**

Rerun every command in Step 1 and repeat the desktop core interaction plus one compact and one mobile interaction. Expected: zero test failures, zero syntax failures, no relevant console errors, and correct visible state after every interaction.

- [ ] **Step 7: Commit the verified integration**

```bash
git add ARCHITECTURE.md tests/layout-editor-core.test.cjs layout-editor-core.js
git add -p app.js panels.js layout.js events.js render.js index.html
git diff --cached --name-only
git diff --cached
git diff --cached --check
git commit -m "docs: finalize canvas-first layout editor"
```

- [ ] **Step 8: Inspect final history and untouched user changes**

Run: `git status --short && git log --oneline -10`
Expected: the canvas-first commits are present; any pre-existing unrelated user files remain unmodified or are included only when the user explicitly identifies them as prerequisites for this feature.
