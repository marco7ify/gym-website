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

function assertHardRotationPreservesInstance(config, expectedKind){
  withPlacementFixture(config,()=>withRotationRender(()=>{
    const target=state.layout.instances.find(instance=>instance.id==="target");
    const before=deepCopy(target);
    const result=rotateLayoutInstance90(target.id);
    GymTests.equal(result.ok,false);
    GymTests.equal(result.reason,"hard-invalid");
    GymTests.equal(result.conflict.kind,expectedKind);
    GymTests.deepEqual(state.layout.instances.find(instance=>instance.id==="target"),before);
    GymTests.equal(window.__rotationRenderCount,1);
  }));
}

GymTests.test("rotation command byte-preserves every hard conflict class",()=>{
  const target=()=>({...placementFixtureItem("item_target","Treadmill"),length:4,width:2});
  const inst=()=>placementFixtureInstance("target","item_target",4,4);
  assertHardRotationPreservesInstance({
    items:[target()],
    instances:[inst()],
    areas:[{id:"reserved",kind:"walkway",label:"Stretch lane",xFt:3.1,xIn:0,yFt:5.1,yIn:0,widthFt:.5,widthIn:0,heightFt:.5,heightIn:0}],
  },"reserved-area");
  assertHardRotationPreservesInstance({
    items:[target()],
    instances:[inst()],
    areas:[{id:"door",kind:"door",label:"Side door",xFt:2.5,xIn:0,yFt:5,yIn:0,widthFt:.5,widthIn:0,heightFt:.1,heightIn:0,doorOrientation:"horizontal",doorSwing:"down",doorHinge:"start",doorRadiusFt:2,doorRadiusIn:0,doorClearEnabled:true}],
  },"door-clearance");
  const blocker={...placementFixtureItem("item_blocker","Bench"),length:.5,width:.5};
  assertHardRotationPreservesInstance({
    items:[target(),blocker],
    instances:[inst(),placementFixtureInstance("blocker","item_blocker",3.1,5.1)],
  },"equipment-overlap");
  const edgeItem={...placementFixtureItem("item_edge","Treadmill"),length:5,width:2};
  assertHardRotationPreservesInstance({
    items:[edgeItem],
    instances:[placementFixtureInstance("target",edgeItem.id,18,1)],
  },"outside-room");
});

GymTests.test("rotation command commits a staging-only rotation and preserves its center",()=>{
  const item={...placementFixtureItem("item_staging","Staging Trainer"),length:4,width:2};
  const inst=placementFixtureInstance("target",item.id,14,4);
  withPlacementFixture({items:[item],instances:[inst]},()=>withRotationRender(()=>{
    const before=deepCopy(state.layout.instances[0]);
    const beforeDims=instanceDims(before,item);
    const result=rotateLayoutInstance90(inst.id);
    const afterDims=instanceDims(result.instance,item);
    const staging=room().staging;
    GymTests.deepEqual(result,{ok:true,reason:"rotated",instance:state.layout.instances[0]});
    GymTests.equal(rectInsideRect(effectiveRectForInst(result.instance,item).base,staging),true);
    GymTests.closeTo(instXTotalFt(before)+beforeDims.w/2,instXTotalFt(result.instance)+afterDims.w/2,1/1200);
    GymTests.closeTo(instYTotalFt(before)+beforeDims.h/2,instYTotalFt(result.instance)+afterDims.h/2,1/1200);
    GymTests.equal(window.__rotationRenderCount,1);
  }));
});

GymTests.test("rotation command rejects a staging-boundary candidate outside the allowed union",()=>{
  const item={...placementFixtureItem("item_staging_edge","Staging Trainer"),length:4,width:2};
  const inst=placementFixtureInstance("target",item.id,12.75,4);
  const conflict={kind:"outside-room",message:"Can’t rotate here — the equipment would extend outside the room."};
  withPlacementFixture({items:[item],instances:[inst]},()=>withRotationRender(()=>{
    const before=deepCopy(state.layout.instances[0]);
    const candidate=rotatedInstanceCandidate(before,item);
    GymTests.equal(rectInsideRect(effectiveRectForInst(before,item).base,room().staging),true);
    GymTests.equal(rectInsideRoom(effectiveRectForInst(candidate,item).base),false);
    GymTests.deepEqual(rotateLayoutInstance90(inst.id),{ok:false,reason:"hard-invalid",conflict});
    GymTests.deepEqual(state.layout.instances[0],before);
    GymTests.deepEqual(state.layoutActionStatus,{instId:inst.id,tone:"error",message:conflict.message});
    GymTests.equal(window.__rotationRenderCount,1);
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

GymTests.test("one SVG pointer gesture reaches the shared rotation command exactly once",()=>{
  const item={...placementFixtureItem("item_target","Treadmill"),length:5,width:2};
  const inst=placementFixtureInstance("target",item.id,4,4);
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
    const pointerdown={
      target:button,
      preventDefault(){},
      stopPropagation(){},
    };
    try{
      wireMain();
      svg.onpointerdown(pointerdown);
      button.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
    }finally{
      svg.remove();
      state.tab=previousTab;
    }
    GymTests.equal(state.layout.instances[0].rotated,true);
    GymTests.equal(window.__rotationRenderCount,1);
  }));
});

function withRotationUiFixture(config, run){
  const previousTab=state.tab;
  const previousDrag=state.drag;
  return withPlacementFixture(config,()=>{
    state.tab=config.tab || "layout";
    state.drag=config.drag || {active:false,type:null,id:null};
    state.layout.selectedInstId=config.selectedInstId || null;
    state.layout.spatialViewMode=config.spatialViewMode || "plan";
    state.layout.walkthroughOpen=!!config.walkthroughOpen;
    try{
      return run();
    }finally{
      state.tab=previousTab;
      state.drag=previousDrag;
    }
  });
}

function rotationUiFixture(){
  const item={...placementFixtureItem("item_target","Rowing Machine"),length:4,width:2};
  const inst=placementFixtureInstance("target",item.id,4,4);
  return {items:[item],instances:[inst],selectedInstId:inst.id};
}

GymTests.test("selected Plan layout renders the accessible rotation toolbar and matching live status",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture(fixture,()=>{
    state.layoutActionStatus={instId:"target",tone:"warning",message:"Rotation needs clearance."};
    const markup=layoutPanel(state.items,state.settings.currency);
    GymTests.assert(markup.includes('class="selectedEquipmentToolbar"'));
    GymTests.assert(markup.includes('data-action="rotateInst"'));
    GymTests.assert(markup.includes('aria-keyshortcuts="R"'));
    GymTests.assert(markup.includes('↻ Rotate 90°'));
    GymTests.assert(markup.includes('role="status"'));
    GymTests.assert(markup.includes('aria-live="polite"'));
    GymTests.assert(markup.includes('Rotation needs clearance.'));
  });
});

GymTests.test("selected Split layout renders the accessible rotation toolbar",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture({...fixture,spatialViewMode:"split"},()=>{
    const markup=layoutPanel(state.items,state.settings.currency);
    GymTests.assert(markup.includes('class="selectedEquipmentToolbar"'));
    GymTests.assert(markup.includes('data-action="rotateInst" data-id="target" data-focus-key="plan-toolbar-rotate:target"'));
    GymTests.assert(markup.includes('aria-keyshortcuts="R"'));
  });
});

GymTests.test("rotation toolbar is omitted without a selected item and in 3D-only mode",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture({...fixture,selectedInstId:null},()=>{
    GymTests.equal(layoutPanel(state.items,state.settings.currency).includes('selectedEquipmentToolbar'),false);
  });
  withRotationUiFixture({...fixture,spatialViewMode:"3d"},()=>{
    GymTests.equal(layoutPanel(state.items,state.settings.currency).includes('selectedEquipmentToolbar'),false);
  });
});

GymTests.test("rotation status is scoped to the selected equipment",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture(fixture,()=>{
    state.layoutActionStatus={instId:"another-instance",tone:"error",message:"Do not announce this."};
    const markup=layoutPanel(state.items,state.settings.currency);
    GymTests.equal(markup.includes('Do not announce this.'),false);
  });
});

GymTests.test("selected inspector uses the full-text native rotation button beside Remove",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture(fixture,()=>{
    const markup=selectedEquipmentPanel(state.layout.instances[0]);
    GymTests.assert(markup.includes('class="planRotateBtn" data-action="rotateInst" data-id="target" data-focus-key="inspector-rotate:target" aria-keyshortcuts="R"'));
    GymTests.assert(markup.includes('↻ Rotate 90° <kbd>R</kbd>'));
    GymTests.equal(markup.includes('>Rotate</button>'),false);
  });
});

GymTests.test("selected SVG rotate affordance is keyboard-accessible",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture(fixture,()=>{
    const markup=layoutPanel(state.items,state.settings.currency);
    GymTests.assert(markup.includes('class="instQuickRotate" data-action="rotateInst" data-id="target" role="button" tabindex="0" aria-label="Rotate 90°"'));
    GymTests.assert(markup.includes('<title>Rotate 90°</title>'));
  });
});

GymTests.test("Plan and Split render distinct stable focus identities for duplicate Rotate buttons",()=>{
  const fixture=rotationUiFixture();
  ["plan","split"].forEach(spatialViewMode=>withRotationUiFixture({...fixture,spatialViewMode},()=>{
    const holder=document.createElement("div");
    holder.innerHTML=layoutPanel(state.items,state.settings.currency);
    document.body.appendChild(holder);
    try{
      const inspector=holder.querySelector(".selectedEquipmentHeaderActions .planRotateBtn");
      const toolbar=holder.querySelector(".selectedEquipmentToolbar .planRotateBtn");
      GymTests.assert(!!inspector,`${spatialViewMode} inspector Rotate button`);
      GymTests.assert(!!toolbar,`${spatialViewMode} toolbar Rotate button`);
      GymTests.assert(!!inspector.dataset.focusKey,`${spatialViewMode} inspector focus key`);
      GymTests.assert(!!toolbar.dataset.focusKey,`${spatialViewMode} toolbar focus key`);
      GymTests.equal(inspector.dataset.focusKey===toolbar.dataset.focusKey,false,`${spatialViewMode} focus keys differ`);
    }finally{
      holder.remove();
    }
  }));
});

GymTests.test("each duplicate Rotate button restores focus to its own rendered control",()=>{
  const fixture=rotationUiFixture();
  const holder=document.createElement("div");
  withRotationUiFixture(fixture,()=>{
    holder.innerHTML=layoutPanel(state.items,state.settings.currency);
    document.body.appendChild(holder);
    try{
      [
        ".selectedEquipmentHeaderActions .planRotateBtn",
        ".selectedEquipmentToolbar .planRotateBtn",
      ].forEach(selector=>{
        const before=holder.querySelector(selector);
        before.focus();
        const focus=captureFocus();
        holder.innerHTML=layoutPanel(state.items,state.settings.currency);
        restoreFocus(focus);
        GymTests.equal(document.activeElement,holder.querySelector(selector),selector);
      });
    }finally{
      holder.remove();
    }
  });
});

function rotationShortcutEvent(overrides={}){
  return {code:"KeyR",repeat:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,...overrides};
}

function withRotationShortcutState(config, run){
  const fixture=rotationUiFixture();
  return withRotationUiFixture({...fixture,...config},run);
}

GymTests.test("layout rotation shortcut is allowed on the page in Plan and Split",()=>{
  withRotationShortcutState({spatialViewMode:"plan"},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),true);
  });
  withRotationShortcutState({spatialViewMode:"split"},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),true);
  });
});

GymTests.test("layout rotation shortcut rejects unsafe keyboard contexts",()=>{
  const cases=[
    {name:"repeated key",event:rotationShortcutEvent({repeat:true})},
    {name:"Alt modifier",event:rotationShortcutEvent({altKey:true})},
    {name:"Control modifier",event:rotationShortcutEvent({ctrlKey:true})},
    {name:"Meta modifier",event:rotationShortcutEvent({metaKey:true})},
    {name:"Shift modifier",event:rotationShortcutEvent({shiftKey:true})},
    {name:"different key",event:rotationShortcutEvent({code:"KeyQ"})},
  ];
  withRotationShortcutState({},()=>{
    cases.forEach(({event,name})=>GymTests.equal(layoutRotationShortcutAllowed(event,document.body),false,name));
  });
  withRotationShortcutState({tab:"dashboard"},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
  });
  withRotationShortcutState({selectedInstId:null},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
  });
  withRotationShortcutState({spatialViewMode:"3d"},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
  });
  withRotationShortcutState({drag:{active:true,type:"inst",id:"target"}},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
  });
  withRotationShortcutState({walkthroughOpen:true},()=>{
    GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
  });
});

GymTests.test("layout rotation shortcut rejects editing targets, dialogs, and pointer lock",()=>{
  const targets=["input","textarea","select","div"];
  withRotationShortcutState({},()=>{
    targets.forEach(tag=>{
      const target=document.createElement(tag);
      if(tag==="div") target.contentEditable="true";
      document.body.appendChild(target);
      try{
        GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),target),false,tag);
      }finally{
        target.remove();
      }
    });

    const dialog=document.createElement("dialog");
    dialog.open=true;
    document.body.appendChild(dialog);
    try{
      GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
    }finally{
      dialog.remove();
    }

    const previousPointerLock=Object.getOwnPropertyDescriptor(document,"pointerLockElement");
    Object.defineProperty(document,"pointerLockElement",{configurable:true,value:document.body});
    try{
      GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false);
    }finally{
      if(previousPointerLock) Object.defineProperty(document,"pointerLockElement",previousPointerLock);
      else delete document.pointerLockElement;
    }
  });
});

GymTests.test("rotation shortcut listener remains singleton through ten layout renders",()=>{
  const originalAddEventListener=window.addEventListener;
  const previousWired=window.__layoutRotationShortcutWired;
  let keydownListeners=0;
  window.__layoutRotationShortcutWired=false;
  window.addEventListener=(type,...args)=>{
    if(type==="keydown") keydownListeners+=1;
  };
  try{
    withRotationShortcutState({},()=>{
      for(let renderPass=0;renderPass<10;renderPass+=1){
        layoutPanel(state.items,state.settings.currency);
        wireLayoutRotationShortcut();
      }
      GymTests.equal(keydownListeners,1);
    });
  }finally{
    window.addEventListener=originalAddEventListener;
    window.__layoutRotationShortcutWired=previousWired;
  }
});

function withOpenAppDialog(kind, run){
  const modal=document.createElement("div");
  if(kind==="import-batch"){
    modal.className="modalOverlay";
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
  }else{
    modal.className="lightbox open";
    modal.setAttribute("aria-hidden","false");
    modal.innerHTML='<div class="lightbox-inner" role="dialog" aria-modal="true"></div>';
  }
  document.body.appendChild(modal);
  try{
    return run();
  }finally{
    modal.remove();
  }
}

GymTests.test("layout rotation shortcut recognizes the app's open dialog surfaces",()=>{
  withRotationShortcutState({},()=>{
    ["image-lightbox","export-modal","import-batch"].forEach(kind=>{
      withOpenAppDialog(kind,()=>{
        GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),false,kind);
      });
    });

    const closed=document.createElement("div");
    closed.className="lightbox";
    closed.setAttribute("aria-hidden","true");
    closed.innerHTML='<div class="lightbox-inner" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(closed);
    try{
      GymTests.equal(layoutRotationShortcutAllowed(rotationShortcutEvent(),document.body),true);
    }finally{
      closed.remove();
    }
  });
});

GymTests.test("rotation listener leaves R unhandled while an app lightbox is open",()=>{
  const fixture=rotationUiFixture();
  withRotationUiFixture(fixture,()=>withRotationRender(()=>{
    const before=deepCopy(state.layout.instances[0]);
    withOpenAppDialog("image-lightbox",()=>{
      const event=new KeyboardEvent("keydown",{code:"KeyR",bubbles:true,cancelable:true});
      window.dispatchEvent(event);
      GymTests.deepEqual(state.layout.instances[0],before);
      GymTests.equal(event.defaultPrevented,false);
    });
  }));
});
