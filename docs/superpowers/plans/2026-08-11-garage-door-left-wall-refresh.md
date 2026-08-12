# Garage Door and Left-Wall Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Layout 3's decorated bottom wall with a centered 16-foot traditional raised-panel garage door, move its mirror and LED treatment behind the Stair Machine/dumbbell rack, and move walnut slats behind the Ice Barrel without changing any equipment placement.

**Architecture:** Add a pure `GymGarageDoors` domain module for normalization, boundary resolution, Plan geometry, policy overrides, and the one-time Layout 3 migration. Add a separate Three.js `GymGarageDoor3D` builder so the already-large renderer only orchestrates wall cutting, diagnostics, focus, and minimap integration. Existing standard-door, wall-feature, equipment, import/export, and room-union behavior remains authoritative.

**Tech Stack:** Browser-global JavaScript, SVG/CSS, Three.js from the vendored ES module, localStorage JSON persistence, the existing synchronous `GymTests` harness, and in-browser real-Three regression runners.

## Global Constraints

- Work only in `/Users/tony/Documents/GitHub/gym-website/.worktrees/codex-garage-door-wall-refresh` on `codex/garage-door-wall-refresh`.
- Keep all 11 saved Layout 3 equipment instances at their current positions and orientations.
- Seed one bottom-wall garage opening at X `1 ft 11 in`, Y `18 ft 6 in`, plan size `16 ft × 1 ft`, physical height `7 ft`, leaving `1 ft 11 in` wall returns.
- Render the selected traditional matte-charcoal raised-panel style: four horizontal sections and four bays per section, for 16 panels.
- Keep the seeded garage architectural-only with `blocksPlacement:false` and `subtractsSpace:false`; globally enabled garage blocking must not invalidate the Gazelle or Combo Adductor/Abductor.
- Keep ordinary garage areas on the existing global reserved-area policy unless they explicitly carry a boolean override.
- Relocate the primary mirror to left start `0`, bottom `1 ft`, size `8 ft 9 in × 7 ft 6 in`.
- Relocate the mirror wash to left start `0`, bottom `8 ft 7 in`, size `8 ft 9 in × 1 in`, color `#ffd7aa`, brightness `65`.
- Relocate the slats to left start `9 ft`, bottom `0`, size `5 ft × 8 ft 6 in`, color `#8f5f3a`.
- Relocate the slat LEDs to left starts `8 ft 11 in` and `14 ft 1 in`, bottom `4 in`, size `1 in × 8 ft`, color `#ffb36b`, brightness `80`.
- Keep the right aisle mirror, top cardio LED, black walls, and rolled-rubber floor unchanged.
- Treat the mirror's `1 ft` bottom as the base-slab datum; it appears `8 in` above the raised platform behind the Stair Machine and `12 in` above the remaining floor.
- Do not add garage-door opening animation, exterior scenery, a style picker, a garage swing arc, or a garage leaf collider.
- Preserve the standard hinged-door model and its one physical swing collider.
- Advance JSON exports from schema version `12` to `13`; continue excluding `settings.aiApiKey`.
- Use test-driven development for every production change: observe a focused RED before implementation, then a fresh browser GREEN.
- Perform final visible QA on isolated browser storage and a minimum 60-second Preview/Walkthrough stress pass.

## File Structure

- Create `garage-doors.js`: pure garage defaults, normalization, per-area policy, physical boundary resolution, Plan panel-line geometry, and Layout 3 migration.
- Create `garage-door-3d.js`: Three.js raised-panel/fallback geometry only; no state or import logic.
- Modify `wall-features.js`: retain the exact legacy starter signature and publish the approved refreshed starter.
- Modify `app.js`: normalize garage metadata, call the signature-gated migration, apply per-area policy helpers, and preserve metadata through layout lifecycle operations.
- Modify `events.js`: normalize full/legacy imports through one helper, export v13, and support keyboard selection of Plan areas.
- Modify `layout.js`: render the architectural garage symbol and inspector explanation.
- Modify `view3d.js`: integrate resolved openings, garage groups, fallback diagnostics, area framing, and minimap segments.
- Modify `index.html`: garage symbol/focus CSS and final runtime entry version.
- Create `tests/garage-door-fixtures.js`: small, secret-free legacy/refreshed fixtures; do not copy the user's megabyte export or any settings key.
- Create `tests/garage-door.test.js`: pure data, migration, policy, import/export, Plan markup, and keyboard behavior.
- Create `tests/garage-door-3d-runner.html`, `tests/garage-door-3d-runner.js`, and `tests/garage-door-3d.test.js`: isolated real-Three renderer coverage.
- Modify the existing logic, wall-feature 3D, equipment 3D, and runtime-cache runners so every changed production dependency is loaded at one coherent final cache version.
- Append final evidence to `design-qa.md`.

---

### Task 1: Garage-Door Domain Primitives

**Files:**
- Create: `garage-doors.js`
- Create: `tests/garage-door-fixtures.js`
- Create: `tests/garage-door.test.js`
- Modify: `tests/planner-logic-runner.html:6-16`

**Interfaces:**
- Produces: `GymGarageDoors.REVISION === 1`.
- Produces: `GymGarageDoors.seededLayout3Area(): GarageArea` returning a fresh object.
- Produces: `GymGarageDoors.normalizeArea(source, normalizedArea): NormalizedArea`.
- Produces: `GymGarageDoors.blocksPlacement(area, enabledKinds): boolean`.
- Produces: `GymGarageDoors.subtractsSpace(area, enabledKinds): boolean`.
- Produces: `GymGarageDoors.boundarySegments(rects): BoundarySegment[]`.
- Produces: `GymGarageDoors.resolveOpening(rect, boundarySegments, metadata?): OpeningResolution`.
- Produces: `GymGarageDoors.planPanelLines(rect, resolution): PlanLine[]`.
- Consumes: plain room rectangles shaped `{x,y,w,h}`; it must not depend on `state`, DOM, SVG, or Three.js.

- [ ] **Step 1: Create the canonical secret-free fixtures and failing domain tests**

Create `tests/garage-door-fixtures.js` with the exact profile set and old wall-feature records:

```js
const GARAGE_LAYOUT3_PROFILES=[
  "brightway-hs08-row","gazelle-pro","ice-barrel-500","maxwell-903bh",
  "nordictrack-x16","ritfit-gator-bench","rx3-compact-smith",
  "shizhuo-seated-standing-row","syedee-stair-machine",
  "wanjia-combo-adductor","yindun-three-tier-rack",
].sort();

const GARAGE_LAYOUT3_ITEMS=[
  {id:"ice",brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge",width:2.5583,length:4.8,height:3.5},
  {id:"stair",brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning",width:2.6667,length:4.1667,height:6.8333},
  {id:"x16",brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning",width:3.175,length:5.825,height:6.1083},
  {id:"gator",brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches",width:2.1667,length:4.8333,height:4.4167},
  {id:"hs08",brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper",width:2.82,length:4.2,height:6.28},
  {id:"shizhuo",brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper",width:3.67,length:5.21,height:4.18},
  {id:"wanjia",brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",width:2.38,length:4.99,height:4.61},
  {id:"yindun",brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage",width:2.22,length:5.58,height:3.24},
  {id:"rx3",brand:"Get RX'd",name:"RX3 Tornado Compact Smith Machine",category:"Strength",width:4,length:2.6667,height:7.1667},
  {id:"maxwell",brand:"SalusHEAT",name:"Maxwell-903BH infrared sauna",category:"Sauna",width:5,length:4,height:7.5},
  {id:"gazelle",brand:"RitFit",name:"Gazelle Pro 3-in-1 Leg Press",category:"Leg Press",width:4,length:5,height:5},
];

const GARAGE_LAYOUT3_LEGACY_FEATURES=[
  {id:"wf_l3_primary_mirror",kind:"mirror",label:"Primary training mirror",wall:"bottom",startFt:2,startIn:0,bottomFt:1,bottomIn:6,widthFt:5,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
  {id:"wf_l3_aisle_mirror",kind:"mirror",label:"Secondary aisle mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
  {id:"wf_l3_gazelle_slats",kind:"slat",label:"Gazelle focal slat wall",wall:"bottom",startFt:12,startIn:9,bottomFt:0,bottomIn:0,widthFt:6,widthIn:9,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
  {id:"wf_l3_slat_led_left",kind:"led",label:"Slat frame, left",wall:"bottom",startFt:12,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
  {id:"wf_l3_slat_led_right",kind:"led",label:"Slat frame, right",wall:"bottom",startFt:19,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
  {id:"wf_l3_mirror_wash",kind:"led",label:"Mirror wash",wall:"bottom",startFt:2,startIn:0,bottomFt:7,bottomIn:3,widthFt:5,widthIn:0,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
  {id:"wf_l3_cardio_strip",kind:"led",label:"Cardio ambient strip",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
];

function garageLayout3Settings(){
  return {...deepCopy(DEFAULT_SETTINGS),roomWidthFt:19,roomWidthIn:10,roomLengthFt:19,roomLengthIn:6,ceilingHeightFt:9,ceilingHeightIn:0};
}

function garageLayout3Items(){
  return GARAGE_LAYOUT3_ITEMS.map(item=>({...item,unit:"ft"}));
}

function legacyGarageLayout3Fixture(){
  const items=garageLayout3Items();
  return {
    name:"Layout 3",
    settings:garageLayout3Settings(),
    items,
    layout:{
      ...deepCopy(DEFAULT_LAYOUT),
      instances:items.map((item,index)=>({id:`garage_inst_${index}`,itemId:item.id,xFt:index%4,yFt:Math.floor(index/4),rotated:index%2===1})),
      areas:[
        {id:"existing_entry",kind:"door",label:"Door",xFt:12,xIn:6,yFt:0,widthFt:3,widthIn:1,heightFt:1},
        {id:"existing_nogo",kind:"nogospace",label:"Keep clear",xFt:17,xIn:9,yFt:0,widthFt:2,widthIn:1,heightFt:3},
      ],
      outlets:[{id:"existing_outlet",label:"Outlet",xFt:9,xIn:0,yFt:0,yIn:0,voltage:"120V"}],
      wallExtensions:[{id:"left_extension",label:"Extension",wall:"left",startFt:14,startIn:3,lengthFt:5,lengthIn:8,depthFt:1,depthIn:9}],
      ceilingZones:[{id:"existing_ceiling",label:"Low ceiling",xFt:0,xIn:0,yFt:0,yIn:6,widthFt:2,widthIn:6,heightFt:5,heightIn:0,ceilingHeightFt:5,ceilingHeightIn:0}],
      floorZones:[{id:"existing_platform",label:"Raised floor",xFt:0,xIn:0,yFt:0,yIn:0,widthFt:19,widthIn:8,heightFt:3,heightIn:0,elevationIn:4}],
      flooringPieces:[{id:"existing_flooring",typeId:"stall_mat_4x6",label:"Saved mat",xFt:4,xIn:0,yFt:8,yIn:0,rotated:true,price:55}],
      wallFeatures:deepCopy(GARAGE_LAYOUT3_LEGACY_FEATURES),
      spatial3d:{...DEFAULT_LAYOUT.spatial3d,wallColor:"black",floorType:"rolled-rubber"},
    },
  };
}
```

Create initial tests that first assert `garageLayout3Items().map(equipmentModelProfile).sort()` equals `GARAGE_LAYOUT3_PROFILES`, then assert the seeded area fields, explicit/global policy matrix, four wall rotations, rejection of an interior rectangle, rejection of a left-extension missing span, and six grid lines representing four rows/four bays. Load the new fixture and test after `app.js` in the logic runner but do not create or load `garage-doors.js` yet.

- [ ] **Step 2: Run the logic runner and capture the domain RED**

Run: `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-domain-red=1`

Expected: existing tests remain green; new tests fail with `GymGarageDoors is not defined`.

- [ ] **Step 3: Implement normalization and per-area policy**

Create `garage-doors.js` as an IIFE. Use these exact defaults and precedence rules:

```js
(function(){
  "use strict";
  const REVISION=1;
  const STYLE="raised-panel";
  const COLOR="#191b1d";
  const SEEDED_AREA=Object.freeze({
    id:"area_l3_bottom_garage_v1",kind:"garagedoor",label:"16 ft raised-panel garage door",
    xFt:1,xIn:11,yFt:18,yIn:6,widthFt:16,widthIn:0,heightFt:1,heightIn:0,
    garageDoorHeightFt:7,garageDoorHeightIn:0,garageDoorStyle:STYLE,garageDoorColor:COLOR,
    blocksPlacement:false,subtractsSpace:false,
  });
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const total=(record,key)=>number(record?.[`${key}Ft`])+number(record?.[`${key}In`])/12;
  const canonicalColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():COLOR;
  const explicitPolicy=(area,key,enabledKinds)=>typeof area?.[key]==="boolean"?area[key]:enabledKinds.has(area?.kind);

  function seededLayout3Area(){ return {...SEEDED_AREA}; }
  function blocksPlacement(area,enabledKinds){ return explicitPolicy(area,"blocksPlacement",enabledKinds); }
  function subtractsSpace(area,enabledKinds){ return explicitPolicy(area,"subtractsSpace",enabledKinds); }

  function normalizeArea(source,normalized){
    if(normalized.kind!=="garagedoor") return normalized;
    const rawHeight=Math.max(6,Math.min(12,total(source,"garageDoorHeight")||7));
    const whole=Math.floor(rawHeight+1e-9);
    const inches=Math.round((rawHeight-whole)*12);
    return {
      ...normalized,
      garageDoorHeightFt:whole+(inches===12?1:0),
      garageDoorHeightIn:inches===12?0:inches,
      garageDoorStyle:source?.garageDoorStyle===STYLE?STYLE:STYLE,
      garageDoorColor:canonicalColor(source?.garageDoorColor),
      ...(typeof source?.blocksPlacement==="boolean"?{blocksPlacement:source.blocksPlacement}:{}),
      ...(typeof source?.subtractsSpace==="boolean"?{subtractsSpace:source.subtractsSpace}:{}),
    };
  }
```

Do not coerce absent `blocksPlacement` or `subtractsSpace` to `false`; absence must continue to use global settings.

Insert `garage-doors.js` in `tests/planner-logic-runner.html` after `wall-features.js` and before `app.js` as part of this GREEN implementation. The RED runner intentionally omits the nonexistent production script; the GREEN runner exercises the real final dependency order.

- [ ] **Step 4: Implement union-boundary resolution and Plan grid geometry**

In the same module, implement `boundarySegments(rects)` by collecting every rectangle edge coordinate, sampling both sides of each interval with epsilon `0.002`, and returning only intervals where inside/outside differs. Each returned segment must include:

```js
{axis:"x"|"z",fixed,start,end,mid,length,inwardX,inwardZ,wall,rotationY}
```

Use rotations `{top:0,bottom:Math.PI,left:Math.PI/2,right:-Math.PI/2}` so local `+Z` always points into the room. `resolveOpening(rect,segments,{areaId,label,tolerance=.03})` must:

1. Compare all four rectangle edges to segments of the matching axis.
2. Require one boundary candidate to cover the complete opening run, merging adjacent collinear intervals before the coverage check.
3. Return `{ok:false,code:"off-boundary",message}` when no edge touches.
4. Return `{ok:false,code:"missing-boundary-span",message}` when an edge touches but the run crosses a missing union-wall interval.
5. Return `{ok:false,code:"ambiguous-boundary",message}` when multiple complete candidates remain.
6. On success return the segment fields plus `areaId`, `label`, `centerX`, `centerZ`, `widthFt`, `start`, and `end`.

Implement `planPanelLines(rect,resolution)` as three equal section-divider lines plus three equal bay-divider lines. Horizontal openings use section dividers across `rect.y` and bay dividers across `rect.x`; vertical openings transpose those axes. Export all functions through one frozen `window.GymGarageDoors` object.

- [ ] **Step 5: Run the focused domain tests GREEN**

Run: `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-domain-green=1`

Expected: `data-complete="true"`, `data-failures="0"`, and `All tests passed.` with no console warning/error.

- [ ] **Step 6: Run syntax and diff checks**

Run:

```bash
node --check garage-doors.js
node --check tests/garage-door-fixtures.js
node --check tests/garage-door.test.js
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit the domain primitives**

```bash
git add garage-doors.js tests/garage-door-fixtures.js tests/garage-door.test.js tests/planner-logic-runner.html
git commit -m "feat: add garage door domain primitives"
```

---

### Task 2: Layout 3 Migration, Placement Policy, and Persistence

**Files:**
- Modify: `garage-doors.js`
- Modify: `wall-features.js:252-266`
- Modify: `app.js:1215-1501,1582-1613,1696-1713,2552-2624`
- Modify: `events.js:861-931,1086-1125`
- Modify: `tests/garage-door.test.js`
- Modify: `tests/wall-features.test.js:255-282`
- Modify: `tests/wall-features-3d-runner.js:19-27`
- Modify: `tests/equipment-dispatch-3d-runner.js:19-28`

**Interfaces:**
- Consumes: Task 1's normalization, policy, and boundary interfaces.
- Produces: `GymWallFeatures.layout3LegacyStarter(): WallFeature[]`.
- Produces: refreshed `GymWallFeatures.layout3Starter(): WallFeature[]`.
- Produces: `GymGarageDoors.migrateLayout3(layout, context): Layout`.
- Produces: `normalizeLayout(l, settings, {name="",items=[]}={}): Layout`.
- Produces: `normalizeNamedLayout(name, rawLayout, settings, items=[]): Layout`.
- Produces: `normalizeImportedLayoutPayload(data, settings, items, makeId): ImportResult|null`.

- [ ] **Step 1: Add migration, override, import, and export regression tests**

Add tests for the full matrix before editing production:

```js
GymTests.test("migrates the complete legacy Layout 3 once",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const first=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  const second=normalizeNamedLayout(fixture.name,deepCopy(first),fixture.settings,fixture.items);
  GymTests.equal(first.garageWallRevision,1);
  GymTests.equal(first.areas.filter(area=>area.kind==="garagedoor").length,1);
  GymTests.deepEqual(first.wallFeatures.reduce((counts,feature)=>({...counts,[feature.kind]:(counts[feature.kind]||0)+1}),{}),{mirror:2,slat:1,led:4});
  GymTests.equal(first.wallFeatures.some(feature=>feature.wall==="bottom"),false);
  GymTests.deepEqual(second,first);
});

GymTests.test("architectural override beats globally enabled garage blocking",()=>{
  const previous={layout:state.layout,settings:state.settings};
  state.settings={...deepCopy(DEFAULT_SETTINGS),reservedAreaKindsBlockPlacement:["garagedoor"],reservedAreaKindsSubtractSpace:["garagedoor"]};
  state.layout=normalizeLayout({...deepCopy(DEFAULT_LAYOUT),areas:[GymGarageDoors.seededLayout3Area()]},state.settings);
  const overlap={x:7.5,y:18.5,w:2.38,h:1};
  GymTests.equal(isInvalidPlacement("candidate",overlap,overlap),false);
  GymTests.equal(reservedSqFt(),0);
  state.layout=previous.layout; state.settings=previous.settings;
});
```

Also assert: an exact-profile legacy layout with no `wallFeatures` property receives the complete refreshed starter; an explicit pre-refresh array with a missing record keeps that record missing; a customized known record stays byte-equal and reports `door-overlap`; post-revision deletion stays deleted; a matching manual garage ID is reused and receives every canonical field; a distinct manual garage is preserved while the stable seed is added; renamed exact profile signature migrates using the profile signal even when the legacy-feature signal is removed; unrelated name-only Layout 3 does not; Layouts 1/2 remain byte-equal; full and lone-layout import routes agree; duplicating a refreshed layout preserves its revision, garage, and features byte-for-byte; all three export modes emit `version:13` without `aiApiKey`.

Create a preservation variant that adds one unrelated wall feature. Produce its canonical pre-migration baseline by normalizing a clone temporarily stamped with `garageWallRevision:1`, remove only that test stamp from the returned clone, and then call the pure migration with the full matching context. Snapshot all baseline `instances` (including X/Y/orientation), the standard door/no-go areas, outlets, wall extensions, ceiling zones, floor zones, flooring pieces, `spatial3d`, and the unrelated feature. Assert those canonical non-target records are byte-equivalent after the first and second migration.

- [ ] **Step 2: Run the migration suite RED**

Run: `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-migration-red=1`

Expected: focused failures show missing `layout3LegacyStarter`, `migrateLayout3`, per-area policy wiring, import helper, and export version `13`.

- [ ] **Step 3: Publish legacy and refreshed wall-feature starters**

Rename the current array to `LAYOUT3_LEGACY_STARTER`, retain a cloning `layout3LegacyStarter()`, and replace `LAYOUT3_STARTER` with exactly:

```js
const LAYOUT3_STARTER=[
  {id:"wf_l3_primary_mirror",kind:"mirror",label:"Primary training mirror",wall:"left",startFt:0,startIn:0,bottomFt:1,bottomIn:0,widthFt:8,widthIn:9,heightFt:7,heightIn:6,color:"#cbd5e1",brightnessPct:0},
  {id:"wf_l3_aisle_mirror",kind:"mirror",label:"Secondary aisle mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
  {id:"wf_l3_gazelle_slats",kind:"slat",label:"Cold-plunge slat wall",wall:"left",startFt:9,startIn:0,bottomFt:0,bottomIn:0,widthFt:5,widthIn:0,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
  {id:"wf_l3_slat_led_left",kind:"led",label:"Slat frame, upper run edge",wall:"left",startFt:8,startIn:11,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
  {id:"wf_l3_slat_led_right",kind:"led",label:"Slat frame, lower run edge",wall:"left",startFt:14,startIn:1,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
  {id:"wf_l3_mirror_wash",kind:"led",label:"Mirror wash",wall:"left",startFt:0,startIn:0,bottomFt:8,bottomIn:7,widthFt:8,widthIn:9,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
  {id:"wf_l3_cardio_strip",kind:"led",label:"Cardio ambient strip",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
];
```

Export both fresh-copy functions from `GymWallFeatures`.

- [ ] **Step 4: Implement signature-gated idempotent migration**

Add `migrateLayout3(layout,context)` to `garage-doors.js`. The context is:

```js
{
  name,
  room:{W,L,rects},
  profileKeys,
  hadWallFeatures,
  legacyFeatures,
  starterFeatures,
}
```

Use a `1/12 ft` room tolerance and require the `19 ft 10 in × 19 ft 6 in` room plus one of these signals: the exact 11-profile set; all seven legacy material signatures; or normalized name `layout 3` with at least five known IDs. A feature is an untouched legacy record only when kind, wall, start, bottom, width, height, color, and brightness match; ignore label so a renamed feature can still move. When the source has no `wallFeatures` property at all, treat it as the pre-wall-feature schema and install the complete refreshed starter after the signature gate passes. When the source contains an explicit wall-feature array, migrate only matching records, preserve customized records, never recreate a missing record, and preserve unrelated features.

Use `boundarySegments(context.room.rects)` plus `resolveOpening()` for manual-door matching; do not infer the touched wall from aspect ratio. Reuse an existing resolved bottom garage when its center and width are within `1 in` of the target. Construct the reused target as `{...existing,...seededLayout3Area(),id:existing.id}`: preserve its ID and unrelated extension fields while canonicalizing label, X/Y/depth/run, 7-foot height, style, color, and both explicit `false` policy overrides. Otherwise append `seededLayout3Area()`. Stamp `garageWallRevision:1` on the returned clone. Return immediately when revision is already `1`.

- [ ] **Step 5: Wire garage metadata and migration into layout normalization**

In `normalizeLayout`, preserve the source `hadWallFeatures` flag, pass each normalized area through `GymGarageDoors.normalizeArea(a,o)`, and normalize `garageWallRevision` to a nonnegative integer. Extend the signature to accept `{name="",items=[]}`.

Build `profileKeys` with an item map and the existing profile inference:

```js
const byId=new Map((items||[]).map(item=>[item.id,item]));
const profileKeys=[...new Set(base.instances.map(inst=>byId.get(inst.itemId)).filter(Boolean).map(equipmentModelProfile))].sort();
```

After wall features are normalized, call `GymGarageDoors.migrateLayout3` with the already-computed `wallFeatureRoom` (including its union rectangles) plus legacy and refreshed starter copies. Update `normalizeNamedLayout` to delegate to this one path. Pass `state.items` in startup library normalization and when re-normalizing imported layouts.

Load `garage-doors.js` before `app.js` in both existing real-Three runner scripts now, using a task-local cache key. Those runners construct `Gym3DView` from normalized layouts and must not wait until the final cache task to receive the new required app dependency.

- [ ] **Step 6: Apply per-area policy in every accounting and collision path**

Replace direct kind-set checks with:

```js
function areaSubtractsSpace(area,settings=state.settings){
  const enabled=new Set(Array.isArray(settings.reservedAreaKindsSubtractSpace)?settings.reservedAreaKindsSubtractSpace:["walkway","door","garagedoor","nogospace","cutout"]);
  return GymGarageDoors.subtractsSpace(area,enabled);
}
function areaBlocksPlacement(area,settings=state.settings){
  const enabled=new Set(Array.isArray(settings.reservedAreaKindsBlockPlacement)?settings.reservedAreaKindsBlockPlacement:["walkway","door","garagedoor","nogospace","cutout"]);
  return GymGarageDoors.blocksPlacement(area,enabled);
}
```

Use `areaSubtractsSpace()` in `reservedSqFt()` and `areaBlocksPlacement()` in both `isInvalidPlacement()` and `hardPlacementConflict()`. Keep door swing-clearance checks unchanged. The existing settings actions already recompute `__invalid` through `isInvalidPlacement`, so the override automatically survives “Block all.”

- [ ] **Step 7: Unify full and legacy JSON import and advance export v13**

Create this pure helper in `events.js` and call it after imported settings/items are normalized:

```js
function normalizeImportedLayoutPayload(data,settings,items,makeId=()=>uid("ly")){
  if(Array.isArray(data.layouts)&&data.layouts.length){
    const layouts=data.layouts.map(entry=>({
      id:entry.id||makeId(),
      name:entry.name||"Layout",
      layout:normalizeNamedLayout(entry.name,entry.layout||entry.data||entry,settings,items),
    }));
    const activeLayoutId=data.activeLayoutId&&layouts.some(entry=>entry.id===data.activeLayoutId)?data.activeLayoutId:layouts[0].id;
    return {layouts,activeLayoutId,layout:layouts.find(entry=>entry.id===activeLayoutId).layout};
  }
  if(!data.layout) return null;
  const name=data.layoutName||data.name||"Layout 1";
  const id=makeId();
  const layout=normalizeNamedLayout(name,data.layout,settings,items);
  return {layouts:[{id,name,layout}],activeLayoutId:id,layout};
}
```

Replace the two JSON-import branches with the helper result. Change all three export payload version literals from `12` to `13`; leave `settingsForExport()` key deletion intact.

- [ ] **Step 8: Run migration/persistence tests GREEN**

Run: `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-migration-green=1`

Expected: zero failures and no console warning/error.

Also run the wall-feature and equipment real-Three runners once with fresh task-local query keys. They must still complete with zero failures after the app-level normalization dependency changes.

- [ ] **Step 9: Run syntax, complete logic regression, and diff checks**

```bash
node --check garage-doors.js
node --check wall-features.js
node --check app.js
node --check events.js
node --check tests/garage-door.test.js
git diff --check
```

Expected: all exit `0`; the full logic runner remains green.

- [ ] **Step 10: Commit migration and persistence**

```bash
git add garage-doors.js wall-features.js app.js events.js tests/garage-door.test.js tests/wall-features.test.js tests/wall-features-3d-runner.js tests/equipment-dispatch-3d-runner.js
git commit -m "feat: migrate Layout 3 to the garage wall"
```

---

### Task 3: Architectural Plan Symbol and Keyboard Access

**Files:**
- Modify: `layout.js:36-76,386-400,1437-1512`
- Modify: `events.js:3368-3394`
- Modify: `index.html:602-630,821-846`
- Modify: `tests/garage-door.test.js`

**Interfaces:**
- Consumes: `GymGarageDoors.resolveOpening()` and `planPanelLines()` from Task 1.
- Produces: `garageDoorAreaSvg(area, roomData, selected=false): string`.
- Produces: `selectPlanAreaFromKeyboard(event): boolean`.

- [ ] **Step 1: Add failing Plan markup, inspector, and keyboard tests**

Test a normalized seeded garage against the exact Layout 3 room. Assert the returned SVG includes:

```js
const svg=garageDoorAreaSvg(area,room(),true);
GymTests.equal((svg.match(/class="garagePanelFace"/g)||[]).length,16);
GymTests.equal((svg.match(/class="garageSectionLine"/g)||[]).length,3);
GymTests.equal((svg.match(/class="garageBayLine"/g)||[]).length,3);
GymTests.assert(svg.includes('class="garageOpeningLine"'));
GymTests.assert(svg.includes('role="button"'));
GymTests.assert(svg.includes('tabindex="0"'));
GymTests.assert(svg.includes('aria-label="Garage door'));
GymTests.assert(svg.includes('aria-pressed="true"'));
GymTests.assert(!svg.includes("doorArc"));
```

Also assert the unselected state, vertical-wall transposition, off-wall selectable footprint without an opening line, 16 panel cells, inspector architectural-only copy, absence of `area_doorSwing`/`area_doorHinge`/`area_doorRadius`, and Enter/Space selection that clears competing selections. For `off-boundary` and `missing-boundary-span` fixtures, assert an invalid SVG class, accessible warning text, and the same clear warning in the selected-area inspector.

- [ ] **Step 2: Run the Plan tests RED**

Run: `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-plan-red=1`

Expected: failures name missing `garageDoorAreaSvg` and `selectPlanAreaFromKeyboard`.

- [ ] **Step 3: Render the garage footprint, boundary, sections, and 16 bays**

Add `garageDoorAreaSvg`. Resolve the opening from `GymGarageDoors.boundarySegments(roomData.rects)` and `areaRect(area)`. Draw the existing amber area footprint first. For a resolved horizontal opening, render four-by-four cells using `x + column*w/4` and `y + row*h/4`; transpose row/bay math for a vertical opening. Render the heavy line at `resolution.fixed`, not at an aspect-ratio guess.

The group wrapper must be generated with the existing escaping helper, equivalent to:

```html
<g data-type="area" data-id="${escapeHtml(area.id)}" class="garageDoorArea garageDoorArchitectural garageDoorSelected" role="button" tabindex="0" aria-label="Garage door, 16 ft wide, architectural only" aria-pressed="true">
```

Keep the label and existing resize handles inside the same group. In `areasSvg`, dispatch `garagedoor` to this helper and retain the existing path for all other area kinds.

- [ ] **Step 4: Add visual and inspector affordances**

Add CSS for `.garageDoorArea:focus-visible`, `.garageDoorSelected`, `.garageDoorInvalid`, `.garageOpeningLine`, `.garageSectionLine`, `.garageBayLine`, and `.garagePanelFace`. Use the existing amber family but keep the opening line opaque enough against black and white themes. An unresolved garage remains selectable, receives `aria-invalid="true"`, and exposes the resolver message through its accessible label/title instead of drawing a floating architectural opening.

In `selectedAreaPanel`, show this copy for a garage area with both explicit policy flags set to `false` (including a matching manually created area reused by migration):

> Architectural door only. It does not reserve operating clearance, so the existing machines against this wall remain valid. Add a No-go area if you want to keep the door path clear.

Do not show standard hinge, swing, or radius controls for `garagedoor`.

Replace the panel's unconditional “counts as reserved” sentence with a summary derived from `areaSubtractsSpace(area)` and `areaBlocksPlacement(area)`. The seeded/reused architectural garage must say that its 16-square-foot editor footprint is not subtracted and does not block equipment; ordinary areas continue to describe their effective global policy. Render the `off-boundary` or `missing-boundary-span` resolver message in the inspector whenever the selected garage is not attached to a complete physical wall run.

- [ ] **Step 5: Add Enter/Space area selection**

Implement:

```js
function selectPlanAreaFromKeyboard(event){
  if(event.key!=="Enter"&&event.key!==" ") return false;
  const group=event.target?.closest?.('g[data-type="area"][role="button"]');
  if(!group) return false;
  const area=(state.layout.areas||[]).find(entry=>entry.id===group.dataset.id);
  if(!area) return false;
  event.preventDefault();
  event.stopPropagation();
  clearAllSelections();
  state.layout.selectedAreaId=area.id;
  render();
  return true;
}
```

Call it before the existing instance/wall-feature branches in `svg.onkeydown`.

- [ ] **Step 6: Run Plan and logic regression tests GREEN**

Run: `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-plan-green=1`

Expected: all tests pass, including the existing rotation and wall-feature keyboard tests.

- [ ] **Step 7: Run syntax and diff checks**

```bash
node --check layout.js
node --check events.js
node --check tests/garage-door.test.js
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 8: Commit the Plan experience**

```bash
git add layout.js events.js index.html tests/garage-door.test.js
git commit -m "feat: draw the garage door in Plan view"
```

---

### Task 4: Raised-Panel Three.js Builder

**Files:**
- Create: `garage-door-3d.js`
- Create: `tests/garage-door-3d-runner.html`
- Create: `tests/garage-door-3d-runner.js`
- Create: `tests/garage-door-3d.test.js`

**Interfaces:**
- Consumes: global `THREE` and Task 1's resolved opening shape.
- Produces: `GymGarageDoor3D.prepareResources(view, color): GarageResources`.
- Produces: `GymGarageDoor3D.buildRaisedPanel(view, group, spec): BuildResult`.
- Produces: `GymGarageDoor3D.buildFallback(view, group, spec): BuildResult`.
- Every created mesh receives `userData.garagePart`.

- [ ] **Step 1: Create the real-Three runner and failing builder contract tests**

Follow the existing vendored-Three setup, stub animation frames, and load in this order:

```js
for(const src of [
  "./test-harness.js?v=garage-1",
  "../wall-features.js?v=garage-1",
  "../garage-doors.js?v=garage-1",
  "../app.js?v=garage-1",
  "../view3d.js?v=garage-1",
  "./garage-door-fixtures.js?v=garage-1",
  "./garage-door-3d.test.js?v=garage-1",
]) await loadClassicScript(src);
```

The RED runner intentionally omits the nonexistent `garage-door-3d.js`; the first tests assert the global/builder contract and fail without preventing the rest of the harness from finishing. The first GREEN tests call `prepareResources` and pass the result to the builder using a real `Gym3DView` fixture, then assert `sectionCount:4`, `panelCount:16`, named hardware tags, width `16`, height `7`, thickness `2/12`, material color `0x191b1d`, at most eight garage materials, and at most eight garage shadow casters. Tag the slab/section/panel/recess meshes with `garageSurface:true`, compute their complete local bounding envelope, and assert its maximum interior-facing local Z is at most `0.02 ft`.

- [ ] **Step 2: Run the builder RED**

Run: `http://127.0.0.1:4173/tests/garage-door-3d-runner.html?garage-builder-red=1`

Expected: runner loads, then fails because `GymGarageDoor3D`/`buildRaisedPanel` is absent.

- [ ] **Step 3: Implement the shared material and tagging helpers**

Create an IIFE with `prepareResources(view,color)`. Insert `../garage-door-3d.js?v=garage-1` after `app.js` and before `view3d.js` in the GREEN runner as part of this step. The resource helper is equivalent to:

```js
(function(){
  "use strict";
  function tag(mesh,part,castShadow=false){
    mesh.userData.garagePart=part;
    mesh.castShadow=castShadow;
    return mesh;
  }
  function prepareResources(view,color){
    const key=String(color||"#191b1d").toLowerCase();
    view.garageMaterialCache=view.garageMaterialCache||new Map();
    if(view.garageMaterialCache.has(key)) return view.garageMaterialCache.get(key);
    const value={
      slab:view.material({color:new THREE.Color(key),roughness:.68,metalness:.24,envMapIntensity:.62}),
      bevel:view.material({color:0x2b2f34,roughness:.58,metalness:.3,envMapIntensity:.72}),
      recess:view.material({color:0x0c0e10,roughness:.82,metalness:.12,envMapIntensity:.38}),
      track:view.material({color:0x3d444b,roughness:.34,metalness:.82,envMapIntensity:1.05}),
      rubber:view.material({color:0x050607,roughness:.94,metalness:0,envMapIntensity:.12}),
      hardware:view.material({color:0xaab2b9,roughness:.24,metalness:.9,envMapIntensity:1.2}),
    };
    view.garageMaterialCache.set(key,value);
    return value;
  }
```

All small panels/hardware use `castShadow:false`; only the slab, jamb/header assembly, and opener motor may cast. Resource preparation happens before a staged detail-build snapshot. Shared cached materials must never be disposed during a single-door rollback; they remain in `view.disposables` for normal view destruction.

- [ ] **Step 4: Build the exact raised-panel assembly**

`buildRaisedPanel(view,group,spec)` consumes:

```js
{areaId,widthFt,heightFt,ceilingFt,floorFt,trackDepthFt,color,boundary,wallMaterial,preview,resources}
```

Use local X along the opening, local Y upward, and local +Z into the room. Put the 2-inch slab center far enough toward local `-Z` that its interior face protrudes no more than `0.02 ft` into the room. Add:

- one tagged `slab`;
- three tagged `section-seam` bars;
- 16 tagged `raised-panel` outer boxes and 16 tagged `panel-recess` centers in nested row/column loops;
- two `jamb`, one `head-frame`, one `bottom-seal`, one `threshold`, and one `handle`;
- nine low-profile `section-hinge` plates (three at each section seam) plus eight restrained side `roller-bracket`/`roller` assemblies;
- two `vertical-track`, two three-segment `curved-track`, and two `ceiling-track` runs;
- one `torsion-bar`, two `torsion-spring`, one `opener-rail`, one `opener-motor`, and one `opener-arm`;
- one `header-infill` using `Math.max(0,ceilingFt-floorFt-heightFt)`, positioned above the local door top, whenever positive, including Preview. Because the exact Layout 3 opening is on the base slab, this produces the required 2-foot header; a future opening on a raised floor still remains below the physical ceiling.

Return:

```js
{modelType:"traditional raised-panel garage door",sectionCount:4,panelCount:16,trackPairs:1,meshCount,shadowCasterCount,interiorInsetFt}
```

`interiorInsetFt` is the maximum interior-facing local Z across every `garageSurface` mesh—not merely the slab face. Recess the base slab enough that the full sectional relief stays within `0.02 ft` of the room boundary. Hinges, rollers, tracks, and opener hardware are intentionally interior operating parts, remain low-profile/bounded, and are separately checked during visible QA for no obvious overlap with the wall-adjacent machines.

- [ ] **Step 5: Implement a deterministic simple fallback**

`buildFallback` creates one tagged `fallback-slab`, two jambs, one head, one seal, and header infill. It returns `modelType:"simple closed garage fallback"`, `fallback:true`, and geometry counts. It must not create a collider or omit the closed panel.

- [ ] **Step 6: Run builder tests GREEN**

Run: `http://127.0.0.1:4173/tests/garage-door-3d-runner.html?garage-builder-green=1`

Expected: zero failures; all semantic part tags and bounded resource assertions pass.

- [ ] **Step 7: Run syntax and diff checks**

```bash
node --check garage-door-3d.js
node --check tests/garage-door-3d-runner.js
node --check tests/garage-door-3d.test.js
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 8: Commit the 3D builder**

```bash
git add garage-door-3d.js tests/garage-door-3d-runner.html tests/garage-door-3d-runner.js tests/garage-door-3d.test.js
git commit -m "feat: build the raised-panel garage door"
```

---

### Task 5: 3D Room, Fallback, Framing, and Minimap Integration

**Files:**
- Modify: `view3d.js:110-231,525-584,650-882,2270-2300,2364-2412,2620-2642,2718-2760`
- Modify: `tests/garage-door-3d.test.js`
- Modify: `tests/wall-features-3d-runner.js:19-27`
- Modify: `tests/equipment-dispatch-3d-runner.js:19-28`

**Interfaces:**
- Consumes: `GymGarageDoors.boundarySegments/resolveOpening` and `GymGarageDoor3D.buildRaisedPanel/buildFallback`.
- Produces: `Gym3DView.resolveGarageDoorAreas()`.
- Produces: `Gym3DView.garageDoorTrackDepth(resolution, maxFt=8)`.
- Produces: `Gym3DView.disposeGarageDoorStage(root, disposablesStart, protectedResources)`.
- Produces: `Gym3DView.buildGarageDoors()`.
- Produces: `Gym3DView.garageDoorMinimapLine(group, selectedId)`.
- Publishes: `data-standard-door-openings`, `data-garage-door-openings`, `data-standard-door-models`, `data-garage-door-models`, `data-door-models`, `data-invalid-garage-doors`, `data-garage-door-fallbacks`, `data-garage-door-panels`, `data-garage-door-track-pairs`, and unchanged `data-door-openings`/`data-door-colliders` semantics.

- [ ] **Step 1: Add failing renderer integration tests**

Extend the real-Three tests with the exact Layout 3 area and assert:

```js
GymTests.deepEqual({
  standardOpenings:host.dataset.standardDoorOpenings,
  garageOpenings:host.dataset.garageDoorOpenings,
  standard:host.dataset.standardDoorModels,
  garage:host.dataset.garageDoorModels,
  total:host.dataset.doorModels,
  invalid:host.dataset.invalidGarageDoors,
  fallback:host.dataset.garageDoorFallbacks,
  panels:host.dataset.garageDoorPanels,
  tracks:host.dataset.garageDoorTrackPairs,
  colliders:host.dataset.doorColliders,
},{standardOpenings:"0",garageOpenings:"1",standard:"0",garage:"1",total:"1",invalid:"0",fallback:"0",panels:"16",tracks:"1",colliders:"0"});
```

Assert group center `x=9+11/12`, `z=19.5`, rotation `Math.PI`, explicit stored `rotationY`, resolved boundary, world-space focus metadata, 1 ft 11 in returns, 2-foot header, Plan-selected framing, minimap line, and no garage entry in `doorCollisionSegments`. Add top/right/bottom/left transform fixtures that assert both world-space focus and interior framing, an off-wall fixture, a left-extension missing-span fixture, a standard hinged-door regression, and a forced builder throw. Add a two-garage same-color fixture where the first door succeeds and the second throws only after creating geometry; assert the first door and shared materials remain live while the second uses the fallback.

- [ ] **Step 2: Run renderer integration RED**

Run: `http://127.0.0.1:4173/tests/garage-door-3d-runner.html?garage-integration-red=1`

Expected: builder-only tests pass; integration tests fail on missing garage datasets/groups/minimap/fallback orchestration.

- [ ] **Step 3: Resolve garages before wall construction and cut only valid openings**

In the constructor, initialize:

```js
this.rawBoundarySegments=GymGarageDoors.boundarySegments(this.roomData.rects);
this.garageDoorGroups=new Map();
this.garageDoorWarnings=[];
this.garageDoorMinimapSegments=[];
this.resolvedGarageDoors=this.resolveGarageDoorAreas();
```

`resolveGarageDoorAreas()` maps every `garagedoor` area through `areaRect()` and `resolveOpening()`. `roomBoundarySegments()` starts from `rawBoundarySegments`, retains current standard-door subtraction, and subtracts a garage run only when its cached resolution has `ok:true`. Invalid garages leave the wall intact.

`garageDoorTrackDepth()` walks from the opening center along the resolved inward normal, stops before leaving the union room, and returns the smaller of that available run and `8 ft` with a `0.25 ft` wall margin. The exact Layout 3 bottom door therefore receives an interior overhead-track run without assuming a bottom-wall orientation.

- [ ] **Step 4: Build detailed doors with staged rollback and closed fallback**

Call `buildGarageDoors()` after `buildDoors()` and before wall features. For each valid resolution:

1. Create an assembly at `(centerX, floorFt, centerZ)` with `rotation.y=resolution.rotationY`.
2. Compute `floorFt` by sampling just inside the opening and call `GymGarageDoor3D.prepareResources(this,color)` before the stage snapshot.
3. Snapshot `this.disposables.length` and stage detail in a child group.
4. Call `GymGarageDoor3D.buildRaisedPanel` with those protected resources and the resolved track depth.
5. On throw, call a garage-specific `disposeGarageDoorStage(staged,start,protectedResources)`, record one deduplicated warning, and call `buildFallback` in a fresh staged group with the same live protected resources. The rollback disposes only stage-created geometries/resources and removes the staged root; it must not traverse-dispose cached materials, the shared room-wall material, or resources already used by another door.
6. Add the assembly to `scene`, `areaGroups`, and `garageDoorGroups`.
7. Store `boundaryMounted:true`, `boundaryWall`, `garageBoundary:resolution`, `rotationY:resolution.rotationY`, `focusPoint` transformed into world coordinates just inside local +Z, `worldFootprint:{widthFt,depthFt:2/12,heightFt}`, `openingWidthFt`, `doorHeightFt`, `floorElevationFt`, `fallback`, and builder result counts.

Do not push a garage segment into `doorCollisionSegments`.

- [ ] **Step 5: Publish coherent standard/garage diagnostics and warnings**

Refactor `buildDoors()` so its early return still sets `standardDoorModels="0"` without finalizing total counts. Add `publishDoorDiagnostics()` after both builders:

```js
this.host.dataset.doorModels=String(this.standardDoorModelCount+this.garageDoorModelCount);
this.host.dataset.standardDoorModels=String(this.standardDoorModelCount);
this.host.dataset.garageDoorModels=String(this.garageDoorModelCount);
this.host.dataset.doorColliders=String(this.doorCollisionSegments.length);
```

Publish invalid/fallback/panel/track counts. Prepend each deduplicated garage warning once in `updateWarnings()` while keeping equipment, local-model, wall-feature, and Stair ceiling warnings.

Keep the existing `data-door-openings` count compatible with all standard and garage area records. Publish `data-standard-door-openings` from standard area records and `data-garage-door-openings` from successfully resolved physical garage openings; invalid garage records are reported separately and never cut the wall.

- [ ] **Step 6: Frame boundary-mounted areas from the interior**

In `frameSelected`, add a `boundaryMounted` branch before the generic area path. Compute the preferred viewing theta from local +Z rotated by `group.userData.rotationY`, set the target to `focusPoint`, and try the ideal radius followed by shorter radii through the existing `frameCandidateBlocked` room/equipment safety check. If no safe interior candidate exists, leave the current camera unchanged. A bottom door must frame from inside the room rather than through the exterior wall or through adjacent equipment.

- [ ] **Step 7: Draw a separate garage minimap segment**

Implement `garageDoorMinimapLine(group,selectedId)` from `group.userData.garageBoundary`. It returns the boundary endpoints, color `#f59e0b`, and line width `4` selected/`3` unselected. Draw these lines before green standard hinged-leaf collision lines. Keep `isWalkPointClear()` unchanged: the room union prevents exterior travel and garage doors create no swing collider.

- [ ] **Step 8: Run all real-Three tests GREEN**

Run:

- `http://127.0.0.1:4173/tests/garage-door-3d-runner.html?garage-integration-green=1`
- `http://127.0.0.1:4173/tests/wall-features-3d-runner.html?garage-regression=1`
- `http://127.0.0.1:4173/tests/equipment-dispatch-3d-runner.html?garage-regression=1`

Expected: all runners complete with zero failures and no console warning/error. Forced garage detail failure yields one fallback and restores the next fixture to zero failures.

Before these runs, load both `garage-doors.js` and `garage-door-3d.js` in the wall-feature and equipment real-Three runner scripts before `view3d.js`, using task-local cache keys. This keeps the existing fixtures executable after the renderer begins resolving garage modules unconditionally.

- [ ] **Step 9: Verify resource cleanup and bounded rendering**

In the 3D test, create/destroy the fixture twice. Assert at most eight unique garage materials, at most eight garage shadow casters, stable mesh counts between runs, and that forced-failure stage geometries are disposed and removed from `disposables` while the protected shared materials remain undisposed and render the fallback. Assert normal destroy disposes those materials once, removes the canvas, and balances the existing registered event listeners.

- [ ] **Step 10: Run syntax and diff checks**

```bash
node --check view3d.js
node --check tests/garage-door-3d.test.js
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 11: Commit 3D integration**

```bash
git add view3d.js tests/garage-door-3d.test.js tests/wall-features-3d-runner.js tests/equipment-dispatch-3d-runner.js
git commit -m "feat: integrate garage doors into 3D views"
```

---

### Task 6: Runtime Cache Contract, Visible QA, and Handoff Evidence

**Files:**
- Modify: `gltf-runtime.js:21-31`
- Modify: `index.html:3047`
- Modify: `tests/planner-logic-runner.html`
- Modify: `tests/wall-features-3d-runner.js:19-27`
- Modify: `tests/equipment-dispatch-3d-runner.js:19-28`
- Modify: `tests/garage-door-3d-runner.js`
- Modify: `tests/runtime-cache.test.js:1-55`
- Modify: `tests/runtime-cache-runner.html`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: all production/test files from Tasks 1-5.
- Produces: one atomic runtime dependency chain and final browser evidence.

- [ ] **Step 1: Advance cache expectations before production URLs**

Change the cache test to expect this exact 11-script order:

```js
[
  "model-assets.js?v=4",
  "wall-features.js?v=3",
  "garage-doors.js?v=1",
  "app.js?v=84",
  "equipment-models.js?v=2",
  "garage-door-3d.js?v=1",
  "view3d.js?v=38",
  "panels.js?v=73",
  "layout.js?v=86",
  "events.js?v=82",
  "render.js?v=70",
]
```

Expect `gltf-runtime.js?v=34`. Update the iframe readiness count to `11`, the logic-runner production list to include `wall-features.js?v=3` and `garage-doors.js?v=1`, and bump `runtime-cache.test.js` to `v=11`.

- [ ] **Step 2: Run the intentional cache RED**

Run: `http://127.0.0.1:4173/tests/runtime-cache-runner.html?garage-cache-red=1`

Expected: failures report runtime `v33` vs `v34`, absent garage modules, and the old wall/app/view/layout/events versions.

- [ ] **Step 3: Apply the production runtime URLs atomically**

Update `gltf-runtime.js` to the exact order above and `index.html` to `gltf-runtime.js?v=34`. Synchronize all browser runners:

- logic runner loads `wall-features.js?v=3`, `garage-doors.js?v=1`, `app.js?v=84`, `layout.js?v=86`, `events.js?v=82`;
- wall/equipment/garage real-Three runners load both garage modules and `view3d.js?v=38`;
- focused test files use fresh `v=1` keys.

- [ ] **Step 4: Run the cache and complete automated gates GREEN**

Run fresh URLs:

- `http://127.0.0.1:4173/tests/runtime-cache-runner.html?garage-cache-green=1`
- `http://127.0.0.1:4173/tests/planner-logic-runner.html?garage-final=1`
- `http://127.0.0.1:4173/tests/garage-door-3d-runner.html?garage-final=1`
- `http://127.0.0.1:4173/tests/wall-features-3d-runner.html?garage-final=1`
- `http://127.0.0.1:4173/tests/equipment-dispatch-3d-runner.html?garage-final=1`

Expected: every runner reports complete/zero failures/`All tests passed.`; normal runner consoles contain no warning/error.

- [ ] **Step 5: Run all syntax and repository checks**

```bash
node --check garage-doors.js
node --check garage-door-3d.js
node --check wall-features.js
node --check app.js
node --check layout.js
node --check events.js
node --check view3d.js
node --check tests/garage-door-fixtures.js
node --check tests/garage-door.test.js
node --check tests/garage-door-3d-runner.js
node --check tests/garage-door-3d.test.js
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 6: Perform isolated visible migration and Plan QA**

Serve the worktree on isolated port `4174`, use a fresh storage origin, and import `/Users/tony/Downloads/gym-planner-export-all-layouts-2026-08-11.json` without printing its settings. Verify:

- Layout 3 automatically contains one centered 16-foot garage, no bottom-wall features, two mirrors, one slat panel, and four LEDs;
- Layouts 1 and 2 remain unchanged;
- all 11 equipment positions/orientations match the pre-import values;
- Gazelle and Combo Adductor/Abductor remain valid even after “Block all” and “Subtract all” settings actions;
- Plan shows 16 raised-panel bays, no swing arc, keyboard selection, exact inspector measurements, and architectural-only explanation;
- deleting a relocated feature and reloading does not restore it;
- duplicate layout copies the exact refreshed shell;
- version-13 export/re-import preserves the refresh and excludes `aiApiKey`.

- [ ] **Step 7: Perform Split, 3D, Walkthrough, and minimap QA**

Verify in Split, 3D, and Walkthrough:

- one matte-black traditional raised-panel door with four sections, 16 panels, jambs, seal, handle, vertical/curved/overhead tracks, torsion hardware, opener rail, motor, and 2-foot header;
- both 1 ft 11 in wall returns remain visible;
- the panel interior face does not visibly clip the two machines against the wall;
- “Frame selected” views the door from inside;
- the left mirror covers the Stair/dumbbell run and remains level across the raised-platform transition;
- slats and frame LEDs cover the Ice Barrel run and stop before the 14 ft 3 in missing wall;
- right mirror, top cardio LED, black walls, rolled rubber, all 11 dedicated models, and the existing Stair ceiling warning remain;
- minimap shows a thick amber garage segment and the standard entry door retains its green hinged leaf.

- [ ] **Step 8: Run the minimum 60-second stress pass**

Orbit/zoom continuously in Preview for at least 30 seconds, then move/look continuously in Walkthrough for at least 30 seconds. Record before/after garage group count, canvas count, renderer mesh/material/texture counts, warnings, and console logs. Pass only if counts remain bounded, no warning repeats accumulate, movement stays responsive, and there are no relevant console errors.

- [ ] **Step 9: Append exact evidence to `design-qa.md`**

Add a dated “Layout 3 garage-door and left-wall refresh verification” section recording the automated runner results, exact feature/door counts, equipment preservation, blocking override, Plan/3D/Walkthrough/minimap observations, stress duration, known Stair warning, and console result. End it with:

```text
final garage-door wall refresh result: passed
```

- [ ] **Step 10: Commit the cache and final evidence**

```bash
git add gltf-runtime.js index.html tests/planner-logic-runner.html tests/wall-features-3d-runner.js tests/equipment-dispatch-3d-runner.js tests/garage-door-3d-runner.js tests/runtime-cache.test.js tests/runtime-cache-runner.html design-qa.md
git commit -m "test: verify the garage door wall refresh"
```

- [ ] **Step 11: Request final code review and fix every Critical/Important finding**

Use `superpowers:requesting-code-review` against the complete branch diff from `origin/main`. If review finds an issue, add a focused failing regression first, make the smallest fix, rerun every affected runner and cache contract, document the fix, and commit it separately. The branch is complete only after re-review has no Critical or Important finding.
