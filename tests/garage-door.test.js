const GARAGE_ROOM_RECTS=[
  {x:0,y:0,w:19+10/12,h:19.5},
  {x:-1.75,y:14.25,w:1.75,h:5.25},
];

GymTests.test("maps the Layout 3 equipment to the required dedicated profiles",()=>{
  GymTests.deepEqual(garageLayout3Items().map(equipmentModelProfile).sort(),GARAGE_LAYOUT3_PROFILES);
});

GymTests.test("seeds the canonical non-blocking raised-panel garage door",()=>{
  const area=GymGarageDoors.seededLayout3Area();
  GymTests.deepEqual(area,{
    id:"area_l3_bottom_garage_v1",kind:"garagedoor",label:"16 ft raised-panel garage door",
    xFt:1,xIn:11,yFt:18,yIn:6,widthFt:16,widthIn:0,heightFt:1,heightIn:0,
    garageDoorHeightFt:7,garageDoorHeightIn:0,garageDoorStyle:"raised-panel",garageDoorColor:"#191b1d",
    blocksPlacement:false,subtractsSpace:false,
  });
  GymTests.assert(area!==GymGarageDoors.seededLayout3Area(),"Expected a fresh seeded area object");
});

GymTests.test("honors explicit area policy before the enabled-kind fallback",()=>{
  const enabled=new Set(["door","garagedoor"]);
  const cases=[
    [{kind:"door"},true,true],
    [{kind:"nogospace"},false,false],
    [{kind:"door",blocksPlacement:false,subtractsSpace:false},false,false],
    [{kind:"nogospace",blocksPlacement:true,subtractsSpace:true},true,true],
  ];
  cases.forEach(([area,blocks,subtracts])=>{
    GymTests.equal(GymGarageDoors.blocksPlacement(area,enabled),blocks);
    GymTests.equal(GymGarageDoors.subtractsSpace(area,enabled),subtracts);
  });
});

GymTests.test("persists non-garage area policy overrides while absent values keep the global fallback",()=>{
  const settings={
    ...deepCopy(DEFAULT_SETTINGS),
    reservedAreaKindsBlockPlacement:["door"],
    reservedAreaKindsSubtractSpace:["door"],
  };
  const first=normalizeLayout({
    ...deepCopy(DEFAULT_LAYOUT),
    areas:[
      {id:"door_allow",kind:"door",label:"Allowed door",xFt:1,yFt:1,widthFt:2,heightFt:2,blocksPlacement:false,subtractsSpace:false},
      {id:"nogo_force",kind:"nogospace",label:"Forced no-go",xFt:1,yFt:5,widthFt:2,heightFt:2,blocksPlacement:true,subtractsSpace:true},
      {id:"door_fallback",kind:"door",label:"Fallback door",xFt:5,yFt:1,widthFt:2,heightFt:2},
    ],
  },settings);
  const second=normalizeLayout(deepCopy(first),settings);
  const allowed=second.areas.find(area=>area.id==="door_allow");
  const forced=second.areas.find(area=>area.id==="nogo_force");
  const fallback=second.areas.find(area=>area.id==="door_fallback");

  GymTests.deepEqual({blocksPlacement:allowed.blocksPlacement,subtractsSpace:allowed.subtractsSpace},{blocksPlacement:false,subtractsSpace:false});
  GymTests.deepEqual({blocksPlacement:forced.blocksPlacement,subtractsSpace:forced.subtractsSpace},{blocksPlacement:true,subtractsSpace:true});
  GymTests.equal(Object.prototype.hasOwnProperty.call(fallback,"blocksPlacement"),false);
  GymTests.equal(Object.prototype.hasOwnProperty.call(fallback,"subtractsSpace"),false);
  GymTests.equal(areaBlocksPlacement(allowed,settings),false);
  GymTests.equal(areaSubtractsSpace(allowed,settings),false);
  GymTests.equal(areaBlocksPlacement(forced,settings),true);
  GymTests.equal(areaSubtractsSpace(forced,settings),true);
  GymTests.equal(areaBlocksPlacement(fallback,settings),true);
  GymTests.equal(areaSubtractsSpace(fallback,settings),true);

  const previous={layout:state.layout,settings:state.settings};
  try{
    state.settings=settings;
    state.layout={...second,areas:[allowed]};
    const allowedOverlap={x:1,y:1,w:2,h:2};
    GymTests.equal(reservedSqFt(),0);
    GymTests.equal(isInvalidPlacement("candidate",allowedOverlap,allowedOverlap),false);
    GymTests.equal(hardPlacementConflict("candidate",allowedOverlap),null);

    state.layout={...second,areas:[forced]};
    const forcedOverlap={x:1,y:5,w:2,h:2};
    GymTests.equal(reservedSqFt(),4);
    GymTests.equal(isInvalidPlacement("candidate",forcedOverlap,forcedOverlap),true);
    GymTests.equal(hardPlacementConflict("candidate",forcedOverlap)?.kind,"reserved-area");
  }finally{
    state.layout=previous.layout;
    state.settings=previous.settings;
  }
});

GymTests.test("maps each exterior wall to an inward-facing rotation",()=>{
  const segments=GymGarageDoors.boundarySegments([{x:0,y:0,w:10,h:8}]);
  const byWall=Object.fromEntries(segments.map(segment=>[segment.wall,segment]));
  GymTests.deepEqual(Object.fromEntries(["top","bottom","left","right"].map(wall=>[wall,{
    inwardX:byWall[wall].inwardX,inwardZ:byWall[wall].inwardZ,rotationY:byWall[wall].rotationY,
  }])),{
    top:{inwardX:0,inwardZ:1,rotationY:0},
    bottom:{inwardX:0,inwardZ:-1,rotationY:Math.PI},
    left:{inwardX:1,inwardZ:0,rotationY:Math.PI/2},
    right:{inwardX:-1,inwardZ:0,rotationY:-Math.PI/2},
  });
});

GymTests.test("rejects an opening rectangle in the room interior",()=>{
  const result=GymGarageDoors.resolveOpening({x:5,y:5,w:4,h:1},GymGarageDoors.boundarySegments(GARAGE_ROOM_RECTS));
  GymTests.deepEqual(result,{ok:false,code:"off-boundary",message:"Opening must lie on a room boundary."});
});

GymTests.test("rejects a left opening spanning the extension gap",()=>{
  const result=GymGarageDoors.resolveOpening({x:0,y:13,w:.1,h:5.5},GymGarageDoors.boundarySegments(GARAGE_ROOM_RECTS));
  GymTests.deepEqual(result,{ok:false,code:"missing-boundary-span",message:"Opening must cover one continuous room-boundary span."});
});

GymTests.test("plans three rows and three bays as six grid lines",()=>{
  const rect={x:1+11/12,y:18.5,w:16,h:1};
  const resolution=GymGarageDoors.resolveOpening(rect,GymGarageDoors.boundarySegments(GARAGE_ROOM_RECTS),{areaId:"garage",label:"Garage"});
  GymTests.assert(resolution.ok,"Expected the bottom garage opening to resolve");
  const lines=GymGarageDoors.planPanelLines(rect,resolution);
  GymTests.equal(lines.length,6);
  [18.75,19,19.25].forEach((z,index)=>{
    GymTests.closeTo(lines[index].z1,z,1e-9);
    GymTests.closeTo(lines[index].z2,z,1e-9);
    GymTests.closeTo(lines[index].x1,1+11/12,1e-9);
    GymTests.closeTo(lines[index].x2,17+11/12,1e-9);
  });
  [5+11/12,9+11/12,13+11/12].forEach((x,index)=>{
    const line=lines[index+3];
    GymTests.closeTo(line.x1,x,1e-9);
    GymTests.closeTo(line.x2,x,1e-9);
    GymTests.closeTo(line.z1,18.5,1e-9);
    GymTests.closeTo(line.z2,19.5,1e-9);
  });
});

function garagePlanArea(overrides={}){
  return {...GymGarageDoors.seededLayout3Area(),...overrides};
}

function garageAreaFromRect(id,rect,overrides={}){
  const feetAndInches=value=>{
    const feet=Math.floor(value+1e-9);
    return {feet,inches:Math.round((value-feet)*12)};
  };
  const x=feetAndInches(rect.x),y=feetAndInches(rect.y);
  const width=feetAndInches(rect.w),height=feetAndInches(rect.h);
  return garagePlanArea({
    id,xFt:x.feet,xIn:x.inches,yFt:y.feet,yIn:y.inches,
    widthFt:width.feet,widthIn:width.inches,heightFt:height.feet,heightIn:height.inches,
    ...overrides,
  });
}

function withGaragePlanState(area,run){
  const previous={layout:state.layout,settings:state.settings,roomCache:state._roomCache,render:window.render};
  const fixture=legacyGarageLayout3Fixture();
  try{
    state.settings=fixture.settings;
    state.layout={...deepCopy(fixture.layout),areas:[area]};
    state._roomCache=null;
    window.__garagePlanRenderCount=0;
    window.render=()=>{ window.__garagePlanRenderCount+=1; };
    return run();
  }finally{
    state.layout=previous.layout;
    state.settings=previous.settings;
    state._roomCache=previous.roomCache;
    window.render=previous.render;
  }
}

const garagePlanUiTests=[];
function garagePlanUiTest(name,run){ garagePlanUiTests.push([name,run]); }
window.addEventListener("load",()=>{
  garagePlanUiTests.forEach(([name,run])=>GymTests.test(name,run));
  GymTests.finish();
});

garagePlanUiTest("renders a selected normalized Layout 3 garage as an accessible 4 by 4 architectural symbol",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const area=normalizeLayout({...deepCopy(fixture.layout),areas:[garagePlanArea()],garageWallRevision:1},fixture.settings).areas[0];
  const svg=garageDoorAreaSvg(area,{rects:GARAGE_ROOM_RECTS},true);
  GymTests.equal((svg.match(/class="garagePanelFace"/g)||[]).length,16);
  GymTests.equal((svg.match(/class="garageSectionLine"/g)||[]).length,3);
  GymTests.equal((svg.match(/class="garageBayLine"/g)||[]).length,3);
  GymTests.assert(svg.includes('class="garageOpeningLine"'));
  GymTests.assert(svg.includes('role="button"'));
  GymTests.assert(svg.includes('tabindex="0"'));
  GymTests.assert(svg.includes('aria-label="Garage door'));
  GymTests.assert(svg.includes('aria-pressed="true"'));
  GymTests.assert(svg.includes("garageDoorSelected"));
  GymTests.assert(!svg.includes("doorArc"));
});

garagePlanUiTest("renders an unselected garage with false pressed state and no selected class",()=>{
  const svg=garageDoorAreaSvg(garagePlanArea(),{rects:GARAGE_ROOM_RECTS},false);
  GymTests.assert(svg.includes('aria-pressed="false"'));
  GymTests.assert(!svg.includes("garageDoorSelected"));
});

garagePlanUiTest("transposes garage sections and bays for a vertical wall opening",()=>{
  const area=garageAreaFromRect("garage_vertical",{x:0,y:2,w:1,h:8});
  const svg=garageDoorAreaSvg(area,{rects:[{x:0,y:0,w:10,h:12}]});
  GymTests.equal((svg.match(/class="garagePanelFace"/g)||[]).length,16);
  GymTests.equal((svg.match(/class="garageSectionLine"/g)||[]).length,3);
  GymTests.equal((svg.match(/class="garageBayLine"/g)||[]).length,3);
  GymTests.assert(svg.includes('<line x1="0.25" y1="2" x2="0.25" y2="10" class="garageSectionLine"'));
  GymTests.assert(svg.includes('<line x1="0" y1="4" x2="1" y2="4" class="garageBayLine"'));
  GymTests.assert(svg.includes('<line x1="0" y1="2" x2="0" y2="10" class="garageOpeningLine"'));
});

garagePlanUiTest("keeps an off-wall garage selectable without drawing a floating opening",()=>{
  const area=garageAreaFromRect("garage_off_wall",{x:5,y:5,w:4,h:1});
  const svg=garageDoorAreaSvg(area,{rects:[{x:0,y:0,w:12,h:12}]});
  GymTests.equal((svg.match(/class="garagePanelFace"/g)||[]).length,16);
  GymTests.assert(svg.includes('class="garageDoorArea garageDoorArchitectural garageDoorInvalid"'));
  GymTests.assert(svg.includes('role="button"'));
  GymTests.assert(svg.includes('aria-invalid="true"'));
  GymTests.assert(svg.includes("Opening must lie on a room boundary."));
  GymTests.assert(!svg.includes('class="garageOpeningLine"'));
});

garagePlanUiTest("shows architectural-only garage policy copy and omits personnel-door controls",()=>{
  const area=garagePlanArea({id:"manual_garage"});
  withGaragePlanState(area,()=>{
    const panel=selectedAreaPanel(area);
    GymTests.assert(panel.includes("Architectural door only. It does not reserve operating clearance, so the existing machines against this wall remain valid. Add a No-go area if you want to keep the door path clear."));
    GymTests.assert(panel.includes("16-square-foot editor footprint is not subtracted"));
    GymTests.assert(panel.includes("does not block equipment"));
    GymTests.assert(!panel.includes('area_doorSwing'));
    GymTests.assert(!panel.includes('area_doorHinge'));
    GymTests.assert(!panel.includes('area_doorRadius'));
  });
});

garagePlanUiTest("escapes a persisted garage ID in every selected SVG resize handle",()=>{
  const maliciousId='garage" onmouseover="window.__garageIdInjected=1';
  const area=garagePlanArea({id:maliciousId});
  const markup=garageDoorAreaSvg(area,{rects:GARAGE_ROOM_RECTS},true);
  const parsed=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,"image/svg+xml");
  GymTests.equal(parsed.querySelectorAll("parsererror").length,0);
  const handles=[...parsed.querySelectorAll('[data-resize="area"]')];
  GymTests.equal(handles.length,8);
  handles.forEach(handle=>GymTests.equal(handle.getAttribute("data-id"),maliciousId));
  GymTests.equal(parsed.querySelectorAll("[onmouseover]").length,0);
});

garagePlanUiTest("escapes a persisted garage ID across selected-area inspector controls",()=>{
  const maliciousId='garage" onmouseover="window.__garageIdInjected=1';
  const area=garagePlanArea({id:maliciousId});
  withGaragePlanState(area,()=>{
    const holder=document.createElement("div");
    holder.innerHTML=selectedAreaPanel(area);
    const controls=[...holder.querySelectorAll("[data-id]")];
    GymTests.assert(controls.length>0,"Expected selected-area controls with data IDs");
    controls.forEach(control=>GymTests.equal(control.getAttribute("data-id"),maliciousId));
    GymTests.equal(holder.querySelectorAll("[onmouseover]").length,0);
  });
});

garagePlanUiTest("describes an ordinary area's effective global reservation policy",()=>{
  const area={id:"walkway",kind:"walkway",label:"Walkway",xFt:1,yFt:1,widthFt:2,heightFt:2};
  withGaragePlanState(area,()=>{
    state.settings={...state.settings,reservedAreaKindsSubtractSpace:["walkway"],reservedAreaKindsBlockPlacement:["walkway"]};
    const panel=selectedAreaPanel(area);
    GymTests.assert(panel.includes("4-square-foot editor footprint is subtracted"));
    GymTests.assert(panel.includes("blocks equipment"));
  });
});

[
  ["off-boundary",garageAreaFromRect("garage_off_boundary",{x:5,y:5,w:4,h:1}),"Opening must lie on a room boundary."],
  ["missing-boundary-span",garageAreaFromRect("garage_missing_span",{x:0,y:13,w:1/12,h:5.5}),"Opening must cover one continuous room-boundary span."],
].forEach(([code,area,message])=>{
  garagePlanUiTest(`exposes the ${code} garage warning in Plan and the selected inspector`,()=>{
    withGaragePlanState(area,()=>{
      const svg=garageDoorAreaSvg(area,room());
      const panel=selectedAreaPanel(area);
      GymTests.assert(svg.includes("garageDoorInvalid"));
      GymTests.assert(svg.includes('aria-invalid="true"'));
      GymTests.assert(svg.includes(message));
      GymTests.assert(panel.includes(message));
    });
  });
});

garagePlanUiTest("Enter and Space select a focused Plan area and clear competing selections",()=>{
  const area=garagePlanArea({id:"garage_keyboard"});
  withGaragePlanState(area,()=>{
    const group=document.createElementNS("http://www.w3.org/2000/svg","g");
    group.dataset.type="area";
    group.dataset.id=area.id;
    group.setAttribute("role","button");
    const child=document.createElementNS("http://www.w3.org/2000/svg","rect");
    group.appendChild(child);
    ["Enter"," "].forEach((key,index)=>{
      state.layout.selectedAreaId=null;
      state.layout.selectedInstId="competing_equipment";
      state.layout.selectedWallFeatureId="competing_wall_feature";
      let prevented=false,stopped=false;
      const handled=selectPlanAreaFromKeyboard({
        key,target:child,
        preventDefault(){ prevented=true; },
        stopPropagation(){ stopped=true; },
      });
      GymTests.equal(handled,true);
      GymTests.equal(prevented,true);
      GymTests.equal(stopped,true);
      GymTests.equal(state.layout.selectedAreaId,area.id);
      GymTests.equal(state.layout.selectedInstId,null);
      GymTests.equal(state.layout.selectedWallFeatureId,null);
      GymTests.equal(window.__garagePlanRenderCount,index+1);
    });
  });
});

garagePlanUiTest("Plan area keyboard selection ignores unrelated keys and missing areas",()=>{
  const target={closest(){ return null; }};
  GymTests.equal(selectPlanAreaFromKeyboard({key:"ArrowRight",target}),false);
  GymTests.equal(selectPlanAreaFromKeyboard({key:"Enter",target}),false);
});

garagePlanUiTest("wires Plan SVG Enter handling through the area keyboard selector",()=>{
  const area=garagePlanArea({id:"garage_wired_keyboard"});
  withGaragePlanState(area,()=>{
    const previousTab=state.tab;
    const existingSvg=document.querySelector("#layoutSvg");
    if(existingSvg) existingSvg.id="layoutSvg_test_background";
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.id="layoutSvg";
    const group=document.createElementNS("http://www.w3.org/2000/svg","g");
    group.dataset.type="area";
    group.dataset.id=area.id;
    group.setAttribute("role","button");
    const child=document.createElementNS("http://www.w3.org/2000/svg","rect");
    group.appendChild(child);
    svg.appendChild(group);
    document.body.appendChild(svg);
    try{
      state.tab="layout";
      state.layout.selectedInstId="competing_equipment";
      wireMain();
      child.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));
      GymTests.equal(state.layout.selectedAreaId,area.id);
      GymTests.equal(state.layout.selectedInstId,null);
      GymTests.equal(window.__garagePlanRenderCount,1);
    }finally{
      state.tab=previousTab;
      svg.remove();
      if(existingSvg) existingSvg.id="layoutSvg";
    }
  });
});

function garageMigrationContext(fixture,layout,{name=fixture.name,hadWallFeatures=true,profileKeys}={}){
  const byId=new Map(fixture.items.map(item=>[item.id,item]));
  return {
    name,
    room:wallFeatureRoomData(layout,fixture.settings),
    profileKeys:profileKeys||[...new Set(layout.instances.map(inst=>byId.get(inst.itemId)).filter(Boolean).map(equipmentModelProfile))].sort(),
    hadWallFeatures,
    legacyFeatures:GymWallFeatures.layout3LegacyStarter(),
    starterFeatures:GymWallFeatures.layout3Starter(),
  };
}

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

GymTests.test("installs the refreshed starter for an exact-profile pre-wall-feature layout",()=>{
  const fixture=legacyGarageLayout3Fixture();
  delete fixture.layout.wallFeatures;
  const normalized=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  GymTests.deepEqual(normalized.wallFeatures,GymWallFeatures.layout3Starter());
});

GymTests.test("migrates only the five explicitly retained known wall features",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.items=[];
  fixture.layout.instances=[];
  fixture.layout.wallFeatures=fixture.layout.wallFeatures.slice(0,5);
  const normalized=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  GymTests.equal(normalized.garageWallRevision,1);
  GymTests.deepEqual(normalized.wallFeatures.map(feature=>feature.id),GymWallFeatures.layout3Starter().slice(0,5).map(feature=>feature.id));
});

GymTests.test("keeps a customized known wall feature byte-equal and reports its door overlap",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.layout.wallFeatures[0].color="#112233";
  const canonical=normalizeLayout({...deepCopy(fixture.layout),garageWallRevision:1},fixture.settings,{name:fixture.name,items:fixture.items});
  const expected=deepCopy(canonical.wallFeatures[0]);
  const normalized=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  const actual=normalized.wallFeatures.find(feature=>feature.id===expected.id);
  GymTests.deepEqual(actual,expected);
  const validation=GymWallFeatures.validate(actual,normalized,wallFeatureRoomData(normalized,fixture.settings));
  GymTests.assert(validation.reasons.some(reason=>reason.code==="door-overlap"),"Expected the preserved customized feature to overlap the new door");
});

GymTests.test("does not recreate a refreshed wall feature deleted after migration",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const migrated=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  migrated.wallFeatures=migrated.wallFeatures.filter(feature=>feature.id!=="wf_l3_primary_mirror");
  const normalized=normalizeNamedLayout(fixture.name,migrated,fixture.settings,fixture.items);
  GymTests.equal(normalized.garageWallRevision,1);
  GymTests.equal(normalized.wallFeatures.some(feature=>feature.id==="wf_l3_primary_mirror"),false);
});

GymTests.test("reuses a matching resolved manual garage and canonicalizes every seeded field",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.layout.areas.push({
    id:"manual_garage",kind:"garagedoor",label:"Old opening",xFt:1,xIn:11,yFt:18,yIn:6,widthFt:16,widthIn:0,heightFt:1,heightIn:0,
    garageDoorHeightFt:9,garageDoorHeightIn:0,garageDoorStyle:"plain",garageDoorColor:"#ffffff",
    blocksPlacement:true,subtractsSpace:true,installerNote:"preserve me",
  });
  const normalized=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  const actual=normalized.areas.find(area=>area.id==="manual_garage");
  GymTests.deepEqual(actual,{...GymGarageDoors.seededLayout3Area(),id:"manual_garage",installerNote:"preserve me"});
  GymTests.equal(normalized.areas.filter(area=>area.kind==="garagedoor").length,1);
});

GymTests.test("preserves a distinct manual garage while adding the stable Layout 3 seed",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const canonical=normalizeLayout({...deepCopy(fixture.layout),garageWallRevision:1},fixture.settings,{name:fixture.name,items:fixture.items});
  delete canonical.garageWallRevision;
  const manual={id:"manual_side_garage",kind:"garagedoor",label:"Side opening",xFt:0,xIn:0,yFt:14,yIn:3,widthFt:1,widthIn:0,heightFt:5,heightIn:3,custom:"keep"};
  canonical.areas.push(deepCopy(manual));
  const migrated=GymGarageDoors.migrateLayout3(canonical,garageMigrationContext(fixture,canonical));
  GymTests.deepEqual(migrated.areas.find(area=>area.id===manual.id),manual);
  GymTests.deepEqual(migrated.areas.find(area=>area.id==="area_l3_bottom_garage_v1"),GymGarageDoors.seededLayout3Area());
});

GymTests.test("uses the exact equipment profile signal after rename without legacy wall features",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.name="Renovated gym";
  fixture.layout.wallFeatures=[];
  const normalized=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  GymTests.equal(normalized.garageWallRevision,1);
  GymTests.equal(normalized.areas.filter(area=>area.kind==="garagedoor").length,1);
  GymTests.deepEqual(normalized.wallFeatures,[]);
});

GymTests.test("uses all seven legacy material signatures without name or equipment profiles",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.name="Renovated gym";
  fixture.items=[];
  fixture.layout.instances=[];
  const normalized=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  GymTests.equal(normalized.garageWallRevision,1);
  GymTests.equal(normalized.areas.filter(area=>area.kind==="garagedoor").length,1);
});

GymTests.test("does not migrate an unrelated name-only Layout 3",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const unrelated={instances:[],areas:[],wallFeatures:[]};
  const before=deepCopy(unrelated);
  const migrated=GymGarageDoors.migrateLayout3(unrelated,garageMigrationContext(fixture,unrelated,{name:"Layout 3",profileKeys:[]}));
  GymTests.deepEqual(migrated,before);
});

GymTests.test("does not count repeated copies of one known ID as five known Layout 3 IDs",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const repeated=Array.from({length:5},(_,index)=>({...fixture.layout.wallFeatures[0],label:`Copy ${index}`}));
  const source={instances:[],areas:[],wallFeatures:repeated};
  const migrated=GymGarageDoors.migrateLayout3(source,garageMigrationContext(fixture,source,{name:"Layout 3",profileKeys:[]}));
  GymTests.deepEqual(migrated,source);
});

GymTests.test("leaves Layouts 1 and 2 byte-equal",()=>{
  const fixture=legacyGarageLayout3Fixture();
  ["Layout 1","Layout 2"].forEach(name=>{
    const source={marker:name,instances:[],areas:[],wallFeatures:[]};
    const migrated=GymGarageDoors.migrateLayout3(source,garageMigrationContext(fixture,source,{name,profileKeys:[]}));
    GymTests.deepEqual(migrated,source);
  });
});

GymTests.test("preserves every canonical non-target Layout 3 record through repeat migration",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.layout.wallFeatures.push({id:"wf_unrelated",kind:"mirror",label:"Keep me",wall:"top",startFt:16,startIn:0,bottomFt:2,bottomIn:0,widthFt:2,widthIn:0,heightFt:3,heightIn:0,color:"#abcdef",brightnessPct:0});
  const baseline=normalizeLayout({...deepCopy(fixture.layout),garageWallRevision:1},fixture.settings,{name:fixture.name,items:fixture.items});
  delete baseline.garageWallRevision;
  const snapshot={
    instances:deepCopy(baseline.instances),
    areas:deepCopy(baseline.areas),
    outlets:deepCopy(baseline.outlets),
    wallExtensions:deepCopy(baseline.wallExtensions),
    ceilingZones:deepCopy(baseline.ceilingZones),
    floorZones:deepCopy(baseline.floorZones),
    flooringPieces:deepCopy(baseline.flooringPieces),
    spatial3d:deepCopy(baseline.spatial3d),
    unrelated:deepCopy(baseline.wallFeatures.find(feature=>feature.id==="wf_unrelated")),
  };
  const first=GymGarageDoors.migrateLayout3(baseline,garageMigrationContext(fixture,baseline));
  const second=GymGarageDoors.migrateLayout3(first,garageMigrationContext(fixture,first));
  [first,second].forEach(migrated=>{
    GymTests.deepEqual(migrated.instances,snapshot.instances);
    GymTests.deepEqual(migrated.areas.filter(area=>area.kind!=="garagedoor"),snapshot.areas);
    GymTests.deepEqual(migrated.outlets,snapshot.outlets);
    GymTests.deepEqual(migrated.wallExtensions,snapshot.wallExtensions);
    GymTests.deepEqual(migrated.ceilingZones,snapshot.ceilingZones);
    GymTests.deepEqual(migrated.floorZones,snapshot.floorZones);
    GymTests.deepEqual(migrated.flooringPieces,snapshot.flooringPieces);
    GymTests.deepEqual(migrated.spatial3d,snapshot.spatial3d);
    GymTests.deepEqual(migrated.wallFeatures.find(feature=>feature.id==="wf_unrelated"),snapshot.unrelated);
  });
});
