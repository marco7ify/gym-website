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

  const savedLayout3Source=exactGarageLayout3Fixture();
  const savedLayout3Items=savedLayout3Source.items;
  const savedLayout3Instances=savedLayout3Source.layout.instances;
  const savedX16=savedLayout3Items.find(item=>item.id==="x16");
  const savedStair=savedLayout3Items.find(item=>item.id==="stair");
  const savedGator=savedLayout3Items.find(item=>item.id==="gator");

  const savedLayout3Placements=[
    {id:"inst_maxwell",widthFt:43/12,depthFt:63/12,centerX:1/24,centerZ:16.875,rotationY:0,visualRotationY:-Math.PI/2},
    {id:"inst_ice",widthFt:30.7/12,depthFt:57.6/12,centerX:30.7/24,centerZ:11.4,rotationY:0,visualRotationY:0},
    {id:"inst_x16",widthFt:69.9/12,depthFt:38.1/12,centerX:9.4125,centerZ:1.5875,rotationY:Math.PI/2,visualRotationY:0},
    {id:"inst_stair",widthFt:50/12,depthFt:32/12,centerX:25/12,centerZ:4/3,rotationY:Math.PI/2,visualRotationY:0},
    {id:"inst_rx3",widthFt:4,depthFt:32/12,centerX:5,centerZ:31/3,rotationY:Math.PI/2,visualRotationY:Math.PI/2},
    {id:"inst_gator",widthFt:58/12,depthFt:26/12,centerX:65/12,centerZ:61/12,rotationY:Math.PI/2,visualRotationY:0},
    {id:"inst_gazelle",widthFt:87/12,depthFt:49/12,centerX:16.208333015441895,centerZ:17.458333333333638,rotationY:Math.PI/2,visualRotationY:0},
    {id:"inst_hs08",widthFt:4.2,depthFt:2.82,centerX:17.1,centerZ:4.91,rotationY:Math.PI/2,visualRotationY:0},
    {id:"inst_shizhuo",widthFt:5.21,depthFt:3.67,centerX:16.605,centerZ:8.835,rotationY:Math.PI/2,visualRotationY:0},
    {id:"inst_yindun",widthFt:2.22,depthFt:5.58,centerX:1.11,centerZ:5.79,rotationY:0,visualRotationY:Math.PI/2},
    {id:"inst_combo",widthFt:2.38,depthFt:4.99,centerX:8.69,centerZ:17.005,rotationY:0,visualRotationY:0},
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

  function createEquipmentDispatchFixture({
    items=dedicatedItems,
    instances=null,
    settings=null,
    areas=null,
    outlets=null,
    wallExtensions=null,
    ceilingZones=null,
    floorZones=null,
    flooringPieces=null,
    wallFeatures=null,
    spatial3d=null,
    walls=false,
    garageWallRevision=0,
  }={}){
    state.settings=settings || fixtureSettings();
    state.items=items.map(item=>normalizeItemRecord({...item,unit:"ft"}));
    state.layout=normalizeLayout({
      ...deepCopy(DEFAULT_LAYOUT),
      garageWallRevision,
      spatial3d:spatial3d ? deepCopy(spatial3d) : {...DEFAULT_LAYOUT.spatial3d,walls,labelMode:"off",clearances:false},
      areas:areas || deepCopy(DEFAULT_LAYOUT.areas),
      outlets:outlets || deepCopy(DEFAULT_LAYOUT.outlets),
      wallExtensions:wallExtensions || deepCopy(DEFAULT_LAYOUT.wallExtensions),
      ceilingZones:ceilingZones || deepCopy(DEFAULT_LAYOUT.ceilingZones),
      floorZones:floorZones || deepCopy(DEFAULT_LAYOUT.floorZones),
      flooringPieces:flooringPieces || deepCopy(DEFAULT_LAYOUT.flooringPieces),
      wallFeatures:wallFeatures || deepCopy(DEFAULT_LAYOUT.wallFeatures),
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
    const instancesBeforeRender=deepCopy(state.layout.instances);
    const view=new Gym3DView(host,"preview");
    return {host,view,instancesBeforeRender,destroy(){ view.destroy(); host.remove(); }};
  }

  function createSavedLayout3Fixture(){
    const saved=exactGarageLayout3Fixture();
    return createEquipmentDispatchFixture({
      items:saved.items,
      instances:saved.layout.instances,
      settings:saved.settings,
      areas:saved.layout.areas,
      outlets:saved.layout.outlets,
      wallExtensions:saved.layout.wallExtensions,
      ceilingZones:saved.layout.ceilingZones,
      floorZones:saved.layout.floorZones,
      flooringPieces:saved.layout.flooringPieces,
      wallFeatures:saved.layout.wallFeatures,
      spatial3d:saved.layout.spatial3d,
      garageWallRevision:saved.layout.garageWallRevision,
    });
  }

  function groupMeshes(group){
    const meshes=[];
    group.traverse(object=>{if(object.isMesh) meshes.push(object);});
    return meshes;
  }

  function assertNear(actual,expected,message){
    GymTests.assert(Math.abs(actual-expected)<=.001,`${message}: expected ${expected}, received ${actual}`);
  }

  function meshGeometrySignature(mesh){
    mesh.geometry.computeBoundingBox();
    const size=new THREE.Vector3();
    mesh.geometry.boundingBox.getSize(size);
    return [mesh.geometry.type,mesh.geometry.attributes.position.count,...size.toArray().map(value=>value.toFixed(6))].join(":");
  }

  function dedicatedAssembly(group,prefix){
    const visualGroup=group.children.find(child=>child.isGroup);
    const root=visualGroup?.children.find(child=>child.isGroup);
    GymTests.assert(root,`Expected a ${prefix} dedicated assembly root`);
    const tagged=groupMeshes(root).filter(mesh=>String(mesh.userData.partTag||"").startsWith(prefix));
    GymTests.assert(tagged.length>0,`Expected a ${prefix} dedicated assembly`);
    return root;
  }

  function meshMaterials(mesh){
    return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean);
  }

  function meshTriangleCount(mesh){
    const geometry=mesh.geometry;
    return (geometry.index?.count || geometry.attributes?.position?.count || 0)/3;
  }

  function captureDedicatedResources(view,instId,prefix){
    const group=view.itemGroups.get(instId);
    const root=dedicatedAssembly(group,prefix);
    const meshes=groupMeshes(root);
    const meshSet=new Set(meshes);
    const geometries=[...new Set(meshes.map(mesh=>mesh.geometry))];
    const materials=[...new Set(meshes.flatMap(meshMaterials))];
    const clickTargets=view.clickTargets.filter(target=>meshSet.has(target));
    const tracked=[
      ...geometries.map(resource=>({resource,kind:"geometry"})),
      ...materials.map(resource=>({resource,kind:"material"})),
    ].map(({resource,kind})=>{
      const original=resource.dispose.bind(resource);
      const record={resource,kind,count:0};
      resource.dispose=()=>{ record.count++; return original(); };
      return record;
    });
    return {
      meshes,
      geometries,
      materials,
      clickTargets,
      tracked,
      summary:{
        meshes:meshes.length,
        geometries:geometries.length,
        geometrySignatures:new Set(meshes.map(meshGeometrySignature)).size,
        materials:materials.length,
        clickTargets:clickTargets.length,
        triangles:meshes.reduce((total,mesh)=>total+meshTriangleCount(mesh),0),
      },
    };
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
    const staleMeshes=[];
    let geometryDisposed=0;
    let materialDisposed=0;
    try{
      window.GymEquipmentModels={
        ...originalModels,
        build(profile,view,group,inst,base,height){
          if(profile!=="nordictrack-x16") return originalModels.build(profile,view,group,inst,base,height);
          const staleMaterial=view.material({color:0xffffff});
          staleMeshes.push(
            view.box(group,{x:.2,y:.2,z:.2},{x:0,y:.1,z:0},staleMaterial,{instId:inst.id,partTag:"x16-test-stage",partIndex:0}),
            view.box(group,{x:.2,y:.2,z:.2},{x:0,y:.3,z:0},staleMaterial,{instId:inst.id,partTag:"x16-test-stage",partIndex:1}),
          );
          staleMeshes.forEach(staleMesh=>{
            const disposeGeometry=staleMesh.geometry.dispose.bind(staleMesh.geometry);
            staleMesh.geometry.dispose=()=>{geometryDisposed++;disposeGeometry();};
          });
          const disposeMaterial=staleMaterial.dispose.bind(staleMaterial);
          staleMaterial.dispose=()=>{materialDisposed++;disposeMaterial();};
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
      GymTests.equal(geometryDisposed,2,"Throwing stage geometries must be disposed");
      GymTests.equal(materialDisposed,1,"Throwing stage material must be disposed");
      staleMeshes.forEach(staleMesh=>{
        GymTests.assert(!view.disposables.includes(staleMesh.geometry),"Disposed stage geometry must leave renderer disposables");
        GymTests.assert(!view.disposables.includes(staleMesh.material),"Disposed stage material must leave renderer disposables");
      });
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

  GymTests.test("publishes Echo's canonical seat height separately from its visual model height",()=>{
    const echo={
      id:"echo",brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning",
      unit:"ft",width:26/12,length:99/12,height:16/12,
    };
    const fixture=createEquipmentDispatchFixture({items:[echo]});
    try{
      const group=fixture.view.itemGroups.get("inst_echo");
      GymTests.equal(group.userData.modelProfile,"rogue-echo-rower");
      assertNear(group.userData.canonicalFootprint.heightFt,16/12,"Echo canonical height must remain its saved 16 in seat height");
      GymTests.assert(group.userData.worldFootprint.heightFt>16/12,"Echo world/model height must exceed its saved seat height");
      GymTests.assert(group.userData.visualHeightFt>16/12,"Echo visual height must exceed its saved seat height");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("publishes the complete X16 semantic mesh contract through real Three primitives",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[2]]});
    try{
      const group=fixture.view.itemGroups.get("inst_x16");
      const tagged=groupMeshes(group).filter(mesh=>String(mesh.userData.partTag||"").startsWith("x16-"));
      GymTests.equal(group.userData.modelType,"photo-matched NordicTrack X16");
      GymTests.assert(tagged.length>0 && tagged.length<=32,"The dedicated X16 root must expose its bounded tagged assembly");
      GymTests.assert(tagged.every(mesh=>mesh.userData.instId==="inst_x16"),"Every tagged X16 mesh must preserve its interaction target");
      GymTests.equal(tagged.filter(mesh=>mesh.userData.partTag==="x16-belt").length,1);
      GymTests.equal(tagged.filter(mesh=>mesh.userData.partTag==="x16-handrail").length,6);
      const footRails=tagged.filter(mesh=>mesh.userData.partTag==="x16-foot-rail");
      GymTests.equal(footRails.length,2);
      footRails.forEach(rail=>{
        const position=rail.geometry.attributes.position;
        const topByZ=new Map();
        for(let index=0;index<position.count;index++){
          const z=position.getZ(index).toFixed(6);
          topByZ.set(z,Math.max(topByZ.get(z)??-Infinity,position.getY(index)));
        }
        const topHeights=[...new Set([...topByZ.values()].map(value=>value.toFixed(6)))];
        GymTests.assert(topByZ.size>=17,"Each X16 foot rail needs enough longitudinal stations for eight integrated ribs");
        GymTests.assert(topHeights.length>=2,"Each X16 foot rail top surface must visibly alternate between ribs and grooves");
      });
      GymTests.assert(new Set(tagged.map(mesh=>mesh.material)).size<=6,"Real X16 meshes must reuse at most six material objects");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("keeps the Stair cyan screen front-hit visible inside its tilted dark console shell",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[1]]});
    try{
      const group=fixture.view.itemGroups.get("inst_stair");
      const tagged=groupMeshes(group).filter(mesh=>String(mesh.userData.partTag||"").startsWith("stair-"));
      const housing=tagged.find(mesh=>mesh.userData.partTag==="stair-console-housing");
      const consoleScreen=tagged.find(mesh=>mesh.userData.partTag==="stair-console-screen");
      housing.updateMatrixWorld(true);
      consoleScreen.updateMatrixWorld(true);
      const screenCenter=new THREE.Vector3().setFromMatrixPosition(consoleScreen.matrixWorld);
      const screenFront=new THREE.Vector3(0,0,-1).transformDirection(consoleScreen.matrixWorld);
      const frontRay=new THREE.Raycaster(
        screenCenter.clone().addScaledVector(screenFront,1),
        screenFront.clone().negate(),
      );
      const consoleHits=frontRay.intersectObjects([housing,consoleScreen],false);
      GymTests.equal(consoleHits[0]?.object,consoleScreen,"A front sightline must hit the cyan Stair screen before the opaque housing");
      GymTests.assert(Math.abs(housing.rotation.x)>1e-6,"Real Stair console housing needs a slight viewing tilt");
      assertNear(consoleScreen.rotation.x,housing.rotation.x,"Real Stair housing and screen must tilt together");
      housing.geometry.computeBoundingBox();
      consoleScreen.geometry.computeBoundingBox();
      const housingSize=new THREE.Vector3();
      const screenSize=new THREE.Vector3();
      housing.geometry.boundingBox.getSize(housingSize);
      consoleScreen.geometry.boundingBox.getSize(screenSize);
      GymTests.assert(
        housingSize.x>screenSize.x && housingSize.y>screenSize.y,
        "Real Stair screen must retain a visible dark border on X and Y",
      );
    }finally{ fixture.destroy(); }
  });

  GymTests.test("publishes the complete Stair semantic mesh contract through real Three primitives",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[1]]});
    try{
      const group=fixture.view.itemGroups.get("inst_stair");
      const tagged=groupMeshes(group).filter(mesh=>String(mesh.userData.partTag||"").startsWith("stair-"));
      GymTests.equal(group.userData.modelType,"photo-matched syedee Stair Machine");
      GymTests.assert(tagged.length>0 && tagged.length<=56,"The dedicated Stair root must expose its bounded tagged assembly");
      GymTests.assert(tagged.every(mesh=>mesh.userData.instId==="inst_stair"),"Every tagged Stair mesh must preserve its interaction target");
      [
        ["stair-tread",8],["stair-riser",7],["stair-side-shroud",2],["stair-shroud-inset",2],
        ["stair-entry-step",1],["stair-base-rail",2],["stair-handrail",8],
        ["stair-console-housing",1],["stair-console-screen",1],["stair-orange-accent",2],
      ].forEach(([tag,count])=>GymTests.equal(tagged.filter(mesh=>mesh.userData.partTag===tag).length,count));
      GymTests.assert(tagged.filter(mesh=>mesh.userData.partTag==="stair-cross-foot").length>=2,"Real Stair needs front and rear cross feet");
      const edgeLights=tagged.filter(mesh=>mesh.userData.partTag==="stair-white-edge-light");
      GymTests.assert(edgeLights.filter(mesh=>mesh.userData.side==="left").length>=2,"Real Stair needs a left white edge-light set");
      GymTests.equal(edgeLights.filter(mesh=>mesh.userData.side==="right").length,edgeLights.filter(mesh=>mesh.userData.side==="left").length,"Real Stair needs matching white edge-light sets");
      GymTests.assert(new Set(tagged.map(mesh=>mesh.material)).size<=8,"Real Stair meshes must reuse at most eight material objects");
      GymTests.assert(new Set(tagged.map(meshGeometrySignature)).size<=24,"Real Stair meshes must reuse at most 24 geometry signatures");
      const floorParts=tagged.filter(mesh=>mesh.userData.partTag==="stair-base-rail" || mesh.userData.partTag==="stair-cross-foot");
      assertNear(Math.min(...floorParts.map(mesh=>new THREE.Box3().setFromObject(mesh).min.y)),0,"Real Stair base must touch the floor");
      ["stair-console-screen","stair-white-edge-light","stair-orange-accent"].forEach(tag=>{
        tagged.filter(mesh=>mesh.userData.partTag===tag).forEach(mesh=>{
          GymTests.assert(mesh.material.emissive.getHex()!==0,`${tag} must be emissive`);
          GymTests.equal(mesh.castShadow,false,`${tag} must not cast shadows`);
          GymTests.equal(mesh.receiveShadow,false,`${tag} must not receive shadows`);
        });
      });
    }finally{ fixture.destroy(); }
  });

  GymTests.test("publishes the complete GATOR semantic mesh contract through real Three primitives",()=>{
    const fixture=createEquipmentDispatchFixture({items:[dedicatedItems[3]]});
    try{
      const group=fixture.view.itemGroups.get("inst_gator");
      const tagged=groupMeshes(group).filter(mesh=>String(mesh.userData.partTag||"").startsWith("gator-"));
      GymTests.equal(group.userData.modelType,"photo-matched RitFit GATOR bench");
      GymTests.assert(tagged.length>0 && tagged.length<=58,"The dedicated GATOR root must expose its bounded tagged assembly");
      GymTests.assert(tagged.every(mesh=>mesh.userData.instId==="inst_gator"),"Every tagged GATOR mesh must preserve its interaction target");
      [
        ["gator-seat-pad",1],["gator-back-pad",1],["gator-head-pad",1],
        ["gator-angle-station",10],["gator-foam-roller",4],["gator-roller-crossbar",2],
        ["gator-transport-wheel",2],["gator-lifting-handle",1],
      ].forEach(([tag,count])=>GymTests.equal(tagged.filter(mesh=>mesh.userData.partTag===tag).length,count));
      ["gator-main-spine","gator-front-stabilizer","gator-rear-stabilizer","gator-angle-plate","gator-lock-pin","gator-front-brace"].forEach(tag=>{
        GymTests.assert(tagged.some(mesh=>mesh.userData.partTag===tag),`Real GATOR is missing ${tag}`);
      });
      GymTests.assert(new Set(tagged.map(mesh=>mesh.material)).size<=6,"Real GATOR meshes must reuse at most six material objects");
      GymTests.assert(new Set(tagged.map(mesh=>mesh.geometry)).size<=26,"Real GATOR meshes must reuse at most 26 geometry objects");
      ["gator-foot-pad","gator-angle-station","gator-transport-wheel","gator-roller-crossbar","gator-foam-roller"].forEach(tag=>{
        const meshes=tagged.filter(mesh=>mesh.userData.partTag===tag);
        GymTests.equal(new Set(meshes.map(mesh=>mesh.geometry)).size,1,`${tag} meshes must share one geometry resource`);
      });
      assertNear(Math.min(...tagged.map(mesh=>new THREE.Box3().setFromObject(mesh).min.y)),0,"Real GATOR assembly must touch the floor");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("keeps the saved Stair low-ceiling warning singular and unchanged",()=>{
    const item={...dedicatedItems[1],requiredCeilingFt:8.7};
    const fixture=createEquipmentDispatchFixture({
      items:[item],
      instances:[{id:"saved_stair",itemId:"stair",xFt:0,xIn:0,yFt:0,yIn:0,rotated:true}],
      ceilingZones:[{id:"existing_ceiling",label:"Low ceiling",xFt:0,xIn:0,yFt:0,yIn:6,widthFt:2,widthIn:6,heightFt:5,heightIn:0,ceilingHeightFt:5,ceilingHeightIn:0}],
    });
    try{
      const warnings=fixture.host.querySelector("[data-gym3d-warnings]");
      GymTests.equal(warnings.querySelector("strong").textContent,"1 warning");
      GymTests.equal(warnings.querySelector("span").textContent,"Stair Machine: needs 8.7 ft ceiling");
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

  GymTests.test("preserves the exact saved Layout 3 cardio placement, orientation, warning, and architecture",()=>{
    const sourceBefore=JSON.stringify(savedLayout3Instances);
    const fixture=createSavedLayout3Fixture();
    try{
      const {host,view}=fixture;
      GymTests.equal(view.itemGroups.size,11,"Exact saved Layout 3 must retain all 11 equipment placements");
      GymTests.equal(host.dataset.dedicatedModels,"11","Exact saved Layout 3 must retain 11 dedicated models");
      GymTests.equal(host.dataset.builderFailures,"0","Exact saved Layout 3 must retain zero builder failures");
      GymTests.equal(host.dataset.garageDoorModels,"1","Exact saved Layout 3 must retain its one garage-door model");
      GymTests.equal(host.dataset.wallFeatures,"7","Exact saved Layout 3 must retain its seven wall features");
      GymTests.deepEqual(
        state.layout.areas.map(area=>[area.id,area.kind]),
        [
          ["existing_entry","door"],
          ["existing_nogo","nogospace"],
          ["area_l3_bottom_garage_v1","garagedoor"],
        ],
        "Exact saved Layout 3 must retain its standard door, no-go, and architectural garage",
      );
      GymTests.deepEqual(
        {
          openings:host.dataset.doorOpenings,
          standardOpenings:host.dataset.standardDoorOpenings,
          garageOpenings:host.dataset.garageDoorOpenings,
          standardModels:host.dataset.standardDoorModels,
          garageModels:host.dataset.garageDoorModels,
          totalModels:host.dataset.doorModels,
          colliders:host.dataset.doorColliders,
        },
        {
          openings:"2",standardOpenings:"1",garageOpenings:"1",
          standardModels:"1",garageModels:"1",totalModels:"2",colliders:"1",
        },
        "Exact saved Layout 3 must publish its standard and garage door diagnostics together",
      );
      GymTests.deepEqual(
        state.layout.outlets.map(outlet=>[outlet.id,outlet.voltage]),
        [["existing_outlet","120V"]],
        "Exact saved Layout 3 must retain its outlet record",
      );
      GymTests.deepEqual(
        state.layout.floorZones.map(zone=>[zone.id,zone.elevationIn]),
        [["existing_platform",4]],
        "Exact saved Layout 3 must retain its raised-floor record",
      );
      GymTests.deepEqual(
        state.layout.flooringPieces.map(piece=>[piece.id,piece.typeId,piece.rotated,piece.price]),
        [["existing_flooring","stall_mat_4x6",true,55]],
        "Exact saved Layout 3 must retain its saved flooring record",
      );
      GymTests.deepEqual(
        {
          walls:state.layout.spatial3d.walls,
          ceiling:state.layout.spatial3d.ceiling,
          clearances:state.layout.spatial3d.clearances,
          collisions:state.layout.spatial3d.collisions,
          labelMode:state.layout.spatial3d.labelMode,
          eyeHeightFt:state.layout.spatial3d.eyeHeightFt,
          wallColor:state.layout.spatial3d.wallColor,
          floorType:state.layout.spatial3d.floorType,
          fovDeg:state.layout.spatial3d.fovDeg,
        },
        {
          walls:true,ceiling:true,clearances:true,collisions:true,labelMode:"selected",
          eyeHeightFt:5.67,wallColor:"black",floorType:"rolled-rubber",fovDeg:90,
        },
        "Exact saved Layout 3 must retain its associated spatial settings",
      );
      GymTests.equal(JSON.stringify(savedLayout3Instances),sourceBefore,"Rendering must leave every source instance byte-equal");
      GymTests.equal(
        JSON.stringify(state.layout.instances),
        JSON.stringify(fixture.instancesBeforeRender),
        "Rendering must leave every normalized saved instance byte-equal",
      );
      const sourceById=new Map(savedLayout3Instances.map(inst=>[inst.id,inst]));
      const normalizedById=new Map(state.layout.instances.map(inst=>[inst.id,inst]));
      const renderedById=new Map(view.roomInstances.map(inst=>[inst.id,inst]));
      savedLayout3Placements.forEach(expected=>{
        const group=view.itemGroups.get(expected.id);
        GymTests.assert(group,`Expected rendered saved placement ${expected.id}`);
        assertNear(group.userData.worldFootprint.widthFt,expected.widthFt,`${expected.id} exact world width`);
        assertNear(group.userData.worldFootprint.depthFt,expected.depthFt,`${expected.id} exact world depth`);
        assertNear(group.position.x,expected.centerX,`${expected.id} exact world center x`);
        assertNear(group.position.z,expected.centerZ,`${expected.id} exact world center z`);
        assertNear(group.rotation.y,expected.rotationY,`${expected.id} exact placement rotation`);
        assertNear(group.userData.rotationY,expected.rotationY,`${expected.id} published placement rotation`);
        assertNear(group.userData.visualRotationY,expected.visualRotationY,`${expected.id} exact visual rotation`);
        GymTests.equal(sourceById.get(expected.id)?.__invalid,false,`${expected.id} source validity must remain unchanged`);
        GymTests.equal(normalizedById.get(expected.id)?.__invalid,false,`${expected.id} normalized validity must remain unchanged`);
        GymTests.equal(renderedById.get(expected.id)?.__invalid,false,`${expected.id} rendered collision validity must remain unchanged`);
      });

      const x16=view.itemGroups.get("inst_x16");
      GymTests.assert(x16,"Expected the exact saved X16 placement group");
      assertNear(x16.userData.canonicalFootprint.widthFt,savedX16.width,"Saved X16 canonical width");
      assertNear(x16.userData.canonicalFootprint.depthFt,savedX16.length,"Saved X16 canonical depth");
      assertNear(x16.userData.canonicalFootprint.heightFt,savedX16.height,"Saved X16 canonical height");
      assertNear(x16.userData.worldFootprint.widthFt,savedX16.length,"Rotated saved X16 world width");
      assertNear(x16.userData.worldFootprint.depthFt,savedX16.width,"Rotated saved X16 world depth");
      assertNear(x16.position.x,6+6/12+savedX16.length/2,"Saved X16 world center x");
      assertNear(x16.position.z,savedX16.width/2,"Saved X16 world center z");
      assertNear(x16.rotation.y,Math.PI/2,"Saved X16 placement rotation");
      assertNear(x16.userData.rotationY,Math.PI/2,"Saved X16 published rotation");
      assertNear(x16.userData.visualRotationY,0,"Saved X16 visual rotation");
      x16.updateMatrixWorld(true);
      const x16Front=new THREE.Vector3(0,0,-1).transformDirection(x16.matrixWorld);
      assertNear(x16Front.x,-1,"Saved X16 local -Z world direction x");
      assertNear(x16Front.z,0,"Saved X16 local -Z world direction z");

      const stair=view.itemGroups.get("inst_stair");
      GymTests.assert(stair,"Expected the exact saved Stair placement group");
      assertNear(stair.userData.canonicalFootprint.widthFt,savedStair.width,"Saved Stair canonical width");
      assertNear(stair.userData.canonicalFootprint.depthFt,savedStair.length,"Saved Stair canonical depth");
      assertNear(stair.userData.canonicalFootprint.heightFt,savedStair.height,"Saved Stair canonical height");
      assertNear(stair.userData.worldFootprint.widthFt,savedStair.length,"Rotated saved Stair world width");
      assertNear(stair.userData.worldFootprint.depthFt,savedStair.width,"Rotated saved Stair world depth");
      assertNear(stair.position.x,savedStair.length/2,"Saved Stair world center x");
      assertNear(stair.position.z,savedStair.width/2,"Saved Stair world center z");
      assertNear(stair.rotation.y,Math.PI/2,"Saved Stair placement rotation");
      assertNear(stair.userData.rotationY,Math.PI/2,"Saved Stair published rotation");
      assertNear(stair.userData.visualRotationY,0,"Saved Stair visual rotation");
      stair.updateMatrixWorld(true);
      const stairEntry=new THREE.Vector3(0,0,1).transformDirection(stair.matrixWorld);
      assertNear(stairEntry.x,1,"Saved Stair entry must face the open room");
      assertNear(stairEntry.z,0,"Saved Stair entry must not face along the boundary wall");

      const gator=view.itemGroups.get("inst_gator");
      GymTests.assert(gator,"Expected the exact saved GATOR placement group");
      assertNear(gator.userData.canonicalFootprint.widthFt,savedGator.width,"Saved GATOR canonical width");
      assertNear(gator.userData.canonicalFootprint.depthFt,savedGator.length,"Saved GATOR canonical depth");
      assertNear(gator.userData.canonicalFootprint.heightFt,savedGator.height,"Saved GATOR canonical height");
      assertNear(gator.userData.worldFootprint.widthFt,savedGator.length,"Rotated saved GATOR world width");
      assertNear(gator.userData.worldFootprint.depthFt,savedGator.width,"Rotated saved GATOR world depth");
      assertNear(gator.position.x,3+savedGator.length/2,"Saved GATOR world center x");
      assertNear(gator.position.z,4+savedGator.width/2,"Saved GATOR world center z");
      assertNear(gator.rotation.y,Math.PI/2,"Saved GATOR placement rotation");
      assertNear(gator.userData.rotationY,Math.PI/2,"Saved GATOR published rotation");
      assertNear(gator.userData.visualRotationY,0,"Saved GATOR visual rotation");

      const warnings=host.querySelector("[data-gym3d-warnings]");
      GymTests.equal(warnings.querySelector("strong").textContent,"1 warning","Saved Stair ceiling warning must occur exactly once");
      GymTests.equal(warnings.querySelector("span").textContent,"Stair Machine: needs 8.7 ft ceiling");
      GymTests.equal((warnings.textContent.match(/Stair Machine: needs 8\.7 ft ceiling/g)||[]).length,1,"Saved Stair warning text must occur once");

    }finally{ fixture.destroy(); }
  });

  GymTests.test("disposes exact saved Layout 3 featured resources once across repeat lifecycles",()=>{
    function captureCycle(){
      const fixture=createSavedLayout3Fixture();
      let destroyed=false;
      try{
        const {host,view}=fixture;
        const x16=captureDedicatedResources(view,"inst_x16","x16-");
        const stair=captureDedicatedResources(view,"inst_stair","stair-");
        const gator=captureDedicatedResources(view,"inst_gator","gator-");

        GymTests.equal(host.dataset.dedicatedModels,"11");
        GymTests.equal(host.dataset.builderFailures,"0");
        GymTests.equal(host.dataset.garageDoorModels,"1");
        GymTests.equal(host.dataset.wallFeatures,"7");
        GymTests.assert(x16.meshes.length<=32,`Saved X16 must stay within 32 meshes; received ${x16.meshes.length}`);
        GymTests.assert(x16.geometries.length<=32,`Saved X16 must stay within 32 geometry resources; received ${x16.geometries.length}`);
        GymTests.assert(x16.materials.length<=6,`Saved X16 must stay within six materials; received ${x16.materials.length}`);
        GymTests.assert(x16.summary.triangles<=1200,`Saved X16 must stay near its 1,200-triangle budget; received ${x16.summary.triangles}`);
        GymTests.assert(stair.meshes.length<=56,`Saved Stair must stay within 56 meshes; received ${stair.meshes.length}`);
        GymTests.assert(stair.geometries.length<=24,`Saved Stair must stay within 24 geometry resources; received ${stair.geometries.length}`);
        GymTests.assert(stair.materials.length<=8,`Saved Stair must stay within eight materials; received ${stair.materials.length}`);
        GymTests.assert(stair.summary.geometrySignatures<=24,`Saved Stair must stay within 24 geometry signatures; received ${stair.summary.geometrySignatures}`);
        GymTests.assert(gator.meshes.length<=58,`Saved GATOR must stay within 58 meshes; received ${gator.meshes.length}`);
        GymTests.assert(gator.geometries.length<=26,`Saved GATOR must stay within 26 geometry resources; received ${gator.geometries.length}`);
        GymTests.assert(gator.materials.length<=6,`Saved GATOR must stay within six materials; received ${gator.materials.length}`);
        [x16,stair,gator].forEach(capture=>{
          GymTests.assert(capture.meshes.every(mesh=>typeof mesh.userData.partTag==="string"&&mesh.userData.partTag),"Every featured dedicated mesh must remain semantically tagged");
          GymTests.equal(new Set(capture.clickTargets).size,capture.clickTargets.length,"Featured dedicated click targets must remain unique");
          GymTests.equal(capture.clickTargets.length,capture.meshes.length,"Every featured dedicated mesh must remain a click target");
        });

        fixture.destroy();
        destroyed=true;
        [x16,stair,gator].forEach(capture=>capture.tracked.forEach(record=>{
          GymTests.equal(record.count,1,`Saved featured ${record.kind} must be disposed exactly once; received ${record.count}`);
        }));
        return {x16:x16.summary,stair:stair.summary,gator:gator.summary};
      }finally{
        if(!destroyed) fixture.destroy();
      }
    }

    const first=captureCycle();
    const second=captureCycle();
    GymTests.deepEqual(second,first,"Repeated saved Layout 3 create/destroy cycles must retain stable cardio resource counts");
  });

  GymTests.test("captures invisible sibling meshes from the complete dedicated assembly",()=>{
    const fixture=createSavedLayout3Fixture();
    try{
      const x16=fixture.view.itemGroups.get("inst_x16");
      const tagged=groupMeshes(x16).find(mesh=>String(mesh.userData.partTag||"").startsWith("x16-"));
      const siblingParent=tagged.parent.parent;
      const probeMaterial=fixture.view.material({color:0xffffff});
      const probe=fixture.view.box(
        siblingParent,
        {x:.1,y:.1,z:.1},
        {x:0,y:.1,z:0},
        probeMaterial,
        {instId:"inst_x16",partTag:"x16-invisible-sibling-probe"},
      );
      probe.visible=false;
      const capture=captureDedicatedResources(fixture.view,"inst_x16","x16-");
      GymTests.assert(capture.meshes.includes(probe),"Dedicated capture must include an invisible sibling mesh");
      GymTests.equal(capture.summary.meshes,capture.meshes.length,"Dedicated mesh budgets must include invisible sibling meshes");
      GymTests.equal(
        capture.summary.triangles,
        capture.meshes.reduce((total,mesh)=>total+meshTriangleCount(mesh),0),
        "Dedicated triangle budgets must include invisible sibling meshes",
      );
      GymTests.assert(capture.geometries.includes(probe.geometry),"Dedicated capture must include invisible sibling geometry");
      GymTests.assert(capture.materials.includes(probe.material),"Dedicated capture must include invisible sibling material");
      GymTests.assert(capture.clickTargets.includes(probe),"Dedicated capture must include invisible sibling click targets");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("falls back only the throwing X16 and restores the registry after the assertion",()=>{
    const originalModels=window.GymEquipmentModels;
    const stagedMeshes=[];
    try{
      window.GymEquipmentModels={
        ...originalModels,
        build(profile,view,group,inst,...args){
          if(profile==="nordictrack-x16"){
            const material=view.material({color:0xffffff});
            stagedMeshes.push(
              view.box(group,{x:.2,y:.2,z:.2},{x:0,y:.1,z:0},material,{instId:inst.id,partTag:"x16-test-stage",partIndex:0}),
              view.box(group,{x:.2,y:.2,z:.2},{x:0,y:.3,z:0},material,{instId:inst.id,partTag:"x16-test-stage",partIndex:1}),
            );
            throw new Error("test builder failure");
          }
          return originalModels.build(profile,view,group,inst,...args);
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
        GymTests.equal([...view.itemGroups.keys()].filter(id=>id==="inst_x16").length,1,"X16 failure must create one generic fallback placement");
        GymTests.assert(!groupMeshes(x16).some(mesh=>String(mesh.userData.partTag||"").startsWith("x16-")),"Generic fallback must retain no staged X16 semantic mesh");
        GymTests.assert(!view.clickTargets.some(mesh=>String(mesh.userData.partTag||"").startsWith("x16-")),"Generic fallback must retain no staged X16 click target");
        stagedMeshes.forEach(mesh=>{
          GymTests.assert(!view.disposables.includes(mesh.geometry),"Generic fallback must retain no staged X16 geometry");
          GymTests.assert(!view.disposables.includes(mesh.material),"Generic fallback must retain no staged X16 material");
          GymTests.assert(!mesh.parent,"Generic fallback must retain no staged X16 object");
        });
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
      const restoredX16=restored.view.itemGroups.get("inst_x16");
      GymTests.equal(restoredX16.userData.dedicatedModel,true);
      GymTests.equal([...restored.view.itemGroups.keys()].filter(id=>id==="inst_x16").length,1,"Recovery must restore one dedicated X16 placement");
      GymTests.assert(groupMeshes(restoredX16).some(mesh=>mesh.userData.partTag==="x16-belt"),"Recovery must restore the dedicated tagged X16 assembly");
    }finally{ restored.destroy(); }
  });

  GymTests.test("falls back only the throwing Stair and restores its clean semantic assembly",()=>{
    const originalModels=window.GymEquipmentModels;
    const stagedMeshes=[];
    try{
      window.GymEquipmentModels={
        ...originalModels,
        build(profile,view,group,inst,...args){
          if(profile==="syedee-stair-machine"){
            const material=view.material({color:0xffffff,emissive:0xffffff});
            stagedMeshes.push(
              view.extrudedPanel(group,[{x:-.2,y:0},{x:.2,y:0},{x:.1,y:.3},{x:-.1,y:.3}],.05,{x:0,y:0,z:0},material,{instId:inst.id,partTag:"stair-test-shell",side:"left"}),
              view.beam(group,{x:-.2,y:.05,z:0},{x:.2,y:.05,z:0},.02,.02,material,{instId:inst.id,partTag:"stair-test-light",side:"left",partIndex:0,castShadow:false,receiveShadow:false}),
            );
            throw new Error("test Stair builder failure");
          }
          return originalModels.build(profile,view,group,inst,...args);
        },
      };
      const fixture=createEquipmentDispatchFixture();
      try{
        const {host,view}=fixture;
        const stair=view.itemGroups.get("inst_stair");
        GymTests.equal(view.itemGroups.size,11);
        GymTests.equal(host.dataset.builderFailures,"1");
        GymTests.equal(host.dataset.dedicatedModels,"10");
        GymTests.equal(stair.userData.dedicatedModel,false);
        GymTests.equal(stair.userData.modelBuilder,"");
        GymTests.equal(stair.userData.modelType,"stair climber");
        GymTests.equal([...view.itemGroups.keys()].filter(id=>id==="inst_stair").length,1,"Stair failure must create one generic fallback placement");
        GymTests.assert(!groupMeshes(stair).some(mesh=>String(mesh.userData.partTag||"").startsWith("stair-")),"Generic fallback must retain no staged Stair semantic mesh");
        GymTests.assert(!view.clickTargets.some(mesh=>String(mesh.userData.partTag||"").startsWith("stair-")),"Generic fallback must retain no staged Stair click target");
        stagedMeshes.forEach(mesh=>{
          GymTests.assert(!view.disposables.includes(mesh.geometry),"Generic fallback must retain no staged Stair geometry");
          GymTests.assert(!view.disposables.includes(mesh.material),"Generic fallback must retain no staged Stair material");
          GymTests.assert(!mesh.parent,"Generic fallback must retain no staged Stair object");
        });
        GymTests.assert(host.querySelector("[data-gym3d-warnings]").textContent.includes("Stair Machine"),"The published warning must identify the Stair dedicated fallback");
        GymTests.assert(!host.dataset.modelBuilders.split(",").includes("syedee-stair-machine"),"A failed Stair builder must not appear in successful builder diagnostics");
      }finally{ fixture.destroy(); }
    }finally{
      window.GymEquipmentModels=originalModels;
    }
    const restored=createEquipmentDispatchFixture();
    try{
      GymTests.equal(restored.host.dataset.builderFailures,"0");
      GymTests.equal(restored.host.dataset.dedicatedModels,"11");
      const restoredStair=restored.view.itemGroups.get("inst_stair");
      GymTests.equal(restoredStair.userData.dedicatedModel,true);
      GymTests.equal([...restored.view.itemGroups.keys()].filter(id=>id==="inst_stair").length,1,"Recovery must restore one dedicated Stair placement");
      GymTests.assert(groupMeshes(restoredStair).some(mesh=>mesh.userData.partTag==="stair-side-shroud"),"Recovery must restore the dedicated tagged Stair assembly");
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
