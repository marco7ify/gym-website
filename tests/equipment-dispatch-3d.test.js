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

  function createEquipmentDispatchFixture({items=dedicatedItems}={}){
    state.settings=fixtureSettings();
    state.items=items.map(item=>normalizeItemRecord({...item,unit:"ft"}));
    state.layout=normalizeLayout({
      ...deepCopy(DEFAULT_LAYOUT),
      spatial3d:{...DEFAULT_LAYOUT.spatial3d,walls:false,labelMode:"off",clearances:false},
      instances:state.items.map((item,index)=>({
        id:`inst_${item.id}`,
        itemId:item.id,
        x:(index%4)*8,
        y:Math.floor(index/4)*8,
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
