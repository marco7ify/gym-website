(function(){
  "use strict";
  const REVISION=1;
  const STYLE="raised-panel";
  const COLOR="#191b1d";
  const EPSILON=.002;
  const ROOM_TOLERANCE=1/12;
  const TARGET_WIDTH=19+10/12;
  const TARGET_LENGTH=19+6/12;
  const TARGET_PROFILES=Object.freeze([
    "brightway-hs08-row","gazelle-pro","ice-barrel-500","maxwell-903bh",
    "nordictrack-x16","ritfit-gator-bench","rx3-compact-smith",
    "shizhuo-seated-standing-row","syedee-stair-machine",
    "wanjia-combo-adductor","yindun-three-tier-rack",
  ].sort());
  const SEEDED_AREA=Object.freeze({
    id:"area_l3_bottom_garage_v1",kind:"garagedoor",label:"16 ft raised-panel garage door",
    xFt:1,xIn:11,yFt:18,yIn:6,widthFt:16,widthIn:0,heightFt:1,heightIn:0,
    garageDoorHeightFt:7,garageDoorHeightIn:0,garageDoorStyle:STYLE,garageDoorColor:COLOR,
    blocksPlacement:false,subtractsSpace:false,
  });
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const total=(record,key)=>number(record?.[`${key}Ft`])+number(record?.[`${key}In`])/12;
  const canonicalColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():COLOR;
  const explicitPolicy=(area,key,enabledKinds)=>typeof area?.[key]==="boolean"?area[key]:enabledKinds.has(area?.kind);

  function seededLayout3Area(){ return {...SEEDED_AREA}; }
  function blocksPlacement(area,enabledKinds){ return explicitPolicy(area,"blocksPlacement",enabledKinds); }
  function subtractsSpace(area,enabledKinds){ return explicitPolicy(area,"subtractsSpace",enabledKinds); }

  function normalizeArea(source,normalized){
    if(normalized.kind!=="garagedoor") return normalized;
    const rawHeight=Math.max(6,Math.min(12,total(source,"garageDoorHeight")||7));
    const whole=Math.floor(rawHeight+1e-9);
    const inches=Math.round((rawHeight-whole)*12);
    return {
      ...normalized,
      garageDoorHeightFt:whole+(inches===12?1:0),
      garageDoorHeightIn:inches===12?0:inches,
      garageDoorStyle:source?.garageDoorStyle===STYLE?STYLE:STYLE,
      garageDoorColor:canonicalColor(source?.garageDoorColor),
      ...(typeof source?.blocksPlacement==="boolean"?{blocksPlacement:source.blocksPlacement}:{}),
      ...(typeof source?.subtractsSpace==="boolean"?{subtractsSpace:source.subtractsSpace}:{}),
    };
  }

  function pointInUnion(x,z,rects){
    return rects.some(rect=>x>=rect.x&&x<=rect.x+rect.w&&z>=rect.y&&z<=rect.y+rect.h);
  }

  function uniqueCoordinates(values){
    return [...new Set(values.map(number))].sort((left,right)=>left-right);
  }

  function boundarySegments(rects){
    const areas=(Array.isArray(rects)?rects:[])
      .map(rect=>({x:number(rect?.x),y:number(rect?.y),w:number(rect?.w),h:number(rect?.h)}))
      .filter(rect=>rect.w>0&&rect.h>0);
    const xs=uniqueCoordinates(areas.flatMap(rect=>[rect.x,rect.x+rect.w]));
    const zs=uniqueCoordinates(areas.flatMap(rect=>[rect.y,rect.y+rect.h]));
    const segments=[];
    const add=(axis,fixed,start,end,negativeInside,positiveInside)=>{
      if(negativeInside===positiveInside) return;
      const horizontal=axis==="x";
      const inwardX=horizontal?0:(positiveInside?1:-1);
      const inwardZ=horizontal?(positiveInside?1:-1):0;
      const wall=horizontal?(positiveInside?"top":"bottom"):(positiveInside?"left":"right");
      const rotationY={top:0,bottom:Math.PI,left:Math.PI/2,right:-Math.PI/2}[wall];
      segments.push({axis,fixed,start,end,mid:(start+end)/2,length:end-start,inwardX,inwardZ,wall,rotationY});
    };

    xs.forEach(fixed=>{
      for(let index=0;index<zs.length-1;index++){
        const start=zs[index],end=zs[index+1];
        if(end-start>0) add("z",fixed,start,end,pointInUnion(fixed-EPSILON,(start+end)/2,areas),pointInUnion(fixed+EPSILON,(start+end)/2,areas));
      }
    });
    zs.forEach(fixed=>{
      for(let index=0;index<xs.length-1;index++){
        const start=xs[index],end=xs[index+1];
        if(end-start>0) add("x",fixed,start,end,pointInUnion((start+end)/2,fixed-EPSILON,areas),pointInUnion((start+end)/2,fixed+EPSILON,areas));
      }
    });
    return segments;
  }

  function mergeCandidates(segments,tolerance){
    const groups=[];
    segments.forEach(segment=>{
      let group=groups.find(candidate=>candidate.axis===segment.axis&&Math.abs(candidate.fixed-segment.fixed)<=tolerance&&candidate.inwardX===segment.inwardX&&candidate.inwardZ===segment.inwardZ);
      if(!group){
        group={...segment,parts:[]};
        groups.push(group);
      }
      group.parts.push(segment);
    });
    return groups.flatMap(group=>{
      const sorted=group.parts.slice().sort((left,right)=>left.start-right.start);
      const merged=[];
      sorted.forEach(segment=>{
        const previous=merged[merged.length-1];
        if(previous&&segment.start<=previous.end+tolerance) previous.end=Math.max(previous.end,segment.end);
        else {
          const {parts,...candidate}=group;
          merged.push({...candidate,start:segment.start,end:segment.end});
        }
      });
      return merged.map(segment=>({...segment,mid:(segment.start+segment.end)/2,length:segment.end-segment.start}));
    });
  }

  function resolveOpening(rect,boundaries,{areaId,label,tolerance=.03}={}){
    const x=number(rect?.x),z=number(rect?.y),w=number(rect?.w),h=number(rect?.h);
    const edges=[
      {axis:"x",fixed:z,start:x,end:x+w},
      {axis:"x",fixed:z+h,start:x,end:x+w},
      {axis:"z",fixed:x,start:z,end:z+h},
      {axis:"z",fixed:x+w,start:z,end:z+h},
    ];
    const candidates=[];
    edges.forEach(edge=>{
      const touching=(Array.isArray(boundaries)?boundaries:[]).filter(segment=>
        segment?.axis===edge.axis&&Math.abs(number(segment.fixed)-edge.fixed)<=tolerance&&
        number(segment.end)>=edge.start-tolerance&&number(segment.start)<=edge.end+tolerance
      );
      if(touching.length) candidates.push({edge,segments:mergeCandidates(touching,tolerance)});
    });
    if(!candidates.length) return {ok:false,code:"off-boundary",message:"Opening must lie on a room boundary."};
    const complete=candidates.flatMap(({edge,segments})=>segments
      .filter(segment=>segment.start<=edge.start+tolerance&&segment.end>=edge.end-tolerance)
      .map(segment=>({edge,segment}))
    );
    if(!complete.length) return {ok:false,code:"missing-boundary-span",message:"Opening must cover one continuous room-boundary span."};
    if(complete.length>1) return {ok:false,code:"ambiguous-boundary",message:"Opening matches multiple room boundaries."};
    const {edge,segment}=complete[0];
    return {
      ok:true,...segment,areaId,label,
      centerX:x+w/2,centerZ:z+h/2,widthFt:edge.end-edge.start,start:edge.start,end:edge.end,
    };
  }

  function planPanelLines(rect,resolution){
    const x=number(rect?.x),z=number(rect?.y),w=number(rect?.w),h=number(rect?.h);
    const lines=[];
    if(resolution?.axis==="z"){
      for(let index=1;index<4;index++) lines.push({x1:x+w*index/4,z1:z,x2:x+w*index/4,z2:z+h});
      for(let index=1;index<4;index++) lines.push({x1:x,z1:z+h*index/4,x2:x+w,z2:z+h*index/4});
    }else{
      for(let index=1;index<4;index++) lines.push({x1:x,z1:z+h*index/4,x2:x+w,z2:z+h*index/4});
      for(let index=1;index<4;index++) lines.push({x1:x+w*index/4,z1:z,x2:x+w*index/4,z2:z+h});
    }
    return lines;
  }

  function sameMeasurement(left,right,key){
    return Math.abs(total(left,key)-total(right,key))<=1e-9;
  }

  function matchesLegacyFeature(feature,legacy){
    return feature?.kind===legacy?.kind&&feature?.wall===legacy?.wall&&
      ["start","bottom","width","height"].every(key=>sameMeasurement(feature,legacy,key))&&
      String(feature?.color||"").toLowerCase()===String(legacy?.color||"").toLowerCase()&&
      number(feature?.brightnessPct)===number(legacy?.brightnessPct);
  }

  function normalizedName(value){
    return String(value||"").trim().toLowerCase().replace(/\s+/g," ");
  }

  function sameProfileSet(profileKeys){
    const actual=[...new Set(Array.isArray(profileKeys)?profileKeys:[])].sort();
    return actual.length===TARGET_PROFILES.length&&actual.every((key,index)=>key===TARGET_PROFILES[index]);
  }

  function areaRect(area){
    return {x:total(area,"x"),y:total(area,"y"),w:total(area,"width"),h:total(area,"height")};
  }

  function migrateLayout3(layout,context={}){
    if(!layout||typeof layout!=="object"||number(layout.garageWallRevision)>=REVISION) return layout;
    const room=context.room||{};
    const roomMatches=Math.abs(number(room.W)-TARGET_WIDTH)<=ROOM_TOLERANCE&&Math.abs(number(room.L)-TARGET_LENGTH)<=ROOM_TOLERANCE;
    if(!roomMatches) return layout;

    const sourceFeatures=Array.isArray(layout.wallFeatures)?layout.wallFeatures:[];
    const legacyFeatures=Array.isArray(context.legacyFeatures)?context.legacyFeatures:[];
    const starterFeatures=Array.isArray(context.starterFeatures)?context.starterFeatures:[];
    const knownIds=new Set(legacyFeatures.map(feature=>feature?.id).filter(Boolean));
    const allLegacySignatures=legacyFeatures.length===7&&legacyFeatures.every(legacy=>sourceFeatures.some(feature=>matchesLegacyFeature(feature,legacy)));
    const namedKnownIds=normalizedName(context.name)==="layout 3"&&new Set(sourceFeatures.map(feature=>feature?.id).filter(id=>knownIds.has(id))).size>=5;
    if(!sameProfileSet(context.profileKeys)&&!allLegacySignatures&&!namedKnownIds) return layout;

    const next={...layout};
    const areas=Array.isArray(layout.areas)?layout.areas.slice():[];
    const boundaries=boundarySegments(Array.isArray(room.rects)?room.rects:[]);
    const target=seededLayout3Area();
    const targetResolution=resolveOpening(areaRect(target),boundaries);
    let matchingIndex=-1;
    if(targetResolution.ok){
      matchingIndex=areas.findIndex(area=>{
        if(area?.kind!=="garagedoor") return false;
        const resolution=resolveOpening(areaRect(area),boundaries,{areaId:area.id,label:area.label});
        return resolution.ok&&resolution.wall==="bottom"&&
          Math.abs(resolution.centerX-targetResolution.centerX)<=1/12&&
          Math.abs(resolution.widthFt-targetResolution.widthFt)<=1/12;
      });
    }
    if(matchingIndex>=0){
      const existing=areas[matchingIndex];
      areas[matchingIndex]={...existing,...target,id:existing.id};
    }else{
      areas.push(target);
    }
    next.areas=areas;

    if(context.hadWallFeatures===false){
      next.wallFeatures=starterFeatures.map(feature=>({...feature}));
    }else{
      const legacyById=new Map(legacyFeatures.map((feature,index)=>[feature.id,{feature,index}]));
      next.wallFeatures=sourceFeatures.map(feature=>{
        const match=legacyById.get(feature?.id);
        const starter=match&&starterFeatures[match.index];
        if(!match||!starter||!matchesLegacyFeature(feature,match.feature)) return feature;
        return {...feature,...starter,label:feature.label};
      });
    }
    next.garageWallRevision=REVISION;
    return next;
  }

  window.GymGarageDoors=Object.freeze({
    REVISION,seededLayout3Area,normalizeArea,blocksPlacement,subtractsSpace,
    boundarySegments,resolveOpening,planPanelLines,migrateLayout3,
  });
})();
