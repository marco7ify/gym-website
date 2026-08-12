# Faithful GATOR and Echo Rower Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified RitFit GATOR bench and generic Rogue Echo Rower with exact-profile, lightweight, semantically testable procedural models while preserving their saved planner footprints.

**Architecture:** Keep the existing `GymEquipmentModels` registry and staged dedicated-builder fallback. Add exact Rogue profile inference and an exact-profile visual-height override, rebuild the GATOR builder, and add an Echo builder using the existing model-kit primitives. Protect both models with pure geometry probes and real-Three lifecycle tests before advancing runtime cache URLs atomically.

**Tech Stack:** Browser-global JavaScript, Three.js, procedural Box/Cylinder/Beam/Tube geometry, existing `GymTests` browser harness, real-Three WebGL test runner.

## Global Constraints

- Preserve GATOR's saved 26 in × 58 in × 53 in planner envelope and all three saved placements.
- Preserve Echo Rower's saved 26 in × 99 in floor footprint; treat saved 16 in as exact seat height, not total model height.
- Do not import GLB/GLTF files, external textures, photo planes, or per-machine lights.
- Exact-name inference must not affect other rowers or adjustable benches.
- Rigid floor-contact structure must remain inside each saved width/length footprint.
- GATOR budget: at most 58 visible meshes, 6 shared materials, and 26 unique geometries.
- Echo budget: at most 72 visible meshes, 8 shared materials, and 30 unique geometries.
- Dedicated-builder failure must retain the complete generic family fallback and leak no staged resources or click targets.
- Every visible dedicated mesh must expose a stable `partTag`.
- Use browser-observed RED → GREEN development for every production change.

---

### Task 1: Exact Echo profile and visual-height contract

**Files:**
- Modify: `app.js:744-905`
- Modify: `view3d.js:1318-1370`
- Modify: `tests/equipment-profiles.test.js:1-240`
- Modify: `tests/equipment-dispatch-3d.test.js:1-150`
- Modify: `tests/planner-logic-runner.html:6-22`

**Interfaces:**
- Produces: profile key `rogue-echo-rower` in `MODEL3D_PROFILES`, `MODEL3D_PROFILE_FAMILY`, and `DEDICATED_MODEL_PROFILES`.
- Produces: `equipmentModelVisualHeight(profile, fp, ceilingFt): number`.
- Consumes: exact canonical brand/name matching already used by `inferEquipmentModelProfile(item)`.
- Contract: `equipmentModelVisualHeight("rogue-echo-rower", fp, ceiling)` returns `max(16/12, 3.25)` clamped to the renderer ceiling allowance, while the item and `footprint(item).H` remain unchanged.

- [ ] **Step 1: Write exact-profile and height RED tests**

Add these cases to `tests/equipment-profiles.test.js`:

```js
GymTests.test("matches only the exact Rogue Echo Rower profile",()=>{
  GymTests.equal(inferEquipmentModelProfile({brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning"}),"rogue-echo-rower");
  GymTests.equal(equipmentModelProfile({brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning",model3dFamily:"auto",model3dProfile:"auto"}),"rogue-echo-rower");
  [
    {brand:"Rogue",name:"Echo Rower"},
    {brand:"Rogue Fitness",name:"Rogue Echo Rower Replacement Strap"},
    {brand:"Concept2",name:"RowErg"},
  ].forEach(item=>GymTests.equal(inferEquipmentModelProfile({...item,category:"Cardio & Conditioning"}),"standard"));
});

GymTests.test("treats Echo saved height as seat height without mutating its footprint",()=>{
  const item={brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning",unit:"in",width:26,length:99,height:16};
  const before=deepCopy(item);
  const fp=footprint(item);
  GymTests.closeTo(equipmentModelVisualHeight("rogue-echo-rower",fp,9),3.25,1e-9);
  GymTests.deepEqual(footprint(item),{W:26/12,L:99/12,H:16/12});
  GymTests.deepEqual(item,before);
});
```

Add an initial real-Three assertion that an exact Echo placement publishes a canonical height of 16 in but a world/model height above 16 in.

- [ ] **Step 2: Run the browser tests and capture RED**

Run fresh cache-busted URLs:

```text
tests/planner-logic-runner.html?gator-echo-task1-red=1
tests/equipment-dispatch-3d-runner.html?gator-echo-task1-red=1
```

Expected: failures state that `rogue-echo-rower` and `equipmentModelVisualHeight` are missing; existing suites remain green.

- [ ] **Step 3: Add the exact profile and height helper**

In `app.js`, add the profile registration and exact inference before broad matching:

```js
{value:"rogue-echo-rower", label:"Rogue Echo Rower"},

"rogue-echo-rower":"rowing-machine",

if(exact("rogue fitness","rogue echo rower")) return "rogue-echo-rower";

function equipmentModelVisualHeight(profile,fp,ceilingFt){
  const measured=Math.max(0,safeNum(fp?.H));
  const requested=profile==="rogue-echo-rower" ? Math.max(measured,3.25) : measured;
  return clamp(requested || 3.2,.45,Math.max(.6,safeNum(ceilingFt)+1.5));
}
```

In `view3d.js`, replace the direct height clamp in `buildEquipment()` with:

```js
const defaultHeight=fp.H || fallbackHeight;
const height=profile==="rogue-echo-rower"
  ? equipmentModelVisualHeight(profile,{...fp,H:defaultHeight},this.ceiling)
  : clamp(defaultHeight,.45,Math.max(.6,this.ceiling+1.5));
```

Publish the unchanged measured datum separately:

```js
group.userData.canonicalFootprint={widthFt:fp.W,depthFt:fp.L,heightFt:fp.H};
group.userData.visualHeightFt=height;
```

- [ ] **Step 4: Run logic and real-Three GREEN**

Run the two Task 1 GREEN URLs. Expected: complete=true, failures=0, no console warnings/errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add app.js view3d.js tests/equipment-profiles.test.js tests/equipment-dispatch-3d.test.js tests/planner-logic-runner.html
git commit -m "feat: add exact Rogue Echo Rower profile"
```

---

### Task 2: Rebuild the RitFit GATOR bench

**Files:**
- Modify: `equipment-models.js:320-365`
- Modify: `tests/equipment-profiles.test.js:180-560`
- Modify: `tests/equipment-dispatch-3d.test.js:620-850`

**Interfaces:**
- Consumes: `GymEquipmentModels.createModelKit(...)` and existing `ritfit-gator-bench` registry key.
- Produces: `buildRitfitGatorBenchModel(view,group,inst,base,height): "photo-matched RitFit GATOR bench"`.
- Produces semantic tags listed in the approved design, including `gator-angle-station`, `gator-foam-roller`, and transport hardware.

- [ ] **Step 1: Replace count-only GATOR tests with product contracts**

Add helpers and assertions to `tests/equipment-profiles.test.js`:

```js
function gatorProbeParts(){
  const probe=modelProbe();
  window.GymEquipmentModels.build("ritfit-gator-bench",probe.view,probe.group,{id:"gator-probe"},{w:26/12,h:58/12},53/12);
  return probe.parts;
}

GymTests.test("builds the GATOR pads at official proportions",()=>{
  const parts=gatorProbeParts();
  const sizes=Object.fromEntries(["seat","back","head"].map(name=>{
    const part=partsByTag(parts,`gator-${name}-pad`)[0];
    GymTests.assert(part,`Missing GATOR ${name} pad`);
    return [name,part.size];
  }));
  GymTests.closeTo(sizes.seat.z,12.6/12,.03);
  GymTests.closeTo(sizes.back.z,25.9/12,.03);
  GymTests.closeTo(sizes.head.z,9/12,.03);
  [sizes.seat,sizes.back,sizes.head].forEach(size=>{
    GymTests.closeTo(size.x,11.8/12,.03);
    GymTests.closeTo(size.y,2.7/12,.025);
  });
});

GymTests.test("exposes the complete GATOR adjustment and transport assembly",()=>{
  const parts=gatorProbeParts();
  GymTests.equal(partsByTag(parts,"gator-angle-station").length,10);
  GymTests.equal(partsByTag(parts,"gator-foam-roller").length,4);
  GymTests.equal(partsByTag(parts,"gator-roller-crossbar").length,2);
  GymTests.equal(partsByTag(parts,"gator-transport-wheel").length,2);
  ["gator-main-spine","gator-front-stabilizer","gator-rear-stabilizer","gator-lifting-handle","gator-angle-plate","gator-lock-pin","gator-front-brace"].forEach(tag=>{
    GymTests.assert(partsByTag(parts,tag).length>0,`Missing ${tag}`);
  });
});
```

Update the rigid-envelope helper to assert every GATOR part is within `26/12 × 58/12 × 53/12`, touches the floor, and every visible part has `partTag`.

- [ ] **Step 2: Capture focused RED**

Run `planner-logic-runner.html?gator-task2-red=1`. Expected: failures for wrong pad proportions, seven rather than ten stations, missing transport hardware, and old tag names.

- [ ] **Step 3: Implement the faithful GATOR assembly**

Rebuild `buildRitfitGatorBenchModel` using this structure:

```js
function buildRitfitGatorBenchModel(view,group,inst,base,height){
  const kit=createModelKit(view,group,inst,base,height);
  const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=kit;
  const frame=material({color:0x101316,roughness:.56,metalness:.4,envMapIntensity:.68});
  const pad=material({color:0x07090b,roughness:.91,metalness:.01,envMapIntensity:.1});
  const silver=material({color:0xbfc6ca,roughness:.24,metalness:.9,envMapIntensity:1.15});
  const rubber=material({color:0x040506,roughness:.96,metalness:0,envMapIntensity:.05});

  addBox({x:w*.92,y:h*.045,z:d*.07},{x:0,y:h*.025,z:d*.39},frame,{partTag:"gator-rear-stabilizer"});
  addBox({x:w*.72,y:h*.045,z:d*.07},{x:0,y:h*.025,z:-d*.39},frame,{partTag:"gator-front-stabilizer"});
  addBeam({x:0,y:h*.1,z:d*.36},{x:0,y:h*.45,z:-d*.2},w*.09,frame,w*.065,{partTag:"gator-main-spine"});
  [-1,1].forEach((side,index)=>{
    addCylinder(w*.045,w*.075,{x:side*w*.29,y:w*.045,z:d*.36},rubber,{rotationZ:Math.PI/2,partTag:"gator-transport-wheel",side:side<0?"left":"right",partIndex:index,geometryKey:"gator-wheel"});
    addBox({x:w*.13,y:h*.025,z:d*.08},{x:side*w*.38,y:h*.015,z:-d*.39},rubber,{partTag:"gator-foot-pad",side:side<0?"left":"right",geometryKey:"gator-foot-pad"});
  });
  addTube({x:-w*.16,y:h*.09,z:d*.43},{x:w*.16,y:h*.09,z:d*.43},w*.022,rubber,12,{partTag:"gator-lifting-handle"});

  addBox({x:11.8/12,y:2.7/12,z:12.6/12},{x:0,y:h*.34,z:d*.21},pad,{rotationX:-.12,partTag:"gator-seat-pad"});
  addBox({x:11.8/12,y:2.7/12,z:25.9/12},{x:0,y:h*.58,z:-d*.08},pad,{rotationX:-.55,partTag:"gator-back-pad"});
  addBox({x:11.8/12,y:2.7/12,z:9/12},{x:0,y:h*.84,z:-d*.34},pad,{rotationX:-.43,partTag:"gator-head-pad"});
  addBeam({x:0,y:h*.18,z:d*.23},{x:0,y:h*.32,z:d*.18},w*.055,frame,w*.05,{partTag:"gator-seat-support"});
  addBeam({x:0,y:h*.28,z:d*.08},{x:0,y:h*.69,z:-d*.2},w*.06,frame,w*.05,{partTag:"gator-back-support"});
  addBeam({x:0,y:h*.68,z:-d*.2},{x:0,y:h*.81,z:-d*.34},w*.05,frame,w*.045,{partTag:"gator-head-support"});

  addBox({x:w*.52,y:h*.05,z:d*.42},{x:0,y:h*.25,z:d*.03},silver,{rotationX:-.12,partTag:"gator-angle-plate"});
  for(let index=0;index<10;index++){
    const t=index/9;
    addBox({x:w*.035,y:h*.018,z:d*.025},{x:0,y:h*(.20+t*.18),z:d*(.20-t*.34)},rubber,{partTag:"gator-angle-station",partIndex:index,geometryKey:"gator-station",castShadow:false});
  }
  addCylinder(w*.025,w*.38,{x:0,y:h*.31,z:d*.04},silver,{rotationZ:Math.PI/2,partTag:"gator-lock-pin"});
  [h*.68,h*.77].forEach((y,barIndex)=>{
    const z=-d*(.25+barIndex*.06);
    addCylinder(w*.022,w*.78,{x:0,y,z},silver,{rotationZ:Math.PI/2,partTag:"gator-roller-crossbar",partIndex:barIndex,geometryKey:"gator-crossbar"});
    [-1,1].forEach((side,index)=>addCylinder(h*.075,8.7/12,{x:side*w*.3,y,z},rubber,{rotationZ:Math.PI/2,partTag:"gator-foam-roller",side:side<0?"left":"right",partIndex:barIndex*2+index,geometryKey:"gator-roller"}));
  });
  addBeam({x:0,y:h*.08,z:-d*.4},{x:0,y:h*.23,z:-d*.33},w*.055,frame,w*.05,{partTag:"gator-front-brace"});
  return "photo-matched RitFit GATOR bench";
}
```

Use shared `geometryKey` values for repeated feet, stations, wheels, roller crossbars, and foam rollers. Tag every visible mesh using the exact names from the design. The pad boxes use `rotationX` and remain inside the envelope after rotation.

- [ ] **Step 4: Run focused GREEN and real-Three regression**

Run:

```text
tests/planner-logic-runner.html?gator-task2-green=1
tests/equipment-dispatch-3d-runner.html?gator-task2-green=1
```

Expected: zero failures, all three saved GATOR placements unchanged, resources disposed once.

- [ ] **Step 5: Review the rendered GATOR from five angles**

In an isolated imported layout, capture front three-quarter, side, rear three-quarter, elevated, and low structural views. Reject the task if the angle plate, ten stations, pad separation, rollers, wheels, or grounded frame are not visually clear.

- [ ] **Step 6: Commit Task 2**

```bash
git add equipment-models.js tests/equipment-profiles.test.js tests/equipment-dispatch-3d.test.js
git commit -m "feat: rebuild the RitFit GATOR bench"
```

---

### Task 3: Build the dedicated Rogue Echo Rower

**Files:**
- Modify: `equipment-models.js:500-525`
- Modify: `tests/equipment-profiles.test.js`
- Modify: `tests/equipment-dispatch-3d.test.js`

**Interfaces:**
- Consumes: exact `rogue-echo-rower` profile from Task 1 and `createModelKit`.
- Produces: `buildRogueEchoRowerModel(view,group,inst,base,height): "photo-matched Rogue Echo Rower"`.
- Registers: `BUILDERS["rogue-echo-rower"]=buildRogueEchoRowerModel`.

- [ ] **Step 1: Write Echo signature, measurement, and envelope tests**

Add to `tests/equipment-profiles.test.js`:

```js
function echoProbeParts(){
  const probe=modelProbe();
  window.GymEquipmentModels.build("rogue-echo-rower",probe.view,probe.group,{id:"echo-probe"},{w:26/12,h:99/12},3.25);
  return probe.parts;
}

GymTests.test("builds the Echo Rower at its exact footprint and seat height",()=>{
  const parts=echoProbeParts();
  assertRigidEnvelope(parts,{w:26/12,d:99/12,h:3.25});
  const seat=partsByTag(parts,"echo-seat")[0];
  GymTests.closeTo(partAabb(seat).max.y,16/12,.02,"Echo seat top must be 16 in");
  GymTests.assert(modelAabb(parts).max.y>16/12,"Echo monitor/fan must rise above the seat-height datum");
});

GymTests.test("exposes the complete Echo Rower signature",()=>{
  const parts=echoProbeParts();
  const exactCounts={
    "echo-seat":1,"echo-rear-foot":1,"echo-fan-housing":2,
    "echo-footplate":2,"echo-foot-strap":2,"echo-transport-wheel":2,
    "echo-turf-tire":2,"echo-monitor-mast":2,"echo-console-screen":1,
    "echo-phone-holder":1,"echo-rowing-handle":1,
  };
  Object.entries(exactCounts).forEach(([tag,count])=>GymTests.equal(partsByTag(parts,tag).length,count,tag));
  GymTests.assert(partsByTag(parts,"echo-fan-spoke").length>=12);
  GymTests.assert(partsByTag(parts,"echo-slide-rail").length>=1);
  GymTests.assert(partsByTag(parts,"echo-chain").length>=1);
});
```

Add assertions for a distinct rail channel, paired seat rollers, heel cups, damper, handle rest, fold hinge/latch, and 4.7-in console screen.

- [ ] **Step 2: Capture Echo RED**

Run logic and equipment real-Three runners with `?echo-task3-red=1`. Expected: missing builder/parts failures while all previous dedicated models remain green.

- [ ] **Step 3: Implement the Echo builder**

Add `buildRogueEchoRowerModel` before builder registration:

```js
function buildRogueEchoRowerModel(view,group,inst,base,height){
  const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
  const aluminum=material({color:0x171b1f,roughness:.48,metalness:.62,envMapIntensity:.85});
  const black=material({color:0x06080a,roughness:.83,metalness:.12,envMapIntensity:.24});
  const rubber=material({color:0x030405,roughness:.96,metalness:0,envMapIntensity:.05});
  const nickel=material({color:0xbec7cc,roughness:.2,metalness:.94,envMapIntensity:1.2});
  const screen=material({color:0x0b5367,emissive:0x16a6bd,emissiveIntensity:.55,roughness:.22,metalness:.08});

  addBox({x:w*.22,y:h*.08,z:d*.7},{x:0,y:h*.16,z:d*.12},aluminum,{partTag:"echo-slide-rail"});
  addBox({x:w*.055,y:h*.025,z:d*.66},{x:0,y:h*.205,z:d*.14},black,{partTag:"echo-rail-channel",castShadow:false});
  addBox({x:w*.64,y:h*.05,z:d*.055},{x:0,y:h*.045,z:d*.46},aluminum,{partTag:"echo-rear-foot"});
  addBox({x:w*.42,y:h*.065,z:d*.12},{x:0,y:16/12-h*.032,z:d*.18},black,{partTag:"echo-seat"});
  [-1,1].forEach((side,index)=>addCylinder(w*.035,w*.16,{x:side*w*.12,y:16/12-h*.10,z:d*.18},rubber,{rotationZ:Math.PI/2,partTag:"echo-seat-roller",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-seat-roller"}));
  addBox({x:w*.28,y:h*.05,z:d*.025},{x:0,y:h*.22,z:d*.42},rubber,{partTag:"echo-rail-stop"});

  [-1,1].forEach((side,index)=>addCylinder(w*.36,w*.065,{x:side*w*.035,y:h*.35,z:-d*.34},black,{rotationZ:Math.PI/2,segments:28,partTag:"echo-fan-housing",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-fan-shell"}));
  for(let index=0;index<12;index++){
    const angle=index*Math.PI/6;
    addBeam({x:0,y:h*.35,z:-d*.34},{x:Math.cos(angle)*w*.27,y:h*.35+Math.sin(angle)*w*.27,z:-d*.34},w*.012,black,w*.012,{partTag:"echo-fan-spoke",partIndex:index,geometryKey:"echo-fan-spoke",castShadow:false});
  }
  addCylinder(w*.055,w*.11,{x:0,y:h*.35,z:-d*.34},nickel,{rotationZ:Math.PI/2,segments:16,partTag:"echo-damper"});
  addBox({x:w*.82,y:h*.05,z:d*.055},{x:0,y:h*.04,z:-d*.39},aluminum,{partTag:"echo-front-foot"});
  [-1,1].forEach((side,index)=>{
    addCylinder(w*.055,w*.08,{x:side*w*.31,y:w*.055,z:-d*.39},rubber,{rotationZ:Math.PI/2,partTag:"echo-transport-wheel",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-wheel"});
    addCylinder(w*.085,w*.08,{x:side*w*.41,y:w*.085,z:-d*.34},rubber,{rotationZ:Math.PI/2,partTag:"echo-turf-tire",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-tire"});
    addBox({x:w*.26,y:h*.055,z:d*.12},{x:side*w*.17,y:h*.22,z:-d*.18},black,{rotationX:-.42,partTag:"echo-footplate",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-footplate"});
    addBox({x:w*.2,y:h*.025,z:d*.035},{x:side*w*.17,y:h*.245,z:-d*.18},rubber,{rotationX:-.42,partTag:"echo-foot-strap",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-strap",castShadow:false});
  });
  addTube({x:0,y:h*.35,z:-d*.29},{x:0,y:h*.42,z:-d*.08},w*.009,nickel,10,{partTag:"echo-chain",castShadow:false});
  addCylinder(w*.022,w*.55,{x:0,y:h*.43,z:-d*.06},black,{rotationZ:Math.PI/2,partTag:"echo-rowing-handle"});
  addBox({x:w*.2,y:h*.035,z:d*.04},{x:0,y:h*.39,z:-d*.14},black,{partTag:"echo-handle-rest"});
  addCylinder(w*.04,w*.42,{x:0,y:h*.2,z:-d*.06},aluminum,{rotationZ:Math.PI/2,partTag:"echo-fold-hinge"});
  addBox({x:w*.12,y:h*.055,z:d*.04},{x:0,y:h*.25,z:-d*.01},black,{partTag:"echo-fold-latch"});
  [-1,1].forEach((side,index)=>addBeam({x:side*w*.12,y:h*.39,z:-d*.25},{x:side*w*.12,y:h*.78,z:-d*.15},w*.025,aluminum,w*.025,{partTag:"echo-monitor-mast",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-monitor-mast"}));
  addBox({x:w*.4,y:h*.17,z:d*.045},{x:0,y:h*.82,z:-d*.14},black,{rotationX:-.1,partTag:"echo-console-shell"});
  addBox({x:3.9/12,y:2.6/12,z:d*.014},{x:0,y:h*.83,z:-d*.17},screen,{rotationX:-.1,partTag:"echo-console-screen",castShadow:false});
  addBox({x:3.45/12,y:h*.025,z:d*.07},{x:0,y:h*.93,z:-d*.11},black,{partTag:"echo-phone-holder"});
  return "photo-matched Rogue Echo Rower";
}
```

Use two shallow fan housing cylinders around a radial set of shared spoke beams. Keep the fan outer diameter within width. Use a thin tube for the chain and disable its shadow. Share geometry for spokes, wheels, tires, footplates, straps, seat rollers, and monitor masts.

- [ ] **Step 4: Run focused GREEN and forced-fallback tests**

Run logic and equipment real-Three runners. Temporarily force `GymEquipmentModels.build` to throw only for `rogue-echo-rower`; assert one generic rowing-machine fallback, one warning, zero leaked tagged parts, then restore and assert dedicated recovery.

- [ ] **Step 5: Review rendered Echo views**

Capture front three-quarter, exact side, rear three-quarter, elevated, low fan/footplate, and 5 ft 8 in Walkthrough views. The rower must read as a long 99-in air rower, not a selectorized seated-row machine.

- [ ] **Step 6: Commit Task 3**

```bash
git add equipment-models.js tests/equipment-profiles.test.js tests/equipment-dispatch-3d.test.js
git commit -m "feat: add the Rogue Echo Rower model"
```

---

### Task 4: Model lifecycle, documentation, and atomic cache delivery

**Files:**
- Modify: `tests/equipment-dispatch-3d.test.js`
- Modify: `tests/equipment-dispatch-3d-runner.js`
- Modify: `tests/equipment-dispatch-3d-runner.html`
- Modify: `tests/planner-logic-runner.html`
- Modify: `tests/runtime-cache.test.js`
- Modify: `tests/runtime-cache-runner.html`
- Modify: `gltf-runtime.js`
- Modify: `index.html:3057`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: both exact builders and visual-height contract.
- Produces: reproducible saved-placement/resource budgets and current cache contract.

- [ ] **Step 1: Add two-cycle resource and saved-state regressions**

Extend the equipment real-Three fixture with exact GATOR and Echo records. Capture all dedicated meshes including invisible siblings. Assert:

```js
GymTests.equal(gator.meshes.length<=58,true);
GymTests.equal(gator.materials.length<=6,true);
GymTests.equal(gator.geometries.length<=26,true);
GymTests.equal(echo.meshes.length<=72,true);
GymTests.equal(echo.materials.length<=8,true);
GymTests.equal(echo.geometries.length<=30,true);
GymTests.assert([...gator.meshes,...echo.meshes].every(mesh=>mesh.userData.partTag));
```

Destroy twice and assert every geometry/material is disposed exactly once and both summary objects are byte-equal across cycles. Assert GATOR's three source placements and Echo's saved item dimensions are byte-equal before/after rendering.

- [ ] **Step 2: Run complete model suites**

Run fresh planner logic, equipment real-Three, wall-feature real-Three, and garage-door real-Three runners. Expected: zero failures and empty relevant console logs.

- [ ] **Step 3: Advance cache expectations first and capture RED**

Update `tests/runtime-cache.test.js` to expect the next runtime entry and changed production/test assets:

```text
equipment-models.js: v4 → v5
app.js: v85 → v86
view3d.js: v40 → v41
equipment-profiles.test.js: v4 → v5
equipment-dispatch-3d.test.js: final-fix-v1 → gator-echo-v1
equipment-dispatch-3d-runner.js outer key: → gator-echo-v1
gltf-runtime.js entry: v39 → v40
```

Also advance the runtime-cache test URL. Run the cache runner and record the expected stale-key failures before changing production URLs.

- [ ] **Step 4: Apply the cache transition atomically**

Update `gltf-runtime.js`, `index.html`, planner logic runner, equipment runner JS/HTML, and runtime cache contracts in one patch. Do not change wall/garage runner URLs unless their loader source changed.

- [ ] **Step 5: Run final automated and visual gates**

Run runtime cache, planner logic, equipment real-Three, wall-feature real-Three, and garage-door real-Three on fresh URLs. Import the saved all-layout export and verify no equipment placement or non-model architecture changes. Orbit/walk for at least 30 seconds each and confirm stable semantic counts and no relevant console errors.

- [ ] **Step 6: Record truthful QA evidence**

Add source references, exact measurements, major-angle verdicts, fallback/recovery, resource budgets, stress duration, console outcome, and any unavoidable visibility limitation to `design-qa.md`.

- [ ] **Step 7: Commit Task 4**

```bash
git add tests/equipment-dispatch-3d.test.js tests/equipment-dispatch-3d-runner.js tests/equipment-dispatch-3d-runner.html tests/planner-logic-runner.html tests/runtime-cache.test.js tests/runtime-cache-runner.html gltf-runtime.js index.html design-qa.md
git commit -m "test: ship faithful GATOR and Echo models"
```
