// Shared 3D scene for the plan preview, split view, and first-person walkthrough.
// The renderer intentionally reads the existing planner model directly so 2D
// placement remains the source of truth.

let gym3DControllers = [];
const gym3DCameraMemory = new Map();

function gymSpatialSettings(){
  const settings = {
    ...(DEFAULT_LAYOUT.spatial3d || {}),
    ...((state.layout && state.layout.spatial3d) || {}),
  };
  settings.labelMode = ["selected", "hover", "always", "off"].includes(settings.labelMode)
    ? settings.labelMode
    : (settings.labels === false ? "off" : "selected");
  return settings;
}

function destroyGym3DViews(){
  gym3DControllers.forEach(controller=>{
    try{ controller.destroy(); }catch{}
  });
  gym3DControllers = [];
}

function initGym3DViews(){
  destroyGym3DViews();
  if(typeof THREE === "undefined"){
    document.querySelectorAll("[data-gym3d]").forEach(el=>{
      const loading = el.querySelector(".gym3dLoading");
      if(loading) loading.textContent = "3D view could not start.";
    });
    return;
  }
  document.querySelectorAll("[data-gym3d]").forEach(el=>{
    if(state.layout?.walkthroughOpen && el.dataset.gym3d!=="walkthrough") return;
    if(el.offsetParent === null && el.dataset.gym3d !== "walkthrough") return;
    try{ gym3DControllers.push(new Gym3DView(el, el.dataset.gym3d)); }
    catch(err){
      console.error("Gym 3D view failed", err);
      const loading = el.querySelector(".gym3dLoading");
      if(loading) loading.textContent = "3D view could not start.";
    }
  });
}

function startGymWalkthrough(){
  const view = gym3DControllers.find(x=>x.mode === "walkthrough");
  if(view) view.lock();
}

function resetGymWalkthrough(){
  const view = gym3DControllers.find(x=>x.mode === "walkthrough");
  if(view) view.resetWalkthrough();
}

function frameSelectedGym3D(){
  const view=gym3DControllers.find(x=>x.mode==="preview");
  if(view) view.frameSelected();
}

function segmentRectRoomInterval(start,end,rect){
  const epsilon=1e-9;
  let enter=0,exit=1;
  for(const [origin,delta,min,max] of [
    [start.x,end.x-start.x,rect.x,rect.x+rect.w],
    [start.z,end.z-start.z,rect.y,rect.y+rect.h],
  ]){
    if(Math.abs(delta)<=epsilon){
      if(origin<min-epsilon || origin>max+epsilon) return null;
      continue;
    }
    let a=(min-origin)/delta,b=(max-origin)/delta;
    if(a>b) [a,b]=[b,a];
    enter=Math.max(enter,a);
    exit=Math.min(exit,b);
    if(enter>exit+epsilon) return null;
  }
  return [Math.max(0,enter),Math.min(1,exit)];
}

function segmentCoveredByRoomRects(start,end,rects){
  const epsilon=1e-9;
  const intervals=(rects||[])
    .map(rect=>segmentRectRoomInterval(start,end,rect))
    .filter(Boolean)
    .sort((a,b)=>a[0]-b[0] || b[1]-a[1]);
  let covered=0;
  for(const [from,to] of intervals){
    if(from>covered+epsilon) return false;
    covered=Math.max(covered,to);
    if(covered>=1-epsilon) return true;
  }
  return false;
}

function segmentHasRoomClearance(start,end,rects,clearance=.22){
  const offsets=[
    [0,0],
    [clearance,0],[-clearance,0],
    [0,clearance],[0,-clearance],
  ];
  return offsets.every(([dx,dz])=>segmentCoveredByRoomRects(
    {x:start.x+dx,z:start.z+dz},
    {x:end.x+dx,z:end.z+dz},
    rects,
  ));
}

class Gym3DView {
  constructor(host, mode){
    this.host = host;
    this.mode = mode || "preview";
    this.layoutId = state.activeLayoutId || "layout";
    this.settings = gymSpatialSettings();
    this.roomData = room();
    this.bounds = this.roomData.bounds;
    this.roomInstances = typeof layoutRoomInstances === "function"
      ? layoutRoomInstances(state.layout, this.roomData)
      : (state.layout.instances || []);
    this.resolvedInstanceCount = (state.layout.instances || []).filter(inst=>getItemById(inst.itemId)).length;
    this.stagedInstanceCount = Math.max(0, this.resolvedInstanceCount - this.roomInstances.length);
    this.missingInstanceCount = Math.max(0, (state.layout.instances || []).length - this.resolvedInstanceCount);
    this.host.dataset.layoutId = this.layoutId;
    this.host.dataset.inRoomModels = String(this.roomInstances.length);
    this.host.dataset.stagedModels = String(this.stagedInstanceCount);
    this.host.dataset.missingModels = String(this.missingInstanceCount);
    this.host.dataset.rotatedModels = String(this.roomInstances.filter(inst=>inst.rotated).length);
    this.host.dataset.raisedFloorZones = String((state.layout.floorZones || []).length);
    this.host.dataset.lowCeilingZones = String((state.layout.ceilingZones || []).length);
    this.host.dataset.doorOpenings = String((state.layout.areas || []).filter(area=>area.kind==="door" || area.kind==="garagedoor").length);
    const calibratedModels=this.roomInstances.filter(inst=>{
      const item=getItemById(inst.itemId);
      return item && String(item.model3dFamily||"auto")!=="auto";
    }).length;
    this.host.dataset.calibratedModels=String(calibratedModels);
    this.host.dataset.autoDetectedModels=String(Math.max(0,this.roomInstances.length-calibratedModels));
    this.host.dataset.matchedProfileModels=String(this.roomInstances.filter(inst=>{
      const item=getItemById(inst.itemId);
      return item && equipmentModelProfile(item)!=="standard";
    }).length);
    this.ceiling = Math.max(6, safeNum(settingsCeilingHeightTotalFt()) || 8);
    this.scene = new THREE.Scene();
    const blackWalls=this.settings.wallColor==="black";
    this.scene.background = new THREE.Color(
      this.mode === "walkthrough"
        ? (blackWalls?0x20262c:0xaeb8c3)
        : (blackWalls?0xc4ccd3:0xd8dde1)
    );
    this.scene.fog = new THREE.Fog(this.scene.background, 38, 92);
    const fov=this.mode === "walkthrough"
      ? clamp(Math.round(safeNum(this.settings.fovDeg)||80),55,95)
      : 54;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 180);
    this.host.dataset.fov=String(fov);
    this.host.dataset.wallColor=blackWalls?"black":"white";
    this.host.dataset.floorType=String(this.settings.floorType||"rolled-rubber");
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:"high-performance"});
    const pixelRatioCap=this.mode==="walkthrough"?1.5:1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,pixelRatioCap));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.mode==="walkthrough"
      ? (blackWalls?.94:1.02)
      : .92;
    this.renderer.domElement.className = "gym3dCanvas";
    this.renderer.domElement.setAttribute("aria-label", this.mode === "walkthrough" ? "Interactive first-person gym view" : "Interactive 3D gym preview");
    this.renderer.domElement.tabIndex = 0;
    this.host.prepend(this.renderer.domElement);

    this.disposables = [];
    this.clickTargets = [];
    this.itemGroups = new Map();
    this.areaGroups = new Map();
    this.wallFeatureGroups = new Map();
    this.rawBoundarySegments=GymGarageDoors.boundarySegments(this.roomData.rects);
    this.garageDoorGroups=new Map();
    this.garageDoorWarnings=[];
    this.garageDoorMinimapSegments=[];
    this.resolvedGarageDoors=this.resolveGarageDoorAreas();
    this.standardDoorModelCount=0;
    this.garageDoorModelCount=0;
    this.garageDoorFallbackCount=0;
    this.garageDoorPanelCount=0;
    this.garageDoorTrackPairCount=0;
    this.invalidWallFeatureWarning = "";
    this.featurePointLights = 0;
    this.doorCollisionSegments = [];
    this.labelSprites = new Map();
    this.hoveredInstId = null;
    this.hoverTime = 0;
    this.keys = new Set();
    this.drag = null;
    this.lookDrag = null;
    this.walkActive = false;
    this.reconstructedModelCount = 0;
    this.host.dataset.reconstructedModels = "0";
    this.dedicatedModelCount = 0;
    this.builderFailureCount = 0;
    this.modelProfileKeys = new Set();
    this.modelBuilderKeys = new Set();
    this.builderFallbackWarnings = [];
    this.host.dataset.dedicatedModels = "0";
    this.host.dataset.builderFailures = "0";
    this.host.dataset.modelProfiles = "";
    this.host.dataset.modelBuilders = "";
    this.customAssetModelCount = 0;
    this.customAssetErrorCount = 0;
    this.customAssetRequestedCount = this.roomInstances.filter(inst=>itemHasLocal3dModel(getItemById(inst.itemId))).length;
    this.host.dataset.customAssetRequested = String(this.customAssetRequestedCount);
    this.host.dataset.customAssetModels = "0";
    this.host.dataset.customAssetErrors = "0";
    this.host.dataset.customAssetPending = String(this.customAssetRequestedCount);
    this.yaw = 0;
    this.pitch = -0.12;
    this.lastTime = performance.now();
    this.minimapTime = 0;
    this.destroyed = false;

    this.addEnvironment();
    this.addLights();
    this.buildRoom();
    this.buildDoors();
    this.buildGarageDoors();
    this.publishDoorDiagnostics();
    this.buildWallFeatures();
    this.buildZones();
    this.buildEquipment();
    this.buildOutlets();
    this.setInitialCamera();
    this.bindEvents();
    this.resize();

    const loading = this.host.querySelector(".gym3dLoading");
    if(loading) loading.remove();
    if(this.mode === "walkthrough") this.activateWalkthrough();
    this.updateWarnings();
    this.host.dataset.renderQuality = "studio-pbr";
    this.animate();
  }

  addEnvironment(){
    const environmentScene=new THREE.Scene();
    environmentScene.background=new THREE.Color(this.settings.wallColor==="black"?0x242a31:0xbcc4ca);

    const roomGeometry=new THREE.BoxGeometry(40,20,40);
    const roomMaterial=new THREE.MeshBasicMaterial({
      color:this.settings.wallColor==="black"?0x59616a:0xd4d7d8,
      side:THREE.BackSide,
    });
    environmentScene.add(new THREE.Mesh(roomGeometry,roomMaterial));

    const panels=[
      {size:[14,7],position:[0,8,-8],rotation:[0,0,0],color:0xfff4df},
      {size:[10,6],position:[-9,3,0],rotation:[0,Math.PI/2,0],color:0xddeeff},
      {size:[9,5],position:[9,4,2],rotation:[0,-Math.PI/2,0],color:0xffe2c4},
      {size:[12,6],position:[0,6,9],rotation:[0,Math.PI,0],color:0xe9eef2},
      {size:[12,12],position:[0,9,0],rotation:[Math.PI/2,0,0],color:0xffffff},
    ];
    const temporary=[];
    panels.forEach(panel=>{
      const geometry=new THREE.PlaneGeometry(panel.size[0],panel.size[1]);
      const material=new THREE.MeshBasicMaterial({color:panel.color,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(...panel.position);
      mesh.rotation.set(...panel.rotation);
      environmentScene.add(mesh);
      temporary.push(geometry,material);
    });

    let pmrem=null;
    try{
      pmrem=new THREE.PMREMGenerator(this.renderer);
      this.environmentTarget=pmrem.fromScene(environmentScene,.035,.1,100);
      this.scene.environment=this.environmentTarget.texture;
      this.host.dataset.environmentMap="studio";
    }catch{
      this.environmentTarget=null;
      this.scene.environment=null;
      this.host.dataset.environmentMap="fallback";
    }finally{
      pmrem?.dispose?.();
      temporary.forEach(item=>item.dispose?.());
      roomGeometry.dispose();
      roomMaterial.dispose();
    }
  }

  addLights(){
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x313841, .68);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff7ea, .86);
    sun.position.set(this.bounds.minX - 8, this.ceiling + 10, this.bounds.minY - 6);
    sun.target.position.set(
      (this.bounds.minX+this.bounds.maxX)/2,
      Math.min(2.5,this.ceiling*.32),
      (this.bounds.minY+this.bounds.maxY)/2
    );
    sun.castShadow = true;
    const shadowMapSize=this.mode==="walkthrough"?2048:1024;
    sun.shadow.mapSize.set(shadowMapSize,shadowMapSize);
    const span=Math.hypot(this.bounds.w,this.bounds.h)/2+2;
    sun.shadow.camera.left = -span;
    sun.shadow.camera.right = span;
    sun.shadow.camera.top = span;
    sun.shadow.camera.bottom = -span;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -.00035;
    sun.shadow.normalBias = .035;
    sun.shadow.radius = 3;
    this.scene.add(sun,sun.target);
    const fill = new THREE.DirectionalLight(0xdbeafe, .28);
    fill.position.set(this.bounds.maxX + 4, 6, this.bounds.maxY + 5);
    fill.target.position.set(
      (this.bounds.minX+this.bounds.maxX)/2,
      Math.min(1.8,this.ceiling*.22),
      (this.bounds.minY+this.bounds.maxY)/2
    );
    this.scene.add(fill,fill.target);

    const lightPositions=[
      [.28,.3],[.72,.3],[.28,.7],[.72,.7],
    ];
    let fixtureCount=0;
    lightPositions.forEach(([px,pz],index)=>{
      const x=this.bounds.minX+this.bounds.w*px;
      const z=this.bounds.minY+this.bounds.h*pz;
      if(!pointInRoom(x,z,this.roomData.rects)) return;
      const light=new THREE.SpotLight(index%2?0xfff1dc:0xe8f2ff,.42,Math.max(this.bounds.w,this.bounds.h)*1.8,Math.PI/3.05,.88,1.2);
      light.position.set(x,Math.max(5.5,this.ceiling-.15),z);
      light.target.position.set(x,0,z);
      this.scene.add(light,light.target);
      fixtureCount++;
    });
    this.host.dataset.ceilingLights=String(fixtureCount);
  }

  material(params){
    const metalness=safeNum(params?.metalness);
    const material = new THREE.MeshStandardMaterial({
      envMapIntensity:params?.envMapIntensity ?? (metalness>.2?1.08:.32),
      ...params,
    });
    material.userData.baseEmissive = material.emissive?.getHex?.() || 0;
    material.userData.baseEmissiveIntensity = safeNum(material.emissiveIntensity);
    this.disposables.push(material);
    return material;
  }

  geometry(geometry){
    this.disposables.push(geometry);
    return geometry;
  }

  box(parent, size, position, material, options={}){
    const mesh = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(size.x, size.y, size.z)), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    if(options.rotationX) mesh.rotation.x = options.rotationX;
    if(options.rotationY) mesh.rotation.y = options.rotationY;
    if(options.rotationZ) mesh.rotation.z = options.rotationZ;
    if(options.instId){
      mesh.userData.instId = options.instId;
      this.clickTargets.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  cylinder(parent, radius, height, position, material, options={}){
    const mesh = new THREE.Mesh(
      this.geometry(new THREE.CylinderGeometry(radius, radius, height, options.segments || 16)),
      material
    );
    mesh.position.set(position.x,position.y,position.z);
    mesh.rotation.set(options.rotationX||0,options.rotationY||0,options.rotationZ||0);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    if(options.instId){
      mesh.userData.instId = options.instId;
      this.clickTargets.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  beam(parent, start, end, width, depth, material, options={}){
    const a=new THREE.Vector3(start.x,start.y,start.z);
    const b=new THREE.Vector3(end.x,end.y,end.z);
    const direction=b.clone().sub(a);
    const length=Math.max(.01,direction.length());
    const mesh=new THREE.Mesh(
      this.geometry(new THREE.BoxGeometry(width,length,depth)),
      material
    );
    mesh.position.copy(a.add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    mesh.castShadow=options.castShadow!==false;
    mesh.receiveShadow=options.receiveShadow!==false;
    if(options.instId){
      mesh.userData.instId=options.instId;
      this.clickTargets.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  tube(parent,start,end,radius,material,options={}){
    const a=new THREE.Vector3(start.x,start.y,start.z);
    const b=new THREE.Vector3(end.x,end.y,end.z);
    const direction=b.clone().sub(a);
    const length=Math.max(.01,direction.length());
    const mesh=new THREE.Mesh(
      this.geometry(new THREE.CylinderGeometry(radius,radius,length,options.segments||18)),
      material
    );
    mesh.position.copy(a.add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    mesh.castShadow=options.castShadow!==false;
    mesh.receiveShadow=options.receiveShadow!==false;
    if(options.instId){
      mesh.userData.instId=options.instId;
      this.clickTargets.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  floorTexture(rect,channel="color"){
    const type=String(this.settings.floorType||"rolled-rubber");
    const canvas=document.createElement("canvas");
    canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext("2d");
    const seeded=(n)=>{
      const value=Math.sin(n*91.173+17.31)*43758.5453;
      return value-Math.floor(value);
    };
    if(type==="concrete"){
      const base=channel==="color"?151:channel==="roughness"?232:128;
      ctx.fillStyle=`rgb(${base},${base},${base})`;ctx.fillRect(0,0,512,512);
      for(let i=0;i<1800;i++){
        const variance=channel==="color"?36:channel==="roughness"?18:54;
        const shade=Math.round(base-variance/2+seeded(i)*variance);
        ctx.fillStyle=`rgba(${shade},${shade},${shade},${.045+seeded(i+3)*.08})`;
        const size=.5+seeded(i+7)*3.1;
        ctx.fillRect(seeded(i+11)*512,seeded(i+19)*512,size,size);
      }
      ctx.strokeStyle=channel==="bump"?"rgba(68,68,68,.42)":"rgba(62,69,76,.18)";ctx.lineWidth=channel==="bump"?2:1;
      ctx.beginPath();ctx.moveTo(36,380);ctx.lineTo(140,336);ctx.lineTo(236,356);ctx.lineTo(330,312);ctx.stroke();
    }else if(type==="rubber-tiles"){
      const base=channel==="color"?38:channel==="roughness"?232:128;
      ctx.fillStyle=`rgb(${base},${base+2},${base+3})`;ctx.fillRect(0,0,512,512);
      for(let i=0;i<900;i++){
        const shade=Math.round(base-12+seeded(i)*24);
        ctx.fillStyle=`rgba(${shade},${shade},${shade},.12)`;
        const size=.6+seeded(i+7)*2;
        ctx.fillRect(seeded(i+11)*512,seeded(i+19)*512,size,size);
      }
      const seam=channel==="roughness"?196:channel==="bump"?82:12;
      ctx.strokeStyle=`rgba(${seam},${seam},${seam},.78)`;ctx.lineWidth=6;
      ctx.beginPath();ctx.moveTo(256,0);ctx.lineTo(256,512);ctx.moveTo(0,256);ctx.lineTo(512,256);ctx.stroke();
      ctx.strokeStyle=channel==="color"?"rgba(255,255,255,.06)":"rgba(150,150,150,.18)";ctx.lineWidth=1;
      ctx.strokeRect(4,4,504,504);
    }else{
      const base=channel==="color"?34:channel==="roughness"?226:128;
      ctx.fillStyle=`rgb(${base},${base+3},${base+5})`;ctx.fillRect(0,0,512,512);
      for(let i=0;i<1250;i++){
        const warm=seeded(i+5)>.86;
        if(channel==="color") ctx.fillStyle=warm?"rgba(225,113,50,.18)":"rgba(205,215,224,.1)";
        else{
          const shade=Math.round(base-18+seeded(i+7)*36);
          ctx.fillStyle=`rgba(${shade},${shade},${shade},.25)`;
        }
        const size=.4+seeded(i+9)*1.65;
        ctx.fillRect(seeded(i+13)*512,seeded(i+21)*512,size,size);
      }
      const seam=channel==="bump"?82:channel==="roughness"?205:9;
      ctx.fillStyle=`rgba(${seam},${seam},${seam},.65)`;ctx.fillRect(0,0,5,512);
      ctx.fillStyle=channel==="color"?"rgba(255,255,255,.04)":"rgba(155,155,155,.18)";ctx.fillRect(5,0,1,512);
    }
    const texture=new THREE.CanvasTexture(canvas);
    if(channel==="color") texture.encoding=THREE.sRGBEncoding;
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    const tile=type==="rubber-tiles"?4:type==="rolled-rubber"?4:8;
    texture.repeat.set(Math.max(1,rect.w/tile),Math.max(1,rect.h/tile));
    texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy?.()||1);
    this.disposables.push(texture);
    return texture;
  }

  floorMaterial(rect){
    const type=String(this.settings.floorType||"rolled-rubber");
    const params=type==="concrete"
      ? {color:0xffffff,roughness:.94,metalness:0,bumpScale:.018,envMapIntensity:.18}
      : type==="rubber-tiles"
        ? {color:0xffffff,roughness:.88,metalness:.015,bumpScale:.012,envMapIntensity:.22}
        : {color:0xffffff,roughness:.86,metalness:.018,bumpScale:.016,envMapIntensity:.24};
    return this.material({
      ...params,
      map:this.floorTexture(rect,"color"),
      bumpMap:this.floorTexture(rect,"bump"),
      roughnessMap:this.floorTexture(rect,"roughness"),
    });
  }

  wallTexture(black,channel="color"){
    const canvas=document.createElement("canvas");
    canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext("2d");
    const base=channel==="color"?(black?30:232):128;
    ctx.fillStyle=`rgb(${base},${base},${base})`;ctx.fillRect(0,0,256,256);
    for(let i=0;i<1200;i++){
      const value=Math.sin(i*39.17+2.71)*43758.5453;
      const seeded=value-Math.floor(value);
      const shade=Math.round(base-10+seeded*20);
      ctx.fillStyle=`rgba(${shade},${shade},${shade},${channel==="color"?.045:.16})`;
      const x=(i*73)%256,y=(i*137)%256,size=.35+seeded*1.15;
      ctx.fillRect(x,y,size,size);
    }
    const texture=new THREE.CanvasTexture(canvas);
    if(channel==="color") texture.encoding=THREE.sRGBEncoding;
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(Math.max(2,this.bounds.w/5),Math.max(2,this.ceiling/4));
    texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy?.()||1);
    this.disposables.push(texture);
    return texture;
  }

  buildRoom(){
    this.roomData.rects.forEach(rect=>{
      const floorMat=this.floorMaterial(rect);
      this.box(
        this.scene,
        {x:rect.w, y:0.12, z:rect.h},
        {x:rect.x + rect.w/2, y:-0.06, z:rect.y + rect.h/2},
        floorMat,
        {castShadow:false}
      );
    });

    this.addFloorGrid();

    if(this.settings.walls){
      const black=this.settings.wallColor==="black";
      const wallMat = this.material({
        color:0xffffff,
        map:this.wallTexture(black,"color"),
        bumpMap:this.wallTexture(black,"bump"),
        bumpScale:.008,
        roughness:black?.78:.9,
        metalness:0,
        envMapIntensity:black?.24:.16,
      });
      const trimMat = this.material({color:black?0x252a30:0xbfc0bd, roughness:.68,metalness:.08,envMapIntensity:.32});
      const wallHeight = this.mode === "preview" ? Math.min(3.35, this.ceiling) : this.ceiling;
      this.roomWallMaterial=wallMat;
      this.roomTrimMaterial=trimMat;
      this.roomWallHeight=wallHeight;
      this.roomBoundarySegments().forEach(seg=>{
        if(seg.axis === "x"){
          this.box(this.scene, {x:seg.length, y:wallHeight, z:0.16}, {x:seg.mid, y:wallHeight/2, z:seg.fixed}, wallMat);
          this.box(this.scene, {x:seg.length, y:0.18, z:0.21}, {x:seg.mid, y:0.09, z:seg.fixed}, trimMat, {castShadow:false});
        }else{
          this.box(this.scene, {x:0.16, y:wallHeight, z:seg.length}, {x:seg.fixed, y:wallHeight/2, z:seg.mid}, wallMat);
          this.box(this.scene, {x:0.21, y:0.18, z:seg.length}, {x:seg.fixed, y:0.09, z:seg.mid}, trimMat, {castShadow:false});
        }
      });
    }

    if(this.settings.ceiling && this.mode==="walkthrough"){
      const ceilingMat = this.material({
        color:0xebeae6,
        transparent:false,
        opacity:1,
        roughness:.84,
        metalness:0,
        envMapIntensity:.12,
        side:THREE.DoubleSide,
        depthWrite:true,
      });
      this.roomData.rects.forEach(rect=>{
        this.box(this.scene, {x:rect.w, y:0.05, z:rect.h}, {x:rect.x+rect.w/2, y:this.ceiling, z:rect.y+rect.h/2}, ceilingMat, {castShadow:false});
      });
      this.addCeilingFixtures();
    }else{
      this.host.dataset.ceilingFixtures="0";
    }
  }

  addCeilingFixtures(){
    const panelMaterial=this.material({
      color:0xfffbf2,
      emissive:0xffe4b5,
      emissiveIntensity:this.mode==="walkthrough"?1.25:.62,
      roughness:.4,
      metalness:.04,
      envMapIntensity:.2,
    });
    let count=0;
    this.roomData.rects.forEach(rect=>{
      const xs=rect.w>12?[.3,.7]:[.5];
      const zs=rect.h>12?[.32,.68]:[.5];
      xs.forEach(px=>zs.forEach(pz=>{
        const width=Math.min(3.2,Math.max(1.8,rect.w*.2));
        this.box(
          this.scene,
          {x:width,y:.035,z:.58},
          {x:rect.x+rect.w*px,y:this.ceiling-.045,z:rect.y+rect.h*pz},
          panelMaterial,
          {castShadow:false,receiveShadow:false}
        );
        count++;
      }));
    });
    this.host.dataset.ceilingFixtures=String(count);
  }

  addFloorGrid(){
    if(this.mode==="walkthrough") return;
    const vertices = [];
    const step = 1;
    const minX = Math.floor(this.bounds.minX);
    const maxX = Math.ceil(this.bounds.maxX);
    const minZ = Math.floor(this.bounds.minY);
    const maxZ = Math.ceil(this.bounds.maxY);
    for(let x=minX; x<=maxX; x+=step){
      for(let z=minZ; z<maxZ; z+=0.5){
        const z2 = Math.min(maxZ, z+0.5);
        if(pointInRoom(x+0.001, (z+z2)/2, this.roomData.rects) || pointInRoom(x-0.001, (z+z2)/2, this.roomData.rects)){
          vertices.push(x,0.012,z, x,0.012,z2);
        }
      }
    }
    for(let z=minZ; z<=maxZ; z+=step){
      for(let x=minX; x<maxX; x+=0.5){
        const x2 = Math.min(maxX, x+0.5);
        if(pointInRoom((x+x2)/2, z+0.001, this.roomData.rects) || pointInRoom((x+x2)/2, z-0.001, this.roomData.rects)){
          vertices.push(x,0.012,z, x2,0.012,z);
        }
      }
    }
    const geometry = this.geometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices,3));
    const concrete=this.settings.floorType==="concrete";
    const material = new THREE.LineBasicMaterial({
      color:concrete?0x646b72:0x64707b,
      transparent:true,
      opacity:concrete?.2:.16,
    });
    this.disposables.push(material);
    this.scene.add(new THREE.LineSegments(geometry, material));
  }

  addGarageDoorWarning(message){
    const text=String(message||"").trim();
    if(text&&!this.garageDoorWarnings.includes(text)) this.garageDoorWarnings.push(text);
  }

  resolveGarageDoorAreas(){
    return (state.layout.areas||[]).filter(area=>area.kind==="garagedoor").map(area=>{
      const rect=areaRect(area);
      const raw=GymGarageDoors.resolveOpening(rect,this.rawBoundarySegments,{areaId:area.id,label:area.label});
      if(!raw.ok){
        this.addGarageDoorWarning(`${area.label||"Garage door"}: ${raw.message}`);
        return {area,rect,resolution:raw};
      }
      const resolution={
        ...raw,
        centerX:raw.axis==="z"?raw.fixed:(raw.start+raw.end)/2,
        centerZ:raw.axis==="x"?raw.fixed:(raw.start+raw.end)/2,
      };
      return {area,rect,resolution};
    });
  }

  garageDoorTrackDepth(resolution,maxFt=8){
    if(!resolution?.ok) return 0;
    const maximum=Math.max(0,safeNum(maxFt));
    const margin=.25;
    const step=.05;
    let insideDistance=0;
    for(let distance=.01;distance<=maximum+margin+step;distance+=step){
      const x=resolution.centerX+resolution.inwardX*distance;
      const z=resolution.centerZ+resolution.inwardZ*distance;
      if(!pointInRoom(x,z,this.roomData.rects)) break;
      insideDistance=distance;
    }
    if(insideDistance>=maximum+margin-.01) return maximum;
    return Math.max(0,Math.min(maximum,insideDistance-margin));
  }

  roomBoundarySegments(){
    const standardOpenings=(state.layout.areas||[])
      .filter(area=>area.kind==="door")
      .map(area=>areaRect(area));
    const garageOpenings=this.resolvedGarageDoors
      .filter(entry=>entry.resolution.ok)
      .map(entry=>entry.resolution);
    const subtractRange=(ranges,start,end)=>{
      const out=[];
      ranges.forEach(([a,b])=>{
        if(end<=a || start>=b){out.push([a,b]);return;}
        if(start>a) out.push([a,Math.min(start,b)]);
        if(end<b) out.push([Math.max(end,a),b]);
      });
      return out;
    };
    const split=[];
    this.rawBoundarySegments.filter(s=>s.length>0.01).forEach(seg=>{
      const start=seg.start,end=seg.end;
      let ranges=[[start,end]];
      standardOpenings.forEach(opening=>{
        if(seg.axis==="x"){
          const touches=Math.abs(seg.fixed-opening.y)<.03 || Math.abs(seg.fixed-(opening.y+opening.h))<.03;
          if(touches) ranges=subtractRange(ranges,opening.x,opening.x+opening.w);
        }else{
          const touches=Math.abs(seg.fixed-opening.x)<.03 || Math.abs(seg.fixed-(opening.x+opening.w))<.03;
          if(touches) ranges=subtractRange(ranges,opening.y,opening.y+opening.h);
        }
      });
      garageOpenings.forEach(opening=>{
        if(opening.axis===seg.axis&&Math.abs(opening.fixed-seg.fixed)<.03){
          ranges=subtractRange(ranges,opening.start,opening.end);
        }
      });
      ranges.filter(([a,b])=>b-a>.01).forEach(([a,b])=>split.push({...seg,start:a,end:b,mid:(a+b)/2,length:b-a}));
    });
    return split;
  }

  doorWoodTexture(channel="color"){
    const canvas=document.createElement("canvas");
    canvas.width=256;
    canvas.height=512;
    const ctx=canvas.getContext("2d");
    const base=channel==="color"?188:128;
    ctx.fillStyle=channel==="color"?"#b88451":`rgb(${base},${base},${base})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<92;i++){
      const x=(i*47.31)%256;
      const wave=Math.sin(i*1.83)*6;
      const alpha=channel==="color"?.055:.16;
      const shade=channel==="color"?(i%3===0?62:238):(i%2?98:158);
      ctx.strokeStyle=`rgba(${shade},${channel==="color"?42:shade},${channel==="color"?22:shade},${alpha})`;
      ctx.lineWidth=.5+(i%5)*.22;
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.bezierCurveTo(x+wave,150,x-wave,330,x+wave*.4,512);
      ctx.stroke();
    }
    for(let i=0;i<5;i++){
      const x=28+(i*71)%220,y=64+(i*113)%390;
      ctx.strokeStyle=channel==="color"?"rgba(74,42,20,.14)":"rgba(72,72,72,.2)";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.ellipse(x,y,9+i%3*3,3+i%2,0,0,Math.PI*2);
      ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);
    if(channel==="color") texture.encoding=THREE.sRGBEncoding;
    texture.wrapS=THREE.ClampToEdgeWrapping;
    texture.wrapT=THREE.ClampToEdgeWrapping;
    texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy?.()||1);
    this.disposables.push(texture);
    return texture;
  }

  buildDoors(){
    const doors=(state.layout.areas||[]).filter(area=>area.kind==="door");
    this.standardDoorModelCount=0;
    if(!doors.length){
      this.host.dataset.standardDoorModels="0";
      return;
    }
    const slabMaterial=this.material({
      color:0xffffff,
      map:this.doorWoodTexture("color"),
      bumpMap:this.doorWoodTexture("bump"),
      bumpScale:.018,
      roughness:.66,
      metalness:.02,
      envMapIntensity:.42,
    });
    const panelMaterial=this.material({color:0x9b673c,roughness:.7,metalness:.02,envMapIntensity:.34});
    const frameMaterial=this.material({
      color:this.settings.wallColor==="black"?0x30353a:0xe8e5df,
      roughness:.72,
      metalness:.04,
      envMapIntensity:.28,
    });
    const revealMaterial=this.material({color:0x17191c,roughness:.86,metalness:.04,envMapIntensity:.18});
    const hardwareMaterial=this.material({color:0xbfc5ca,roughness:.2,metalness:.94,envMapIntensity:1.24});
    let count=0;

    doors.forEach(area=>{
      const rect=areaRect(area);
      const clearance=typeof doorClearanceRect==="function"
        ? doorClearanceRect({...area,doorClearEnabled:true})
        : null;
      const orient=clearance?.orient || (rect.w>=rect.h?"horizontal":"vertical");
      const hinge=clearance?.hinge || area.doorHinge || "start";
      const swing=clearance?.swing || area.doorSwing || (orient==="horizontal"?"down":"right");
      const openingLength=Math.max(.8,orient==="horizontal"?rect.w:rect.h);
      const doorWidth=Math.max(.8,openingLength-1/12);
      const hingeX=Number.isFinite(clearance?.hingeX)
        ? clearance.hingeX
        : (orient==="horizontal"?(hinge==="end"?rect.x+rect.w:rect.x):rect.x);
      const hingeZ=Number.isFinite(clearance?.hingeY)
        ? clearance.hingeY
        : (orient==="vertical"?(hinge==="end"?rect.y+rect.h:rect.y):rect.y);
      const tangent=orient==="horizontal"
        ? {x:hinge==="end"?-1:1,z:0}
        : {x:0,z:hinge==="end"?-1:1};
      const normal=swing==="up"?{x:0,z:-1}
        : swing==="down"?{x:0,z:1}
          : swing==="left"?{x:-1,z:0}:{x:1,z:0};
      const baseY=this.floorElevationAt(hingeX+normal.x*.3,hingeZ+normal.z*.3);
      const doorHeight=Math.max(5.2,Math.min(6+8/12,this.ceiling-baseY-.24));
      const openAngle=72*Math.PI/180;
      const vector={
        x:tangent.x*Math.cos(openAngle)+normal.x*Math.sin(openAngle),
        z:tangent.z*Math.cos(openAngle)+normal.z*Math.sin(openAngle),
      };
      const vectorLength=Math.hypot(vector.x,vector.z)||1;
      vector.x/=vectorLength;
      vector.z/=vectorLength;

      const assembly=new THREE.Group();
      assembly.position.set(hingeX,baseY+.04,hingeZ);
      assembly.rotation.y=-Math.atan2(vector.z,vector.x);
      assembly.userData.areaId=area.id;
      assembly.userData.modelType="open architectural door";
      this.scene.add(assembly);
      this.areaGroups.set(area.id,assembly);

      const slabThickness=.13;
      this.box(
        assembly,
        {x:doorWidth,y:doorHeight,z:slabThickness},
        {x:doorWidth/2,y:doorHeight/2,z:0},
        slabMaterial
      );
      [0.2,0.4,0.6,0.8].forEach(level=>{
        [-1,1].forEach(face=>this.box(
          assembly,
          {x:doorWidth*.72,y:doorHeight*.135,z:.014},
          {x:doorWidth*.47,y:doorHeight*level,z:face*(slabThickness/2+.008)},
          panelMaterial,
          {castShadow:false}
        ));
      });
      [doorHeight*.2,doorHeight*.5,doorHeight*.8].forEach(y=>{
        this.cylinder(assembly,.038,.16,{x:.015,y,z:0},hardwareMaterial,{segments:20});
      });
      [-1,1].forEach(face=>{
        this.cylinder(
          assembly,
          .075,
          .09,
          {x:doorWidth*.86,y:doorHeight*.5,z:face*(slabThickness/2+.045)},
          hardwareMaterial,
          {rotationX:Math.PI/2,segments:24}
        );
      });

      const jamb=.17,frameDepth=.31,header=.2;
      if(orient==="horizontal"){
        const boundary=hingeZ;
        [rect.x,rect.x+rect.w].forEach(x=>{
          this.box(this.scene,{x:jamb,y:doorHeight,z:frameDepth},{x,y:baseY+doorHeight/2,z:boundary},frameMaterial);
          this.box(this.scene,{x:.055,y:doorHeight-.12,z:frameDepth+.025},{x,y:baseY+doorHeight/2,z:boundary},revealMaterial,{castShadow:false});
        });
        this.box(this.scene,{x:rect.w+jamb*2,y:header,z:frameDepth},{x:rect.x+rect.w/2,y:baseY+doorHeight+header/2,z:boundary},frameMaterial);
        this.box(this.scene,{x:rect.w,y:.045,z:frameDepth*.9},{x:rect.x+rect.w/2,y:baseY+.023,z:boundary},hardwareMaterial,{castShadow:false});
        if(this.roomWallMaterial && this.roomWallHeight>baseY+doorHeight+header){
          const fillHeight=this.roomWallHeight-baseY-doorHeight-header;
          this.box(this.scene,{x:rect.w,y:fillHeight,z:.16},{x:rect.x+rect.w/2,y:baseY+doorHeight+header+fillHeight/2,z:boundary},this.roomWallMaterial);
        }
      }else{
        const boundary=hingeX;
        [rect.y,rect.y+rect.h].forEach(z=>{
          this.box(this.scene,{x:frameDepth,y:doorHeight,z:jamb},{x:boundary,y:baseY+doorHeight/2,z},frameMaterial);
          this.box(this.scene,{x:frameDepth+.025,y:doorHeight-.12,z:.055},{x:boundary,y:baseY+doorHeight/2,z},revealMaterial,{castShadow:false});
        });
        this.box(this.scene,{x:frameDepth,y:header,z:rect.h+jamb*2},{x:boundary,y:baseY+doorHeight+header/2,z:rect.y+rect.h/2},frameMaterial);
        this.box(this.scene,{x:frameDepth*.9,y:.045,z:rect.h},{x:boundary,y:baseY+.023,z:rect.y+rect.h/2},hardwareMaterial,{castShadow:false});
        if(this.roomWallMaterial && this.roomWallHeight>baseY+doorHeight+header){
          const fillHeight=this.roomWallHeight-baseY-doorHeight-header;
          this.box(this.scene,{x:.16,y:fillHeight,z:rect.h},{x:boundary,y:baseY+doorHeight+header+fillHeight/2,z:rect.y+rect.h/2},this.roomWallMaterial);
        }
      }

      const freeX=hingeX+vector.x*doorWidth;
      const freeZ=hingeZ+vector.z*doorWidth;
      this.doorCollisionSegments.push({x1:hingeX,z1:hingeZ,x2:freeX,z2:freeZ});
      assembly.userData.focusPoint={
        x:hingeX+vector.x*doorWidth*.5,
        y:baseY+doorHeight*.46,
        z:hingeZ+vector.z*doorWidth*.5,
      };
      assembly.userData.worldFootprint={widthFt:doorWidth,depthFt:doorWidth,heightFt:doorHeight};
      assembly.userData.openAngleDeg=72;
      assembly.userData.orientation=orient;
      assembly.userData.hinge=hinge;
      assembly.userData.swing=swing;
      assembly.userData.openingWidthFt=openingLength;
      assembly.userData.doorHeightFt=doorHeight;
      assembly.userData.floorElevationFt=baseY;
      count++;
    });
    this.standardDoorModelCount=count;
    this.host.dataset.standardDoorModels=String(count);
  }

  disposeGarageDoorStage(root,disposablesStart,protectedResources){
    const protectedSet=new Set(
      protectedResources instanceof Set
        ? protectedResources
        : Array.isArray(protectedResources)
          ? protectedResources
          : Object.values(protectedResources||{})
    );
    const stagedObjects=new Set();
    const stagedGeometries=new Set();
    root?.traverse?.(object=>{
      stagedObjects.add(object);
      if(object.geometry) stagedGeometries.add(object.geometry);
    });
    const stagedResources=new Set(this.disposables.slice(Math.max(0,disposablesStart)));
    const disposed=new Set();
    stagedGeometries.forEach(geometry=>{
      if(protectedSet.has(geometry)) return;
      geometry.dispose?.();
      disposed.add(geometry);
    });
    stagedResources.forEach(resource=>{
      if(protectedSet.has(resource)||disposed.has(resource)) return;
      resource?.dispose?.();
      disposed.add(resource);
    });
    this.disposables=this.disposables.filter(resource=>!disposed.has(resource));
    this.clickTargets=this.clickTargets.filter(target=>!stagedObjects.has(target));
    root?.removeFromParent?.();
    return disposed.size;
  }

  buildGarageDoors(){
    this.garageDoorModelCount=0;
    this.garageDoorFallbackCount=0;
    this.garageDoorPanelCount=0;
    this.garageDoorTrackPairCount=0;
    this.resolvedGarageDoors.filter(entry=>entry.resolution.ok).forEach(({area,resolution})=>{
      const assembly=new THREE.Group();
      const floorFt=this.floorElevationAt(
        resolution.centerX+resolution.inwardX*.2,
        resolution.centerZ+resolution.inwardZ*.2,
      );
      const heightFt=Math.max(.5,safeNum(area.garageDoorHeightFt)+safeNum(area.garageDoorHeightIn)/12);
      assembly.position.set(resolution.centerX,floorFt,resolution.centerZ);
      assembly.rotation.y=resolution.rotationY;
      assembly.userData.areaId=area.id;

      const resources=GymGarageDoor3D.prepareResources(this,area.garageDoorColor);
      const protectedResources=new Set([
        ...Object.values(resources),
        this.roomWallMaterial,
        this.roomTrimMaterial,
      ].filter(Boolean));
      const spec={
        areaId:area.id,
        widthFt:resolution.widthFt,
        heightFt,
        ceilingFt:Math.max(0,this.ceiling-floorFt),
        floorFt:0,
        trackDepthFt:this.garageDoorTrackDepth(resolution),
        color:area.garageDoorColor,
        boundary:resolution,
        wallMaterial:this.roomWallMaterial||null,
        preview:this.mode==="preview",
        resources,
      };

      let staged=new THREE.Group();
      staged.name="garage-door-detail-stage";
      assembly.add(staged);
      const disposablesStart=this.disposables.length;
      let result;
      let fallback=false;
      try{
        result=GymGarageDoor3D.buildRaisedPanel(this,staged,spec);
      }catch(error){
        this.disposeGarageDoorStage(staged,disposablesStart,protectedResources);
        this.addGarageDoorWarning(`${area.label||"Garage door"}: detailed 3D model unavailable — using closed fallback.`);
        staged=new THREE.Group();
        staged.name="garage-door-fallback-stage";
        assembly.add(staged);
        result=GymGarageDoor3D.buildFallback(this,staged,spec);
        fallback=true;
      }

      assembly.updateMatrixWorld(true);
      const focusPoint=assembly.localToWorld(new THREE.Vector3(0,heightFt*.46,.35));
      assembly.userData.modelType=result.modelType;
      assembly.userData.boundaryMounted=true;
      assembly.userData.boundaryWall=resolution.wall;
      assembly.userData.garageBoundary=resolution;
      assembly.userData.rotationY=resolution.rotationY;
      assembly.userData.focusPoint={x:focusPoint.x,y:focusPoint.y,z:focusPoint.z};
      assembly.userData.worldFootprint={widthFt:resolution.widthFt,depthFt:2/12,heightFt};
      assembly.userData.openingWidthFt=resolution.widthFt;
      assembly.userData.doorHeightFt=heightFt;
      assembly.userData.floorElevationFt=floorFt;
      assembly.userData.fallback=fallback;
      assembly.userData.panelCount=safeNum(result.panelCount);
      assembly.userData.trackPairs=safeNum(result.trackPairs);
      assembly.userData.meshCount=safeNum(result.meshCount);
      assembly.userData.shadowCasterCount=safeNum(result.shadowCasterCount);
      assembly.userData.interiorInsetFt=safeNum(result.interiorInsetFt);

      this.scene.add(assembly);
      this.areaGroups.set(area.id,assembly);
      this.garageDoorGroups.set(area.id,assembly);
      this.garageDoorMinimapSegments.push({areaId:area.id,group:assembly});
      this.garageDoorModelCount++;
      this.garageDoorFallbackCount+=fallback?1:0;
      this.garageDoorPanelCount+=safeNum(result.panelCount);
      this.garageDoorTrackPairCount+=safeNum(result.trackPairs);
    });
  }

  publishDoorDiagnostics(){
    const standardOpenings=(state.layout.areas||[]).filter(area=>area.kind==="door").length;
    const garageOpenings=this.resolvedGarageDoors.filter(entry=>entry.resolution.ok).length;
    const invalidGarages=this.resolvedGarageDoors.length-garageOpenings;
    this.host.dataset.doorOpenings=String(standardOpenings+this.resolvedGarageDoors.length);
    this.host.dataset.standardDoorOpenings=String(standardOpenings);
    this.host.dataset.garageDoorOpenings=String(garageOpenings);
    this.host.dataset.doorModels=String(this.standardDoorModelCount+this.garageDoorModelCount);
    this.host.dataset.standardDoorModels=String(this.standardDoorModelCount);
    this.host.dataset.garageDoorModels=String(this.garageDoorModelCount);
    this.host.dataset.doorColliders=String(this.doorCollisionSegments.length);
    this.host.dataset.invalidGarageDoors=String(invalidGarages);
    this.host.dataset.garageDoorFallbacks=String(this.garageDoorFallbackCount);
    this.host.dataset.garageDoorPanels=String(this.garageDoorPanelCount);
    this.host.dataset.garageDoorTrackPairs=String(this.garageDoorTrackPairCount);
  }

  buildWallFeatures(){
    const counts={wall:0,mirror:0,slat:0,led:0,invalid:0};
    const publish=()=>{
      this.host.dataset.wallFeatures=String(counts.wall);
      this.host.dataset.mirrorFeatures=String(counts.mirror);
      this.host.dataset.slatFeatures=String(counts.slat);
      this.host.dataset.ledFeatures=String(counts.led);
      this.host.dataset.invalidWallFeatures=String(counts.invalid);
      this.host.dataset.wallFeatureLights=String(this.featurePointLights);
    };
    if(!this.settings.walls){
      publish();
      return;
    }

    const roomData={...this.roomData,ceiling:this.ceiling};
    (state.layout.wallFeatures||[]).forEach(feature=>{
      const validation=GymWallFeatures.validate(feature,state.layout,roomData);
      if(!validation.valid){
        counts.invalid++;
        if(!this.invalidWallFeatureWarning){
          const name=feature.label || ({mirror:"Mirror",slat:"Wood slat panel",led:"LED strip"})[feature.kind] || "Wall feature";
          this.invalidWallFeatureWarning=`${name}: ${validation.reasons[0]?.message||"invalid placement"}`;
        }
        return;
      }

      const transform=GymWallFeatures.worldTransform(feature,roomData,state.layout);
      const group=new THREE.Group();
      group.position.set(transform.x,transform.y,transform.z);
      group.rotation.y=transform.rotationY;
      group.userData.wallFeatureId=feature.id;
      group.userData.wallFeature=feature;
      group.userData.rotationY=transform.rotationY;
      group.userData.worldFootprint={widthFt:transform.width,depthFt:.28,heightFt:transform.height};
      group.userData.focusPoint={x:transform.x,y:transform.y,z:transform.z};
      group.userData.selectionMaterials=[];
      this.scene.add(group);

      if(feature.kind==="mirror") this.buildMirrorWallFeature(group,feature,transform);
      else if(feature.kind==="slat") this.buildSlatWallFeature(group,feature,transform);
      else this.buildLedWallFeature(group,feature,transform);

      group.traverse(object=>{
        if(!object.isMesh) return;
        object.userData.wallFeatureId=feature.id;
        this.clickTargets.push(object);
      });
      this.wallFeatureGroups.set(feature.id,group);
      counts.wall++;
      counts[feature.kind]++;
    });
    publish();
  }

  buildMirrorWallFeature(group,feature,transform){
    const backer=this.material({color:0x20262c,roughness:.72,metalness:.18,envMapIntensity:.42});
    const frame=this.material({color:0xaeb9c3,roughness:.24,metalness:.86,envMapIntensity:1.16});
    const face=new THREE.MeshPhysicalMaterial({
      color:feature.color||0xcbd5e1,
      metalness:1,
      roughness:.04,
      clearcoat:1,
      clearcoatRoughness:.035,
      envMap:this.scene.environment||null,
      envMapIntensity:1.45,
    });
    face.userData.baseEmissive=face.emissive?.getHex?.()||0;
    face.userData.baseEmissiveIntensity=safeNum(face.emissiveIntensity);
    this.disposables.push(face);

    const width=transform.width,height=transform.height;
    const frameSize=Math.min(.09,Math.max(.045,Math.min(width,height)*.022));
    this.box(group,{x:width,y:height,z:1/12},{x:0,y:0,z:1/24},backer,{castShadow:false});
    this.box(group,{x:Math.max(.02,width-frameSize*2),y:Math.max(.02,height-frameSize*2),z:.018},{x:0,y:0,z:.095},face,{castShadow:false});
    this.box(group,{x:width,y:frameSize,z:.105},{x:0,y:height/2-frameSize/2,z:.078},frame,{castShadow:false});
    this.box(group,{x:width,y:frameSize,z:.105},{x:0,y:-height/2+frameSize/2,z:.078},frame,{castShadow:false});
    this.box(group,{x:frameSize,y:Math.max(.02,height-frameSize*2),z:.105},{x:-width/2+frameSize/2,y:0,z:.078},frame,{castShadow:false});
    this.box(group,{x:frameSize,y:Math.max(.02,height-frameSize*2),z:.105},{x:width/2-frameSize/2,y:0,z:.078},frame,{castShadow:false});
    group.userData.selectionMaterials.push(backer,frame);
  }

  buildSlatWallFeature(group,feature,transform){
    const felt=this.material({color:0x242a2f,roughness:.96,metalness:0,envMapIntensity:.12});
    const wood=this.material({color:feature.color||0x8f5f3a,roughness:.62,metalness:.015,envMapIntensity:.4});
    const width=transform.width,height=transform.height;
    const slatCount=clamp(Math.round(width/(2.5/12)),3,60);
    const center=width/slatCount;
    const slatWidth=Math.min(.16,Math.max(.075,center*.56));
    this.box(group,{x:width,y:height,z:1/12},{x:0,y:0,z:1/24},felt,{castShadow:false});
    for(let index=0;index<slatCount;index++){
      const x=-width/2+center*(index+.5);
      this.box(group,{x:slatWidth,y:height,z:.12},{x,y:0,z:.1},wood,{castShadow:false});
    }
    group.userData.slatCount=slatCount;
    group.userData.selectionMaterials.push(felt);
  }

  buildLedWallFeature(group,feature,transform){
    const channel=this.material({color:0x727b84,roughness:.32,metalness:.9,envMapIntensity:1.08});
    const brightness=clamp(safeNum(feature.brightnessPct)/100,0,1);
    const diffuser=this.material({
      color:feature.color||0xffb36b,
      emissive:feature.color||0xffb36b,
      emissiveIntensity:.7+brightness*1.1,
      transparent:true,
      opacity:.82,
      roughness:.3,
      metalness:0,
      depthWrite:false,
      envMapIntensity:.18,
    });
    const width=Math.max(.055,transform.width),height=Math.max(.055,transform.height);
    this.box(group,{x:width,y:height,z:.075},{x:0,y:0,z:.038},channel,{castShadow:false});
    this.box(group,{x:Math.max(.045,width-.025),y:Math.max(.045,height-.025),z:.035},{x:0,y:0,z:.094},diffuser,{castShadow:false,receiveShadow:false});
    if(this.featurePointLights<8){
      const light=new THREE.PointLight(feature.color||0xffb36b,.42*brightness,6,2);
      light.position.set(0,0,.48);
      light.castShadow=false;
      group.add(light);
      this.featurePointLights++;
    }
    group.userData.selectionMaterials.push(channel);
  }

  floorElevationAt(x,z){
    let elevation=0;
    (state.layout.floorZones||[]).forEach(zone=>{
      const r=areaRect(zone);
      if(x>=r.x && x<=r.x+r.w && z>=r.y && z<=r.y+r.h){
        elevation=Math.max(elevation,Math.max(0,safeNum(zone.elevationIn))/12);
      }
    });
    return elevation;
  }

  buildZones(){
    const zoneStyles = {
      walkway:{color:0x38bdf8,opacity:0.12},
      door:{color:0xf59e0b,opacity:0.13},
      nogospace:{color:0xef4444,opacity:0.14},
    };
    if(this.mode!=="walkthrough"){
      (state.layout.areas || []).forEach(area=>{
        const rect = areaRect(area);
        const style = zoneStyles[area.kind] || zoneStyles.walkway;
        const mat = this.material({color:style.color, transparent:true, opacity:style.opacity, roughness:1, depthWrite:false});
        this.box(this.scene,{x:rect.w,y:0.025,z:rect.h},{x:rect.x+rect.w/2,y:0.035,z:rect.y+rect.h/2},mat,{castShadow:false});
      });
    }

    (state.layout.floorZones || []).forEach(zone=>{
      const rect = areaRect(zone);
      const elevation=Math.max(.025,Math.max(0,safeNum(zone.elevationIn))/12);
      const mat=this.floorMaterial(rect);
      this.box(
        this.scene,
        {x:rect.w,y:elevation,z:rect.h},
        {x:rect.x+rect.w/2,y:elevation/2+.012,z:rect.y+rect.h/2},
        mat,
        {castShadow:false}
      );
      const edge=this.material({color:0xf59e0b,roughness:.72,metalness:.04});
      this.box(this.scene,{x:rect.w,y:.055,z:.055},{x:rect.x+rect.w/2,y:elevation+.035,z:rect.y},edge,{castShadow:false});
      this.box(this.scene,{x:rect.w,y:.055,z:.055},{x:rect.x+rect.w/2,y:elevation+.035,z:rect.y+rect.h},edge,{castShadow:false});
    });

    (state.layout.ceilingZones || []).forEach(zone=>{
      const rect=areaRect(zone);
      const zoneHeight=Math.max(.35,typeof ceilingZoneClearanceTotalFt==="function"
        ? ceilingZoneClearanceTotalFt(zone)
        : safeNum(zone.ceilingHeightFt)+safeNum(zone.ceilingHeightIn)/12);
      const black=this.settings.wallColor==="black";
      const mat=this.material({
        color:black?0x20252b:(this.mode==="walkthrough"?0xe8e8e4:0xb7d7e8),
        transparent:this.mode!=="walkthrough",
        opacity:this.mode==="walkthrough"?.94:.22,
        roughness:.92,
        metalness:0,
        side:THREE.DoubleSide,
      });
      this.box(
        this.scene,
        {x:rect.w,y:.09,z:rect.h},
        {x:rect.x+rect.w/2,y:zoneHeight,z:rect.y+rect.h/2},
        mat,
        {castShadow:false}
      );
    });
  }

  itemColor(item){
    const raw = String(item.color || "").trim();
    if(/^#[0-9a-f]{6}$/i.test(raw)) return Number(`0x${raw.slice(1)}`);
    const text = `${item.category||""} ${item.name||""}`.toLowerCase();
    if(/cardio|row|bike|tread/.test(text)) return 0x1b2025;
    if(/bench|seat/.test(text)) return 0x0e1012;
    if(/rack|cable|trainer/.test(text)) return 0x13171b;
    if(/storage|dumbbell|plate/.test(text)) return 0x292e34;
    return 0x181c20;
  }

  contactShadowTexture(){
    if(this._contactShadowTexture) return this._contactShadowTexture;
    const canvas=document.createElement("canvas");
    canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext("2d");
    const gradient=ctx.createRadialGradient(128,128,18,128,128,126);
    gradient.addColorStop(0,"rgba(0,0,0,.74)");
    gradient.addColorStop(.42,"rgba(0,0,0,.42)");
    gradient.addColorStop(.74,"rgba(0,0,0,.14)");
    gradient.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=THREE.ClampToEdgeWrapping;
    texture.wrapT=THREE.ClampToEdgeWrapping;
    this.disposables.push(texture);
    this._contactShadowTexture=texture;
    return texture;
  }

  addContactShadow(group,w,d){
    const geometry=this.geometry(new THREE.PlaneGeometry(Math.max(.5,w*.94),Math.max(.5,d*.94)));
    const material=new THREE.MeshBasicMaterial({
      color:0x000000,
      map:this.contactShadowTexture(),
      transparent:true,
      opacity:this.settings.floorType==="concrete"?.28:.36,
      depthWrite:false,
      polygonOffset:true,
      polygonOffsetFactor:-1,
    });
    this.disposables.push(material);
    const shadow=new THREE.Mesh(geometry,material);
    shadow.rotation.x=-Math.PI/2;
    shadow.position.y=.017;
    shadow.renderOrder=1;
    shadow.receiveShadow=false;
    shadow.castShadow=false;
    group.add(shadow);
    this.contactShadowCount=(this.contactShadowCount||0)+1;
    this.host.dataset.contactShadows=String(this.contactShadowCount);
  }

  buildEquipment(){
    this.roomInstances.forEach(inst=>{
      const item = getItemById(inst.itemId);
      if(!item) return;
      const rects = effectiveRectForInst(inst,item);
      const base = rects.base;
      const fp = footprint(item);
      const family=equipmentModelFamily(item);
      const profile=equipmentModelProfile(item);
      const hasCustomAsset=itemHasLocal3dModel(item);
      const fallbackHeight = ["smith-cable","pulley-tower","strength-rack","sauna","stair-climber"].includes(family) ? 7.5 : 3.2;
      const height = clamp(fp.H || fallbackHeight, 0.45, Math.max(0.6,this.ceiling+1.5));
      const group = new THREE.Group();
      const visualGroup = new THREE.Group();
      const fallbackGroup = new THREE.Group();
      const presentation=equipmentModelPresentation(profile,hasCustomAsset,fp);
      const {longFaceProfile,modelBase,profileFacingRotation}=presentation;
      const centerX=base.x+base.w/2,centerZ=base.y+base.h/2;
      group.position.set(centerX,this.floorElevationAt(centerX,centerZ),centerZ);
      group.rotation.y=inst.rotated ? Math.PI/2 : 0;
      visualGroup.rotation.y=(item.model3dFacing==="reverse" ? Math.PI : 0)+profileFacingRotation;
      group.add(visualGroup);
      visualGroup.add(fallbackGroup);
      group.userData.instId = inst.id;
      group.userData.rotationY = group.rotation.y;
      group.userData.visualRotationY = visualGroup.rotation.y;
      group.userData.modelFamily = family;
      group.userData.modelProfile = profile;
      group.userData.longFaceProfile = longFaceProfile;
      this.scene.add(group);
      this.itemGroups.set(inst.id,group);
      this.addContactShadow(group,Math.max(.4,fp.W),Math.max(.4,fp.L));
      this.buildEquipmentModel(fallbackGroup,inst,item,modelBase,height,group);
      if(hasCustomAsset){
        this.loadCustomEquipmentModel({
          visualGroup,
          fallbackGroup,
          placementGroup:group,
          inst,
          item,
          targetWidth:Math.max(.4,fp.W),
          targetDepth:Math.max(.4,fp.L),
          targetHeight:fp.H>0 ? fp.H : null,
        });
      }
      const hitMaterial=this.material({color:0xffffff,transparent:true,opacity:0,depthWrite:false});
      this.box(group,{x:Math.max(.4,fp.W),y:height,z:Math.max(.4,fp.L)},{x:0,y:height/2,z:0},hitMaterial,{castShadow:false,receiveShadow:false,instId:inst.id});
      group.userData.worldFootprint={widthFt:base.w,depthFt:base.h,heightFt:height};
      group.userData.canonicalFootprint={widthFt:fp.W,depthFt:fp.L,heightFt:height};
      group.userData.measuredFootprint=group.userData.worldFootprint;

      if(this.settings.clearances && rects.eff && (rects.eff.w > base.w+0.01 || rects.eff.h > base.h+0.01)){
        const warning = !!inst.__invalid;
        const clearMat = this.material({
          color:warning ? 0xf97316 : 0x38bdf8,
          transparent:true,
          opacity:warning ? 0.24 : 0.14,
          roughness:1,
          depthWrite:false,
        });
        const plane = this.box(
          this.scene,
          {x:rects.eff.w,y:0.022,z:rects.eff.h},
          {x:rects.eff.x+rects.eff.w/2,y:this.floorElevationAt(centerX,centerZ)+0.055,z:rects.eff.y+rects.eff.h/2},
          clearMat,
          {castShadow:false,receiveShadow:false}
        );
        plane.renderOrder = 2;
      }

      if(this.settings.labelMode !== "off") this.addEquipmentLabel(group,inst.id,item,height,base.w,base.h);
    });
    this.updateSelection();
  }

  updateCustomAssetStatus(){
    this.host.dataset.customAssetModels=String(this.customAssetModelCount);
    this.host.dataset.customAssetErrors=String(this.customAssetErrorCount);
    this.host.dataset.customAssetPending=String(Math.max(
      0,
      this.customAssetRequestedCount-this.customAssetModelCount-this.customAssetErrorCount
    ));
  }

  disposeExternalRoot(root){
    if(!root) return;
    const materials=new Set();
    const textures=new Set();
    root.traverse?.(object=>{
      object.geometry?.dispose?.();
      const list=Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach(material=>{
        materials.add(material);
        Object.values(material).forEach(value=>{ if(value?.isTexture) textures.add(value); });
      });
    });
    textures.forEach(texture=>texture.dispose?.());
    materials.forEach(material=>material.dispose?.());
  }

  disposeStagedDedicatedRoot(root,disposablesStart){
    const resources=new Set(this.disposables.slice(disposablesStart));
    root.traverse?.(object=>{
      if(object.geometry) resources.add(object.geometry);
      const materials=Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material=>{
        resources.add(material);
        Object.values(material).forEach(value=>{ if(value?.isTexture) resources.add(value); });
      });
    });
    resources.forEach(resource=>resource?.dispose?.());
    this.disposables.splice(disposablesStart);
    root.removeFromParent();
    root.clear();
  }

  registerExternalRoot(root,instId){
    const materials=new Set();
    const textures=new Set();
    let meshCount=0;
    let triangles=0;
    let hasSkinnedMesh=false;
    root.traverse(object=>{
      if(!object?.isMesh) return;
      meshCount++;
      hasSkinnedMesh=hasSkinnedMesh || !!object.isSkinnedMesh;
      const geometry=object.geometry;
      const position=geometry?.attributes?.position;
      triangles+=(geometry?.index?.count || position?.count || 0)/3;
      object.castShadow=true;
      object.receiveShadow=true;
      object.userData.instId=instId;
      const list=Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach(material=>{
        material.userData=material.userData||{};
        material.userData.baseEmissive=material.emissive?.getHex?.()||0;
        material.userData.baseEmissiveIntensity=safeNum(material.emissiveIntensity);
        materials.add(material);
        Object.values(material).forEach(value=>{ if(value?.isTexture) textures.add(value); });
      });
    });
    if(!meshCount) throw new Error("The GLB does not contain a visible mesh.");
    if(hasSkinnedMesh) throw new Error("Rigged GLB models are not supported yet. Export a static mesh and try again.");
    if(triangles>500000) throw new Error("This GLB is too detailed for the walkthrough. Reduce it below 500,000 triangles and try again.");
    materials.forEach(material=>{ if(!this.disposables.includes(material)) this.disposables.push(material); });
    textures.forEach(texture=>{ if(!this.disposables.includes(texture)) this.disposables.push(texture); });
    return {meshCount,triangles:Math.round(triangles)};
  }

  async loadCustomEquipmentModel({visualGroup,fallbackGroup,placementGroup,inst,item,targetWidth,targetDepth,targetHeight}){
    let importedRoot=null;
    try{
      const assetApi=window.GymModelAssets;
      const runtime=window.GymGLTFRuntime;
      if(!assetApi?.get || !runtime?.parse) throw new Error("The local GLB loader is not available.");
      const record=await assetApi.get(item.model3dAssetRef);
      if(!record?.buffer) throw new Error("The saved GLB file is not available in this browser.");
      if(this.destroyed || !visualGroup.parent) return;
      const gltf=await runtime.parse(record.buffer.slice(0));
      importedRoot=gltf?.scene || gltf?.scenes?.[0] || null;
      if(!importedRoot) throw new Error("The GLB does not contain a scene.");
      if(this.destroyed || !visualGroup.parent){
        this.disposeExternalRoot(importedRoot);
        importedRoot=null;
        return;
      }

      const removable=[];
      importedRoot.traverse(object=>{ if(object?.isCamera || object?.isLight) removable.push(object); });
      removable.forEach(object=>object.parent?.remove(object));
      const modelInfo=this.registerExternalRoot(importedRoot,inst.id);

      const assetRoot=new THREE.Group();
      const rotation=normalizedModelAssetRotation(item.model3dAssetRotation)*Math.PI/180;
      assetRoot.rotation.y=rotation;
      assetRoot.add(importedRoot);
      assetRoot.updateMatrixWorld(true);

      const box=new THREE.Box3().setFromObject(assetRoot);
      const size=box.getSize(new THREE.Vector3());
      if(!Number.isFinite(size.x+size.y+size.z) || size.x<0.0001 || size.y<0.0001 || size.z<0.0001){
        throw new Error("The GLB has invalid or empty dimensions.");
      }
      const fit=[targetWidth/size.x,targetDepth/size.z];
      if(targetHeight && targetHeight>0) fit.push(targetHeight/size.y);
      const scale=Math.min(...fit)*0.98;
      if(!Number.isFinite(scale) || scale<=0) throw new Error("The GLB could not be fitted to the saved measurements.");
      assetRoot.scale.setScalar(scale);
      assetRoot.updateMatrixWorld(true);
      box.setFromObject(assetRoot);
      const center=box.getCenter(new THREE.Vector3());
      assetRoot.position.set(-center.x,-box.min.y,-center.z);
      assetRoot.updateMatrixWorld(true);

      if(this.destroyed || !visualGroup.parent){
        this.disposeExternalRoot(assetRoot);
        importedRoot=null;
        return;
      }

      visualGroup.rotation.y=item.model3dFacing==="reverse" ? Math.PI : 0;
      visualGroup.add(assetRoot);
      const fallbackTargets=new Set();
      fallbackGroup.traverse(object=>fallbackTargets.add(object));
      this.clickTargets=this.clickTargets.filter(object=>!fallbackTargets.has(object));
      fallbackGroup.visible=false;
      placementGroup.userData.customAsset=true;
      placementGroup.userData.customAssetName=record.name||item.model3dAssetName||"Local GLB";
      placementGroup.userData.customAssetRotation=normalizedModelAssetRotation(item.model3dAssetRotation);
      placementGroup.userData.customAssetMeshes=modelInfo.meshCount;
      placementGroup.userData.customAssetTriangles=modelInfo.triangles;
      placementGroup.userData.visualRotationY=visualGroup.rotation.y;
      this.customAssetModelCount++;
      this.renderer.shadowMap.needsUpdate=true;
      this.updateCustomAssetStatus();
      this.updateSelection();
      importedRoot=null;
    }catch(error){
      if(importedRoot) this.disposeExternalRoot(importedRoot);
      if(this.destroyed) return;
      placementGroup.userData.customAsset=false;
      placementGroup.userData.customAssetError=String(error?.message||error||"Could not load GLB model.");
      this.customAssetErrorCount++;
      this.updateCustomAssetStatus();
      this.updateWarnings();
    }
  }

  buildRx3CompactSmithModel(group,inst,base,height){
    const w=Math.max(base.w,.4),d=Math.max(base.h,.4),h=height;
    const powder=this.material({color:0x0b0d0f,roughness:.5,metalness:.42,envMapIntensity:.8});
    const powderSoft=this.material({color:0x15191d,roughness:.62,metalness:.28,envMapIntensity:.56});
    const chrome=this.material({color:0xc7cdd2,roughness:.16,metalness:.98,envMapIntensity:1.35});
    const stack=this.material({color:0x14171a,roughness:.74,metalness:.16,envMapIntensity:.34});
    const rubber=this.material({color:0x050607,roughness:.92,metalness:.02,envMapIntensity:.1});
    const pulley=this.material({color:0x090b0d,roughness:.64,metalness:.12,envMapIntensity:.28});
    const holeInset=this.material({color:0x010202,roughness:1,metalness:0,envMapIntensity:.02});
    const accent=this.material({color:0xe35b25,roughness:.42,metalness:.5,envMapIntensity:.72});
    const badge=this.material({color:0xe7e8e8,roughness:.5,metalness:.2,envMapIntensity:.42});
    const add=(size,pos,material=powder,options={})=>this.box(group,size,pos,material,{...options,instId:inst.id});
    const addCylinder=(radius,length,pos,material=powder,options={})=>this.cylinder(group,radius,length,pos,material,{...options,instId:inst.id});
    const addBeam=(start,end,width,material=powder,depth=width)=>this.beam(group,start,end,width,depth,material,{instId:inst.id});
    const addTube=(start,end,radius,material=rubber)=>this.tube(group,start,end,radius,material,{instId:inst.id,segments:14});

    const outerX=w*.42,frontZ=-d*.31,rearZ=d*.31;
    [-1,1].forEach(sx=>{
      [frontZ,rearZ].forEach(z=>{
        add({x:w*.0625,y:h*.91,z:d*.094},{x:sx*outerX,y:h*.49,z},powder);
        add({x:w*.105,y:h*.018,z:d*.19},{x:sx*outerX,y:h*.02,z:z+d*.02},powderSoft);
      });
      addBeam({x:sx*outerX,y:h*.945,z:frontZ},{x:sx*outerX,y:h*.945,z:rearZ},w*.058,powder,d*.07);
      addBeam({x:sx*outerX,y:h*.07,z:frontZ},{x:sx*outerX,y:h*.07,z:rearZ},w*.05,powder,d*.06);
    });
    [frontZ,rearZ].forEach(z=>{
      add({x:w*.84,y:h*.055,z:d*.09},{x:0,y:h*.945,z},powder);
    });
    add({x:w*.75,y:h*.045,z:d*.12},{x:0,y:h*.87,z:frontZ-d*.01},powderSoft);

    // True 3×3-style perforations on the two front posts.
    [-1,1].forEach(sx=>{
      for(let index=0;index<29;index++){
        const y=h*(.145+index*.0261);
        addCylinder(h*.0057,d*.014,{x:sx*outerX,y,z:frontZ-d*.052},holeInset,{rotationX:Math.PI/2,segments:12,castShadow:false});
      }
    });

    // Bright inner rails and Smith guide rods.
    [-1,1].forEach(sx=>{
      const railX=sx*w*.245;
      add({x:w*.045,y:h*.80,z:d*.065},{x:railX,y:h*.49,z:-d*.25},chrome);
      addCylinder(w*.009,h*.79,{x:sx*w*.29,y:h*.495,z:-d*.3},chrome,{segments:18});
      for(let index=0;index<25;index++){
        const y=h*(.18+index*.027);
        addCylinder(h*.0044,d*.012,{x:railX,y,z:-d*.286},holeInset,{rotationX:Math.PI/2,segments:10,castShadow:false});
      }
    });

    // Twin selector stacks with individual black plates and polished guides.
    [-1,1].forEach(sx=>{
      const stackX=sx*w*.29,stackZ=d*.17;
      [-1,1].forEach(offset=>{
        addCylinder(w*.006,h*.5,{x:stackX+offset*w*.052,y:h*.335,z:stackZ},chrome,{segments:12});
      });
      add({x:w*.18,y:h*.49,z:d*.035},{x:stackX,y:h*.32,z:stackZ+d*.105},powderSoft);
      [-1,1].forEach(offset=>add(
        {x:w*.018,y:h*.49,z:d*.22},
        {x:stackX+offset*w*.095,y:h*.32,z:stackZ},
        powder
      ));
      for(let plate=0;plate<12;plate++){
        add({x:w*.155,y:h*.012,z:d*.22},{x:stackX,y:h*(.105+plate*.027),z:stackZ-d*.01},stack);
      }
      add({x:w*.018,y:h*.018,z:d*.1},{x:stackX+sx*w*.085,y:h*.24,z:stackZ-d*.13},accent);
      add({x:w*.22,y:h*.045,z:d*.28},{x:stackX,y:h*.585,z:stackZ},powder);
    });

    // Smith bar, carriages, collars, and safeties.
    addCylinder(w*.011,w*.94,{x:0,y:h*.55,z:-d*.35},chrome,{rotationZ:Math.PI/2,segments:24});
    [-1,1].forEach(sx=>{
      add({x:w*.066,y:h*.075,z:d*.08},{x:sx*w*.29,y:h*.55,z:-d*.34},powderSoft);
      addCylinder(w*.027,w*.085,{x:sx*w*.395,y:h*.55,z:-d*.35},powder,{rotationZ:Math.PI/2,segments:20});
      addBeam({x:sx*w*.31,y:h*.36,z:-d*.29},{x:sx*w*.43,y:h*.36,z:-d*.43},w*.045,powderSoft,d*.045);
      add({x:w*.08,y:h*.045,z:d*.11},{x:sx*w*.37,y:h*.36,z:-d*.37},accent);
    });

    // Upper pulley chassis, wheel hubs, and routed cables.
    const pulleyPoints=[
      [-.35,.905],[-.15,.88],[.15,.88],[.35,.905],
    ];
    pulleyPoints.forEach(([px,py])=>{
      addCylinder(h*.036,d*.045,{x:w*px,y:h*py,z:frontZ-d*.055},pulley,{rotationX:Math.PI/2,segments:24});
      addCylinder(h*.011,d*.052,{x:w*px,y:h*py,z:frontZ-d*.058},chrome,{rotationX:Math.PI/2,segments:18});
    });
    [-1,1].forEach(sx=>{
      addCylinder(h*.032,d*.044,{x:sx*w*.3,y:h*.19,z:d*.08},pulley,{rotationX:Math.PI/2,segments:24});
      addCylinder(h*.009,d*.05,{x:sx*w*.3,y:h*.19,z:d*.075},chrome,{rotationX:Math.PI/2,segments:16});
      addTube({x:sx*w*.29,y:h*.57,z:d*.17},{x:sx*w*.35,y:h*.905,z:frontZ-d*.05},w*.0032,rubber);
      addTube({x:sx*w*.35,y:h*.905,z:frontZ-d*.05},{x:sx*w*.15,y:h*.88,z:frontZ-d*.06},w*.0032,rubber);
      addTube({x:sx*w*.15,y:h*.88,z:frontZ-d*.06},{x:sx*w*.4,y:h*.64,z:frontZ-d*.11},w*.0032,rubber);

      // Height-adjustable trolley, articulated arm, cable stop, and handle.
      add({x:w*.075,y:h*.09,z:d*.095},{x:sx*w*.4,y:h*.64,z:frontZ-d*.035},powderSoft);
      addBeam({x:sx*w*.4,y:h*.64,z:frontZ-d*.07},{x:sx*w*.46,y:h*.59,z:-d*.49},w*.034,powder,d*.035);
      addCylinder(h*.023,d*.038,{x:sx*w*.455,y:h*.59,z:-d*.49},pulley,{rotationX:Math.PI/2,segments:18});
      addTube({x:sx*w*.455,y:h*.59,z:-d*.49},{x:sx*w*.455,y:h*.52,z:-d*.5},w*.003,rubber);
      addBeam({x:sx*w*.455,y:h*.51,z:-d*.5},{x:sx*w*.4,y:h*.48,z:-d*.51},w*.019,rubber,d*.019);
      addBeam({x:sx*w*.455,y:h*.51,z:-d*.5},{x:sx*w*.51,y:h*.48,z:-d*.51},w*.019,rubber,d*.019);
    });

    // Multi-grip top bar and subtle center branding plates.
    addBeam({x:-w*.31,y:h*.975,z:frontZ-d*.02},{x:w*.31,y:h*.975,z:frontZ-d*.02},w*.035,powder,d*.035);
    [-1,1].forEach(sx=>addBeam(
      {x:sx*w*.16,y:h*.975,z:frontZ-d*.02},
      {x:sx*w*.31,y:h*.94,z:frontZ-d*.13},
      w*.032,powder,d*.032
    ));
    add({x:w*.2,y:h*.045,z:d*.022},{x:0,y:h*.905,z:frontZ-d*.078},badge,{castShadow:false});
    add({x:w*.13,y:h*.02,z:d*.024},{x:0,y:h*.905,z:frontZ-d*.091},powderSoft,{castShadow:false});

    this.host.dataset.rx3Benchmarks=String((safeNum(this.host.dataset.rx3Benchmarks)||0)+1);
    return "photo-matched Get RX'd RX3 Tornado Compact Smith Machine";
  }

  buildMaxwell903BHModel(group,inst,base,height){
    const w=Math.max(base.w,.4),d=Math.max(base.h,.4),h=height;
    const wood=this.material({color:0xa9652f,roughness:.66,metalness:0,envMapIntensity:.3});
    const woodLight=this.material({color:0xc4884d,roughness:.58,metalness:0,envMapIntensity:.36});
    const woodDark=this.material({color:0x7b431f,roughness:.72,metalness:.01,envMapIntensity:.22});
    const groove=this.material({color:0x4c2814,roughness:.86,metalness:0,envMapIntensity:.1});
    const heater=this.material({color:0x080706,roughness:.82,metalness:.04,envMapIntensity:.12});
    const hardware=this.material({color:0xbec6c5,metalness:.78,roughness:.24,envMapIntensity:1.06});
    const control=this.material({color:0x101316,roughness:.34,metalness:.22,envMapIntensity:.48});
    const redGlow=this.material({color:0xff2b1b,emissive:0xff1e10,emissiveIntensity:2.2,roughness:.4,metalness:.02});
    const warmGlow=this.material({color:0xffd59d,emissive:0xff9d46,emissiveIntensity:1.45,roughness:.35,metalness:.02});
    const interiorGlow=this.material({color:0xb95c2a,emissive:0xff3f16,emissiveIntensity:.62,roughness:.74,metalness:0});
    const glass=new THREE.MeshPhysicalMaterial({
      color:0xe1b891,
      transparent:true,
      opacity:.34,
      transmission:.62,
      thickness:.035,
      ior:1.5,
      roughness:.07,
      metalness:0,
      envMapIntensity:.88,
      side:THREE.DoubleSide,
      depthWrite:false,
    });
    this.disposables.push(glass);
    const add=(size,pos,material=wood,options={})=>this.box(group,size,pos,material,{...options,instId:inst.id});
    const addCylinder=(radius,length,pos,material=hardware,options={})=>this.cylinder(group,radius,length,pos,material,{...options,instId:inst.id});
    const shell=Math.min(.145,Math.min(w,d)*.045);
    const frontZ=-d/2;

    // Structural shell. The open glass facade leaves the glowing interior visible.
    add({x:w*.96,y:.17,z:d*.94},{x:0,y:.085,z:0},woodDark);
    add({x:w*.98,y:.19,z:d*.96},{x:0,y:h-.095,z:0},woodLight);
    add({x:w*.94,y:h*.9,z:shell},{x:0,y:h*.49,z:d*.47},wood);
    [-1,1].forEach(sx=>add({x:shell,y:h*.9,z:d*.9},{x:sx*w*.47,y:h*.49,z:0},wood));

    // Fine horizontal hemlock cladding seams on the exterior side and back walls.
    for(let index=0;index<18;index++){
      const y=h*(.08+index*.047);
      add({x:w*.91,y:.012,z:.018},{x:0,y,z:d*.478},groove,{castShadow:false});
      [-1,1].forEach(sx=>add({x:.018,y:.012,z:d*.86},{x:sx*w*.482,y,z:0},groove,{castShadow:false}));
    }

    // Interior heater arrays behind wood safety grilles.
    add({x:w*.84,y:h*.72,z:.025},{x:0,y:h*.52,z:d*.438},interiorGlow,{castShadow:false});
    [-1,1].forEach(sx=>add({x:.025,y:h*.68,z:d*.58},{x:sx*w*.423,y:h*.5,z:d*.08},interiorGlow,{castShadow:false}));
    add({x:w*.78,y:h*.47,z:.055},{x:0,y:h*.52,z:d*.415},heater);
    [-1,1].forEach(sx=>add({x:.055,y:h*.43,z:d*.47},{x:sx*w*.405,y:h*.5,z:d*.12},heater));
    for(let rail=0;rail<8;rail++){
      const y=h*(.31+rail*.056);
      add({x:w*.82,y:.035,z:.055},{x:0,y,z:d*.38},woodLight);
      [-1,1].forEach(sx=>add({x:.055,y:.035,z:d*.5},{x:sx*w*.385,y,z:d*.11},woodLight));
    }
    [-.31,0,.31].forEach(px=>add({x:.045,y:h*.43,z:.06},{x:w*px,y:h*.52,z:d*.375},woodDark));

    // Full-width slatted bench, supports, lower heater bays, and foot deck.
    const benchY=Math.min(h*.3,20.5/12);
    for(let slat=0;slat<9;slat++){
      add({x:w*.9,y:.065,z:d*.055},{x:0,y:benchY,z:d*(.08+slat*.047)},woodLight);
    }
    [-.39,0,.39].forEach(px=>add({x:.08,y:benchY,z:.11},{x:w*px,y:benchY/2,z:d*.27},woodDark));
    for(let bay=0;bay<4;bay++){
      const cx=w*(-.33+bay*.22);
      add({x:w*.185,y:h*.17,z:.055},{x:cx,y:h*.15,z:d*.37},heater);
      for(let rail=0;rail<4;rail++) add({x:w*.19,y:.025,z:.06},{x:cx,y:h*(.095+rail*.045),z:d*.34},woodLight);
    }
    for(let slat=0;slat<10;slat++){
      add({x:w*.055,y:.055,z:d*.52},{x:w*(-.28+slat*.062),y:.2,z:-d*.05},woodLight);
    }

    // Three-bay facade: exact-width center door and narrower fixed sidelights.
    const doorW=Math.min(w*.39,23.6/12);
    const doorGlassH=Math.min(h*.87,65/12);
    const doorBottom=.37;
    const sideGlassW=Math.min(w*.19,.9);
    const sideGlassH=Math.min(h*.75,4.54);
    const sideCenterX=Math.min(w*.33,1.73);
    add({x:w*.98,y:h*.13,z:shell},{x:0,y:h*.92,z:frontZ},woodLight);
    add({x:w*.98,y:h*.1,z:shell},{x:0,y:h*.08,z:frontZ},woodLight);
    [-w*.465,-doorW/2,doorW/2,w*.465].forEach(x=>add({x:w*.052,y:h*.82,z:shell},{x,y:h*.49,z:frontZ},woodLight));
    [.86,.89,.92,.95].forEach(level=>add(
      {x:w*.94,y:.012,z:.018},
      {x:0,y:h*level,z:frontZ-.078},
      groove,
      {castShadow:false}
    ));
    for(let index=0;index<15;index++){
      const y=h*(.14+index*.047);
      [-1,1].forEach(sx=>add(
        {x:w*.085,y:.012,z:.018},
        {x:sx*w*.435,y,z:frontZ-.078},
        groove,
        {castShadow:false}
      ));
    }
    add({x:doorW,y:doorGlassH,z:.035},{x:0,y:doorBottom+doorGlassH/2,z:frontZ-.012},glass,{castShadow:false});
    [-1,1].forEach(sx=>add(
      {x:sideGlassW,y:sideGlassH,z:.035},
      {x:sx*sideCenterX,y:.53+sideGlassH/2,z:frontZ-.012},
      glass,
      {castShadow:false}
    ));

    // Distinctive door heater, wood/chrome handle, hinges, and LCD control.
    add({x:11.5/12,y:25/12,z:.055},{x:0,y:1.43,z:frontZ+.055},woodLight);
    [-.39,.39].forEach(px=>[-.38,.38].forEach(py=>addCylinder(.025,.025,{x:px,y:1.43+py,z:frontZ-.005},hardware,{rotationX:Math.PI/2,segments:12,castShadow:false})));
    add({x:.095,y:h*.39,z:.09},{x:-doorW*.37,y:h*.51,z:frontZ-.095},woodLight);
    addCylinder(.035,h*.28,{x:-doorW*.37,y:h*.51,z:frontZ-.15},hardware,{segments:18});
    [h*.21,h*.48,h*.76].forEach(y=>add({x:.065,y:.17,z:.07},{x:doorW*.5,y,z:frontZ-.07},hardware));
    add({x:.42,y:.69,z:.07},{x:sideCenterX,y:h*.79,z:frontZ-.07},control);
    add({x:.29,y:.13,z:.018},{x:sideCenterX,y:h*.83,z:frontZ-.108},redGlow,{castShadow:false});
    [-.09,0,.09].forEach(dx=>addCylinder(.018,.02,{x:sideCenterX+dx,y:h*.775,z:frontZ-.11},hardware,{rotationX:Math.PI/2,segments:12,castShadow:false}));

    // Interior reading lights, speakers, and central chromotherapy panel.
    [-1,1].forEach(sx=>{
      addCylinder(.095,.035,{x:sx*w*.23,y:h*.91,z:-d*.03},warmGlow,{segments:24,castShadow:false});
      addCylinder(.13,.045,{x:sx*w*.3,y:h*.79,z:d*.39},control,{rotationX:Math.PI/2,segments:24,castShadow:false});
      const warm=new THREE.PointLight(0xffa04f,.38,Math.max(w,d)*1.15,2);
      warm.position.set(sx*w*.23,h*.84,-d*.02);
      warm.castShadow=false;
      group.add(warm);
    });
    add({x:w*.18,y:h*.31,z:.045},{x:0,y:h*.67,z:d*.365},redGlow,{castShadow:false});
    const therapyGlow=new THREE.PointLight(0xff3a22,.42,Math.max(w,d)*1.1,2);
    therapyGlow.position.set(0,h*.63,d*.15);
    therapyGlow.castShadow=false;
    group.add(therapyGlow);

    this.host.dataset.maxwellBenchmarks=String((safeNum(this.host.dataset.maxwellBenchmarks)||0)+1);
    return "photo-matched SalusHEAT Maxwell-903BH infrared sauna";
  }

  buildGazelleModel(group,inst,base,height){
    const w=Math.max(base.w,.4),d=Math.max(base.h,.4),h=height;
    const frame=this.material({color:0x121518,roughness:.4,metalness:.34,envMapIntensity:.7});
    const frameDark=this.material({color:0x07090b,roughness:.58,metalness:.16,envMapIntensity:.38});
    const vinyl=this.material({color:0x0d0f11,roughness:.9,metalness:.01,envMapIntensity:.14});
    const rubber=this.material({color:0x070809,roughness:.96,metalness:0,envMapIntensity:.08});
    const chrome=this.material({color:0xbec6cd,roughness:.22,metalness:.92,envMapIntensity:1.2});
    const tread=this.material({color:0x202428,roughness:.62,metalness:.22,envMapIntensity:.46});
    const safety=this.material({color:0xd84a20,roughness:.42,metalness:.5,envMapIntensity:.9});
    const add=(size,pos,material=frame,options={})=>this.box(group,size,pos,material,{...options,instId:inst.id});
    const addCylinder=(radius,length,pos,material=frame,options={})=>this.cylinder(group,radius,length,pos,material,{...options,instId:inst.id});
    const addBeam=(start,end,width,material=frame,depth=width)=>this.beam(group,start,end,width,depth,material,{instId:inst.id});
    const addTube=(start,end,radius,material=chrome)=>this.tube(group,start,end,radius,material,{instId:inst.id});

    // Open rectangular base and flared feet — the product photo has no solid platform.
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.38,y:h*.055,z:d*.44},{x:sign*w*.38,y:h*.055,z:-d*.4},w*.055,frame,d*.028);
      addBeam({x:sign*w*.38,y:h*.052,z:d*.43},{x:sign*w*.48,y:h*.052,z:d*.47},w*.045,frame,d*.025);
      addBeam({x:sign*w*.38,y:h*.052,z:-d*.39},{x:sign*w*.46,y:h*.052,z:-d*.43},w*.045,frame,d*.025);
    });
    addBeam({x:-w*.44,y:h*.055,z:d*.44},{x:w*.44,y:h*.055,z:d*.44},w*.055,frame,d*.03);
    addBeam({x:-w*.42,y:h*.055,z:-d*.4},{x:w*.42,y:h*.055,z:-d*.4},w*.055,frame,d*.03);
    addBeam({x:-w*.34,y:h*.07,z:d*.08},{x:w*.34,y:h*.07,z:d*.08},w*.05,frame,d*.026);

    // Rear tower, triangular braces, and top crossmember.
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.34,y:h*.07,z:-d*.36},{x:sign*w*.34,y:h*.81,z:-d*.36},w*.058,frame,d*.035);
      addBeam({x:sign*w*.34,y:h*.81,z:-d*.36},{x:sign*w*.26,y:h*.92,z:-d*.18},w*.05,frame,d*.03);
      addBeam({x:sign*w*.34,y:h*.12,z:-d*.36},{x:sign*w*.28,y:h*.38,z:-d*.08},w*.047,frame,d*.027);
    });
    addBeam({x:-w*.36,y:h*.88,z:-d*.21},{x:w*.36,y:h*.88,z:-d*.21},w*.052,frame,d*.032);

    // Twin powder-coated sled rails with polished guide rods nested inside.
    [-1,1].forEach(sign=>{
      const railStart={x:sign*w*.275,y:h*.115,z:d*.38};
      const railEnd={x:sign*w*.275,y:h*.87,z:-d*.24};
      addBeam(railStart,railEnd,w*.057,frame,d*.032);
      addTube(
        {x:sign*w*.205,y:h*.145,z:d*.35},
        {x:sign*w*.205,y:h*.83,z:-d*.18},
        w*.016,
        chrome
      );
      add({x:w*.09,y:h*.1,z:d*.06},{x:sign*w*.205,y:h*.57,z:-d*.005},frameDark,{rotationX:-.68});
      for(let hole=0;hole<8;hole++){
        const t=.18+hole*.075;
        add(
          {x:w*.012,y:h*.012,z:d*.009},
          {x:sign*w*.303,y:h*t,z:d*(.325-(t-.18)*.81)},
          chrome,
          {castShadow:false}
        );
      }
    });

    // Large black front plate, tread ribs, and its lower support triangle.
    add({x:w*.82,y:h*.045,z:d*.25},{x:0,y:h*.16,z:d*.38},tread,{rotationX:-.72});
    add({x:w*.88,y:h*.038,z:d*.055},{x:0,y:h*.105,z:d*.465},frameDark,{rotationX:-.72});
    [-.29,-.145,0,.145,.29].forEach(x=>{
      add({x:w*.035,y:h*.014,z:d*.205},{x:w*x,y:h*.177,z:d*.374},rubber,{rotationX:-.72,castShadow:false});
    });
    [-1,1].forEach(sign=>{
      addBeam({x:sign*w*.25,y:h*.1,z:d*.44},{x:sign*w*.21,y:h*.25,z:d*.27},w*.043,frame,d*.027);
    });

    // Moving carriage with split shoulder pads, central back pad, and lower roller.
    addBeam({x:-w*.34,y:h*.59,z:-d*.025},{x:w*.34,y:h*.59,z:-d*.025},w*.055,frame,d*.04);
    add({x:w*.46,y:h*.39,z:d*.058},{x:0,y:h*.53,z:d*.035},vinyl,{rotationX:-.69});
    add({x:w*.42,y:h*.115,z:d*.12},{x:0,y:h*.33,z:d*.17},vinyl,{rotationX:-.55});
    [-1,1].forEach(sign=>{
      add({x:w*.155,y:h*.255,z:d*.07},{x:sign*w*.145,y:h*.73,z:-d*.105},vinyl,{rotationX:-.69});
      addBeam({x:sign*w*.12,y:h*.63,z:-d*.01},{x:sign*w*.15,y:h*.82,z:-d*.13},w*.035,frame,d*.023);
    });
    addCylinder(h*.055,w*.5,{x:0,y:h*.275,z:d*.22},rubber,{rotationZ:Math.PI/2});

    // Plate-loaded axle, side plates, storage horns, and safety hardware.
    addCylinder(w*.014,w*.92,{x:0,y:h*.61,z:-d*.045},chrome,{rotationZ:Math.PI/2});
    [-1,1].forEach(sign=>{
      addCylinder(h*.074,w*.045,{x:sign*w*.35,y:h*.61,z:-d*.045},frameDark,{rotationZ:Math.PI/2});
      [.39,.62].forEach(level=>{
        addCylinder(w*.014,w*.18,{x:sign*w*.43,y:h*level,z:-d*.36},chrome,{rotationZ:Math.PI/2});
        addCylinder(w*.021,w*.025,{x:sign*w*.51,y:h*level,z:-d*.36},rubber,{rotationZ:Math.PI/2});
      });
      addTube(
        {x:sign*w*.22,y:h*.57,z:0},
        {x:sign*w*.3,y:h*.83,z:-d*.13},
        w*.014,
        chrome
      );
      addTube(
        {x:sign*w*.3,y:h*.83,z:-d*.13},
        {x:sign*w*.325,y:h*.92,z:-d*.16},
        w*.019,
        rubber
      );
      addCylinder(w*.017,w*.075,{x:sign*w*.305,y:h*.49,z:d*.07},safety,{rotationZ:Math.PI/2});
      addCylinder(h*.026,w*.035,{x:sign*w*.285,y:h*.59,z:-d*.025},chrome,{rotationZ:Math.PI/2});
    });

    this.host.dataset.gazelleBenchmarks=String((safeNum(this.host.dataset.gazelleBenchmarks)||0)+1);
    return "photo-matched RitFit Gazelle Pro 3-in-1";
  }

  tryBuildDedicatedEquipmentModel(group,inst,item,base,height,profile){
    const staged=new THREE.Group();
    const clickStart=this.clickTargets.length;
    const disposablesStart=this.disposables.length;
    try{
      let result=null;
      if(profile==="rx3-compact-smith") result={builderKey:profile,modelType:this.buildRx3CompactSmithModel(staged,inst,base,height)};
      else if(profile==="maxwell-903bh") result={builderKey:profile,modelType:this.buildMaxwell903BHModel(staged,inst,base,height)};
      else if(profile==="gazelle-pro") result={builderKey:profile,modelType:this.buildGazelleModel(staged,inst,base,height)};
      else result=window.GymEquipmentModels?.build(profile,this,staged,inst,base,height)||null;
      if(!result){
        this.clickTargets.length=clickStart;
        this.disposeStagedDedicatedRoot(staged,disposablesStart);
        return {built:false,error:null};
      }
      group.add(staged);
      return {built:true,...result,root:staged};
    }catch(error){
      this.clickTargets.length=clickStart;
      this.disposeStagedDedicatedRoot(staged,disposablesStart);
      return {built:false,error:error instanceof Error ? error : new Error(String(error))};
    }
  }

  updateDedicatedModelDiagnostics(){
    this.host.dataset.dedicatedModels=String(this.dedicatedModelCount);
    this.host.dataset.builderFailures=String(this.builderFailureCount);
    this.host.dataset.modelProfiles=[...this.modelProfileKeys].sort().join(",");
    this.host.dataset.modelBuilders=[...this.modelBuilderKeys].sort().join(",");
  }

  recordEquipmentDispatch(placementGroup,item,profile,result){
    placementGroup.userData.modelProfile=profile;
    placementGroup.userData.modelBuilder=result?.built ? result.builderKey : "";
    placementGroup.userData.dedicatedModel=!!result?.built;
    if(profile!=="standard") this.modelProfileKeys.add(profile);
    if(result?.built){
      this.dedicatedModelCount++;
      this.modelBuilderKeys.add(result.builderKey);
    }else if(result?.error || DEDICATED_MODEL_PROFILES.has(profile)){
      this.builderFailureCount++;
      const brand=String(item.brand||"").trim();
      const name=String(item.name||"").trim();
      const label=brand && name && !name.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brand} ${name}`
        : (name||brand||profile);
      this.builderFallbackWarnings.push(`${label}: dedicated 3D model unavailable — using measured fallback`);
    }
    this.updateDedicatedModelDiagnostics();
  }

  buildEquipmentModel(group,inst,item,base,height,placementGroup=group){
    const text = `${item.category||""} ${item.name||""}`.toLowerCase();
    const family=equipmentModelFamily(item);
    const profile=equipmentModelProfile(item);
    const dedicated=this.tryBuildDedicatedEquipmentModel(group,inst,item,base,height,profile);
    const w=Math.max(base.w,0.4), d=Math.max(base.h,0.4);
    const isSelected = state.layout.selectedInstId === inst.id;
    if(dedicated.built){
      if(isSelected){
        const selectedMat=this.material({color:0xf97316,transparent:true,opacity:.15,roughness:.72,depthWrite:false,envMapIntensity:.05});
        const marker=this.box(group,{x:w+.18,y:.055,z:d+.18},{x:0,y:.07,z:0},selectedMat,{instId:inst.id});
        marker.renderOrder=4;
      }
      group.userData.modelType=dedicated.modelType;
      group.userData.measuredFootprint={widthFt:w,depthFt:d,heightFt:height};
      placementGroup.userData.modelType=dedicated.modelType;
      this.recordEquipmentDispatch(placementGroup,item,profile,dedicated);
      return dedicated;
    }
    const color = this.itemColor(item);
    const metal = this.material({color,roughness:.4,metalness:.34,envMapIntensity:.72});
    const dark = this.material({color:0x0b0e11,roughness:.62,metalness:.16,envMapIntensity:.42});
    const pad = this.material({color:0x111315,roughness:.9,metalness:.01,envMapIntensity:.16});
    const accent = this.material({color:0xf47a2a,roughness:.4,metalness:.42,envMapIntensity:.9});
    const silver = this.material({color:0xb6bec5,roughness:.24,metalness:.9,envMapIntensity:1.16});
    const red = this.material({color:0xb91c1c,roughness:.42,metalness:.38});
    const screen = this.material({color:0x164e63,emissive:0x0ea5e9,emissiveIntensity:.38,roughness:.24,metalness:.18});
    const selectedMat = metal;

    const add=(size,pos,mat=selectedMat,opts={})=>this.box(group,size,pos,mat,{...opts,instId:inst.id});
    const addCylinder=(radius,length,pos,mat=selectedMat,opts={})=>this.cylinder(group,radius,length,pos,mat,{...opts,instId:inst.id});
    const addBeam=(start,end,thickness,mat=selectedMat,depth=thickness)=>this.beam(group,start,end,thickness,depth,mat,{instId:inst.id});
    let modelType="general machine";

    if(family==="sauna" && profile==="infrared-sauna"){
      modelType="glass-front infrared sauna";
      const wood=this.material({color:0xc89254,roughness:.72,metalness:.02});
      const trim=this.material({color:0xe1b77c,roughness:.66,metalness:.01});
      const glass=this.material({color:0x7dd3fc,transparent:true,opacity:.22,roughness:.08,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
      const warm=this.material({color:0xff7a28,emissive:0xff4d10,emissiveIntensity:.45,roughness:.5});
      const t=Math.min(.14,Math.min(w,d)*.07);
      const frontZ=-d*.45;
      add({x:w*.96,y:.12,z:d*.96},{x:0,y:.06,z:0},wood);
      add({x:w*.96,y:.16,z:d*.96},{x:0,y:height-.08,z:0},wood);
      [-1,1].forEach(sign=>add({x:t,y:height*.92,z:d*.92},{x:sign*w*.45,y:height*.48,z:0},wood));
      add({x:w*.9,y:height*.9,z:t},{x:0,y:height*.47,z:d*.44},wood);
      add({x:w*.9,y:t,z:t},{x:0,y:height*.08,z:frontZ},trim);
      add({x:w*.9,y:t,z:t},{x:0,y:height*.9,z:frontZ},trim);
      [-.43,-.18,.18,.43].forEach(p=>add({x:t,y:height*.82,z:t},{x:w*p,y:height*.49,z:frontZ},trim));
      [-.3,0,.3].forEach(p=>add({x:w*.25,y:height*.72,z:.025},{x:w*p,y:height*.51,z:frontZ-.015},glass,{castShadow:false}));
      add({x:w*.72,y:.16,z:d*.28},{x:0,y:height*.27,z:d*.2},trim);
      add({x:w*.7,y:height*.34,z:.05},{x:0,y:height*.47,z:d*.42-t},warm,{castShadow:false});
      add({x:w*.05,y:height*.34,z:.035},{x:w*.12,y:height*.5,z:frontZ-.04},dark);
      add({x:w*.13,y:height*.2,z:.04},{x:w*.33,y:height*.75,z:frontZ-.05},dark,{castShadow:false});
    }else if(family==="sauna"){
      modelType="wood sauna";
      const wood=this.material({color:0xc89254,roughness:.72,metalness:.02});
      const trim=this.material({color:0xe1b77c,roughness:.66,metalness:.01});
      const glass=this.material({color:0x7dd3fc,transparent:true,opacity:.22,roughness:.08,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
      const warm=this.material({color:0xff7a28,emissive:0xff4d10,emissiveIntensity:.45,roughness:.5});
      const t=Math.min(.14,Math.min(w,d)*.07);
      add({x:w*.96,y:.12,z:d*.96},{x:0,y:.06,z:0},wood);
      add({x:w*.96,y:.16,z:d*.96},{x:0,y:height-.08,z:0},wood);
      add({x:t,y:height*.92,z:d*.92},{x:-w*.45,y:height*.48,z:0},wood);
      add({x:t,y:height*.92,z:d*.92},{x:w*.45,y:height*.48,z:0},wood);
      add({x:w*.86,y:height*.9,z:t},{x:0,y:height*.47,z:d*.44},wood);
      const frontZ=-d*.45;
      add({x:w*.9,y:t,z:t},{x:0,y:height*.08,z:frontZ},trim);
      add({x:w*.9,y:t,z:t},{x:0,y:height*.9,z:frontZ},trim);
      [-.43,-.15,.15,.43].forEach(p=>add({x:t,y:height*.82,z:t},{x:w*p,y:height*.49,z:frontZ},trim));
      [-.29,0,.29].forEach(p=>add({x:w*.25,y:height*.72,z:.025},{x:w*p,y:height*.51,z:frontZ-.015},glass,{castShadow:false}));
      add({x:w*.72,y:.16,z:d*.28},{x:0,y:height*.28,z:d*.2},trim);
      add({x:w*.72,y:height*.34,z:.05},{x:0,y:height*.47,z:d*.42-t},warm,{castShadow:false});
      add({x:w*.05,y:height*.34,z:.035},{x:w*.13,y:height*.5,z:frontZ-.04},dark);
    }else if(family==="cold-plunge"){
      modelType=profile==="step-in-plunge" ? "step-in cold plunge" : "cold plunge tub";
      const shell=this.material({color:0x171a1e,roughness:.63,metalness:.05});
      const rim=this.material({color:0x080a0c,roughness:.4,metalness:.25});
      const water=this.material({color:0x38bdf8,transparent:true,opacity:.55,roughness:.18,metalness:.05,depthWrite:false});
      add({x:w*.92,y:height*.86,z:d*.62},{x:0,y:height*.43,z:d*.12},shell);
      add({x:w*.92,y:height*.56,z:d*.3},{x:0,y:height*.28,z:-d*.34},shell);
      add({x:w*.97,y:.12,z:d*.66},{x:0,y:height*.86,z:d*.1},rim);
      add({x:w*.77,y:.025,z:d*.48},{x:0,y:height*.93,z:d*.1},water,{castShadow:false});
      add({x:w*.97,y:.12,z:d*.31},{x:0,y:height*.56,z:-d*.34},rim);
      addCylinder(Math.min(w,d)*.055,height*.62,{x:-w*.45,y:height*.35,z:d*.02},dark);
      if(profile==="step-in-plunge"){
        add({x:w*.9,y:height*.18,z:d*.2},{x:0,y:height*.63,z:-d*.22},shell,{rotationX:-.48});
        add({x:w*.38,y:.08,z:d*.22},{x:0,y:height*.6,z:-d*.34},dark);
      }
    }else if(family==="stair-climber"){
      modelType="stair climber";
      const side=this.material({color:0x1d2228,roughness:.5,metalness:.3});
      add({x:w*.9,y:.12,z:d*.9},{x:0,y:.08,z:0},dark);
      if(profile==="commercial-stair"){
        modelType="enclosed commercial stairmill";
        [-1,1].forEach(sign=>{
          add({x:w*.14,y:height*.48,z:d*.7},{x:sign*w*.4,y:height*.31,z:d*.05},side,{rotationX:-.16});
          add({x:w*.15,y:height*.3,z:d*.34},{x:sign*w*.4,y:height*.2,z:-d*.27},side);
          addBeam({x:sign*w*.39,y:height*.2,z:d*.36},{x:sign*w*.39,y:height*.68,z:-d*.23},.035,accent,.055);
        });
        add({x:w*.5,y:height*.2,z:d*.14},{x:0,y:height*.77,z:-d*.35},side,{rotationX:-.12});
      }
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.4,y:.18,z:d*.37},{x:sign*w*.4,y:height*.64,z:-d*.2},.18,side,.42);
        addBeam({x:sign*w*.4,y:.14,z:-d*.38},{x:sign*w*.4,y:height*.7,z:-d*.38},.13,side,.2);
      });
      const steps=7;
      for(let i=0;i<steps;i++){
        const progress=i/(steps-1);
        add({x:w*.72,y:.12,z:d*.13},{x:0,y:height*(.09+progress*.43),z:d*(.32-progress*.5)},dark);
      }
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.34,y:height*.43,z:d*.28},{x:sign*w*.34,y:height*.88,z:-d*.16},.09,silver,.09);
        addBeam({x:sign*w*.34,y:height*.88,z:-d*.16},{x:sign*w*.2,y:height*.92,z:-d*.32},.09,silver,.09);
      });
      add({x:w*.58,y:height*.13,z:d*.11},{x:0,y:height*.88,z:-d*.32},side,{rotationX:-.15});
      add({x:w*.4,y:height*.075,z:d*.025},{x:0,y:height*.9,z:-d*.385},screen,{castShadow:false});
      [-1,1].forEach(sign=>addBeam({x:sign*w*.405,y:height*.23,z:d*.3},{x:sign*w*.405,y:height*.62,z:-d*.18},.025,accent,.045));
    }else if(family==="smith-cable"){
      modelType="smith and cable machine";
      const post=Math.min(0.22,Math.max(0.1,Math.min(w,d)*0.1));
      const inset=Math.min(0.22,Math.min(w,d)*0.13);
      const xs=[-w/2+inset,w/2-inset], zs=[-d/2+inset,d/2-inset];
      xs.forEach(x=>zs.forEach(z=>add({x:post,y:height*.94,z:post},{x,y:height*.47,z},selectedMat)));
      add({x:Math.max(0.2,w-2*inset),y:post,z:post},{x:0,y:height*.94-post/2,z:-d/2+inset},selectedMat);
      add({x:Math.max(0.2,w-2*inset),y:post,z:post},{x:0,y:height*.94-post/2,z:d/2-inset},selectedMat);
      add({x:post,y:post,z:Math.max(0.2,d-2*inset)},{x:-w/2+inset,y:height-post/2,z:0},selectedMat);
      add({x:post,y:post,z:Math.max(0.2,d-2*inset)},{x:w/2-inset,y:height-post/2,z:0},selectedMat);
      add({x:Math.min(.48,w*.18),y:height*.55,z:Math.min(.46,d*.22)},{x:-w*.3,y:height*.3,z:d*.12},dark);
      add({x:Math.min(.48,w*.18),y:height*.55,z:Math.min(.46,d*.22)},{x:w*.3,y:height*.3,z:d*.12},dark);
      addCylinder(.055,w*.84,{x:0,y:height*.53,z:-d*.22},silver,{rotationZ:Math.PI/2});
      [-1,1].forEach(sign=>{
        addCylinder(.035,height*.72,{x:sign*w*.2,y:height*.42,z:-d*.2},silver);
        addCylinder(Math.min(.12,w*.045),.09,{x:sign*w*.3,y:height*.78,z:-d*.26},silver,{rotationX:Math.PI/2});
        addBeam({x:sign*w*.3,y:height*.76,z:-d*.25},{x:sign*w*.43,y:height*.94,z:0},.055,silver,.055);
        for(let plate=0;plate<7;plate++) add({x:w*.13,y:.025,z:d*.15},{x:sign*w*.3,y:height*(.12+plate*.047),z:d*.12},silver);
      });
      if(profile==="compact-smith"){
        modelType="compact dual-stack smith machine";
        [-1,1].forEach(sign=>{
          for(let hole=0;hole<12;hole++) add({x:.026,y:.035,z:.035},{x:sign*w*.39,y:height*(.16+hole*.061),z:-d*.34},silver,{castShadow:false});
          add({x:w*.17,y:height*.58,z:d*.16},{x:sign*w*.29,y:height*.35,z:d*.25},dark);
          for(let plate=0;plate<10;plate++) add({x:w*.13,y:.026,z:d*.12},{x:sign*w*.29,y:height*(.12+plate*.04),z:d*.25},silver);
          addCylinder(Math.min(.11,w*.045),.12,{x:sign*w*.42,y:height*.87,z:-d*.25},dark,{rotationX:Math.PI/2});
          addBeam({x:sign*w*.4,y:height*.86,z:-d*.25},{x:sign*w*.46,y:height*.78,z:-d*.48},.045,silver,.045);
        });
        add({x:w*.88,y:.1,z:d*.12},{x:0,y:height*.79,z:d*.28},selectedMat);
        addCylinder(.04,w*.86,{x:0,y:height*.52,z:-d*.34},silver,{rotationZ:Math.PI/2});
      }
      add({x:w*.86,y:.11,z:d*.72},{x:0,y:.08,z:0},dark);
    }else if(family==="pulley-tower"){
      modelType="selectorized pulley tower";
      add({x:w*.82,y:.11,z:d*.82},{x:0,y:.07,z:0},dark);
      [-1,1].forEach(sign=>{
        add({x:Math.min(.15,w*.12),y:height*.92,z:Math.min(.15,d*.12)},{x:sign*w*.34,y:height*.47,z:d*.08},selectedMat);
        addCylinder(.035,height*.7,{x:sign*w*.22,y:height*.42,z:-d*.12},silver);
      });
      add({x:w*.38,y:height*.64,z:d*.24},{x:0,y:height*.34,z:d*.11},dark);
      for(let plate=0;plate<10;plate++) add({x:w*.3,y:.025,z:d*.19},{x:0,y:height*(.1+plate*.045),z:d*.11},silver);
      add({x:w*.72,y:.14,z:d*.16},{x:0,y:height*.92,z:-d*.03},selectedMat);
      addCylinder(.045,w*.76,{x:0,y:height*.9,z:-d*.12},silver,{rotationZ:Math.PI/2});
      [-1,1].forEach(sign=>addBeam({x:sign*w*.22,y:height*.86,z:-d*.12},{x:sign*w*.4,y:height*.62,z:-d*.34},.045,silver,.045));
    }else if(family==="leg-press"){
      modelType="incline leg press";
      add({x:w*.88,y:.12,z:d*.9},{x:0,y:.08,z:0},dark);
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.3,y:.18,z:d*.38},{x:sign*w*.3,y:height*.78,z:-d*.2},.12,selectedMat,.18);
        addBeam({x:sign*w*.18,y:.22,z:d*.33},{x:sign*w*.18,y:height*.72,z:-d*.18},.055,silver,.055);
        addBeam({x:sign*w*.4,y:.16,z:-d*.35},{x:sign*w*.4,y:height*.85,z:-d*.35},.13,selectedMat,.13);
      });
      add({x:w*.62,y:.22,z:d*.28},{x:0,y:height*.51,z:-d*.02},pad,{rotationX:-.68});
      add({x:w*.64,y:height*.14,z:d*.2},{x:0,y:height*.64,z:-d*.13},pad,{rotationX:-.68});
      add({x:w*.76,y:.18,z:d*.22},{x:0,y:height*.26,z:d*.36},silver,{rotationX:-.45});
      addCylinder(.07,w*.78,{x:0,y:height*.7,z:-d*.22},silver,{rotationZ:Math.PI/2});
      [-1,1].forEach(sign=>addCylinder(Math.min(.18,w*.07),.16,{x:sign*w*.4,y:height*.7,z:-d*.22},dark,{rotationZ:Math.PI/2}));
      [-1,1].forEach(sign=>add({x:w*.16,y:height*.13,z:d*.13},{x:sign*w*.17,y:height*.75,z:-d*.12},pad,{rotationX:-.68}));
      if(profile==="sled-leg-press"){
        modelType="3-in-1 leg press and hack squat";
        [-1,1].forEach(sign=>{
          addBeam({x:sign*w*.43,y:.13,z:d*.42},{x:sign*w*.43,y:height*.88,z:-d*.32},.075,selectedMat,.075);
          addCylinder(Math.min(.1,w*.04),w*.18,{x:sign*w*.42,y:height*.72,z:-d*.2},dark,{rotationZ:Math.PI/2});
          addCylinder(Math.min(.1,w*.04),w*.18,{x:sign*w*.42,y:height*.42,z:d*.05},dark,{rotationZ:Math.PI/2});
        });
        add({x:w*.74,y:.12,z:d*.25},{x:0,y:height*.13,z:d*.39},silver,{rotationX:-.58});
      }
    }else if(family==="bench"){
      modelType="adjustable bench";
      const seatH=Math.min(1.55,height*.45);
      add({x:w*.72,y:.26,z:d*.25},{x:0,y:seatH,z:d*.24},pad);
      add({x:w*.65,y:.28,z:d*.5},{x:0,y:seatH+height*.17,z:-d*.12},pad,{rotationX:-.66});
      addBeam({x:0,y:.18,z:d*.4},{x:0,y:seatH*.9,z:-d*.31},.15,selectedMat,.15);
      add({x:w*.8,y:.11,z:.16},{x:0,y:.1,z:d*.39},selectedMat);
      add({x:w*.65,y:.11,z:.16},{x:0,y:.1,z:-d*.35},selectedMat);
      addCylinder(Math.min(.16,w*.08),w*.76,{x:0,y:seatH*.8,z:d*.39},pad,{rotationZ:Math.PI/2});
      if(profile==="incline-bench"){
        modelType="adjustable incline bench with leg roller";
        addBeam({x:0,y:.18,z:-d*.2},{x:0,y:seatH+height*.12,z:-d*.18},.07,silver,.07);
        add({x:w*.22,y:.09,z:d*.48},{x:0,y:.22,z:-d*.08},silver,{rotationX:-.08});
        addCylinder(Math.min(.15,w*.12),w*.92,{x:0,y:seatH+height*.12,z:-d*.26},pad,{rotationZ:Math.PI/2});
        add({x:w*.45,y:.18,z:d*.2},{x:0,y:seatH+height*.33,z:-d*.31},pad,{rotationX:-.66});
      }
    }else if(family==="treadmill"){
      modelType=profile==="incline-treadmill" ? "high-incline treadmill" : "incline treadmill";
      const deckAngle=profile==="incline-treadmill" ? -.13 : -.045;
      add({x:w*.84,y:.2,z:d*.82},{x:0,y:.28,z:d*.04},dark,{rotationX:deckAngle});
      add({x:w*.68,y:.055,z:d*.72},{x:0,y:.41,z:d*.05},pad,{rotationX:deckAngle});
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.35,y:.22,z:-d*.32},{x:sign*w*.3,y:height*.72,z:-d*.32},.11,selectedMat,.11);
        addBeam({x:sign*w*.3,y:height*.62,z:-d*.31},{x:sign*w*.3,y:height*.62,z:d*.08},.075,selectedMat,.075);
      });
      add({x:w*.68,y:height*.13,z:d*.12},{x:0,y:height*.75,z:-d*.32},selectedMat,{rotationX:-.12});
      add({x:w*.43,y:height*.075,z:d*.018},{x:0,y:height*.77,z:-d*.39},screen,{castShadow:false});
      addCylinder(Math.min(.18,w*.07),w*.72,{x:0,y:.22,z:d*.38},dark,{rotationZ:Math.PI/2});
      [-1,1].forEach(sign=>add({x:.11,y:.1,z:d*.7},{x:sign*w*.39,y:.42,z:d*.05},silver));
      if(profile==="incline-treadmill"){
        add({x:w*.58,y:height*.2,z:d*.08},{x:0,y:height*.78,z:-d*.34},selectedMat,{rotationX:-.12});
        add({x:w*.44,y:height*.14,z:d*.025},{x:0,y:height*.79,z:-d*.395},screen,{castShadow:false});
        [-1,1].forEach(sign=>addBeam({x:sign*w*.31,y:height*.62,z:-d*.28},{x:sign*w*.31,y:height*.62,z:d*.28},.065,silver,.065));
      }
    }else if(family==="adductor"){
      modelType=profile==="adductor-combo" ? "combo adductor and abductor" : "adductor abductor machine";
      add({x:w*.28,y:height*.82,z:d*.25},{x:-w*.29,y:height*.42,z:-d*.28},selectedMat);
      add({x:w*.2,y:height*.58,z:d*.17},{x:-w*.29,y:height*.35,z:-d*.28},dark);
      add({x:w*.56,y:.2,z:d*.3},{x:w*.1,y:height*.29,z:d*.05},pad);
      add({x:w*.5,y:height*.38,z:.2},{x:w*.1,y:height*.52,z:-d*.08},pad,{rotationX:-.08});
      addBeam({x:0,y:height*.3,z:d*.05},{x:-w*.02,y:height*.2,z:d*.34},.1,silver,.1);
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.08,y:height*.24,z:d*.29},{x:sign*w*.32,y:height*.2,z:d*.38},.08,silver,.08);
        addCylinder(Math.min(.14,w*.065),w*.2,{x:sign*w*.3,y:height*.25,z:d*.36},pad,{rotationZ:Math.PI/2});
        addBeam({x:sign*w*.18,y:height*.57,z:-d*.02},{x:sign*w*.4,y:height*.56,z:-d*.02},.06,silver,.06);
      });
      if(profile==="adductor-combo"){
        for(let plate=0;plate<8;plate++) add({x:w*.13,y:.025,z:d*.13},{x:-w*.29,y:height*(.1+plate*.045),z:-d*.28},silver);
        addCylinder(.07,w*.34,{x:0,y:height*.24,z:d*.33},silver,{rotationZ:Math.PI/2});
      }
    }else if(family==="rowing-machine" && profile==="selectorized-seated-row"){
      modelType="selectorized seated row";
      add({x:w*.82,y:.11,z:d*.84},{x:0,y:.07,z:0},dark);
      add({x:w*.32,y:height*.88,z:d*.28},{x:0,y:height*.45,z:-d*.31},selectedMat);
      add({x:w*.2,y:height*.63,z:d*.18},{x:0,y:height*.34,z:-d*.31},dark);
      for(let plate=0;plate<9;plate++) add({x:w*.15,y:.025,z:d*.13},{x:0,y:height*(.11+plate*.044),z:-d*.31},silver);
      add({x:w*.42,y:height*.28,z:d*.12},{x:0,y:height*.5,z:-d*.02},pad,{rotationX:-.08});
      [-1,1].forEach(sign=>{
        add({x:w*.22,y:.08,z:d*.3},{x:sign*w*.2,y:height*.13,z:d*.31},silver,{rotationX:-.2});
        addBeam({x:sign*w*.12,y:height*.84,z:-d*.28},{x:sign*w*.34,y:height*.48,z:d*.2},.085,red,.085);
        addBeam({x:sign*w*.34,y:height*.48,z:d*.2},{x:sign*w*.38,y:height*.35,z:d*.35},.07,red,.07);
        addCylinder(.055,w*.2,{x:sign*w*.39,y:height*.35,z:d*.36},pad,{rotationZ:Math.PI/2});
      });
      add({x:w*.48,y:height*.08,z:d*.05},{x:0,y:height*.9,z:-d*.31},red);
    }else if(family==="rowing-machine" && profile==="seated-standing-row"){
      modelType="plate-loaded seated and standing row";
      add({x:w*.82,y:.11,z:d*.86},{x:0,y:.07,z:0},dark);
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.22,y:.14,z:d*.37},{x:sign*w*.2,y:height*.83,z:-d*.28},.09,selectedMat,.1);
        addBeam({x:sign*w*.35,y:.12,z:d*.4},{x:sign*w*.35,y:height*.2,z:-d*.12},.075,selectedMat,.075);
      });
      add({x:w*.62,y:.12,z:d*.24},{x:0,y:height*.18,z:d*.36},silver,{rotationX:-.52});
      add({x:w*.42,y:height*.2,z:d*.15},{x:0,y:height*.75,z:-d*.23},pad,{rotationX:-.52});
      add({x:w*.58,y:.09,z:d*.17},{x:0,y:height*.57,z:-d*.08},silver,{rotationX:-.52});
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.2,y:height*.78,z:-d*.23},{x:sign*w*.38,y:height*.62,z:d*.02},.07,selectedMat,.07);
        addCylinder(.05,w*.22,{x:sign*w*.39,y:height*.62,z:d*.04},pad,{rotationZ:Math.PI/2});
        addCylinder(Math.min(.15,w*.06),w*.2,{x:sign*w*.31,y:height*.48,z:-d*.02},dark,{rotationZ:Math.PI/2});
      });
      add({x:w*.7,y:.1,z:d*.12},{x:0,y:height*.68,z:-d*.15},selectedMat);
    }else if(family==="rowing-machine"){
      modelType="rowing machine";
      const rowFrame=/hs08/.test(text)?red:selectedMat;
      add({x:w*.34,y:height*.82,z:d*.26},{x:0,y:height*.42,z:-d*.34},selectedMat);
      add({x:w*.22,y:height*.58,z:d*.18},{x:0,y:height*.34,z:-d*.34},dark);
      add({x:w*.52,y:.2,z:d*.25},{x:0,y:height*.23,z:d*.1},pad);
      add({x:w*.42,y:height*.28,z:.18},{x:0,y:height*.4,z:-d*.02},pad,{rotationX:-.08});
      add({x:w*.48,y:.12,z:d*.24},{x:0,y:height*.16,z:d*.35},silver,{rotationX:-.24});
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.17,y:height*.76,z:-d*.3},{x:sign*w*.36,y:height*.52,z:d*.02},.08,rowFrame,.08);
        addCylinder(.055,w*.22,{x:sign*w*.37,y:height*.51,z:d*.04},pad,{rotationZ:Math.PI/2});
      });
      if(/hs08/.test(text)) add({x:w*.44,y:height*.09,z:d*.05},{x:0,y:height*.87,z:-d*.31},red);
    }else if(family==="bike"){
      modelType="exercise bike";
      add({x:w*.64,y:.16,z:d*.5},{x:0,y:.12,z:.08},dark);
      add({x:.16,y:height*.65,z:.16},{x:0,y:height*.34,z:0},selectedMat);
      add({x:w*.5,y:.18,z:d*.18},{x:0,y:height*.6,z:.05},pad);
      add({x:w*.62,y:.14,z:.14},{x:0,y:height*.73,z:-d*.18},selectedMat);
    }else if(family==="storage-rack" && profile==="three-tier-rack"){
      modelType="photo-matched three-tier dumbbell rack";
      const levels=3;
      [-1,1].forEach(end=>{
        [-1,1].forEach(side=>addBeam(
          {x:end*w*.43,y:.08,z:side*d*.38},
          {x:end*w*.43,y:height*.9,z:side*d*.22},
          .11,selectedMat,.11
        ));
        add({x:.12,y:.1,z:d*.82},{x:end*w*.43,y:.08,z:0},selectedMat);
      });
      for(let level=0;level<levels;level++){
        const y=.36+level*(height-.6)/(levels-1);
        [-1,1].forEach(side=>add({x:w*.86,y:.1,z:d*.12},{x:0,y,z:side*d*.23},dark,{rotationZ:-.035}));
        const count=Math.max(4,Math.min(8,Math.round(w/.78)));
        for(let j=0;j<count;j++){
          const x=-w*.35+j*(w*.7/Math.max(1,count-1));
          addCylinder(Math.min(.09,d*.04),d*.3,{x,y:y+.14,z:0},silver,{rotationX:Math.PI/2,segments:12});
          addCylinder(Math.min(.16,d*.075),.11,{x,y:y+.14,z:-d*.17},dark,{rotationX:Math.PI/2,segments:12});
          addCylinder(Math.min(.16,d*.075),.11,{x,y:y+.14,z:d*.17},dark,{rotationX:Math.PI/2,segments:12});
        }
      }
    }else if(family==="storage-rack"){
      modelType="three-tier storage rack";
      const levels=Math.max(2,Math.min(5,Math.round(height/1.1)));
      [-1,1].forEach(sign=>{
        addBeam({x:-w*.38,y:.08,z:sign*d*.43},{x:0,y:height*.92,z:sign*d*.43},.12,selectedMat,.12);
        addBeam({x:w*.38,y:.08,z:sign*d*.43},{x:0,y:height*.92,z:sign*d*.43},.12,selectedMat,.12);
      });
      for(let i=0;i<levels;i++){
        const y=.35+i*(height-.55)/Math.max(1,levels-1);
        add({x:w*.72,y:.1,z:d*.9},{x:0,y,z:0},dark,{rotationZ:-.045});
        const count=Math.max(3,Math.min(8,Math.round(d/.72)));
        for(let j=0;j<count;j++){
          const z=-d*.36+j*(d*.72/Math.max(1,count-1));
          addCylinder(Math.min(.1,d*.025),w*.3,{x:0,y:y+.14,z},silver,{rotationZ:Math.PI/2,segments:12});
          addCylinder(Math.min(.17,d*.045),.11,{x:-w*.17,y:y+.14,z},dark,{rotationZ:Math.PI/2,segments:12});
          addCylinder(Math.min(.17,d*.045),.11,{x:w*.17,y:y+.14,z},dark,{rotationZ:Math.PI/2,segments:12});
        }
      }
    }else if(family==="strength-rack"){
      modelType="strength rack";
      const post=Math.min(.22,Math.max(.1,Math.min(w,d)*.1));
      const inset=Math.min(.22,Math.min(w,d)*.13);
      const xs=[-w/2+inset,w/2-inset],zs=[-d/2+inset,d/2-inset];
      xs.forEach(x=>zs.forEach(z=>add({x:post,y:height*.94,z:post},{x,y:height*.47,z},selectedMat)));
      add({x:w-2*inset,y:post,z:post},{x:0,y:height*.94-post/2,z:-d/2+inset},selectedMat);
      add({x:w-2*inset,y:post,z:post},{x:0,y:height*.94-post/2,z:d/2-inset},selectedMat);
    }else{
      modelType="general selectorized machine";
      add({x:w*.3,y:height*.82,z:d*.26},{x:-w*.27,y:height*.42,z:-d*.28},selectedMat);
      add({x:w*.2,y:height*.62,z:d*.18},{x:-w*.27,y:height*.34,z:-d*.28},dark);
      for(let plate=0;plate<9;plate++) add({x:w*.15,y:.025,z:d*.14},{x:-w*.27,y:height*(.1+plate*.045),z:-d*.28},silver);
      add({x:w*.5,y:.2,z:d*.3},{x:w*.12,y:height*.25,z:d*.08},pad);
      add({x:w*.44,y:height*.34,z:.18},{x:w*.12,y:height*.43,z:-d*.04},pad,{rotationX:-.08});
      addBeam({x:-w*.22,y:height*.8,z:-d*.25},{x:w*.02,y:height*.66,z:-d*.08},.085,selectedMat,.085);
      [-1,1].forEach(sign=>{
        addBeam({x:sign*w*.08,y:height*.62,z:-d*.06},{x:sign*w*.36,y:height*.52,z:d*.1},.065,silver,.065);
        addCylinder(.055,w*.18,{x:sign*w*.37,y:height*.52,z:d*.1},pad,{rotationZ:Math.PI/2});
      });
      add({x:w*.78,y:.11,z:d*.78},{x:0,y:.07,z:0},dark);
    }

    if(isSelected){
      const selectedBase=this.material({color:0xf97316,transparent:true,opacity:.15,roughness:.72,depthWrite:false,envMapIntensity:.05});
      const marker=add({x:w+.18,y:.055,z:d+.18},{x:0,y:.07,z:0},selectedBase);
      marker.renderOrder=4;
    }
    group.userData.modelType=modelType;
    group.userData.measuredFootprint={widthFt:w,depthFt:d,heightFt:height};
    placementGroup.userData.modelType=modelType;
    this.recordEquipmentDispatch(placementGroup,item,profile,dedicated);
    this.reconstructedModelCount++;
    this.host.dataset.reconstructedModels=String(this.reconstructedModelCount);
    return dedicated;
  }

  addEquipmentLabel(group,instId,item,height,w,d){
    const canvas=document.createElement("canvas");
    canvas.width=512; canvas.height=96;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="rgba(15,23,42,.9)";
    ctx.roundRect(5,5,502,86,18);
    ctx.fill();
    ctx.fillStyle="#fff";
    ctx.font="700 26px system-ui, sans-serif";
    const label=String(item.name||"Equipment");
    const short=label.length>28?`${label.slice(0,27)}…`:label;
    ctx.fillText(short,24,60);
    const texture=new THREE.CanvasTexture(canvas);
    texture.encoding=THREE.sRGBEncoding;
    this.disposables.push(texture);
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
    this.disposables.push(material);
    const sprite=new THREE.Sprite(material);
    const scale=Math.max(2.1,Math.min(3.7,Math.max(w,d)*.82));
    sprite.scale.set(scale,scale*.19,1);
    sprite.position.set(0,Math.min(this.ceiling-.35,height+.55),0);
    sprite.renderOrder=10;
    sprite.userData.instId=instId;
    group.add(sprite);
    this.labelSprites.set(instId,sprite);
  }

  buildOutlets(){
    const outletMat=this.material({color:0xf97316,roughness:.5,metalness:.15});
    (state.layout.outlets||[]).forEach(outlet=>{
      const x = typeof outletXTotalFt === "function" ? outletXTotalFt(outlet) : safeNum(outlet.xFt);
      const z = typeof outletYTotalFt === "function" ? outletYTotalFt(outlet) : safeNum(outlet.yFt);
      this.box(this.scene,{x:.34,y:.44,z:.1},{x,y:.55,z},outletMat,{castShadow:false});
    });
  }

  setInitialCamera(){
    const key=`${this.layoutId}:${this.mode}`;
    const remembered=gym3DCameraMemory.get(key);
    const cx=(this.bounds.minX+this.bounds.maxX)/2;
    const cz=(this.bounds.minY+this.bounds.maxY)/2;
    if(this.mode === "walkthrough"){
      const rememberedValid=Number.isFinite(remembered?.x)&&Number.isFinite(remembered?.z)&&this.isWalkPointClear(remembered.x,remembered.z,.62,true);
      const start=rememberedValid?{x:remembered.x,z:remembered.z}:this.findWalkthroughStart();
      this.camera.position.set(start.x,(safeNum(this.settings.eyeHeightFt)||5.67)+this.floorElevationAt(start.x,start.z),start.z);
      this.yaw=rememberedValid&&Number.isFinite(remembered?.yaw)?remembered.yaw:this.bestOpenYaw(start);
      this.pitch=rememberedValid&&Number.isFinite(remembered?.pitch)?remembered.pitch:-0.025;
      this.applyFirstPersonRotation();
    }else{
      this.target=new THREE.Vector3(
        Number.isFinite(remembered?.targetX)?remembered.targetX:cx,
        Number.isFinite(remembered?.targetY)?remembered.targetY:Math.min(2.2,this.ceiling*.28),
        Number.isFinite(remembered?.targetZ)?remembered.targetZ:cz
      );
      const span=Math.max(this.bounds.w,this.bounds.h);
      this.orbit={
        radius:remembered?.radius || Math.max(12,span*1.18),
        theta:remembered?.theta ?? -0.78,
        phi:remembered?.phi ?? 1.03,
      };
      this.applyOrbit();
    }
  }

  findWalkthroughStart(){
    const cx=(this.bounds.minX+this.bounds.maxX)/2;
    const cz=(this.bounds.minY+this.bounds.maxY)/2;
    const doorStarts=(state.layout.areas||[]).filter(a=>a.kind==="door").map(a=>{
      const r=areaRect(a);
      const clearance=typeof doorClearanceRect==="function"
        ? doorClearanceRect({...a,doorClearEnabled:true})
        : null;
      const orient=clearance?.orient || (r.w>=r.h?"horizontal":"vertical");
      const hinge=clearance?.hinge || a.doorHinge || "start";
      const latchSide=hinge==="end"?.22:.78;
      if(orient==="horizontal"){
        const boundary=Number.isFinite(clearance?.hingeY)?clearance.hingeY:r.y;
        const inward=Math.sign(cz-boundary)||1;
        return {x:r.x+r.w*latchSide,z:boundary+inward*2.15};
      }
      const boundary=Number.isFinite(clearance?.hingeX)?clearance.hingeX:r.x;
      const inward=Math.sign(cx-boundary)||1;
      return {x:boundary+inward*2.15,z:r.y+r.h*latchSide};
    });
    const candidates=[...doorStarts];
    for(let z=this.bounds.minY+.75;z<=this.bounds.maxY-.75;z+=.75){
      for(let x=this.bounds.minX+.75;x<=this.bounds.maxX-.75;x+=.75){
        candidates.push({x,z});
      }
    }
    const equipment=this.roomInstances.map(inst=>{
      const item=getItemById(inst.itemId);
      return item ? effectiveRectForInst(inst,item).base : null;
    }).filter(Boolean);
    const safeCandidates=candidates.filter(p=>{
      return this.isWalkPointClear(p.x,p.z,.72,true);
    });
    const safeDoorStarts=doorStarts
      .filter(point=>this.isWalkPointClear(point.x,point.z,.72,true))
      .map(point=>({point,open:this.openDistance(point,this.bestOpenYaw(point))}))
      .sort((a,b)=>b.open-a.open);
    this.host.dataset.safeDoorStarts=String(safeDoorStarts.length);
    this.host.dataset.bestDoorOpen=safeDoorStarts[0]?.open?.toFixed(2)||"0";
    if(safeDoorStarts[0]) return safeDoorStarts[0].point;
    const baseScore=p=>{
      const nearest=equipment.length ? Math.min(...equipment.map(r=>{
        const ex=Math.max(r.x-p.x,0,p.x-(r.x+r.w));
        const ez=Math.max(r.y-p.z,0,p.z-(r.y+r.h));
        return Math.hypot(ex,ez);
      })) : 4;
      const centerPenalty=Math.hypot(p.x-cx,p.z-cz)*.08;
      return nearest-centerPenalty;
    };
    safeCandidates.sort((a,b)=>baseScore(b)-baseScore(a));
    const finalists=safeCandidates.slice(0,18).map(point=>{
      const yaw=this.bestOpenYaw(point);
      return {point,score:baseScore(point)+this.openDistance(point,yaw)*.35};
    });
    finalists.sort((a,b)=>b.score-a.score);
    return finalists[0]?.point || safeCandidates[0] || {x:cx,z:cz};
  }

  yawTowardRoomCenter(start){
    const cx=(this.bounds.minX+this.bounds.maxX)/2;
    const cz=(this.bounds.minY+this.bounds.maxY)/2;
    return Math.atan2(-(cx-start.x),-(cz-start.z));
  }

  openDistance(start,yaw){
    let distance=.45;
    for(;distance<=10;distance+=.35){
      const x=start.x-Math.sin(yaw)*distance;
      const z=start.z-Math.cos(yaw)*distance;
      if(!this.isWalkPointClear(x,z,.24,true)) break;
    }
    return distance;
  }

  bestOpenYaw(start){
    const centerYaw=this.yawTowardRoomCenter(start);
    let best={yaw:centerYaw,distance:-1,centerBias:-Infinity};
    for(let i=0;i<24;i++){
      const yaw=-Math.PI+i*(Math.PI*2/24);
      const distance=this.openDistance(start,yaw);
      const delta=Math.atan2(Math.sin(yaw-centerYaw),Math.cos(yaw-centerYaw));
      const centerBias=Math.cos(delta)*.15;
      if(distance+centerBias>best.distance+best.centerBias) best={yaw,distance,centerBias};
    }
    return best.yaw;
  }

  isWalkPointClear(x,z,radius=.62,includeEquipment=true){
    const samples=[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]];
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      samples.push([Math.cos(angle)*radius,Math.sin(angle)*radius]);
    }
    if(!samples.every(([dx,dz])=>pointInRoom(x+dx,z+dz,this.roomData.rects))) return false;
    if(this.mode==="walkthrough" && typeof effectiveCeilingAtPoint==="function"){
      const eye=(safeNum(this.settings.eyeHeightFt)||5.67)+this.floorElevationAt(x,z);
      if(effectiveCeilingAtPoint(x,z)<eye+.12) return false;
    }
    if(!includeEquipment) return true;
    const blockedByDoor=this.doorCollisionSegments.some(segment=>{
      const dx=segment.x2-segment.x1,dz=segment.z2-segment.z1;
      const lengthSq=dx*dx+dz*dz;
      const t=lengthSq>0
        ? clamp(((x-segment.x1)*dx+(z-segment.z1)*dz)/lengthSq,0,1)
        : 0;
      const nearestX=segment.x1+dx*t,nearestZ=segment.z1+dz*t;
      return Math.hypot(x-nearestX,z-nearestZ)<radius+.075;
    });
    if(blockedByDoor) return false;
    return !this.roomInstances.some(inst=>{
      const item=getItemById(inst.itemId);
      if(!item) return false;
      const r=effectiveRectForInst(inst,item).base;
      const nearestX=clamp(x,r.x,r.x+r.w);
      const nearestZ=clamp(z,r.y,r.y+r.h);
      return Math.hypot(x-nearestX,z-nearestZ)<radius+.08;
    });
  }

  applyOrbit(){
    const o=this.orbit;
    o.phi=clamp(o.phi,.28,1.43);
    o.radius=clamp(o.radius,4,Math.max(22,Math.max(this.bounds.w,this.bounds.h)*3));
    this.camera.position.set(
      this.target.x+o.radius*Math.sin(o.phi)*Math.sin(o.theta),
      this.target.y+o.radius*Math.cos(o.phi),
      this.target.z+o.radius*Math.sin(o.phi)*Math.cos(o.theta)
    );
    this.camera.lookAt(this.target);
  }

  frameCandidateRoomBlocked(focus,radius,theta,phi){
    const reach=radius*Math.sin(phi);
    const camera={
      x:focus.x+reach*Math.sin(theta),
      z:focus.z+reach*Math.cos(theta),
    };
    return !segmentHasRoomClearance(camera,focus,this.roomData.rects,.22);
  }

  frameCandidateBlocked(target,focus,radius,theta,phi){
    const reach=radius*Math.sin(phi);
    const camera={
      x:focus.x+reach*Math.sin(theta),
      z:focus.z+reach*Math.cos(theta),
    };
    if(this.frameCandidateRoomBlocked(focus,radius,theta,phi)) return true;
    const crossesRect=(rect=>{
      const dx=focus.x-camera.x, dz=focus.z-camera.z;
      let enter=0, exit=1;
      for(const [origin,delta,min,max] of [
        [camera.x,dx,rect.minX,rect.maxX],
        [camera.z,dz,rect.minZ,rect.maxZ],
      ]){
        if(Math.abs(delta)<1e-8){
          if(origin<min || origin>max) return false;
          continue;
        }
        const a=(min-origin)/delta, b=(max-origin)/delta;
        enter=Math.max(enter,Math.min(a,b));
        exit=Math.min(exit,Math.max(a,b));
        if(enter>exit) return false;
      }
      return true;
    });
    return [...this.itemGroups.values()].some(group=>{
      if(group===target) return false;
      const footprint=group.userData.worldFootprint;
      if(!footprint) return false;
      const pad=.12;
      const rect={
        minX:group.position.x-footprint.widthFt/2-pad,
        maxX:group.position.x+footprint.widthFt/2+pad,
        minZ:group.position.z-footprint.depthFt/2-pad,
        maxZ:group.position.z+footprint.depthFt/2+pad,
      };
      const cameraInside=camera.x>=rect.minX && camera.x<=rect.maxX && camera.z>=rect.minZ && camera.z<=rect.maxZ;
      return cameraInside || crossesRect(rect);
    });
  }

  frameSelected(){
    if(this.mode!=="preview") return;
    const selectedId=state.layout.selectedInstId || state.layout.selectedAreaId || state.layout.selectedWallFeatureId;
    const group=this.itemGroups.get(selectedId) || this.areaGroups.get(selectedId) || this.wallFeatureGroups.get(selectedId);
    if(!group) return;
    const footprint=group.userData.worldFootprint||{};
    const width=Math.max(.5,safeNum(footprint.widthFt));
    const depth=Math.max(.5,safeNum(footprint.depthFt));
    const height=Math.max(.5,safeNum(footprint.heightFt));
    const cx=(this.bounds.minX+this.bounds.maxX)/2;
    const cz=(this.bounds.minY+this.bounds.maxY)/2;
    const focus=group.userData.focusPoint || {x:group.position.x,y:Math.min(height*.43,this.ceiling*.38),z:group.position.z};
    const dx=cx-focus.x,dz=cz-focus.z;
    const centerDistance=Math.hypot(dx,dz);
    let idealRadius=Math.max(5.8,Math.hypot(width,depth)*1.2+height*.7);
    let theta=centerDistance>.25?Math.atan2(dx,dz):-.78;
    if(group.userData.boundaryMounted){
      const inward=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),safeNum(group.userData.rotationY));
      const preferredTheta=Math.atan2(inward.x,inward.z);
      const halfFov=THREE.MathUtils.degToRad((safeNum(this.camera.fov)||54)*.5);
      const fitRadius=Math.max(4,(Math.hypot(width,depth,height)*.5/Math.sin(halfFov))*1.08);
      const radii=[
        idealRadius,
        Math.max(fitRadius,idealRadius*.8),
        Math.max(fitRadius,idealRadius*.65),
        fitRadius,
      ].filter((radius,index,all)=>all.findIndex(candidate=>Math.abs(candidate-radius)<=.01)===index);
      const radius=radii.find(candidate=>!this.frameCandidateBlocked(group,focus,candidate,preferredTheta,1.06));
      if(radius===undefined) return;
      theta=preferredTheta;
      idealRadius=radius;
    }else if(this.itemGroups.has(selectedId)){
      const totalRotation=safeNum(group.userData.rotationY)+safeNum(group.userData.visualRotationY);
      const front=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),totalRotation);
      const frontTheta=Math.atan2(front.x,front.z);
      const offsets=[.16,-.32,.32,-.65,.65,-.96,.96];
      const frontAngles=offsets.map(offset=>frontTheta+offset);
      const oppositeAngles=offsets.map(offset=>frontTheta+Math.PI+offset);
      const roomCenterTheta=Math.atan2(cx-focus.x,cz-focus.z);
      const ringAngles=[roomCenterTheta,...Array.from({length:7},(_,index)=>roomCenterTheta+(index+1)*Math.PI/4)];
      const halfFov=THREE.MathUtils.degToRad((safeNum(this.camera.fov)||54)*.5);
      const fitRadius=Math.max(4,(Math.hypot(width,depth,height)*.5/Math.sin(halfFov))*1.08);
      const radii=[idealRadius,Math.max(fitRadius,idealRadius*.75),Math.max(fitRadius,idealRadius*.55),fitRadius]
        .filter((radius,index,all)=>index===0 || Math.abs(radius-all[index-1])>.01);
      const candidates=[...frontAngles,...oppositeAngles,...ringAngles];
      const choices=radii.flatMap(radius=>candidates.map(candidate=>({radius,candidate})));
      const choice=choices.find(({radius,candidate})=>!this.frameCandidateBlocked(group,focus,radius,candidate,1.06));
      if(!choice) return;
      theta=choice.candidate;
      idealRadius=choice.radius;
    }else if(this.wallFeatureGroups.has(selectedId)){
      const front=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),safeNum(group.userData.rotationY));
      theta=Math.atan2(front.x,front.z);
    }
    this.target.set(focus.x,focus.y,focus.z);
    this.orbit={
      radius:idealRadius,
      theta,
      phi:1.06,
    };
    this.applyOrbit();
    this.rememberCamera();
    this.host.dataset.framedSelected=selectedId||"";
  }

  applyFirstPersonRotation(){
    this.pitch=clamp(this.pitch,-1.42,1.42);
    this.camera.rotation.order="YXZ";
    this.camera.rotation.y=this.yaw;
    this.camera.rotation.x=this.pitch;
  }

  bindEvents(){
    this.onResize=()=>this.resize();
    this.resizeObserver=new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.host);

    this.onPointerDown=e=>{
      if(this.mode === "walkthrough"){
        this.activateWalkthrough();
        this.lookDrag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
        this.renderer.domElement.setPointerCapture?.(e.pointerId);
        return;
      }
      this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
      this.renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    this.onPointerMove=e=>{
      if(this.mode === "walkthrough"){
        if(!this.walkActive) return;
        let dx=0,dy=0;
        if(document.pointerLockElement === this.renderer.domElement){
          dx=e.movementX;dy=e.movementY;
        }else if(this.lookDrag){
          if(Math.abs(e.clientX-this.lookDrag.startX)+Math.abs(e.clientY-this.lookDrag.startY)>5) this.lookDrag.moved=true;
          dx=e.clientX-this.lookDrag.x;dy=e.clientY-this.lookDrag.y;
          this.lookDrag.x=e.clientX;this.lookDrag.y=e.clientY;
        }else return;
        this.yaw-=dx*.0028;
        this.pitch-=dy*.0025;
        this.applyFirstPersonRotation();
        return;
      }
      if(!this.drag){
        this.updateHoverAt(e);
        return;
      }
      const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;
      if(Math.abs(e.clientX-this.drag.startX)+Math.abs(e.clientY-this.drag.startY)>5) this.drag.moved=true;
      this.orbit.theta-=dx*.007;
      this.orbit.phi=clamp(this.orbit.phi-dy*.006,.28,1.43);
      this.drag.x=e.clientX; this.drag.y=e.clientY;
      this.applyOrbit();
    };
    this.onPointerUp=e=>{
      if(this.mode === "walkthrough"){
        const wasDrag=this.lookDrag?.moved;
        this.lookDrag=null;
        if(!wasDrag) this.selectAt(e);
        return;
      }
      const wasDrag=this.drag?.moved;
      this.drag=null;
      if(!wasDrag) this.selectAt(e);
    };
    this.onWheel=e=>{
      if(this.mode === "walkthrough") return;
      e.preventDefault();
      this.orbit.radius*=Math.exp(e.deltaY*.0012);
      this.applyOrbit();
    };
    this.onKeyDown=e=>{
      if(this.mode !== "walkthrough") return;
      if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)){
        if(!this.walkActive) this.activateWalkthrough();
        const wasDown=this.keys.has(e.code);
        this.keys.add(e.code);
        if(!wasDown) this.moveWalkthrough(.08);
        e.preventDefault();
      }
    };
    this.onKeyUp=e=>this.keys.delete(e.code);
    this.onBlur=()=>{this.keys.clear();this.lookDrag=null;};
    this.onVisibility=()=>{if(document.hidden)this.onBlur();};
    this.onLockChange=()=>{
      if(this.mode !== "walkthrough") return;
      const locked=document.pointerLockElement===this.renderer.domElement;
      this.host.classList.toggle("isLocked",locked);
      if(locked) this.activateWalkthrough();
    };
    this.onPointerLeave=()=>{
      if(this.mode !== "walkthrough") this.setHoveredInst(null);
    };
    this.startButton=this.mode === "walkthrough" ? this.host.querySelector(".walkthroughStart") : null;
    this.onStartClick=e=>{
      e.preventDefault();
      e.stopPropagation();
      this.lock();
    };

    this.renderer.domElement.addEventListener("pointerdown",this.onPointerDown);
    this.startButton?.addEventListener("click",this.onStartClick);
    window.addEventListener("pointermove",this.onPointerMove);
    window.addEventListener("pointerup",this.onPointerUp);
    this.renderer.domElement.addEventListener("wheel",this.onWheel,{passive:false});
    this.renderer.domElement.addEventListener("pointerleave",this.onPointerLeave);
    document.addEventListener("keydown",this.onKeyDown);
    document.addEventListener("keyup",this.onKeyUp);
    document.addEventListener("pointerlockchange",this.onLockChange);
    window.addEventListener("blur",this.onBlur);
    document.addEventListener("visibilitychange",this.onVisibility);
  }

  selectAt(event){
    const rect=this.renderer.domElement.getBoundingClientRect();
    const pointer=new THREE.Vector2(
      ((event.clientX-rect.left)/rect.width)*2-1,
      -((event.clientY-rect.top)/rect.height)*2+1
    );
    const picked=this.pickTarget(pointer);
    if(!picked) return;
    if(typeof clearAllSelections === "function") clearAllSelections();
    if(picked.type==="wallFeature") state.layout.selectedWallFeatureId=picked.id;
    else state.layout.selectedInstId=picked.id;
    this.rememberCamera();
    if(this.mode === "walkthrough"){
      gym3DControllers.forEach(controller=>controller.updateSelection());
      this.drawMinimap(performance.now()+100);
      return;
    }
    render();
  }

  pickInst(pointer){
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(pointer,this.camera);
    const hit=raycaster.intersectObjects(this.clickTargets,false).find(x=>x.object.userData.instId);
    return hit?.object?.userData?.instId || null;
  }

  pickTarget(pointer){
    const raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(pointer,this.camera);
    const hit=raycaster.intersectObjects(this.clickTargets,false).find(x=>x.object.userData.instId || x.object.userData.wallFeatureId);
    if(hit?.object?.userData?.wallFeatureId) return {type:"wallFeature",id:hit.object.userData.wallFeatureId};
    if(hit?.object?.userData?.instId) return {type:"equipment",id:hit.object.userData.instId};
    return null;
  }

  setHoveredInst(instId){
    if(this.hoveredInstId===instId) return;
    this.hoveredInstId=instId;
    this.updateLabelVisibility();
  }

  updateHoverAt(event){
    if(this.settings.labelMode!=="hover") return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom){
      this.setHoveredInst(null);
      return;
    }
    this.setHoveredInst(this.pickInst(new THREE.Vector2(
      ((event.clientX-rect.left)/rect.width)*2-1,
      -((event.clientY-rect.top)/rect.height)*2+1
    )));
  }

  updateWalkthroughHover(time){
    if(this.mode!=="walkthrough" || this.settings.labelMode!=="hover" || time-this.hoverTime<100) return;
    this.hoverTime=time;
    this.setHoveredInst(this.pickInst(new THREE.Vector2(0,0)));
  }

  updateLabelVisibility(){
    const mode=this.settings.labelMode;
    this.labelSprites.forEach((sprite,id)=>{
      const selected=id===state.layout.selectedInstId;
      sprite.visible=mode==="always" || (mode==="selected" && selected) || (mode==="hover" && (selected || id===this.hoveredInstId));
    });
  }

  updateSelection(){
    this.itemGroups.forEach(group=>{
      group.traverse(obj=>{
        if(!obj.isMesh || !obj.material) return;
        const materials=Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(material=>{
          if(!material?.emissive?.setHex) return;
          material.userData=material.userData||{};
          material.emissive.setHex(material.userData.baseEmissive||0);
          material.emissiveIntensity=safeNum(material.userData.baseEmissiveIntensity);
        });
      });
    });
    this.wallFeatureGroups.forEach((group,id)=>{
      const selected=id===state.layout.selectedWallFeatureId;
      group.userData.selected=selected;
      (group.userData.selectionMaterials||[]).forEach(material=>{
        if(!material?.emissive?.setHex) return;
        material.emissive.setHex(selected?0xf97316:(material.userData.baseEmissive||0));
        material.emissiveIntensity=selected
          ? Math.max(.2,safeNum(material.userData.baseEmissiveIntensity))
          : safeNum(material.userData.baseEmissiveIntensity);
      });
    });
    this.host.dataset.selectedInstId=state.layout.selectedInstId || "";
    this.host.dataset.selectedWallFeatureId=state.layout.selectedWallFeatureId || "";
    this.updateLabelVisibility();
  }

  updateWarnings(){
    const warnings=[...new Set(this.garageDoorWarnings)];
    warnings.push(...this.builderFallbackWarnings);
    this.roomInstances.forEach(inst=>{
      const item=getItemById(inst.itemId);
      if(!item) return;
      const rect=effectiveRectForInst(inst,item).base;
      const fp=footprint(item);
      const required=(String(item.requiredCeilingFt||"").trim()!=="") ? safeNum(item.requiredCeilingFt) : fp.H;
      const available=typeof effectiveCeilingForRect === "function" ? effectiveCeilingForRect(rect) : this.ceiling;
      if(required && available && required>available+.01) warnings.push(`${item.name}: needs ${round1(required)} ft ceiling`);
      if(inst.__invalid) warnings.push(`${item.name}: clearance conflict`);
    });
    if(this.customAssetErrorCount){
      warnings.push(`${this.customAssetErrorCount} local 3D model${this.customAssetErrorCount===1?"":"s"} unavailable — using measured fallback`);
    }
    if(this.invalidWallFeatureWarning) warnings.push(this.invalidWallFeatureWarning);
    this.host.querySelectorAll("[data-gym3d-warnings]").forEach(el=>{
      el.innerHTML=warnings.length
        ? `<strong>${warnings.length} warning${warnings.length===1?"":"s"}</strong><span>${escapeHtml(warnings[0])}</span>`
        : `<strong>Plan clear</strong><span>No active placement warnings</span>`;
      el.classList.toggle("hasWarnings",warnings.length>0);
    });
  }

  lock(){
    if(this.mode !== "walkthrough") return;
    // Pointer lock is unavailable in some embedded/local browser contexts.
    // Activate a fully functional drag-to-look mode first so walking never
    // depends on that permission. WASD works immediately after this call.
    this.activateWalkthrough();
  }

  activateWalkthrough(){
    if(this.mode!=="walkthrough") return;
    this.walkActive=true;
    this.host.classList.add("isActive");
    const start=this.host.querySelector(".walkthroughStart");
    if(start) start.hidden=true;
    const status=this.host.querySelector("[data-walkthrough-status]");
    if(status) status.textContent="Walking mode active · drag in the room to look";
    this.renderer.domElement.focus({preventScroll:true});
  }

  resetWalkthrough(){
    if(this.mode !== "walkthrough") return;
    const start=this.findWalkthroughStart();
    this.camera.position.set(start.x,(safeNum(this.settings.eyeHeightFt)||5.67)+this.floorElevationAt(start.x,start.z),start.z);
    this.yaw=this.bestOpenYaw(start);
    this.pitch=-.025;
    this.applyFirstPersonRotation();
    this.host.dataset.cameraX=this.camera.position.x.toFixed(3);
    this.host.dataset.cameraZ=this.camera.position.z.toFixed(3);
    this.host.dataset.cameraYaw=this.yaw.toFixed(4);
    this.host.dataset.cameraPitch=this.pitch.toFixed(4);
  }

  canStand(x,z){
    return this.isWalkPointClear(x,z,.62,!!this.settings.collisions);
  }

  moveWalkthrough(dt){
    if(this.mode!=="walkthrough" || !this.walkActive) return;
    let forward=0,side=0;
    if(this.keys.has("KeyW")||this.keys.has("ArrowUp")) forward+=1;
    if(this.keys.has("KeyS")||this.keys.has("ArrowDown")) forward-=1;
    if(this.keys.has("KeyD")||this.keys.has("ArrowRight")) side+=1;
    if(this.keys.has("KeyA")||this.keys.has("ArrowLeft")) side-=1;
    if(!forward&&!side) return;
    const len=Math.hypot(forward,side)||1;
    forward/=len; side/=len;
    const speed=4.2;
    const sin=Math.sin(this.yaw), cos=Math.cos(this.yaw);
    const dx=(-sin*forward+cos*side)*speed*dt;
    const dz=(-cos*forward-sin*side)*speed*dt;
    const p=this.camera.position;
    if(this.canStand(p.x+dx,p.z)) p.x+=dx;
    if(this.canStand(p.x,p.z+dz)) p.z+=dz;
    p.y=(safeNum(this.settings.eyeHeightFt)||5.67)+this.floorElevationAt(p.x,p.z);
    this.host.dataset.cameraX=p.x.toFixed(3);
    this.host.dataset.cameraZ=p.z.toFixed(3);
  }

  wallFeatureMinimapLine(group,selectedId=state.layout.selectedWallFeatureId){
    const feature=group.userData.wallFeature||{};
    const width=Math.max(0,safeNum(group.userData.worldFootprint?.widthFt));
    const half=width/2;
    const rotation=safeNum(group.userData.rotationY);
    const dx=Math.cos(rotation)*half,dz=-Math.sin(rotation)*half;
    return {
      x1:group.position.x-dx,
      z1:group.position.z-dz,
      x2:group.position.x+dx,
      z2:group.position.z+dz,
      color:feature.kind==="mirror" ? "#dbeafe" : (feature.color||"#8f5f3a"),
      lineWidth:group.userData.wallFeatureId===selectedId?4:2,
    };
  }

  garageDoorMinimapLine(group,selectedId=state.layout.selectedAreaId){
    const boundary=group?.userData?.garageBoundary;
    if(!boundary?.ok) return null;
    return boundary.axis==="x"
      ? {
        x1:boundary.start,
        z1:boundary.fixed,
        x2:boundary.end,
        z2:boundary.fixed,
        color:"#f59e0b",
        lineWidth:group.userData.areaId===selectedId?4:3,
      }
      : {
        x1:boundary.fixed,
        z1:boundary.start,
        x2:boundary.fixed,
        z2:boundary.end,
        color:"#f59e0b",
        lineWidth:group.userData.areaId===selectedId?4:3,
      };
  }

  drawMinimap(time){
    if(this.mode!=="walkthrough" || time-this.minimapTime<80) return;
    this.minimapTime=time;
    const canvas=this.host.querySelector("[data-gym3d-minimap]");
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const pad=12,w=canvas.width,h=canvas.height;
    const sx=(w-pad*2)/this.bounds.w,sz=(h-pad*2)/this.bounds.h,scale=Math.min(sx,sz);
    const ox=(w-this.bounds.w*scale)/2-this.bounds.minX*scale;
    const oz=(h-this.bounds.h*scale)/2-this.bounds.minY*scale;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="rgba(8,15,24,.9)";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#26313d";
    this.roomData.rects.forEach(r=>ctx.fillRect(ox+r.x*scale,oz+r.y*scale,r.w*scale,r.h*scale));
    this.roomInstances.forEach(inst=>{
      const item=getItemById(inst.itemId); if(!item)return;
      const r=effectiveRectForInst(inst,item).base;
      ctx.fillStyle=inst.id===state.layout.selectedInstId?"#f97316":"#8c99a6";
      ctx.fillRect(ox+r.x*scale,oz+r.y*scale,Math.max(2,r.w*scale),Math.max(2,r.h*scale));
    });
    this.wallFeatureGroups.forEach((group,id)=>{
      const line=this.wallFeatureMinimapLine(group,state.layout.selectedWallFeatureId);
      ctx.strokeStyle=line.color;
      ctx.lineWidth=line.lineWidth;
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(ox+line.x1*scale,oz+line.z1*scale);
      ctx.lineTo(ox+line.x2*scale,oz+line.z2*scale);
      ctx.stroke();
    });
    this.garageDoorMinimapSegments.forEach(({group})=>{
      const line=this.garageDoorMinimapLine(group,state.layout.selectedAreaId);
      if(!line) return;
      ctx.strokeStyle=line.color;
      ctx.lineWidth=line.lineWidth;
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(ox+line.x1*scale,oz+line.z1*scale);
      ctx.lineTo(ox+line.x2*scale,oz+line.z2*scale);
      ctx.stroke();
    });
    ctx.strokeStyle="#47c48a";
    ctx.lineWidth=3;
    ctx.lineCap="round";
    this.doorCollisionSegments.forEach(segment=>{
      ctx.beginPath();
      ctx.moveTo(ox+segment.x1*scale,oz+segment.z1*scale);
      ctx.lineTo(ox+segment.x2*scale,oz+segment.z2*scale);
      ctx.stroke();
    });
    const px=ox+this.camera.position.x*scale,pz=oz+this.camera.position.z*scale;
    ctx.save();ctx.translate(px,pz);ctx.rotate(-this.yaw);
    ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
  }

  resize(){
    const width=Math.max(2,this.host.clientWidth);
    const height=Math.max(2,this.host.clientHeight);
    this.renderer.setSize(width,height,false);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
  }

  rememberCamera(){
    const key=`${this.layoutId}:${this.mode}`;
    if(this.mode==="walkthrough"){
      gym3DCameraMemory.set(key,{yaw:this.yaw,pitch:this.pitch,x:this.camera.position.x,z:this.camera.position.z});
    }else{
      gym3DCameraMemory.set(key,{
        ...this.orbit,
        targetX:this.target?.x,
        targetY:this.target?.y,
        targetZ:this.target?.z,
      });
    }
  }

  animate(){
    if(this.destroyed) return;
    const now=performance.now();
    const dt=Math.min(.05,(now-this.lastTime)/1000);
    this.lastTime=now;
    this.moveWalkthrough(dt);
    if(this.mode==="walkthrough"){
      this.host.dataset.cameraX=this.camera.position.x.toFixed(3);
      this.host.dataset.cameraZ=this.camera.position.z.toFixed(3);
      this.host.dataset.cameraYaw=this.yaw.toFixed(4);
      this.host.dataset.cameraPitch=this.pitch.toFixed(4);
      this.host.dataset.walkActive=this.walkActive?"true":"false";
    }
    this.drawMinimap(now);
    this.updateWalkthroughHover(now);
    this.renderer.render(this.scene,this.camera);
    this.frame=requestAnimationFrame(()=>this.animate());
  }

  destroy(){
    if(this.destroyed) return;
    this.destroyed=true;
    this.rememberCamera();
    cancelAnimationFrame(this.frame);
    if(document.pointerLockElement===this.renderer.domElement) document.exitPointerLock?.();
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown",this.onPointerDown);
    this.startButton?.removeEventListener("click",this.onStartClick);
    window.removeEventListener("pointermove",this.onPointerMove);
    window.removeEventListener("pointerup",this.onPointerUp);
    this.renderer.domElement.removeEventListener("wheel",this.onWheel);
    this.renderer.domElement.removeEventListener("pointerleave",this.onPointerLeave);
    document.removeEventListener("keydown",this.onKeyDown);
    document.removeEventListener("keyup",this.onKeyUp);
    document.removeEventListener("pointerlockchange",this.onLockChange);
    window.removeEventListener("blur",this.onBlur);
    document.removeEventListener("visibilitychange",this.onVisibility);
    this.scene.traverse(obj=>{
      if(obj.geometry) obj.geometry.dispose?.();
    });
    this.disposables.forEach(item=>item?.dispose?.());
    this.scene.environment=null;
    this.environmentTarget?.dispose?.();
    this.environmentTarget=null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
