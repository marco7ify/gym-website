# Faithful X16 and Stair Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified NordicTrack X16 treadmill and syedee Stair Machine geometry with lightweight, semantically testable, product-faithful procedural models while preserving every saved dimension, placement, warning, and fallback.

**Architecture:** Keep the existing exact-profile registry and staged fallback path. Extend the existing Three.js primitive option path with stable part metadata and one focused extruded-panel primitive, then rebuild the two dedicated builders inside `equipment-models.js`; no profile inference, layout state, collision, or Layout Tools code changes. Browser-observed unit and real-Three tests protect geometry, resources, saved Layout 3 integration, and cache coherence.

**Tech Stack:** Vanilla JavaScript, Three.js, the existing `GymEquipmentModels` registry, browser test runners under `tests/`, and the current static runtime loader.

## Global Constraints

- Preserve X16 envelope exactly: 38.1 in W × 69.9 in L × 73.3 in H.
- Preserve Stair envelope exactly: 32 in W × 50 in L × 82 in H.
- Preserve both saved instance positions, `rotated:true`, canonical local front `-Z`, collision footprints, `__invalid` values, and all 11 Layout 3 placements.
- Keep the Stair Machine's existing `needs 8.7 ft ceiling` warning exactly once; do not squash or move the model.
- Keep profile keys `nordictrack-x16` and `syedee-stair-machine`; a thrown or null detailed builder must still produce the existing generic fallback.
- Do not change Layout Tools, mirrors, slats, LEDs, garage geometry, room finishes, or wall-feature behavior.
- Do not add external GLB/GLTF files, textures, decals, machine-authored lights, or new runtime dependencies.
- Every visible mesh produced by either dedicated builder must have a stable `partTag`; paired/repeated parts use `side` and/or `partIndex`.
- X16 budget: at most 32 visible meshes, at most 6 shared materials, about 1,200 triangles or fewer.
- Stair budget: at most 56 visible meshes, at most 8 shared materials, at most 24 unique geometries.
- Use strict browser-observed RED → GREEN for each behavioral change, then request an independent review before accepting the task.
- Advance cache URLs atomically only after all production changes land: `equipment-models.js?v=3`, `view3d.js?v=40`, and `gltf-runtime.js?v=38`, with matching runner/test contracts.

---

## File Map

- Modify `view3d.js`: copy semantic fields from primitive options into real meshes and add the focused extruded-panel primitive.
- Modify `equipment-models.js`: expose the new model-kit helper and replace only the two dedicated builders.
- Modify `tests/equipment-profiles.test.js`: fake-view geometry contracts for exact dimensions, tags, orientation, envelopes, and performance budgets.
- Modify `tests/equipment-dispatch-3d.test.js`: real-Three semantic metadata, resource lifecycle, exact saved Layout 3 integration, fallback cleanup, and warning checks.
- Modify `tests/equipment-dispatch-3d-runner.js` and `tests/equipment-dispatch-3d-runner.html`: fresh browser cache keys for changed real-Three assets/tests.
- Modify `tests/planner-logic-runner.html`: fresh `equipment-models.js` and profile-test URLs.
- Modify `tests/runtime-cache.test.js`, `tests/runtime-cache-runner.html`, `gltf-runtime.js`, and `index.html`: one atomic runtime-cache version transition.
- Modify `design-qa.md`: record the final selected-model and saved-layout visual evidence.

---

### Task 1: Semantic primitives and extruded side-panel support

**Files:**
- Modify: `view3d.js:360-434`
- Modify: `equipment-models.js:5-14`
- Modify: `tests/equipment-dispatch-3d.test.js`
- Modify: `tests/equipment-dispatch-3d-runner.js`

**Interfaces:**
- Consumes: existing `Gym3DView.box`, `cylinder`, `beam`, `tube`, `geometry`, `clickTargets`, and `disposables` lifecycle.
- Produces: `applyPartMetadata(mesh, options)`, `Gym3DView.extrudedPanel(parent, points, depth, position, material, options)`, and `createModelKit(...).addExtrudedPanel(points, depth, pos, mat, options)`.

- [ ] **Step 1: Add failing real-Three metadata tests**

Add a focused test that creates all five primitive types with `{instId:"semantic",partTag:"probe-part",side:"left",partIndex:2}` and asserts the resulting meshes contain exactly those fields and are click targets. Add an extruded-panel assertion for a six-point polygon:

```js
const options={instId:"semantic",partTag:"probe-part",side:"left",partIndex:2};
const polygon=[
  {x:.46,y:.035},{x:.46,y:.16},{x:.27,y:.18},
  {x:-.27,y:.61},{x:-.43,y:.61},{x:-.43,y:.035},
];
const panel=view.extrudedPanel(group,polygon,.08,{x:0,y:0,z:0},material,options);
GymTests.equal(panel.userData.partTag,"probe-part");
GymTests.equal(panel.userData.side,"left");
GymTests.equal(panel.userData.partIndex,2);
GymTests.assert(view.clickTargets.includes(panel));
GymTests.assert(view.disposables.includes(panel.geometry));
```

- [ ] **Step 2: Run the real-Three runner and verify RED**

Run: open `http://127.0.0.1:4185/tests/equipment-dispatch-3d-runner.html?semantic-primitives-red=1`.

Expected: the new tests fail because `extrudedPanel` is undefined and existing meshes lack `partTag`, `side`, and `partIndex`; existing tests remain green and the browser console has no unrelated error.

- [ ] **Step 3: Implement one shared metadata copier**

Add this helper near the primitive methods and call it from `box`, `cylinder`, `beam`, `tube`, and `extrudedPanel` before adding the object:

```js
applyPartMetadata(mesh,options={}){
  if(options.instId) mesh.userData.instId=options.instId;
  if(options.partTag) mesh.userData.partTag=String(options.partTag);
  if(options.side!==undefined) mesh.userData.side=String(options.side);
  if(options.partIndex!==undefined) mesh.userData.partIndex=Number(options.partIndex);
  if(options.instId) this.clickTargets.push(mesh);
  return mesh;
}
```

Replace each primitive's repeated `instId` block with `this.applyPartMetadata(mesh,options)`.

- [ ] **Step 4: Implement the focused extruded-panel primitive**

Create a `THREE.Shape` from `{x,y}` points, extrude it to the requested depth without beveling, center the depth around local Z, register the geometry, apply normal shadows/rotations/metadata, and add the mesh:

```js
extrudedPanel(parent,points,depth,position,material,options={}){
  const shape=new THREE.Shape();
  points.forEach((point,index)=>index
    ? shape.lineTo(point.x,point.y)
    : shape.moveTo(point.x,point.y));
  shape.closePath();
  const geometry=this.geometry(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:1}));
  geometry.translate(0,0,-depth/2);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(position.x,position.y,position.z);
  mesh.rotation.set(options.rotationX||0,options.rotationY||0,options.rotationZ||0);
  mesh.castShadow=options.castShadow!==false;
  mesh.receiveShadow=options.receiveShadow!==false;
  this.applyPartMetadata(mesh,options);
  parent.add(mesh);
  return mesh;
}
```

Expose it from `createModelKit`:

```js
const addExtrudedPanel=(points,depth,pos,mat,options={})=>
  view.extrudedPanel(group,points,depth,pos,mat,{...options,instId:inst.id});
return {w,d,h,material,addBox,addCylinder,addBeam,addTube,addExtrudedPanel};
```

- [ ] **Step 5: Run focused and full tests**

Run the fresh real-Three URL `?semantic-primitives-green=1`, then the planner logic runner.

Expected: both report `data-complete=true`, `data-failures=0`, `All tests passed.`, and no console warning/error.

- [ ] **Step 6: Commit Task 1**

```bash
git add view3d.js equipment-models.js tests/equipment-dispatch-3d.test.js tests/equipment-dispatch-3d-runner.js
git commit -m "refactor: expose semantic equipment primitives"
```

---

### Task 2: Product-faithful NordicTrack X16 builder

**Files:**
- Modify: `equipment-models.js:89-119`
- Modify: `tests/equipment-profiles.test.js`
- Modify: `tests/equipment-dispatch-3d.test.js`

**Interfaces:**
- Consumes: Task 1 `createModelKit` primitives and `{partTag,side,partIndex}` options.
- Produces: `buildNordicTrackX16Model(...)` with the existing model type string `photo-matched NordicTrack X16` and the complete `x16-*` semantic tag contract.

- [ ] **Step 1: Add exact fake-view X16 geometry assertions**

Extend the fake probe to return created mesh-like objects with copied metadata. Add helpers `partsByTag(parts,tag)`, `boxTopAtLocalZ(box,z)`, and an AABB estimator for boxes/cylinders/beams/tubes. Assert:

```js
GymTests.equal(partsByTag(parts,"x16-belt").length,1);
GymTests.deepEqual(partsByTag(parts,"x16-belt")[0].size,{x:22/12,y:.018,z:60/12});
GymTests.equal(partsByTag(parts,"x16-foot-rail").length,2);
GymTests.equal(partsByTag(parts,"x16-base-rail").length,2);
GymTests.equal(partsByTag(parts,"x16-incline-upright").length,2);
GymTests.equal(partsByTag(parts,"x16-front-roller").length,1);
GymTests.equal(partsByTag(parts,"x16-rear-roller").length,1);
GymTests.equal(partsByTag(parts,"x16-handrail").length,6);
```

Also assert rear belt top `13.66/12 ± .02 ft`, local `-Z` belt end higher than local `+Z`, display diagonal between 15.8 and 16.2 in, panel depth no more than 1.25 in, maximum handle Y between 72 and 73.3 in, floor contact, ≥90% width, ≥93% length, ≥98% height, no envelope escape, ≤32 visible primitives, and ≤6 distinct material objects.

- [ ] **Step 2: Capture X16 RED**

Open `tests/planner-logic-runner.html?x16-faithful-red=1` and the equipment real-Three runner with the same key.

Expected: failures identify the 22×60 belt, reversed incline, absent base/upright/control tags, wrong display/deck proportions, and incomplete semantic metadata. Existing non-X16 tests stay green.

- [ ] **Step 3: Replace the X16 materials and walking platform**

Use six shared materials maximum: frame, graphite, rubber, screen, red, and subdued hardware. Build the exact belt and 6° incline around a consistent deck center:

```js
const incline=THREE.MathUtils.degToRad(6);
const beltWidth=22/12,beltLength=60/12,rearTop=13.66/12;
const beltThickness=.018;
const deltaY=Math.sin(incline)*beltLength;
const beltCenterY=rearTop+deltaY/2-beltThickness/2;
addBox(
  {x:beltWidth,y:beltThickness,z:beltLength},
  {x:0,y:beltCenterY,z:.03},rubber,
  {rotationX:incline,partTag:"x16-belt",castShadow:false}
);
```

Add a 31.5 in × 64.5 in deck shell, two 3.4 in × 61.5 in foot rails, exact front/rear rollers, two floor base rails, two crossmembers, four leveling feet/rear wheels, and a central lift actuator/scissor. Use local `-Z` for the console/front and local `+Z` for rear entry.

- [ ] **Step 4: Build the X16 hood, supports, console, and handles**

Create a low faceted 29 in-wide hood from three tagged dark boxes/beams; two substantial main uprights; a central pivot neck; a 32 in console bridge; control strip; one red stop key; 15×9 in bezel; 13.9×7.8 in cyan display; and three connected matte-black handle segments per side. Tag every visible primitive and ensure front-only parts have `z<0` while the rear roller has `z>0`.

- [ ] **Step 5: Run X16 unit and real-Three GREEN**

Open fresh logic and equipment URLs with `?x16-faithful-green=1`.

Expected: all X16 dimensional, semantic, envelope, material, and budget assertions pass; all legacy profile/dispatch/fallback tests remain green; console is clean.

- [ ] **Step 6: Verify failure cleanup and recovery**

In the real-Three suite, force `nordictrack-x16` to throw after creating two tagged primitives. Assert one generic fallback, `builderFailures="1"`, no staged `x16-*` mesh/tag/click target/resource remains, and a new fixture restores one dedicated X16 with `builderFailures="0"`.

- [ ] **Step 7: Commit Task 2**

```bash
git add equipment-models.js tests/equipment-profiles.test.js tests/equipment-dispatch-3d.test.js
git commit -m "feat: rebuild the NordicTrack X16 model"
```

---

### Task 3: Product-faithful syedee Stair Machine builder

**Files:**
- Modify: `equipment-models.js:55-86`
- Modify: `tests/equipment-profiles.test.js`
- Modify: `tests/equipment-dispatch-3d.test.js`

**Interfaces:**
- Consumes: Task 1 `addExtrudedPanel` and semantic primitive options.
- Produces: `buildSyedeeStairMachineModel(...)` with the existing model type string `photo-matched syedee Stair Machine` and the complete `stair-*` semantic tag contract.

- [ ] **Step 1: Add exact Stair fake-view assertions**

Add tests for exactly 8 `stair-tread`, 7 `stair-riser`, 2 `stair-side-shroud`, 2 `stair-shroud-inset`, 1 `stair-entry-step`, 2 `stair-base-rail`, at least 2 `stair-cross-foot`, paired handrail paths, one console housing/screen, paired white edge-light sets, and two orange accents. Require every visible part to have `partTag` and repeated parts to have stable `side`/`partIndex`.

Use the exact normalized side profile:

```js
const shellPoints=[
  {x:d*.46,y:h*.035},{x:d*.46,y:h*.16},{x:d*.27,y:h*.18},
  {x:-d*.27,y:h*.61},{x:-d*.43,y:h*.61},{x:-d*.43,y:h*.035},
];
```

Assert screen orientation is landscape, its bounds remain inside the housing, it is emissive and shadowless, all rails/lights/polygon vertices remain inside the envelope, mesh count ≤56, distinct materials ≤8, and distinct geometry signatures ≤24.

- [ ] **Step 2: Capture Stair RED**

Open fresh logic and real-Three runners with `?stair-faithful-red=1`.

Expected: failures identify missing risers/polygon shells/semantic lights, the bulky plinth, and console/rail proportion mismatches; X16 and unrelated models remain green.

- [ ] **Step 3: Build the open Stair base and continuous cascade**

Replace the center plinth with two open longitudinal base rails, front/rear cross feet, and one low rear entry step. Build eight ordered tread/riser pairs using one consistent progression from local `+Z` rear/entry toward local `-Z` console/front:

```js
for(let index=0;index<8;index++){
  const y=h*(.11+index*.062);
  const z=d*(.34-index*.085);
  addBox({x:w*.60,y:h*.018,z:d*.145},{x:0,y,z},tread,
    {partTag:"stair-tread",partIndex:index,castShadow:false});
  if(index<7) addBox({x:w*.60,y:h*.062,z:d*.018},{x:0,y:y+h*.031,z:z-d*.0715},riser,
    {partTag:"stair-riser",partIndex:index,castShadow:false});
}
```

Adjust the first/last progression constants only within the approved envelope so all eight treads and seven risers form a connected silhouette.

- [ ] **Step 4: Build paired polygon shells, insets, and lighting**

Create one thin extruded outer shell and one smaller inset per side at `x=±.44w`, rotated so polygon X maps along local Z. Add cool-white lower/perimeter tagged beam/tube segments and one short orange upper diagonal per side; set `castShadow:false,receiveShadow:false` for all emissive accents.

- [ ] **Step 5: Build the console and handrails**

Build a central mast and broad `.70w × .20h × .055d` landscape console near `y=.86h,z=-.415d`, with a bounded `.60w × .135h` cyan screen. For each side, connect these rail points using three tagged tubes plus a short forward grip:

```js
const railPath=[
  {x:.30*w,y:.22*h,z:.34*d},
  {x:.39*w,y:.55*h,z:.05*d},
  {x:.36*w,y:.76*h,z:-.22*d},
  {x:.27*w,y:.79*h,z:-.35*d},
];
```

Mirror X for the right side, use `.022w` radius and 12 radial segments, and tag each segment with `side` and ordered `partIndex`.

- [ ] **Step 6: Run Stair unit and real-Three GREEN**

Open fresh logic and equipment URLs with `?stair-faithful-green=1`.

Expected: all Stair geometry, tag, light, screen, envelope, and budget assertions pass; the saved ceiling warning is still emitted once; X16 and all other models remain green; console is clean.

- [ ] **Step 7: Verify Stair failure cleanup and recovery**

Force the Stair builder to throw after creating an extruded shell and tagged light. Assert the fallback contains no staged `stair-*` tags or resources and a fresh fixture restores the detailed Stair model with zero failures.

- [ ] **Step 8: Commit Task 3**

```bash
git add equipment-models.js tests/equipment-profiles.test.js tests/equipment-dispatch-3d.test.js
git commit -m "feat: rebuild the syedee Stair Machine model"
```

---

### Task 4: Exact saved Layout 3 integration and lifecycle regression

**Files:**
- Modify: `tests/equipment-dispatch-3d.test.js`
- Modify: `tests/equipment-dispatch-3d-runner.js`
- Modify: `tests/equipment-dispatch-3d-runner.html`

**Interfaces:**
- Consumes: final X16/Stair builders, semantic metadata, existing `Gym3DView` placement, staging, warnings, frame-selected, and destroy lifecycle.
- Produces: exact saved-layout regression fixtures and stable lifecycle evidence used by final QA.

- [ ] **Step 1: Add the exact X16/Stair saved records**

Add fixtures using the real measurements and placements:

```js
const savedX16={id:"x16",width:38.1/12,length:69.9/12,height:73.3/12};
const savedStair={id:"stair",width:32/12,length:50/12,height:82/12};
const savedInstances=[
  {id:"inst_x16",itemId:"x16",xFt:6,xIn:6,yFt:0,yIn:0,rotated:true,__invalid:false},
  {id:"inst_stair",itemId:"stair",xFt:0,xIn:0,yFt:0,yIn:0,rotated:true,__invalid:false},
];
```

Combine these with the existing exact 11-item Layout 3 fixture rather than replacing other machines or architecture.

- [ ] **Step 2: Add saved-placement and warning assertions**

Assert each source instance is byte-equal before/after render, world footprints equal the saved dimensions after rotation, centers and `rotationY=Math.PI/2` remain unchanged, `visualRotationY=0`, X16 local `-Z` maps world `-X`, Stair entry faces the open room, and the Stair ceiling warning occurs exactly once.

- [ ] **Step 3: Add real-Three resource and diagnostic limits**

Traverse each dedicated group and assert the X16/Stair mesh/material/geometry budgets, every visible mesh tagged, 11 dedicated models, 0 builder failures, and unchanged garage/wall-feature counts. Capture unique geometries/materials/click targets, destroy, and assert each resource is disposed exactly once; repeat a second create/destroy cycle and compare counts.

- [ ] **Step 4: Capture integration RED, then make only necessary corrections**

Open `tests/equipment-dispatch-3d-runner.html?saved-layout-faithful-red=1` before any corrective production edit.

Expected: if any integration assertion fails, it names the exact placement/resource/warning mismatch. Apply only local builder or primitive corrections; do not change state data, placement, warning policy, or unrelated builders.

- [ ] **Step 5: Run all real-Three suites GREEN**

Open fresh equipment, wall-feature, and garage-door 3D runners.

Expected: each reports zero failures and no console warning/error; the forced builder failure/recovery suite remains green.

- [ ] **Step 6: Commit Task 4**

```bash
git add tests/equipment-dispatch-3d.test.js tests/equipment-dispatch-3d-runner.js tests/equipment-dispatch-3d-runner.html equipment-models.js view3d.js
git commit -m "test: protect faithful cardio models in layout 3"
```

---

### Task 5: Atomic cache transition and browser visual acceptance

**Files:**
- Modify: `tests/runtime-cache.test.js`
- Modify: `tests/runtime-cache-runner.html`
- Modify: `tests/planner-logic-runner.html`
- Modify: `tests/equipment-dispatch-3d-runner.js`
- Modify: `tests/equipment-dispatch-3d-runner.html`
- Modify: `gltf-runtime.js`
- Modify: `index.html`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: completed production/test assets from Tasks 1–4.
- Produces: coherent runtime versions and final visual/performance evidence.

- [ ] **Step 1: Advance cache-test expectations before production URLs**

Change the expected runtime entry to `gltf-runtime.js?v=38`, `equipment-models.js?v=3`, and `view3d.js?v=40`. Change the equipment real-Three outer module key to `equipment-faithful-cardio-v1`; advance its test script key too. Do not change production URLs yet.

- [ ] **Step 2: Capture intentional cache RED**

Open `tests/runtime-cache-runner.html?faithful-cardio-cache-red=1`.

Expected: failures show runtime 37 vs 38, equipment-models 2 vs 3, view3d 39 vs 40, and the previous equipment runner module key. No unrelated cache mismatch is accepted.

- [ ] **Step 3: Apply atomic production and runner cache URLs**

Update `index.html` to `gltf-runtime.js?v=38`; update the runtime manifest to `equipment-models.js?v=3` and `view3d.js?v=40`; update logic and real-Three runners to those exact URLs and the final fresh outer/test keys.

- [ ] **Step 4: Run every automated browser gate**

Open fresh URLs for:

```text
tests/runtime-cache-runner.html?faithful-cardio-green=1
tests/planner-logic-runner.html?faithful-cardio-green=1
tests/equipment-dispatch-3d-runner.html?faithful-cardio-green=1
tests/wall-features-3d-runner.html?faithful-cardio-green=1
tests/garage-door-3d-runner.html?faithful-cardio-green=1
```

Expected: every runner reports `data-complete=true`, `data-failures=0`, `All tests passed.`; normal runner consoles are clean. Document any browser-only hidden-iframe instrumentation message separately and confirm it is absent from the production page.

- [ ] **Step 5: Capture selected X16 visual evidence**

In Layout 3, select and frame the X16 in full 3D. Inspect and capture front three-quarter, exact side, rear-deck three-quarter, elevated/top, walkthrough at 5 ft 8 in, and opposite side with walls hidden if needed. Confirm the 22×60 belt, correct upward-to-console incline, grounded base, rollers, hood, substantial black handles, restrained 16 in screen, full silhouette, no clipping/floating, and unchanged position.

- [ ] **Step 6: Capture selected Stair visual evidence**

Select and frame the Stair Machine. Capture front three-quarter, exact side, rear-entry three-quarter, elevated/top, low entry, walkthrough at 5 ft 8 in, and opposite side as needed. Confirm 8 treads/7 risers, thin pentagonal shells, open base, broad console, thick paired rails, cool-white/orange accents, no decal, no clipping/floating, and the existing ceiling warning exactly once.

- [ ] **Step 7: Run Preview and Walkthrough stress checks**

Orbit/zoom Preview for at least 30 seconds and walk/turn in Walkthrough for at least 30 seconds. Record before/after canvas count, dedicated model count, builder failures, X16/Stair mesh/material counts, wall/garage counts, and console warning/error deltas. Counts must remain stable and no new relevant log may appear.

- [ ] **Step 8: Record final QA evidence**

Append a dated `Faithful X16 and Stair Machine` section to `design-qa.md` with runner URLs/results, exact visual angles inspected, screenshots, resource budgets, saved-placement checks, stress duration/counts, and any documented tooling limitation. Do not claim evidence that was not observed.

- [ ] **Step 9: Run syntax, diff, and worktree gates**

```bash
node --check equipment-models.js
node --check view3d.js
node --check tests/equipment-profiles.test.js
node --check tests/equipment-dispatch-3d.test.js
node --check tests/equipment-dispatch-3d-runner.js
node --check tests/runtime-cache.test.js
git diff --check
git status --short
```

Expected: all commands exit zero; status contains only intentional Task 5 files before commit.

- [ ] **Step 10: Commit Task 5**

```bash
git add gltf-runtime.js index.html equipment-models.js view3d.js design-qa.md tests
git commit -m "feat: ship faithful X16 and stair models"
```

- [ ] **Step 11: Request final independent review**

Review the complete diff against `docs/superpowers/specs/2026-08-11-x16-stair-faithful-models-design.md`. Resolve every Critical or Important finding with a new observed RED → GREEN cycle, rerun all five browser gates, and finish with a clean worktree.

---

## Self-Review Record

- Spec coverage: every dimensional, visual, semantic, performance, fallback, saved-layout, warning, browser-angle, stress, and cache requirement maps to Tasks 1–5.
- Scope protection: no task modifies Layout Tools, layout state, profile inference, collision logic, garage design, wall finishes, or saved placement data.
- Interface consistency: Task 1 produces `applyPartMetadata`, `extrudedPanel`, and `addExtrudedPanel`; Tasks 2–3 consume those exact names; Tasks 4–5 consume only the completed public builder/renderer behavior.
- Placeholder scan: the plan contains no deferred implementation markers. The only conditional correction step is constrained to observed integration failures and explicitly prohibits state/policy changes.
