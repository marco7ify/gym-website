(function(){
  "use strict";

  function settings(){
    return {
      ...DEFAULT_SETTINGS,
      roomWidthFt:19,
      roomWidthIn:10,
      roomLengthFt:19,
      roomLengthIn:6,
      ceilingHeightFt:9,
      ceilingHeightIn:0,
    };
  }

  function createFixture(){
    state.settings=settings();
    state.layout=normalizeLayout({
      ...deepCopy(DEFAULT_LAYOUT),
      areas:[],
      wallFeatures:[],
      spatial3d:{...DEFAULT_LAYOUT.spatial3d,walls:false,wallColor:"black"},
    },state.settings);
    state.items=[];
    state.activeLayoutId="garage-door-builder-test";
    state._roomCache=null;

    const host=document.createElement("div");
    host.className="gym3dFixture";
    host.dataset.gym3d="preview";
    host.innerHTML='<canvas data-gym3d-minimap width="200" height="120"></canvas><div data-gym3d-warnings></div>';
    document.body.appendChild(host);
    const view=new Gym3DView(host,"preview");
    return {
      host,
      view,
      destroy(){
        view.destroy();
        host.remove();
      },
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
})();
