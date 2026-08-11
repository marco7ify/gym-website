# Placeable Wall Features and Layout 3 Decoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable mirrors, wood slat panels, and LED strips to all layouts, then seed the approved black-wall decoration into Layout 3 without changing equipment measurements or floor placement.

**Architecture:** Add one dependency-free `GymWallFeatures` domain component that owns normalization, feet/inches math, base-wall placement, validation, and starter data. The existing state, Plan renderer, event layer, and Three.js renderer consume that single API so wall openings and room extensions have the same meaning in every view. Store features on each layout, render them as shallow wall-mounted objects, and keep them out of floor-area and collision calculations.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, classic browser globals loaded by `gltf-runtime.js`, Three.js, localStorage JSON persistence, a dependency-free browser test runner, Node syntax checks, and browser visual verification.

## Global Constraints

- Keep Layout 3 walls black and its floor `rolled-rubber`; do not force either setting on Layouts 1 or 2.
- Preserve all imported equipment positions, footprints, heights, facing values, and IDs.
- Wall features mount only to the four named base-room walls: `top`, `right`, `bottom`, and `left`.
- A wall feature never subtracts floor area, blocks equipment placement, or adds Walkthrough collision.
- Invalid features remain editable in Plan mode and do not render as floating 3D objects.
- Mirrors use a polished physical material, not a live planar-reflection render pass.
- LED strips are straight rectangles; cap feature-created point lights at eight per 3D view.
- Export schema advances from version 11 to version 12 and continues to omit `settings.aiApiKey`.
- Seed the seven approved starter features only when a named Layout 3 record lacks the `wallFeatures` property; a deliberately empty array must stay empty.
- Preserve the current classic-script architecture and add no package-manager dependency.
- Existing dirty worktree changes are user work; inspect and stage only task-owned hunks.

## File Structure

- Create `wall-features.js` — dependency-free constants, defaults, normalization, base-wall transforms, validation, and Layout 3 starter data exposed as `window.GymWallFeatures`.
- Create `tests/test-harness.js` — minimal `test`, `assert`, `equal`, `deepEqual`, `closeTo`, and final result reporting helpers.
- Create `tests/planner-logic-runner.html` — loads the domain component, planner scripts, and focused logic tests without starting the full renderer.
- Create `tests/wall-features.test.js` — normalization, validation, migration, plan-rectangle, transform, and starter-data assertions.
- Modify `gltf-runtime.js` — load `wall-features.js` before `app.js` and bump only changed script cache keys.
- Modify `app.js` — layout schema, named-layout migration, selection clearing, and normalized persistence.
- Modify `events.js` — add/edit/remove/nudge actions, constrained drag, new-layout copying, import/export version 12.
- Modify `layout.js` — tools, selected-feature inspector, dimension overlay, SVG rendering, and selection affordances.
- Modify `view3d.js` — mirror/slat/LED builders, selection, warnings, metadata, framing, and minimap.
- Modify `index.html` — Plan styling and accessible selected/invalid states.
- Modify `panels.js` — one Quick Start note explaining wall finishes.

---

### Task 1: Build the wall-feature domain component and test harness

**Files:**
- Create: `wall-features.js`
- Create: `tests/test-harness.js`
- Create: `tests/planner-logic-runner.html`
- Create: `tests/wall-features.test.js`
- Modify: `gltf-runtime.js:20-29`

**Interfaces:**
- Consumes: plain layout records and room records shaped as `{W, L, ceiling, rects}`.
- Produces: `window.GymWallFeatures` with `KINDS`, `SIDES`, `DEFAULTS`, `totalFt()`, `splitFtIn()`, `start()`, `bottom()`, `width()`, `height()`, `wallLength()`, `floorElevationAt()`, `normalize()`, `planRect()`, `worldTransform()`, `validate()`, and `layout3Starter()`.

- [ ] **Step 1: Create the browser test harness and a failing domain test**

Create a runner whose final state is machine-readable:

```html
<!doctype html>
<meta charset="utf-8">
<title>Gym Planner Logic Tests</title>
<pre id="test-results" data-complete="false" data-failures="0">Running…</pre>
<script src="./test-harness.js"></script>
<script src="../wall-features.js"></script>
<script src="../app.js"></script>
<script src="../panels.js"></script>
<script src="../layout.js"></script>
<script src="../events.js"></script>
<script src="./wall-features.test.js"></script>
<script>GymTests.finish();</script>
```

Implement `test-harness.js` so each assertion throws, failures are collected, and `finish()` writes `data-complete="true"` and the exact failure count to `#test-results`.

Start `wall-features.test.js` with these failing assertions:

```js
GymTests.test("normalizes a mirror", () => {
  const f = GymWallFeatures.normalize(
    {kind:"mirror", wall:"bottom", startFt:2, widthFt:5, heightFt:5, heightIn:6, bottomFt:1, bottomIn:6, color:"#CBD5E1"},
    {W:19+10/12, L:19.5, ceiling:9, rects:[{x:0,y:0,w:19+10/12,h:19.5}]},
    () => "wf_test"
  );
  GymTests.equal(f.id, "wf_test");
  GymTests.equal(f.color, "#cbd5e1");
  GymTests.closeTo(GymWallFeatures.height(f), 5.5, 1e-9);
});

GymTests.test("maps bottom-wall plan coordinates", () => {
  const rect = GymWallFeatures.planRect({wall:"bottom",startFt:2,widthFt:5}, {W:20,L:19.5});
  GymTests.deepEqual(rect, {x:2,y:19.28,w:5,h:.22});
});
```

- [ ] **Step 2: Run the runner and verify the missing component fails**

Run:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/tests/planner-logic-runner.html`. Expected: `data-complete="true"` with at least one failure mentioning `GymWallFeatures`.

- [ ] **Step 3: Implement exact constants, defaults, and feet/inches normalization**

Create an IIFE with no planner-global dependency:

```js
(function(){
  "use strict";
  const KINDS=["mirror","slat","led"];
  const SIDES=["top","right","bottom","left"];
  const DEFAULTS={
    mirror:{label:"Mirror",wall:"top",start:1,bottom:1.5,width:6,height:5,color:"#cbd5e1",brightnessPct:0},
    slat:{label:"Wood slat panel",wall:"top",start:1,bottom:0,width:6,height:8,color:"#9a653b",brightnessPct:0},
    led:{label:"LED strip",wall:"top",start:1,bottom:7.5,width:8,height:1/12,color:"#ffb36b",brightnessPct:75},
  };
  // Define the functions listed in Interfaces, then freeze the public object.
  window.GymWallFeatures=Object.freeze({KINDS,SIDES,DEFAULTS,totalFt,splitFtIn,start,bottom,width,height,wallLength,floorElevationAt,normalize,planRect,worldTransform,validate,layout3Starter});
})();
```

`normalize(feature, room, makeId, layout={})` must lowercase valid colors, replace invalid colors with the type default, clamp brightness to 0–100, enforce a 1-inch minimum for LEDs and 6-inch minimum for mirrors/slats, clamp the run to its wall length, and clamp `bottom + height` to `room.ceiling-floorElevationAt(layout,wallCenterX,wallCenterY)`.

- [ ] **Step 4: Add failing tests for all wall mappings and validation cases**

Add assertions for:

```js
GymTests.deepEqual(GymWallFeatures.planRect({wall:"top",startFt:1,widthFt:4},{W:20,L:19.5}), {x:1,y:0,w:4,h:.22});
GymTests.deepEqual(GymWallFeatures.planRect({wall:"left",startFt:3,widthFt:5},{W:20,L:19.5}), {x:0,y:3,w:.22,h:5});
GymTests.deepEqual(GymWallFeatures.planRect({wall:"right",startFt:3,widthFt:5},{W:20,L:19.5}), {x:19.78,y:3,w:.22,h:5});
```

Use a Layout 3-shaped room and layout to assert that `validate()` returns reason codes `door-overlap` for top x=12.5–15.5833 and `missing-wall` for left y=14.25–19.5. Assert `above-ceiling` for a high strip over the 4-inch raised floor. Also assert that the approved bottom and right mirrors return `{valid:true,reasons:[]}`.

- [ ] **Step 5: Implement shared validation and 3D transform math**

`floorElevationAt(layout,x,y)` must return the greatest `elevationIn/12` for any floor zone containing the point. `validate(feature, layout, room)` must return:

```js
{ valid: reasons.length===0, reasons: [{code, message}] }
```

For a physical-wall check, sample the feature run at both endpoints and every 3 inches between them. At each sample, compare points 0.01 ft inside and outside the selected base wall against `room.rects`; exactly one point must be inside. Separately compare the one-dimensional feature run with any `door` or `garagedoor` opening touching that base wall.

`worldTransform()` must return `{x,y,z,rotationY,width,height,depth:.08}` using:

```js
top:    {x:start+width/2, z:.08,        rotationY:0}
bottom: {x:start+width/2, z:room.L-.08, rotationY:Math.PI}
left:   {x:.08,             z:start+width/2, rotationY:Math.PI/2}
right:  {x:room.W-.08,      z:start+width/2, rotationY:-Math.PI/2}
```

Set `y=floorElevation + bottom + height/2`.

- [ ] **Step 6: Encode and test the seven approved Layout 3 starter features**

`layout3Starter()` must return a fresh deep copy containing stable layout-scoped IDs `wf_l3_primary_mirror`, `wf_l3_aisle_mirror`, `wf_l3_gazelle_slats`, `wf_l3_slat_led_left`, `wf_l3_slat_led_right`, `wf_l3_mirror_wash`, and `wf_l3_cardio_strip`. The records use these exact measurements: bottom mirror 2′0″/1′6″/5′0″×5′6″; right mirror 11′0″/1′6″/4′0″×5′6″; bottom walnut slats 12′9″/0′0″/6′9″×8′6″; vertical LEDs at 12′7″ and 19′7″, each 1″×8′0″ mounted 4″; bottom mirror wash 2′0″/7′3″/5′0″×1″; top cardio strip 2′9″/8′4″/9′6″×1″. Assert IDs, kinds, colors, brightness values, and measurements.

- [ ] **Step 7: Load the component before the planner and verify tests pass**

Insert `./wall-features.js?v=1` before `./app.js` in `classicScripts`. Run the browser runner and expect `data-failures="0"`. Then run:

```bash
node --check wall-features.js
node --check tests/test-harness.js
node --check tests/wall-features.test.js
git diff --check
```

- [ ] **Step 8: Commit the isolated domain component**

Stage the new files and only the `gltf-runtime.js` load-order hunk, inspect `git diff --cached`, then commit:

```bash
git commit -m "feat: add wall feature domain model"
```

---

### Task 2: Persist, migrate, seed, duplicate, import, and export wall features

**Files:**
- Modify: `app.js:931-969,1108-1215,1415-1490,2580-2590`
- Modify: `events.js:683-739,910-940,1121-1146`
- Modify: `tests/wall-features.test.js`

**Interfaces:**
- Consumes: `GymWallFeatures.normalize()` and `GymWallFeatures.layout3Starter()`.
- Produces: `wallFeatureRoomData(layout, settings)`, `normalizeNamedLayout(name, rawLayout, settings)`, normalized `layout.wallFeatures`, and `layout.selectedWallFeatureId`.

- [ ] **Step 1: Write failing normalization and one-time seeding tests**

Add tests that call `normalizeLayout()` and `normalizeNamedLayout()`:

```js
const old = normalizeNamedLayout("Layout 3", {instances:[],areas:[]}, DEFAULT_SETTINGS);
GymTests.equal(old.wallFeatures.length, 7);
const intentionallyEmpty = normalizeNamedLayout("Layout 3", {instances:[],areas:[],wallFeatures:[]}, DEFAULT_SETTINGS);
GymTests.equal(intentionallyEmpty.wallFeatures.length, 0);
const other = normalizeNamedLayout("Layout 2", {instances:[],areas:[]}, DEFAULT_SETTINGS);
GymTests.equal(other.wallFeatures.length, 0);
```

Also assert a stale `selectedWallFeatureId` is cleared and a valid ID is retained.

- [ ] **Step 2: Add the layout schema and normalization**

Add `wallFeatures:[]` and `selectedWallFeatureId:null` to `DEFAULT_LAYOUT`. Add `wallFeatureRoomData(layout,settings)` that returns `{W,L,ceiling,rects}` from the supplied settings plus the base rectangle and `wallExtToRect()` output; it must not read active `state.layout`. In `normalizeLayout()`, normalize every feature with that room record, the layout’s floor zones, and `uid("wf")`; remove malformed entries; and clear selection if the selected ID is absent.

Add:

```js
function normalizeNamedLayout(name, rawLayout, settings){
  const source=rawLayout && typeof rawLayout==="object" ? rawLayout : {};
  const hadWallFeatures=Object.prototype.hasOwnProperty.call(source,"wallFeatures");
  const normalized=normalizeLayout(source,settings);
  if(!hadWallFeatures && String(name||"").trim().toLowerCase()==="layout 3"){
    normalized.wallFeatures=GymWallFeatures.layout3Starter();
  }
  return normalized;
}
```

- [ ] **Step 3: Route named layout initialization and imports through the migration**

Use `normalizeNamedLayout(x.name, x.layout || x.data || x, settings)` when building `state.layouts` and when importing a `layouts` array. Keep unnamed standalone `layout` normalization unseeded. On layout switch, clear `selectedWallFeatureId` with the other transient selections.

- [ ] **Step 4: Copy wall features with the architectural shell**

In `layout_new`, copy independent deep copies of `wallExtensions`, `areas`, `outlets`, `ceilingZones`, `floorZones`, `flooringPieces`, `wallFeatures`, and `spatial3d`, while keeping `instances:[]`; layout duplication already copies the whole layout. Extend `clearAllSelections()` to clear the feature selection. Confirm selection never leaks between layouts.

- [ ] **Step 5: Advance every JSON export mode to version 12**

Change all three `version:11` literals in `exportPayloadFromState()` to `version:12`. Retain `settingsForExport()` unchanged so `aiApiKey` remains excluded.

- [ ] **Step 6: Run persistence and round-trip tests**

In the browser runner, assert `normalizeLayout(deepCopy(normalized))` preserves exact feet/inches totals. In the app, duplicate Layout 3, export all layouts, re-import the file, and confirm all seven features remain while a deliberately emptied Layout 3 stays empty after reload.

- [ ] **Step 7: Verify and commit persistence**

Run:

```bash
node --check app.js
node --check events.js
git diff --check
```

Stage only the schema/migration/export hunks and test changes, inspect the cached diff, then commit:

```bash
git commit -m "feat: persist and seed wall decorations"
```

---

### Task 3: Add Plan rendering, selection, editing, and constrained dragging

**Files:**
- Modify: `layout.js:16-60,248-490,540-890,957-1040,1335-1585`
- Modify: `events.js:20-55,1120-1300,2080-2240,2540-2990`
- Modify: `index.html:560-620,2039-2205,2820-2890`
- Modify: `panels.js:809-815`
- Modify: `tests/wall-features.test.js`

**Interfaces:**
- Consumes: normalized `layout.wallFeatures` and `GymWallFeatures.planRect()/validate()`.
- Produces: `wallFeatureSvg()`, `selectedWallFeaturePanel()`, `addWallFeature(kind)`, `patchWallFeature(id, patch)`, and `removeWallFeature(id)`.

- [ ] **Step 1: Write failing HTML/SVG rendering tests**

Load `layout.js` in the runner and assert:

```js
const svg=wallFeatureSvg({id:"wf1",kind:"mirror",wall:"bottom",startFt:2,widthFt:5}, {W:20,L:19.5}, true, {valid:true,reasons:[]});
GymTests.assert(svg.includes('data-type="wallfeature"'));
GymTests.assert(svg.includes('data-id="wf1"'));
GymTests.assert(svg.includes('aria-label="Mirror"'));
```

Add equivalent assertions for `slat`, `led`, selected state, and invalid state. Assert `selectedWallFeaturePanel()` includes wall, start, bottom, width, height, color, and LED brightness controls.

- [ ] **Step 2: Render selectable feature marks in the floor plan**

Create a `g[data-type="wallfeature"]` for each feature after room/wall-extension geometry and before equipment. Use a 0.22-ft projected strip. Mirror gets a cyan double line and `M`; slat gets ochre fill plus repeated hatch ticks and `SLAT`; LED gets a wide translucent color stroke under a narrow bright stroke and `LED`. Add `<title>`, `role="button"`, `tabindex="0"`, and a selected outline.

- [ ] **Step 3: Add tools and the selected-feature inspector**

Add a **Wall finishes & lighting** group in Layout Tools with `add_wall_feature` buttons for Mirror, Wood slat panel, and LED strip. `addWallFeature(kind)` creates the default, normalizes it, selects it, and renders.

The inspector must expose type, label, wall, along-wall feet/inches, mounting-height feet/inches, width feet/inches, height feet/inches, type-aware color label, LED-only brightness range/number, ±1-inch and ±6-inch nudge buttons, and Remove. Include the exact helper copy: “Top/bottom measure from the left; left/right measure from the top.”

- [ ] **Step 4: Wire edits through one normalized patch function**

Implement:

```js
function patchWallFeature(id, patch){
  state.layout.wallFeatures=(state.layout.wallFeatures||[]).map(feature=>{
    if(feature.id!==id) return feature;
    return GymWallFeatures.normalize({...feature,...patch}, wallFeatureRoomData(), ()=>id, state.layout);
  });
  render();
}
```

Route all delegated inputs, wall changes, color, brightness, nudges, and Remove through this function. Clear every other selection when a wall feature is selected.

- [ ] **Step 5: Add one-dimensional pointer dragging**

On pointer down, set `state.drag.type="wallfeature"`, capture its original start, and select it. During pointer move, use only SVG `dx` for top/bottom or `dy` for left/right; clamp start to `0..wallLength-width`; split the total back into feet/inches; do not change wall or mounting height. On pointer up, keep the final valid clamped position and reset drag state.

- [ ] **Step 6: Extend dimension overlay, framing conditions, and help copy**

Show feature kind, wall, along-wall offset, mount height, and W×H in `layoutDimOverlaySvg()`. Include `selectedWallFeatureId` in the “Frame selected” condition. Add one Quick Start bullet explaining that wall finishes are placed from Layout Tools and dragged along their chosen wall.

- [ ] **Step 7: Add accessible visual styles and verify interaction**

Add classes for each type, selected and invalid outlines, toolbar buttons, inspector warning, keyboard focus, and mobile wrapping. Verify 44px minimum action targets and visible focus. In Plan mode add, edit, drag, nudge, switch walls, and remove each type on all four walls; confirm invalid left-extension and door overlaps are red and remain editable.

- [ ] **Step 8: Run checks and commit the Plan editor**

Run the logic runner, `node --check layout.js`, `node --check events.js`, and `git diff --check`. Stage only Plan/UI hunks and commit:

```bash
git commit -m "feat: add wall finish plan editor"
```

---

### Task 4: Render and select mirrors, slats, and LEDs in 3D

**Files:**
- Modify: `view3d.js:62-175,480-850,2058-2285,2355-2390,2430-2470`
- Modify: `tests/wall-features.test.js`

**Interfaces:**
- Consumes: `GymWallFeatures.worldTransform()/validate()` and `layout.wallFeatures`.
- Produces: `this.wallFeatureGroups`, `buildWallFeatures()`, `buildMirrorWallFeature()`, `buildSlatWallFeature()`, `buildLedWallFeature()`, and renderer data attributes.

- [ ] **Step 1: Write failing transform and metadata tests**

Assert all four `worldTransform()` rotations and positions, plus a 4-inch raised-floor case. Add expected host hooks to the acceptance test: `data-wall-features`, `data-mirror-features`, `data-slat-features`, `data-led-features`, and `data-invalid-wall-features`.

- [ ] **Step 2: Integrate wall-feature groups into scene construction**

Initialize `this.wallFeatureGroups=new Map()` and call `buildWallFeatures()` after room/doors and before zones/equipment. When Walls is off, set all counts to zero and skip building. Validate every feature; skip invalid meshes and increment `data-invalid-wall-features`.

- [ ] **Step 3: Build the three geometry types**

For mirrors, add a 1-inch dark backer, slim frame, and `MeshPhysicalMaterial` face with `metalness:1`, `roughness:.04`, `clearcoat:1`, and the existing environment map.

For slats, add a 1-inch charcoal felt backer and vertical wood boxes. Derive count from width at roughly 2.5-inch centers and clamp it to 3–60.

For LEDs, add a narrow metal channel and translucent emissive diffuser using the saved color. Create at most one shadowless `THREE.PointLight` per strip and only for the first eight valid LEDs; later strips keep emissive geometry. Derive intensity from `brightnessPct/100` and keep it low enough that existing ceiling lights remain primary.

- [ ] **Step 4: Add 3D selection and framing**

Tag feature meshes with `wallFeatureId`, extend ray picking to return either an equipment instance or wall feature, clear other selections, and set `selectedWallFeatureId`. Keep hover labels equipment-only. Include `wallFeatureGroups` in `frameSelected()` and store `worldFootprint` plus `focusPoint` on every feature group.

- [ ] **Step 5: Add warning and minimap representation**

Append the first invalid feature reason to `updateWarnings()`. Draw each valid feature as a 2–4px colored wall line in `drawMinimap()`, thicker when selected. Do not add wall-feature collision segments.

- [ ] **Step 6: Verify black-wall materials and light limits**

In 3D and Walkthrough, verify the two mirrors remain legible against black walls, walnut reads warm instead of orange, seven seeded features appear, exactly four LEDs emit geometry, and active feature point lights never exceed eight after adding extras. Toggle Walls off/on and confirm all features follow it.

- [ ] **Step 7: Run checks and commit 3D wall features**

Run:

```bash
node --check view3d.js
node --check wall-features.js
git diff --check
```

Stage only 3D/test hunks and commit:

```bash
git commit -m "feat: render wall decorations in 3d"
```

---

### Task 5: Complete Layout 3 visual QA and export/import regression

**Files:**
- Modify: `gltf-runtime.js:20-29`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: the completed wall-feature implementation.
- Produces: a verified Layout 3 starter scene and documented QA evidence.

- [ ] **Step 1: Run all syntax and logic checks**

```bash
node --check wall-features.js
node --check app.js
node --check panels.js
node --check layout.js
node --check events.js
node --check view3d.js
node --input-type=module --check < gltf-runtime.js
git diff --check
```

Open the logic runner and require `data-complete="true" data-failures="0"`.

- [ ] **Step 2: Verify exact seeded placement in Plan mode**

Confirm Layout 3 has two mirrors, one slat panel, and four LED strips with the exact measurements from Task 1. Confirm Layouts 1 and 2 were not backfilled. Confirm the left-wall extension and door conflict examples show warnings when manually created.

- [ ] **Step 3: Verify the black-wall scene in Split, 3D, and Walkthrough**

Check the door-entry sightline toward the walnut/Gazelle wall, the center-training sightline toward the bottom mirror, the aisle sightline toward the right mirror, and the cardio ambient strip. Confirm no feature floats, clips through the door, exceeds the ceiling, blocks walking, or changes equipment placement.

- [ ] **Step 4: Verify editing and persistence round trips**

Move, resize, recolor, and delete a copy of each type; reload and confirm persistence. Duplicate the layout, export full/all-layouts, import it, and confirm exact totals and colors. Confirm `aiApiKey` is absent from the exported JSON without printing its original value.

- [ ] **Step 5: Check performance and console output**

Add LEDs until more than eight exist. Confirm emissive strips continue to render while the light count stays eight. Orbit and walk for at least one minute and require no console errors, no repeated warnings, and responsive input.

- [ ] **Step 6: Record evidence and bump cache keys**

Add the verified date, views, feature counts, and zero-error result to `design-qa.md`. Bump only the changed classic-script query versions in `gltf-runtime.js`.

- [ ] **Step 7: Commit the verified wall-decoration feature**

Inspect the cached diff and commit QA/cache changes:

```bash
git commit -m "test: verify Layout 3 wall decoration"
```
