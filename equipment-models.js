(function(){
  "use strict";

  const BUILDERS=Object.create(null);

  function addIntegratedFootRailRibs(view,mesh,size,ribCount,ribDepth){
    if(mesh?.userData){
      mesh.userData.ribCount=ribCount;
      mesh.userData.ribDepth=ribDepth;
    }
    const THREE=globalThis.THREE;
    if(!mesh?.geometry || !THREE?.BoxGeometry || typeof view.geometry!=="function") return mesh;
    const depthSegments=ribCount*2;
    const geometry=view.geometry(new THREE.BoxGeometry(size.x,size.y,size.z,1,1,depthSegments));
    const position=geometry.attributes.position;
    const top=size.y/2;
    for(let index=0;index<position.count;index++){
      if(Math.abs(position.getY(index)-top)>1e-9) continue;
      const progress=(position.getZ(index)+size.z/2)/size.z;
      const station=Math.round(progress*depthSegments);
      if(station%2===1) position.setY(index,top-ribDepth);
    }
    position.needsUpdate=true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const smooth=mesh.geometry;
    mesh.geometry=geometry;
    const index=view.disposables?.lastIndexOf?.(smooth) ?? -1;
    if(index>=0) view.disposables.splice(index,1);
    smooth.dispose?.();
    return mesh;
  }

  function createModelKit(view,group,inst,base,height){
    const w=Math.max(.4,base.w),d=Math.max(.4,base.h),h=Math.max(.45,height);
    const material=spec=>view.material(spec);
    const sharedGeometries=new Map();
    const shareGeometry=(mesh,key)=>{
      if(!key || !mesh?.geometry) return mesh;
      const shared=sharedGeometries.get(key);
      if(!shared){ sharedGeometries.set(key,mesh.geometry); return mesh; }
      const redundant=mesh.geometry;
      mesh.geometry=shared;
      const index=view.disposables?.lastIndexOf?.(redundant) ?? -1;
      if(index>=0) view.disposables.splice(index,1);
      redundant.dispose?.();
      return mesh;
    };
    const addBox=(size,pos,mat,options={})=>shareGeometry(
      view.box(group,size,pos,mat,{...options,instId:inst.id}),options.geometryKey
    );
    const addCylinder=(radius,length,pos,mat,options={})=>shareGeometry(
      view.cylinder(group,radius,length,pos,mat,{...options,instId:inst.id}),options.geometryKey
    );
    const addBeam=(start,end,width,mat,depth=width,options={})=>shareGeometry(
      view.beam(group,start,end,width,depth,mat,{...options,instId:inst.id}),options.geometryKey
    );
    const addTube=(start,end,radius,mat,segments=14,options={})=>shareGeometry(
      view.tube(group,start,end,radius,mat,{...options,instId:inst.id,segments}),options.geometryKey
    );
    const addExtrudedPanel=(points,depth,pos,mat,options={})=>
      shareGeometry(view.extrudedPanel(group,points,depth,pos,mat,{...options,instId:inst.id}),options.geometryKey);
    return {w,d,h,material,addBox,addCylinder,addBeam,addTube,addExtrudedPanel};
  }

  function build(profile,view,group,inst,base,height){
    const builder=BUILDERS[profile];
    if(!builder) return null;
    return {builderKey:profile,modelType:builder(view,group,inst,base,height)};
  }

  function buildIceBarrel500Model(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const shell=material({color:0x0b0d10,roughness:.76,metalness:.08,envMapIntensity:.32});
    const rubber=material({color:0x050607,roughness:.94,metalness:.01,envMapIntensity:.08});
    const water=material({color:0x55c8df,transparent:true,opacity:.45,roughness:.16,metalness:.04,depthWrite:false,envMapIntensity:.5});
    const chrome=material({color:0xbdc7ca,roughness:.2,metalness:.94,envMapIntensity:1.15});
    const inset=material({color:0x020608,roughness:.92,metalness:0,envMapIntensity:.04});
    const rearZ=d*.16;

    // Angular rear tank and low entry step preserve the product's stepped profile.
    addBox({x:w*.9,y:h*.72,z:d*.58},{x:0,y:h*.36,z:rearZ},shell);
    addBox({x:w*.84,y:h*.24,z:d*.28},{x:0,y:h*.12,z:-d*.34},shell);
    addBox({x:w*.8,y:h*.18,z:d*.3},{x:0,y:h*.22,z:-d*.1},shell);
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.42,y:h*.28,z:-d*.22},{x:sign*w*.42,y:h*.78,z:-d*.03},w*.035,shell,d*.055);
      addCylinder(w*.035,h*.62,{x:sign*w*.415,y:h*.46,z:rearZ},shell,{segments:14});
    });

    // Four individual rails keep the dark water well visibly open, never lidded.
    addBox({x:w*.72,y:h*.035,z:d*.055},{x:0,y:h*.81,z:d*.38},rubber);
    addBox({x:w*.72,y:h*.035,z:d*.055},{x:0,y:h*.81,z:-d*.02},rubber);
    [-1,1].forEach(sign=>addBox({x:w*.055,y:h*.035,z:d*.4},{x:sign*w*.36,y:h*.81,z:d*.18},rubber));
    addBox({x:w*.7,y:h*.012,z:d*.4},{x:0,y:h*.77,z:d*.18},water,{castShadow:false,receiveShadow:false});
    addBox({x:w*.66,y:h*.035,z:d*.34},{x:0,y:h*.745,z:d*.18},inset,{castShadow:false});
    addBox({x:w*.78,y:h*.04,z:d*.05},{x:0,y:h*.76,z:-d*.055},rubber);

    // The compact left/rear drain runs outside the shell without widening the footprint.
    addCylinder(w*.024,h*.09,{x:-w*.43,y:h*.17,z:d*.29},chrome,{rotationZ:Math.PI/2,segments:14});
    addTube({x:-w*.45,y:h*.16,z:d*.29},{x:-w*.43,y:h*.06,z:d*.39},w*.012,rubber,12);
    addTube({x:-w*.43,y:h*.06,z:d*.39},{x:-w*.35,y:h*.04,z:d*.42},w*.01,rubber,12);
    return "photo-matched Ice Barrel 500";
  }

  function buildSyedeeStairMachineModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addBeam,addTube,addExtrudedPanel}=createModelKit(view,group,inst,base,height);
    const powder=material({color:0x111417,roughness:.54,metalness:.42,envMapIntensity:.68});
    const shroud=material({color:0x20252a,roughness:.68,metalness:.24,envMapIntensity:.42});
    const inset=material({color:0x090c0f,roughness:.82,metalness:.12,envMapIntensity:.2});
    const tread=material({color:0x090b0d,roughness:.88,metalness:.06,envMapIntensity:.18});
    const rail=material({color:0x080a0c,roughness:.48,metalness:.36,envMapIntensity:.52});
    const screen=material({color:0x0b5367,emissive:0x16b7d4,emissiveIntensity:.72,roughness:.2,metalness:.1,depthWrite:false});
    const white=material({color:0xf3fbff,emissive:0xdffaff,emissiveIntensity:1.4,roughness:.24,metalness:.02});
    const orange=material({color:0xff6b22,emissive:0xff4b0c,emissiveIntensity:1.05,roughness:.32,metalness:.12});

    // Open floor frame and low rear entry keep the staircase visibly suspended.
    const baseRailHalf=w*.055/2;
    [-1,1].forEach(sign=>addBeam(
      {x:sign*w*.37,y:baseRailHalf,z:-d*.43},
      {x:sign*w*.37,y:baseRailHalf,z:d*.43},
      w*.055,powder,w*.055,
      {partTag:"stair-base-rail",side:sign<0?"left":"right",geometryKey:"stair-base-rail"}
    ));
    const crossFootHalf=w*.05/2;
    [-1,1].forEach((sign,index)=>addBeam(
      {x:-w*.40,y:crossFootHalf,z:sign*d*.405},
      {x:w*.40,y:crossFootHalf,z:sign*d*.405},
      w*.05,powder,w*.05,
      {partTag:"stair-cross-foot",partIndex:index,geometryKey:"stair-cross-foot"}
    ));
    addBox(
      {x:w*.66,y:h*.13,z:d*.17},
      {x:0,y:h*.065,z:d*.39},tread,
      {partTag:"stair-entry-step",castShadow:false}
    );

    // One continuous rear-to-front cascade reads as moving stairs, not a plinth.
    for(let index=0;index<8;index++){
      const y=h*(.11+index*.062);
      const z=d*(.34-index*.085);
      addBox({x:w*.60,y:h*.018,z:d*.145},{x:0,y,z},tread,
        {partTag:"stair-tread",partIndex:index,castShadow:false,geometryKey:"stair-tread"});
      if(index<7) addBox({x:w*.60,y:h*.062,z:d*.018},{x:0,y:y+h*.031,z:z-d*.0715},tread,
        {partTag:"stair-riser",partIndex:index,castShadow:false,geometryKey:"stair-riser"});
    }

    const shellPoints=[
      {x:d*.46,y:h*.035},{x:d*.46,y:h*.16},{x:d*.27,y:h*.18},
      {x:-d*.27,y:h*.61},{x:-d*.43,y:h*.61},{x:-d*.43,y:h*.035},
    ];
    const insetPoints=[
      {x:d*.405,y:h*.075},{x:d*.405,y:h*.14},{x:d*.235,y:h*.195},
      {x:-d*.235,y:h*.555},{x:-d*.365,y:h*.555},{x:-d*.365,y:h*.075},
    ];
    [-1,1].forEach(sign=>{
      const side=sign<0?"left":"right";
      addExtrudedPanel(shellPoints,w*.08,{x:sign*w*.44,y:0,z:0},shroud,
        {rotationY:-Math.PI/2,partTag:"stair-side-shroud",side,geometryKey:"stair-side-shroud"});
      addExtrudedPanel(insetPoints,w*.09,{x:sign*w*.44,y:0,z:0},inset,
        {rotationY:-Math.PI/2,partTag:"stair-shroud-inset",side,geometryKey:"stair-shroud-inset"});

      const lightX=sign*w*.488;
      const edgeSegments=[
        [{x:lightX,y:h*.045,z:-d*.43},{x:lightX,y:h*.045,z:d*.41}],
        [{x:lightX,y:h*.045,z:-d*.41},{x:lightX,y:h*.59,z:-d*.41}],
        [{x:lightX,y:h*.19,z:d*.265},{x:lightX,y:h*.59,z:-d*.265}],
      ];
      edgeSegments.forEach(([start,end],partIndex)=>addBeam(
        start,end,w*.012,white,w*.012,
        {partTag:"stair-white-edge-light",side,partIndex,castShadow:false,receiveShadow:false,geometryKey:`stair-white-edge-light-${partIndex}`}
      ));
      addBeam(
        {x:lightX,y:h*.475,z:-d*.10},
        {x:lightX,y:h*.595,z:-d*.25},
        w*.01,orange,w*.01,
        {partTag:"stair-orange-accent",side,partIndex:0,castShadow:false,receiveShadow:false,geometryKey:"stair-orange-accent"}
      );
    });

    // A narrow center mast supports a tilted dark back shell with the cyan face
    // fully forward, so the housing keeps an X/Y bezel without occluding it.
    const consoleTilt=-Math.PI/30;
    addBox({x:w*.13,y:h*.59,z:d*.065},{x:0,y:h*.465,z:-d*.29},powder,
      {partTag:"stair-console-mast"});
    addBox({x:w*.70,y:h*.20,z:d*.04},{x:0,y:h*.86,z:-d*.41},shroud,
      {rotationX:consoleTilt,partTag:"stair-console-housing"});
    addBox({x:w*.60,y:h*.135,z:d*.012},{x:0,y:h*.86,z:-d*.4364},screen,
      {rotationX:consoleTilt,partTag:"stair-console-screen",castShadow:false,receiveShadow:false});

    const railPath=[
      {x:.30*w,y:.22*h,z:.34*d},
      {x:.39*w,y:.55*h,z:.05*d},
      {x:.36*w,y:.76*h,z:-.22*d},
      {x:.27*w,y:.79*h,z:-.35*d},
    ];
    [-1,1].forEach(sign=>{
      const side=sign<0?"left":"right";
      const points=railPath.map(point=>({...point,x:sign*point.x}));
      for(let partIndex=0;partIndex<3;partIndex++) addTube(
        points[partIndex],points[partIndex+1],w*.022,rail,12,
        {partTag:"stair-handrail",side,partIndex,geometryKey:`stair-handrail-${partIndex}`}
      );
      addTube(points[3],{x:sign*w*.22,y:h*.79,z:-d*.43},w*.022,rail,12,
        {partTag:"stair-handrail",side,partIndex:3,geometryKey:"stair-handrail-3"});
    });
    return "photo-matched syedee Stair Machine";
  }

  function buildNordicTrackX16Model(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const frame=material({color:0x0c0f12,roughness:.58,metalness:.34,envMapIntensity:.55});
    const graphite=material({color:0x242a2f,roughness:.7,metalness:.18,envMapIntensity:.34});
    const rubber=material({color:0x050708,roughness:.94,metalness:.01,envMapIntensity:.08});
    const screen=material({color:0x0b5367,emissive:0x0b8da7,emissiveIntensity:.34,roughness:.24,metalness:.12,depthWrite:false});
    const red=material({color:0xb91c1c,roughness:.44,metalness:.2,envMapIntensity:.4});
    const hardware=material({color:0x5d666c,roughness:.46,metalness:.5,envMapIntensity:.62});
    const incline=globalThis.THREE?.MathUtils?.degToRad?.(6) ?? Math.PI/30;
    const beltWidth=22/12,beltLength=60/12,rearTop=13.66/12;
    const beltThickness=.018;
    const deltaY=Math.sin(incline)*beltLength;
    const beltCenterY=rearTop+deltaY/2-beltThickness/2;

    // The measured walking surface rises toward the local -Z console end.
    addBox(
      {x:beltWidth,y:beltThickness,z:beltLength},
      {x:0,y:beltCenterY,z:.03},rubber,
      {rotationX:incline,partTag:"x16-belt",castShadow:false}
    );
    const deckLength=64.5/12,deckThickness=.12;
    const deckCenterY=rearTop-.055+Math.sin(incline)*deckLength/2-deckThickness/2;
    addBox(
      {x:31.5/12,y:deckThickness,z:deckLength},
      {x:0,y:deckCenterY,z:0},graphite,
      {rotationX:incline,partTag:"x16-deck-shell"}
    );
    const footRailLength=61.5/12,footRailWidth=3.4/12,footRailThickness=.055;
    const footRailCenterY=rearTop+.045+Math.sin(incline)*footRailLength/2-footRailThickness/2;
    const footRailSize={x:footRailWidth,y:footRailThickness,z:footRailLength};
    [-1,1].forEach(sign=>{
      const rail=addBox(
        footRailSize,
        {x:sign*(beltWidth+footRailWidth)/2,y:footRailCenterY,z:.03},graphite,
        {
          rotationX:incline,partTag:"x16-foot-rail",side:sign<0?"left":"right",castShadow:false,
          ribCount:8,ribDepth:.012,
        }
      );
      addIntegratedFootRailRibs(view,rail,footRailSize,8,.012);
    });

    const rollerRadius=2.75/24,rollerLength=22.5/12;
    const beltTopAt=z=>beltCenterY-Math.sin(incline)*(z-.03)+Math.cos(incline)*beltThickness/2;
    const frontRollerZ=.03-beltLength/2,rearRollerZ=.03+beltLength/2;
    addCylinder(rollerRadius,rollerLength,{x:0,y:beltTopAt(frontRollerZ)-rollerRadius,z:frontRollerZ},hardware,{
      rotationZ:Math.PI/2,segments:16,partTag:"x16-front-roller",castShadow:false,
    });
    addCylinder(rollerRadius,rollerLength,{x:0,y:beltTopAt(rearRollerZ)-rollerRadius,z:rearRollerZ},hardware,{
      rotationZ:Math.PI/2,segments:16,signature:"x16-rear-roller",partTag:"x16-rear-roller",castShadow:false,
    });

    // Open grounded chassis, transverse ties, four contacts, and one central lift linkage.
    const baseWidth=.12,baseRadius=Math.hypot(baseWidth,baseWidth)/2;
    [-1,1].forEach(sign=>addBeam(
      {x:sign*1.36,y:baseRadius,z:-d/2+baseRadius},
      {x:sign*1.36,y:baseRadius,z:d/2-baseRadius},
      baseWidth,frame,baseWidth,{partTag:"x16-base-rail",side:sign<0?"left":"right"}
    ));
    [-1,1].forEach((sign,index)=>addBeam(
      {x:-w/2+baseRadius,y:baseRadius,z:sign*2.68},
      {x:w/2-baseRadius,y:baseRadius,z:sign*2.68},
      baseWidth,frame,baseWidth,{partTag:"x16-crossmember",partIndex:index}
    ));
    [-1,1].forEach(sign=>[-1,1].forEach((endSign,index)=>addCylinder(
      .085,.07,
      {x:sign*(w/2-.085),y:.035,z:endSign*(d/2-.085)},hardware,
      {segments:12,partTag:"x16-leveling-foot",side:sign<0?"left":"right",partIndex:index}
    )));
    addBeam(
      {x:0,y:.1,z:-2.55},{x:0,y:.95,z:-1.95},
      .1,hardware,.1,{partTag:"x16-lift-actuator",partIndex:0}
    );

    // Three low planes read as the X16's faceted front motor hood.
    addBox({x:2,y:.24,z:.52},{x:0,y:1.72,z:-2.38},graphite,{partTag:"x16-motor-hood",side:"center",partIndex:0});
    [-1,1].forEach((sign,index)=>addBox(
      {x:.22,y:.18,z:.5},{x:sign*1.1,y:1.72,z:-2.38},graphite,
      {rotationZ:-sign*.22,partTag:"x16-motor-hood",side:sign<0?"left":"right",partIndex:index+1}
    ));

    [-1,1].forEach(sign=>addBeam(
      {x:sign*1.1,y:.42,z:-2.37},{x:sign*1.02,y:4.62,z:-1.56},
      .16,frame,.2,{partTag:"x16-incline-upright",side:sign<0?"left":"right"}
    ));
    addBeam(
      {x:0,y:4.62,z:-1.56},{x:0,y:5.08,z:-1.78},
      .15,frame,.18,{partTag:"x16-pivot-neck"}
    );
    addBox({x:32/12,y:.32,z:.26},{x:0,y:5.12,z:-1.86},graphite,{partTag:"x16-console-shell"});
    addBox({x:2.2,y:.12,z:.08},{x:0,y:5.3,z:-2.04},hardware,{partTag:"x16-console-controls",castShadow:false});
    addCylinder(.055,.06,{x:.78,y:5.3,z:-2.12},red,{
      rotationX:Math.PI/2,segments:12,partTag:"x16-stop-key",castShadow:false,
    });
    addBox({x:15/12,y:9/12,z:.11},{x:0,y:5.62,z:-1.99},frame,{partTag:"x16-display-bezel",castShadow:false});
    addBox({x:13.9/12,y:7.8/12,z:.07},{x:0,y:5.62,z:-2.085},screen,{
      partTag:"x16-display-panel",castShadow:false,receiveShadow:false,
    });

    // Three connected molded handle segments on each side reach the measured top silhouette.
    [-1,1].forEach(sign=>{
      const side=sign<0?"left":"right";
      const points=[
        {x:sign*1.16,y:3.25,z:-.95},
        {x:sign*1.4,y:4.25,z:-1.25},
        {x:sign*1.38,y:5.4,z:-1.53},
        {x:sign*.92,y:5.98,z:-1.9},
      ];
      for(let index=0;index<3;index++) addTube(
        points[index],points[index+1],.07,frame,12,
        {partTag:"x16-handrail",side,partIndex:index}
      );
    });
    return "photo-matched NordicTrack X16";
  }

  function buildRitfitGatorBenchModel(view,group,inst,base,height){
    const kit=createModelKit(view,group,inst,base,height);
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=kit;
    const frame=material({color:0x101316,roughness:.56,metalness:.4,envMapIntensity:.68});
    const pad=material({color:0x07090b,roughness:.91,metalness:.01,envMapIntensity:.1});
    const silver=material({color:0xbfc6ca,roughness:.24,metalness:.9,envMapIntensity:1.15});
    const rubber=material({color:0x040506,roughness:.96,metalness:0,envMapIntensity:.05});

    addBox({x:w*.92,y:h*.045,z:d*.07},{x:0,y:h*.025,z:d*.39},frame,{partTag:"gator-rear-stabilizer"});
    addBox({x:w*.72,y:h*.045,z:d*.07},{x:0,y:h*.025,z:-d*.39},frame,{partTag:"gator-front-stabilizer"});
    addBeam({x:0,y:h*.1,z:d*.36},{x:0,y:h*.45,z:-d*.2},w*.09,frame,w*.065,{partTag:"gator-main-spine"});
    [-1,1].forEach((side,index)=>{
      addCylinder(w*.045,w*.075,{x:side*w*.29,y:w*.045,z:d*.36},rubber,{rotationZ:Math.PI/2,partTag:"gator-transport-wheel",side:side<0?"left":"right",partIndex:index,geometryKey:"gator-wheel"});
      addBox({x:w*.13,y:h*.025,z:d*.08},{x:side*w*.38,y:h*.015,z:-d*.39},rubber,{partTag:"gator-foot-pad",side:side<0?"left":"right",geometryKey:"gator-foot-pad"});
    });
    addTube({x:-w*.16,y:h*.09,z:d*.43},{x:w*.16,y:h*.09,z:d*.43},w*.022,rubber,12,{partTag:"gator-lifting-handle"});

    addBox({x:11.8/12,y:2.7/12,z:12.6/12},{x:0,y:h*.34,z:d*.21},pad,{rotationX:-.12,partTag:"gator-seat-pad"});
    addBox({x:11.8/12,y:2.7/12,z:25.9/12},{x:0,y:h*.58,z:-d*.08},pad,{rotationX:-.55,partTag:"gator-back-pad"});
    addBox({x:11.8/12,y:2.7/12,z:9/12},{x:0,y:h*.84,z:-d*.34},pad,{rotationX:-.43,partTag:"gator-head-pad"});
    addBeam({x:0,y:h*.18,z:d*.23},{x:0,y:h*.32,z:d*.18},w*.055,frame,w*.05,{partTag:"gator-seat-support"});
    addBeam({x:0,y:h*.28,z:d*.08},{x:0,y:h*.69,z:-d*.2},w*.06,frame,w*.05,{partTag:"gator-back-support"});
    addBeam({x:0,y:h*.68,z:-d*.2},{x:0,y:h*.81,z:-d*.34},w*.05,frame,w*.045,{partTag:"gator-head-support"});

    addBox({x:w*.52,y:h*.05,z:d*.42},{x:0,y:h*.25,z:d*.03},silver,{rotationX:-.12,partTag:"gator-angle-plate"});
    for(let index=0;index<10;index++){
      const t=index/9;
      addBox({x:w*.035,y:h*.018,z:d*.025},{x:0,y:h*(.20+t*.18),z:d*(.20-t*.34)},rubber,{partTag:"gator-angle-station",partIndex:index,geometryKey:"gator-station",castShadow:false});
    }
    addCylinder(w*.025,w*.38,{x:0,y:h*.31,z:d*.04},silver,{rotationZ:Math.PI/2,partTag:"gator-lock-pin"});
    [h*.68,h*.77].forEach((y,barIndex)=>{
      const z=-d*(.25+barIndex*.06);
      addCylinder(w*.022,w*.78,{x:0,y,z},silver,{rotationZ:Math.PI/2,partTag:"gator-roller-crossbar",partIndex:barIndex,geometryKey:"gator-crossbar"});
      [-1,1].forEach((side,index)=>addCylinder(h*.075,8.7/12,{x:side*w*.3,y,z},rubber,{rotationZ:Math.PI/2,partTag:"gator-foam-roller",side:side<0?"left":"right",partIndex:barIndex*2+index,geometryKey:"gator-roller"}));
    });
    addBeam({x:0,y:h*.08,z:-d*.4},{x:0,y:h*.23,z:-d*.33},w*.055,frame,w*.05,{partTag:"gator-front-brace"});
    return "photo-matched RitFit GATOR bench";
  }

  function buildRogueEchoRowerModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const aluminum=material({color:0x171b1f,roughness:.48,metalness:.62,envMapIntensity:.85});
    const black=material({color:0x06080a,roughness:.83,metalness:.12,envMapIntensity:.24});
    const rubber=material({color:0x030405,roughness:.96,metalness:0,envMapIntensity:.05});
    const nickel=material({color:0xbec7cc,roughness:.2,metalness:.94,envMapIntensity:1.2});
    const screen=material({color:0x0b5367,emissive:0x16a6bd,emissiveIntensity:.55,roughness:.22,metalness:.08});

    addBox({x:w*.22,y:h*.08,z:d*.7},{x:0,y:h*.16,z:d*.12},aluminum,{partTag:"echo-slide-rail"});
    addBox({x:w*.055,y:h*.025,z:d*.66},{x:0,y:h*.205,z:d*.14},black,{partTag:"echo-rail-channel",castShadow:false});
    addBox({x:w*.64,y:h*.05,z:d*.055},{x:0,y:h*.045,z:d*.46},aluminum,{partTag:"echo-rear-foot"});
    addBox({x:w*.42,y:h*.065,z:d*.12},{x:0,y:16/12-h*.032,z:d*.18},black,{partTag:"echo-seat"});
    [-1,1].forEach((side,index)=>addCylinder(w*.035,w*.16,{x:side*w*.12,y:16/12-h*.10,z:d*.18},rubber,{rotationZ:Math.PI/2,partTag:"echo-seat-roller",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-seat-roller"}));
    addBox({x:w*.28,y:h*.05,z:d*.025},{x:0,y:h*.22,z:d*.42},rubber,{partTag:"echo-rail-stop"});

    [-1,1].forEach((side,index)=>addCylinder(w*.36,w*.065,{x:side*w*.035,y:h*.35,z:-d*.34},black,{rotationZ:Math.PI/2,segments:28,partTag:"echo-fan-housing",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-fan-shell"}));
    for(let index=0;index<12;index++){
      const angle=index*Math.PI/6;
      addBeam({x:0,y:h*.35,z:-d*.34},{x:Math.cos(angle)*w*.27,y:h*.35+Math.sin(angle)*w*.27,z:-d*.34},w*.012,black,w*.012,{partTag:"echo-fan-spoke",partIndex:index,geometryKey:"echo-fan-spoke",castShadow:false});
    }
    addCylinder(w*.055,w*.11,{x:0,y:h*.35,z:-d*.34},nickel,{rotationZ:Math.PI/2,segments:16,partTag:"echo-damper"});
    addBox({x:w*.82,y:h*.05,z:d*.055},{x:0,y:h*.04,z:-d*.39},aluminum,{partTag:"echo-front-foot"});
    [-1,1].forEach((side,index)=>{
      const sideName=side<0?"left":"right";
      addCylinder(w*.055,w*.08,{x:side*w*.31,y:w*.055,z:-d*.39},rubber,{rotationZ:Math.PI/2,partTag:"echo-transport-wheel",side:sideName,partIndex:index,geometryKey:"echo-wheel"});
      addCylinder(w*.085,w*.08,{x:side*w*.41,y:w*.085,z:-d*.34},rubber,{rotationZ:Math.PI/2,partTag:"echo-turf-tire",side:sideName,partIndex:index,geometryKey:"echo-tire"});
      addBox({x:w*.26,y:h*.055,z:d*.12},{x:side*w*.17,y:h*.22,z:-d*.18},black,{rotationX:-.42,partTag:"echo-footplate",side:sideName,partIndex:index,geometryKey:"echo-footplate"});
      addBox({x:w*.2,y:h*.025,z:d*.035},{x:side*w*.17,y:h*.245,z:-d*.18},rubber,{rotationX:-.42,partTag:"echo-foot-strap",side:sideName,partIndex:index,geometryKey:"echo-strap",castShadow:false});
      addBox({x:w*.2,y:h*.065,z:d*.025},{x:side*w*.17,y:h*.27,z:-d*.12},rubber,{rotationX:-.42,partTag:"echo-heel-cup",side:sideName,partIndex:index,geometryKey:"echo-heel-cup"});
    });
    addTube({x:0,y:h*.35,z:-d*.29},{x:0,y:h*.42,z:-d*.08},w*.009,nickel,10,{partTag:"echo-chain",castShadow:false});
    addCylinder(w*.022,w*.55,{x:0,y:h*.43,z:-d*.06},black,{rotationZ:Math.PI/2,partTag:"echo-rowing-handle"});
    addBox({x:w*.2,y:h*.035,z:d*.04},{x:0,y:h*.39,z:-d*.14},black,{partTag:"echo-handle-rest"});
    addCylinder(w*.04,w*.42,{x:0,y:h*.2,z:-d*.06},aluminum,{rotationZ:Math.PI/2,partTag:"echo-fold-hinge"});
    addBox({x:w*.12,y:h*.055,z:d*.04},{x:0,y:h*.25,z:-d*.01},black,{partTag:"echo-fold-latch"});
    [-1,1].forEach((side,index)=>addBeam({x:side*w*.12,y:h*.39,z:-d*.25},{x:side*w*.12,y:h*.78,z:-d*.15},w*.025,aluminum,w*.025,{partTag:"echo-monitor-mast",side:side<0?"left":"right",partIndex:index,geometryKey:"echo-monitor-mast"}));
    addBox({x:w*.4,y:h*.17,z:d*.045},{x:0,y:h*.82,z:-d*.14},black,{rotationX:-.1,partTag:"echo-console-shell"});
    addBox({x:3.9/12,y:2.6/12,z:d*.014},{x:0,y:h*.83,z:-d*.17},screen,{rotationX:-.1,partTag:"echo-console-screen",castShadow:false});
    addBox({x:3.45/12,y:h*.025,z:d*.07},{x:0,y:h*.93,z:-d*.11},black,{partTag:"echo-phone-holder"});
    return "photo-matched Rogue Echo Rower";
  }

  function buildBrightwayHS08RowModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const frame=material({color:0x14171a,roughness:.5,metalness:.44,envMapIntensity:.72});
    const black=material({color:0x050607,roughness:.91,metalness:.03,envMapIntensity:.13});
    const shroud=material({color:0x1b2024,roughness:.7,metalness:.2,envMapIntensity:.35});
    const chrome=material({color:0xb8c2c8,roughness:.2,metalness:.9,envMapIntensity:1.1});
    const red=material({color:0xb91c1c,roughness:.42,metalness:.34,envMapIntensity:.72});
    const grip=material({color:0x07090a,roughness:.96,metalness:0,envMapIntensity:.08});
    const plateZ=d*.31;

    // A narrow pair of rails keeps the floor open from the compact user zone to the rear stack.
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.31,y:h*.055,z:-d*.39},{x:sign*w*.31,y:h*.055,z:d*.38},w*.035,frame,w*.045);
      addBox({x:w*.12,y:h*.07,z:d*.23},{x:sign*w*.31,y:h*.06,z:-d*.36},frame);
    });
    addBeam({x:-w*.32,y:h*.08,z:d*.34},{x:w*.32,y:h*.08,z:d*.34},w*.04,frame,w*.04);

    // Full-height rear stack: individually visible black selector plates, rods, and a restrained shroud.
    addBox({x:w*.48,y:h*.7,z:d*.2},{x:0,y:h*.44,z:d*.34},shroud);
    for(let plate=0;plate<11;plate++){
      addBox({x:w*.4,y:h*.038,z:d*.12},{x:0,y:h*(.18+plate*.045),z:plateZ},black,{signature:"hs08-selector-plate"});
    }
    [-1,1].forEach(sign=>{
      addCylinder(w*.018,h*.57,{x:sign*w*.16,y:h*.49,z:d*.28},chrome,{segments:14});
      addBeam({x:sign*w*.23,y:h*.11,z:d*.32},{x:sign*w*.23,y:h*.82,z:d*.32},w*.026,frame,w*.026);
    });
    addBox({x:w*.5,y:h*.055,z:d*.23},{x:0,y:h*.8,z:d*.32},frame);

    // The elevated rear U/yoke feeds two red articulated pull arms down toward the local-front pads.
    addBox({x:w*.72,y:h*.075,z:d*.1},{x:0,y:h*.84,z:d*.31},red,{signature:"hs08-red-yoke"});
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.3,y:h*.83,z:d*.29},{x:sign*w*.3,y:h*.67,z:d*.08},w*.035,red,w*.045);
      addBeam({x:sign*w*.3,y:h*.67,z:d*.08},{x:sign*w*.22,y:h*.43,z:-d*.18},w*.035,red,w*.045);
      addTube({x:sign*w*.22,y:h*.43,z:-d*.18},{x:sign*w*.25,y:h*.38,z:-d*.25},w*.018,red,12);
      addCylinder(w*.032,w*.15,{x:sign*w*.25,y:h*.37,z:-d*.27},grip,{rotationZ:Math.PI/2,segments:14});
    });
    addBox({x:w*.42,y:h*.12,z:d*.28},{x:0,y:h*.25,z:-d*.12},black,{rotationX:-.12});
    addBox({x:w*.44,y:h*.2,z:d*.13},{x:0,y:h*.39,z:-d*.17},black,{rotationX:.42});
    [-1,1].forEach(sign=>{
      addBox({x:w*.24,y:h*.055,z:d*.2},{x:sign*w*.22,y:h*.115,z:-d*.34},shroud,{signature:"hs08-footplate"});
      addBox({x:w*.19,y:h*.015,z:d*.15},{x:sign*w*.22,y:h*.146,z:-d*.34},black,{castShadow:false});
    });
    return "photo-matched Brightway HS08 row";
  }

  function buildShizhuoSeatedStandingRowModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const frame=material({color:0x14181b,roughness:.5,metalness:.45,envMapIntensity:.7});
    const black=material({color:0x07090a,roughness:.94,metalness:.01,envMapIntensity:.08});
    const platform=material({color:0x20262a,roughness:.82,metalness:.12,envMapIntensity:.25});
    const chrome=material({color:0xb9c3c8,roughness:.21,metalness:.88,envMapIntensity:1.1});
    const red=material({color:0xb91c1c,roughness:.42,metalness:.34,envMapIntensity:.7});

    // This is deliberately a low, open chassis: no selector tower or enclosing shroud.
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.28,y:h*.055,z:-d*.36},{x:sign*w*.28,y:h*.055,z:d*.24},w*.04,frame,w*.05);
      addBox({x:w*.14,y:h*.075,z:d*.2},{x:sign*w*.28,y:h*.065,z:d*.25},frame);
    });
    addBox({x:w*.74,y:h*.06,z:d*.36},{x:0,y:h*.1,z:-d*.27},platform);
    for(let stripe=0;stripe<5;stripe++) addBox({x:w*.62,y:h*.012,z:d*.018},{x:0,y:h*.135,z:-d*(.41-stripe*.055)},black,{castShadow:false});
    addBeam({x:-w*.31,y:h*.12,z:-d*.14},{x:w*.31,y:h*.12,z:-d*.14},w*.035,frame,w*.035);
    addCylinder(w*.055,w*.5,{x:0,y:h*.37,z:-d*.03},chrome,{rotationZ:Math.PI/2,segments:16});
    addBox({x:w*.42,y:h*.13,z:d*.25},{x:0,y:h*.31,z:-d*.04},black,{rotationX:-.18});
    addBox({x:w*.48,y:h*.17,z:d*.13},{x:0,y:h*.51,z:d*.02},black,{rotationX:.5});
    [-1,1].forEach(sign=>{
      addBox({x:w*.075,y:h*.43,z:d*.075},{x:sign*w*.27,y:h*.55,z:-d*.03},red,{rotationX:.64,signature:"shizhuo-red-arm"});
      addTube({x:sign*w*.27,y:h*.37,z:-d*.18},{x:sign*w*.3,y:h*.3,z:-d*.27},.018,red,12);
      addCylinder(w*.035,w*.16,{x:sign*w*.31,y:h*.29,z:-d*.29},black,{rotationZ:Math.PI/2,segments:14});
      addCylinder(w*.022,w*.18,{x:sign*w*.29,y:h*.42,z:d*.22},chrome,{rotationZ:Math.PI/2,segments:14,signature:"shizhuo-empty-weight-horn"});
      addCylinder(w*.036,w*.03,{x:sign*w*.39,y:h*.42,z:d*.22},black,{rotationZ:Math.PI/2,segments:14});
    });
    addBeam({x:-w*.24,y:h*.18,z:d*.22},{x:w*.24,y:h*.18,z:d*.22},w*.03,frame,w*.03);
    addBox({x:w*.5,y:h*.045,z:d*.08},{x:0,y:h*.17,z:d*.26},frame);
    return "photo-matched Shizhuo seated-standing row";
  }

  function buildWanjiaComboAdductorModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const frame=material({color:0x15191c,roughness:.5,metalness:.44,envMapIntensity:.7});
    const black=material({color:0x050607,roughness:.94,metalness:.01,envMapIntensity:.08});
    const shroud=material({color:0x20262a,roughness:.7,metalness:.18,envMapIntensity:.32});
    const chrome=material({color:0xbfc8cc,roughness:.2,metalness:.9,envMapIntensity:1.1});
    const red=material({color:0xb91c1c,roughness:.43,metalness:.33,envMapIntensity:.68});

    // Two spaced rails leave the centre work area open and readable from above.
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.34,y:h*.055,z:-d*.37},{x:sign*w*.34,y:h*.055,z:d*.3},w*.038,frame,w*.05,{signature:"wanjia-open-base-rail"});
    });
    addBeam({x:-w*.34,y:h*.07,z:d*.28},{x:w*.34,y:h*.07,z:d*.28},w*.04,frame,w*.04);
    addBox({x:w*.42,y:h*.13,z:d*.24},{x:0,y:h*.22,z:-d*.08},black);
    addBox({x:w*.45,y:h*.2,z:d*.13},{x:0,y:h*.42,z:d*.02},black,{rotationX:.48});

    // Side/rear stack remains dark and separate from the red pad mechanism.
    addBox({x:w*.32,y:h*.68,z:d*.2},{x:w*.27,y:h*.42,z:d*.31},shroud);
    for(let plate=0;plate<10;plate++){
      addBox({x:w*.26,y:h*.042,z:d*.11},{x:w*.27,y:h*(.17+plate*.048),z:d*.31},black,{signature:"wanjia-selector-plate"});
    }
    [-1,1].forEach(sign=>{
      addCylinder(w*.015,h*.57,{x:w*(.27+sign*.095),y:h*.49,z:d*.27},chrome,{segments:14});
    });
    addBox({x:w*.36,y:h*.05,z:d*.22},{x:w*.27,y:h*.79,z:d*.3},frame);

    [-1,1].forEach(sign=>{
      addBox({x:w*.065,y:h*.39,z:d*.08},{x:sign*w*.25,y:h*.51,z:-d*.06},red,{rotationX:sign*.5,signature:"wanjia-red-pivot-arm"});
      addCylinder(h*.05,w*.14,{x:sign*w*.37,y:h*.58,z:-d*.12},black,{rotationZ:Math.PI/2,segments:14});
      addCylinder(h*.05,w*.14,{x:sign*w*.37,y:h*.44,z:-d*.2},black,{rotationZ:Math.PI/2,segments:14});
      addTube({x:sign*w*.34,y:h*.29,z:-d*.21},{x:sign*w*.42,y:h*.22,z:-d*.28},.016,chrome,12);
      addCylinder(w*.026,w*.12,{x:sign*w*.42,y:h*.22,z:-d*.29},black,{rotationZ:Math.PI/2,segments:14});
      addBox({x:w*.18,y:h*.055,z:d*.16},{x:sign*w*.25,y:h*.115,z:-d*.36},frame);
    });
    addBeam({x:-w*.23,y:h*.2,z:-d*.24},{x:w*.23,y:h*.2,z:-d*.24},w*.03,frame,w*.03);
    addBox({x:w*.43,y:h*.055,z:d*.1},{x:0,y:h*.13,z:-d*.38},frame);
    return "photo-matched Wanjia combo adductor";
  }

  function buildYindunThreeTierRackModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addBeam}=createModelKit(view,group,inst,base,height);
    const gray=material({color:0x626b70,roughness:.52,metalness:.5,envMapIntensity:.72});
    const darkRubber=material({color:0x111417,roughness:.93,metalness:.02,envMapIntensity:.1});
    const endX=[-w*.42,w*.42];
    const railTiers=[.34,.55,.76];

    // Two open A-frame ends support the long rails without adding a base slab.
    endX.forEach(x=>{
      [-1,1].forEach(sign=>{
        addBeam({x,y:h*.08,z:sign*d*.39},{x,y:h*.84,z:sign*d*.2},w*.035,gray,w*.045);
        addBeam({x,y:h*.08,z:sign*d*.39},{x,y:h*.84,z:sign*d*.05},w*.03,gray,w*.04);
      });
      addBeam({x,y:h*.08,z:-d*.4},{x,y:h*.08,z:d*.4},w*.035,gray,w*.04);
      addBeam({x,y:h*.84,z:-d*.2},{x,y:h*.84,z:d*.2},w*.03,gray,w*.035);
    });
    railTiers.forEach((tier,tierIndex)=>{
      [-1,1].forEach(sign=>{
        addBeam({x:-w*.38,y:h*(tier-.035),z:sign*d*.24},{x:w*.38,y:h*(tier+.035),z:sign*d*.24},w*.035,gray,w*.045,{signature:"yindun-long-rail"});
      });
      const y=h*tier;
      for(let station=0;station<6;station++){
        const x=w*(-.29+station*.116);
        [-1,1].forEach(sign=>{
          // Opposing dark blocks make one empty V/saddle; the centre gap must remain visible.
          addBox({x:w*.085,y:h*.09,z:d*.12},{x,y,z:sign*d*.18},darkRubber,{rotationX:sign*.34,signature:"yindun-empty-saddle"});
        });
      }
      if(tierIndex<2) addBeam({x:w*.39,y:h*(tier+.04),z:-d*.2},{x:w*.39,y:h*(tier+.04),z:d*.2},w*.025,gray,w*.03);
    });
    addBeam({x:-w*.42,y:h*.12,z:-d*.36},{x:w*.42,y:h*.12,z:d*.36},w*.028,gray,w*.035);
    addBeam({x:-w*.42,y:h*.12,z:d*.36},{x:w*.42,y:h*.12,z:-d*.36},w*.028,gray,w*.035);
    return "photo-matched empty Yindun three-tier rack";
  }

  BUILDERS["ice-barrel-500"]=buildIceBarrel500Model;
  BUILDERS["syedee-stair-machine"]=buildSyedeeStairMachineModel;
  BUILDERS["nordictrack-x16"]=buildNordicTrackX16Model;
  BUILDERS["ritfit-gator-bench"]=buildRitfitGatorBenchModel;
  BUILDERS["rogue-echo-rower"]=buildRogueEchoRowerModel;
  BUILDERS["brightway-hs08-row"]=buildBrightwayHS08RowModel;
  BUILDERS["shizhuo-seated-standing-row"]=buildShizhuoSeatedStandingRowModel;
  BUILDERS["wanjia-combo-adductor"]=buildWanjiaComboAdductorModel;
  BUILDERS["yindun-three-tier-rack"]=buildYindunThreeTierRackModel;

  window.GymEquipmentModels=Object.freeze({has:key=>!!BUILDERS[key],keys:()=>Object.keys(BUILDERS),build,createModelKit});
})();
