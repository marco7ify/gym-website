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
    {id:"wf_l3_primary_mirror",kind:"mirror",wall:"bottom",startFt:2,startIn:0,bottomFt:1,bottomIn:6,widthFt:5,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_aisle_mirror",kind:"mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_gazelle_slats",kind:"slat",wall:"bottom",startFt:12,startIn:9,bottomFt:0,bottomIn:0,widthFt:6,widthIn:9,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
    {id:"wf_l3_slat_led_left",kind:"led",wall:"bottom",startFt:12,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_slat_led_right",kind:"led",wall:"bottom",startFt:19,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_mirror_wash",kind:"led",wall:"bottom",startFt:2,startIn:0,bottomFt:7,bottomIn:3,widthFt:5,widthIn:0,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
    {id:"wf_l3_cardio_strip",kind:"led",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
  ]);
  starter[0].color="#000000";
  GymTests.equal(GymWallFeatures.layout3Starter()[0].color,"#cbd5e1");
});

GymTests.test("seeds starter wall features only for legacy named Layout 3 records", () => {
  const old=normalizeNamedLayout("Layout 3",{instances:[],areas:[]},DEFAULT_SETTINGS);
  const intentionallyEmpty=normalizeNamedLayout("Layout 3",{instances:[],areas:[],wallFeatures:[]},DEFAULT_SETTINGS);
  const other=normalizeNamedLayout("Layout 2",{instances:[],areas:[]},DEFAULT_SETTINGS);

  GymTests.equal(old.wallFeatures.length,7);
  GymTests.equal(intentionallyEmpty.wallFeatures.length,0);
  GymTests.equal(other.wallFeatures.length,0);
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

GymTests.test("renders selectable mirror wall features with accessible identity", () => {
  const svg=wallFeatureSvg(
    {id:"wf1",kind:"mirror",wall:"bottom",startFt:2,widthFt:5},
    {W:20,L:19.5},
    true,
    {valid:true,reasons:[]}
  );
  GymTests.assert(svg.includes('data-type="wallfeature"'));
  GymTests.assert(svg.includes('data-id="wf1"'));
  GymTests.assert(svg.includes('aria-label="Mirror"'));
  GymTests.assert(svg.includes('wallFeatureSelected'));
  GymTests.assert(svg.includes('wallFeatureMirror'));
});

GymTests.test("renders slat and LED wall features with their visual and invalid states", () => {
  const room={W:20,L:19.5};
  const slat=wallFeatureSvg(
    {id:"wf_slat",kind:"slat",wall:"left",startFt:3,widthFt:5,color:"#8f5f3a"},
    room,
    false,
    {valid:false,reasons:[{code:"missing-wall"}]}
  );
  const led=wallFeatureSvg(
    {id:"wf_led",kind:"led",wall:"top",startFt:2,widthFt:5,color:"#ffb36b",brightnessPct:80},
    room,
    false,
    {valid:true,reasons:[]}
  );
  GymTests.assert(slat.includes('aria-label="Wood slat panel"'));
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

GymTests.test("enables framing for a selected wall feature in a 3D view", () => {
  const control=spatialFrameSelectedControl({
    spatialMode:"split",
    selectedInstId:null,
    selectedAreaId:null,
    selectedWallFeatureId:"wf1",
  });
  GymTests.assert(control.includes('data-action="spatial_frame_selected"'));
  GymTests.assert(!control.includes("disabled"));
});
