function walkthroughFixtureItem(id,name="Fixture equipment",length=2,width=2){
  return {...deepCopy(DEFAULT_ITEM),id,name,unit:"ft",length,width,height:7};
}

function walkthroughFixtureInstance(id,itemId,x=4,y=4,extra={}){
  const xParts=splitTotalFtToFtIn(x);
  const yParts=splitTotalFtToFtIn(y);
  return {
    id,itemId,xFt:xParts.ft,xIn:xParts.inch,yFt:yParts.ft,yIn:yParts.inch,
    rotated:false,deadspaceFt:0,deadspaceIn:0,deadspaceSides:null,__invalid:false,
    ...extra,
  };
}

function withWalkthroughFixture(config,run){
  const hadRoomCache=Object.prototype.hasOwnProperty.call(state,"_roomCache");
  const previous={
    items:state.items,
    layout:state.layout,
    settings:state.settings,
    layouts:state.layouts,
    activeLayoutId:state.activeLayoutId,
    tab:state.tab,
    categories:state.categories,
    exportMode:state.exportMode,
    exportLayoutScope:state.exportLayoutScope,
    roomCache:state._roomCache,
    render:window.render,
  };
  let renderCount=0;
  try{
    state.items=deepCopy(config.items||[]);
    state.settings={
      ...deepCopy(DEFAULT_SETTINGS),
      roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0,
      defaultDeadspaceSides:[],reservedAreaKindsBlockPlacement:["walkway","door","garagedoor","nogospace","cutout"],
      ...(config.settings||{}),
    };
    state.layout={
      ...deepCopy(DEFAULT_LAYOUT),
      instances:deepCopy(config.instances||[]),
      wallFeatures:deepCopy(config.wallFeatures||[]),
      areas:deepCopy(config.areas||[]),
      wallExtensions:deepCopy(config.wallExtensions||[]),
      floorZones:deepCopy(config.floorZones||[]),
    };
    state._roomCache=null;
    window.render=()=>{ renderCount+=1; };
    GymWalkthroughEditing.reset();
    return run(()=>renderCount);
  }finally{
    GymWalkthroughEditing.reset();
    state.items=previous.items;
    state.layout=previous.layout;
    state.settings=previous.settings;
    state.layouts=previous.layouts;
    state.activeLayoutId=previous.activeLayoutId;
    state.tab=previous.tab;
    state.categories=previous.categories;
    state.exportMode=previous.exportMode;
    state.exportLayoutScope=previous.exportLayoutScope;
    if(hadRoomCache) state._roomCache=previous.roomCache;
    else delete state._roomCache;
    window.render=previous.render;
  }
}

function basicWalkthroughFixture(extra={}){
  const target=walkthroughFixtureItem("item_target","Target",2,2);
  return {
    items:[target],
    instances:[walkthroughFixtureInstance("target",target.id,4,4)],
    ...extra,
  };
}

GymTests.test("defaults to Walk and six-inch room-coordinate movement",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    GymTests.deepEqual(GymWalkthroughEditing.state(),{
      mode:"walk",moveStep:"coarse",wallTool:null,status:null,undo:null,
    });
    GymWalkthroughEditing.setMode("edit");
    const result=GymWalkthroughEditing.nudgeInstance("target",1,0);
    GymTests.equal(result.ok,true);
    GymTests.closeTo(instXTotalFt(state.layout.instances[0]),4.5,1e-9);
    GymTests.closeTo(instYTotalFt(state.layout.instances[0]),4,1e-9);
  });
});

GymTests.test("Fine movement is exactly one inch",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    GymWalkthroughEditing.setMoveStep("fine");
    GymWalkthroughEditing.nudgeInstance("target",0,-1);
    GymTests.closeTo(instYTotalFt(state.layout.instances[0]),4-1/12,1e-9);
  });
});

GymTests.test("coarse movement preserves signed extension coordinates on either axis",()=>{
  const target=walkthroughFixtureItem("item_target","Target",1,1);
  const extension={id:"left_bay",wall:"left",startFt:2,startIn:0,lengthFt:8,lengthIn:0,depthFt:3,depthIn:0};
  const signedTarget=(id,x,y)=>walkthroughFixtureInstance(id,target.id,x,y);

  [
    {
      name:"horizontal",
      instance:signedTarget("target",-1.75,4),
      dx:1,dy:0,
      expected:{xFt:-2,xIn:9,yFt:4,yIn:0},
    },
    {
      name:"vertical movement keeps negative X byte-identical",
      instance:signedTarget("target",-1.75,4),
      dx:0,dy:1,
      expected:{xFt:-2,xIn:3,yFt:4,yIn:6},
    },
  ].forEach(testCase=>withWalkthroughFixture({
    items:[target],instances:[testCase.instance],wallExtensions:[extension],
  },()=>{
    const result=GymWalkthroughEditing.nudgeInstance("target",testCase.dx,testCase.dy);
    GymTests.equal(result.ok,true,testCase.name);
    const committed=state.layout.instances[0];
    GymTests.deepEqual({xFt:committed.xFt,xIn:committed.xIn,yFt:committed.yFt,yIn:committed.yIn},testCase.expected,testCase.name);
    GymTests.closeTo(instXTotalFt(committed),testCase.expected.xFt+testCase.expected.xIn/12,1e-9,testCase.name);
    GymTests.closeTo(instYTotalFt(committed),testCase.expected.yFt+testCase.expected.yIn/12,1e-9,testCase.name);
  }));

  const topExtension={id:"top_bay",wall:"top",startFt:2,startIn:0,lengthFt:8,lengthIn:0,depthFt:3,depthIn:0};
  withWalkthroughFixture({items:[target],instances:[signedTarget("target",4,-1.75)],wallExtensions:[topExtension]},()=>{
    const result=GymWalkthroughEditing.nudgeInstance("target",0,1);
    GymTests.equal(result.ok,true);
    GymTests.deepEqual(
      {yFt:result.instance.yFt,yIn:result.instance.yIn},
      {yFt:-2,yIn:9},
      "Top-extension movement must retain the exact signed -1 ft 3 in total",
    );
    GymTests.closeTo(instYTotalFt(result.instance),-1.25,1e-9);
  });
});

GymTests.test("Fine movement validates and commits the same signed candidate",()=>{
  const target=walkthroughFixtureItem("item_target","Target",1,1);
  const blocker=walkthroughFixtureItem("item_blocker","Blocker",1,1);
  const extension={id:"left_bay",wall:"left",startFt:2,startIn:0,lengthFt:8,lengthIn:0,depthFt:3,depthIn:0};
  withWalkthroughFixture({
    items:[target,blocker],
    wallExtensions:[extension],
    instances:[
      walkthroughFixtureInstance("target",target.id,-1.75,4),
      walkthroughFixtureInstance("blocker",blocker.id,-.5,4),
    ],
  },()=>{
    GymWalkthroughEditing.setMoveStep("fine");
    const result=GymWalkthroughEditing.nudgeInstance("target",1,0);
    GymTests.equal(result.ok,true);
    GymTests.deepEqual({xFt:result.instance.xFt,xIn:result.instance.xIn},{xFt:-2,xIn:4});
    GymTests.closeTo(instXTotalFt(result.instance),-1-2/3,1e-9);
    const committedRects=effectiveRectForInst(result.instance,target);
    GymTests.equal(hardPlacementConflict("target",committedRects.base),null,"The committed candidate must be the exact candidate that passed hard validation");
  });
});

GymTests.test("hard movement rejection preserves layout and undo byte-for-byte",()=>{
  const target=walkthroughFixtureItem("item_target","Target",2,2);
  const blocker=walkthroughFixtureItem("item_blocker","Blocker",1,1);
  const fixture={
    items:[target,blocker],
    instances:[
      walkthroughFixtureInstance("target",target.id,4,4),
      walkthroughFixtureInstance("blocker",blocker.id,3,4),
    ],
  };
  withWalkthroughFixture(fixture,()=>{
    const before=deepCopy(state.layout);
    const undo=GymWalkthroughEditing.state().undo;
    const result=GymWalkthroughEditing.nudgeInstance("target",-1,0);
    GymTests.equal(result.ok,false);
    GymTests.equal(result.reason,"hard-invalid");
    GymTests.assert(GymWalkthroughEditing.state().status.message.startsWith("Can’t move there"));
    GymTests.deepEqual(state.layout,before);
    GymTests.equal(GymWalkthroughEditing.state().undo,undo);
  });
});

GymTests.test("top and left boundary nudges hard-reject without replacing undo",()=>{
  [
    {name:"left",x:0,y:4,dx:-1,dy:0},
    {name:"top",x:4,y:0,dx:0,dy:-1},
  ].forEach(boundary=>{
    const target=walkthroughFixtureItem(`item_${boundary.name}`,`Boundary ${boundary.name}`,2,2);
    withWalkthroughFixture({
      items:[target],
      instances:[walkthroughFixtureInstance("target",target.id,4,4)],
    },()=>{
      GymWalkthroughEditing.nudgeInstance("target",1,0);
      const undo=GymWalkthroughEditing.state().undo;
      state.layout.instances=[walkthroughFixtureInstance("target",target.id,boundary.x,boundary.y)];
      const before=deepCopy(state.layout);
      const result=GymWalkthroughEditing.nudgeInstance("target",boundary.dx,boundary.dy);
      GymTests.equal(result.ok,false,`${boundary.name} boundary nudge must reject`);
      GymTests.equal(result.reason,"hard-invalid");
      GymTests.deepEqual(state.layout,before);
      GymTests.equal(GymWalkthroughEditing.state().undo,undo);
    });
  });
});

GymTests.test("clearance-only movement is accepted with a warning",()=>{
  const target=walkthroughFixtureItem("item_target","Target",2,2);
  const blocker=walkthroughFixtureItem("item_blocker","Blocker",2,2);
  withWalkthroughFixture({
    items:[target,blocker],
    instances:[
      walkthroughFixtureInstance("target",target.id,4,4,{deadspaceFt:1,deadspaceSides:["right"]}),
      walkthroughFixtureInstance("blocker",blocker.id,7,4),
    ],
  },()=>{
    const result=GymWalkthroughEditing.nudgeInstance("target",1,0);
    GymTests.equal(result.ok,true);
    GymTests.equal(result.instance.__invalid,true);
    GymTests.equal(GymWalkthroughEditing.state().status.tone,"warning");
  });
});

GymTests.test("rotation commits only validated candidates",()=>{
  const item=walkthroughFixtureItem("item_target","Treadmill",5,2);
  withWalkthroughFixture({items:[item],instances:[walkthroughFixtureInstance("target",item.id,4,4)]},()=>{
    state.layout.selectedInstId="target";
    const before=deepCopy(state.layout.instances);
    const success=GymWalkthroughEditing.rotateInstance("target");
    GymTests.equal(success.ok,true);
    GymTests.equal(state.layout.instances[0].rotated,true);
    GymTests.deepEqual(GymWalkthroughEditing.state().undo.instances,before);
    GymTests.deepEqual(GymWalkthroughEditing.state().status,{tone:"success",message:"Rotated Treadmill 90°."});
    const panel=walkthroughPanelElement();
    GymTests.equal(panel.querySelector('[role="status"]').textContent.trim(),"Rotated Treadmill 90°.");
    GymTests.assert(panel.textContent.includes("Orientation: 90°"));
  });

  withWalkthroughFixture({items:[item],instances:[walkthroughFixtureInstance("target",item.id,18,1)]},()=>{
    const before=deepCopy(state.layout);
    const undo=GymWalkthroughEditing.state().undo;
    const rejected=GymWalkthroughEditing.rotateInstance("target");
    GymTests.equal(rejected.ok,false);
    GymTests.equal(rejected.reason,"hard-invalid");
    GymTests.deepEqual(state.layout,before);
    GymTests.equal(GymWalkthroughEditing.state().undo,undo);
    GymTests.equal(GymWalkthroughEditing.state().status.tone,"error");
    GymTests.equal(walkthroughPanelElement().querySelector('[role="status"]').textContent.trim(),GymWalkthroughEditing.state().status.message);
  });
});

GymTests.test("rotation announces accepted clearance warnings in the Walkthrough live region",()=>{
  const target=walkthroughFixtureItem("item_target","Treadmill",5,2);
  const blocker=walkthroughFixtureItem("item_blocker","Blocker",1,1);
  withWalkthroughFixture({
    items:[target,blocker],
    instances:[
      walkthroughFixtureInstance("target",target.id,4,4,{deadspaceFt:1,deadspaceSides:["right"]}),
      walkthroughFixtureInstance("blocker",blocker.id,8,6),
    ],
  },()=>{
    state.layout.selectedInstId="target";
    const result=GymWalkthroughEditing.rotateInstance("target");
    GymTests.equal(result.ok,true);
    GymTests.equal(result.instance.__invalid,true);
    const expected="Rotated 90°. Clearance overlaps another item, so it is shown in red.";
    GymTests.deepEqual(GymWalkthroughEditing.state().status,{tone:"warning",message:expected});
    GymTests.equal(walkthroughPanelElement().querySelector('[role="status"]').textContent.trim(),expected);
  });
});

GymTests.test("wall hits create centered normalized features without mutating layout",()=>{
  withWalkthroughFixture({},()=>{
    const before=deepCopy(state.layout);
    const result=GymWalkthroughEditing.featureFromWallHit("mirror",{wall:"bottom",alongFt:10,mountFt:4});
    GymTests.equal(result.ok,true);
    GymTests.equal(result.feature.kind,"mirror");
    GymTests.equal(result.feature.wall,"bottom");
    GymTests.closeTo(GymWallFeatures.start(result.feature),7,1e-9);
    GymTests.closeTo(GymWallFeatures.bottom(result.feature),1.5,1e-9);
    GymTests.deepEqual(GymWallFeatures.validate(result.feature,state.layout,wallFeatureRoomData(state.layout,state.settings)),{valid:true,reasons:[]});
    GymTests.deepEqual(state.layout,before);
  });
});

GymTests.test("wall feature creation rejects door openings and missing base-wall runs",()=>{
  withWalkthroughFixture({
    areas:[{id:"door",kind:"door",xFt:7,xIn:0,yFt:19,yIn:6,widthFt:6,widthIn:0,heightFt:0,heightIn:6}],
  },()=>{
    const result=GymWalkthroughEditing.featureFromWallHit("mirror",{wall:"bottom",alongFt:10,mountFt:4});
    GymTests.equal(result.ok,false);
    GymTests.equal(result.reason,"This feature overlaps a door opening.");
  });

  withWalkthroughFixture({wallExtensions:[{id:"gap",wall:"left",startFt:7,startIn:0,lengthFt:6,lengthIn:0,depthFt:3,depthIn:0}]},()=>{
    const result=GymWalkthroughEditing.featureFromWallHit("mirror",{wall:"left",alongFt:10,mountFt:4});
    GymTests.equal(result.ok,false);
    GymTests.equal(result.reason,"Part of this base-wall run is missing.");
  });
});

GymTests.test("wall feature creation clamps to the exact clicked wall run",()=>{
  withWalkthroughFixture({
    areas:[{id:"door",kind:"door",xFt:7,xIn:0,yFt:19,yIn:6,widthFt:6,widthIn:0,heightFt:0,heightIn:6}],
  },()=>{
    const result=GymWalkthroughEditing.featureFromWallHit("mirror",{
      wall:"bottom",alongFt:6.9,mountFt:4,runStartFt:0,runEndFt:7,
    });
    GymTests.equal(result.ok,true);
    GymTests.closeTo(GymWallFeatures.start(result.feature),1,1e-9,"A six-foot mirror must clamp wholly inside the zero-to-seven-foot clicked run");
    GymTests.deepEqual(GymWallFeatures.validate(result.feature,state.layout,wallFeatureRoomData(state.layout,state.settings)),{valid:true,reasons:[]});
  });
});

GymTests.test("wall feature creation rejects a clicked run shorter than the selected feature",()=>{
  withWalkthroughFixture({},()=>{
    const before=deepCopy(state.layout);
    const result=GymWalkthroughEditing.featureFromWallHit("mirror",{
      wall:"top",alongFt:2.5,mountFt:4,runStartFt:0,runEndFt:5,
    });
    GymTests.deepEqual(result,{ok:false,reason:"This wall run is too short for that feature."});
    GymTests.deepEqual(state.layout,before);
  });
});

GymTests.test("feature patch validates before commit and rejected edits preserve undo",()=>{
  withWalkthroughFixture({},()=>{
    const added=GymWalkthroughEditing.addFeatureFromWallHit("mirror",{wall:"bottom",alongFt:10,mountFt:4});
    GymTests.equal(added.ok,true);
    const before=deepCopy(state.layout);
    const undo=GymWalkthroughEditing.state().undo;
    state.layout.areas=[{id:"door",kind:"door",xFt:0,xIn:0,yFt:19,yIn:6,widthFt:6,widthIn:0,heightFt:0,heightIn:6}];
    const beforeRejected=deepCopy(state.layout);
    const rejected=GymWalkthroughEditing.patchFeature(added.feature.id,{startFt:0,startIn:0});
    GymTests.equal(rejected.ok,false);
    GymTests.equal(rejected.reason,"door-overlap");
    GymTests.deepEqual(state.layout,beforeRejected);
    GymTests.equal(GymWalkthroughEditing.state().undo,undo);
    state.layout=before;
    const patched=GymWalkthroughEditing.patchFeature(added.feature.id,{label:"Training mirror",color:"#ABCDEF"});
    GymTests.equal(patched.ok,true);
    GymTests.equal(patched.feature.label,"Training mirror");
    GymTests.equal(patched.feature.color,"#abcdef");
  });
});

GymTests.test("feature patch rejects unsupported wall and kind before normalization",()=>{
  [
    {patch:{wall:"ceiling"},reason:"invalid-wall"},
    {patch:{kind:"poster"},reason:"invalid-kind"},
  ].forEach(({patch,reason})=>{
    withWalkthroughFixture({},()=>{
      const added=GymWalkthroughEditing.addFeatureFromWallHit("mirror",{wall:"bottom",alongFt:10,mountFt:4});
      const before=deepCopy(state.layout);
      const undo=GymWalkthroughEditing.state().undo;
      const result=GymWalkthroughEditing.patchFeature(added.feature.id,patch);
      GymTests.equal(result.ok,false);
      GymTests.equal(result.reason,reason);
      GymTests.deepEqual(state.layout,before);
      GymTests.equal(GymWalkthroughEditing.state().undo,undo);
    });
  });
});

GymTests.test("feature removal updates selection and supports undo",()=>{
  withWalkthroughFixture({},()=>{
    const added=GymWalkthroughEditing.addFeatureFromWallHit("slat",{wall:"right",alongFt:10,mountFt:4});
    state.layout.selectedWallFeatureId=added.feature.id;
    const before=deepCopy(state.layout);
    GymTests.deepEqual(GymWalkthroughEditing.removeFeature(added.feature.id),{ok:true});
    GymTests.equal(state.layout.wallFeatures.length,0);
    GymTests.equal(state.layout.selectedWallFeatureId,null);
    GymTests.equal(GymWalkthroughEditing.undoLast().ok,true);
    GymTests.deepEqual(state.layout.instances,before.instances);
    GymTests.deepEqual(state.layout.wallFeatures,before.wallFeatures);
    GymTests.equal(state.layout.selectedWallFeatureId,before.selectedWallFeatureId);
  });
});

GymTests.test("one-step undo restores movement, rotation, addition, and patch snapshots",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    const before=deepCopy(state.layout.instances);
    GymWalkthroughEditing.nudgeInstance("target",1,0);
    GymTests.equal(GymWalkthroughEditing.undoLast().ok,true);
    GymTests.deepEqual(state.layout.instances,before);
    GymTests.equal(GymWalkthroughEditing.state().undo,null);
    GymTests.equal(GymWalkthroughEditing.undoLast().reason,"empty");
  });

  const item=walkthroughFixtureItem("item_target","Treadmill",5,2);
  withWalkthroughFixture({items:[item],instances:[walkthroughFixtureInstance("target",item.id,4,4)]},()=>{
    const before=deepCopy(state.layout.instances);
    GymWalkthroughEditing.rotateInstance("target");
    GymWalkthroughEditing.undoLast();
    GymTests.deepEqual(state.layout.instances,before);
  });

  withWalkthroughFixture({},()=>{
    const before=deepCopy(state.layout.wallFeatures);
    GymWalkthroughEditing.addFeatureFromWallHit("led",{wall:"top",alongFt:10,mountFt:8});
    GymWalkthroughEditing.undoLast();
    GymTests.deepEqual(state.layout.wallFeatures,before);
    GymTests.equal(state.layout.selectedWallFeatureId,null);
  });

  withWalkthroughFixture({},()=>{
    const added=GymWalkthroughEditing.addFeatureFromWallHit("mirror",{wall:"bottom",alongFt:10,mountFt:4});
    const before=deepCopy(state.layout.wallFeatures);
    GymWalkthroughEditing.patchFeature(added.feature.id,{label:"Patched"});
    GymWalkthroughEditing.undoLast();
    GymTests.deepEqual(state.layout.wallFeatures,before);
  });
});

GymTests.test("Walkthrough undo cannot overwrite a different active layout",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    state.activeLayoutId="layout_a";
    state.layouts=[
      {id:"layout_a",name:"Layout A",layout:deepCopy(state.layout)},
      {id:"layout_b",name:"Layout B",layout:{
        ...deepCopy(DEFAULT_LAYOUT),
        instances:[walkthroughFixtureInstance("layout_b_target",state.items[0].id,12,12)],
        wallFeatures:[{id:"layout_b_led",kind:"led",label:"B LED",wall:"top",startFt:2,startIn:0,bottomFt:7,bottomIn:0,widthFt:4,widthIn:0,heightFt:0,heightIn:1,color:"#ffffff",brightnessPct:80}],
      }},
    ];
    GymTests.equal(GymWalkthroughEditing.nudgeInstance("target",1,0).ok,true);
    state.setActiveLayout("layout_b");
    const layoutB=deepCopy(state.layout);
    const result=GymWalkthroughEditing.undoLast();
    GymTests.deepEqual(result,{ok:false,reason:"layout-changed"});
    GymTests.deepEqual(state.layout,layoutB);
    GymTests.equal(GymWalkthroughEditing.state().undo,null);
  });
});

GymTests.test("reset clears transient editor state without mutating the layout",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    GymWalkthroughEditing.setMode("edit");
    GymWalkthroughEditing.setMoveStep("fine");
    GymWalkthroughEditing.setWallTool("mirror");
    GymWalkthroughEditing.nudgeInstance("target",1,0);
    const layout=deepCopy(state.layout);
    GymWalkthroughEditing.reset();
    GymTests.deepEqual(GymWalkthroughEditing.state(),{
      mode:"walk",moveStep:"coarse",wallTool:null,status:null,undo:null,
    });
    GymTests.deepEqual(state.layout,layout);
    GymTests.equal(GymWalkthroughEditing.setMode("not-a-mode").mode,"walk");
    GymTests.equal(GymWalkthroughEditing.setMoveStep("not-a-step").moveStep,"coarse");
    GymTests.equal(GymWalkthroughEditing.setWallTool("not-a-tool").wallTool,null);
  });
});

GymTests.test("accepted Walkthrough edits round-trip through persistence, duplication, and both layout export routes",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    const storageBefore=Object.fromEntries(Object.values(LS).map(key=>[key,localStorage.getItem(key)]));
    try{
      state.layouts=[{id:"ly_walk_source",name:"Walkthrough source",layout:deepCopy(state.layout)}];
      state.activeLayoutId="ly_walk_source";
      state.tab="layout";
      state.categories=["Benches"];

      GymWalkthroughEditing.setMode("edit");
      GymTests.equal(GymWalkthroughEditing.nudgeInstance("target",1,0).ok,true);
      GymWalkthroughEditing.setMoveStep("fine");
      GymTests.equal(GymWalkthroughEditing.nudgeInstance("target",0,1).ok,true);
      GymTests.equal(GymWalkthroughEditing.rotateInstance("target").ok,true);
      const added=GymWalkthroughEditing.addFeatureFromWallHit("led",{wall:"top",alongFt:10,mountFt:8});
      GymTests.equal(added.ok,true);
      const patched=GymWalkthroughEditing.patchFeature(added.feature.id,{
        label:"Round-trip LED",
        widthFt:4,widthIn:0,
        bottomFt:7,bottomIn:0,
        color:"#12AB34",
        brightnessPct:42,
      });
      GymTests.equal(patched.ok,true);
      GymTests.equal(GymWalkthroughEditing.removeFeature(added.feature.id).ok,true);
      GymTests.equal(GymWalkthroughEditing.undoLast().ok,true);

      const acceptedInstance=state.layout.instances.find(instance=>instance.id==="target");
      const acceptedFeature=state.layout.wallFeatures.find(feature=>feature.id===added.feature.id);
      GymTests.closeTo(instXTotalFt(acceptedInstance),4.5,1e-9);
      GymTests.closeTo(instYTotalFt(acceptedInstance),4+1/12,1e-9);
      GymTests.equal(acceptedInstance.rotated,true);
      GymTests.deepEqual({
        kind:acceptedFeature.kind,
        wall:acceptedFeature.wall,
        label:acceptedFeature.label,
        width:GymWallFeatures.width(acceptedFeature),
        bottom:GymWallFeatures.bottom(acceptedFeature),
        color:acceptedFeature.color,
        brightnessPct:acceptedFeature.brightnessPct,
      },{
        kind:"led",wall:"top",label:"Round-trip LED",width:4,bottom:7,color:"#12ab34",brightnessPct:42,
      });
      const accepted={
        instances:deepCopy(state.layout.instances),
        wallFeatures:deepCopy(state.layout.wallFeatures),
      };

      persist();
      const persistedLayout=normalizeNamedLayout(
        "Walkthrough source",
        loadJSON(LS.layout,null),
        state.settings,
        state.items,
      );
      GymTests.deepEqual(persistedLayout.instances,accepted.instances);
      GymTests.deepEqual(persistedLayout.wallFeatures,accepted.wallFeatures);

      const persistedLayouts=loadJSON(LS.layouts,[]).map(entry=>({
        id:entry.id,
        name:entry.name,
        layout:normalizeNamedLayout(entry.name,entry.layout,state.settings,state.items),
      }));
      const reloadedState={
        settings:state.settings,
        items:state.items,
        layouts:persistedLayouts,
        activeLayoutId:loadJSON(LS.activeLayoutId,null),
        layout:persistedLayout,
        tab:"layout",
        _roomCache:null,
      };
      GymTests.equal(performLayoutLibraryAction("duplicate",reloadedState,{
        requestName:()=>"Walkthrough disposable copy",
        makeId:()=>"ly_walk_copy",
      }),true);
      GymTests.deepEqual(reloadedState.layout.instances,accepted.instances);
      GymTests.deepEqual(reloadedState.layout.wallFeatures,accepted.wallFeatures);

      state.layouts=reloadedState.layouts;
      state.activeLayoutId=reloadedState.activeLayoutId;
      state.layout=reloadedState.layout;
      const assertImportedAccepted=(payload,expectedCount)=>{
        const imported=normalizeImportedLayoutPayload(payload,payload.settings,payload.items,()=>"ly_imported");
        GymTests.equal(imported.layouts.length,expectedCount);
        imported.layouts.forEach(entry=>{
          GymTests.deepEqual(entry.layout.instances,accepted.instances);
          GymTests.deepEqual(entry.layout.wallFeatures,accepted.wallFeatures);
        });
      };
      const assertNoEditorState=payload=>{
        const json=JSON.stringify(payload);
        ["moveStep","wallTool","undo"].forEach(key=>{
          GymTests.equal(json.includes(`\"${key}\"`),false,`Export must omit transient ${key}`);
        });
        ["mode","moveStep","wallTool","status","undo"].forEach(key=>{
          GymTests.equal(Object.prototype.hasOwnProperty.call(payload,key),false,`Export payload must omit transient editor ${key}`);
        });
        [payload.layout,...(payload.layouts||[]).map(entry=>entry.layout)].filter(Boolean).forEach(layout=>{
          ["mode","moveStep","wallTool","status","undo"].forEach(key=>{
            GymTests.equal(Object.prototype.hasOwnProperty.call(layout,key),false,`Exported layout must omit ${key}`);
          });
        });
      };

      state.exportMode="full";
      state.exportLayoutScope="all";
      const fullAll=exportPayloadFromState().payload;
      assertImportedAccepted(fullAll,2);
      assertNoEditorState(fullAll);

      state.exportMode="layoutsOnly";
      state.exportLayoutScope="active";
      const layoutOnly=exportPayloadFromState().payload;
      assertImportedAccepted(layoutOnly,1);
      assertNoEditorState(layoutOnly);
      GymTests.equal(GymWalkthroughEditing.state().mode,"edit","Export must not reset the live editor as a side effect");
      GymTests.equal(GymWalkthroughEditing.state().undo,null,"The accepted remove/undo sequence must leave one-step undo consumed");
    }finally{
      Object.entries(storageBefore).forEach(([key,value])=>{
        if(value===null) localStorage.removeItem(key);
        else localStorage.setItem(key,value);
      });
    }
  });
});

function walkthroughPanelElement(){
  const holder=document.createElement("div");
  holder.innerHTML=walkthroughEditPanel();
  return holder;
}

function walkthroughActionElement(action,dataset={}){
  const control=document.createElement("button");
  control.type="button";
  control.dataset.action=action;
  Object.assign(control.dataset,dataset);
  return control;
}

GymTests.test("renders an accessible Walk/Edit switch and equipment editor",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    state.layout.selectedInstId="target";
    GymWalkthroughEditing.setMode("edit");
    const html=walkthroughEditPanel();
    GymTests.assert(html.includes('role="radiogroup"'));
    GymTests.assert(html.includes('data-action="walkthrough_mode"'));
    GymTests.assert(html.includes('data-action="walkthrough_rotate"'));
    GymTests.equal((html.match(/data-action="walkthrough_move"/g)||[]).length,4);
    GymTests.assert(html.includes('aria-live="polite"'));
  });
});

GymTests.test("directional movement names announce the current step size",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    state.layout.selectedInstId="target";
    const expected=(panel,step)=>[
      ["up",`Move up ${step}`],
      ["left",`Move left ${step}`],
      ["right",`Move right ${step}`],
      ["down",`Move down ${step}`],
    ].forEach(([direction,label])=>GymTests.equal(
      panel.querySelector(`[data-action="walkthrough_move"][data-direction="${direction}"]`).getAttribute("aria-label"),
      label,
    ));

    expected(walkthroughPanelElement(),"6 inches");
    GymWalkthroughEditing.setMoveStep("fine");
    expected(walkthroughPanelElement(),"1 inch");
  });
});

GymTests.test("renders exact six-inch and Fine one-inch movement states",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    state.layout.selectedInstId="target";
    let panel=walkthroughPanelElement();
    let coarse=panel.querySelector('[data-action="walkthrough_step"][data-step="coarse"]');
    let fine=panel.querySelector('[data-action="walkthrough_step"][data-step="fine"]');
    GymTests.equal(coarse.textContent.trim(),"6 in");
    GymTests.equal(fine.textContent.trim(),"Fine · 1 in");
    GymTests.equal(coarse.getAttribute("aria-pressed"),"true");
    GymTests.equal(fine.getAttribute("aria-pressed"),"false");

    GymWalkthroughEditing.setMoveStep("fine");
    panel=walkthroughPanelElement();
    coarse=panel.querySelector('[data-action="walkthrough_step"][data-step="coarse"]');
    fine=panel.querySelector('[data-action="walkthrough_step"][data-step="fine"]');
    GymTests.equal(coarse.getAttribute("aria-pressed"),"false");
    GymTests.equal(fine.getAttribute("aria-pressed"),"true");
  });
});

GymTests.test("wall tools use native controls and expose their pressed state",()=>{
  withWalkthroughFixture({},()=>{
    GymWalkthroughEditing.setMode("edit");
    GymWalkthroughEditing.setWallTool("mirror");
    const panel=walkthroughPanelElement();
    const actions=Array.from(panel.querySelectorAll("[data-action]"));
    const wallTools=actions.filter(control=>control.dataset.action==="walkthrough_wall_tool");
    GymTests.equal(wallTools.length,3);
    GymTests.assert(actions.filter(control=>control.tagName==="BUTTON").every(control=>control.type==="button"));
    GymTests.equal(panel.querySelector('[data-kind="mirror"]').getAttribute("aria-pressed"),"true");
    GymTests.equal(panel.querySelector('[data-kind="slat"]').getAttribute("aria-pressed"),"false");
    GymTests.assert(!!panel.querySelector('[data-action="walkthrough_cancel_tool"]'));
  });
});

GymTests.test("Walkthrough Undo is disabled until an edit succeeds",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    state.layout.selectedInstId="target";
    let undo=walkthroughPanelElement().querySelector('[data-action="walkthrough_undo"]');
    GymTests.equal(undo.disabled,true);
    GymTests.equal(undo.getAttribute("aria-disabled"),"true");

    GymWalkthroughEditing.nudgeInstance("target",1,0);
    undo=walkthroughPanelElement().querySelector('[data-action="walkthrough_undo"]');
    GymTests.equal(undo.disabled,false);
    GymTests.equal(undo.getAttribute("aria-disabled"),"false");
  });
});

GymTests.test("Walkthrough rerenders restore the exact directional control",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    state.layout.selectedInstId="target";
    const holder=document.createElement("div");
    holder.innerHTML=walkthroughEditPanel();
    document.body.appendChild(holder);
    try{
      const selector='[data-focus-key="walkthrough-move-right:target"]';
      holder.querySelector(selector).focus();
      const focus=captureFocus();
      holder.innerHTML=walkthroughEditPanel();
      restoreFocus(focus);
      GymTests.equal(document.activeElement,holder.querySelector(selector));
    }finally{
      holder.remove();
    }
  });
});

GymTests.test("delegated Walkthrough equipment actions use the editing commands",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),renderCount=>{
    state.layout.selectedInstId="target";
    wireMain();
    const activate=control=>document.body.onclick({target:control});

    activate(walkthroughActionElement("walkthrough_mode",{mode:"edit"}));
    GymTests.equal(GymWalkthroughEditing.state().mode,"edit");
    activate(walkthroughActionElement("walkthrough_step",{step:"fine"}));
    GymTests.equal(GymWalkthroughEditing.state().moveStep,"fine");
    activate(walkthroughActionElement("walkthrough_move",{id:"target",dx:"1",dy:"0"}));
    GymTests.closeTo(instXTotalFt(state.layout.instances[0]),4+1/12,1e-9);
    activate(walkthroughActionElement("walkthrough_rotate",{id:"target"}));
    GymTests.equal(state.layout.instances[0].rotated,true);
    activate(walkthroughActionElement("walkthrough_wall_tool",{kind:"mirror"}));
    GymTests.equal(GymWalkthroughEditing.state().wallTool,"mirror");
    activate(walkthroughActionElement("walkthrough_cancel_tool"));
    GymTests.equal(GymWalkthroughEditing.state().wallTool,null);
    activate(walkthroughActionElement("walkthrough_undo"));
    GymTests.equal(state.layout.instances[0].rotated,false);
    GymTests.assert(renderCount()>=7);
  });
});

GymTests.test("selected equipment and wall features provide a path back to wall tools",()=>{
  const feature={
    id:"wf_target",kind:"mirror",label:"Mirror",wall:"top",
    startFt:2,startIn:0,bottomFt:1,bottomIn:0,widthFt:6,widthIn:0,heightFt:5,heightIn:0,
    color:"#cbd5e1",brightnessPct:0,
  };
  [
    {config:basicWalkthroughFixture(),select(){state.layout.selectedInstId="target";},label:"Clear selected equipment"},
    {config:{wallFeatures:[feature]},select(){state.layout.selectedWallFeatureId=feature.id;},label:"Clear selected wall feature"},
  ].forEach(testCase=>withWalkthroughFixture(testCase.config,()=>{
    GymWalkthroughEditing.setMode("edit");
    testCase.select();
    let panel=walkthroughPanelElement();
    const clear=panel.querySelector('[data-action="walkthrough_clear_selection"]');
    GymTests.assert(clear&&clear.tagName==="BUTTON");
    GymTests.equal(clear.getAttribute("aria-label"),testCase.label);

    wireMain();
    document.body.onclick({target:walkthroughActionElement("walkthrough_clear_selection")});
    GymTests.equal(state.layout.selectedInstId,null);
    GymTests.equal(state.layout.selectedWallFeatureId,null);
    panel=walkthroughPanelElement();
    GymTests.equal(panel.querySelectorAll('[data-action="walkthrough_wall_tool"]').length,3);
  }));
});

GymTests.test("the Walkthrough uses a browser-modal dialog with isolated initial focus",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),()=>{
    const app=document.querySelector("#app");
    const previousHtml=app.innerHTML;
    try{
      state.tab="layout";
      state.activeLayoutId="layout_modal";
      state.layouts=[{id:"layout_modal",name:"Modal layout",layout:deepCopy(state.layout)}];
      state.layout.walkthroughOpen=true;
      performRender();

      const dialog=document.querySelector(".walkthroughOverlay");
      GymTests.assert(dialog&&dialog.tagName==="DIALOG","Walkthrough overlay must use the browser's modal dialog primitive");
      GymTests.equal(dialog.getAttribute("aria-modal"),"true");
      GymTests.equal(dialog.open,true,"Walkthrough dialog must enter the top-layer modal state");
      const exit=dialog.querySelector('[data-action="spatial_walkthrough_close"]');
      GymTests.equal(exit.hasAttribute("autofocus"),true);
      GymTests.equal(document.activeElement,exit,"Opening Walkthrough must move initial focus into its Exit action");

      const selector=document.querySelector('[data-action="layout_select"]');
      selector.focus();
      GymTests.assert(dialog.contains(document.activeElement),"Underlying layout controls must not accept focus while Walkthrough is modal");
      GymTests.assert(document.querySelector('[data-action="spatial_walkthrough_open"][data-focus-key="walkthrough-launcher"]'));
      dialog.close();
    }finally{
      document.querySelector(".walkthroughOverlay")?.close?.();
      app.innerHTML=previousHtml;
    }
  });
});

GymTests.test("delegated Walkthrough feature inputs produce validated patches",()=>{
  const baseFeature={
    id:"wf_target",kind:"mirror",label:"Mirror",wall:"top",
    startFt:2,startIn:0,bottomFt:1,bottomIn:0,widthFt:6,widthIn:0,heightFt:5,heightIn:0,
    color:"#cbd5e1",brightnessPct:75,
  };
  const cases=[
    {action:"walkthrough_wf_kind",value:"slat",read:feature=>feature.kind,want:"slat"},
    {action:"walkthrough_wf_label",value:"Training wall",read:feature=>feature.label,want:"Training wall"},
    {action:"walkthrough_wf_wall",value:"bottom",read:feature=>feature.wall,want:"bottom"},
    {action:"walkthrough_wf_color",value:"#112233",read:feature=>feature.color,want:"#112233"},
    {action:"walkthrough_wf_brightness",value:"42",read:feature=>feature.brightnessPct,want:42},
    {action:"walkthrough_wf_start_ft",value:"3",read:feature=>feature.startFt,want:3},
    {action:"walkthrough_wf_start_in",value:"6",read:feature=>feature.startIn,want:6},
    {action:"walkthrough_wf_bottom_ft",value:"2",read:feature=>feature.bottomFt,want:2},
    {action:"walkthrough_wf_bottom_in",value:"6",read:feature=>feature.bottomIn,want:6},
    {action:"walkthrough_wf_width_ft",value:"5",read:feature=>feature.widthFt,want:5},
    {action:"walkthrough_wf_width_in",value:"6",read:feature=>feature.widthIn,want:6},
    {action:"walkthrough_wf_height_ft",value:"4",read:feature=>feature.heightFt,want:4},
    {action:"walkthrough_wf_height_in",value:"6",read:feature=>feature.heightIn,want:6},
  ];

  cases.forEach(testCase=>withWalkthroughFixture({wallFeatures:[baseFeature]},()=>{
    wireMain();
    const input=document.createElement("input");
    input.dataset.action=testCase.action;
    input.dataset.id=baseFeature.id;
    input.value=testCase.value;
    document.body.oninput({target:input});
    GymTests.equal(testCase.read(state.layout.wallFeatures[0]),testCase.want,testCase.action);
  }));
});

GymTests.test("delegated Walkthrough feature nudge and remove actions mutate the selected feature",()=>{
  const feature={
    id:"wf_target",kind:"mirror",label:"Mirror",wall:"top",
    startFt:2,startIn:0,bottomFt:1,bottomIn:0,widthFt:6,widthIn:0,heightFt:5,heightIn:0,
    color:"#cbd5e1",brightnessPct:0,
  };
  withWalkthroughFixture({wallFeatures:[feature]},()=>{
    state.layout.selectedWallFeatureId=feature.id;
    wireMain();
    document.body.onclick({target:walkthroughActionElement("walkthrough_wf_nudge",{id:feature.id,inches:"1"})});
    GymTests.equal(state.layout.wallFeatures[0].startIn,1);
    document.body.onclick({target:walkthroughActionElement("walkthrough_wf_remove",{id:feature.id})});
    GymTests.equal(state.layout.wallFeatures.length,0);
    GymTests.equal(state.layout.selectedWallFeatureId,null);
  });
});

GymTests.test("Escape cancels a wall tool before closing Walkthrough",()=>{
  withWalkthroughFixture(basicWalkthroughFixture(),renderCount=>{
    state.layout.walkthroughOpen=true;
    state.layout.selectedInstId="target";
    GymWalkthroughEditing.setMode("edit");
    GymWalkthroughEditing.setWallTool("mirror");
    let prevented=0;
    const escape={key:"Escape",preventDefault(){prevented+=1;},stopPropagation(){}};

    GymTests.equal(handleWalkthroughEscape(escape),true);
    GymTests.equal(state.layout.walkthroughOpen,true);
    GymTests.equal(state.layout.selectedInstId,"target");
    GymTests.equal(GymWalkthroughEditing.state().mode,"edit");
    GymTests.equal(GymWalkthroughEditing.state().wallTool,null);

    GymTests.equal(handleWalkthroughEscape(escape),true);
    GymTests.equal(state.layout.walkthroughOpen,false);
    GymTests.equal(state.layout.selectedInstId,"target");
    GymTests.equal(GymWalkthroughEditing.state().mode,"walk");
    GymTests.equal(prevented,2);
    GymTests.equal(renderCount(),2);
  });
});
