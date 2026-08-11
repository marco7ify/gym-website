(function(){
  "use strict";

  const exactProfiles=[
    "ice-barrel-500",
    "syedee-stair-machine",
    "nordictrack-x16",
    "ritfit-gator-bench",
    "brightway-hs08-row",
    "shizhuo-seated-standing-row",
    "wanjia-combo-adductor",
    "yindun-three-tier-rack",
  ];

  // The production change these checks protect: a builder can be omitted,
  // registered under the wrong profile, or let a rigid primitive escape the
  // measured placement envelope without changing the collision footprint.
  function modelProbe(){
    const parts=[];
    const record=(kind,size,pos,options={})=>{
      parts.push({kind,size,pos,options});
      return {userData:{}};
    };
    const view={
      material:spec=>spec,
      box:(group,size,pos,mat,options)=>record("box",size,pos,options),
      cylinder:(group,radius,length,pos,mat,options)=>record("cylinder",{radius,length},pos,options),
      beam:(group,start,end,width,depth,mat,options)=>record("beam",{start,end,radius:Math.hypot(width,depth)/2},{x:0,y:0,z:0},options),
      tube:(group,start,end,radius,mat,options)=>record("tube",{start,end,radius},{x:0,y:0,z:0},options),
    };
    return {parts,view,group:{add(){}}};
  }

  function assertPointInEnvelope(point,radius,envelope,label){
    GymTests.assert(point.x-radius>=-envelope.w/2-1e-9 && point.x+radius<=envelope.w/2+1e-9,`${label} exceeds width envelope`);
    GymTests.assert(point.y-radius>=-1e-9 && point.y+radius<=envelope.h+1e-9,`${label} exceeds height envelope`);
    GymTests.assert(point.z-radius>=-envelope.d/2-1e-9 && point.z+radius<=envelope.d/2+1e-9,`${label} exceeds depth envelope`);
  }

  function assertRigidEnvelope(parts,envelope){
    parts.forEach((part,index)=>{
      const label=`${part.kind} ${index}`;
      if(part.kind==="box"){
        const {rotationX:rx=0,rotationY:ry=0,rotationZ:rz=0}=part.options||{};
        const sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
        const matrix=[
          [cy*cz,-cy*sz,sy],
          [sx*sy*cz+cx*sz,-sx*sy*sz+cx*cz,-sx*cy],
          [-cx*sy*cz+sx*sz,cx*sy*sz+sx*cz,cx*cy],
        ];
        const half=[part.size.x/2,part.size.y/2,part.size.z/2];
        const extent=matrix.map(row=>row.reduce((sum,value,axis)=>sum+Math.abs(value)*half[axis],0));
        GymTests.assert(Math.abs(part.pos.x)+extent[0]<=envelope.w/2+1e-9,`${label} exceeds width envelope`);
        GymTests.assert(part.pos.y-extent[1]>=-1e-9 && part.pos.y+extent[1]<=envelope.h+1e-9,`${label} exceeds height envelope`);
        GymTests.assert(Math.abs(part.pos.z)+extent[2]<=envelope.d/2+1e-9,`${label} exceeds depth envelope`);
      }else if(part.kind==="cylinder"){
        const {rotationX:rx=0,rotationY:ry=0,rotationZ:rz=0}=part.options||{};
        const sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
        const axis=[-cy*sz,-sx*sy*sz+cx*cz,cx*sy*sz+sx*cz];
        const extent=axis.map(value=>Math.abs(value)*part.size.length/2+Math.sqrt(Math.max(0,1-value*value))*part.size.radius);
        GymTests.assert(Math.abs(part.pos.x)+extent[0]<=envelope.w/2+1e-9,`${label} exceeds width envelope`);
        GymTests.assert(part.pos.y-extent[1]>=-1e-9 && part.pos.y+extent[1]<=envelope.h+1e-9,`${label} exceeds height envelope`);
        GymTests.assert(Math.abs(part.pos.z)+extent[2]<=envelope.d/2+1e-9,`${label} exceeds depth envelope`);
      }else{
        assertPointInEnvelope(part.size.start,part.size.radius,envelope,`${label} start`);
        assertPointInEnvelope(part.size.end,part.size.radius,envelope,`${label} end`);
      }
    });
  }

  function signatureParts(parts,signature){
    return parts.filter(part=>part.options?.signature===signature);
  }

  GymTests.test("registers Task 2 exact builders with bounded signature geometry",()=>{
    const cases=[
      ["ice-barrel-500",10,"photo-matched Ice Barrel 500",{w:2.5583,d:4.8,h:3.5}],
      ["syedee-stair-machine",28,"photo-matched syedee Stair Machine",{w:2.6667,d:4.1667,h:6.8333}],
      ["nordictrack-x16",20,"photo-matched NordicTrack X16",{w:3.175,d:5.825,h:6.1083}],
      ["ritfit-gator-bench",22,"photo-matched RitFit GATOR bench",{w:2.1667,d:4.8333,h:4.4167}],
    ];
    cases.forEach(([profile,minParts,modelType,envelope])=>{
      GymTests.assert(window.GymEquipmentModels.has(profile),`${profile} should be registered`);
      const probe=modelProbe();
      const result=window.GymEquipmentModels.build(profile,probe.view,probe.group,{id:"probe"},{w:envelope.w,h:envelope.d},envelope.h);
      GymTests.equal(result?.builderKey,profile,`${profile} should return its exact builder key`);
      GymTests.equal(result?.modelType,modelType,`${profile} should return its exact model type`);
      GymTests.assert(probe.parts.length>=minParts,`${profile} needs at least ${minParts} signature primitives`);
      assertRigidEnvelope(probe.parts,envelope);
    });
  });

  // These assertions protect the photo-defining rollers: a short X16 center
  // stub or undersized GATOR foam cylinders must not pass the generic count
  // and rigid-envelope checks.
  GymTests.test("keeps the X16 rear roller transverse to the belt at signature scale",()=>{
    const envelope={w:3.175,d:5.825,h:6.1083};
    const probe=modelProbe();
    window.GymEquipmentModels.build("nordictrack-x16",probe.view,probe.group,{id:"probe"},{w:envelope.w,h:envelope.d},envelope.h);
    const rollers=signatureParts(probe.parts,"x16-rear-roller");
    GymTests.equal(rollers.length,1,"X16 needs one tagged rear roller");
    const [roller]=rollers;
    GymTests.equal(roller?.kind,"cylinder","X16 rear roller must be a cylinder");
    GymTests.assert(roller.size.length>=envelope.w*.58 && roller.size.length<=envelope.w*.64,"X16 rear roller must span the belt width");
    GymTests.assert(roller.pos.z>envelope.d*.2,"X16 rear roller must stay at the rear deck end");
  });

  GymTests.test("keeps GATOR foam rollers large and elevated at the local back end",()=>{
    const envelope={w:2.1667,d:4.8333,h:4.4167};
    const probe=modelProbe();
    window.GymEquipmentModels.build("ritfit-gator-bench",probe.view,probe.group,{id:"probe"},{w:envelope.w,h:envelope.d},envelope.h);
    const rollers=signatureParts(probe.parts,"gator-elevated-foam-roller");
    GymTests.equal(rollers.length,4,"GATOR needs four tagged elevated foam rollers");
    rollers.forEach((roller,index)=>{
      GymTests.equal(roller.kind,"cylinder",`GATOR foam roller ${index+1} must be a cylinder`);
      const diameter=roller.size.radius*2;
      GymTests.assert(diameter>=envelope.h*.14 && diameter<=envelope.h*.17,`GATOR foam roller ${index+1} must be photo-scale`);
      GymTests.assert(roller.pos.z<-envelope.d*.04,`GATOR foam roller ${index+1} must remain at the local back/head end`);
      GymTests.assert(roller.pos.y>envelope.h*.6,`GATOR foam roller ${index+1} must remain elevated`);
    });
  });

  GymTests.test("routes each photo-matched item to its exact profile",()=>{
    const cases=[
      [{brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge"},"ice-barrel-500"],
      [{brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning"},"syedee-stair-machine"],
      [{brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning"},"nordictrack-x16"],
      [{brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches"},"ritfit-gator-bench"],
      [{brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper"},"brightway-hs08-row"],
      [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper"},"shizhuo-seated-standing-row"],
      [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"wanjia-combo-adductor"],
      [{brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage"},"yindun-three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>GymTests.equal(equipmentModelProfile(item),expected));
  });

  GymTests.test("keeps broad lookalikes on legacy or standard profiles",()=>{
    const cases=[
      [{brand:"Another Brand",name:"Adjustable Weight Bench",category:"Benches"},"incline-bench"],
      [{brand:"Another Brand",name:"Incline Treadmill",category:"Cardio & Conditioning"},"incline-treadmill"],
      [{brand:"Another Brand",name:"HS08",category:"Selectorized Upper"},"standard"],
      [{brand:"Another Brand",name:"Three-Tier Dumbbell Rack",category:"Storage"},"three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>{
      const profile=equipmentModelProfile(item);
      GymTests.equal(profile,expected);
      GymTests.assert(!exactProfiles.includes(profile),`${item.name} must not receive an exact photo-matched profile`);
    });
  });

  GymTests.test("keeps clone brands and accessory names on broad fallback profiles",()=>{
    const cases=[
      [{brand:"Ice Barrel Clone Co.",name:"Ice Barrel 500",category:"Cold Plunge"},"step-in-plunge"],
      [{brand:"Ice Barrel",name:"Ice Barrel 500 Replacement Lid",category:"Cold Plunge"},"step-in-plunge"],
      [{brand:"syedee Authorized Reseller",name:"Stair Machine",category:"Cardio & Conditioning"},"commercial-stair"],
      [{brand:"syedee",name:"Stair Machine Replacement Console",category:"Cardio & Conditioning"},"commercial-stair"],
      [{brand:"Some NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning"},"incline-treadmill"],
      [{brand:"NordicTrack",name:"X16 Treadmill Walking Deck",category:"Cardio & Conditioning"},"incline-treadmill"],
      [{brand:"RitFit Clone",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches"},"incline-bench"],
      [{brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench Replacement Pad",category:"Benches"},"incline-bench"],
      [{brand:"Shandong Brightway Fitness Reseller",name:"HS08 — Rowing Machine",category:"Selectorized Upper"},"selectorized-seated-row"],
      [{brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine Attachment",category:"Selectorized Upper"},"selectorized-seated-row"],
      [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd. Clone",name:"Seated/standing row",category:"Plate-Loaded Upper"},"seated-standing-row"],
      [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row accessory",category:"Plate-Loaded Upper"},"seated-standing-row"],
      [{brand:"Shandong Wanjia Fitness Equipment Clone",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"adductor-combo"],
      [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor Attachment",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"adductor-combo"],
      [{brand:"Dezhou Yindun Seiko Technology Co., Ltd. Reseller",name:"Three-Tier Dumbbell Rack",category:"Storage"},"three-tier-rack"],
      [{brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack Cover",category:"Storage"},"three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>{
      const profile=equipmentModelProfile(item);
      GymTests.equal(profile,expected);
      GymTests.assert(!exactProfiles.includes(profile),`${item.brand} / ${item.name} must not receive an exact photo-matched profile`);
      GymTests.assert(!itemUsesPhotoMatched3d(item),`${item.brand} / ${item.name} must not receive a photo-matched label`);
    });
  });

  GymTests.test("accepts documented punctuation variants without ignoring extra words",()=>{
    const cases=[
      [{brand:"Dezhou Shizhuo Fitness Technology Co Ltd",name:"Seated - standing row",category:"Plate-Loaded Upper"},"shizhuo-seated-standing-row"],
      [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor and Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"wanjia-combo-adductor"],
      [{brand:"Dezhou Yindun Seiko Technology Co Ltd",name:"Three Tier Dumbbell Rack",category:"Storage"},"yindun-three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>GymTests.equal(equipmentModelProfile(item),expected));
  });

  GymTests.test("requires Wanjia's measured dimensions for its exact profile",()=>{
    const item={brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:5.26,width:1.89,height:5.30};
    GymTests.equal(equipmentModelProfile(item),"adductor-combo");
  });

  GymTests.test("maps exact profiles to their matching families",()=>{
    GymTests.deepEqual(exactProfiles.map(profile=>MODEL3D_PROFILE_FAMILY[profile]),[
      "cold-plunge","stair-climber","treadmill","bench",
      "rowing-machine","rowing-machine","adductor","storage-rack",
    ]);
  });

  GymTests.test("labels only dedicated procedural models as photo-matched",()=>{
    const exactItem={brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge"};
    GymTests.assert(itemUsesPhotoMatched3d(exactItem));
    GymTests.assert(itemUsesPhotoMatched3d({name:"Gazelle Pro",category:"Leg Press"}));
    GymTests.assert(!itemUsesPhotoMatched3d({brand:"Another Brand",name:"Incline Treadmill",category:"Cardio & Conditioning"}));
    GymTests.assert(!itemUsesPhotoMatched3d({...exactItem,model3dAssetRef:"local:ice-barrel.glb"}));
  });

  GymTests.test("exposes task-owned builders without claiming later profiles",()=>{
    GymTests.assert(window.GymEquipmentModels,"Expected the GymEquipmentModels registry namespace");
    ["has","keys","build","createModelKit"].forEach(key=>GymTests.equal(typeof window.GymEquipmentModels[key],"function"));
    GymTests.deepEqual(window.GymEquipmentModels.keys(),[
      "ice-barrel-500","syedee-stair-machine","nordictrack-x16","ritfit-gator-bench",
    ]);
    exactProfiles.slice(4).forEach(profile=>GymTests.assert(!window.GymEquipmentModels.has(profile),`${profile} belongs to a later builder task`));
  });
})();
