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
      beam:(group,start,end,width,depth,mat,options)=>record("beam",{start,end,width,depth,radius:Math.hypot(width,depth)/2},{x:0,y:0,z:0},mat,options),
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
    if(part.kind==="extruded-panel"){
      const {rotationX:rx=0,rotationY:ry=0,rotationZ:rz=0}=part.options||{};
      const sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
      const matrix=[
        [cy*cz,-cy*sz,sy],
        [sx*sy*cz+cx*sz,-sx*sy*sz+cx*cz,-sx*cy],
        [-cx*sy*cz+sx*sz,cx*sy*sz+sx*cz,cx*cy],
      ];
      const vertices=part.size.points.flatMap(point=>[-part.size.depth/2,part.size.depth/2].map(z=>({
        x:part.pos.x+matrix[0][0]*point.x+matrix[0][1]*point.y+matrix[0][2]*z,
        y:part.pos.y+matrix[1][0]*point.x+matrix[1][1]*point.y+matrix[1][2]*z,
        z:part.pos.z+matrix[2][0]*point.x+matrix[2][1]*point.y+matrix[2][2]*z,
      })));
      return {
        min:{
          x:Math.min(...vertices.map(vertex=>vertex.x)),
          y:Math.min(...vertices.map(vertex=>vertex.y)),
          z:Math.min(...vertices.map(vertex=>vertex.z)),
        },
        max:{
          x:Math.max(...vertices.map(vertex=>vertex.x)),
          y:Math.max(...vertices.map(vertex=>vertex.y)),
          z:Math.max(...vertices.map(vertex=>vertex.z)),
        },
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

  function assertRigidEnvelope(parts,envelope,{requirePartTags=false,touchFloor=false}={}){
    parts.forEach((part,index)=>{
      const label=`${part.kind} ${index}`;
      if(requirePartTags) GymTests.assert(part.userData.partTag,`${label} needs a stable partTag`);
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
      }else if(part.kind==="extruded-panel"){
        const bounds=partAabb(part);
        GymTests.assert(bounds.min.x>=-envelope.w/2-1e-9 && bounds.max.x<=envelope.w/2+1e-9,`${label} exceeds width envelope`);
        GymTests.assert(bounds.min.y>=-1e-9 && bounds.max.y<=envelope.h+1e-9,`${label} exceeds height envelope`);
        GymTests.assert(bounds.min.z>=-envelope.d/2-1e-9 && bounds.max.z<=envelope.d/2+1e-9,`${label} exceeds depth envelope`);
      }else{
        if(part.kind==="beam" && Math.abs(part.size.start.y-part.size.end.y)<1e-9){
          const yHalf=Math.max(part.size.width,part.size.depth)/2;
          [part.size.start,part.size.end].forEach((point,pointIndex)=>{
            GymTests.assert(point.x-part.size.radius>=-envelope.w/2-1e-9 && point.x+part.size.radius<=envelope.w/2+1e-9,`${label} point ${pointIndex} exceeds width envelope`);
            GymTests.assert(point.y-yHalf>=-1e-9 && point.y+yHalf<=envelope.h+1e-9,`${label} point ${pointIndex} exceeds height envelope`);
            GymTests.assert(point.z-part.size.radius>=-envelope.d/2-1e-9 && point.z+part.size.radius<=envelope.d/2+1e-9,`${label} point ${pointIndex} exceeds depth envelope`);
          });
        }else{
          assertPointInEnvelope(part.size.start,part.size.radius,envelope,`${label} start`);
          assertPointInEnvelope(part.size.end,part.size.radius,envelope,`${label} end`);
        }
      }
    });
    if(touchFloor) GymTests.closeTo(modelAabb(parts).min.y,0,1e-9,"Rigid assembly must touch the floor");
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

  function stairProbeParts(){
    const probe=modelProbe();
    window.GymEquipmentModels.build("syedee-stair-machine",probe.view,probe.group,{id:"probe"},{w:2.6667,h:4.1667},6.8333);
    return probe.parts;
  }

  function gatorProbeParts(){
    const probe=modelProbe();
    window.GymEquipmentModels.build("ritfit-gator-bench",probe.view,probe.group,{id:"gator-probe"},{w:26/12,h:58/12},53/12);
    return probe.parts;
  }

  function orderedMetadata(parts){
    return parts.map(part=>[part.userData.side,part.userData.partIndex]);
  }

  function geometrySignature(part){
    if(part.kind==="box") return `box:${part.size.x},${part.size.y},${part.size.z}`;
    if(part.kind==="cylinder") return `cylinder:${part.size.radius},${part.size.length},${part.options?.segments||16}`;
    if(part.kind==="extruded-panel") return `extruded:${JSON.stringify(part.size.points)}:${part.size.depth}`;
    const {start,end,radius}=part.size;
    return `${part.kind}:${Math.hypot(end.x-start.x,end.y-start.y,end.z-start.z)}:${radius}:${part.options?.segments||0}`;
  }

  GymTests.test("registers Task 2 exact builders with bounded signature geometry",()=>{
    const cases=[
      ["ice-barrel-500",10,"photo-matched Ice Barrel 500",{w:2.5583,d:4.8,h:3.5}],
      ["syedee-stair-machine",28,"photo-matched syedee Stair Machine",{w:2.6667,d:4.1667,h:6.8333}],
      ["nordictrack-x16",20,"photo-matched NordicTrack X16",{w:3.175,d:5.825,h:6.1083}],
      ["ritfit-gator-bench",22,"photo-matched RitFit GATOR bench",{w:26/12,d:58/12,h:53/12}],
    ];
    cases.forEach(([profile,minParts,modelType,envelope])=>{
      GymTests.assert(window.GymEquipmentModels.has(profile),`${profile} should be registered`);
      const probe=modelProbe();
      const result=window.GymEquipmentModels.build(profile,probe.view,probe.group,{id:"probe"},{w:envelope.w,h:envelope.d},envelope.h);
      GymTests.equal(result?.builderKey,profile,`${profile} should return its exact builder key`);
      GymTests.equal(result?.modelType,modelType,`${profile} should return its exact model type`);
      GymTests.assert(probe.parts.length>=minParts,`${profile} needs at least ${minParts} signature primitives`);
      assertRigidEnvelope(probe.parts,envelope,{
        requirePartTags:profile==="ritfit-gator-bench",
        touchFloor:profile==="ritfit-gator-bench",
      });
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
    partsByTag(parts,"x16-foot-rail").forEach(rail=>{
      GymTests.deepEqual(rail.size,{x:3.4/12,y:.055,z:61.5/12});
      GymTests.equal(rail.options.ribCount,8,"Each X16 foot rail must publish eight integrated transverse ribs");
      GymTests.assert(rail.options.ribDepth>0,"Each X16 foot rail must publish a visible rib depth");
    });
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

  GymTests.test("replaces the Stair plinth with an open base and eight connected tread-riser stages",()=>{
    const w=2.6667,d=4.1667,h=6.8333;
    const parts=stairProbeParts();
    const treads=partsByTag(parts,"stair-tread");
    const risers=partsByTag(parts,"stair-riser");
    GymTests.equal(treads.length,8,"Stair cascade needs exactly eight tagged treads");
    GymTests.equal(risers.length,7,"Stair cascade needs exactly seven tagged risers");
    GymTests.deepEqual(treads.map(part=>part.userData.partIndex),[0,1,2,3,4,5,6,7]);
    GymTests.deepEqual(risers.map(part=>part.userData.partIndex),[0,1,2,3,4,5,6]);
    treads.forEach((part,index)=>{
      GymTests.deepEqual(part.size,{x:w*.60,y:h*.018,z:d*.145});
      GymTests.closeTo(part.pos.y,h*(.11+index*.062),1e-9);
      GymTests.closeTo(part.pos.z,d*(.34-index*.085),1e-9);
      GymTests.equal(part.options.castShadow,false,"Tread surfaces must stay shadowless");
    });
    risers.forEach((part,index)=>{
      GymTests.deepEqual(part.size,{x:w*.60,y:h*.062,z:d*.018});
      GymTests.closeTo(part.pos.y,h*(.11+index*.062+.031),1e-9);
      GymTests.closeTo(part.pos.z,d*(.34-index*.085-.0715),1e-9);
      GymTests.equal(part.options.castShadow,false,"Riser faces must stay shadowless");
    });
    GymTests.equal(partsByTag(parts,"stair-entry-step").length,1,"Stair needs one low rear entry step");
    GymTests.equal(partsByTag(parts,"stair-base-rail").length,2,"Stair needs two open longitudinal base rails");
    GymTests.deepEqual(orderedMetadata(partsByTag(parts,"stair-base-rail")),[["left",undefined],["right",undefined]]);
    partsByTag(parts,"stair-base-rail").forEach(part=>GymTests.closeTo(part.size.start.y,w*.055/2,1e-9,"Base rails must touch the floor"));
    GymTests.assert(partsByTag(parts,"stair-cross-foot").length>=2,"Stair needs front and rear cross feet");
    GymTests.deepEqual(partsByTag(parts,"stair-cross-foot").map(part=>part.userData.partIndex),[0,1]);
    partsByTag(parts,"stair-cross-foot").forEach(part=>GymTests.closeTo(part.size.start.y,w*.05/2,1e-9,"Cross feet must touch the floor"));
    const bulkyPlinth=parts.filter(part=>part.kind==="box" && part.pos.y<h*.3
      && part.size.x>=w*.5 && part.size.y>=h*.1 && part.size.z>=d*.19
      && part.userData.partTag!=="stair-entry-step");
    GymTests.equal(bulkyPlinth.length,0,"The open Stair base must not retain the bulky center plinth");
  });

  GymTests.test("uses paired exact polygon Stair shrouds with semantic white and orange edge lighting",()=>{
    const w=2.6667,d=4.1667,h=6.8333;
    const parts=stairProbeParts();
    const shellPoints=[
      {x:d*.46,y:h*.035},{x:d*.46,y:h*.16},{x:d*.27,y:h*.18},
      {x:-d*.27,y:h*.61},{x:-d*.43,y:h*.61},{x:-d*.43,y:h*.035},
    ];
    const shrouds=partsByTag(parts,"stair-side-shroud");
    const insets=partsByTag(parts,"stair-shroud-inset");
    GymTests.equal(shrouds.length,2,"Stair needs two extruded polygon side shrouds");
    GymTests.equal(insets.length,2,"Stair needs two smaller polygon shroud insets");
    GymTests.deepEqual(orderedMetadata(shrouds),[["left",undefined],["right",undefined]]);
    GymTests.deepEqual(orderedMetadata(insets),[["left",undefined],["right",undefined]]);
    shrouds.forEach(part=>{
      GymTests.equal(part.kind,"extruded-panel");
      GymTests.deepEqual(part.size.points,shellPoints,"Stair shell must preserve the approved normalized side profile");
      GymTests.closeTo(Math.abs(part.pos.x),w*.44,1e-9);
      GymTests.closeTo(part.options.rotationY,-Math.PI/2,1e-9,"Polygon X must map toward matching local Z");
      const lowRearZ=-Math.sin(part.options.rotationY)*part.size.points[0].x;
      const highFrontZ=-Math.sin(part.options.rotationY)*part.size.points[4].x;
      GymTests.assert(lowRearZ>0 && highFrontZ<0 && part.size.points[4].y>part.size.points[0].y,"Stair shell must rise from rear +Z toward front -Z");
    });
    insets.forEach(part=>{
      GymTests.equal(part.kind,"extruded-panel");
      const shellBounds={
        minX:Math.min(...shellPoints.map(point=>point.x)),maxX:Math.max(...shellPoints.map(point=>point.x)),
        minY:Math.min(...shellPoints.map(point=>point.y)),maxY:Math.max(...shellPoints.map(point=>point.y)),
      };
      const insetBounds={
        minX:Math.min(...part.size.points.map(point=>point.x)),maxX:Math.max(...part.size.points.map(point=>point.x)),
        minY:Math.min(...part.size.points.map(point=>point.y)),maxY:Math.max(...part.size.points.map(point=>point.y)),
      };
      GymTests.assert(insetBounds.minX>shellBounds.minX && insetBounds.maxX<shellBounds.maxX
        && insetBounds.minY>shellBounds.minY && insetBounds.maxY<shellBounds.maxY,
      "Each shroud inset must stay strictly inside the outer shell bounds");
    });
    const lights=partsByTag(parts,"stair-white-edge-light");
    const leftLights=lights.filter(part=>part.userData.side==="left");
    const rightLights=lights.filter(part=>part.userData.side==="right");
    GymTests.assert(leftLights.length>=2,"Stair needs a perimeter edge-light set on the left side");
    GymTests.equal(rightLights.length,leftLights.length,"Stair needs matching white edge-light sets on both sides");
    GymTests.deepEqual(leftLights.map(part=>part.userData.partIndex),leftLights.map((part,index)=>index));
    GymTests.deepEqual(rightLights.map(part=>part.userData.partIndex),rightLights.map((part,index)=>index));
    const leftVertical=leftLights.find(part=>Math.abs(part.size.start.z-part.size.end.z)<1e-9 && part.size.start.y!==part.size.end.y);
    const leftDiagonal=leftLights.find(part=>part.size.start.z!==part.size.end.z && part.size.start.y!==part.size.end.y);
    GymTests.assert(leftVertical && leftVertical.size.start.z<0,"White perimeter light must climb the local front -Z edge");
    GymTests.assert(leftDiagonal && leftDiagonal.size.end.y>leftDiagonal.size.start.y && leftDiagonal.size.end.z<leftDiagonal.size.start.z,"White diagonal light must rise toward local front -Z");
    GymTests.assert(lights.every(part=>part.material.emissive && part.options.castShadow===false && part.options.receiveShadow===false),"All Stair white edge lights must be emissive and shadowless");
    const accents=partsByTag(parts,"stair-orange-accent");
    GymTests.equal(accents.length,2,"Stair needs one short orange upper accent per side");
    GymTests.deepEqual(orderedMetadata(accents),[["left",0],["right",0]]);
    GymTests.assert(accents.every(part=>Math.min(part.size.start.y,part.size.end.y)>=h*.45 && part.size.end.y>part.size.start.y && part.size.end.z<part.size.start.z),"Orange accents must occupy the upper diagonal and rise toward local front -Z");
    GymTests.assert(accents.every(part=>part.material.emissive && part.options.castShadow===false && part.options.receiveShadow===false),"All Stair orange accents must be emissive and shadowless");
  });

  GymTests.test("keeps the Stair console landscape and the paired handrail paths at approved proportions",()=>{
    const w=2.6667,d=4.1667,h=6.8333;
    const parts=stairProbeParts();
    const housing=partsByTag(parts,"stair-console-housing")[0];
    const screen=partsByTag(parts,"stair-console-screen")[0];
    GymTests.equal(partsByTag(parts,"stair-console-housing").length,1,"Stair needs one console housing");
    GymTests.equal(partsByTag(parts,"stair-console-screen").length,1,"Stair needs one console screen");
    GymTests.deepEqual(housing.size,{x:w*.70,y:h*.20,z:d*.04});
    GymTests.closeTo(housing.pos.y,h*.86,1e-9);
    GymTests.closeTo(housing.pos.z,-d*.41,1e-9);
    GymTests.deepEqual(screen.size,{x:w*.60,y:h*.135,z:d*.012});
    GymTests.assert(screen.size.x>screen.size.y,"Stair console screen must be landscape");
    GymTests.closeTo(housing.options.rotationX,-Math.PI/30,1e-9,"Stair console housing needs the approved slight viewing tilt");
    GymTests.closeTo(screen.options.rotationX,housing.options.rotationX,1e-9,"Stair housing and screen must tilt together");
    GymTests.assert(screen.pos.x-screen.size.x/2>=housing.pos.x-housing.size.x/2
      && screen.pos.x+screen.size.x/2<=housing.pos.x+housing.size.x/2
      && screen.pos.y-screen.size.y/2>=housing.pos.y-housing.size.y/2
      && screen.pos.y+screen.size.y/2<=housing.pos.y+housing.size.y/2,
    "Stair screen must retain a dark housing border on X and Y");
    GymTests.assert(
      screen.pos.z+screen.size.z/2<housing.pos.z-housing.size.z/2,
      "Stair screen must sit visibly in front of the opaque console back shell",
    );
    GymTests.assert(screen.material.emissive && screen.options.castShadow===false && screen.options.receiveShadow===false,"Stair screen must be emissive and shadowless");

    const rails=partsByTag(parts,"stair-handrail");
    GymTests.equal(rails.length,8,"Stair needs three rail path segments and one forward grip on each side");
    GymTests.deepEqual(orderedMetadata(rails),[
      ["left",0],["left",1],["left",2],["left",3],
      ["right",0],["right",1],["right",2],["right",3],
    ]);
    const expectedLeft=[
      [{x:-.30*w,y:.22*h,z:.34*d},{x:-.39*w,y:.55*h,z:.05*d}],
      [{x:-.39*w,y:.55*h,z:.05*d},{x:-.36*w,y:.76*h,z:-.22*d}],
      [{x:-.36*w,y:.76*h,z:-.22*d},{x:-.27*w,y:.79*h,z:-.35*d}],
    ];
    rails.slice(0,3).forEach((part,index)=>{
      GymTests.deepEqual([part.size.start,part.size.end],expectedLeft[index]);
      GymTests.closeTo(part.size.radius,.022*w,1e-9);
      GymTests.equal(part.options.segments,12);
    });
    rails.slice(4,7).forEach((part,index)=>{
      const [start,end]=expectedLeft[index].map(point=>({...point,x:-point.x}));
      GymTests.deepEqual([part.size.start,part.size.end],[start,end]);
      GymTests.closeTo(part.size.radius,.022*w,1e-9);
      GymTests.equal(part.options.segments,12);
    });
    GymTests.assert(rails[3].size.end.z<rails[3].size.start.z && rails[7].size.end.z<rails[7].size.start.z,"Both short grips must project forward toward local -Z");
  });

  GymTests.test("publishes a bounded and economical Stair semantic assembly",()=>{
    const envelope={w:2.6667,d:4.1667,h:6.8333};
    const parts=stairProbeParts();
    const expectedTags=[
      "stair-base-rail","stair-console-housing","stair-console-mast","stair-console-screen",
      "stair-cross-foot","stair-entry-step","stair-handrail",
      "stair-orange-accent","stair-riser","stair-shroud-inset","stair-side-shroud","stair-tread",
      "stair-white-edge-light",
    ];
    GymTests.assert(parts.every(part=>part.userData.instId==="probe" && part.userData.partTag),"Every visible Stair primitive needs stable semantic metadata");
    GymTests.deepEqual([...new Set(parts.map(part=>part.userData.partTag))].sort(),expectedTags);
    assertRigidEnvelope(parts,envelope);
    GymTests.assert(parts.length<=56,`Stair must stay within 56 visible primitives; received ${parts.length}`);
    GymTests.assert(new Set(parts.map(part=>part.material)).size<=8,"Stair must share at most eight materials");
    GymTests.assert(new Set(parts.map(geometrySignature)).size<=24,"Stair must reuse at most 24 distinct geometry signatures");
  });

  GymTests.test("builds the GATOR pads at official proportions",()=>{
    const parts=gatorProbeParts();
    const sizes=Object.fromEntries(["seat","back","head"].map(name=>{
      const part=partsByTag(parts,`gator-${name}-pad`)[0];
      GymTests.assert(part,`Missing GATOR ${name} pad`);
      return [name,part.size];
    }));
    GymTests.closeTo(sizes.seat.z,12.6/12,.03);
    GymTests.closeTo(sizes.back.z,25.9/12,.03);
    GymTests.closeTo(sizes.head.z,9/12,.03);
    [sizes.seat,sizes.back,sizes.head].forEach(size=>{
      GymTests.closeTo(size.x,11.8/12,.03);
      GymTests.closeTo(size.y,2.7/12,.025);
    });
  });

  GymTests.test("exposes the complete GATOR adjustment and transport assembly",()=>{
    const parts=gatorProbeParts();
    GymTests.equal(partsByTag(parts,"gator-angle-station").length,10);
    GymTests.equal(partsByTag(parts,"gator-foam-roller").length,4);
    GymTests.equal(partsByTag(parts,"gator-roller-crossbar").length,2);
    GymTests.equal(partsByTag(parts,"gator-transport-wheel").length,2);
    ["gator-main-spine","gator-front-stabilizer","gator-rear-stabilizer","gator-lifting-handle","gator-angle-plate","gator-lock-pin","gator-front-brace"].forEach(tag=>{
      GymTests.assert(partsByTag(parts,tag).length>0,`Missing ${tag}`);
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

  GymTests.test("matches only the exact Rogue Echo Rower profile",()=>{
    GymTests.equal(inferEquipmentModelProfile({brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning"}),"rogue-echo-rower");
    GymTests.equal(equipmentModelProfile({brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning",model3dFamily:"auto",model3dProfile:"auto"}),"rogue-echo-rower");
    [
      {brand:"Rogue",name:"Echo Rower"},
      {brand:"Rogue Fitness",name:"Rogue Echo Rower Replacement Strap"},
      {brand:"Concept2",name:"RowErg"},
    ].forEach(item=>GymTests.equal(inferEquipmentModelProfile({...item,category:"Cardio & Conditioning"}),"standard"));
  });

  GymTests.test("treats Echo saved height as seat height without mutating its footprint",()=>{
    const item={brand:"Rogue Fitness",name:"Rogue Echo Rower",category:"Cardio & Conditioning",unit:"in",width:26,length:99,height:16};
    const before=deepCopy(item);
    const fp=footprint(item);
    GymTests.closeTo(equipmentModelVisualHeight("rogue-echo-rower",fp,9),3.25,1e-9);
    GymTests.deepEqual(footprint(item),{W:26/12,L:99/12,H:16/12,area:(26/12)*(99/12)});
    GymTests.deepEqual(item,before);
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
