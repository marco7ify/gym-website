function placementFixtureItem(id, name){
  return {
    ...deepCopy(DEFAULT_ITEM),
    id,
    name,
    unit:"ft",
    length:2,
    width:2,
    height:7,
  };
}

function placementFixtureInstance(id, itemId, xFt, yFt){
  return {
    id,
    itemId,
    xFt,
    xIn:0,
    yFt,
    yIn:0,
    rotated:false,
    deadspaceFt:null,
    deadspaceIn:0,
    deadspaceSides:null,
    __invalid:false,
  };
}

function withPlacementFixture(config, run){
  const hadRoomCache=Object.prototype.hasOwnProperty.call(state,"_roomCache");
  const hadActionStatus=Object.prototype.hasOwnProperty.call(state,"layoutActionStatus");
  const previous={
    layout:state.layout,
    settings:state.settings,
    items:state.items,
    roomCache:state._roomCache,
    actionStatus:state.layoutActionStatus,
  };

  try{
    state.settings={
      ...deepCopy(DEFAULT_SETTINGS),
      roomLengthFt:20,
      roomLengthIn:0,
      roomWidthFt:12,
      roomWidthIn:0,
      reservedAreaKindsBlockPlacement:["walkway","door","garagedoor","nogospace","cutout"],
      ...(config.settings||{}),
    };
    state.items=deepCopy(config.items||[]);
    state.layout={
      ...deepCopy(DEFAULT_LAYOUT),
      instances:deepCopy(config.instances||[]),
      areas:deepCopy(config.areas||[]),
      wallExtensions:[],
      stagingSize:"small",
    };
    state._roomCache=null;
    return run();
  }finally{
    state.layout=previous.layout;
    state.settings=previous.settings;
    state.items=previous.items;
    if(hadRoomCache) state._roomCache=previous.roomCache;
    else delete state._roomCache;
    if(hadActionStatus) state.layoutActionStatus=previous.actionStatus;
    else delete state.layoutActionStatus;
  }
}

GymTests.test("reports outside-room hard conflict",()=>{
  withPlacementFixture({},()=>{
    GymTests.deepEqual(
      hardPlacementConflict("target",{x:-.1,y:1,w:2,h:2}),
      {kind:"outside-room",message:"Can’t rotate here — the equipment would extend outside the room."}
    );
  });
});

GymTests.test("boolean hard validation delegates to conflict details",()=>{
  withPlacementFixture({},()=>{
    GymTests.equal(isHardInvalidPlacement("target",{x:-.1,y:1,w:2,h:2}),true);
  });
});

GymTests.test("reports the first reserved-area body conflict",()=>{
  const blocker=placementFixtureItem("item_blocker","Power Rack");
  withPlacementFixture({
    items:[blocker],
    instances:[placementFixtureInstance("inst_blocker",blocker.id,4,4)],
    areas:[{
      id:"area_reserved",
      kind:"walkway",
      label:"Stretch lane",
      xFt:4,
      xIn:0,
      yFt:4,
      yIn:0,
      widthFt:2,
      widthIn:0,
      heightFt:2,
      heightIn:0,
    }],
  },()=>{
    GymTests.deepEqual(
      hardPlacementConflict("target",{x:4.5,y:4.5,w:1,h:1}),
      {kind:"reserved-area",areaId:"area_reserved",message:"Can’t rotate here — it would overlap Stretch lane."}
    );
  });
});

GymTests.test("reports door clearance before equipment overlap",()=>{
  const blocker=placementFixtureItem("item_blocker","Power Rack");
  withPlacementFixture({
    items:[blocker],
    instances:[placementFixtureInstance("inst_blocker",blocker.id,3,3)],
    areas:[{
      id:"door_main",
      kind:"door",
      label:"Main door",
      xFt:2,
      xIn:0,
      yFt:2,
      yIn:0,
      widthFt:3,
      widthIn:0,
      heightFt:.5,
      heightIn:0,
      doorOrientation:"horizontal",
      doorSwing:"down",
      doorHinge:"start",
      doorRadiusFt:3,
      doorRadiusIn:0,
      doorClearEnabled:true,
    }],
  },()=>{
    GymTests.deepEqual(
      hardPlacementConflict("target",{x:3,y:3,w:1,h:1}),
      {kind:"door-clearance",areaId:"door_main",message:"Can’t rotate here — it would block the clearance for Main door."}
    );
  });
});

GymTests.test("reports the first equipment-body overlap",()=>{
  const first=placementFixtureItem("item_first","Power Rack");
  const second=placementFixtureItem("item_second","Cable Machine");
  withPlacementFixture({
    items:[first,second],
    instances:[
      placementFixtureInstance("inst_first",first.id,4,4),
      placementFixtureInstance("inst_second",second.id,4,4),
    ],
  },()=>{
    GymTests.deepEqual(
      hardPlacementConflict("target",{x:4.5,y:4.5,w:1,h:1}),
      {
        kind:"equipment-overlap",
        instanceId:"inst_first",
        itemId:"item_first",
        message:"Can’t rotate here — it would overlap Power Rack.",
      }
    );
  });
});

GymTests.test("staging exempts reserved-area and equipment overlap",()=>{
  const blocker=placementFixtureItem("item_blocker","Power Rack");
  withPlacementFixture({
    items:[blocker],
    instances:[placementFixtureInstance("inst_blocker",blocker.id,13,1)],
    areas:[{
      id:"area_staging",
      kind:"walkway",
      label:"Staging lane",
      xFt:13,
      xIn:0,
      yFt:1,
      yIn:0,
      widthFt:2,
      widthIn:0,
      heightFt:2,
      heightIn:0,
    }],
  },()=>{
    const candidate={x:13,y:1,w:2,h:2};
    GymTests.equal(hardPlacementConflict("target",candidate),null);
    GymTests.equal(isHardInvalidPlacement("target",candidate),false);
  });
});

GymTests.test("returns null for a clean placement",()=>{
  withPlacementFixture({},()=>{
    const candidate={x:8,y:10,w:2,h:2};
    GymTests.equal(hardPlacementConflict("target",candidate),null);
    GymTests.equal(isHardInvalidPlacement("target",candidate),false);
  });
});

GymTests.test("honors disabled reserved-area blocking",()=>{
  withPlacementFixture({
    settings:{reservedAreaKindsBlockPlacement:[]},
    areas:[{
      id:"area_allowed",
      kind:"walkway",
      label:"Allowed lane",
      xFt:4,
      xIn:0,
      yFt:4,
      yIn:0,
      widthFt:2,
      widthIn:0,
      heightFt:2,
      heightIn:0,
    }],
  },()=>{
    GymTests.equal(hardPlacementConflict("target",{x:4.5,y:4.5,w:1,h:1}),null);
  });
});

GymTests.test("keeps layout action status outside persisted layout state",()=>{
  GymTests.equal(state.layoutActionStatus,null);
  GymTests.equal(Object.prototype.hasOwnProperty.call(DEFAULT_LAYOUT,"layoutActionStatus"),false);
  GymTests.equal(Object.prototype.hasOwnProperty.call(state.layout,"layoutActionStatus"),false);
});

GymTests.test("rotation candidate preserves center",()=>{
  const item={unit:"ft",length:5.825,width:3.175,height:6.1083};
  const inst={id:"x16",itemId:"x16-item",xFt:6.5,xIn:0,yFt:0,yIn:0,rotated:true};
  const before=instanceDims(inst,item);
  const next=rotatedInstanceCandidate(inst,item);
  const after=instanceDims(next,item);
  GymTests.closeTo(instXTotalFt(inst)+before.w/2,instXTotalFt(next)+after.w/2,1/1200);
  GymTests.closeTo(instYTotalFt(inst)+before.h/2,instYTotalFt(next)+after.h/2,1/1200);
});

GymTests.test("four rotation candidates return to the original position and orientation",()=>{
  const item={unit:"ft",length:5.825,width:3.175,height:6.1083};
  const inst={id:"x16",itemId:"x16-item",xFt:6.5,xIn:0,yFt:0,yIn:0,rotated:true};
  let next=inst;
  for(let i=0;i<4;i+=1) next=rotatedInstanceCandidate(next,item);
  GymTests.closeTo(instXTotalFt(next),instXTotalFt(inst),1/1200);
  GymTests.closeTo(instYTotalFt(next),instYTotalFt(inst),1/1200);
  GymTests.equal(next.rotated,inst.rotated);
});

function withRotationRender(run){
  const previousRender=window.render;
  window.__rotationRenderCount=0;
  window.render=()=>{ window.__rotationRenderCount=(window.__rotationRenderCount||0)+1; };
  try{
    return run();
  }finally{
    window.render=previousRender;
  }
}

GymTests.test("rotation command reports a missing instance and renders once",()=>{
  withPlacementFixture({},()=>withRotationRender(()=>{
    GymTests.deepEqual(rotateLayoutInstance90("missing"),{ok:false,reason:"not-found"});
    GymTests.equal(window.__rotationRenderCount,1);
    GymTests.deepEqual(state.layoutActionStatus,{
      instId:"missing",
      tone:"error",
      message:"That equipment is no longer in this layout.",
    });
  }));
});

GymTests.test("rotation command preserves a hard-invalid instance and renders once",()=>{
  const item={...placementFixtureItem("item_target","Treadmill"),length:5,width:2};
  const inst=placementFixtureInstance("target",item.id,18,1);
  withPlacementFixture({items:[item],instances:[inst]},()=>withRotationRender(()=>{
    const before=deepCopy(state.layout.instances[0]);
    const conflict={kind:"outside-room",message:"Can’t rotate here — the equipment would extend outside the room."};
    GymTests.deepEqual(rotateLayoutInstance90(inst.id),{ok:false,reason:"hard-invalid",conflict});
    GymTests.deepEqual(state.layout.instances[0],before);
    GymTests.equal(window.__rotationRenderCount,1);
    GymTests.deepEqual(state.layoutActionStatus,{instId:inst.id,tone:"error",message:conflict.message});
  }));
});

GymTests.test("rotation command keeps a soft conflict as an invalid rotated instance",()=>{
  const target={...placementFixtureItem("item_target","Cable Machine"),length:4,width:2};
  const blocker=placementFixtureItem("item_blocker","Bench");
  const inst=placementFixtureInstance("target",target.id,4,4);
  withPlacementFixture({
    items:[target,blocker],
    instances:[inst,placementFixtureInstance("blocker",blocker.id,8,5)],
  },()=>withRotationRender(()=>{
    const result=rotateLayoutInstance90(inst.id);
    GymTests.equal(result.ok,true);
    GymTests.equal(result.reason,"soft-conflict");
    GymTests.equal(result.instance.__invalid,true);
    GymTests.equal(state.layout.instances[0].__invalid,true);
    GymTests.equal(window.__rotationRenderCount,1);
    GymTests.deepEqual(state.layoutActionStatus,{
      instId:inst.id,
      tone:"warning",
      message:"Rotated 90°. Clearance overlaps another item, so it is shown in red.",
    });
  }));
});

GymTests.test("rotation command returns a valid center-preserving rotated instance",()=>{
  const item={...placementFixtureItem("item_target","Rowing Machine"),length:4,width:2};
  const inst=placementFixtureInstance("target",item.id,4,4);
  withPlacementFixture({items:[item],instances:[inst]},()=>withRotationRender(()=>{
    const result=rotateLayoutInstance90(inst.id);
    GymTests.equal(result.ok,true);
    GymTests.equal(result.reason,"rotated");
    GymTests.equal(result.instance.__invalid,false);
    GymTests.equal(result.instance.rotated,true);
    GymTests.closeTo(instXTotalFt(result.instance),3,1/1200);
    GymTests.closeTo(instYTotalFt(result.instance),5,1/1200);
    GymTests.equal(window.__rotationRenderCount,1);
    GymTests.deepEqual(state.layoutActionStatus,{
      instId:inst.id,
      tone:"success",
      message:"Rotated Rowing Machine 90°.",
    });
  }));
});

GymTests.test("delegated rotate click uses the guarded rotation command",()=>{
  const item={...placementFixtureItem("item_target","Treadmill"),length:5,width:2};
  const inst=placementFixtureInstance("target",item.id,18,1);
  withPlacementFixture({items:[item],instances:[inst]},()=>withRotationRender(()=>{
    wireMain();
    const button=document.createElement("button");
    button.dataset.action="rotateInst";
    button.dataset.id=inst.id;
    document.body.appendChild(button);
    try{
      document.body.onclick({target:button});
    }finally{
      button.remove();
    }
    GymTests.equal(state.layout.instances[0].rotated,false);
    GymTests.equal(window.__rotationRenderCount,1);
  }));
});

GymTests.test("SVG rotate pointer uses the guarded rotation command once",()=>{
  const item={...placementFixtureItem("item_target","Treadmill"),length:5,width:2};
  const inst=placementFixtureInstance("target",item.id,18,1);
  const previousTab=state.tab;
  withPlacementFixture({items:[item],instances:[inst]},()=>withRotationRender(()=>{
    state.tab="layout";
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.id="layoutSvg";
    const button=document.createElementNS("http://www.w3.org/2000/svg","g");
    button.dataset.action="rotateInst";
    button.dataset.id=inst.id;
    svg.appendChild(button);
    document.body.appendChild(svg);
    const event={
      target:button,
      prevented:false,
      stopped:false,
      preventDefault(){ this.prevented=true; },
      stopPropagation(){ this.stopped=true; },
    };
    try{
      wireMain();
      svg.onpointerdown(event);
    }finally{
      svg.remove();
      state.tab=previousTab;
    }
    GymTests.equal(event.prevented,true);
    GymTests.equal(event.stopped,true);
    GymTests.equal(state.layout.instances[0].rotated,false);
    GymTests.equal(window.__rotationRenderCount,1);
  }));
});
