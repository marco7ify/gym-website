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

GymTests.test("maps top-wall plan coordinates", () => {
  GymTests.deepEqual(
    GymWallFeatures.planRect({wall:"top",startFt:1,widthFt:4},{W:20,L:19.5}),
    {x:1,y:0,w:4,h:.22}
  );
});

GymTests.test("maps left-wall plan coordinates", () => {
  GymTests.deepEqual(
    GymWallFeatures.planRect({wall:"left",startFt:3,widthFt:5},{W:20,L:19.5}),
    {x:0,y:3,w:.22,h:5}
  );
});

GymTests.test("maps right-wall plan coordinates", () => {
  GymTests.deepEqual(
    GymWallFeatures.planRect({wall:"right",startFt:3,widthFt:5},{W:20,L:19.5}),
    {x:19.78,y:3,w:.22,h:5}
  );
});

const layout3Room={
  W:19+10/12,
  L:19.5,
  ceiling:9,
  rects:[
    {x:0,y:0,w:19+10/12,h:19.5},
    {x:-3,y:14.25,w:3,h:5.25},
  ],
};

const layout3Shell={
  areas:[
    {kind:"door",xFt:12,xIn:6,yFt:0,yIn:0,widthFt:3,widthIn:1,heightFt:1,heightIn:0},
  ],
  floorZones:[
    {xFt:0,xIn:0,yFt:0,yIn:0,widthFt:19,widthIn:10,heightFt:19,heightIn:6,elevationIn:4},
  ],
};

GymTests.test("reports a top-wall door overlap", () => {
  const result=GymWallFeatures.validate(
    {kind:"led",wall:"top",startFt:12,startIn:6,widthFt:3,widthIn:1,bottomFt:7,heightFt:0,heightIn:1},
    layout3Shell,
    layout3Room
  );
  GymTests.deepEqual(result.reasons.map(reason=>reason.code), ["door-overlap"]);
});

GymTests.test("reports a missing left base-wall run", () => {
  const result=GymWallFeatures.validate(
    {kind:"mirror",wall:"left",startFt:14,startIn:3,widthFt:5,widthIn:3,bottomFt:1,heightFt:5},
    layout3Shell,
    layout3Room
  );
  GymTests.deepEqual(result.reasons.map(reason=>reason.code), ["missing-wall"]);
});

GymTests.test("reports a feature above the raised-floor ceiling", () => {
  const result=GymWallFeatures.validate(
    {kind:"led",wall:"top",startFt:2,widthFt:5,bottomFt:8,bottomIn:8,heightFt:0,heightIn:1},
    layout3Shell,
    layout3Room
  );
  GymTests.deepEqual(result.reasons.map(reason=>reason.code), ["above-ceiling"]);
});

GymTests.test("accepts the approved bottom and right mirrors", () => {
  const bottomMirror={kind:"mirror",wall:"bottom",startFt:2,bottomFt:1,bottomIn:6,widthFt:5,heightFt:5,heightIn:6};
  const rightMirror={kind:"mirror",wall:"right",startFt:11,bottomFt:1,bottomIn:6,widthFt:4,heightFt:5,heightIn:6};
  GymTests.deepEqual(GymWallFeatures.validate(bottomMirror,layout3Shell,layout3Room), {valid:true,reasons:[]});
  GymTests.deepEqual(GymWallFeatures.validate(rightMirror,layout3Shell,layout3Room), {valid:true,reasons:[]});
});

GymTests.test("uses the greatest raised-floor elevation at a point", () => {
  const elevation=GymWallFeatures.floorElevationAt({floorZones:[
    {xFt:0,yFt:0,widthFt:4,heightFt:4,elevationIn:4},
    {xFt:2,yFt:2,widthFt:4,heightFt:4,elevationIn:8},
  ]},3,3);
  GymTests.closeTo(elevation,8/12,1e-9);
});

GymTests.test("normalizes feature bounds, color, brightness, and ceiling clearance", () => {
  const feature=GymWallFeatures.normalize(
    {kind:"led",wall:"top",startFt:30,widthFt:2,heightFt:2,bottomFt:8,bottomIn:8,color:"blue",brightnessPct:120},
    {W:20,L:19.5,ceiling:9,rects:[{x:0,y:0,w:20,h:19.5}]},
    () => "wf_bounded",
    {floorZones:[{xFt:0,yFt:0,widthFt:20,heightFt:1,elevationIn:4}]}
  );
  GymTests.equal(feature.id,"wf_bounded");
  GymTests.equal(feature.color,"#ffb36b");
  GymTests.equal(feature.brightnessPct,100);
  GymTests.closeTo(GymWallFeatures.start(feature),18,1e-9);
  GymTests.closeTo(GymWallFeatures.width(feature),2,1e-9);
  GymTests.closeTo(GymWallFeatures.bottom(feature)+GymWallFeatures.height(feature),26/3,1e-9);
});

GymTests.test("normalizes half-inch wall runs within integer-inch wall bounds", () => {
  const room={W:20,L:19.5,ceiling:9,rects:[{x:0,y:0,w:20,h:19.5}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:14,startIn:5.5,widthFt:5,widthIn:6.5,bottomFt:1,heightFt:5},
    room,
    ()=>"wf_integer_run"
  );
  const runInches=Math.round((GymWallFeatures.start(feature)+GymWallFeatures.width(feature))*12);

  GymTests.equal(runInches,240);
  GymTests.deepEqual(GymWallFeatures.validate(feature,{},room),{valid:true,reasons:[]});
});

GymTests.test("normalizes half-inch vertical runs within a raised-floor ceiling", () => {
  const room={W:20,L:19.5,ceiling:9,rects:[{x:0,y:0,w:20,h:19.5}]};
  const layout={floorZones:[{xFt:0,yFt:0,widthFt:20,heightFt:1,elevationIn:4}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:2,widthFt:5,bottomFt:3,bottomIn:5.5,heightFt:5,heightIn:6.5},
    room,
    ()=>"wf_integer_height",
    layout
  );
  const verticalInches=Math.round((GymWallFeatures.bottom(feature)+GymWallFeatures.height(feature))*12);

  GymTests.equal(verticalInches,104);
  GymTests.deepEqual(GymWallFeatures.validate(feature,layout,room),{valid:true,reasons:[]});
});

GymTests.test("normalizes half-inch vertical runs within an integer-inch ceiling", () => {
  const room={W:20,L:19.5,ceiling:9,rects:[{x:0,y:0,w:20,h:19.5}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:2,widthFt:5,bottomFt:3,bottomIn:5.5,heightFt:5,heightIn:6.5},
    room,
    ()=>"wf_integer_ceiling"
  );
  const verticalInches=Math.round((GymWallFeatures.bottom(feature)+GymWallFeatures.height(feature))*12);

  GymTests.equal(verticalInches,108);
  GymTests.deepEqual(GymWallFeatures.validate(feature,{},room),{valid:true,reasons:[]});
});

GymTests.test("never expands a fractional-inch physical wall limit", () => {
  const physicalInches=240.75;
  const room={W:physicalInches/12,L:19.5,ceiling:9,rects:[{x:0,y:0,w:physicalInches/12,h:19.5}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:14,startIn:6,widthFt:5,widthIn:7,bottomFt:1,heightFt:5},
    room,
    ()=>"wf_fractional_wall"
  );
  const runInches=(GymWallFeatures.start(feature)+GymWallFeatures.width(feature))*12;

  GymTests.assert(runInches<=physicalInches,`Expected normalized run to stay within ${physicalInches} physical inches, received ${runInches}`);
  GymTests.equal(runInches,240);
  GymTests.deepEqual(GymWallFeatures.validate(feature,{},room),{valid:true,reasons:[]});
});

GymTests.test("never expands a fractional-inch physical ceiling limit", () => {
  const physicalInches=108.75;
  const room={W:20,L:19.5,ceiling:physicalInches/12,rects:[{x:0,y:0,w:20,h:19.5}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:2,widthFt:5,bottomFt:3,bottomIn:6,heightFt:5,heightIn:7},
    room,
    ()=>"wf_fractional_ceiling"
  );
  const verticalInches=(GymWallFeatures.bottom(feature)+GymWallFeatures.height(feature))*12;

  GymTests.assert(verticalInches<=physicalInches,`Expected normalized height to stay within ${physicalInches} physical inches, received ${verticalInches}`);
  GymTests.equal(verticalInches,108);
  GymTests.deepEqual(GymWallFeatures.validate(feature,{},room),{valid:true,reasons:[]});
});

GymTests.test("never expands fractional-inch clearance above a raised floor", () => {
  const physicalInches=104.75;
  const room={W:20,L:19.5,ceiling:9,rects:[{x:0,y:0,w:20,h:19.5}]};
  const layout={floorZones:[{xFt:0,yFt:0,widthFt:20,heightFt:1,elevationIn:3.25}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:2,widthFt:5,bottomFt:3,bottomIn:2,heightFt:5,heightIn:7},
    room,
    ()=>"wf_fractional_raised_floor",
    layout
  );
  const verticalInches=(GymWallFeatures.bottom(feature)+GymWallFeatures.height(feature))*12;

  GymTests.assert(verticalInches<=physicalInches,`Expected raised-floor height to stay within ${physicalInches} physical inches, received ${verticalInches}`);
  GymTests.equal(verticalInches,104);
  GymTests.deepEqual(GymWallFeatures.validate(feature,layout,room),{valid:true,reasons:[]});
});

GymTests.test("keeps minimum sizes inside a physical envelope smaller than the minimum", () => {
  const physicalInches=5.75;
  const room={W:physicalInches/12,L:1,ceiling:physicalInches/12,rects:[{x:0,y:0,w:physicalInches/12,h:1}]};
  const feature=GymWallFeatures.normalize(
    {kind:"mirror",wall:"top",startFt:0,widthFt:0,widthIn:1,bottomFt:0,heightFt:0,heightIn:1},
    room,
    ()=>"wf_tiny_envelope"
  );

  GymTests.equal(GymWallFeatures.width(feature)*12,5);
  GymTests.equal(GymWallFeatures.height(feature)*12,5);
  GymTests.deepEqual(GymWallFeatures.validate(feature,{},room),{valid:true,reasons:[]});
});

GymTests.test("maps a wall feature into its interior 3D transform", () => {
  const transform=GymWallFeatures.worldTransform(
    {wall:"bottom",startFt:2,widthFt:5,bottomFt:1,bottomIn:6,heightFt:5,heightIn:6},
    {W:20,L:19.5,ceiling:9},
    {}
  );
  GymTests.deepEqual(transform,{x:4.5,y:4.25,z:19.42,rotationY:Math.PI,width:5,height:5.5,depth:.08});
});

GymTests.test("maps a top-wall feature flush to the interior wall inset", () => {
  const transform=GymWallFeatures.worldTransform(
    {wall:"top",startFt:2,widthFt:5,bottomFt:1,bottomIn:6,heightFt:5,heightIn:6},
    {W:20,L:19.5,ceiling:9},
    {}
  );
  GymTests.deepEqual(transform,{x:4.5,y:4.25,z:.08,rotationY:0,width:5,height:5.5,depth:.08});
});

GymTests.test("maps left and right features to their interior wall insets", () => {
  const room={W:20,L:19.5,ceiling:9};
  const left=GymWallFeatures.worldTransform(
    {wall:"left",startFt:3,widthFt:5,bottomFt:1,bottomIn:6,heightFt:5,heightIn:6},room,{}
  );
  const right=GymWallFeatures.worldTransform(
    {wall:"right",startFt:3,widthFt:5,bottomFt:1,bottomIn:6,heightFt:5,heightIn:6},room,{}
  );
  GymTests.deepEqual(left,{x:.08,y:4.25,z:5.5,rotationY:Math.PI/2,width:5,height:5.5,depth:.08});
  GymTests.deepEqual(right,{x:19.92,y:4.25,z:5.5,rotationY:-Math.PI/2,width:5,height:5.5,depth:.08});
});

GymTests.test("raises a wall feature with a four-inch finished floor", () => {
  const transform=GymWallFeatures.worldTransform(
    {wall:"top",startFt:2,widthFt:5,bottomFt:1,bottomIn:6,heightFt:5,heightIn:6},
    {W:20,L:19.5,ceiling:9},
    {floorZones:[{xFt:0,yFt:0,widthFt:20,heightFt:1,elevationIn:4}]}
  );
  GymTests.deepEqual(transform,{x:4.5,y:55/12,z:.08,rotationY:0,width:5,height:5.5,depth:.08});
});

GymTests.test("provides seven independent Layout 3 starter records", () => {
  const starter=GymWallFeatures.layout3Starter();
  GymTests.deepEqual(starter.map(feature=>({
    id:feature.id,kind:feature.kind,wall:feature.wall,startFt:feature.startFt,startIn:feature.startIn,
    bottomFt:feature.bottomFt,bottomIn:feature.bottomIn,widthFt:feature.widthFt,widthIn:feature.widthIn,
    heightFt:feature.heightFt,heightIn:feature.heightIn,color:feature.color,brightnessPct:feature.brightnessPct,
  })),[
    {id:"wf_l3_primary_mirror",kind:"mirror",wall:"left",startFt:0,startIn:0,bottomFt:1,bottomIn:0,widthFt:8,widthIn:9,heightFt:7,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_aisle_mirror",kind:"mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_gazelle_slats",kind:"slat",wall:"left",startFt:9,startIn:0,bottomFt:0,bottomIn:0,widthFt:5,widthIn:0,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
    {id:"wf_l3_slat_led_left",kind:"led",wall:"left",startFt:8,startIn:11,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_slat_led_right",kind:"led",wall:"left",startFt:14,startIn:1,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_mirror_wash",kind:"led",wall:"left",startFt:0,startIn:0,bottomFt:8,bottomIn:7,widthFt:8,widthIn:9,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
    {id:"wf_l3_cardio_strip",kind:"led",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
  ]);
  starter[0].color="#000000";
  GymTests.equal(GymWallFeatures.layout3Starter()[0].color,"#cbd5e1");
});

GymTests.test("retains seven independent legacy Layout 3 starter records", () => {
  const legacy=GymWallFeatures.layout3LegacyStarter();
  GymTests.deepEqual(legacy,GARAGE_LAYOUT3_LEGACY_FEATURES);
  legacy[0].wall="left";
  GymTests.equal(GymWallFeatures.layout3LegacyStarter()[0].wall,"bottom");
});

GymTests.test("does not seed Layout 3 starters without the required room signature", () => {
  const old=normalizeNamedLayout("Layout 3",{instances:[],areas:[]},DEFAULT_SETTINGS);
  const intentionallyEmpty=normalizeNamedLayout("Layout 3",{instances:[],areas:[],wallFeatures:[]},DEFAULT_SETTINGS);
  const other=normalizeNamedLayout("Layout 2",{instances:[],areas:[]},DEFAULT_SETTINGS);

  GymTests.equal(old.wallFeatures.length,0);
  GymTests.equal(intentionallyEmpty.wallFeatures.length,0);
  GymTests.equal(other.wallFeatures.length,0);
});

GymTests.test("architectural override beats globally enabled garage blocking",()=>{
  const previous={layout:state.layout,settings:state.settings};
  try{
    state.settings={...deepCopy(DEFAULT_SETTINGS),reservedAreaKindsBlockPlacement:["garagedoor"],reservedAreaKindsSubtractSpace:["garagedoor"]};
    state.layout=normalizeLayout({...deepCopy(DEFAULT_LAYOUT),areas:[GymGarageDoors.seededLayout3Area()]},state.settings);
    const overlap={x:7.5,y:18.5,w:2.38,h:1};
    GymTests.equal(isInvalidPlacement("candidate",overlap,overlap),false);
    GymTests.equal(reservedSqFt(),0);
  }finally{
    state.layout=previous.layout; state.settings=previous.settings;
  }
});

GymTests.test("normalizes full-library and lone-layout imports through the same migration route",()=>{
  const fixture=legacyGarageLayout3Fixture();
  fixture.layout.compareSets=[{id:"cmp_import",name:"Default",items:[]}];
  fixture.layout.activeCompareSetId="cmp_import";
  const full=normalizeImportedLayoutPayload({
    layouts:[{id:"ly_import",name:fixture.name,layout:deepCopy(fixture.layout)}],
    activeLayoutId:"ly_import",
  },fixture.settings,fixture.items,()=>"ly_import");
  const lone=normalizeImportedLayoutPayload({
    layoutName:fixture.name,
    layout:deepCopy(fixture.layout),
  },fixture.settings,fixture.items,()=>"ly_import");
  GymTests.deepEqual(full,lone);
  GymTests.equal(full.layout.garageWallRevision,1);
});

GymTests.test("returns null when an import payload contains no layout data",()=>{
  GymTests.equal(normalizeImportedLayoutPayload({},DEFAULT_SETTINGS,[],()=>"ly_unused"),null);
});

GymTests.test("normalizes wall features and keeps only a valid feature selection", () => {
  const normalized=normalizeLayout({
    instances:[],
    areas:[],
    wallFeatures:[
      {id:"wf_keep",kind:"mirror",wall:"bottom",startFt:2,widthFt:5,heightFt:5,heightIn:6,bottomFt:1,bottomIn:6},
      {id:"wf_drop",kind:"unknown",wall:"bottom"},
    ],
    selectedWallFeatureId:"wf_keep",
  },DEFAULT_SETTINGS);
  const stale=normalizeLayout({...normalized,selectedWallFeatureId:"wf_missing"},DEFAULT_SETTINGS);

  GymTests.equal(normalized.wallFeatures.length,1);
  GymTests.equal(normalized.selectedWallFeatureId,"wf_keep");
  GymTests.equal(stale.selectedWallFeatureId,null);
});

GymTests.test("canonicalizes imported wall feature IDs and de-duplicates them per layout", () => {
  const feature=(id,label)=>({id,kind:"mirror",wall:"bottom",label,startFt:1,widthFt:2,heightFt:4,bottomFt:1});
  const normalized=normalizeLayout({
    instances:[],
    areas:[],
    wallFeatures:[
      feature("  wf_keep  ","kept"),
      feature("wf_keep","duplicate"),
      feature(42,"numeric"),
      feature("   ","blank"),
      feature({value:"wf_object"},"object"),
    ],
    selectedWallFeatureId:"  wf_keep  ",
  },DEFAULT_SETTINGS);
  const ids=normalized.wallFeatures.map(entry=>entry.id);

  GymTests.equal(ids[0],"wf_keep");
  GymTests.equal(new Set(ids).size,5);
  GymTests.assert(ids.every(id=>typeof id==="string" && id.trim()===id && id.length>0));
  GymTests.assert(ids.slice(1).every(id=>id!=="wf_keep" && id.startsWith("wf_")));
  GymTests.equal(normalized.selectedWallFeatureId,"wf_keep");
});

GymTests.test("canonical wall feature IDs keep patch and removal independent", () => {
  const feature=(id,label)=>({id,kind:"mirror",wall:"bottom",label,startFt:1,widthFt:2,heightFt:4,bottomFt:1,color:"#cbd5e1"});
  const normalized=normalizeLayout({
    instances:[],
    areas:[],
    wallFeatures:[feature("wf_repeat","first"),feature("wf_repeat","second"),feature("","third")],
  },DEFAULT_SETTINGS);
  const previousLayout=state.layout;
  const previousSettings=state.settings;
  state.layout=normalized;
  state.settings=deepCopy(DEFAULT_SETTINGS);
  const secondId=state.layout.wallFeatures[1].id;
  const thirdId=state.layout.wallFeatures[2].id;

  patchWallFeature(secondId,{color:"#112233"});
  GymTests.equal(state.layout.wallFeatures[0].color,"#cbd5e1");
  GymTests.equal(state.layout.wallFeatures[1].color,"#112233");
  removeWallFeature(thirdId);
  GymTests.deepEqual(state.layout.wallFeatures.map(entry=>entry.label),["first","second"]);

  state.layout=previousLayout;
  state.settings=previousSettings;
});

GymTests.test("preserves normalized wall feature feet and inches through a reload", () => {
  const normalized=normalizeLayout({
    instances:[],
    areas:[],
    wallFeatures:[{id:"wf_exact",kind:"led",wall:"top",startFt:2,startIn:9,widthFt:5,widthIn:6,bottomFt:7,bottomIn:3,heightFt:0,heightIn:1}],
  },DEFAULT_SETTINGS);
  const reloaded=normalizeLayout(deepCopy(normalized),DEFAULT_SETTINGS);
  const feature=reloaded.wallFeatures[0];

  GymTests.closeTo(GymWallFeatures.start(feature),2.75,1e-9);
  GymTests.closeTo(GymWallFeatures.width(feature),5.5,1e-9);
  GymTests.closeTo(GymWallFeatures.bottom(feature),7.25,1e-9);
  GymTests.closeTo(GymWallFeatures.height(feature),1/12,1e-9);
});

GymTests.test("uses the suggested layout name when native prompts are unsupported", () => {
  const name=requestLayoutName(
    "Duplicate layout name:",
    "Layout 3 (copy)",
    ()=>{ throw new Error("prompt() is not supported."); }
  );
  GymTests.equal(name,"Layout 3 (copy)");
});

GymTests.test("preserves a layout name entered through the native prompt", () => {
  const name=requestLayoutName("Duplicate layout name:","Layout 3 (copy)",()=>"Custom copy");
  GymTests.equal(name,"Custom copy");
});

GymTests.test("treats cancelling a native layout-name prompt as cancellation", () => {
  const name=requestLayoutName("Duplicate layout name:","Layout 3 (copy)",()=>null);
  GymTests.equal(name,null);
});

GymTests.test("does not swallow unrelated layout-name prompt errors", () => {
  let caught=null;
  try{
    requestLayoutName("Duplicate layout name:","Layout 3 (copy)",()=>{ throw new Error("unexpected failure"); });
  }catch(error){
    caught=error;
  }
  GymTests.equal(caught?.message,"unexpected failure");
});

GymTests.test("does not swallow a near-match unsupported-prompt error", () => {
  let caught=null;
  try{
    requestLayoutName(
      "Duplicate layout name:",
      "Layout 3 (copy)",
      ()=>{ throw new Error("prompt() is not supported because the prompt bridge crashed"); }
    );
  }catch(error){
    caught=error;
  }
  GymTests.equal(caught?.message,"prompt() is not supported because the prompt bridge crashed");
});

GymTests.test("allocates deterministic case-insensitive trimmed layout names", () => {
  const layouts=[
    {id:"ly_1",name:"Layout 3 (copy)"},
    {id:"ly_2",name:"layout 3 (COPY) (2)"},
  ];
  GymTests.equal(availableLayoutName("  layout 3 (copy)  ",layouts),"layout 3 (copy) (3)");
  GymTests.equal(availableLayoutName("  Training room  ",layouts),"Training room");
});

function layoutActionTestState(){
  const settings=deepCopy(DEFAULT_SETTINGS);
  const source=normalizeLayout({
    ...deepCopy(DEFAULT_LAYOUT),
    instances:[{id:"inst_source",itemId:"item_source",xFt:1,yFt:1,rot:0}],
    wallFeatures:[deepCopy(GymWallFeatures.layout3Starter()[0])],
  },settings);
  return {
    settings,
    layouts:[{id:"ly_1",name:"Layout 1",layout:deepCopy(source)}],
    activeLayoutId:"ly_1",
    layout:deepCopy(source),
    tab:"layout",
    _roomCache:{stale:true},
  };
}

GymTests.test("a new-layout action adds and selects exactly one empty layout", () => {
  const appState=layoutActionTestState();
  const changed=performLayoutLibraryAction("new",appState,{
    requestName:()=>"Training room",
    makeId:()=>"ly_new",
  });
  GymTests.equal(changed,true);
  GymTests.deepEqual(appState.layouts.map(entry=>({id:entry.id,name:entry.name})),[
    {id:"ly_1",name:"Layout 1"},
    {id:"ly_new",name:"Training room"},
  ]);
  GymTests.equal(appState.activeLayoutId,"ly_new");
  GymTests.equal(appState.layout.instances.length,0);
  GymTests.equal(appState.layout.wallFeatures.length,1);
});

GymTests.test("a duplicate action selects an independent layout copy", () => {
  const appState=layoutActionTestState();
  const changed=performLayoutLibraryAction("duplicate",appState,{
    requestName:()=>"Layout 1 copy",
    makeId:()=>"ly_copy",
  });
  GymTests.equal(changed,true);
  GymTests.equal(appState.layouts.length,2);
  GymTests.equal(appState.activeLayoutId,"ly_copy");
  GymTests.equal(appState.layout.instances.length,1);
  appState.layout.wallFeatures[0].color="#000000";
  GymTests.equal(appState.layouts[0].layout.wallFeatures[0].color,"#cbd5e1");
});

GymTests.test("duplicating a refreshed Layout 3 preserves its revision, garage, and features byte-for-byte",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const refreshed=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  const snapshot={
    revision:refreshed.garageWallRevision,
    garage:deepCopy(refreshed.areas.find(area=>area.kind==="garagedoor")),
    features:deepCopy(refreshed.wallFeatures),
  };
  const appState={
    settings:fixture.settings,
    items:fixture.items,
    layouts:[{id:"ly_3",name:fixture.name,layout:deepCopy(refreshed)}],
    activeLayoutId:"ly_3",
    layout:deepCopy(refreshed),
    tab:"layout",
    _roomCache:{stale:true},
  };
  const changed=performLayoutLibraryAction("duplicate",appState,{requestName:()=>"Layout 3 copy",makeId:()=>"ly_copy"});
  const duplicate=appState.layouts.find(entry=>entry.id==="ly_copy").layout;
  GymTests.equal(changed,true);
  GymTests.equal(duplicate.garageWallRevision,snapshot.revision);
  GymTests.deepEqual(duplicate.areas.find(area=>area.kind==="garagedoor"),snapshot.garage);
  GymTests.deepEqual(duplicate.wallFeatures,snapshot.features);
});

GymTests.test("all export modes emit version 13 without an AI API key",()=>{
  const fixture=legacyGarageLayout3Fixture();
  const refreshed=normalizeNamedLayout(fixture.name,fixture.layout,fixture.settings,fixture.items);
  const previous={
    exportMode:state.exportMode,exportLayoutScope:state.exportLayoutScope,settings:state.settings,
    items:state.items,categories:state.categories,layouts:state.layouts,activeLayoutId:state.activeLayoutId,
    layout:state.layout,tab:state.tab,
  };
  try{
    state.exportLayoutScope="active";
    state.settings={...fixture.settings,aiApiKey:"secret-test-key"};
    state.items=fixture.items;
    state.categories=["Strength"];
    state.layouts=[{id:"ly_3",name:fixture.name,layout:deepCopy(refreshed)}];
    state.activeLayoutId="ly_3";
    state.layout=deepCopy(refreshed);
    state.tab="layout";
    ["noLayouts","layoutsOnly","full"].forEach(mode=>{
      state.exportMode=mode;
      const payload=exportPayloadFromState().payload;
      GymTests.equal(payload.version,13);
      GymTests.equal(Object.prototype.hasOwnProperty.call(payload.settings,"aiApiKey"),false);
    });
  }finally{
    Object.assign(state,previous);
  }
});

GymTests.test("repeated unsupported-prompt duplicates receive unique names", () => {
  const appState=layoutActionTestState();
  let nextId=2;
  const requestName=(message,suggested)=>requestLayoutName(message,suggested,()=>{
    throw new Error("prompt() is not supported.");
  });
  performLayoutLibraryAction("duplicate",appState,{requestName,makeId:()=>`ly_${nextId++}`});
  appState.activeLayoutId="ly_1";
  appState.layout=deepCopy(appState.layouts[0].layout);
  performLayoutLibraryAction("duplicate",appState,{requestName,makeId:()=>`ly_${nextId++}`});
  GymTests.deepEqual(appState.layouts.map(entry=>entry.name),[
    "Layout 1",
    "Layout 1 (copy)",
    "Layout 1 (copy) (2)",
  ]);
});

GymTests.test("rename keeps the current name and resolves a typed conflict", () => {
  const appState=layoutActionTestState();
  appState.layouts.push({id:"ly_2",name:"Layout 2",layout:deepCopy(appState.layout)});
  appState.activeLayoutId="ly_2";
  performLayoutLibraryAction("rename",appState,{requestName:()=>"  Layout 2  "});
  GymTests.equal(appState.layouts[1].name,"Layout 2");
  performLayoutLibraryAction("rename",appState,{requestName:()=>" layout 1 "});
  GymTests.equal(appState.layouts[1].name,"layout 1 (2)");
});

GymTests.test("cancelling a layout action leaves state unchanged", () => {
  const appState=layoutActionTestState();
  const before=deepCopy(appState);
  const changed=performLayoutLibraryAction("duplicate",appState,{requestName:()=>null,makeId:()=>"ly_unused"});
  GymTests.equal(changed,false);
  GymTests.deepEqual(appState,before);
});

GymTests.test("a near-match prompt error rethrows without mutating layouts", () => {
  const appState=layoutActionTestState();
  const before=deepCopy(appState);
  let caught=null;
  try{
    performLayoutLibraryAction("duplicate",appState,{
      requestName:(message,suggested)=>requestLayoutName(message,suggested,()=>{
        throw new Error("prompt() is not supported because the prompt bridge crashed");
      }),
      makeId:()=>"ly_unused",
    });
  }catch(error){
    caught=error;
  }
  GymTests.equal(caught?.message,"prompt() is not supported because the prompt bridge crashed");
  GymTests.deepEqual(appState,before);
});

GymTests.test("renders a selected valid mirror with programmatic pressed state", () => {
  const svg=wallFeatureSvg(
    {id:"wf1",kind:"mirror",wall:"bottom",startFt:2,widthFt:5},
    {W:20,L:19.5},
    true,
    {valid:true,reasons:[]}
  );
  GymTests.assert(svg.includes('data-type="wallfeature"'));
  GymTests.assert(svg.includes('data-id="wf1"'));
  GymTests.assert(svg.includes('aria-label="Mirror"'));
  GymTests.assert(svg.includes('aria-pressed="true"'));
  GymTests.assert(!svg.includes('aria-invalid="true"'));
  GymTests.assert(svg.includes('wallFeatureSelected'));
  GymTests.assert(svg.includes('wallFeatureMirror'));
});

GymTests.test("renders an unselected valid wall feature with pressed state off", () => {
  const svg=wallFeatureSvg(
    {id:"wf_valid",kind:"mirror",wall:"top",startFt:2,widthFt:5},
    {W:20,L:19.5},
    false,
    {valid:true,reasons:[]}
  );
  GymTests.assert(svg.includes('aria-pressed="false"'));
  GymTests.assert(!svg.includes('aria-invalid="true"'));
  GymTests.equal((svg.match(/aria-label=/g)||[]).length,1);
});

GymTests.test("renders slat and LED wall features with their visual and invalid states", () => {
  const room={W:20,L:19.5};
  const slat=wallFeatureSvg(
    {id:"wf_slat",kind:"slat",wall:"left",startFt:3,widthFt:5,color:"#8f5f3a"},
    room,
    false,
    {valid:false,reasons:[{code:"missing-wall",message:"Part of this base-wall run is missing."}]}
  );
  const led=wallFeatureSvg(
    {id:"wf_led",kind:"led",wall:"top",startFt:2,widthFt:5,color:"#ffb36b",brightnessPct:80},
    room,
    false,
    {valid:true,reasons:[]}
  );
  GymTests.assert(slat.includes('aria-label="Wood slat panel. Invalid: Part of this base-wall run is missing."'));
  GymTests.assert(slat.includes('aria-pressed="false"'));
  GymTests.assert(slat.includes('aria-invalid="true"'));
  GymTests.assert(slat.includes('Invalid: Part of this base-wall run is missing.'));
  GymTests.assert(slat.includes('wallFeatureSlat'));
  GymTests.assert(slat.includes('wallFeatureInvalid'));
  GymTests.assert(led.includes('aria-label="LED strip"'));
  GymTests.assert(led.includes('wallFeatureLed'));
  GymTests.assert(led.includes('wallFeatureLedGlow'));
});

GymTests.test("shows editable wall feature controls including LED brightness", () => {
  const panel=selectedWallFeaturePanel({
    id:"wf_led", kind:"led", label:"Mirror wash", wall:"bottom",
    startFt:2,startIn:6,bottomFt:7,bottomIn:3,widthFt:5,widthIn:0,heightFt:0,heightIn:1,
    color:"#ffd7aa",brightnessPct:65,
  },{valid:true,reasons:[]});
  ["Type", "Label", "Wall", "Along wall", "Mounting height", "Width", "Height", "Color", "Brightness"].forEach(label=>{
    GymTests.assert(panel.includes(label), `Expected inspector to include ${label}`);
  });
  GymTests.assert(panel.includes('Top/bottom measure from the left; left/right measure from the top.'));
});

GymTests.test("clamps a wall feature drag to its selected wall without changing its wall or mount", () => {
  const feature={wall:"bottom",startFt:1,widthFt:5,bottomFt:2,bottomIn:6};
  GymTests.deepEqual(
    wallFeatureDragPatch(feature, 1, -4, {W:20,L:19.5}),
    {startFt:0,startIn:0}
  );
  GymTests.deepEqual(
    wallFeatureDragPatch(feature, 1, 30, {W:20,L:19.5}),
    {startFt:15,startIn:0}
  );
  GymTests.equal(feature.wall,"bottom");
  GymTests.equal(feature.bottomFt,2);
  GymTests.equal(feature.bottomIn,6);
});

GymTests.test("resets an active wall feature drag on stable drag cleanup", () => {
  state.drag={active:true,type:"wallfeature",id:"wf_drag",start:{x:1,y:1},origin:{startFt:1},invalid:false};
  resetWallFeatureDrag();
  GymTests.equal(state.drag.active,false);
  GymTests.equal(state.drag.type,null);
  GymTests.equal(state.drag.id,null);
});

GymTests.test("enables framing for a valid visible wall feature in a 3D view", () => {
  const control=spatialFrameSelectedControl({
    spatialMode:"split",
    selectedInstId:null,
    selectedAreaId:null,
    selectedWallFeatureId:"wf1",
    wallFeatureValid:true,
    wallsVisible:true,
  });
  GymTests.assert(control.includes('data-action="spatial_frame_selected"'));
  GymTests.assert(!control.includes("disabled"));
});

GymTests.test("disables framing with an accessible reason for an invalid wall feature", () => {
  const control=spatialFrameSelectedControl({
    spatialMode:"3d",
    selectedInstId:null,
    selectedAreaId:null,
    selectedWallFeatureId:"wf_invalid",
    wallFeatureValid:false,
    wallFeatureReason:"Part of this base-wall run is missing.",
    wallsVisible:true,
  });
  GymTests.assert(control.includes("disabled"));
  GymTests.assert(control.includes('aria-disabled="true"'));
  GymTests.assert(control.includes("Part of this base-wall run is missing."));
});

GymTests.test("disables wall-feature framing when walls are hidden", () => {
  const control=spatialFrameSelectedControl({
    spatialMode:"split",
    selectedInstId:null,
    selectedAreaId:null,
    selectedWallFeatureId:"wf_hidden",
    wallFeatureValid:true,
    wallsVisible:false,
  });
  GymTests.assert(control.includes("disabled"));
  GymTests.assert(control.includes('aria-disabled="true"'));
  GymTests.assert(control.includes("Turn Walls on"));
});

GymTests.test("keeps equipment framing enabled when walls are hidden", () => {
  const control=spatialFrameSelectedControl({
    spatialMode:"3d",
    selectedInstId:"inst_1",
    selectedAreaId:null,
    selectedWallFeatureId:null,
    wallsVisible:false,
  });
  GymTests.assert(!control.includes("disabled"));
});
