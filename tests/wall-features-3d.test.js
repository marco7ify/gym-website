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

function createWallFeature3dFixture({walls=true,invalid=false,extraLeds=0,mode="preview"}={}){
  const settings=wallFeature3dSettings();
  const base=normalizeLayout({
    ...deepCopy(DEFAULT_LAYOUT),
    wallFeatures:GymWallFeatures.layout3Starter(),
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
    GymTests.equal(meshes(mirror).length,6);

    const slat=view.wallFeatureGroups.get("wf_l3_gazelle_slats");
    GymTests.assert(slat.userData.slatCount>=3 && slat.userData.slatCount<=60);
    GymTests.equal(meshes(slat).length,slat.userData.slatCount+1);
    GymTests.assert(meshes(slat).some(mesh=>mesh.material?.roughness===.96),"Expected a felt backer");

    const leds=[...view.wallFeatureGroups.values()].filter(group=>group.userData.wallFeature.kind==="led");
    GymTests.equal(leds.length,4);
    leds.forEach(group=>{
      GymTests.equal(meshes(group).length,2);
      GymTests.equal(pointLights(group).length,1);
      GymTests.equal(pointLights(group)[0].castShadow,false);
      GymTests.assert(meshes(group).some(mesh=>mesh.material?.emissiveIntensity>0),"Expected an emissive diffuser");
    });
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

    const rect=view.renderer.domElement.getBoundingClientRect();
    view.selectAt({clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2});
    GymTests.equal(state.layout.selectedWallFeatureId,id);
    GymTests.equal(state.layout.selectedInstId,null);
    view.updateSelection();
    GymTests.equal(group.userData.selected,true);
    view.frameSelected();
    GymTests.equal(host.dataset.framedSelected,id);
    GymTests.closeTo(view.target.x,focus.x,1e-9);
    GymTests.closeTo(view.target.y,focus.y,1e-9);
    GymTests.closeTo(view.target.z,focus.z,1e-9);
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
