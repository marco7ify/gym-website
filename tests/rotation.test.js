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
