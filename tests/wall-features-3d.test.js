function wallFeature3dSettings(){
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

function extraLedFeature(index){
  return {
    id:`wf_extra_led_${index}`,
    kind:"led",
    label:`Extra LED ${index}`,
    wall:"top",
    startFt:0,
    startIn:index,
    bottomFt:6,
    bottomIn:0,
    widthFt:1,
    widthIn:0,
    heightFt:0,
    heightIn:1,
    color:"#ffb36b",
    brightnessPct:70,
  };
}

function createWallFeature3dFixture({walls=true,invalid=false,extraLeds=0,mode="preview",features=null}={}){
  const settings=wallFeature3dSettings();
  const base=normalizeLayout({
    ...deepCopy(DEFAULT_LAYOUT),
    wallFeatures:features||GymWallFeatures.layout3Starter(),
    spatial3d:{...DEFAULT_LAYOUT.spatial3d,walls,wallColor:"black"},
  },settings);
  for(let index=0;index<extraLeds;index++) base.wallFeatures.push(extraLedFeature(index));
  if(invalid){
    base.wallFeatures.push({
      id:"wf_invalid_above_ceiling",
      kind:"led",
      label:"Invalid ceiling LED",
      wall:"top",
      startFt:0,
      widthFt:1,
      bottomFt:9,
      heightIn:1,
      color:"#ffb36b",
      brightnessPct:70,
    });
  }
  state.settings=settings;
  state.layout=base;
  state.items=[];
  state.activeLayoutId="layout3-renderer-test";
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
    destroy(){
      view.destroy();
      host.remove();
    },
  };
}

function meshes(group){
  const result=[];
  group.traverse(object=>{if(object.isMesh) result.push(object);});
  return result;
}

function pointLights(group){
  const result=[];
  group.traverse(object=>{if(object.isPointLight) result.push(object);});
  return result;
}

GymTests.test("builds the exact seven seeded wall features with real material and geometry contracts",()=>{
  const fixture=createWallFeature3dFixture();
  try{
    const {host,view}=fixture;
    GymTests.deepEqual({
      wall:host.dataset.wallFeatures,
      mirror:host.dataset.mirrorFeatures,
      slat:host.dataset.slatFeatures,
      led:host.dataset.ledFeatures,
      invalid:host.dataset.invalidWallFeatures,
    },{wall:"7",mirror:"2",slat:"1",led:"4",invalid:"0"});
    GymTests.deepEqual([...view.wallFeatureGroups.keys()],GymWallFeatures.layout3Starter().map(feature=>feature.id));

    const mirror=view.wallFeatureGroups.get("wf_l3_primary_mirror");
    const mirrorFace=meshes(mirror).find(mesh=>mesh.material?.isMeshPhysicalMaterial);
    GymTests.assert(mirrorFace,"Expected a physical mirror face");
    GymTests.equal(mirrorFace.material.metalness,1);
    GymTests.closeTo(mirrorFace.material.roughness,.04,1e-9);
    GymTests.equal(mirrorFace.material.clearcoat,1);
    GymTests.assert(mirrorFace.material.envMap,"Expected the studio environment map on the mirror face");
    GymTests.equal(meshes(mirror).length,6);
    const backerMaterial=mirror.userData.selectionMaterials[0];
    const frameMaterial=mirror.userData.selectionMaterials[1];
    const backer=meshes(mirror).find(mesh=>mesh.material===backerMaterial);
    const frameMeshes=meshes(mirror).filter(mesh=>mesh.material===frameMaterial);
    GymTests.closeTo(backer.geometry.parameters.depth,1/12,1e-9);
    GymTests.equal(frameMeshes.length,4);
    GymTests.deepEqual(
      frameMeshes.map(mesh=>({width:mesh.geometry.parameters.width,height:mesh.geometry.parameters.height,depth:mesh.geometry.parameters.depth})),
      [
        {width:5,height:.09,depth:.105},
        {width:5,height:.09,depth:.105},
        {width:.09,height:5.32,depth:.105},
        {width:.09,height:5.32,depth:.105},
      ]
    );

    const slat=view.wallFeatureGroups.get("wf_l3_gazelle_slats");
    const feltMaterial=slat.userData.selectionMaterials[0];
    const felt=meshes(slat).find(mesh=>mesh.material===feltMaterial);
    const woodSlats=meshes(slat).filter(mesh=>mesh.material!==feltMaterial).sort((a,b)=>a.position.x-b.position.x);
    GymTests.equal(slat.userData.slatCount,32);
    GymTests.assert(slat.userData.slatCount>=3 && slat.userData.slatCount<=60);
    GymTests.equal(woodSlats.length,32);
    GymTests.closeTo(felt.geometry.parameters.depth,1/12,1e-9);
    GymTests.closeTo((woodSlats[1].position.x-woodSlats[0].position.x)*12,2.5,.05);
    GymTests.equal(felt.material.roughness,.96);

    const leds=[...view.wallFeatureGroups.values()].filter(group=>group.userData.wallFeature.kind==="led");
    GymTests.equal(leds.length,4);
    leds.forEach(group=>{
      GymTests.equal(meshes(group).length,2);
      GymTests.equal(pointLights(group).length,1);
      GymTests.equal(pointLights(group)[0].castShadow,false);
      GymTests.assert(meshes(group).some(mesh=>mesh.material?.emissiveIntensity>0),"Expected an emissive diffuser");
    });
    const mirrorWash=view.wallFeatureGroups.get("wf_l3_mirror_wash");
    const channelMaterial=mirrorWash.userData.selectionMaterials[0];
    const channel=meshes(mirrorWash).find(mesh=>mesh.material===channelMaterial);
    const diffuser=meshes(mirrorWash).find(mesh=>mesh.material!==channelMaterial);
    const light=pointLights(mirrorWash)[0];
    GymTests.equal(channel.material.metalness,.9);
    GymTests.closeTo(channel.geometry.parameters.depth,.075,1e-9);
    GymTests.equal(diffuser.material.color.getHex(),0xffd7aa);
    GymTests.equal(diffuser.material.emissive.getHex(),0xffd7aa);
    GymTests.equal(diffuser.material.transparent,true);
    GymTests.closeTo(diffuser.material.opacity,.82,1e-9);
    GymTests.closeTo(diffuser.material.emissiveIntensity,1.415,1e-9);
    GymTests.equal(light.color.getHex(),0xffd7aa);
    GymTests.closeTo(light.intensity,.273,1e-9);
    GymTests.equal(view.doorCollisionSegments.length,0);
  }finally{ fixture.destroy(); }
});

GymTests.test("omits one invalid seeded-scene addition and publishes its first warning",()=>{
  const fixture=createWallFeature3dFixture({invalid:true});
  try{
    GymTests.equal(fixture.host.dataset.wallFeatures,"7");
    GymTests.equal(fixture.host.dataset.invalidWallFeatures,"1");
    GymTests.equal(fixture.view.wallFeatureGroups.has("wf_invalid_above_ceiling"),false);
    GymTests.assert(fixture.host.querySelector("[data-gym3d-warnings]").textContent.includes("Invalid ceiling LED: This feature rises above the available ceiling height."));
  }finally{ fixture.destroy(); }
});

GymTests.test("restores all seeded renderer counts after Walls is toggled off and on",()=>{
  const off=createWallFeature3dFixture({walls:false});
  try{
    GymTests.deepEqual({
      wall:off.host.dataset.wallFeatures,
      mirror:off.host.dataset.mirrorFeatures,
      slat:off.host.dataset.slatFeatures,
      led:off.host.dataset.ledFeatures,
      invalid:off.host.dataset.invalidWallFeatures,
    },{wall:"0",mirror:"0",slat:"0",led:"0",invalid:"0"});
    GymTests.equal(off.view.wallFeatureGroups.size,0);
  }finally{ off.destroy(); }

  const on=createWallFeature3dFixture({walls:true});
  try{
    GymTests.deepEqual({wall:on.host.dataset.wallFeatures,mirror:on.host.dataset.mirrorFeatures,slat:on.host.dataset.slatFeatures,led:on.host.dataset.ledFeatures},{wall:"7",mirror:"2",slat:"1",led:"4"});
  }finally{ on.destroy(); }
});

GymTests.test("keeps nine LED diffusers emissive while capping feature lights at eight",()=>{
  const fixture=createWallFeature3dFixture({extraLeds:5});
  try{
    const ledGroups=[...fixture.view.wallFeatureGroups.values()].filter(group=>group.userData.wallFeature.kind==="led");
    GymTests.equal(fixture.host.dataset.ledFeatures,"9");
    GymTests.equal(fixture.host.dataset.wallFeatureLights,"8");
    GymTests.equal(ledGroups.length,9);
    GymTests.equal(ledGroups.filter(group=>meshes(group).some(mesh=>mesh.material?.emissiveIntensity>0)).length,9);
    GymTests.equal(ledGroups.reduce((sum,group)=>sum+pointLights(group).length,0),8);
  }finally{ fixture.destroy(); }
});

GymTests.test("selects and frames a seeded mirror through the real 3D paths",()=>{
  const fixture=createWallFeature3dFixture();
  try{
    const {view,host}=fixture;
    const id="wf_l3_primary_mirror";
    const group=view.wallFeatureGroups.get(id);
    GymTests.assert(group.userData.focusPoint);
    GymTests.assert(group.userData.worldFootprint);
    const focus=group.userData.focusPoint;
    view.camera.position.set(focus.x,focus.y,focus.z-5);
    view.camera.lookAt(focus.x,focus.y,focus.z);
    view.camera.updateMatrixWorld(true);
    view.scene.updateMatrixWorld(true);
    GymTests.deepEqual(view.pickTarget(new THREE.Vector2(0,0)),{type:"wallFeature",id});

    state.layout.selectedInstId="inst_competing";
    state.layout.selectedAreaId="area_competing";
    state.layout.selectedOutletId="outlet_competing";
    state.layout.selectedWallExtId="wall_ext_competing";
    state.layout.selectedCeilingZoneId="ceiling_competing";
    state.layout.selectedFloorZoneId="floor_competing";
    state.layout.selectedFlooringId="flooring_competing";
    state.layout.selectedWallFeatureId="wall_feature_competing";
    const rect=view.renderer.domElement.getBoundingClientRect();
    view.selectAt({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2});
    GymTests.equal(state.layout.selectedWallFeatureId,id);
    [
      "selectedInstId",
      "selectedAreaId",
      "selectedOutletId",
      "selectedWallExtId",
      "selectedCeilingZoneId",
      "selectedFloorZoneId",
      "selectedFlooringId",
    ].forEach(field=>GymTests.equal(state.layout[field],null,`Expected ${field} to be cleared`));
    view.updateSelection();
    GymTests.equal(group.userData.selected,true);
    view.frameSelected();
    GymTests.equal(host.dataset.framedSelected,id);
    GymTests.closeTo(view.target.x,focus.x,1e-9);
    GymTests.closeTo(view.target.y,focus.y,1e-9);
    GymTests.closeTo(view.target.z,focus.z,1e-9);
  }finally{ fixture.destroy(); }
});

GymTests.test("publishes literal focus and footprint metadata for all four wall transforms",()=>{
  const features=["top","right","bottom","left"].map(wall=>({
    id:`wf_transform_${wall}`,
    kind:"mirror",
    label:`${wall} transform`,
    wall,
    startFt:1,
    bottomFt:2,
    widthFt:2,
    heightFt:3,
    color:"#cbd5e1",
    brightnessPct:0,
  }));
  const fixture=createWallFeature3dFixture({features});
  try{
    const expected={
      top:{x:2,y:3.5,z:.08,rotationY:0},
      right:{x:19.753333333333334,y:3.5,z:2,rotationY:-Math.PI/2},
      bottom:{x:2,y:3.5,z:19.42,rotationY:Math.PI},
      left:{x:.08,y:3.5,z:2,rotationY:Math.PI/2},
    };
    Object.entries(expected).forEach(([wall,want])=>{
      const group=fixture.view.wallFeatureGroups.get(`wf_transform_${wall}`);
      GymTests.closeTo(group.userData.focusPoint.x,want.x,1e-9);
      GymTests.closeTo(group.userData.focusPoint.y,want.y,1e-9);
      GymTests.closeTo(group.userData.focusPoint.z,want.z,1e-9);
      GymTests.closeTo(group.userData.rotationY,want.rotationY,1e-9);
      GymTests.deepEqual(group.userData.worldFootprint,{widthFt:2,depthFt:.28,heightFt:3});
    });
  }finally{ fixture.destroy(); }
});

GymTests.test("derives horizontal and vertical minimap lines with selected thickness",()=>{
  const fixture=createWallFeature3dFixture({mode:"walkthrough"});
  try{
    const top=fixture.view.wallFeatureGroups.get("wf_l3_cardio_strip");
    const right=fixture.view.wallFeatureGroups.get("wf_l3_aisle_mirror");
    const topLine=fixture.view.wallFeatureMinimapLine(top,"wf_l3_cardio_strip");
    const rightLine=fixture.view.wallFeatureMinimapLine(right,"wf_l3_cardio_strip");
    GymTests.closeTo(topLine.z1,topLine.z2,1e-9);
    GymTests.assert(topLine.x1<topLine.x2);
    GymTests.equal(topLine.lineWidth,4);
    GymTests.closeTo(rightLine.x1,rightLine.x2,1e-9);
    GymTests.assert(rightLine.z1<rightLine.z2);
    GymTests.equal(rightLine.lineWidth,2);
  }finally{ fixture.destroy(); }
});
