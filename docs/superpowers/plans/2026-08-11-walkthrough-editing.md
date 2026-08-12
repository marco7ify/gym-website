# Walkthrough Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe Walk/Edit switch to first-person Walkthrough so users can select, rotate, and nudge equipment and place or edit mirrors, wood slat panels, and LED strips without conflicting with navigation.

**Architecture:** Add one focused browser-global command module for transient editor state, validated mutations, wall-hit conversion, and one-step undo. The Three.js view owns only raycasting, wall-surface metadata, and Walk/Edit input separation; layout/events own accessible controls and delegate to the command module. Every accepted mutation updates the existing `state.layout`, rerenders through the normal lifecycle, and reuses camera memory so the user's viewpoint survives.

**Tech Stack:** Browser-global JavaScript, Three.js raycasting, existing planner collision/wall-feature helpers, HTML/CSS rendered strings, existing `GymTests` logic and real-Three runners.

## Global Constraints

- Walk mode must preserve the current pointer-lock, drag-look, WASD/arrow movement, collision, reset, and minimap behavior.
- Edit mode must release pointer lock and must not rotate or move the camera from canvas dragging or movement keys.
- Equipment moves use room-plan coordinates, not camera-relative coordinates.
- Default move step is exactly 6 in; Fine mode is exactly 1 in.
- Equipment may not leave the room or physically overlap another item; clearance-only overlap is accepted with the existing warning state.
- Equipment rotation remains a center-preserving single 90-degree validated turn.
- Wall placement must use actual rendered wall runs and reject doors, garage doors, missing wall runs, seams, and non-wall hits.
- Wall-feature add/edit/remove must reuse existing normalization and validation.
- Accepted edits persist through the existing render/persist flow; transient editor mode/tool/status/undo state is never exported.
- One-step undo applies only to accepted equipment move/rotation and wall-feature add/patch/removal in the current Walkthrough session.
- Native editing controls must be keyboard accessible, expose state/status programmatically, and retain at least 44 × 44 CSS-pixel targets on narrow screens.
- Use browser-observed RED → GREEN development for every production change.

---

### Task 1: Isolated Walkthrough command and undo engine

**Files:**
- Create: `walkthrough-editing.js`
- Create: `tests/walkthrough-editing.test.js`
- Modify: `tests/planner-logic-runner.html`

**Interfaces:**
- Produces global `GymWalkthroughEditing` with:

```ts
state(): {
  mode:"walk"|"edit",
  moveStep:"coarse"|"fine",
  wallTool:null|"mirror"|"slat"|"led",
  status:null|{tone:"success"|"warning"|"error",message:string},
  undo:null|WalkthroughUndoSnapshot
}
reset(): void
setMode(mode:"walk"|"edit"): object
setMoveStep(mode:"coarse"|"fine"): object
setWallTool(kind:null|"mirror"|"slat"|"led"): object
nudgeInstance(instId:string,dxSign:-1|0|1,dySign:-1|0|1): CommandResult
rotateInstance(instId:string): CommandResult
featureFromWallHit(kind:string,hit:WallHit): {ok:true,feature:object}|{ok:false,reason:string}
addFeatureFromWallHit(kind:string,hit:WallHit): CommandResult
patchFeature(id:string,patch:object): CommandResult
removeFeature(id:string): CommandResult
undoLast(): CommandResult
```

- Consumes globals: `state`, `getItemById`, `instXTotalFt`, `instYTotalFt`, `splitTotalFtToFtIn`, `effectiveRectForInst`, `hardPlacementConflict`, `isInvalidPlacement`, `rotateLayoutInstance90`, `wallFeatureRoomData`, `GymWallFeatures`, `uid`, `deepCopy`, `clearAllSelections`, `render`.
- `WallHit` is `{wall:"top"|"right"|"bottom"|"left",alongFt:number,mountFt:number}`.

- [ ] **Step 1: Write state, command, validation, and undo RED tests**

Create `tests/walkthrough-editing.test.js` with fixtures that replace `state.items`, `state.layout`, and `render`, then restore them. Cover:

```js
GymTests.test("defaults to Walk and six-inch room-coordinate movement",()=>{
  GymWalkthroughEditing.reset();
  GymTests.deepEqual(GymWalkthroughEditing.state(),{
    mode:"walk",moveStep:"coarse",wallTool:null,status:null,undo:null,
  });
  GymWalkthroughEditing.setMode("edit");
  const result=GymWalkthroughEditing.nudgeInstance("target",1,0);
  GymTests.equal(result.ok,true);
  GymTests.closeTo(instXTotalFt(state.layout.instances[0]),4.5,1e-9);
  GymTests.closeTo(instYTotalFt(state.layout.instances[0]),4,1e-9);
});

GymTests.test("Fine movement is exactly one inch",()=>{
  GymWalkthroughEditing.setMoveStep("fine");
  GymWalkthroughEditing.nudgeInstance("target",0,-1);
  GymTests.closeTo(instYTotalFt(state.layout.instances[0]),4-1/12,1e-9);
});

GymTests.test("hard movement rejection preserves layout and undo byte-for-byte",()=>{
  const before=deepCopy(state.layout);
  const undo=GymWalkthroughEditing.state().undo;
  const result=GymWalkthroughEditing.nudgeInstance("target",-1,0);
  GymTests.equal(result.ok,false);
  GymTests.deepEqual(state.layout,before);
  GymTests.equal(GymWalkthroughEditing.state().undo,undo);
});
```

Add clearance-only acceptance, rotation success/rejection, valid wall feature creation, door/missing-wall rejection, patch validation, removal, one-step undo for all five mutation classes, rejected-edit undo preservation, and `reset()` transient-state clearing tests.

- [ ] **Step 2: Run logic runner and capture RED**

Run `tests/planner-logic-runner.html?walkthrough-edit-task1-red=1`. Expected: `GymWalkthroughEditing`/module missing failures only.

- [ ] **Step 3: Implement the module state and mutation helpers**

Create `walkthrough-editing.js`:

```js
(function(){
  "use strict";
  const DEFAULT=()=>({mode:"walk",moveStep:"coarse",wallTool:null,status:null,undo:null});
  let editor=DEFAULT();
  const snapshot=()=>({
    instances:deepCopy(state.layout.instances||[]),
    wallFeatures:deepCopy(state.layout.wallFeatures||[]),
    selectedInstId:state.layout.selectedInstId||null,
    selectedWallFeatureId:state.layout.selectedWallFeatureId||null,
  });
  const commitUndo=before=>{ editor.undo=before; };
  const finish=(tone,message,result)=>{
    editor.status={tone,message};
    render();
    return result;
  };
  function editorState(){ return editor; }
  function reset(){ editor=DEFAULT(); }
  function setMode(mode){ editor.mode=mode==="edit"?"edit":"walk"; if(editor.mode==="walk") editor.wallTool=null; return editor; }
  function setMoveStep(mode){ editor.moveStep=mode==="fine"?"fine":"coarse"; return editor; }
  function setWallTool(kind){ editor.wallTool=GymWallFeatures.KINDS.includes(kind)?kind:null; return editor; }
  function nudgeInstance(instId,dxSign,dySign){
    const inst=(state.layout.instances||[]).find(entry=>entry.id===instId);
    const item=inst&&getItemById(inst.itemId);
    if(!inst||!item) return finish("error","That equipment is no longer in this layout.",{ok:false,reason:"not-found"});
    const before=snapshot();
    const step=editor.moveStep==="fine"?1/12:.5;
    const x=splitTotalFtToFtIn(instXTotalFt(inst)+Math.sign(dxSign)*step);
    const y=splitTotalFtToFtIn(instYTotalFt(inst)+Math.sign(dySign)*step);
    const candidate={...inst,xFt:x.ft,xIn:x.inch,yFt:y.ft,yIn:y.inch};
    const rects=effectiveRectForInst(candidate,item);
    const conflict=hardPlacementConflict(instId,rects.base);
    if(conflict) return finish("error",conflict.message,{ok:false,reason:"hard-invalid",conflict});
    candidate.__invalid=isInvalidPlacement(instId,rects.base,rects.eff);
    state.layout.instances=state.layout.instances.map(entry=>entry.id===instId?candidate:entry);
    commitUndo(before);
    return finish(candidate.__invalid?"warning":"success",candidate.__invalid?"Moved. Clearance overlaps another item.":"Moved equipment.",{ok:true,instance:candidate});
  }
  function rotateInstance(instId){
    const before=snapshot();
    const result=rotateLayoutInstance90(instId);
    if(result.ok) commitUndo(before);
    return result;
  }
  function featureFromWallHit(kind,hit){
    if(!GymWallFeatures.KINDS.includes(kind)||!GymWallFeatures.SIDES.includes(hit?.wall)) return {ok:false,reason:"Choose a real wall surface."};
    const id=uid("wf");
    const room=wallFeatureRoomData(state.layout,state.settings);
    let feature=GymWallFeatures.normalize({id,kind,wall:hit.wall},room,()=>id,state.layout);
    const centeredStart=Math.max(0,safeNum(hit.alongFt)-GymWallFeatures.width(feature)/2);
    const centeredBottom=Math.max(0,safeNum(hit.mountFt)-GymWallFeatures.height(feature)/2);
    const start=splitTotalFtToFtIn(centeredStart),bottom=splitTotalFtToFtIn(centeredBottom);
    feature=GymWallFeatures.normalize({...feature,startFt:start.ft,startIn:start.inch,bottomFt:bottom.ft,bottomIn:bottom.inch},room,()=>id,state.layout);
    const validation=GymWallFeatures.validate(feature,state.layout,room);
    return validation.valid?{ok:true,feature}:{ok:false,reason:validation.reasons[0]?.message||"This wall placement is not valid."};
  }
  function addFeatureFromWallHit(kind,hit){
    const candidate=featureFromWallHit(kind,hit);
    if(!candidate.ok) return finish("error",candidate.reason,candidate);
    const before=snapshot();
    state.layout.wallFeatures=[...(state.layout.wallFeatures||[]),candidate.feature];
    clearAllSelections(); state.layout.selectedWallFeatureId=candidate.feature.id; editor.wallTool=null; commitUndo(before);
    return finish("success","Added wall feature.",{ok:true,feature:candidate.feature});
  }
  function patchFeature(id,patch){
    const current=(state.layout.wallFeatures||[]).find(feature=>feature.id===id);
    if(!current) return finish("error","That wall feature no longer exists.",{ok:false,reason:"not-found"});
    const room=wallFeatureRoomData(state.layout,state.settings);
    const candidate=GymWallFeatures.normalize({...current,...patch},room,()=>id,state.layout);
    const validation=GymWallFeatures.validate(candidate,state.layout,room);
    if(!validation.valid) return finish("error",validation.reasons[0].message,{ok:false,reason:validation.reasons[0].code});
    const before=snapshot(); state.layout.wallFeatures=state.layout.wallFeatures.map(feature=>feature.id===id?candidate:feature); commitUndo(before);
    return finish("success","Updated wall feature.",{ok:true,feature:candidate});
  }
  function removeFeature(id){
    if(!(state.layout.wallFeatures||[]).some(feature=>feature.id===id)) return finish("error","That wall feature no longer exists.",{ok:false,reason:"not-found"});
    const before=snapshot(); state.layout.wallFeatures=state.layout.wallFeatures.filter(feature=>feature.id!==id); if(state.layout.selectedWallFeatureId===id) state.layout.selectedWallFeatureId=null; commitUndo(before);
    return finish("success","Removed wall feature.",{ok:true});
  }
  function undoLast(){
    if(!editor.undo) return finish("error","There is no Walkthrough edit to undo.",{ok:false,reason:"empty"});
    const restore=editor.undo; editor.undo=null; Object.assign(state.layout,deepCopy(restore));
    return finish("success","Undid the last Walkthrough edit.",{ok:true});
  }
  window.GymWalkthroughEditing=Object.freeze({state:editorState,reset,setMode,setMoveStep,setWallTool,nudgeInstance,rotateInstance,featureFromWallHit,addFeatureFromWallHit,patchFeature,removeFeature,undoLast});
})();
```

`nudgeInstance` builds a candidate with exact ft/in components, checks `hardPlacementConflict`, then computes clearance validity with `isInvalidPlacement`. `featureFromWallHit` creates the normal default feature, centers it at `alongFt`, centers its vertical span at `mountFt`, normalizes it, and validates it before mutation.

- [ ] **Step 4: Run logic GREEN**

Expected: complete=true, failures=0, no console warning/error.

- [ ] **Step 5: Commit Task 1**

```bash
git add walkthrough-editing.js tests/walkthrough-editing.test.js tests/planner-logic-runner.html
git commit -m "feat: add walkthrough editing commands"
```

---

### Task 2: Rendered wall-hit resolution and Walk/Edit input separation

**Files:**
- Modify: `view3d.js:175-240, 550-610, 2695-2850, 3080-3150`
- Modify: `tests/wall-features-3d.test.js`
- Modify: `tests/equipment-dispatch-3d.test.js`

**Interfaces:**
- Consumes: `GymWalkthroughEditing` from Task 1.
- Produces per-view `wallEditSurfaces: Array<THREE.Mesh>`.
- Produces `wallHitAt(pointer:THREE.Vector2): null|WallHit`.
- Produces `setWalkthroughEditMode(mode): void` and host datasets `walkthroughMode`, `wallTool`, `wallHitValid`.
- Wall surface metadata: `mesh.userData.wallEdit={wall,axis,fixed,start,end,inwardX,inwardZ}`.

- [ ] **Step 1: Add real-Three RED tests for physical wall hits**

In `tests/wall-features-3d.test.js`, build a Walkthrough fixture with all four wall orientations, a standard door, a garage opening, and the existing left extension seam. Assert:

```js
GymTests.test("resolves editable wall hits from actual rendered wall segments",()=>{
  const fixture=createWallFeature3dFixture({mode:"walkthrough"});
  try{
    GymTests.assert(fixture.view.wallEditSurfaces.length>0);
    const hit=(wall,point)=>{
      const object=fixture.view.wallEditSurfaces.find(surface=>surface.userData.wallEdit.wall===wall);
      GymTests.assert(object,`Expected ${wall} edit surface`);
      return fixture.view.resolveWallEditIntersection({object,point:new THREE.Vector3(point.x,point.y,point.z)});
    };
    const top=hit("top",{x:6,y:4,z:.08});
    GymTests.deepEqual(top,{wall:"top",alongFt:6,mountFt:4});
    GymTests.equal(hit("right",{x:fixture.room.W-.08,y:4,z:6}).wall,"right");
    GymTests.equal(hit("bottom",{x:6,y:4,z:fixture.room.L-.08}).wall,"bottom");
    GymTests.equal(hit("left",{x:.08,y:4,z:6}).wall,"left");
  }finally{ fixture.destroy(); }
});
```

Assert no editable surface spans standard-door, garage-door, or missing-boundary ranges. Add input tests proving Edit canvas click selects equipment, does not activate walk, does not change yaw/pitch/camera, and does trigger render for the side panel; Walk mode retains current input behavior.

- [ ] **Step 2: Capture wall/input RED**

Run fresh wall-feature and equipment real-Three runners. Expected: missing `wallEditSurfaces`, `resolveWallEditIntersection`, and edit-mode separation failures.

- [ ] **Step 3: Tag wall surfaces while building the room**

Initialize:

```js
this.wallEditSurfaces=[];
```

When iterating `roomBoundarySegments()`, retain the returned wall mesh and attach metadata:

```js
const wall=this.box(/* current wall arguments */);
wall.userData.wallEdit={
  wall:seg.wall,axis:seg.axis,fixed:seg.fixed,start:seg.start,end:seg.end,
  inwardX:seg.inwardX,inwardZ:seg.inwardZ,
};
this.wallEditSurfaces.push(wall);
```

Because `roomBoundarySegments()` already subtracts door and resolved garage openings, the ray target cannot span those openings.

- [ ] **Step 4: Implement wall-hit conversion**

Add:

```js
resolveWallEditIntersection(hit){
  const meta=hit?.object?.userData?.wallEdit;
  if(!meta) return null;
  const point=hit.point;
  const alongFt=meta.axis==="x"?point.x:point.z;
  const floor=this.floorElevationAt(
    point.x+meta.inwardX*.2,
    point.z+meta.inwardZ*.2,
  );
  return {wall:meta.wall,alongFt,mountFt:Math.max(0,point.y-floor)};
}

wallHitAt(pointer){
  const raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(pointer,this.camera);
  return this.resolveWallEditIntersection(raycaster.intersectObjects(this.wallEditSurfaces,false)[0]);
}
```

Maintain a lightweight preview group containing one translucent plane. Update it from the wall hit while a tool is active; hide it when invalid, canceled, or leaving Edit mode. The preview is not a click target and does not mutate state.

- [ ] **Step 5: Separate Walk and Edit event paths**

In pointer/key handlers, branch on `GymWalkthroughEditing.state().mode`:

```js
if(this.mode==="walkthrough" && GymWalkthroughEditing.state().mode==="edit"){
  this.editPointerDown={x:e.clientX,y:e.clientY};
  return;
}
```

In Edit pointer move, update wall preview only; never adjust yaw/pitch. On Edit pointer up:

- if a wall tool is active, resolve wall hit and call `addFeatureFromWallHit`;
- otherwise use `pickTarget`, select equipment/feature, remember camera, and call `render()` so the panel appears.

In Edit keydown, only Escape cancels an active wall tool. WASD/arrows return without activating walk or preventing text-field input. `setWalkthroughEditMode("edit")` exits pointer lock, clears `keys/lookDrag`, and preserves camera memory.

- [ ] **Step 6: Run real-Three GREEN and lifecycle checks**

Expected: wall and equipment runners at zero failures. Create/destroy twice and assert one set of listeners, zero retained preview meshes, and stable click targets/resources.

- [ ] **Step 7: Commit Task 2**

```bash
git add view3d.js tests/wall-features-3d.test.js tests/equipment-dispatch-3d.test.js
git commit -m "feat: add walkthrough wall picking"
```

---

### Task 3: Accessible Walkthrough editing panel and action wiring

**Files:**
- Modify: `layout.js:1188-1245, 1800-1900`
- Modify: `events.js:100-180, 1300-1345, 2120-2165`
- Modify: `index.html:2380-2720`
- Modify: `tests/walkthrough-editing.test.js`
- Modify: `tests/rotation.test.js`
- Modify: `tests/wall-features.test.js`

**Interfaces:**
- Consumes: `GymWalkthroughEditing` commands and existing selection state.
- Produces: `walkthroughEditPanel(): string` and delegated `data-action="walkthrough_*"` controls.
- Produces actions: `walkthrough_mode`, `walkthrough_step`, `walkthrough_move`, `walkthrough_rotate`, `walkthrough_wall_tool`, `walkthrough_undo`, `walkthrough_cancel_tool`, plus Walkthrough-specific feature patch/remove actions.

- [ ] **Step 1: Write markup and delegated-action RED tests**

Add logic tests that render Walkthrough in Walk and Edit modes and assert:

```js
GymTests.test("renders an accessible Walk/Edit switch and equipment editor",()=>{
  const html=walkthroughEditPanel();
  GymTests.assert(html.includes('role="radiogroup"'));
  GymTests.assert(html.includes('data-action="walkthrough_mode"'));
  GymTests.assert(html.includes('data-action="walkthrough_rotate"'));
  GymTests.equal((html.match(/data-action="walkthrough_move"/g)||[]).length,4);
  GymTests.assert(html.includes('aria-live="polite"'));
});
```

Add tests for 6-in/Fine state, native 44-pixel controls, wall-tool pressed state, selected feature fields, Delete, Undo disabled/enabled state, focus-key restoration, Escape cancel-before-close, and no `R` shortcut action while Walkthrough is open.

- [ ] **Step 2: Capture UI RED**

Run the logic runner. Expected: missing panel/actions and current Escape behavior failures.

- [ ] **Step 3: Add the header switch and responsive panel markup**

In the Walkthrough header render:

```html
<div class="walkthroughModeSwitch" role="radiogroup" aria-label="Walkthrough mode">
  <button type="button" role="radio" aria-checked="..." data-action="walkthrough_mode" data-mode="walk">Walk</button>
  <button type="button" role="radio" aria-checked="..." data-action="walkthrough_mode" data-mode="edit">Edit</button>
</div>
```

Replace the static guide body only while Edit mode is active with `walkthroughEditPanel()`. Equipment selection renders room-coordinate arrows and current position. No selection renders the three wall tools. Feature selection renders compact type/label/wall/color/ft+in/brightness/nudge/remove controls using Walkthrough-specific actions.

- [ ] **Step 4: Wire all editing actions**

Add delegated handlers:

```js
if(t.dataset.action==="walkthrough_mode"){
  GymWalkthroughEditing.setMode(t.dataset.mode);
  if(t.dataset.mode==="edit") gym3DControllers.find(view=>view.mode==="walkthrough")?.setWalkthroughEditMode("edit");
  render();
  return;
}
if(t.dataset.action==="walkthrough_move"){
  GymWalkthroughEditing.nudgeInstance(t.dataset.id,Number(t.dataset.dx),Number(t.dataset.dy));
  return;
}
```

Add explicit branches for the remaining actions:

```js
if(t.dataset.action==="walkthrough_rotate") return void GymWalkthroughEditing.rotateInstance(t.dataset.id);
if(t.dataset.action==="walkthrough_step"){
  GymWalkthroughEditing.setMoveStep(t.dataset.step);
  render(); return;
}
if(t.dataset.action==="walkthrough_wall_tool"){
  GymWalkthroughEditing.setWallTool(t.dataset.kind);
  render(); return;
}
if(t.dataset.action==="walkthrough_cancel_tool"){
  GymWalkthroughEditing.setWallTool(null);
  render(); return;
}
if(t.dataset.action==="walkthrough_undo") return void GymWalkthroughEditing.undoLast();
if(t.dataset.action==="walkthrough_wf_remove") return void GymWalkthroughEditing.removeFeature(t.dataset.id);
if(t.dataset.action==="walkthrough_wf_nudge"){
  const feature=(state.layout.wallFeatures||[]).find(entry=>entry.id===t.dataset.id);
  const start=GymWallFeatures.start(feature)+Number(t.dataset.inches)/12;
  const parts=splitTotalFtToFtIn(start);
  return void GymWalkthroughEditing.patchFeature(feature.id,{startFt:parts.ft,startIn:parts.inch});
}
```

For Walkthrough feature inputs, convert the named field to a patch with the same ft/in parsing used by the existing inspector, then call `GymWalkthroughEditing.patchFeature(id,patch)`. On `spatial_walkthrough_close`, call `GymWalkthroughEditing.reset()` before rendering. Escape cancels the active wall tool first, then leaves Edit selection unchanged; only a subsequent Escape closes the overlay.

- [ ] **Step 5: Add responsive styling and clear interaction cues**

Add CSS for mode switch, compact editor, directional pad, step selector, selected state, wall tools, live status, bottom-sheet narrow layout, and `.walkthroughViewport.isEditing` cursor. Ensure each native action is at least 44 × 44 CSS pixels and the 390-pixel layout leaves a meaningful portion of the canvas visible.

- [ ] **Step 6: Run UI GREEN and manual keyboard pass**

Run logic runner at zero failures. Verify Tab/Enter/Space for every action, focus restoration after rerender, Escape ordering, live status text, and narrow-screen panel/canvas balance.

- [ ] **Step 7: Commit Task 3**

```bash
git add layout.js events.js index.html tests/walkthrough-editing.test.js tests/rotation.test.js tests/wall-features.test.js
git commit -m "feat: add walkthrough editing controls"
```

---

### Task 4: Persistence, cross-view integration, and cache delivery

**Files:**
- Modify: `tests/walkthrough-editing.test.js`
- Modify: `tests/equipment-dispatch-3d.test.js`
- Modify: `tests/wall-features-3d.test.js`
- Modify: `tests/planner-logic-runner.html`
- Modify: `tests/equipment-dispatch-3d-runner.js`
- Modify: `tests/equipment-dispatch-3d-runner.html`
- Modify: `tests/wall-features-3d-runner.js`
- Modify: `tests/wall-features-3d-runner.html`
- Modify: `tests/runtime-cache.test.js`
- Modify: `tests/runtime-cache-runner.html`
- Modify: `gltf-runtime.js`
- Modify: `index.html`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: completed command/UI/renderer units.
- Produces: current runtime cache chain and end-to-end acceptance evidence.

- [ ] **Step 1: Add round-trip and cross-view integration tests**

In logic tests:

- run 6-in move, Fine 1-in move, rotation, wall add, patch, remove, and undo;
- call `persist()` and reload normalized layout data;
- call existing duplicate action;
- generate full/all-layout and layout-only exports, then normalize imports;
- assert accepted instances/features match exactly and editor mode/tool/status/undo are absent from exported JSON.

In real-Three tests, mutate an instance and add a feature through commands, recreate Preview and Walkthrough, and assert both publish the same world center/orientation/feature transform and zero builder failures.

- [ ] **Step 2: Run all non-cache suites**

Run fresh planner logic, equipment real-Three, wall-feature real-Three, and garage-door real-Three runners. Expected: complete=true, failures=0, no relevant console logs.

- [ ] **Step 3: Advance cache expectations and capture RED**

After reconciling with the model plan's final versions, advance only changed assets one additional version:

```text
walkthrough-editing.js: new v1
view3d.js: v41 → v42
layout.js: v86 → v87
events.js: v82 → v83
index.html runtime entry: v40 → v41
planner logic test/module keys: new walkthrough test v1 and changed sources
equipment/wall 3D inner + outer keys: → walkthrough-edit-v1
```

Update runtime-cache expectations first and run the cache runner. Expected: failures for the missing new module and stale runtime/source/runner URLs only.

- [ ] **Step 4: Apply one atomic production and runner cache transition**

Load `walkthrough-editing.js?v=1` after `app.js` and before `equipment-models.js` in `gltf-runtime.js`. Apply the reconciled versions to production, planner logic, equipment runner, wall runner, runtime entry, and runtime-cache contract in one patch.

- [ ] **Step 5: Run final automated gates**

Run runtime cache, planner logic, equipment real-Three, wall-feature real-Three, and garage-door real-Three from fresh URLs. Expected: zero failures. The normal app and all non-cache runners must have no relevant console warnings/errors.

- [ ] **Step 6: Execute rendered Walkthrough acceptance**

On a disposable duplicate of an imported saved layout:

1. Walk for at least 30 seconds with collisions on.
2. Switch to Edit without camera reset.
3. Select, rotate, move 6 in, and Fine-move 1 in.
4. Demonstrate a hard rejection and clearance-only warning.
5. Add mirror, slat, and LED from wall clicks.
6. Reject clicks over the standard door, garage door, and left missing-wall run.
7. Patch size/height/color/brightness, nudge, remove, and undo.
8. Return to Walk at the same pose and walk for another 30 seconds.
9. Reload and verify Plan/3D/Walkthrough agree.
10. Delete the disposable duplicate and restore the source layout.

Record stable canvas/model/wall-feature/listener/resource counts and narrow-screen keyboard evidence.

- [ ] **Step 7: Document final evidence and commit**

Update `design-qa.md` with exact actions, acceptance results, stress durations, stable counts, screenshots, console outcome, and any browser-instrumentation limitation. Then commit:

```bash
git add walkthrough-editing.js view3d.js layout.js events.js index.html gltf-runtime.js tests/walkthrough-editing.test.js tests/planner-logic-runner.html tests/equipment-dispatch-3d.test.js tests/equipment-dispatch-3d-runner.js tests/equipment-dispatch-3d-runner.html tests/wall-features-3d.test.js tests/wall-features-3d-runner.js tests/wall-features-3d-runner.html tests/runtime-cache.test.js tests/runtime-cache-runner.html design-qa.md
git commit -m "feat: edit layouts from walkthrough mode"
```
