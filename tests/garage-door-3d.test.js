(function(){
  "use strict";

  let fixtureSequence=0;

  function settings(overrides={}){
    return {
      ...DEFAULT_SETTINGS,
      roomWidthFt:19,
      roomWidthIn:10,
      roomLengthFt:19,
      roomLengthIn:6,
      ceilingHeightFt:9,
      ceilingHeightIn:0,
      ...overrides,
    };
  }

  function createFixture({
    roomSettings=null,
    areas=[],
    wallExtensions=[],
    floorZones=[],
    items=[],
    instances=[],
    walls=false,
    mode="preview",
    rawAreas=false,
  }={}){
    state.settings=roomSettings||settings();
    state.items=items.map(item=>normalizeItemRecord({...item,unit:item.unit||"ft"}));
    const layout=normalizeLayout({
      ...deepCopy(DEFAULT_LAYOUT),
      garageWallRevision:1,
      areas,
      wallExtensions,
      floorZones,
      instances,
      wallFeatures:[],
      spatial3d:{...DEFAULT_LAYOUT.spatial3d,walls,wallColor:"black",labelMode:"off",clearances:false},
    },state.settings);
    if(rawAreas) layout.areas=deepCopy(areas);
    state.layout=layout;
    state.activeLayoutId=`garage-door-3d-test-${++fixtureSequence}`;
    state._roomCache=null;

    const host=document.createElement("div");
    host.className="gym3dFixture";
    host.dataset.gym3d=mode;
    host.innerHTML='<canvas data-gym3d-minimap width="200" height="120"></canvas><div data-gym3d-warnings></div>';
    document.body.appendChild(host);
    const view=new Gym3DView(host,mode);
    return {
      host,
      view,
      destroy(remove=true){
        view.destroy();
        if(remove) host.remove();
      },
    };
  }

  function feetAndInches(value){
    const feet=Math.floor(value+1e-9);
    return {feet,inches:Math.round((value-feet)*12)};
  }

  function garageArea(id,rect,overrides={}){
    const x=feetAndInches(rect.x),y=feetAndInches(rect.y);
    const width=feetAndInches(rect.w),height=feetAndInches(rect.h);
    return {
      id,
      kind:"garagedoor",
      label:`Garage ${id}`,
      xFt:x.feet,
      xIn:x.inches,
      yFt:y.feet,
      yIn:y.inches,
      widthFt:width.feet,
      widthIn:width.inches,
      heightFt:height.feet,
      heightIn:height.inches,
      garageDoorHeightFt:7,
      garageDoorHeightIn:0,
      garageDoorStyle:"raised-panel",
      garageDoorColor:"#191b1d",
      ...overrides,
    };
  }

  function standardDoorArea(id,rect,overrides={}){
    const x=feetAndInches(rect.x),y=feetAndInches(rect.y);
    const width=feetAndInches(rect.w),height=feetAndInches(rect.h);
    return {
      id,
      kind:"door",
      label:`Door ${id}`,
      xFt:x.feet,
      xIn:x.inches,
      yFt:y.feet,
      yIn:y.inches,
      widthFt:width.feet,
      widthIn:width.inches,
      heightFt:height.feet,
      heightIn:height.inches,
      ...overrides,
    };
  }

  function baseSpec(resources){
    return {
      areaId:"area_l3_bottom_garage_v1",
      widthFt:16,
      heightFt:7,
      ceilingFt:9,
      floorFt:0,
      trackDepthFt:8,
      color:"#191b1d",
      boundary:{wall:"bottom",rotationY:Math.PI,inwardX:0,inwardZ:-1},
      wallMaterial:null,
      preview:true,
      resources,
    };
  }

  function meshes(group){
    const result=[];
    group.traverse(object=>{ if(object.isMesh) result.push(object); });
    return result;
  }

  function parts(group,part){
    return meshes(group).filter(mesh=>mesh.userData.garagePart===part);
  }

  function surfaceEnvelope(group){
    group.updateMatrixWorld(true);
    const inverseGroup=new THREE.Matrix4().copy(group.matrixWorld).invert();
    const envelope=new THREE.Box3();
    let found=false;
    meshes(group).filter(mesh=>mesh.userData.garageSurface).forEach(mesh=>{
      mesh.geometry.computeBoundingBox();
      const box=mesh.geometry.boundingBox.clone();
      const relative=new THREE.Matrix4().multiplyMatrices(inverseGroup,mesh.matrixWorld);
      box.applyMatrix4(relative);
      if(!found){ envelope.copy(box); found=true; }
      else envelope.union(box);
    });
    GymTests.assert(found,"Expected garage surface geometry");
    return envelope;
  }

  function doorDiagnostics(host){
    return {
      openings:host.dataset.doorOpenings,
      standardOpenings:host.dataset.standardDoorOpenings,
      garageOpenings:host.dataset.garageDoorOpenings,
      standard:host.dataset.standardDoorModels,
      garage:host.dataset.garageDoorModels,
      total:host.dataset.doorModels,
      invalid:host.dataset.invalidGarageDoors,
      fallback:host.dataset.garageDoorFallbacks,
      panels:host.dataset.garageDoorPanels,
      tracks:host.dataset.garageDoorTrackPairs,
      colliders:host.dataset.doorColliders,
    };
  }

  function listenerAudit(){
    const originalAdd=EventTarget.prototype.addEventListener;
    const originalRemove=EventTarget.prototype.removeEventListener;
    const active=[];
    const capture=options=>typeof options==="boolean"?options:!!options?.capture;
    EventTarget.prototype.addEventListener=function(type,listener,options){
      originalAdd.call(this,type,listener,options);
      active.push({target:this,type,listener,capture:capture(options)});
    };
    EventTarget.prototype.removeEventListener=function(type,listener,options){
      originalRemove.call(this,type,listener,options);
      const wantedCapture=capture(options);
      const index=active.findIndex(entry=>entry.target===this&&entry.type===type&&entry.listener===listener&&entry.capture===wantedCapture);
      if(index>=0) active.splice(index,1);
    };
    return {
      activeCount:()=>active.length,
      restore(){
        EventTarget.prototype.addEventListener=originalAdd;
        EventTarget.prototype.removeEventListener=originalRemove;
      },
    };
  }

  GymTests.test("publishes the garage-door builder contract",()=>{
    GymTests.assert(window.GymGarageDoor3D,"Expected GymGarageDoor3D");
    GymTests.equal(typeof window.GymGarageDoor3D?.prepareResources,"function");
    GymTests.equal(typeof window.GymGarageDoor3D?.buildRaisedPanel,"function");
    GymTests.equal(typeof window.GymGarageDoor3D?.buildFallback,"function");
  });

  GymTests.test("shares one protected matte-charcoal material set per view and color",()=>{
    const fixture=createFixture();
    try{
      const before=fixture.view.disposables.length;
      const first=window.GymGarageDoor3D.prepareResources(fixture.view,"#191B1D");
      const afterFirst=fixture.view.disposables.length;
      const second=window.GymGarageDoor3D.prepareResources(fixture.view,"#191b1d");
      GymTests.equal(first,second);
      GymTests.equal(afterFirst-before,6);
      GymTests.equal(fixture.view.disposables.length,afterFirst);
      GymTests.equal(first.slab.color.getHex(),0x191b1d);
      GymTests.closeTo(first.slab.roughness,.68,1e-9);
      Object.values(first).forEach(material=>GymTests.assert(fixture.view.disposables.includes(material),"Expected shared material to remain protected by the view"));
    }finally{ fixture.destroy(); }
  });

  GymTests.test("builds the exact four-section sixteen-panel traditional assembly within the wall relief bound",()=>{
    const fixture=createFixture();
    try{
      const resources=window.GymGarageDoor3D.prepareResources(fixture.view,"#191b1d");
      const group=new THREE.Group();
      const collisionsBefore=fixture.view.doorCollisionSegments.length;
      const result=window.GymGarageDoor3D.buildRaisedPanel(fixture.view,group,baseSpec(resources));
      const allMeshes=meshes(group);

      GymTests.deepEqual({
        modelType:result.modelType,
        sectionCount:result.sectionCount,
        panelCount:result.panelCount,
        trackPairs:result.trackPairs,
        widthFt:result.widthFt,
        heightFt:result.heightFt,
        thicknessFt:result.thicknessFt,
      },{
        modelType:"traditional raised-panel garage door",
        sectionCount:4,
        panelCount:16,
        trackPairs:1,
        widthFt:16,
        heightFt:7,
        thicknessFt:2/12,
      });
      GymTests.equal(parts(group,"slab").length,1);
      GymTests.equal(parts(group,"section-seam").length,3);
      GymTests.equal(parts(group,"raised-panel").length,16);
      GymTests.equal(parts(group,"panel-recess").length,16);
      GymTests.equal(parts(group,"jamb").length,2);
      GymTests.equal(parts(group,"head-frame").length,1);
      GymTests.equal(parts(group,"bottom-seal").length,1);
      GymTests.equal(parts(group,"threshold").length,1);
      GymTests.equal(parts(group,"handle").length,1);
      GymTests.equal(parts(group,"section-hinge").length,9);
      GymTests.equal(parts(group,"roller-bracket").length,8);
      GymTests.equal(parts(group,"roller").length,8);
      GymTests.equal(parts(group,"vertical-track").length,2);
      GymTests.equal(parts(group,"curved-track").length,6);
      GymTests.equal(parts(group,"ceiling-track").length,2);
      GymTests.equal(parts(group,"torsion-bar").length,1);
      GymTests.equal(parts(group,"torsion-spring").length,2);
      GymTests.equal(parts(group,"opener-rail").length,1);
      GymTests.equal(parts(group,"opener-motor").length,1);
      GymTests.equal(parts(group,"opener-arm").length,1);
      GymTests.equal(parts(group,"header-infill").length,1);
      GymTests.assert(allMeshes.every(mesh=>typeof mesh.userData.garagePart==="string" && mesh.userData.garagePart.length>0),"Expected every mesh to have a garage part tag");
      const requiredSurfaceParts=new Set(["slab","section-seam","raised-panel","panel-recess"]);
      GymTests.assert(
        allMeshes.filter(mesh=>requiredSurfaceParts.has(mesh.userData.garagePart)).every(mesh=>mesh.userData.garageSurface===true),
        "Expected every slab, section, panel, and recess mesh to participate in the relief envelope",
      );
      GymTests.assert(allMeshes.every(mesh=>Object.values(resources).includes(mesh.material)),"Expected the assembly to use only its shared protected materials");
      GymTests.assert(new Set(allMeshes.map(mesh=>mesh.material)).size<=8,"Expected at most eight garage materials");
      const allowedCasterParts=new Set(["slab","jamb","head-frame","header-infill","opener-motor"]);
      const shadowCasters=allMeshes.filter(mesh=>mesh.castShadow);
      GymTests.assert(shadowCasters.length<=8,"Expected at most eight garage shadow casters");
      GymTests.assert(shadowCasters.every(mesh=>allowedCasterParts.has(mesh.userData.garagePart)),"Expected only the slab, jamb/header assembly, and opener motor to cast shadows");
      GymTests.equal(result.meshCount,allMeshes.length);
      GymTests.equal(result.shadowCasterCount,shadowCasters.length);
      GymTests.equal(fixture.view.doorCollisionSegments.length,collisionsBefore);

      const slab=parts(group,"slab")[0];
      GymTests.closeTo(slab.geometry.parameters.width,16,1e-9);
      GymTests.closeTo(slab.geometry.parameters.height,7,1e-9);
      GymTests.closeTo(slab.geometry.parameters.depth,2/12,1e-9);
      GymTests.equal(slab.material.color.getHex(),0x191b1d);
      const envelope=surfaceEnvelope(group);
      GymTests.assert(envelope.max.z<=.02+1e-9,`Expected surface relief at or below 0.02 ft, received ${envelope.max.z}`);
      GymTests.closeTo(result.interiorInsetFt,envelope.max.z,1e-9);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("adds the full preview header above the base-slab door",()=>{
    const fixture=createFixture();
    try{
      const resources=window.GymGarageDoor3D.prepareResources(fixture.view,"#191b1d");
      const group=new THREE.Group();
      window.GymGarageDoor3D.buildRaisedPanel(fixture.view,group,baseSpec(resources));
      const infill=parts(group,"header-infill")[0];
      GymTests.assert(infill,"Expected header infill in Preview");
      GymTests.closeTo(infill.geometry.parameters.height,2,1e-9);
      GymTests.closeTo(infill.position.y,8,1e-9);

      const raisedGroup=new THREE.Group();
      window.GymGarageDoor3D.buildRaisedPanel(fixture.view,raisedGroup,{...baseSpec(resources),floorFt:.5});
      const raisedInfill=parts(raisedGroup,"header-infill")[0];
      GymTests.closeTo(raisedInfill.geometry.parameters.height,1.5,1e-9);
      GymTests.closeTo(raisedInfill.position.y,8.25,1e-9);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("builds a deterministic closed fallback without a collider",()=>{
    const fixture=createFixture();
    try{
      const resources=window.GymGarageDoor3D.prepareResources(fixture.view,"#191b1d");
      const group=new THREE.Group();
      const collisionsBefore=fixture.view.doorCollisionSegments.length;
      const result=window.GymGarageDoor3D.buildFallback(fixture.view,group,baseSpec(resources));
      GymTests.equal(result.modelType,"simple closed garage fallback");
      GymTests.equal(result.fallback,true);
      GymTests.equal(parts(group,"fallback-slab").length,1);
      GymTests.equal(parts(group,"jamb").length,2);
      GymTests.equal(parts(group,"head-frame").length,1);
      GymTests.equal(parts(group,"bottom-seal").length,1);
      GymTests.equal(parts(group,"header-infill").length,1);
      GymTests.equal(meshes(group).length,6);
      GymTests.assert(meshes(group).every(mesh=>mesh.userData.garagePart),"Expected every fallback mesh to have a garage part tag");
      GymTests.equal(fixture.view.doorCollisionSegments.length,collisionsBefore);
      GymTests.equal(result.meshCount,6);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("integrates the exact Layout 3 garage with physical boundary placement, wall returns, header, framing, and minimap metadata",()=>{
    const area=GymGarageDoors.seededLayout3Area();
    const fixture=createFixture({
      areas:[area],
      wallExtensions:[{
        id:"left_extension",
        label:"Extension",
        wall:"left",
        startFt:14,
        startIn:3,
        lengthFt:5,
        lengthIn:8,
        depthFt:1,
        depthIn:9,
      }],
      walls:true,
    });
    try{
      const {host,view}=fixture;
      GymTests.deepEqual(doorDiagnostics(host),{
        openings:"1",
        standardOpenings:"0",
        garageOpenings:"1",
        standard:"0",
        garage:"1",
        total:"1",
        invalid:"0",
        fallback:"0",
        panels:"16",
        tracks:"1",
        colliders:"0",
      });
      const group=view.garageDoorGroups.get(area.id);
      GymTests.assert(group,"Expected the exact Layout 3 garage group");
      GymTests.closeTo(group.position.x,9+11/12,1e-9);
      GymTests.closeTo(group.position.y,0,1e-9);
      GymTests.closeTo(group.position.z,19.5,1e-9);
      GymTests.closeTo(group.rotation.y,Math.PI,1e-9);
      GymTests.closeTo(group.userData.rotationY,Math.PI,1e-9);
      GymTests.equal(group.userData.boundaryMounted,true);
      GymTests.equal(group.userData.boundaryWall,"bottom");
      GymTests.deepEqual({
        axis:group.userData.garageBoundary.axis,
        fixed:group.userData.garageBoundary.fixed,
        start:group.userData.garageBoundary.start,
        end:group.userData.garageBoundary.end,
        inwardX:group.userData.garageBoundary.inwardX,
        inwardZ:group.userData.garageBoundary.inwardZ,
      },{
        axis:"x",
        fixed:19.5,
        start:1+11/12,
        end:17+11/12,
        inwardX:0,
        inwardZ:-1,
      });
      GymTests.deepEqual(group.userData.worldFootprint,{widthFt:16,depthFt:2/12,heightFt:7});
      GymTests.closeTo(group.userData.focusPoint.x,9+11/12,1e-9);
      GymTests.closeTo(group.userData.focusPoint.y,7*.46,1e-9);
      GymTests.closeTo(group.userData.focusPoint.z,19.15,1e-9);
      GymTests.equal(group.userData.openingWidthFt,16);
      GymTests.equal(group.userData.doorHeightFt,7);
      GymTests.equal(group.userData.floorElevationFt,0);
      GymTests.equal(group.userData.fallback,false);
      GymTests.equal(parts(group,"header-infill").length,1);
      GymTests.closeTo(parts(group,"header-infill")[0].geometry.parameters.height,2,1e-9);
      GymTests.closeTo(parts(group,"header-infill")[0].position.y,8,1e-9);

      const bottom=view.roomBoundarySegments().filter(segment=>segment.axis==="x"&&Math.abs(segment.fixed-19.5)<1e-9);
      GymTests.assert(bottom.some(segment=>Math.abs((segment.mid-segment.length/2)-0)<1e-9&&Math.abs((segment.mid+segment.length/2)-(1+11/12))<1e-9),"Expected the left 1 ft 11 in base-wall return");
      GymTests.assert(bottom.some(segment=>Math.abs((segment.mid-segment.length/2)-(17+11/12))<1e-9&&Math.abs((segment.mid+segment.length/2)-(19+10/12))<1e-9),"Expected the right 1 ft 11 in base-wall return");

      state.layout.selectedInstId=null;
      state.layout.selectedWallFeatureId=null;
      state.layout.selectedAreaId=area.id;
      view.frameSelected();
      GymTests.equal(host.dataset.framedSelected,area.id);
      GymTests.closeTo(view.target.x,group.userData.focusPoint.x,1e-9);
      GymTests.closeTo(view.target.y,group.userData.focusPoint.y,1e-9);
      GymTests.closeTo(view.target.z,group.userData.focusPoint.z,1e-9);
      GymTests.assert(view.camera.position.z<group.userData.focusPoint.z,"Expected the Layout 3 camera inside the bottom wall");
      GymTests.equal(view.frameCandidateBlocked(group,group.userData.focusPoint,view.orbit.radius,view.orbit.theta,view.orbit.phi),false);

      const selectedLine=view.garageDoorMinimapLine(group,area.id);
      const plainLine=view.garageDoorMinimapLine(group,"other");
      GymTests.deepEqual(selectedLine,{
        x1:1+11/12,
        z1:19.5,
        x2:17+11/12,
        z2:19.5,
        color:"#f59e0b",
        lineWidth:4,
      });
      GymTests.equal(plainLine.lineWidth,3);
      GymTests.equal(view.garageDoorMinimapSegments.length,1);
      GymTests.equal(view.doorCollisionSegments.length,0);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("resolves and frames top, right, bottom, and left garages from each safe interior normal",()=>{
    const areas=[
      garageArea("top",{x:2,y:0,w:6,h:1}),
      garageArea("right",{x:19,y:2,w:1,h:6}),
      garageArea("bottom",{x:2,y:19,w:6,h:1}),
      garageArea("left",{x:0,y:2,w:1,h:6}),
    ];
    const fixture=createFixture({
      roomSettings:settings({roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0}),
      areas,
      walls:true,
    });
    try{
      const expected={
        top:{position:{x:5,z:0},focus:{x:5,z:.35},rotationY:0,inward:{x:0,z:1}},
        right:{position:{x:20,z:5},focus:{x:19.65,z:5},rotationY:-Math.PI/2,inward:{x:-1,z:0}},
        bottom:{position:{x:5,z:20},focus:{x:5,z:19.65},rotationY:Math.PI,inward:{x:0,z:-1}},
        left:{position:{x:0,z:5},focus:{x:.35,z:5},rotationY:Math.PI/2,inward:{x:1,z:0}},
      };
      GymTests.deepEqual(doorDiagnostics(fixture.host),{
        openings:"4",
        standardOpenings:"0",
        garageOpenings:"4",
        standard:"0",
        garage:"4",
        total:"4",
        invalid:"0",
        fallback:"0",
        panels:"64",
        tracks:"4",
        colliders:"0",
      });
      areas.forEach(area=>{
        const want=expected[area.id];
        const group=fixture.view.garageDoorGroups.get(area.id);
        GymTests.closeTo(group.position.x,want.position.x,1e-9);
        GymTests.closeTo(group.position.z,want.position.z,1e-9);
        GymTests.closeTo(group.userData.focusPoint.x,want.focus.x,1e-9);
        GymTests.closeTo(group.userData.focusPoint.y,7*.46,1e-9);
        GymTests.closeTo(group.userData.focusPoint.z,want.focus.z,1e-9);
        GymTests.closeTo(group.rotation.y,want.rotationY,1e-9);
        GymTests.closeTo(group.userData.rotationY,want.rotationY,1e-9);
        GymTests.closeTo(fixture.view.garageDoorTrackDepth(group.userData.garageBoundary),8,1e-9);

        state.layout.selectedInstId=null;
        state.layout.selectedWallFeatureId=null;
        state.layout.selectedAreaId=area.id;
        fixture.view.frameSelected();
        GymTests.equal(fixture.host.dataset.framedSelected,area.id);
        const cameraVector={
          x:fixture.view.camera.position.x-group.userData.focusPoint.x,
          z:fixture.view.camera.position.z-group.userData.focusPoint.z,
        };
        const cameraLength=Math.hypot(cameraVector.x,cameraVector.z)||1;
        GymTests.assert((cameraVector.x*want.inward.x+cameraVector.z*want.inward.z)/cameraLength>.999,"Expected framing along the physical inward normal");
        GymTests.equal(fixture.view.frameCandidateBlocked(group,group.userData.focusPoint,fixture.view.orbit.radius,fixture.view.orbit.theta,fixture.view.orbit.phi),false);
      });
      GymTests.equal(fixture.view.doorCollisionSegments.length,0);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("leaves the current camera unchanged when every boundary framing candidate crosses equipment",()=>{
    const area=garageArea("blocked",{x:7,y:0,w:6,h:1});
    const fixture=createFixture({
      roomSettings:settings({roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0}),
      areas:[area],
      items:[{id:"blocker",name:"Room-sized blocker",category:"Storage",width:20,length:20,height:1}],
      instances:[{id:"inst_blocker",itemId:"blocker",xFt:0,yFt:0,rotated:false}],
      walls:true,
    });
    try{
      GymTests.assert(fixture.view.itemGroups.has("inst_blocker"),"Expected the real equipment obstruction");
      const group=fixture.view.garageDoorGroups.get(area.id);
      state.layout.selectedInstId=null;
      state.layout.selectedWallFeatureId=null;
      state.layout.selectedAreaId=area.id;
      const before={
        position:fixture.view.camera.position.toArray(),
        target:fixture.view.target.toArray(),
        orbit:{...fixture.view.orbit},
        framed:fixture.host.dataset.framedSelected||"",
      };
      fixture.view.frameSelected();
      GymTests.deepEqual({
        position:fixture.view.camera.position.toArray(),
        target:fixture.view.target.toArray(),
        orbit:{...fixture.view.orbit},
        framed:fixture.host.dataset.framedSelected||"",
      },before);
      GymTests.assert(fixture.view.frameCandidateBlocked(group,group.userData.focusPoint,6,0,1.06),"Expected the real blocker to reject an interior candidate");
    }finally{ fixture.destroy(); }
  });

  GymTests.test("keeps an off-boundary garage invalid, unbuilt, and unable to cut the room wall",()=>{
    const area=garageArea("off_boundary",{x:5,y:5,w:4,h:1});
    const fixture=createFixture({
      roomSettings:settings({roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0}),
      areas:[area],
      walls:true,
    });
    try{
      GymTests.deepEqual(doorDiagnostics(fixture.host),{
        openings:"1",
        standardOpenings:"0",
        garageOpenings:"0",
        standard:"0",
        garage:"0",
        total:"0",
        invalid:"1",
        fallback:"0",
        panels:"0",
        tracks:"0",
        colliders:"0",
      });
      GymTests.equal(fixture.view.resolvedGarageDoors[0].resolution.code,"off-boundary");
      GymTests.equal(fixture.view.garageDoorGroups.size,0);
      GymTests.closeTo(fixture.view.rawBoundarySegments.reduce((sum,segment)=>sum+segment.length,0),80,1e-9);
      GymTests.closeTo(fixture.view.roomBoundarySegments().reduce((sum,segment)=>sum+segment.length,0),80,1e-9);
      GymTests.assert(fixture.host.querySelector("[data-gym3d-warnings]").textContent.includes("Opening must lie on a room boundary."));
    }finally{ fixture.destroy(); }
  });

  GymTests.test("keeps a left-extension missing-span garage invalid without removing either boundary interval",()=>{
    const area=garageArea("missing_span",{x:0,y:13,w:1/12,h:5.5});
    const fixture=createFixture({
      areas:[area],
      rawAreas:true,
      wallExtensions:[{
        id:"left_extension",
        label:"Extension",
        wall:"left",
        startFt:14,
        startIn:3,
        lengthFt:5,
        lengthIn:8,
        depthFt:1,
        depthIn:9,
      }],
      walls:true,
    });
    try{
      GymTests.equal(fixture.view.resolvedGarageDoors[0].resolution.code,"missing-boundary-span");
      GymTests.equal(fixture.host.dataset.invalidGarageDoors,"1");
      GymTests.equal(fixture.host.dataset.garageDoorOpenings,"0");
      GymTests.equal(fixture.view.garageDoorGroups.size,0);
      GymTests.closeTo(
        fixture.view.roomBoundarySegments().reduce((sum,segment)=>sum+segment.length,0),
        fixture.view.rawBoundarySegments.reduce((sum,segment)=>sum+segment.length,0),
        1e-9,
      );
      GymTests.assert(fixture.host.querySelector("[data-gym3d-warnings]").textContent.includes("Opening must cover one continuous room-boundary span."));
    }finally{ fixture.destroy(); }
  });

  GymTests.test("preserves the standard hinged-door model, opening count, and one physical swing collider",()=>{
    const area=standardDoorArea("entry",{x:2,y:0,w:3,h:1},{doorSwing:"down",doorHinge:"start"});
    const fixture=createFixture({
      roomSettings:settings({roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0}),
      areas:[area],
      walls:true,
    });
    try{
      GymTests.deepEqual(doorDiagnostics(fixture.host),{
        openings:"1",
        standardOpenings:"1",
        garageOpenings:"0",
        standard:"1",
        garage:"0",
        total:"1",
        invalid:"0",
        fallback:"0",
        panels:"0",
        tracks:"0",
        colliders:"1",
      });
      const group=fixture.view.areaGroups.get(area.id);
      GymTests.equal(group.userData.modelType,"open architectural door");
      GymTests.equal(group.userData.openAngleDeg,72);
      GymTests.equal(group.userData.boundaryMounted,undefined);
      GymTests.equal(fixture.view.garageDoorGroups.size,0);
      GymTests.equal(fixture.view.doorCollisionSegments.length,1);
    }finally{ fixture.destroy(); }
  });

  GymTests.test("rolls back a throwing same-color detail stage while preserving the first door and a closed shared-resource fallback",()=>{
    const originalBuilder=window.GymGarageDoor3D;
    const wrappedMaterials=new Set();
    const materialDisposals=new Map();
    const goodGeometries=[];
    const failedGeometries=[];
    const failedGeometryDisposals=new Map();
    let fixture=null;
    let destroyed=false;
    try{
      window.GymGarageDoor3D={
        ...originalBuilder,
        prepareResources(view,color){
          const resources=originalBuilder.prepareResources(view,color);
          Object.values(resources).forEach(material=>{
            if(wrappedMaterials.has(material)) return;
            wrappedMaterials.add(material);
            materialDisposals.set(material,0);
            material.addEventListener("dispose",()=>materialDisposals.set(material,materialDisposals.get(material)+1));
          });
          return resources;
        },
        buildRaisedPanel(view,group,spec){
          const result=originalBuilder.buildRaisedPanel(view,group,spec);
          const geometries=meshes(group).map(mesh=>mesh.geometry);
          if(spec.areaId!=="garage_bad"){
            goodGeometries.push(...geometries);
            return result;
          }
          failedGeometries.push(...geometries);
          geometries.forEach(geometry=>{
            failedGeometryDisposals.set(geometry,0);
            geometry.addEventListener("dispose",()=>failedGeometryDisposals.set(geometry,failedGeometryDisposals.get(geometry)+1));
          });
          throw new Error("forced detail failure after geometry");
        },
      };
      fixture=createFixture({
        roomSettings:settings({roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0}),
        areas:[
          garageArea("garage_good",{x:2,y:0,w:6,h:1}),
          garageArea("garage_bad",{x:12,y:19,w:6,h:1}),
        ],
        walls:true,
      });
      const {host,view}=fixture;
      GymTests.deepEqual(doorDiagnostics(host),{
        openings:"2",
        standardOpenings:"0",
        garageOpenings:"2",
        standard:"0",
        garage:"2",
        total:"2",
        invalid:"0",
        fallback:"1",
        panels:"16",
        tracks:"1",
        colliders:"0",
      });
      const good=view.garageDoorGroups.get("garage_good");
      const bad=view.garageDoorGroups.get("garage_bad");
      GymTests.equal(parts(good,"raised-panel").length,16);
      GymTests.equal(parts(good,"fallback-slab").length,0);
      GymTests.equal(parts(bad,"raised-panel").length,0);
      GymTests.equal(parts(bad,"fallback-slab").length,1);
      GymTests.equal(parts(bad,"fallback-slab")[0].visible,true);
      GymTests.equal(bad.userData.fallback,true);
      GymTests.equal(view.garageMaterialCache.size,1);
      GymTests.equal(wrappedMaterials.size,6);
      GymTests.assert([...materialDisposals.values()].every(count=>count===0),"Rollback must keep all shared materials live");
      GymTests.assert(goodGeometries.every(geometry=>view.disposables.includes(geometry)),"The successful same-color door must remain registered");
      GymTests.assert(failedGeometries.length>0,"Expected a partially built failing detail stage");
      GymTests.assert(failedGeometries.every(geometry=>failedGeometryDisposals.get(geometry)===1),"Every failed-stage geometry must be disposed exactly once during rollback");
      GymTests.assert(failedGeometries.every(geometry=>!view.disposables.includes(geometry)),"Failed-stage geometries must leave renderer disposables");
      GymTests.equal(view.garageDoorWarnings.length,1);
      GymTests.assert(view.garageDoorWarnings[0].includes("Garage garage_bad"));
      GymTests.equal(view.doorCollisionSegments.length,0);

      fixture.destroy(false);
      destroyed=true;
      GymTests.assert([...materialDisposals.values()].every(count=>count===1),"Normal destroy must dispose every shared garage material once");
      GymTests.equal(fixture.host.querySelectorAll("canvas.gym3dCanvas").length,0);
      fixture.host.remove();
    }finally{
      window.GymGarageDoor3D=originalBuilder;
      if(fixture&&!destroyed) fixture.destroy();
    }
  });

  GymTests.test("creates and destroys the integrated garage twice with bounded resources and balanced listeners",()=>{
    const audit=listenerAudit();
    const sceneMeshCounts=[];
    const garageMeshCounts=[];
    try{
      for(let pass=0;pass<2;pass++){
        const fixture=createFixture({
          roomSettings:settings({roomWidthFt:20,roomWidthIn:0,roomLengthFt:20,roomLengthIn:0}),
          areas:[garageArea("bounded",{x:2,y:19,w:16,h:1})],
          walls:true,
        });
        const group=fixture.view.garageDoorGroups.get("bounded");
        const garageMeshes=meshes(group);
        const allSceneMeshes=meshes(fixture.view.scene);
        const resources=[...fixture.view.garageMaterialCache.values()][0];
        const disposalCounts=new Map();
        Object.values(resources).forEach(material=>{
          disposalCounts.set(material,0);
          material.addEventListener("dispose",()=>disposalCounts.set(material,disposalCounts.get(material)+1));
        });
        sceneMeshCounts.push(allSceneMeshes.length);
        garageMeshCounts.push(garageMeshes.length);
        GymTests.assert(new Set(garageMeshes.map(mesh=>mesh.material)).size<=8,"Expected at most eight unique garage materials");
        GymTests.assert(garageMeshes.filter(mesh=>mesh.castShadow).length<=8,"Expected at most eight garage shadow casters");
        GymTests.equal(fixture.view.garageMaterialCache.size,1);
        GymTests.assert(audit.activeCount()>0,"Expected live view event listeners before destroy");

        fixture.destroy(false);
        GymTests.equal(fixture.host.querySelectorAll("canvas.gym3dCanvas").length,0);
        GymTests.assert([...disposalCounts.values()].every(count=>count===1),"Expected one disposal for every shared material");
        GymTests.equal(audit.activeCount(),0,"Expected every registered DOM listener to be balanced on destroy");
        fixture.host.remove();
      }
      GymTests.equal(sceneMeshCounts[0],sceneMeshCounts[1]);
      GymTests.equal(garageMeshCounts[0],garageMeshCounts[1]);
    }finally{ audit.restore(); }
  });
})();
