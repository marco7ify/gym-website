const GARAGE_LAYOUT3_PROFILES=[
  "brightway-hs08-row","gazelle-pro","ice-barrel-500","maxwell-903bh",
  "nordictrack-x16","ritfit-gator-bench","rx3-compact-smith",
  "shizhuo-seated-standing-row","syedee-stair-machine",
  "wanjia-combo-adductor","yindun-three-tier-rack",
].sort();

const GARAGE_LAYOUT3_ITEMS=[
  {id:"ice",brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge",width:2.5583,length:4.8,height:3.5},
  {id:"stair",brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning",width:2.6667,length:4.1667,height:6.8333},
  {id:"x16",brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning",width:3.175,length:5.825,height:6.1083},
  {id:"gator",brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches",width:2.1667,length:4.8333,height:4.4167},
  {id:"hs08",brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper",width:2.82,length:4.2,height:6.28},
  {id:"shizhuo",brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper",width:3.67,length:5.21,height:4.18},
  {id:"wanjia",brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",width:2.38,length:4.99,height:4.61},
  {id:"yindun",brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage",width:2.22,length:5.58,height:3.24},
  {id:"rx3",brand:"Get RX'd",name:"RX3 Tornado Compact Smith Machine",category:"Strength",width:4,length:2.6667,height:7.1667},
  {id:"maxwell",brand:"SalusHEAT",name:"Maxwell-903BH infrared sauna",category:"Sauna",width:5,length:4,height:7.5},
  {id:"gazelle",brand:"RitFit",name:"Gazelle Pro 3-in-1 Leg Press",category:"Leg Press",width:4,length:5,height:5},
];

const GARAGE_LAYOUT3_LEGACY_FEATURES=[
  {id:"wf_l3_primary_mirror",kind:"mirror",label:"Primary training mirror",wall:"bottom",startFt:2,startIn:0,bottomFt:1,bottomIn:6,widthFt:5,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
  {id:"wf_l3_aisle_mirror",kind:"mirror",label:"Secondary aisle mirror",wall:"right",startFt:11,startIn:0,bottomFt:1,bottomIn:6,widthFt:4,widthIn:0,heightFt:5,heightIn:6,color:"#cbd5e1",brightnessPct:0},
  {id:"wf_l3_gazelle_slats",kind:"slat",label:"Gazelle focal slat wall",wall:"bottom",startFt:12,startIn:9,bottomFt:0,bottomIn:0,widthFt:6,widthIn:9,heightFt:8,heightIn:6,color:"#8f5f3a",brightnessPct:0},
  {id:"wf_l3_slat_led_left",kind:"led",label:"Slat frame, left",wall:"bottom",startFt:12,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
  {id:"wf_l3_slat_led_right",kind:"led",label:"Slat frame, right",wall:"bottom",startFt:19,startIn:7,bottomFt:0,bottomIn:4,widthFt:0,widthIn:1,heightFt:8,heightIn:0,color:"#ffb36b",brightnessPct:80},
  {id:"wf_l3_mirror_wash",kind:"led",label:"Mirror wash",wall:"bottom",startFt:2,startIn:0,bottomFt:7,bottomIn:3,widthFt:5,widthIn:0,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:65},
  {id:"wf_l3_cardio_strip",kind:"led",label:"Cardio ambient strip",wall:"top",startFt:2,startIn:9,bottomFt:8,bottomIn:4,widthFt:9,widthIn:6,heightFt:0,heightIn:1,color:"#ffd7aa",brightnessPct:70},
];

const GARAGE_LAYOUT3_EXACT_ITEMS=[
  {id:"maxwell",brand:"SalusHEAT",name:"Maxwell-903BH infrared sauna",category:"Sauna",width:43/12,length:63/12,height:75.8/12},
  {id:"ice",brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge",width:30.7/12,length:57.6/12,height:42/12},
  {id:"x16",brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning",width:38.1/12,length:69.9/12,height:73.3/12},
  {id:"stair",brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning",width:32/12,length:50/12,height:82/12,requiredCeilingFt:8.7},
  {id:"rx3",brand:"Get RX'd",name:"RX3 Tornado Compact Smith Machine",category:"Strength",width:32/12,length:48/12,height:86/12},
  {id:"gator",brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches",width:26/12,length:58/12,height:53/12},
  {id:"gazelle",brand:"RitFit",name:"Gazelle Pro 3-in-1 Leg Press",category:"Leg Press",width:49/12,length:87/12,height:57/12},
  {id:"hs08",brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper",width:2.82,length:4.2,height:6.28},
  {id:"shizhuo",brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper",width:3.67,length:5.21,height:4.18},
  {id:"yindun",brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage",width:2.22,length:5.58,height:3.24},
  {id:"combo",brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",width:2.38,length:4.99,height:4.61},
];

const GARAGE_LAYOUT3_EXACT_INSTANCES=[
  {id:"inst_maxwell",itemId:"maxwell",xFt:-1.75,xIn:0,yFt:14.25,yIn:0,rotated:false,__invalid:false},
  {id:"inst_ice",itemId:"ice",xFt:0,xIn:0,yFt:9,yIn:0,rotated:false,__invalid:false},
  {id:"inst_x16",itemId:"x16",xFt:6,xIn:6,yFt:0,yIn:0,rotated:true,__invalid:false},
  {id:"inst_stair",itemId:"stair",xFt:0,xIn:0,yFt:0,yIn:0,rotated:true,__invalid:false},
  {id:"inst_rx3",itemId:"rx3",xFt:3,xIn:0,yFt:9,yIn:0,rotated:true,__invalid:false},
  {id:"inst_gator",itemId:"gator",xFt:3,xIn:0,yFt:4,yIn:0,rotated:true,__invalid:false},
  {id:"inst_gazelle",itemId:"gazelle",xFt:12.583333015441895,xIn:0,yFt:15.41666666666697,yIn:0,rotated:true,__invalid:false},
  {id:"inst_hs08",itemId:"hs08",xFt:15,xIn:0,yFt:3.5,yIn:0,rotated:true,__invalid:false},
  {id:"inst_shizhuo",itemId:"shizhuo",xFt:14,xIn:0,yFt:7,yIn:0,rotated:true,__invalid:false},
  {id:"inst_yindun",itemId:"yindun",xFt:0,xIn:0,yFt:3,yIn:0,rotated:false,__invalid:false},
  {id:"inst_combo",itemId:"combo",xFt:7.5,xIn:0,yFt:14.51,yIn:0,rotated:false,__invalid:false},
];

function garageLayout3Settings(){
  return {...deepCopy(DEFAULT_SETTINGS),roomWidthFt:19,roomWidthIn:10,roomLengthFt:19,roomLengthIn:6,ceilingHeightFt:9,ceilingHeightIn:0};
}

function garageLayout3Items(){
  return GARAGE_LAYOUT3_ITEMS.map(item=>({...item,unit:"ft"}));
}

function garageLayout3Architecture(){
  return {
    areas:[
      {id:"existing_entry",kind:"door",label:"Door",xFt:12,xIn:6,yFt:0,widthFt:3,widthIn:1,heightFt:1},
      {id:"existing_nogo",kind:"nogospace",label:"Keep clear",xFt:17,xIn:9,yFt:0,widthFt:2,widthIn:1,heightFt:3},
    ],
    outlets:[{id:"existing_outlet",label:"Outlet",xFt:9,xIn:0,yFt:0,yIn:0,voltage:"120V"}],
    wallExtensions:[{id:"left_extension",label:"Extension",wall:"left",startFt:14,startIn:3,lengthFt:5,lengthIn:8,depthFt:1,depthIn:9}],
    ceilingZones:[{id:"existing_ceiling",label:"Low ceiling",xFt:0,xIn:0,yFt:0,yIn:6,widthFt:2,widthIn:6,heightFt:5,heightIn:0,ceilingHeightFt:5,ceilingHeightIn:0}],
    floorZones:[{id:"existing_platform",label:"Raised floor",xFt:0,xIn:0,yFt:0,yIn:0,widthFt:19,widthIn:8,heightFt:3,heightIn:0,elevationIn:4}],
    flooringPieces:[{id:"existing_flooring",typeId:"stall_mat_4x6",label:"Saved mat",xFt:4,xIn:0,yFt:8,yIn:0,rotated:true,price:55}],
    spatial3d:{
      ...DEFAULT_LAYOUT.spatial3d,
      walls:true,
      ceiling:true,
      clearances:true,
      collisions:true,
      labelMode:"selected",
      eyeHeightFt:5.67,
      wallColor:"black",
      floorType:"rolled-rubber",
      fovDeg:90,
    },
  };
}

function exactGarageLayout3Fixture(){
  const architecture=garageLayout3Architecture();
  return {
    name:"Layout 3",
    settings:garageLayout3Settings(),
    items:GARAGE_LAYOUT3_EXACT_ITEMS.map(item=>({...item,unit:"ft"})),
    layout:{
      ...deepCopy(DEFAULT_LAYOUT),
      ...architecture,
      garageWallRevision:1,
      instances:deepCopy(GARAGE_LAYOUT3_EXACT_INSTANCES),
      areas:[...architecture.areas,GymGarageDoors.seededLayout3Area()],
      wallFeatures:GymWallFeatures.layout3Starter(),
    },
  };
}

function legacyGarageLayout3Fixture(){
  const items=garageLayout3Items();
  const architecture=garageLayout3Architecture();
  return {
    name:"Layout 3",
    settings:garageLayout3Settings(),
    items,
    layout:{
      ...deepCopy(DEFAULT_LAYOUT),
      ...architecture,
      instances:items.map((item,index)=>({id:`garage_inst_${index}`,itemId:item.id,xFt:index%4,yFt:Math.floor(index/4),rotated:index%2===1})),
      wallFeatures:deepCopy(GARAGE_LAYOUT3_LEGACY_FEATURES),
    },
  };
}
