(function(){
  "use strict";

  const BUILDERS=Object.create(null);

  function createModelKit(view,group,inst,base,height){
    const w=Math.max(.4,base.w),d=Math.max(.4,base.h),h=Math.max(.45,height);
    const material=spec=>view.material(spec);
    const addBox=(size,pos,mat,options={})=>view.box(group,size,pos,mat,{...options,instId:inst.id});
    const addCylinder=(radius,length,pos,mat,options={})=>view.cylinder(group,radius,length,pos,mat,{...options,instId:inst.id});
    const addBeam=(start,end,width,mat,depth=width,options={})=>view.beam(group,start,end,width,depth,mat,{...options,instId:inst.id});
    const addTube=(start,end,radius,mat,segments=14,options={})=>view.tube(group,start,end,radius,mat,{...options,instId:inst.id,segments});
    return {w,d,h,material,addBox,addCylinder,addBeam,addTube};
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
    const {w,d,h,material,addBox,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const powder=material({color:0x111417,roughness:.54,metalness:.42,envMapIntensity:.68});
    const shroud=material({color:0x20252a,roughness:.68,metalness:.24,envMapIntensity:.42});
    const tread=material({color:0x090b0d,roughness:.88,metalness:.06,envMapIntensity:.18});
    const rail=material({color:0x080a0c,roughness:.48,metalness:.36,envMapIntensity:.52});
    const warm=material({color:0xffe1aa,emissive:0xffc56b,emissiveIntensity:.8,roughness:.35,metalness:.04});
    const amber=material({color:0xd96b24,emissive:0xa44513,emissiveIntensity:.48,roughness:.38,metalness:.18});
    for(let i=0;i<8;i++){
      addBox({x:w*.62,y:h*.035,z:d*.16},{x:0,y:h*(.12+i*.065),z:d*(.31-i*.075)},tread);
    }
    [-1,1].forEach(sign=>{
      addBox({x:w*.13,y:h*.55,z:d*.42},{x:sign*w*.34,y:h*.37,z:d*.12},shroud,{rotationX:-.2});
      addBeam({x:sign*w*.34,y:h*.09,z:d*.4},{x:sign*w*.34,y:h*.62,z:-d*.12},w*.075,shroud,d*.12);
      addBeam({x:sign*w*.34,y:h*.62,z:-d*.12},{x:sign*w*.31,y:h*.8,z:-d*.2},w*.065,shroud,d*.1);
      addBox({x:w*.14,y:h*.05,z:d*.22},{x:sign*w*.31,y:h*.04,z:d*.39},powder);
      // Kinked mostly-black rails rather than chrome curves.
      addTube({x:sign*w*.31,y:h*.23,z:d*.28},{x:sign*w*.37,y:h*.55,z:d*.04},w*.017,rail,12);
      addTube({x:sign*w*.37,y:h*.55,z:d*.04},{x:sign*w*.33,y:h*.77,z:-d*.16},w*.018,rail,12);
      addTube({x:sign*w*.33,y:h*.77,z:-d*.16},{x:sign*w*.25,y:h*.82,z:-d*.19},w*.018,rail,12);
    });
    addBox({x:w*.16,y:h*.64,z:d*.13},{x:0,y:h*.48,z:-d*.16},powder);
    addBox({x:w*.68,y:h*.09,z:d*.1},{x:0,y:h*.83,z:-d*.19},shroud);
    addBox({x:w*.66,y:h*.18,z:d*.035},{x:0,y:h*.84,z:-d*.245},tread,{castShadow:false});
    addBox({x:w*.05,y:h*.34,z:d*.04},{x:0,y:h*.69,z:-d*.15},powder);
    addBox({x:w*.04,y:h*.39,z:d*.025},{x:-w*.31,y:h*.5,z:d*.075},warm,{castShadow:false,receiveShadow:false});
    addBox({x:w*.04,y:h*.35,z:d*.025},{x:w*.31,y:h*.47,z:d*.03},warm,{castShadow:false,receiveShadow:false});
    addBox({x:w*.56,y:h*.02,z:d*.025},{x:0,y:h*.17,z:d*.35},warm,{castShadow:false,receiveShadow:false});
    addBox({x:w*.035,y:h*.31,z:d*.028},{x:-w*.36,y:h*.41,z:d*.05},amber,{castShadow:false,receiveShadow:false});
    addBeam({x:-w*.3,y:h*.12,z:d*.38},{x:w*.3,y:h*.12,z:d*.38},w*.05,powder,d*.05);
    addBox({x:w*.52,y:h*.12,z:d*.2},{x:0,y:h*.15,z:d*.27},shroud);
    return "photo-matched syedee Stair Machine";
  }

  function buildNordicTrackX16Model(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const frame=material({color:0x12161a,roughness:.48,metalness:.42,envMapIntensity:.72});
    const belt=material({color:0x050708,roughness:.92,metalness:.02,envMapIntensity:.12});
    const cushion=material({color:0x252b30,roughness:.62,metalness:.2,envMapIntensity:.4});
    const chrome=material({color:0xaebbc3,roughness:.2,metalness:.9,envMapIntensity:1.1});
    const screen=material({color:0x0b5367,emissive:0x0b8da7,emissiveIntensity:.32,roughness:.24,metalness:.16,depthWrite:false});
    const deckRotation=-.13;
    // Distinct deck layers sit on the same modest incline, so the belt reads as separate.
    addBox({x:w*.72,y:h*.06,z:d*.68},{x:0,y:h*.2,z:d*.04},frame,{rotationX:deckRotation});
    addBox({x:w*.61,y:h*.025,z:d*.64},{x:0,y:h*.245,z:d*.02},belt,{rotationX:deckRotation});
    [-1,1].forEach(sign=>addBox({x:w*.06,y:h*.04,z:d*.67},{x:sign*w*.335,y:h*.25,z:d*.02},cushion,{rotationX:deckRotation}));
    addBox({x:w*.76,y:h*.2,z:d*.18},{x:0,y:h*.31,z:-d*.3},frame,{rotationX:deckRotation});
    addBox({x:w*.67,y:h*.09,z:d*.1},{x:0,y:h*.39,z:-d*.34},cushion,{rotationX:deckRotation});
    addCylinder(w*.034,w*.61,{x:0,y:h*.17,z:d*.34},chrome,{rotationZ:Math.PI/2,segments:16,signature:"x16-rear-roller"});
    addBeam({x:-w*.34,y:h*.12,z:d*.34},{x:w*.34,y:h*.12,z:d*.34},w*.045,frame,d*.04);
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.31,y:h*.13,z:d*.24},{x:sign*w*.31,y:h*.58,z:-d*.12},w*.035,frame,d*.03);
      addTube({x:sign*w*.3,y:h*.34,z:d*.16},{x:sign*w*.38,y:h*.62,z:-d*.08},w*.016,chrome,14);
      addTube({x:sign*w*.38,y:h*.62,z:-d*.08},{x:sign*w*.32,y:h*.77,z:-d*.19},w*.016,chrome,14);
      addTube({x:sign*w*.32,y:h*.77,z:-d*.19},{x:sign*w*.2,y:h*.79,z:-d*.21},w*.016,chrome,14);
    });
    addBox({x:w*.08,y:h*.44,z:d*.07},{x:0,y:h*.66,z:-d*.18},frame);
    addCylinder(w*.05,h*.07,{x:0,y:h*.78,z:-d*.21},chrome,{rotationZ:Math.PI/2,segments:16});
    // A 16-inch diagonal 16:9 screen is about 13.9 by 7.8 inches: intentionally modest.
    addBox({x:Math.min(w*.365,1.16),y:Math.min(h*.106,.66),z:d*.045},{x:0,y:h*.87,z:-d*.23},screen,{castShadow:false,receiveShadow:false});
    addBox({x:Math.min(w*.395,1.25),y:Math.min(h*.126,.77),z:d*.06},{x:0,y:h*.87,z:-d*.205},frame,{castShadow:false});
    addBox({x:w*.18,y:h*.05,z:d*.12},{x:0,y:h*.08,z:d*.31},cushion);
    addBeam({x:-w*.27,y:h*.1,z:d*.2},{x:w*.27,y:h*.1,z:d*.2},w*.04,frame,d*.035);
    return "photo-matched NordicTrack X16";
  }

  function buildRitfitGatorBenchModel(view,group,inst,base,height){
    const {w,d,h,material,addBox,addCylinder,addBeam,addTube}=createModelKit(view,group,inst,base,height);
    const frame=material({color:0x111519,roughness:.48,metalness:.46,envMapIntensity:.72});
    const pad=material({color:0x080a0c,roughness:.92,metalness:.01,envMapIntensity:.1});
    const silver=material({color:0xc5ccd0,roughness:.2,metalness:.94,envMapIntensity:1.2});
    const foam=material({color:0x050607,roughness:.96,metalness:0,envMapIntensity:.06});
    // Open feet and triangular spine leave the floor visibly open beneath the pads.
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.39,y:h*.06,z:-d*.36},{x:sign*w*.39,y:h*.06,z:d*.34},w*.05,frame,d*.035);
      addBeam({x:sign*w*.39,y:h*.06,z:d*.34},{x:sign*w*.46,y:h*.06,z:d*.39},w*.042,frame,d*.03);
      addBeam({x:sign*w*.39,y:h*.06,z:-d*.36},{x:sign*w*.46,y:h*.06,z:-d*.4},w*.042,frame,d*.03);
    });
    addBeam({x:0,y:h*.12,z:d*.32},{x:0,y:h*.48,z:d*.04},w*.055,frame,d*.045);
    addBeam({x:0,y:h*.48,z:d*.04},{x:0,y:h*.74,z:-d*.25},w*.055,frame,d*.045);
    addBeam({x:-w*.34,y:h*.12,z:d*.32},{x:w*.34,y:h*.12,z:d*.32},w*.045,frame,d*.035);
    addBeam({x:-w*.28,y:h*.14,z:-d*.31},{x:w*.28,y:h*.14,z:-d*.31},w*.045,frame,d*.035);
    addBox({x:w*.44,y:h*.12,z:d*.26},{x:0,y:h*.42,z:d*.16},pad,{rotationX:-.12});
    addBox({x:w*.52,y:h*.14,z:d*.43},{x:0,y:h*.62,z:-d*.08},pad,{rotationX:-.48});
    addBox({x:w*.4,y:h*.11,z:d*.19},{x:0,y:h*.79,z:-d*.29},pad,{rotationX:-.48});
    // Seven individual rungs make the silver adjustment ladder explicit.
    [-1,1].forEach(sign=>addBeam({x:sign*w*.17,y:h*.19,z:d*.26},{x:sign*w*.17,y:h*.56,z:d*.08},w*.025,silver,d*.025));
    for(let rung=0;rung<7;rung++){
      const t=rung/6;
      addBeam({x:-w*.17,y:h*(.19+t*.37),z:d*(.26-t*.18)},{x:w*.17,y:h*(.19+t*.37),z:d*(.26-t*.18)},w*.018,silver,d*.018);
    }
    // The roller bar and foam pair live at the elevated head/back end, not by the front feet.
    addCylinder(w*.025,w*.72,{x:0,y:h*.77,z:-d*.31},silver,{rotationZ:Math.PI/2,segments:16});
    [-1,1].forEach(sign=>{
      addCylinder(h*.075,w*.12,{x:sign*w*.3,y:h*.77,z:-d*.31},foam,{rotationZ:Math.PI/2,segments:16,signature:"gator-elevated-foam-roller"});
      addCylinder(h*.075,w*.12,{x:sign*w*.3,y:h*.68,z:-d*.25},foam,{rotationZ:Math.PI/2,segments:16,signature:"gator-elevated-foam-roller"});
      addTube({x:sign*w*.28,y:h*.68,z:-d*.25},{x:sign*w*.28,y:h*.77,z:-d*.31},w*.014,frame,12);
    });
    addBeam({x:-w*.2,y:h*.48,z:d*.04},{x:w*.2,y:h*.48,z:d*.04},w*.04,frame,d*.035);
    return "photo-matched RitFit GATOR bench";
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
  BUILDERS["brightway-hs08-row"]=buildBrightwayHS08RowModel;
  BUILDERS["shizhuo-seated-standing-row"]=buildShizhuoSeatedStandingRowModel;
  BUILDERS["wanjia-combo-adductor"]=buildWanjiaComboAdductorModel;
  BUILDERS["yindun-three-tier-rack"]=buildYindunThreeTierRackModel;

  window.GymEquipmentModels=Object.freeze({has:key=>!!BUILDERS[key],keys:()=>Object.keys(BUILDERS),build,createModelKit});
})();
