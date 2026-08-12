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
    const before=deepCopy(state.layout.instances);
    const success=GymWalkthroughEditing.rotateInstance("target");
    GymTests.equal(success.ok,true);
    GymTests.equal(state.layout.instances[0].rotated,true);
    GymTests.deepEqual(GymWalkthroughEditing.state().undo.instances,before);
  });

  withWalkthroughFixture({items:[item],instances:[walkthroughFixtureInstance("target",item.id,18,1)]},()=>{
    const before=deepCopy(state.layout);
    const undo=GymWalkthroughEditing.state().undo;
    const rejected=GymWalkthroughEditing.rotateInstance("target");
    GymTests.equal(rejected.ok,false);
    GymTests.equal(rejected.reason,"hard-invalid");
    GymTests.deepEqual(state.layout,before);
    GymTests.equal(GymWalkthroughEditing.state().undo,undo);
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
