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
    const record=(kind,size,pos,material,options={})=>{
      const part={kind,size,pos,material,options,userData:{}};
      ["instId","partTag","side","partIndex"].forEach(key=>{
        if(options[key]!==undefined) part.userData[key]=options[key];
      });
      parts.push(part);
      return part;
    };
    const view={
      material:spec=>spec,
      box:(group,size,pos,mat,options)=>record("box",size,pos,mat,options),
      cylinder:(group,radius,length,pos,mat,options)=>record("cylinder",{radius,length},pos,mat,options),
      beam:(group,start,end,width,depth,mat,options)=>record("beam",{start,end,radius:Math.hypot(width,depth)/2},{x:0,y:0,z:0},mat,options),
      tube:(group,start,end,radius,mat,options)=>record("tube",{start,end,radius},{x:0,y:0,z:0},mat,options),
      extrudedPanel:(group,points,depth,pos,mat,options)=>record("extruded-panel",{points,depth},pos,mat,options),
    };
    return {parts,view,group:{add(){}}};
  }

  function partsByTag(parts,tag){
    return parts.filter(part=>part.userData.partTag===tag);
  }

  function boxTopAtLocalZ(box,z){
    const rotationX=box.options?.rotationX||0;
    return box.pos.y-Math.sin(rotationX)*(z-box.pos.z)+Math.cos(rotationX)*box.size.y/2;
  }

  function partAabb(part){
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
      return {
        min:{x:part.pos.x-extent[0],y:part.pos.y-extent[1],z:part.pos.z-extent[2]},
        max:{x:part.pos.x+extent[0],y:part.pos.y+extent[1],z:part.pos.z+extent[2]},
      };
    }
    if(part.kind==="cylinder"){
      const {rotationX:rx=0,rotationY:ry=0,rotationZ:rz=0}=part.options||{};
      const sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
      const axis=[-cy*sz,-sx*sy*sz+cx*cz,cx*sy*sz+sx*cz];
      const extent=axis.map(value=>Math.abs(value)*part.size.length/2+Math.sqrt(Math.max(0,1-value*value))*part.size.radius);
      return {
        min:{x:part.pos.x-extent[0],y:part.pos.y-extent[1],z:part.pos.z-extent[2]},
        max:{x:part.pos.x+extent[0],y:part.pos.y+extent[1],z:part.pos.z+extent[2]},
      };
    }
    const radius=part.size.radius;
    const {start,end}=part.size;
    return {
      min:{x:Math.min(start.x,end.x)-radius,y:Math.min(start.y,end.y)-radius,z:Math.min(start.z,end.z)-radius},
      max:{x:Math.max(start.x,end.x)+radius,y:Math.max(start.y,end.y)+radius,z:Math.max(start.z,end.z)+radius},
    };
  }

  function modelAabb(parts){
    const bounds=parts.map(partAabb);
    return {
      min:{
        x:Math.min(...bounds.map(bound=>bound.min.x)),
        y:Math.min(...bounds.map(bound=>bound.min.y)),
        z:Math.min(...bounds.map(bound=>bound.min.z)),
      },
      max:{
        x:Math.max(...bounds.map(bound=>bound.max.x)),
        y:Math.max(...bounds.map(bound=>bound.max.y)),
        z:Math.max(...bounds.map(bound=>bound.max.z)),
      },
    };
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

  function x16ProbeParts(){
    const probe=modelProbe();
    window.GymEquipmentModels.build("nordictrack-x16",probe.view,probe.group,{id:"probe"},{w:3.175,h:5.825},6.1083);
    return probe.parts;
  }

  function x16BeltCandidate(parts){
    return partsByTag(parts,"x16-belt")[0] || parts.find(part=>part.kind==="box" && part.material?.color===0x050708);
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

  GymTests.test("uses the exact 22 by 60 inch X16 belt and 31.5 by 64.5 inch deck",()=>{
    const parts=x16ProbeParts();
    GymTests.deepEqual(x16BeltCandidate(parts)?.size,{x:22/12,y:.018,z:60/12},"X16 belt must measure exactly 22 × 60 in");
    const deck=partsByTag(parts,"x16-deck-shell")[0] || parts.find(part=>part.kind==="box" && part.size.x>2 && part.size.z>4);
    GymTests.deepEqual(deck?.size,{x:31.5/12,y:.12,z:64.5/12},"X16 deck shell must measure exactly 31.5 × 64.5 in");
  });

  GymTests.test("anchors the X16 belt at its measured rear step-up",()=>{
    const belt=x16BeltCandidate(x16ProbeParts());
    const rearZ=belt.pos.z+belt.size.z/2;
    GymTests.closeTo(boxTopAtLocalZ(belt,rearZ),13.66/12,.02,"X16 rear belt top must match the measured 13.66 in step-up");
  });

  GymTests.test("raises the local front of the X16 belt above its rear entry",()=>{
    const belt=x16BeltCandidate(x16ProbeParts());
    const rearZ=belt.pos.z+belt.size.z/2;
    const frontZ=belt.pos.z-belt.size.z/2;
    GymTests.assert(boxTopAtLocalZ(belt,frontZ)>boxTopAtLocalZ(belt,rearZ),"X16 incline is reversed: local -Z must be higher than local +Z");
  });

  GymTests.test("exposes every required X16 semantic part",()=>{
    const parts=x16ProbeParts();
    const tags=[...new Set(parts.map(part=>part.userData.partTag).filter(Boolean))];
    ["x16-base-rail","x16-incline-upright","x16-console-controls","x16-stop-key"].forEach(tag=>{
      GymTests.assert(tags.includes(tag),`X16 semantic contract is missing ${tag}`);
    });
    GymTests.assert(parts.every(part=>part.userData.partTag),"Every visible X16 primitive must carry semantic metadata");
  });

  GymTests.test("keeps the X16 display at a thin true 16 inch proportion",()=>{
    const parts=x16ProbeParts();
    const panel=partsByTag(parts,"x16-display-panel")[0] || parts.find(part=>part.kind==="box" && part.material?.color===0x0b5367);
    const diagonalIn=Math.hypot(panel.size.x,panel.size.y)*12;
    GymTests.assert(diagonalIn>=15.8 && diagonalIn<=16.2,`X16 display diagonal must stay near 16 in; received ${diagonalIn}`);
    GymTests.assert(panel.size.z*12<=1.25,`X16 display panel is too deep; received ${panel.size.z*12} in`);
  });

  GymTests.test("builds the X16 to its measured geometry and complete semantic contract",()=>{
    const envelope={w:3.175,d:5.825,h:6.1083};
    const probe=modelProbe();
    window.GymEquipmentModels.build("nordictrack-x16",probe.view,probe.group,{id:"probe"},{w:envelope.w,h:envelope.d},envelope.h);
    const {parts}=probe;
    const expectedTags=[
      "x16-base-rail","x16-belt","x16-console-controls","x16-console-shell",
      "x16-crossmember","x16-deck-shell","x16-display-bezel","x16-display-panel",
      "x16-foot-rail","x16-front-roller","x16-handrail","x16-incline-upright",
      "x16-leveling-foot","x16-lift-actuator","x16-motor-hood","x16-pivot-neck",
      "x16-rear-roller","x16-stop-key",
    ];

    GymTests.equal(partsByTag(parts,"x16-belt").length,1);
    GymTests.deepEqual(partsByTag(parts,"x16-belt")[0].size,{x:22/12,y:.018,z:60/12});
    GymTests.deepEqual(partsByTag(parts,"x16-deck-shell")[0].size,{x:31.5/12,y:.12,z:64.5/12});
    GymTests.equal(partsByTag(parts,"x16-foot-rail").length,2);
    partsByTag(parts,"x16-foot-rail").forEach(rail=>GymTests.deepEqual(rail.size,{x:3.4/12,y:.055,z:61.5/12}));
    GymTests.equal(partsByTag(parts,"x16-base-rail").length,2);
    GymTests.equal(partsByTag(parts,"x16-incline-upright").length,2);
    GymTests.equal(partsByTag(parts,"x16-front-roller").length,1);
    GymTests.equal(partsByTag(parts,"x16-rear-roller").length,1);
    GymTests.equal(partsByTag(parts,"x16-handrail").length,6);
    GymTests.deepEqual(partsByTag(parts,"x16-handrail").map(part=>[part.userData.side,part.userData.partIndex]),[
      ["left",0],["left",1],["left",2],["right",0],["right",1],["right",2],
    ]);

    const belt=partsByTag(parts,"x16-belt")[0];
    const rearZ=belt.pos.z+belt.size.z/2;
    const frontZ=belt.pos.z-belt.size.z/2;
    GymTests.closeTo(boxTopAtLocalZ(belt,rearZ),13.66/12,.02,"X16 rear belt top must match the measured step-up");
    GymTests.assert(boxTopAtLocalZ(belt,frontZ)>boxTopAtLocalZ(belt,rearZ),"X16 local -Z belt end must be higher than local +Z");

    const panel=partsByTag(parts,"x16-display-panel")[0];
    const diagonalIn=Math.hypot(panel.size.x,panel.size.y)*12;
    GymTests.assert(diagonalIn>=15.8 && diagonalIn<=16.2,`X16 display diagonal must stay near 16 in; received ${diagonalIn}`);
    GymTests.assert(panel.size.z*12<=1.25,"X16 visible display panel must remain thin");

    const handleMaxY=Math.max(...partsByTag(parts,"x16-handrail").map(part=>partAabb(part).max.y))*12;
    GymTests.assert(handleMaxY>=72 && handleMaxY<=73.3,`X16 handle maximum must stay within 72–73.3 in; received ${handleMaxY}`);
    const bounds=modelAabb(parts);
    GymTests.closeTo(bounds.min.y,0,1e-9,"X16 must touch the floor");
    GymTests.assert((bounds.max.x-bounds.min.x)/envelope.w>=.9,"X16 visible geometry must use at least 90% of measured width");
    GymTests.assert((bounds.max.z-bounds.min.z)/envelope.d>=.93,"X16 visible geometry must use at least 93% of measured length");
    GymTests.assert((bounds.max.y-bounds.min.y)/envelope.h>=.98,"X16 visible geometry must use at least 98% of measured height");
    assertRigidEnvelope(parts,envelope);

    GymTests.assert(parts.length<=32,`X16 must stay within 32 visible primitives; received ${parts.length}`);
    GymTests.assert(new Set(parts.map(part=>part.material)).size<=6,"X16 must share at most six materials");
    GymTests.deepEqual([...new Set(parts.map(part=>part.userData.partTag))].sort(),expectedTags);
    GymTests.assert(parts.every(part=>part.userData.instId==="probe" && part.userData.partTag),"Every X16 primitive needs stable semantic metadata");
    ["x16-console-shell","x16-console-controls","x16-stop-key","x16-display-bezel","x16-display-panel","x16-pivot-neck","x16-motor-hood"].forEach(tag=>{
      partsByTag(parts,tag).forEach(part=>GymTests.assert(partAabb(part).max.z<0,`${tag} must remain at local front -Z`));
    });
    GymTests.assert(partAabb(partsByTag(parts,"x16-rear-roller")[0]).min.z>0,"X16 rear roller must remain at local rear +Z");
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

  // The production changes these checks protect: a Task 3 exact profile can
  // silently remain unregistered, lose its photo-defining open-frame parts,
  // or let any rigid tube/beam escape the saved measured envelope.
  GymTests.test("registers Task 3 exact builders with bounded signature geometry",()=>{
    const cases=[
      ["brightway-hs08-row",30,"photo-matched Brightway HS08 row",{w:2.82,d:4.2,h:6.28}],
      ["shizhuo-seated-standing-row",24,"photo-matched Shizhuo seated-standing row",{w:3.67,d:5.21,h:4.18}],
      ["wanjia-combo-adductor",28,"photo-matched Wanjia combo adductor",{w:2.38,d:4.99,h:4.61}],
      ["yindun-three-tier-rack",24,"photo-matched empty Yindun three-tier rack",{w:5.58,d:2.22,h:3.24}],
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

  GymTests.test("keeps HS08 and Wanjia selector stacks at the local rear with individual black plates",()=>{
    const cases=[
      ["brightway-hs08-row",{w:2.82,d:4.2,h:6.28},"hs08-selector-plate",10,12],
      ["wanjia-combo-adductor",{w:2.38,d:4.99,h:4.61},"wanjia-selector-plate",10,10],
    ];
    cases.forEach(([profile,envelope,signature,min,max])=>{
      const probe=modelProbe();
      window.GymEquipmentModels.build(profile,probe.view,probe.group,{id:"probe"},{w:envelope.w,h:envelope.d},envelope.h);
      const plates=signatureParts(probe.parts,signature);
      GymTests.assert(plates.length>=min && plates.length<=max,`${profile} must keep individual selector plates`);
      plates.forEach((plate,index)=>{
        GymTests.equal(plate.kind,"box",`${profile} plate ${index+1} must be a black plate box`);
        GymTests.equal(plate.material.color,0x050607,`${profile} plate ${index+1} must stay black`);
        GymTests.assert(plate.pos.z>0,`${profile} plate ${index+1} must remain behind the user zone`);
      });
    });
  });

  GymTests.test("keeps each Task 3 product's defining open-frame contract",()=>{
    const hs08=modelProbe();
    window.GymEquipmentModels.build("brightway-hs08-row",hs08.view,hs08.group,{id:"probe"},{w:2.82,h:4.2},6.28);
    const hs08Yoke=signatureParts(hs08.parts,"hs08-red-yoke");
    GymTests.equal(hs08Yoke.length,1,"HS08 needs one overhead red rear yoke");
    GymTests.assert(hs08Yoke[0].pos.z>0 && hs08Yoke[0].pos.y>6.28*.7,"HS08 yoke must stay elevated behind the seat");
    GymTests.equal(signatureParts(hs08.parts,"hs08-footplate").length,2,"HS08 needs two separate local-front footplates");

    const shizhuo=modelProbe();
    window.GymEquipmentModels.build("shizhuo-seated-standing-row",shizhuo.view,shizhuo.group,{id:"probe"},{w:3.67,h:5.21},4.18);
    GymTests.equal(signatureParts(shizhuo.parts,"shizhuo-red-arm").length,2,"Shizhuo needs two independent red pull arms");
    GymTests.equal(signatureParts(shizhuo.parts,"shizhuo-empty-weight-horn").length,2,"Shizhuo needs empty opposing weight horns");

    const wanjia=modelProbe();
    window.GymEquipmentModels.build("wanjia-combo-adductor",wanjia.view,wanjia.group,{id:"probe"},{w:2.38,h:4.99},4.61);
    GymTests.equal(signatureParts(wanjia.parts,"wanjia-open-base-rail").length,2,"Wanjia needs two separated open base rails");
    GymTests.equal(signatureParts(wanjia.parts,"wanjia-red-pivot-arm").length,2,"Wanjia needs paired red pivot arms");

    const rack=modelProbe();
    const rackPresentation=equipmentModelPresentation("yindun-three-tier-rack",false,{W:2.22,L:5.58});
    window.GymEquipmentModels.build("yindun-three-tier-rack",rack.view,rack.group,{id:"probe"},rackPresentation.modelBase,3.24);
    GymTests.equal(rack.parts.filter(part=>part.kind==="cylinder").length,0,"Yindun rack must add no dumbbells, bars, plates, or weight cylinders");
    GymTests.equal(signatureParts(rack.parts,"yindun-empty-saddle").length,36,"Yindun needs six paired empty saddles on each of three rail tiers");
    const longRails=signatureParts(rack.parts,"yindun-long-rail");
    GymTests.equal(longRails.length,6,"Yindun needs paired rails on all three tiers");
    longRails.forEach((rail,index)=>{
      GymTests.assert(Math.abs(rail.size.end.x-rail.size.start.x)>4,"Yindun rail "+(index+1)+" must run along its long local X axis");
      GymTests.closeTo(rail.size.end.z,rail.size.start.z,1e-9,"Yindun rail "+(index+1)+" must not shorten along local depth");
    });
  });

  GymTests.test("applies the long-face base and correction only to the exact Yindun rack",()=>{
    const fp={W:2.22,L:5.58};
    exactProfiles.forEach(profile=>{
      const presentation=equipmentModelPresentation(profile,false,fp);
      if(profile==="yindun-three-tier-rack"){
        GymTests.deepEqual(presentation,{longFaceProfile:true,modelBase:{w:5.58,h:2.22},profileFacingRotation:Math.PI/2});
      }else{
        GymTests.deepEqual(presentation,{longFaceProfile:false,modelBase:{w:2.22,h:5.58},profileFacingRotation:0});
      }
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
      "brightway-hs08-row","shizhuo-seated-standing-row","wanjia-combo-adductor","yindun-three-tier-rack",
    ]);
  });
})();
