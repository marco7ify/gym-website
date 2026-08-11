const GARAGE_ROOM_RECTS=[
  {x:0,y:0,w:19+10/12,h:19.5},
  {x:-1.75,y:14.25,w:1.75,h:5.25},
];

GymTests.test("maps the Layout 3 equipment to the required dedicated profiles",()=>{
  GymTests.deepEqual(garageLayout3Items().map(equipmentModelProfile).sort(),GARAGE_LAYOUT3_PROFILES);
});

GymTests.test("seeds the canonical non-blocking raised-panel garage door",()=>{
  const area=GymGarageDoors.seededLayout3Area();
  GymTests.deepEqual(area,{
    id:"area_l3_bottom_garage_v1",kind:"garagedoor",label:"16 ft raised-panel garage door",
    xFt:1,xIn:11,yFt:18,yIn:6,widthFt:16,widthIn:0,heightFt:1,heightIn:0,
    garageDoorHeightFt:7,garageDoorHeightIn:0,garageDoorStyle:"raised-panel",garageDoorColor:"#191b1d",
    blocksPlacement:false,subtractsSpace:false,
  });
  GymTests.assert(area!==GymGarageDoors.seededLayout3Area(),"Expected a fresh seeded area object");
});

GymTests.test("honors explicit area policy before the enabled-kind fallback",()=>{
  const enabled=new Set(["door","garagedoor"]);
  const cases=[
    [{kind:"door"},true,true],
    [{kind:"nogospace"},false,false],
    [{kind:"door",blocksPlacement:false,subtractsSpace:false},false,false],
    [{kind:"nogospace",blocksPlacement:true,subtractsSpace:true},true,true],
  ];
  cases.forEach(([area,blocks,subtracts])=>{
    GymTests.equal(GymGarageDoors.blocksPlacement(area,enabled),blocks);
    GymTests.equal(GymGarageDoors.subtractsSpace(area,enabled),subtracts);
  });
});

GymTests.test("maps each exterior wall to an inward-facing rotation",()=>{
  const segments=GymGarageDoors.boundarySegments([{x:0,y:0,w:10,h:8}]);
  const byWall=Object.fromEntries(segments.map(segment=>[segment.wall,segment]));
  GymTests.deepEqual(Object.fromEntries(["top","bottom","left","right"].map(wall=>[wall,{
    inwardX:byWall[wall].inwardX,inwardZ:byWall[wall].inwardZ,rotationY:byWall[wall].rotationY,
  }])),{
    top:{inwardX:0,inwardZ:1,rotationY:0},
    bottom:{inwardX:0,inwardZ:-1,rotationY:Math.PI},
    left:{inwardX:1,inwardZ:0,rotationY:Math.PI/2},
    right:{inwardX:-1,inwardZ:0,rotationY:-Math.PI/2},
  });
});

GymTests.test("rejects an opening rectangle in the room interior",()=>{
  const result=GymGarageDoors.resolveOpening({x:5,y:5,w:4,h:1},GymGarageDoors.boundarySegments(GARAGE_ROOM_RECTS));
  GymTests.deepEqual(result,{ok:false,code:"off-boundary",message:"Opening must lie on a room boundary."});
});

GymTests.test("rejects a left opening spanning the extension gap",()=>{
  const result=GymGarageDoors.resolveOpening({x:0,y:13,w:.1,h:5.5},GymGarageDoors.boundarySegments(GARAGE_ROOM_RECTS));
  GymTests.deepEqual(result,{ok:false,code:"missing-boundary-span",message:"Opening must cover one continuous room-boundary span."});
});

GymTests.test("plans three rows and three bays as six grid lines",()=>{
  const rect={x:1+11/12,y:18.5,w:16,h:1};
  const resolution=GymGarageDoors.resolveOpening(rect,GymGarageDoors.boundarySegments(GARAGE_ROOM_RECTS),{areaId:"garage",label:"Garage"});
  GymTests.assert(resolution.ok,"Expected the bottom garage opening to resolve");
  const lines=GymGarageDoors.planPanelLines(rect,resolution);
  GymTests.equal(lines.length,6);
  [18.75,19,19.25].forEach((z,index)=>{
    GymTests.closeTo(lines[index].z1,z,1e-9);
    GymTests.closeTo(lines[index].z2,z,1e-9);
    GymTests.closeTo(lines[index].x1,1+11/12,1e-9);
    GymTests.closeTo(lines[index].x2,17+11/12,1e-9);
  });
  [5+11/12,9+11/12,13+11/12].forEach((x,index)=>{
    const line=lines[index+3];
    GymTests.closeTo(line.x1,x,1e-9);
    GymTests.closeTo(line.x2,x,1e-9);
    GymTests.closeTo(line.z1,18.5,1e-9);
    GymTests.closeTo(line.z2,19.5,1e-9);
  });
});
