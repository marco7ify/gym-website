(function(){
  "use strict";

  const KINDS=["mirror","slat","led"];
  const SIDES=["top","right","bottom","left"];
  const DEFAULTS={
    mirror:{label:"Mirror",wall:"top",start:1,bottom:1.5,width:6,height:5,color:"#cbd5e1",brightnessPct:0},
    slat:{label:"Wood slat panel",wall:"top",start:1,bottom:0,width:6,height:8,color:"#9a653b",brightnessPct:0},
    led:{label:"LED strip",wall:"top",start:1,bottom:7.5,width:8,height:1/12,color:"#ffb36b",brightnessPct:75},
  };
  const EDGE=.22;
  const WALL_SAMPLE_STEP=.25;
  const WALL_OFFSET=.01;
  const EPSILON=1e-9;

  function number(value, fallback=0){
    const parsed=Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function totalFt(record, name){
    return number(record && record[`${name}Ft`]) + number(record && record[`${name}In`])/12;
  }

  function splitFtIn(value){
    const inches=Math.round(Math.max(0,number(value))*12);
    return {ft:Math.floor(inches/12),in:inches%12};
  }

  function integerInches(value){
    return Math.round(Math.max(0,number(value))*12);
  }

  function physicalInches(value){
    return Math.max(0,Math.floor(Math.max(0,number(value))*12+EPSILON));
  }

  function start(feature){ return totalFt(feature,"start"); }
  function bottom(feature){ return totalFt(feature,"bottom"); }
  function width(feature){ return totalFt(feature,"width"); }
  function height(feature){ return totalFt(feature,"height"); }

  function wallLength(feature, room){
    return ["left","right"].includes(feature && feature.wall) ? Math.max(0,number(room && room.L)) : Math.max(0,number(room && room.W));
  }

  function valueOrDefault(record, name, fallback){
    const ft=record && record[`${name}Ft`];
    const inch=record && record[`${name}In`];
    return (ft===undefined && inch===undefined) ? fallback : totalFt(record,name);
  }

  function featureCenter(feature, room){
    const offset=start(feature)+width(feature)/2;
    switch(feature && feature.wall){
      case "bottom": return {x:offset,y:number(room && room.L)};
      case "left": return {x:0,y:offset};
      case "right": return {x:number(room && room.W),y:offset};
      default: return {x:offset,y:0};
    }
  }

  function floorElevationAt(layout, x, y){
    let elevation=0;
    for(const zone of ((layout && layout.floorZones) || [])){
      const zx=totalFt(zone,"x");
      const zy=totalFt(zone,"y");
      const zw=totalFt(zone,"width");
      const zh=totalFt(zone,"height");
      if(x>=zx-EPSILON && x<=zx+zw+EPSILON && y>=zy-EPSILON && y<=zy+zh+EPSILON){
        elevation=Math.max(elevation,Math.max(0,number(zone.elevationIn))/12);
      }
    }
    return elevation;
  }

  function setMeasurementInches(record, name, inches){
    const bounded=Math.max(0,Math.round(number(inches)));
    record[`${name}Ft`]=Math.floor(bounded/12);
    record[`${name}In`]=bounded%12;
  }

  function normalize(feature, room, makeId, layout={}){
    const source=(feature && typeof feature==="object") ? feature : {};
    const kind=KINDS.includes(source.kind) ? source.kind : "mirror";
    const defaults=DEFAULTS[kind];
    const wall=SIDES.includes(source.wall) ? source.wall : defaults.wall;
    const normalized={...source,kind,wall};
    const sourceId=typeof source.id==="string" ? source.id.trim() : "";
    const generatedId=sourceId ? "" : (typeof makeId==="function" ? makeId() : "");
    normalized.id=sourceId || (typeof generatedId==="string" ? generatedId.trim() : "");
    normalized.label=String(source.label || defaults.label);

    const color=String(source.color || "");
    normalized.color=/^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : defaults.color;
    normalized.brightnessPct=Math.min(100,Math.max(0,number(source.brightnessPct,defaults.brightnessPct)));

    const minSizeInches=kind==="led" ? 1 : 6;
    const roomLengthInches=physicalInches(wallLength(normalized,room));
    const requestedWidthInches=integerInches(valueOrDefault(source,"width",defaults.width));
    const featureWidthInches=Math.min(roomLengthInches,Math.max(minSizeInches,requestedWidthInches));
    const requestedStartInches=integerInches(valueOrDefault(source,"start",defaults.start));
    const featureStartInches=Math.min(requestedStartInches,Math.max(0,roomLengthInches-featureWidthInches));
    setMeasurementInches(normalized,"width",featureWidthInches);
    setMeasurementInches(normalized,"start",featureStartInches);

    const center=featureCenter(normalized,room);
    const availableInches=physicalInches(number(room && room.ceiling)-floorElevationAt(layout,center.x,center.y));
    const requestedHeightInches=integerInches(valueOrDefault(source,"height",defaults.height));
    const featureHeightInches=Math.min(availableInches,Math.max(minSizeInches,requestedHeightInches));
    const requestedBottomInches=integerInches(valueOrDefault(source,"bottom",defaults.bottom));
    const featureBottomInches=Math.min(requestedBottomInches,Math.max(0,availableInches-featureHeightInches));
    setMeasurementInches(normalized,"height",featureHeightInches);
    setMeasurementInches(normalized,"bottom",featureBottomInches);
    return normalized;
  }

  function planRect(feature, room){
    const runStart=start(feature), runWidth=width(feature);
    switch(feature && feature.wall){
      case "top": return {x:runStart,y:0,w:runWidth,h:EDGE};
      case "left": return {x:0,y:runStart,w:EDGE,h:runWidth};
      case "right": return {x:number(room && room.W)-EDGE,y:runStart,w:EDGE,h:runWidth};
      default: return {x:runStart,y:number(room && room.L)-EDGE,w:runWidth,h:EDGE};
    }
  }

  function worldTransform(feature, room, layout={}){
    const runStart=start(feature), runWidth=width(feature);
    const center=featureCenter(feature,room);
    let x=runStart+runWidth/2;
    let z=.08;
    let rotationY=0;
    switch(feature && feature.wall){
      case "bottom":
        z=number(room && room.L)-.08;
        rotationY=Math.PI;
        break;
      case "left":
        x=.08;
        z=runStart+runWidth/2;
        rotationY=Math.PI/2;
        break;
      case "right":
        x=number(room && room.W)-.08;
        z=runStart+runWidth/2;
        rotationY=-Math.PI/2;
        break;
    }
    return {
      x,
      y:floorElevationAt(layout,center.x,center.y)+bottom(feature)+height(feature)/2,
      z,
      rotationY,
      width:runWidth,
      height:height(feature),
      depth:.08,
    };
  }

  function pointInRoom(x, y, room){
    const rects=(room && Array.isArray(room.rects) && room.rects.length)
      ? room.rects
      : [{x:0,y:0,w:number(room && room.W),h:number(room && room.L)}];
    return rects.some(rect=>x>=number(rect.x)-EPSILON && x<=number(rect.x)+number(rect.w)+EPSILON && y>=number(rect.y)-EPSILON && y<=number(rect.y)+number(rect.h)+EPSILON);
  }

  function wallSamples(feature){
    const runStart=start(feature);
    const runEnd=runStart+width(feature);
    const samples=[];
    for(let position=runStart; position<runEnd-EPSILON;position+=WALL_SAMPLE_STEP) samples.push(position);
    samples.push(runEnd);
    return samples;
  }

  function hasPhysicalWall(feature, room){
    for(const position of wallSamples(feature)){
      let inside;
      let outside;
      switch(feature.wall){
        case "top":
          inside=pointInRoom(position,WALL_OFFSET,room);
          outside=pointInRoom(position,-WALL_OFFSET,room);
          break;
        case "bottom":
          inside=pointInRoom(position,number(room && room.L)-WALL_OFFSET,room);
          outside=pointInRoom(position,number(room && room.L)+WALL_OFFSET,room);
          break;
        case "left":
          inside=pointInRoom(WALL_OFFSET,position,room);
          outside=pointInRoom(-WALL_OFFSET,position,room);
          break;
        case "right":
          inside=pointInRoom(number(room && room.W)-WALL_OFFSET,position,room);
          outside=pointInRoom(number(room && room.W)+WALL_OFFSET,position,room);
          break;
        default:
          return false;
      }
      if(Number(inside)+Number(outside)!==1) return false;
    }
    return true;
  }

  function openingRunOnWall(area, wall, room){
    const x=totalFt(area,"x");
    const y=totalFt(area,"y");
    const w=totalFt(area,"width");
    const h=totalFt(area,"height");
    switch(wall){
      case "top": return y<=EPSILON ? {start:x,end:x+w} : null;
      case "bottom": return y+h>=number(room && room.L)-EPSILON ? {start:x,end:x+w} : null;
      case "left": return x<=EPSILON ? {start:y,end:y+h} : null;
      case "right": return x+w>=number(room && room.W)-EPSILON ? {start:y,end:y+h} : null;
      default: return null;
    }
  }

  function validate(feature, layout, room){
    const reasons=[];
    const add=(code,message)=>{
      if(!reasons.some(reason=>reason.code===code)) reasons.push({code,message});
    };
    if(!KINDS.includes(feature && feature.kind)) add("invalid-kind","Choose a supported wall feature type.");
    if(!SIDES.includes(feature && feature.wall)) add("invalid-wall","Choose a base-room wall.");
    if(!feature || !SIDES.includes(feature.wall)) return {valid:false,reasons};

    const runStart=start(feature);
    const runEnd=runStart+width(feature);
    const length=wallLength(feature,room);
    if(runStart<0 || runEnd>length+EPSILON) add("outside-wall","This feature extends beyond the selected wall.");
    if(!hasPhysicalWall(feature,room)) add("missing-wall","Part of this base-wall run is missing.");

    for(const area of ((layout && layout.areas) || [])){
      if(!area || !["door","garagedoor"].includes(area.kind)) continue;
      const opening=openingRunOnWall(area,feature.wall,room);
      if(opening && runStart<opening.end-EPSILON && runEnd>opening.start+EPSILON){
        add("door-overlap","This feature overlaps a door opening.");
      }
    }

    const center=featureCenter(feature,room);
    const floor=floorElevationAt(layout,center.x,center.y);
    if(bottom(feature)<-EPSILON) add("below-floor","This feature is below the finished floor.");
    if(bottom(feature)+height(feature)>number(room && room.ceiling)-floor+EPSILON){
      add("above-ceiling","This feature rises above the available ceiling height.");
    }
    return {valid:reasons.length===0,reasons};
  }

  const LAYOUT3_LEGACY_STARTER=[
    {id:"wf_l3_primary_mirror",kind:"mirror",label:"Primary training mirror",wall:"bottom",startFt:2,startIn:0,bottomFt:1,bottomIn:6,widthFt:5,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_aisle_mirror",kind:"mirror",label:"Secondary aisle mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_gazelle_slats",kind:"slat",label:"Gazelle focal slat wall",wall:"bottom",startFt:12,startIn:9,bottomFt:0,bottomIn:0,widthFt:6,widthIn:9,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
    {id:"wf_l3_slat_led_left",kind:"led",label:"Slat frame, left",wall:"bottom",startFt:12,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_slat_led_right",kind:"led",label:"Slat frame, right",wall:"bottom",startFt:19,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_mirror_wash",kind:"led",label:"Mirror wash",wall:"bottom",startFt:2,startIn:0,bottomFt:7,bottomIn:3,widthFt:5,widthIn:0,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
    {id:"wf_l3_cardio_strip",kind:"led",label:"Cardio ambient strip",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
  ];

  const LAYOUT3_STARTER=[
    {id:"wf_l3_primary_mirror",kind:"mirror",label:"Primary training mirror",wall:"left",startFt:0,startIn:0,bottomFt:1,bottomIn:0,widthFt:8,widthIn:9,heightFt:7,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_aisle_mirror",kind:"mirror",label:"Secondary aisle mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
    {id:"wf_l3_gazelle_slats",kind:"slat",label:"Cold-plunge slat wall",wall:"left",startFt:9,startIn:0,bottomFt:0,bottomIn:0,widthFt:5,widthIn:0,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
    {id:"wf_l3_slat_led_left",kind:"led",label:"Slat frame, upper run edge",wall:"left",startFt:8,startIn:11,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_slat_led_right",kind:"led",label:"Slat frame, lower run edge",wall:"left",startFt:14,startIn:1,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
    {id:"wf_l3_mirror_wash",kind:"led",label:"Mirror wash",wall:"left",startFt:0,startIn:0,bottomFt:8,bottomIn:7,widthFt:8,widthIn:9,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
    {id:"wf_l3_cardio_strip",kind:"led",label:"Cardio ambient strip",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
  ];

  function layout3LegacyStarter(){
    return LAYOUT3_LEGACY_STARTER.map(feature=>({...feature}));
  }

  function layout3Starter(){
    return LAYOUT3_STARTER.map(feature=>({...feature}));
  }

  window.GymWallFeatures=Object.freeze({KINDS,SIDES,DEFAULTS,totalFt,splitFtIn,start,bottom,width,height,wallLength,floorElevationAt,normalize,planRect,worldTransform,validate,layout3LegacyStarter,layout3Starter});
})();
