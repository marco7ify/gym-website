# Remaining Equipment Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the eight remaining generic Layout 3 equipment shapes with dedicated, photo-matched procedural models while preserving every saved measurement, position, orientation, and collision footprint.

**Architecture:** Put new product builders in a focused `GymEquipmentModels` registry instead of expanding the already-large renderer. Route exact brand/product profile keys before broad generic matches, let `view3d.js` stage each dedicated build in a temporary group, and fall back to the existing family model on any builder exception. Expose deterministic renderer metadata so profile routing, builder use, failure recovery, and measured footprints are testable without relying only on screenshots.

**Tech Stack:** Vanilla JavaScript, Three.js procedural geometry and PBR materials, existing classic-script runtime, shared browser logic runner from the wall-feature plan, Node syntax checks, and in-app browser visual QA.

## Global Constraints

- Execute after the wall-feature and rotation plans so the shared test runner and final layout interactions are present.
- Keep the rigid geometry of every model inside its saved width × length × height envelope; only flexible handles may slightly exceed it.
- Collision and placement continue to use the existing measured rectangular footprint, never mesh bounds.
- Front is local `-Z`; retain existing `inst.rotated` and `model3dFacing` transforms.
- Keep the exact current long-face correction for the three-tier rack and do not migrate instance positions.
- Preserve the existing dedicated RX3, Maxwell, and Gazelle builders and route them through the same failure-safe dispatcher.
- Legacy broad profiles remain available as manual generic fallbacks but must not be labeled photo-matched.
- Prefer shared geometries/materials and disable decorative shadows where they do not improve depth.
- Add no downloaded model, remote dependency, manufacturer logo, or package-manager dependency.
- Existing dirty worktree changes are user work; inspect and stage only task-owned hunks.

## File Structure

- Create `equipment-models.js` — model kit, exact builder registry, and the eight new procedural builders.
- Create `tests/equipment-profiles.test.js` — exact/negative routing and registry assertions.
- Modify `tests/planner-logic-runner.html` — load the registry and profile test.
- Modify `app.js` — exact profile keys, family mapping, inference precedence, and accurate photo-matched labeling.
- Modify `view3d.js` — failure-safe dedicated dispatch, fallback cleanup, metadata, counters, and exact-profile long-face handling.
- Modify `gltf-runtime.js` — load `equipment-models.js` after `app.js` and before `view3d.js`, then bump cache keys after QA.
- Modify `design-qa.md` — footprint, profile, builder, orientation, screenshot, and failure-fallback evidence.

---

### Task 1: Add exact profile routing and the external builder registry

**Files:**
- Modify: `app.js:729-850`
- Create: `equipment-models.js`
- Create: `tests/equipment-profiles.test.js`
- Modify: `tests/planner-logic-runner.html`
- Modify: `gltf-runtime.js:20-29`

**Interfaces:**
- Consumes: item records with `brand`, `name`, `category`, and optional manual model overrides.
- Produces: eight exact profile keys and `window.GymEquipmentModels` with `has(profile)`, `keys()`, `build(profile,view,group,inst,base,height)`, and `createModelKit()`.

- [ ] **Step 1: Write failing exact-routing and negative-control tests**

Add these exact expectations:

```js
const cases=[
  [{brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge"},"ice-barrel-500"],
  [{brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning"},"syedee-stair-machine"],
  [{brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning"},"nordictrack-x16"],
  [{brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches"},"ritfit-gator-bench"],
  [{brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper"},"brightway-hs08-row"],
  [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper"},"shizhuo-seated-standing-row"],
  [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"wanjia-combo-adductor"],
  [{brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage"},"yindun-three-tier-rack"],
];
cases.forEach(([item,expected])=>GymTests.equal(equipmentModelProfile(item),expected));
```

Negative controls: another brand’s `Adjustable Weight Bench`, `Incline Treadmill`, `HS08`, and `Three-Tier Dumbbell Rack` must receive only the appropriate legacy generic profile or `standard`, never an exact key. Also assert the second Wanjia item with the same Combo Adductor name but 5.26×1.89×5.30-ft dimensions does not receive `wanjia-combo-adductor`.

- [ ] **Step 2: Run the logic runner and verify all eight routes fail**

Expected: existing broad keys such as `step-in-plunge`, `commercial-stair`, and `incline-treadmill` are returned instead of the exact keys.

- [ ] **Step 3: Add profile definitions and exact-first inference**

Add these keys to `MODEL3D_PROFILES` and `MODEL3D_PROFILE_FAMILY`:

```js
"ice-barrel-500":"cold-plunge",
"syedee-stair-machine":"stair-climber",
"nordictrack-x16":"treadmill",
"ritfit-gator-bench":"bench",
"brightway-hs08-row":"rowing-machine",
"shizhuo-seated-standing-row":"rowing-machine",
"wanjia-combo-adductor":"adductor",
"yindun-three-tier-rack":"storage-rack"
```

In `inferEquipmentModelProfile()`, normalize brand and name separately and require both for each exact match before the current broad regular expressions. For the duplicate Wanjia product name, also require dimensions within 0.02 ft of 4.99×2.38×4.61 ft. Add `DEDICATED_MODEL_PROFILES`, containing these eight plus `gazelle-pro`, `maxwell-903bh`, and `rx3-compact-smith`. Change `itemUsesPhotoMatched3d()` to return true only for that set when no local GLB exists.

- [ ] **Step 4: Create the registry and model kit**

Create:

```js
(function(){
  "use strict";
  const BUILDERS=Object.create(null);

  function createModelKit(view,group,inst,base,height){
    const w=Math.max(.4,base.w),d=Math.max(.4,base.h),h=Math.max(.45,height);
    const material=spec=>view.material(spec);
    const addBox=(size,pos,mat,options={})=>view.box(group,size,pos,mat,{...options,instId:inst.id});
    const addCylinder=(radius,length,pos,mat,options={})=>view.cylinder(group,radius,length,pos,mat,{...options,instId:inst.id});
    const addBeam=(start,end,width,mat,depth=width)=>view.beam(group,start,end,width,depth,mat,{instId:inst.id});
    const addTube=(start,end,radius,mat,segments=14)=>view.tube(group,start,end,radius,mat,{instId:inst.id,segments});
    return {w,d,h,material,addBox,addCylinder,addBeam,addTube};
  }

  function build(profile,view,group,inst,base,height){
    const builder=BUILDERS[profile];
    if(!builder) return null;
    return {builderKey:profile,modelType:builder(view,group,inst,base,height)};
  }

  window.GymEquipmentModels=Object.freeze({has:key=>!!BUILDERS[key],keys:()=>Object.keys(BUILDERS),build,createModelKit});
})();
```

Do not register a profile key until its complete builder is implemented.

- [ ] **Step 5: Load the registry and verify routing tests**

Load `./equipment-models.js?v=1` after `app.js` and before `view3d.js`. Add runner assertions that the namespace exists and initially has no exact builder keys. Require all profile-routing tests to pass.

- [ ] **Step 6: Run checks and commit routing**

```bash
node --check app.js
node --check equipment-models.js
node --check tests/equipment-profiles.test.js
git diff --check
```

Stage only profile/registry/load-order/test hunks and commit:

```bash
git commit -m "feat: add exact equipment profile routing"
```

---

### Task 2: Build Ice Barrel, stair machine, X16, and GATOR models

**Files:**
- Modify: `equipment-models.js`
- Modify: `tests/equipment-profiles.test.js`

**Interfaces:**
- Consumes: `createModelKit()` and the measured `{w,d,h}` envelope.
- Produces: `buildIceBarrel500Model()`, `buildSyedeeStairMachineModel()`, `buildNordicTrackX16Model()`, and `buildRitfitGatorBenchModel()`.

- [ ] **Step 1: Write failing builder-registration tests**

Assert `GymEquipmentModels.has()` is true for the four profile keys and that `build()` returns their exact `builderKey`. A minimal fake view should count boxes, cylinders, beams, and tubes; assert each builder creates at least the signature counts below and every supplied box center/half-size stays within the normalized envelope.

Use this probe shape in the test:

```js
function modelProbe(){
  const parts=[];
  const record=(kind,size,pos)=>{ parts.push({kind,size,pos}); return {userData:{}}; };
  const view={
    material:spec=>spec,
    box:(group,size,pos)=>record("box",size,pos),
    cylinder:(group,radius,length,pos)=>record("cylinder",{x:radius*2,y:length,z:radius*2},pos),
    beam:(group,start,end,width,depth)=>record("beam",{start,end,width,depth},{x:0,y:0,z:0}),
    tube:(group,start,end,radius)=>record("tube",{start,end,radius},{x:0,y:0,z:0}),
  };
  return {parts,view,group:{add(){}}};
}
```

Expected minimum primitive counts: Ice Barrel 10, stair machine 28, X16 20, GATOR 22.

- [ ] **Step 2: Implement the Ice Barrel 500 silhouette**

Use matte shell `0x0b0d10`, rubber rim `0x050607`, water `0x55c8df` at 45% opacity, and restrained chrome plumbing. Build:

```js
rear well:      box .90w × .82h × .58d at (0,.46h,.16d)
front step:     box .84w × .24h × .28d at (0,.12h,-.34d)
sloped shoulder: two beams from (±.42w,.28h,-.22d) to (±.42w,.78h,-.03d)
upper rim:      four separate rails around the rear opening, never a solid lid
water:          thin plane/box .70w × .012h × .40d at (0,.88h,.16d)
drain:          side cylinder and short dark hose at x=-.46w
```

Round the stepped silhouette with vertical corner cylinders and a beveled rim. Keep the opening visibly recessed and return `"photo-matched Ice Barrel 500"`.

- [ ] **Step 3: Implement the commercial stair machine**

Use black powder coat, angular charcoal shrouds, chrome/dark handrails, warm-white emissive strips, and one orange accent. Create eight distinct treads:

```js
for(let i=0;i<8;i++){
  addBox({x:.62*w,y:.035*h,z:.16*d},{x:0,y:.12*h+i*.065*h,z:.31*d-i*.075*d},tread);
}
```

Add left/right triangular shroud beams, rear feet, console mast, a .55w×.18h landscape console at y=.80h, segmented curved rails from rear step height to the console, and thin white edge-light boxes with `castShadow:false`. Return `"photo-matched syedee Stair Machine"`.

- [ ] **Step 4: Implement the NordicTrack X16**

Build an inclined deck from separate frame, belt, side cushions, front motor/lift housing, and rear roller. Use `rotationX:-.13` consistently for deck layers. Add two sweeping rails as three beam segments per side, a central display mast, pivot cylinder, and a landscape screen whose visible diagonal is approximately 16 inches relative to the saved 38.1-inch width. Use a dark cyan low-intensity emissive screen. Return `"photo-matched NordicTrack X16"`.

- [ ] **Step 5: Implement the RitFit GATOR bench**

Use an open triangular center spine, two broad stabilizer feet, separate seat/back/head pads, a silver adjustment ladder, and paired front leg rollers. The recipe must include:

```js
spine beams: rear low point to back hinge, then hinge to front foot
pads: .44w seat, .52w tapered back, .40w head pad with visible gaps
ladder: two silver rails plus 7 individual rungs
roller bar: chrome transverse cylinder plus two black foam cylinders per side
```

Do not add a footprint-filling base slab. Return `"photo-matched RitFit GATOR bench"`.

- [ ] **Step 6: Run primitive-envelope tests and commit**

Require all four builders to be registered, meet minimum detail counts, and stay within the rigid envelope. Run syntax and diff checks, then commit:

```bash
git commit -m "feat: add exact recovery and cardio models"
```

---

### Task 3: Build the two rows, adductor, and empty storage rack

**Files:**
- Modify: `equipment-models.js`
- Modify: `tests/equipment-profiles.test.js`

**Interfaces:**
- Consumes: `createModelKit()` and exact profile routing.
- Produces: `buildBrightwayHS08RowModel()`, `buildShizhuoSeatedStandingRowModel()`, `buildWanjiaComboAdductorModel()`, and `buildYindunThreeTierRackModel()`.

- [ ] **Step 1: Write failing registry/detail tests**

Assert registration, exact builder keys, minimum primitive counts, and rigid-envelope bounds for all four. Expected minimum counts: HS08 30, seated/standing row 24, adductor 28, rack 24.

- [ ] **Step 2: Implement the Brightway HS08 row**

Use black/charcoal structure with a vivid `0xb91c1c` yoke and arms. Build a narrow open base, tall rear selector tower, 10–12 individual black plates, twin chrome guide rods, dark shroud, overhead red cross-yoke, two articulated pull arms, compact seat and chest pad, and two separate textured footplates. Weight plates must be black, not silver. Return `"photo-matched Brightway HS08 row"`.

- [ ] **Step 3: Implement the Shizhuo seated/standing row**

Build a low open frame with no tower, broad textured front platform, inclined seat/chest assembly, central pivot axle, two independent red sweeping arms, rubber handles, and empty transverse weight horns with dark end stops. The platform and body must leave visible floor around the frame. Return `"photo-matched Shizhuo seated-standing row"`.

- [ ] **Step 4: Implement the Wanjia combo adductor**

Create two open base rails, side/rear selector tower with 10 individual plates and guide rods, low seat, angled back, paired red pivot arms, two thigh rollers per side, side hand grips, and front foot supports. Use black upholstery and keep the central working area visibly open. Return `"photo-matched Wanjia combo adductor"`.

- [ ] **Step 5: Implement the empty Yindun three-tier rack**

Use gray powder coat and dark rubber saddle inserts. Build two A-frame ends, three paired angled rails running along the 5.58-ft axis, end cross braces, and 6–8 empty saddles per tier. A saddle is two small opposing blocks with a center gap; generate no bar, handle, plate, or dumbbell cylinders. Return `"photo-matched empty Yindun three-tier rack"`.

- [ ] **Step 6: Preserve the rack orientation contract**

Add `yindun-three-tier-rack` to the existing `longFaceProfile` list in `view3d.js`. Unit-test that other seven new profiles are not long-face profiles and the rack model base remains `{w:fp.L,h:fp.W}` before placement rotation.

- [ ] **Step 7: Run tests and commit strength/storage models**

Run all registry/envelope tests and syntax checks, then commit:

```bash
git commit -m "feat: add exact strength and storage models"
```

---

### Task 4: Unify all eleven dedicated builders behind failure-safe dispatch

**Files:**
- Modify: `view3d.js:942-1025,1159-1510,1510-1865,2274-2305`
- Modify: `tests/equipment-profiles.test.js`

**Interfaces:**
- Consumes: the eight `GymEquipmentModels` builders and existing RX3, Maxwell, and Gazelle methods.
- Produces: `tryBuildDedicatedEquipmentModel()` plus host/group diagnostics and generic fallback on failure.

- [ ] **Step 1: Write failing dispatcher-contract tests**

Define the expected result shapes:

```js
{built:true,builderKey,modelType,root}
{built:false,error:null}
{built:false,error:Error}
```

Test known, unknown, and throwing builders with a fake view/group. Assert the throwing case leaves the fallback path callable and does not retain staged click targets.

- [ ] **Step 2: Implement staged dedicated dispatch**

Add:

```js
tryBuildDedicatedEquipmentModel(group,inst,item,base,height,profile){
  const staged=new THREE.Group();
  const clickStart=this.clickTargets.length;
  try{
    let result=null;
    if(profile==="rx3-compact-smith") result={builderKey:profile,modelType:this.buildRx3CompactSmithModel(staged,inst,base,height)};
    else if(profile==="maxwell-903bh") result={builderKey:profile,modelType:this.buildMaxwell903BHModel(staged,inst,base,height)};
    else if(profile==="gazelle-pro") result={builderKey:profile,modelType:this.buildGazelleModel(staged,inst,base,height)};
    else result=window.GymEquipmentModels?.build(profile,this,staged,inst,base,height)||null;
    if(!result) return {built:false,error:null};
    group.add(staged);
    return {built:true,...result,root:staged};
  }catch(error){
    this.clickTargets.length=clickStart;
    staged.removeFromParent();
    return {built:false,error:error instanceof Error?error:new Error(String(error))};
  }
}
```

- [ ] **Step 3: Remove recursive exact dispatch from generic branches**

Call the dispatcher once at the top of `buildEquipmentModel()`. On success, set model metadata and skip the family branch. On a missing or failed builder, continue into the family branch without calling RX3, Maxwell, or Gazelle again. Retain broad profile details only as generic fallback geometry.

- [ ] **Step 4: Add placement-group and host diagnostics**

For every placement group, store:

```js
modelProfile, modelBuilder, dedicatedModel,
canonicalFootprint, worldFootprint, measuredFootprint
```

Expose `data-dedicated-models`, `data-builder-failures`, `data-model-profiles`, and `data-model-builders` on each 3D host. Profiles/builders are sorted comma-separated keys so tests are deterministic. Append one warning when a dedicated builder falls back.

- [ ] **Step 5: Correct reconstruction labeling and counts**

Increment `dedicatedModelCount` only after a successful dedicated build. Keep `reconstructedModelCount` for all procedural fallbacks. Layout 3 must report 11 dedicated models, zero builder failures, and these sorted profiles:

```text
brightway-hs08-row,gazelle-pro,ice-barrel-500,maxwell-903bh,
nordictrack-x16,ritfit-gator-bench,rx3-compact-smith,
shizhuo-seated-standing-row,syedee-stair-machine,
wanjia-combo-adductor,yindun-three-tier-rack
```

- [ ] **Step 6: Test deliberate builder failure**

Save `const originalModels=window.GymEquipmentModels`, temporarily replace the namespace with `{...originalModels,build(profile,...args){ if(profile==="nordictrack-x16") throw new Error("test builder failure"); return originalModels.build(profile,...args); }}`, rebuild Preview, and assert `data-builder-failures="1"` while all eleven placement groups still exist and the X16 uses its generic treadmill model. Restore `window.GymEquipmentModels=originalModels` immediately after the assertion and rebuild once more.

- [ ] **Step 7: Run checks and commit dispatch**

```bash
node --check equipment-models.js
node --check view3d.js
node --check app.js
git diff --check
```

Commit:

```bash
git commit -m "feat: add failure-safe dedicated model dispatch"
```

---

### Task 5: Verify measurements, orientation, realism, and Walkthrough safety

**Files:**
- Modify: `gltf-runtime.js:20-29`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: all eleven dedicated builders and renderer diagnostics.
- Produces: verified exact Layout 3 models and final cache-busted runtime.

- [ ] **Step 1: Run all logic and syntax checks**

```bash
node --check app.js
node --check equipment-models.js
node --check view3d.js
node --input-type=module --check < gltf-runtime.js
git diff --check
```

Require the shared logic runner to report zero failures.

- [ ] **Step 2: Assert the Layout 3 renderer diagnostics**

In Preview require:

```js
const host=document.querySelector('[data-gym3d="preview"]');
console.assert(host.dataset.inRoomModels==="11");
console.assert(host.dataset.matchedProfileModels==="11");
console.assert(host.dataset.dedicatedModels==="11");
console.assert(host.dataset.builderFailures==="0");
```

- [ ] **Step 3: Verify canonical dimensions within 0.001 ft**

Compare each `canonicalFootprint` with these expected W×L×H values:

```text
Ice Barrel 2.5583 × 4.8000 × 3.5000 ft
Stair      2.6667 × 4.1667 × 6.8333 ft
X16        3.1750 × 5.8250 × 6.1083 ft
GATOR      2.1667 × 4.8333 × 4.4167 ft
HS08       2.8200 × 4.2000 × 6.2800 ft
Row        3.6700 × 5.2100 × 4.1800 ft
Adductor   2.3800 × 4.9900 × 4.6100 ft
Rack       2.2200 × 5.5800 × 3.2400 ft
```

Compare each `worldFootprint` against `instanceDims()` and its saved x/y rectangle. No model may alter `__invalid`, reserved area, or placement values.

- [ ] **Step 4: Capture front and rear visual checks for every new product**

In Split mode select and Frame each of the eight products. Inspect a front-oblique and rear-oblique angle for its signature parts from Tasks 2–3. Require open frames where the product is open, black selector plates, empty rack saddles, distinct cardio belts/treads, and no generic base slab.

- [ ] **Step 5: Verify orientation and black-wall legibility in Walkthrough**

Walk from the door through the center aisle and around each model. Confirm model fronts match Plan orientation, handles and arms do not block the camera outside measured bodies, emissive accents remain restrained, and silhouettes remain readable against black walls and warm decoration.

- [ ] **Step 6: Verify performance and console output**

Orbit and walk continuously for at least one minute. Require responsive movement, stable shadows, zero console errors, zero repeated builder warnings, and no mesh flicker or obvious z-fighting.

- [ ] **Step 7: Record QA, bump cache keys, and commit**

Record profile list, builder list, dimensions, orientations, screenshots, failure-fallback result, and zero-error result in `design-qa.md`. Bump `equipment-models.js`, `app.js`, and `view3d.js` versions in `gltf-runtime.js`, then commit:

```bash
git commit -m "test: verify dedicated Layout 3 equipment models"
```
