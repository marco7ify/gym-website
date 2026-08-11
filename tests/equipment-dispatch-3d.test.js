(function(){
  "use strict";

  const dedicatedProfiles=[
    "brightway-hs08-row","gazelle-pro","ice-barrel-500","maxwell-903bh",
    "nordictrack-x16","ritfit-gator-bench","rx3-compact-smith",
    "shizhuo-seated-standing-row","syedee-stair-machine",
    "wanjia-combo-adductor","yindun-three-tier-rack",
  ];

  const dedicatedItems=[
    {id:"ice",brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge",width:2.5583,length:4.8,height:3.5},
    {id:"stair",brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning",width:2.6667,length:4.1667,height:6.8333},
    {id:"x16",brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning",width:3.175,length:5.825,height:6.1083},
    {id:"gator",brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches",width:2.1667,length:4.8333,height:4.4167},
    {id:"hs08",brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper",width:2.82,length:4.2,height:6.28},
    {id:"shizhuo",brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper",width:3.67,length:5.21,height:4.18},
    {id:"wanjia",brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",width:2.38,length:4.99,height:4.61},
    {id:"yindun",brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage",width:2.22,length:5.58,height:3.24},
    {id:"rx3",brand:"Get RX'd",name:"RX3 Tornado Compact Smith Machine",category:"Strength",width:6,length:5,height:7.5},
    {id:"maxwell",brand:"SalusHEAT",name:"Maxwell-903BH infrared sauna",category:"Sauna",width:5,length:4,height:7.5},
    {id:"gazelle",brand:"RitFit",name:"Gazelle Pro 3-in-1 Leg Press",category:"Leg Press",width:4,length:5,height:5},
  ];

  function fixtureSettings(){
    return {
      ...DEFAULT_SETTINGS,
      roomWidthFt:36,
      roomWidthIn:0,
      roomLengthFt:28,
      roomLengthIn:0,
      ceilingHeightFt:10,
      ceilingHeightIn:0,
    };
  }

  function createEquipmentDispatchFixture({items=dedicatedItems,instances=null,settings=null}={}){
    state.settings=settings || fixtureSettings();
    state.items=items.map(item=>normalizeItemRecord({...item,unit:"ft"}));
    state.layout=normalizeLayout({
      ...deepCopy(DEFAULT_LAYOUT),
      spatial3d:{...DEFAULT_LAYOUT.spatial3d,walls:false,labelMode:"off",clearances:false},
      instances:instances || state.items.map((item,index)=>({
        id:`inst_${item.id}`,
        itemId:item.id,
        xFt:(index%4)*8,
        xIn:0,
        yFt:Math.floor(index/4)*8,
        yIn:0,
        rotated:index===4 || index===5,
      })),
    },state.settings);
    state.activeLayoutId="equipment-dispatch-test";
    state._roomCache=null;
    const host=document.createElement("div");
    host.className="gym3dFixture";
    host.dataset.gym3d="preview";
    host.innerHTML='<canvas data-gym3d-minimap width="200" height="120"></canvas><div data-gym3d-warnings></div>';
    document.body.appendChild(host);
    const view=new Gym3DView(host,"preview");
    return {host,view,destroy(){ view.destroy(); host.remove(); }};
  }

  function groupMeshes(group){
    const meshes=[];
    group.traverse(object=>{if(object.isMesh) meshes.push(object);});
    return meshes;
  }

  function assertNear(actual,expected,message){
    GymTests.assert(Math.abs(actual-expected)<=.001,`${message}: expected ${expected}, received ${actual}`);
  }

  GymTests.test("keeps semantic metadata and interaction targets on every model primitive",()=>{
    const fixture=createEquipmentDispatchFixture({items:[],instances:[]});
    try{
      const {view}=fixture;
      const group=new THREE.Group();
      const material=view.material({color:0xffffff});
      const options={instId:"semantic",partTag:"probe-part",side:"left",partIndex:2};
      const polygon=[
        {x:.46,y:.035},{x:.46,y:.16},{x:.27,y:.18},
        {x:-.27,y:.61},{x:-.43,y:.61},{x:-.43,y:.035},
      ];
      const primitives=[
        view.box(group,{x:.1,y:.1,z:.1},{x:0,y:0,z:0},material,options),
        view.cylinder(group,.05,.1,{x:0,y:0,z:0},material,options),
        view.beam(group,{x:0,y:0,z:0},{x:0,y:.1,z:0},.05,.05,material,options),
        view.tube(group,{x:0,y:0,z:0},{x:0,y:.1,z:0},.05,material,options),
      ];
      const panel=view.extrudedPanel(group,polygon,.08,{x:0,y:0,z:0},material,options);
      primitives.concat(panel).forEach(mesh=>{
        GymTests.deepEqual(mesh.userData,{instId:"semantic",partTag:"probe-part",side:"left",partIndex:2});
        GymTests.assert(view.clickTargets.includes(mesh));
      });
      GymTests.equal(panel.userData.partTag,"probe-part");
      GymTests.equal(panel.userData.side,"left");
      GymTests.equal(panel.userData.partIndex,2);
      GymTests.assert(view.clickTargets.includes(panel));
      GymTests.assert(view.disposables.includes(panel.geometry));
    }finally{ fixture.destroy(); }
  });

  function frameFocus(group){
    const footprint=group.userData.worldFootprint;
    return {
      x:group.position.x,
      y:Math.min(footprint.heightFt*.43,10*.38),
      z:group.position.z,
    };
  }

  function segmentHitsRect(start,end,rect){
    const dx=end.x-start.x, dz=end.z-start.z;
    let enter=0, exit=1;
    [[start.x,dx,rect.minX,rect.maxX],[start.z,dz,rect.minZ,rect.maxZ]].forEach(([origin,delta,min,max])=>{
      if(Math.abs(delta)<1e-8){
        if(origin<min || origin>max){ enter=1; exit=0; }
        return;
      }
      const a=(min-origin)/delta, b=(max-origin)/delta;
      enter=Math.max(enter,Math.min(a,b));
      exit=Math.min(exit,Math.max(a,b));
    });
    return enter<=exit;
  }

  function cameraBlockedByOtherEquipment(view,target){
    const focus=frameFocus(target);
    const radius=view.orbit.radius*Math.sin(view.orbit.phi);
    const camera={
      x:focus.x+radius*Math.sin(view.orbit.theta),
      z:focus.z+radius*Math.cos(view.orbit.theta),
    };
    return [...view.itemGroups.values()].some(group=>{
      if(group===target) return false;
      const footprint=group.userData.worldFootprint;
      const rect={
        minX:group.position.x-footprint.widthFt/2,
        maxX:group.position.x+footprint.widthFt/2,
        minZ:group.position.z-footprint.depthFt/2,
        maxZ:group.position.z+footprint.depthFt/2,
      };
      return (camera.x>=rect.minX && camera.x<=rect.maxX && camera.z>=rect.minZ && camera.z<=rect.maxZ)
        || segmentHitsRect(camera,focus,rect);
    });
  }

  function framePathStaysInsideRoom(view,target){
    const focus=frameFocus(target);
    const reach=view.orbit.radius*Math.sin(view.orbit.phi);
    const camera={
      x:focus.x+reach*Math.sin(view.orbit.theta),
      z:focus.z+reach*Math.cos(view.orbit.theta),
    };
    for(let step=0;step<=24;step++){
      const t=step/24;
      if(!pointInRoom(camera.x+(focus.x-camera.x)*t,camera.z+(focus.z-camera.z)*t,view.roomData.rects)) return false;
    }
    return true;
  }

  function framePathHasRoomClearance(view,target,clearance=.22){
    const focus=frameFocus(target);
    const reach=view.orbit.radius*Math.sin(view.orbit.phi);
    const camera={
      x:focus.x+reach*Math.sin(view.orbit.theta),
      z:focus.z+reach*Math.cos(view.orbit.theta),
    };
    const offsets=[[0,0],[clearance,0],[-clearance,0],[0,clearance],[0,-clearance]];
    for(let step=0;step<=24;step++){
      const t=step/24;
      const x=camera.x+(focus.x-camera.x)*t;
      const z=camera.z+(focus.z-camera.z)*t;
      if(!offsets.every(([dx,dz])=>pointInRoom(x+dx,z+dz,view.roomData.rects))) return false;
    }
    return true;
  }

  GymTests.test("rejects a camera path crossing a narrow gap in a concave room union",()=>{
    const roomRects=[
      {x:0,y:0,w:5.2,h:1},
      {x:5.22,y:0,w:4.78,h:1},
    ];
    GymTests.equal(
      segmentCoveredByRoomRects({x:.5,z:.5},{x:9.5,z:.5},roomRects),
      false,
      "A sub-sample-width gap must not be treated as an uninterrupted room path",
    );
  });

  GymTests.test("accepts a camera path crossing a shared room-extension seam",()=>{
    GymTests.equal(
      segmentCoveredByRoomRects(
        {x:.5,z:.5},
        {x:9.5,z:.5},
        [{x:0,y:0,w:5,h:1},{x:5,y:0,w:5,h:1}],
      ),
      true,
      "Touching room rectangles must provide uninterrupted path coverage",
    );
  });

  GymTests.test("frames saved perimeter Yindun from an in-room clear full-density path",()=>{
    const instances=[
      {id:"saved_ice",itemId:"ice",xFt:0,xIn:0,yFt:9,yIn:0,rotated:false},
      {id:"saved_stair",itemId:"stair",xFt:0,xIn:0,yFt:0,yIn:0,rotated:true},
      {id:"saved_x16",itemId:"x16",xFt:6.5,xIn:0,yFt:0,yIn:0,rotated:true},
      {id:"saved_gator",itemId:"gator",xFt:3,xIn:0,yFt:4,yIn:0,rotated:true},
      {id:"saved_hs08",itemId:"hs08",xFt:15,xIn:0,yFt:3.5,yIn:0,rotated:true},
      {id:"saved_shizhuo",itemId:"shizhuo",xFt:14,xIn:0,yFt:7,yIn:0,rotated:true},
      {id:"saved_wanjia",itemId:"wanjia",xFt:7.5,xIn:0,yFt:14.51,yIn:0,rotated:false},
      {id:"saved_yindun",itemId:"yindun",xFt:0,xIn:0,yFt:3,yIn:0,rotated:false},
    ];
    const settings={...fixtureSettings(),roomWidthFt:19.8,roomLengthFt:19.5};
    const fixture=createEquipmentDispatchFixture({items:dedicatedItems.slice(0,8),instances,settings});
    try{
      const target=fixture.view.itemGroups.get("saved_yindun");
      state.layout.selectedInstId="saved_yindun";
      fixture.view.frameSelected();
      GymTests.equal(framePathHasRoomClearance(fixture.view,target),true,"Saved perimeter Yindun frame must retain clearance from room walls");
      GymTests.equal(cameraBlockedByOtherEquipment(fixture.view,target),false,"Saved perimeter Yindun frame must avoid other measured equipment footprints");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("keeps the full saved Stair Machine visible when framing near a room corner",()=>{
    const instances=[
      {id:"saved_ice",itemId:"ice",xFt:0,xIn:0,yFt:9,yIn:0,rotated:false},
      {id:"saved_stair",itemId:"stair",xFt:0,xIn:0,yFt:0,yIn:0,rotated:true},
      {id:"saved_x16",itemId:"x16",xFt:6.5,xIn:0,yFt:0,yIn:0,rotated:true},
      {id:"saved_gator",itemId:"gator",xFt:3,xIn:0,yFt:4,yIn:0,rotated:true},
      {id:"saved_hs08",itemId:"hs08",xFt:15,xIn:0,yFt:3.5,yIn:0,rotated:true},
      {id:"saved_shizhuo",itemId:"shizhuo",xFt:14,xIn:0,yFt:7,yIn:0,rotated:true},
      {id:"saved_wanjia",itemId:"wanjia",xFt:7.5,xIn:0,yFt:14.51,yIn:0,rotated:false},
      {id:"saved_yindun",itemId:"yindun",xFt:0,xIn:0,yFt:3,yIn:0,rotated:false},
    ];
    const settings={...fixtureSettings(),roomWidthFt:19.8,roomLengthFt:19.5};
    const fixture=createEquipmentDispatchFixture({items:dedicatedItems.slice(0,8),instances,settings});
    try{
      state.layout.selectedInstId="saved_stair";
      fixture.view.frameSelected();
      GymTests.assert(fixture.view.orbit.radius>=7.5,`Tall equipment must keep a full-machine framing distance; received ${fixture.view.orbit.radius}`);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("keeps a boundary equipment frame camera and sightline inside room walls",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[0]],instances:[{
      id:"inst_ice",itemId:"ice",xFt:0,xIn:0,yFt:0,yIn:0,rotated:false,
    }]});
    try{
      const target=fixture.view.itemGroups.get("inst_ice");
      state.layout.selectedInstId="inst_ice";
      fixture.view.frameSelected();
      GymTests.equal(framePathStaysInsideRoom(fixture.view,target),true,"Selected-frame camera and its sightline must not cross a room wall");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("preserves the established front-oblique angle when an equipment selection is unobstructed",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[0]],instances:[{
      id:"inst_ice",itemId:"ice",xFt:12,xIn:0,yFt:9,yIn:0,rotated:false,
    }]});
    try{
      const target=fixture.view.itemGroups.get("inst_ice");
      state.layout.selectedInstId="inst_ice";
      fixture.view.frameSelected();
      GymTests.assert(Math.abs(fixture.view.orbit.theta-(Math.PI+.16))<.001,"Expected the established local-front oblique camera angle");
      GymTests.equal(cameraBlockedByOtherEquipment(fixture.view,target),false);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("leaves the camera unchanged when every room-valid equipment frame is obstructed",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[0]],instances:[
      {id:"inst_ice",itemId:"ice",xFt:16,xIn:6,yFt:11,yIn:6,rotated:false},
    ]});
    try{
      const obstruction=new THREE.Group();
      obstruction.position.set(18,0,14);
      obstruction.userData.worldFootprint={widthFt:35,depthFt:27,heightFt:1};
      fixture.view.itemGroups.set("full-room-obstruction",obstruction);
      const before={...fixture.view.orbit};
      const targetBefore=fixture.view.target.toArray();
      const positionBefore=fixture.view.camera.position.toArray();
      const quaternionBefore=fixture.view.camera.quaternion.toArray();
      const framedBefore=fixture.host.dataset.framedSelected||"";
      state.layout.selectedInstId="inst_ice";
      fixture.view.frameSelected();
      GymTests.deepEqual(fixture.view.orbit,before,"An obstructed framing request must preserve the current camera orbit");
      GymTests.deepEqual(fixture.view.target.toArray(),targetBefore,"An obstructed framing request must preserve the camera target");
      GymTests.deepEqual(fixture.view.camera.position.toArray(),positionBefore,"An obstructed framing request must preserve the camera position");
      GymTests.deepEqual(fixture.view.camera.quaternion.toArray(),quaternionBefore,"An obstructed framing request must preserve the camera orientation");
      GymTests.equal(fixture.host.dataset.framedSelected||"",framedBefore,"An obstructed request must not report a successful frame");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("frames the saved dense Ice and Yindun placements from a clear front-oblique path",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[0],dedicatedItems[7]],instances:[
      {id:"inst_ice",itemId:"ice",xFt:0,xIn:0,yFt:9,yIn:0,rotated:false},
      {id:"inst_yindun",itemId:"yindun",xFt:0,xIn:0,yFt:3,yIn:0,rotated:false},
    ]});
    try{
      const target=fixture.view.itemGroups.get("inst_ice");
      state.layout.selectedInstId="inst_ice";
      fixture.view.frameSelected();
      const focus=frameFocus(target);
      const defaultView={itemGroups:fixture.view.itemGroups,orbit:{...fixture.view.orbit,theta:Math.PI+.16}};
      GymTests.equal(cameraBlockedByOtherEquipment(defaultView,target),true,"Saved Yindun placement must obstruct Ice's normal front-oblique ray");
      GymTests.assert(Math.abs(fixture.view.orbit.theta-(Math.PI+.16))>.001,"Blocked default camera must select a different candidate");
      GymTests.assert(Math.abs(fixture.view.orbit.theta-Math.PI)<1.12,"Fallback must remain in Ice's front-side hemisphere");
      GymTests.equal(cameraBlockedByOtherEquipment(fixture.view,target),false);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("stages known and unknown dedicated dispatch without bypassing the real Three view",()=>{
    const fixture=createEquipmentDispatchFixture();
    try{
      const {view}=fixture;
      const hostGroup=new THREE.Group();
      const item=getItemById("ice");
      const known=view.tryBuildDedicatedEquipmentModel(hostGroup,{id:"known"},item,{w:2.5583,h:4.8},3.5,"ice-barrel-500");
      GymTests.equal(known.built,true);
      GymTests.equal(known.builderKey,"ice-barrel-500");
      GymTests.equal(known.modelType,"photo-matched Ice Barrel 500");
      GymTests.equal(known.root.parent,hostGroup);
      GymTests.assert(groupMeshes(known.root).length>0,"Known dispatch should attach visible staged meshes");

      const unknown=view.tryBuildDedicatedEquipmentModel(hostGroup,{id:"unknown"},item,{w:2.5583,h:4.8},3.5,"not-a-builder");
      GymTests.deepEqual(unknown,{built:false,error:null});
    }finally{ fixture.destroy(); }
  });

  GymTests.test("cleans a throwing dedicated stage before the generic fallback can build",()=>{
    const fixture=createEquipmentDispatchFixture();
    const originalModels=window.GymEquipmentModels;
    let staleMesh=null;
    let geometryDisposed=0;
    let materialDisposed=0;
    try{
      window.GymEquipmentModels={
        ...originalModels,
        build(profile,view,group,inst,base,height){
          if(profile!=="nordictrack-x16") return originalModels.build(profile,view,group,inst,base,height);
          staleMesh=view.box(group,{x:.2,y:.2,z:.2},{x:0,y:.1,z:0},view.material({color:0xffffff}),{instId:inst.id});
          const disposeGeometry=staleMesh.geometry.dispose.bind(staleMesh.geometry);
          const disposeMaterial=staleMesh.material.dispose.bind(staleMesh.material);
          staleMesh.geometry.dispose=()=>{geometryDisposed++;disposeGeometry();};
          staleMesh.material.dispose=()=>{materialDisposed++;disposeMaterial();};
          throw new Error("test builder failure");
        },
      };
      const {view}=fixture;
      const baselineTargets=view.clickTargets.slice();
      const hostGroup=new THREE.Group();
      const item=getItemById("x16");
      const result=view.tryBuildDedicatedEquipmentModel(hostGroup,{id:"throwing"},item,{w:3.175,h:5.825},6.1083,"nordictrack-x16");
      GymTests.equal(result.built,false);
      GymTests.assert(result.error instanceof Error,"Throwing builder should normalize an Error");
      GymTests.equal(result.error.message,"test builder failure");
      GymTests.deepEqual(view.clickTargets,baselineTargets,"Throwing stage must not retain a click target");
      GymTests.equal(hostGroup.children.length,0,"Throwing stage must not attach a root");
      GymTests.equal(geometryDisposed,1,"Throwing stage geometry must be disposed");
      GymTests.equal(materialDisposed,1,"Throwing stage material must be disposed");
      GymTests.assert(!view.disposables.includes(staleMesh.geometry),"Disposed stage geometry must leave renderer disposables");
      GymTests.assert(!view.disposables.includes(staleMesh.material),"Disposed stage material must leave renderer disposables");
    }finally{
      window.GymEquipmentModels=originalModels;
      fixture.destroy();
    }
  });

  GymTests.test("publishes successful dedicated placement and host diagnostics for all eleven models",()=>{
    const fixture=createEquipmentDispatchFixture();
    try{
      const {host,view}=fixture;
      GymTests.equal(view.itemGroups.size,11);
      GymTests.equal(host.dataset.dedicatedModels,"11");
      GymTests.equal(host.dataset.builderFailures,"0");
      GymTests.equal(host.dataset.modelProfiles,dedicatedProfiles.join(","));
      GymTests.equal(host.dataset.modelBuilders,dedicatedProfiles.join(","));
      view.itemGroups.forEach(group=>{
        GymTests.assert(typeof group.userData.modelProfile==="string");
        GymTests.equal(group.userData.dedicatedModel,true);
        GymTests.equal(group.userData.modelBuilder,group.userData.modelProfile);
        ["canonicalFootprint","worldFootprint","measuredFootprint"].forEach(key=>GymTests.assert(group.userData[key],`Expected ${key}`));
        GymTests.assert(groupMeshes(group).some(mesh=>mesh.userData.instId===group.userData.instId),"Placement must retain an inst hit target");
      });
    }finally{ fixture.destroy(); }
  });

  GymTests.test("preserves the eight saved Layout 3 footprints, origins, rotations, and validity",()=>{
    const instances=[
      {id:"saved_ice",itemId:"ice",xFt:0,xIn:0,yFt:9,yIn:0,rotated:false,__invalid:false},
      {id:"saved_stair",itemId:"stair",xFt:0,xIn:0,yFt:0,yIn:0,rotated:true,__invalid:false},
      {id:"saved_x16",itemId:"x16",xFt:6.5,xIn:0,yFt:0,yIn:0,rotated:true,__invalid:false},
      {id:"saved_gator",itemId:"gator",xFt:3,xIn:0,yFt:4,yIn:0,rotated:true,__invalid:false},
      {id:"saved_hs08",itemId:"hs08",xFt:15,xIn:0,yFt:3.5,yIn:0,rotated:true,__invalid:false},
      {id:"saved_shizhuo",itemId:"shizhuo",xFt:14,xIn:0,yFt:7,yIn:0,rotated:true,__invalid:false},
      {id:"saved_wanjia",itemId:"wanjia",xFt:7.5,xIn:0,yFt:14.51,yIn:0,rotated:false,__invalid:false},
      {id:"saved_yindun",itemId:"yindun",xFt:0,xIn:0,yFt:3,yIn:0,rotated:false,__invalid:false},
    ];
    const fixture=createEquipmentDispatchFixture({items:dedicatedItems.slice(0,8),instances});
    const before=deepCopy(state.layout.instances);
    try{
      before.forEach(inst=>{
        const item=getItemById(inst.itemId);
        const fp=footprint(item);
        const dims=instanceDims(inst,item);
        const group=fixture.view.itemGroups.get(inst.id);
        GymTests.assert(group,`Expected placement group for ${inst.id}`);
        assertNear(group.userData.canonicalFootprint.widthFt,fp.W,`${inst.id} canonical width`);
        assertNear(group.userData.canonicalFootprint.depthFt,fp.L,`${inst.id} canonical depth`);
        assertNear(group.userData.canonicalFootprint.heightFt,fp.H,`${inst.id} canonical height`);
        assertNear(group.userData.worldFootprint.widthFt,dims.w,`${inst.id} world width`);
        assertNear(group.userData.worldFootprint.depthFt,dims.h,`${inst.id} world depth`);
        assertNear(group.userData.measuredFootprint.widthFt,dims.w,`${inst.id} measured width`);
        assertNear(group.userData.measuredFootprint.depthFt,dims.h,`${inst.id} measured depth`);
        assertNear(group.position.x,instXTotalFt(inst)+dims.w/2,`${inst.id} world center x`);
        assertNear(group.position.z,instYTotalFt(inst)+dims.h/2,`${inst.id} world center z`);
        GymTests.equal(group.userData.dedicatedModel,true);
        GymTests.equal(inst.__invalid,false);
      });
      GymTests.deepEqual(state.layout.instances,before,"3D construction must not mutate saved placement state");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("falls back only the throwing X16 and restores the registry after the assertion",()=>{
    const originalModels=window.GymEquipmentModels;
    try{
      window.GymEquipmentModels={
        ...originalModels,
        build(profile,...args){
          if(profile==="nordictrack-x16") throw new Error("test builder failure");
          return originalModels.build(profile,...args);
        },
      };
      const fixture=createEquipmentDispatchFixture();
      try{
        const {host,view}=fixture;
        const x16=view.itemGroups.get("inst_x16");
        GymTests.equal(view.itemGroups.size,11);
        GymTests.equal(host.dataset.builderFailures,"1");
        GymTests.equal(host.dataset.dedicatedModels,"10");
        GymTests.equal(x16.userData.dedicatedModel,false);
        GymTests.equal(x16.userData.modelBuilder,"");
        GymTests.equal(x16.userData.modelType,"incline treadmill");
        GymTests.assert(
          host.querySelector("[data-gym3d-warnings]").textContent.includes("NordicTrack X16 Treadmill"),
          "The first published warning must identify the X16 dedicated fallback"
        );
        GymTests.assert(
          !host.dataset.modelBuilders.split(",").includes("nordictrack-x16"),
          "A failed X16 builder must not appear in successful builder diagnostics"
        );
      }finally{ fixture.destroy(); }
    }finally{
      window.GymEquipmentModels=originalModels;
    }
    const restored=createEquipmentDispatchFixture();
    try{
      GymTests.equal(restored.host.dataset.builderFailures,"0");
      GymTests.equal(restored.host.dataset.dedicatedModels,"11");
    }finally{ restored.destroy(); }
  });

  GymTests.test("counts a missing dedicated builder but leaves an unrelated standard fallback clear",()=>{
    const originalModels=window.GymEquipmentModels;
    try{
      window.GymEquipmentModels={
        ...originalModels,
        build(profile,...args){
          if(profile==="nordictrack-x16") return null;
          return originalModels.build(profile,...args);
        },
      };
      const missing=createEquipmentDispatchFixture();
      try{
        const x16=missing.view.itemGroups.get("inst_x16");
        GymTests.equal(missing.host.dataset.builderFailures,"1");
        GymTests.equal(missing.host.dataset.dedicatedModels,"10");
        GymTests.equal(x16.userData.dedicatedModel,false);
        GymTests.equal(x16.userData.modelType,"incline treadmill");
        GymTests.assert(
          missing.host.querySelector("[data-gym3d-warnings]").textContent.includes("NordicTrack X16 Treadmill"),
          "A missing dedicated builder must publish one measured-fallback warning"
        );
      }finally{ missing.destroy(); }
    }finally{
      window.GymEquipmentModels=originalModels;
    }

    const standard=createEquipmentDispatchFixture({items:[{
      id:"standard-bench",brand:"Another Brand",name:"Adjustable Weight Bench",category:"Benches",
      model3dProfile:"standard",width:2,length:4,height:3,unit:"ft",
    }]});
    try{
      const group=standard.view.itemGroups.get("inst_standard-bench");
      GymTests.equal(standard.host.dataset.builderFailures,"0");
      GymTests.equal(standard.host.dataset.dedicatedModels,"0");
      GymTests.equal(group.userData.dedicatedModel,false);
      GymTests.equal(group.userData.modelType,"adjustable bench");
      GymTests.assert(
        !standard.host.querySelector("[data-gym3d-warnings]").textContent.includes("dedicated 3D model unavailable"),
        "A standard generic profile must not manufacture a builder warning"
      );
    }finally{ standard.destroy(); }
  });
})();
