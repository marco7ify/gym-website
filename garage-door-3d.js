(function(){
  "use strict";

  const DOOR_THICKNESS_FT=2/12;
  const SURFACE_LIMIT_FT=.02;

  function tag(mesh,part,{castShadow=false,surface=false}={}){
    mesh.userData.garagePart=part;
    if(surface) mesh.userData.garageSurface=true;
    mesh.castShadow=castShadow;
    return mesh;
  }

  function box(view,group,size,position,material,part,options={}){
    const mesh=view.box(group,size,position,material,{
      castShadow:options.castShadow===true,
      receiveShadow:options.receiveShadow!==false,
      rotationX:options.rotationX||0,
      rotationY:options.rotationY||0,
      rotationZ:options.rotationZ||0,
    });
    return tag(mesh,part,options);
  }

  function cylinder(view,group,radius,height,position,material,part,options={}){
    const mesh=view.cylinder(group,radius,height,position,material,{
      castShadow:options.castShadow===true,
      receiveShadow:options.receiveShadow!==false,
      rotationX:options.rotationX||0,
      rotationY:options.rotationY||0,
      rotationZ:options.rotationZ||0,
      segments:options.segments||16,
    });
    return tag(mesh,part,options);
  }

  function prepareResources(view,color){
    const requested=String(color||"#191b1d").toLowerCase();
    const key=/^#[0-9a-f]{6}$/.test(requested)?requested:"#191b1d";
    view.garageMaterialCache=view.garageMaterialCache||new Map();
    if(view.garageMaterialCache.has(key)) return view.garageMaterialCache.get(key);
    const value=Object.freeze({
      slab:view.material({color:new THREE.Color(key),roughness:.68,metalness:.24,envMapIntensity:.62}),
      bevel:view.material({color:0x2b2f34,roughness:.58,metalness:.3,envMapIntensity:.72}),
      recess:view.material({color:0x0c0e10,roughness:.82,metalness:.12,envMapIntensity:.38}),
      track:view.material({color:0x3d444b,roughness:.34,metalness:.82,envMapIntensity:1.05}),
      rubber:view.material({color:0x050607,roughness:.94,metalness:0,envMapIntensity:.12}),
      hardware:view.material({color:0xaab2b9,roughness:.24,metalness:.9,envMapIntensity:1.2}),
    });
    view.garageMaterialCache.set(key,value);
    return value;
  }

  function surfaceInteriorInset(group){
    group.updateMatrixWorld(true);
    const inverseGroup=new THREE.Matrix4().copy(group.matrixWorld).invert();
    let maximum=-Infinity;
    group.traverse(object=>{
      if(!object.isMesh || !object.userData.garageSurface) return;
      object.geometry.computeBoundingBox();
      const bounds=object.geometry.boundingBox.clone();
      const relative=new THREE.Matrix4().multiplyMatrices(inverseGroup,object.matrixWorld);
      bounds.applyMatrix4(relative);
      maximum=Math.max(maximum,bounds.max.z);
    });
    return Number.isFinite(maximum)?maximum:0;
  }

  function buildHeaderInfill(view,group,spec,resources){
    const width=Math.max(0,Number(spec.widthFt)||0);
    const height=Math.max(0,(Number(spec.ceilingFt)||0)-(Number(spec.floorFt)||0)-(Number(spec.heightFt)||0));
    if(height<=0) return null;
    return box(
      view,
      group,
      {x:width+.44,y:height,z:.22},
      {x:0,y:(Number(spec.floorFt)||0)+(Number(spec.heightFt)||0)+height/2,z:-.055},
      spec.wallMaterial||resources.slab,
      "header-infill",
      {castShadow:true},
    );
  }

  function buildFrame(view,group,spec,resources){
    const width=Math.max(.5,Number(spec.widthFt)||0);
    const height=Math.max(.5,Number(spec.heightFt)||0);
    const floor=Number(spec.floorFt)||0;
    const centerY=floor+height/2;
    const jambX=width/2+.12;
    box(view,group,{x:.2,y:height+.24,z:.24},{x:-jambX,y:centerY+.04,z:.015},resources.bevel,"jamb",{castShadow:true});
    box(view,group,{x:.2,y:height+.24,z:.24},{x:jambX,y:centerY+.04,z:.015},resources.bevel,"jamb",{castShadow:true});
    box(view,group,{x:width+.44,y:.2,z:.24},{x:0,y:floor+height+.12,z:.015},resources.bevel,"head-frame",{castShadow:true});
    box(view,group,{x:width,y:.075,z:.12},{x:0,y:floor+.045,z:.015},resources.rubber,"bottom-seal");
    buildHeaderInfill(view,group,spec,resources);
  }

  function addPanelSurface(view,group,spec,resources){
    const width=Number(spec.widthFt)||0;
    const height=Number(spec.heightFt)||0;
    const floor=Number(spec.floorFt)||0;
    box(
      view,
      group,
      {x:width,y:height,z:DOOR_THICKNESS_FT},
      {x:0,y:floor+height/2,z:-DOOR_THICKNESS_FT/2},
      resources.slab,
      "slab",
      {castShadow:true,surface:true},
    );

    const sectionHeight=height/4;
    const bayWidth=width/4;
    for(let row=0;row<4;row++){
      const y=floor+(row+.5)*sectionHeight;
      for(let column=0;column<4;column++){
        const x=-width/2+(column+.5)*bayWidth;
        box(
          view,
          group,
          {x:Math.max(.1,bayWidth-.34),y:Math.max(.1,sectionHeight-.28),z:.043},
          {x,y,z:-.0015},
          resources.bevel,
          "raised-panel",
          {surface:true},
        );
        box(
          view,
          group,
          {x:Math.max(.08,bayWidth-.7),y:Math.max(.08,sectionHeight-.62),z:.012},
          {x,y,z:-.018},
          resources.recess,
          "panel-recess",
          {surface:true},
        );
      }
    }
    for(let seam=1;seam<4;seam++){
      box(
        view,
        group,
        {x:width-.14,y:.055,z:.018},
        {x:0,y:floor+seam*sectionHeight,z:.006},
        resources.bevel,
        "section-seam",
        {surface:true},
      );
    }
  }

  function addDoorHardware(view,group,spec,resources){
    const width=Number(spec.widthFt)||0;
    const height=Number(spec.heightFt)||0;
    const floor=Number(spec.floorFt)||0;
    const ceiling=Number(spec.ceilingFt)||floor+height+2;
    const trackDepth=Math.max(2,Number(spec.trackDepthFt)||8);
    const sectionHeight=height/4;

    box(view,group,{x:width+.1,y:.055,z:.18},{x:0,y:floor+.025,z:.1},resources.track,"threshold");
    box(view,group,{x:1.05,y:.16,z:.12},{x:0,y:floor+height*.42,z:.115},resources.hardware,"handle");

    const hingeXs=[-width/3,0,width/3];
    for(let seam=1;seam<4;seam++){
      hingeXs.forEach(x=>box(
        view,
        group,
        {x:.24,y:.18,z:.055},
        {x,y:floor+seam*sectionHeight,z:.075},
        resources.hardware,
        "section-hinge",
      ));
    }

    [-1,1].forEach(side=>{
      const x=side*(width/2-.12);
      for(let row=0;row<4;row++){
        const y=floor+(row+.5)*sectionHeight;
        box(view,group,{x:.2,y:.22,z:.08},{x,y,z:.1},resources.hardware,"roller-bracket");
        cylinder(view,group,.055,.2,{x:side*(width/2+.03),y,z:.15},resources.hardware,"roller",{rotationZ:Math.PI/2,segments:12});
      }
    });

    [-1,1].forEach(side=>{
      const x=side*(width/2+.18);
      box(view,group,{x:.08,y:height,z:.08},{x,y:floor+height/2,z:.27},resources.track,"vertical-track");
      box(view,group,{x:.08,y:.5,z:.08},{x,y:floor+height+.25,z:.3},resources.track,"curved-track");
      box(view,group,{x:.08,y:.62,z:.08},{x,y:floor+height+.62,z:.53},resources.track,"curved-track",{rotationX:Math.PI/4});
      box(view,group,{x:.08,y:.08,z:.72},{x,y:floor+height+.92,z:.9},resources.track,"curved-track");
      const ceilingTrackY=Math.min(ceiling-.3,floor+height+.92);
      const ceilingRun=Math.max(.5,trackDepth-1.25);
      box(view,group,{x:.08,y:.08,z:ceilingRun},{x,y:ceilingTrackY,z:1.25+ceilingRun/2},resources.track,"ceiling-track");
    });

    cylinder(view,group,.055,width+.8,{x:0,y:floor+height+.45,z:.3},resources.track,"torsion-bar",{rotationZ:Math.PI/2,segments:16});
    [-width*.22,width*.22].forEach(x=>cylinder(
      view,
      group,
      .11,
      1.35,
      {x,y:floor+height+.45,z:.3},
      resources.hardware,
      "torsion-spring",
      {rotationZ:Math.PI/2,segments:18},
    ));

    const openerY=Math.max(floor+height+.35,ceiling-.38);
    box(view,group,{x:.08,y:.08,z:trackDepth},{x:0,y:openerY,z:trackDepth/2},resources.track,"opener-rail");
    box(view,group,{x:1.15,y:.55,z:.85},{x:0,y:openerY-.24,z:Math.max(1,trackDepth-.65)},resources.hardware,"opener-motor",{castShadow:true});
    box(view,group,{x:.08,y:.95,z:.08},{x:0,y:floor+height+.3,z:.85},resources.hardware,"opener-arm",{rotationX:-.42});
  }

  function buildResult(group,fields={}){
    const meshes=[];
    group.traverse(object=>{ if(object.isMesh) meshes.push(object); });
    return {
      ...fields,
      meshCount:meshes.length,
      shadowCasterCount:meshes.filter(mesh=>mesh.castShadow).length,
    };
  }

  function buildRaisedPanel(view,group,spec){
    const resources=spec.resources||prepareResources(view,spec.color);
    addPanelSurface(view,group,spec,resources);
    buildFrame(view,group,spec,resources);
    addDoorHardware(view,group,spec,resources);
    const interiorInsetFt=surfaceInteriorInset(group);
    if(interiorInsetFt>SURFACE_LIMIT_FT+1e-9) throw new Error(`Garage surface exceeds ${SURFACE_LIMIT_FT} ft interior relief`);
    return buildResult(group,{
      modelType:"traditional raised-panel garage door",
      sectionCount:4,
      panelCount:16,
      trackPairs:1,
      widthFt:Number(spec.widthFt)||0,
      heightFt:Number(spec.heightFt)||0,
      thicknessFt:DOOR_THICKNESS_FT,
      interiorInsetFt,
    });
  }

  function buildFallback(view,group,spec){
    const resources=spec.resources||prepareResources(view,spec.color);
    const width=Number(spec.widthFt)||0;
    const height=Number(spec.heightFt)||0;
    const floor=Number(spec.floorFt)||0;
    box(
      view,
      group,
      {x:width,y:height,z:DOOR_THICKNESS_FT},
      {x:0,y:floor+height/2,z:-DOOR_THICKNESS_FT/2},
      resources.slab,
      "fallback-slab",
      {castShadow:true,surface:true},
    );
    buildFrame(view,group,spec,resources);
    return buildResult(group,{
      modelType:"simple closed garage fallback",
      fallback:true,
      widthFt:width,
      heightFt:height,
      thicknessFt:DOOR_THICKNESS_FT,
      interiorInsetFt:surfaceInteriorInset(group),
    });
  }

  window.GymGarageDoor3D=Object.freeze({
    prepareResources,
    buildRaisedPanel,
    buildFallback,
  });
})();
