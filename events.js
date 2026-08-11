// Event handlers for Gym Wishlist + Layout Planner

function requestLayoutName(message,suggestedName,requestPrompt){
  const invoke=requestPrompt || ((text,defaultValue)=>window.prompt(text,defaultValue));
  try{
    return invoke(message,suggestedName);
  }catch(error){
    const unsupportedPromptMessages=new Set(["prompt() is not supported."]);
    if(unsupportedPromptMessages.has(String(error?.message||"").trim())) return suggestedName;
    throw error;
  }
}

function availableLayoutName(preferredName,layouts,excludeId=null){
  const preferred=String(preferredName||"").trim();
  if(!preferred) return "";
  const used=new Set((layouts||[])
    .filter(entry=>entry?.id!==excludeId)
    .map(entry=>String(entry?.name||"").trim().toLowerCase()));
  if(!used.has(preferred.toLowerCase())) return preferred;
  for(let suffix=2;;suffix+=1){
    const candidate=`${preferred} (${suffix})`;
    if(!used.has(candidate.toLowerCase())) return candidate;
  }
}

function normalizeImportedLayoutPayload(data,settings,items,makeId=()=>uid("ly")){
  if(Array.isArray(data.layouts)&&data.layouts.length){
    const layouts=data.layouts.map(entry=>({
      id:entry.id||makeId(),
      name:entry.name||"Layout",
      layout:normalizeNamedLayout(entry.name,entry.layout||entry.data||entry,settings,items),
    }));
    const activeLayoutId=data.activeLayoutId&&layouts.some(entry=>entry.id===data.activeLayoutId)?data.activeLayoutId:layouts[0].id;
    return {layouts,activeLayoutId,layout:layouts.find(entry=>entry.id===activeLayoutId).layout};
  }
  if(!data.layout) return null;
  const name=data.layoutName||data.name||"Layout 1";
  const id=makeId();
  const layout=normalizeNamedLayout(name,data.layout,settings,items);
  return {layouts:[{id,name,layout}],activeLayoutId:id,layout};
}

function performLayoutLibraryAction(action,appState=state,options={}){
  const requestName=options.requestName||requestLayoutName;
  const makeId=options.makeId||(()=>uid("ly"));
  const layouts=appState.layouts||[];
  const activeId=appState.activeLayoutId;

  if(action==="rename"){
    const index=layouts.findIndex(entry=>entry.id===activeId);
    if(index<0) return false;
    const requested=requestName("Rename layout:",layouts[index].name||"Layout");
    if(!String(requested||"").trim()) return false;
    layouts[index].name=availableLayoutName(requested,layouts,activeId);
    return true;
  }

  const current=normalizeLayout(deepCopy(appState.layout),appState.settings);
  const suggestion=action==="new"
    ? availableLayoutName(`Layout ${layouts.length+1}`,layouts)
    : action==="duplicate"
      ? availableLayoutName(`${layouts.find(entry=>entry.id===activeId)?.name||"Layout"} (copy)`,layouts)
      : "";
  if(!suggestion) return false;
  const promptMessage=action==="new" ? "New layout name:" : "Duplicate layout name:";
  const requested=requestName(promptMessage,suggestion);
  if(!String(requested||"").trim()) return false;
  const name=availableLayoutName(requested,layouts);
  const id=makeId("ly");
  const currentIndex=layouts.findIndex(entry=>entry.id===activeId);
  if(currentIndex>=0) layouts[currentIndex].layout=deepCopy(current);
  const layout=action==="new"
    ? normalizeLayout({
        ...DEFAULT_LAYOUT,
        wallExtensions:deepCopy(current.wallExtensions||[]),
        areas:deepCopy(current.areas||[]),
        outlets:deepCopy(current.outlets||[]),
        ceilingZones:deepCopy(current.ceilingZones||[]),
        floorZones:deepCopy(current.floorZones||[]),
        flooringPieces:deepCopy(current.flooringPieces||[]),
        wallFeatures:deepCopy(current.wallFeatures||[]),
        spatial3d:deepCopy(current.spatial3d||{}),
        instances:[],
      },appState.settings)
    : normalizeLayout(deepCopy(current),appState.settings);
  appState.layouts=[...layouts,{id,name,layout}];
  appState.activeLayoutId=id;
  appState.layout=normalizeLayout(deepCopy(layout),appState.settings);
  appState.layout.selectedInstId=null;
  appState.layout.selectedAreaId=null;
  appState.layout.selectedOutletId=null;
  appState.layout.selectedWallExtId=null;
  appState.layout.selectedCeilingZoneId=null;
  appState.layout.selectedFloorZoneId=null;
  appState.layout.selectedWallFeatureId=null;
  appState._roomCache=null;
  appState.tab="layout";
  return true;
}

function refreshInstInvalid(id){
  state.layout.instances = (state.layout.instances||[]).map(x=>{
    if(x.id!==id) return x;
    const it = getItemById(x.itemId);
    if(!it) return x;
    const er = effectiveRectForInst(x, it);
    return {...x, __invalid: isInvalidPlacement(id, er.base, er.eff)};
  });
}

function setLayoutActionStatus(instId,tone,message){
  state.layoutActionStatus={instId,tone,message};
}

function rotateLayoutInstance90(instId){
  const inst=(state.layout.instances||[]).find(x=>x.id===instId);
  const item=inst ? getItemById(inst.itemId) : null;
  if(!inst || !item){
    setLayoutActionStatus(instId,"error","That equipment is no longer in this layout.");
    render();
    return {ok:false,reason:"not-found"};
  }

  const candidate=rotatedInstanceCandidate(inst,item);
  const candidateRect=effectiveRectForInst(candidate,item);
  const conflict=hardPlacementConflict(instId,candidateRect.base);
  if(conflict){
    setLayoutActionStatus(instId,"error",conflict.message);
    render();
    return {ok:false,reason:"hard-invalid",conflict};
  }

  const invalid=isInvalidPlacement(instId,candidateRect.base,candidateRect.eff);
  const next={...candidate,__invalid:invalid};
  state.layout.instances=(state.layout.instances||[]).map(x=>x.id===instId ? next : x);
  if(invalid){
    setLayoutActionStatus(instId,"warning","Rotated 90°. Clearance overlaps another item, so it is shown in red.");
    render();
    return {ok:true,reason:"soft-conflict",instance:next};
  }

  const name=String(item.name||"").trim() || "equipment";
  setLayoutActionStatus(instId,"success",`Rotated ${name} 90°.`);
  render();
  return {ok:true,reason:"rotated",instance:next};
}

function layoutRotationShortcutAllowed(event,target=document.activeElement){
  if(event?.repeat || event?.code!=="KeyR") return false;
  if(event?.altKey || event?.ctrlKey || event?.metaKey || event?.shiftKey) return false;
  if(state.tab!=="layout" || !state.layout?.selectedInstId) return false;
  if(state.layout?.spatialViewMode==="3d" || state.layout?.walkthroughOpen) return false;
  if(state.drag?.active || document.pointerLockElement) return false;
  if(document.querySelector('dialog[open], .lightbox.open, .modalOverlay[role="dialog"][aria-modal="true"]')) return false;

  const tag=String(target?.tagName||"").toLowerCase();
  if(["input","textarea","select"].includes(tag) || target?.isContentEditable || target?.closest?.("[contenteditable='true']")) return false;
  return true;
}

function wireLayoutRotationShortcut(){
  if(typeof window==="undefined" || window.__layoutRotationShortcutWired) return;
  window.__layoutRotationShortcutWired=true;
  window.addEventListener("keydown",event=>{
    if(!layoutRotationShortcutAllowed(event,event.target||document.activeElement)) return;
    event.preventDefault();
    rotateLayoutInstance90(state.layout.selectedInstId);
  });
}

wireLayoutRotationShortcut();

function wallFeatureDragPatch(feature, originStartFt, deltaFt, roomData){
  const maxStart=Math.max(0,GymWallFeatures.wallLength(feature, roomData)-GymWallFeatures.width(feature));
  const parts=splitTotalFtToFtIn(clamp(safeNum(originStartFt)+safeNum(deltaFt),0,maxStart));
  return {startFt:parts.ft,startIn:parts.inch};
}

function resetWallFeatureDrag(){
  if(!state.drag || state.drag.type!=="wallfeature") return;
  const handlers=state._wallFeatureDragHandlers;
  if(handlers){
    window.removeEventListener("pointermove",handlers.move);
    window.removeEventListener("pointerup",handlers.finish);
    window.removeEventListener("pointercancel",handlers.finish);
    window.removeEventListener("lostpointercapture",handlers.finish,true);
    state._wallFeatureDragHandlers=null;
  }
  state.drag={active:false,type:null,id:null,start:{x:0,y:0},origin:{x:0,y:0},invalid:false};
  render();
}

function startWallFeatureDrag(pointerId){
  const move=(event)=>{
    if(event.pointerId!==pointerId || !state.drag?.active || state.drag.type!=="wallfeature") return;
    const svg=$("#layoutSvg");
    const feature=(state.layout.wallFeatures||[]).find(x=>x.id===state.drag.id);
    if(!svg || !feature){ resetWallFeatureDrag(); return; }
    const point=clientToSvgPoint(svg,event.clientX,event.clientY);
    const delta=(feature.wall==="top" || feature.wall==="bottom")
      ? point.x-state.drag.start.x
      : point.y-state.drag.start.y;
    patchWallFeature(feature.id,wallFeatureDragPatch(feature,state.drag.origin.startFt,delta,wallFeatureRoomData(state.layout,state.settings)));
  };
  const finish=(event)=>{
    if(event.type!=="lostpointercapture" && event.pointerId!==pointerId) return;
    resetWallFeatureDrag();
  };
  state._wallFeatureDragHandlers={move,finish};
  window.addEventListener("pointermove",move);
  window.addEventListener("pointerup",finish);
  window.addEventListener("pointercancel",finish);
  window.addEventListener("lostpointercapture",finish,true);
}

/** "+ in" buttons: set a sub-foot inch field to 1 so the inch input appears. */
function applyLayoutShowIn(dim, id){
  const d = String(dim||"");
  if(!id) return;
  if(d==="inst_x"){ state.layout.instances = (state.layout.instances||[]).map(x=> x.id===id ? {...x, xIn:1} : x); refreshInstInvalid(id); }
  else if(d==="inst_y"){ state.layout.instances = (state.layout.instances||[]).map(x=> x.id===id ? {...x, yIn:1} : x); refreshInstInvalid(id); }
  else if(d==="inst_ds"){ state.layout.instances = (state.layout.instances||[]).map(x=> x.id===id ? {...x, deadspaceFt:0, deadspaceIn:1} : x); refreshInstInvalid(id); }
  else if(d==="area_x"){ state.layout.areas = (state.layout.areas||[]).map(a=> a.id===id ? {...a, xIn:1} : a); }
  else if(d==="area_y"){ state.layout.areas = (state.layout.areas||[]).map(a=> a.id===id ? {...a, yIn:1} : a); }
  else if(d==="area_w"){ state.layout.areas = (state.layout.areas||[]).map(a=> a.id===id ? {...a, widthIn:1} : a); }
  else if(d==="area_h"){ state.layout.areas = (state.layout.areas||[]).map(a=> a.id===id ? {...a, heightIn:1} : a); }
  else if(d==="area_door_r"){ state.layout.areas = (state.layout.areas||[]).map(a=> a.id===id ? {...a, doorRadiusFt:0, doorRadiusIn:1} : a); }
  else if(d==="out_x"){ state.layout.outlets = (state.layout.outlets||[]).map(o=> o.id===id ? {...o, xIn:1} : o); }
  else if(d==="out_y"){ state.layout.outlets = (state.layout.outlets||[]).map(o=> o.id===id ? {...o, yIn:1} : o); }
  else if(d==="fz_x"){ state.layout.floorZones = (state.layout.floorZones||[]).map(z=> z.id===id ? {...z, xIn:1} : z); }
  else if(d==="fz_y"){ state.layout.floorZones = (state.layout.floorZones||[]).map(z=> z.id===id ? {...z, yIn:1} : z); }
  else if(d==="fz_w"){ state.layout.floorZones = (state.layout.floorZones||[]).map(z=> z.id===id ? {...z, widthIn:1} : z); }
  else if(d==="fz_d"){ state.layout.floorZones = (state.layout.floorZones||[]).map(z=> z.id===id ? {...z, heightIn:1} : z); }
  else if(d==="fp_x"){ state.layout.flooringPieces = (state.layout.flooringPieces||[]).map(f=> f.id===id ? {...f, xIn:1} : f); }
  else if(d==="fp_y"){ state.layout.flooringPieces = (state.layout.flooringPieces||[]).map(f=> f.id===id ? {...f, yIn:1} : f); }
  else if(d==="cz_ceiling"){ state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, ceilingHeightIn:1} : z); }
  else if(d==="cz_x"){ state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, xIn:1} : z); }
  else if(d==="cz_y"){ state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, yIn:1} : z); }
  else if(d==="cz_w"){ state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, widthIn:1} : z); }
  else if(d==="cz_h"){ state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, heightIn:1} : z); }
  else if(d==="we_start"){ state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=> w.id===id ? {...w, startIn:1} : w); state._roomCache = null; }
  else if(d==="we_length"){ state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=> w.id===id ? {...w, lengthIn:1} : w); state._roomCache = null; }
  else if(d==="we_depth"){ state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=> w.id===id ? {...w, depthIn:1} : w); state._roomCache = null; }
  else if(d==="wf_start"){ patchWallFeature(id, {startIn:1}); return; }
  else if(d==="wf_bottom"){ patchWallFeature(id, {bottomIn:1}); return; }
  else if(d==="wf_width"){ patchWallFeature(id, {widthIn:1}); return; }
  else if(d==="wf_height"){ patchWallFeature(id, {heightIn:1}); return; }
  render();
}

const PENDING_MODEL_ASSET_KEY="gym_planner_pending_model_asset_ref";
let pendingDraftModelAssetRef="";

function setPendingDraftModelAsset(ref){
  pendingDraftModelAssetRef=String(ref||"");
  try{
    if(pendingDraftModelAssetRef) localStorage.setItem(PENDING_MODEL_ASSET_KEY,pendingDraftModelAssetRef);
    else localStorage.removeItem(PENDING_MODEL_ASSET_KEY);
  }catch{}
}

function emptyModelAssetFields(){
  return {
    model3dAssetRef:"",
    model3dAssetName:"",
    model3dAssetSize:0,
    model3dAssetUpdatedAt:0,
    model3dAssetRotation:0,
  };
}

function normalizedModelAssetRotation(value){
  const rotation=Number(value);
  return [0,90,180,270].includes(rotation) ? rotation : 0;
}

function modelAssetIsReferenced(ref){
  const value=String(ref||"");
  return !!value && (state.items||[]).some(item=>String(item.model3dAssetRef||"")===value);
}

function removeUnreferencedModelAsset(ref){
  const value=String(ref||"");
  if(!value.startsWith("local:") || modelAssetIsReferenced(value)) return Promise.resolve();
  const api=window.GymModelAssets;
  return api?.remove ? api.remove(value).catch(()=>{}) : Promise.resolve();
}

function discardPendingDraftModelAsset(){
  const ref=pendingDraftModelAssetRef;
  setPendingDraftModelAsset("");
  if(ref) removeUnreferencedModelAsset(ref);
}

try{
  const stalePendingRef=localStorage.getItem(PENDING_MODEL_ASSET_KEY)||"";
  localStorage.removeItem(PENDING_MODEL_ASSET_KEY);
  if(stalePendingRef) removeUnreferencedModelAsset(stalePendingRef);
}catch{}

function removeItemReferencesFromAllLayouts(removeIds){
  const ids=removeIds instanceof Set ? removeIds : new Set(removeIds||[]);
  if(!ids.size) return;
  const cleanLayout=(layout)=>{
    if(!layout || typeof layout!=="object") return layout;
    const removedInstanceIds=new Set((layout.instances||[]).filter(inst=>ids.has(inst.itemId)).map(inst=>inst.id));
    return {
      ...layout,
      instances:(layout.instances||[]).filter(inst=>!ids.has(inst.itemId)),
      compareSets:(layout.compareSets||[]).map(set=>({
        ...set,
        items:(set.items||[]).filter(entry=>!ids.has(typeof entry==="string" ? entry : entry?.itemId)),
      })),
      selectedInstId:removedInstanceIds.has(layout.selectedInstId) ? null : layout.selectedInstId,
    };
  };
  state.layout=cleanLayout(state.layout);
  if(Array.isArray(state.layouts)){
    state.layouts=state.layouts.map(entry=>{
      if(!entry || typeof entry!=="object") return entry;
      if(entry.id===state.activeLayoutId) return {...entry,layout:deepCopy(state.layout)};
      return {...entry,layout:cleanLayout(entry.layout)};
    });
  }
}

async function uploadModelAssetFile(file){
  const api=window.GymModelAssets;
  if(!api?.put) throw new Error("Local 3D model storage is not ready. Refresh the page and try again.");
  return api.put(file);
}

async function attachModelAssetToItem(itemId,file){
  const current=(state.items||[]).find(item=>item.id===itemId);
  if(!current || !file) return;
  const stored=await uploadModelAssetFile(file);
  const latest=(state.items||[]).find(item=>item.id===itemId);
  if(!latest){
    await removeUnreferencedModelAsset(stored.ref);
    return;
  }
  const previousRef=String(latest.model3dAssetRef||"");
  const patch={
    model3dAssetRef:stored.ref,
    model3dAssetName:stored.name,
    model3dAssetSize:stored.size,
    model3dAssetUpdatedAt:stored.updatedAt,
    model3dAssetRotation:0,
  };
  state.items=(state.items||[]).map(item=>item.id===itemId ? {...item,...patch} : item);
  if(state.editingId===itemId) state.draft={...state.draft,...patch};
  render();
  if(previousRef && previousRef!==stored.ref) removeUnreferencedModelAsset(previousRef);
}

function detachModelAssetFromItem(itemId){
  const current=(state.items||[]).find(item=>item.id===itemId);
  if(!current) return;
  const previousRef=String(current.model3dAssetRef||"");
  const patch=emptyModelAssetFields();
  state.items=(state.items||[]).map(item=>item.id===itemId ? {...item,...patch} : item);
  if(state.editingId===itemId) state.draft={...state.draft,...patch};
  render();
  removeUnreferencedModelAsset(previousRef);
}

async function attachModelAssetToDraft(file){
  if(!file) return;
  const stored=await uploadModelAssetFile(file);
  const previousPending=pendingDraftModelAssetRef;
  setPendingDraftModelAsset(stored.ref);
  state.draft={
    ...state.draft,
    model3dAssetRef:stored.ref,
    model3dAssetName:stored.name,
    model3dAssetSize:stored.size,
    model3dAssetUpdatedAt:stored.updatedAt,
    model3dAssetRotation:0,
  };
  render();
  if(previousPending && previousPending!==stored.ref) removeUnreferencedModelAsset(previousPending);
}

function detachModelAssetFromDraft(){
  const currentRef=String(state.draft?.model3dAssetRef||"");
  const removePending=currentRef && currentRef===pendingDraftModelAssetRef;
  if(removePending) setPendingDraftModelAsset("");
  state.draft={...state.draft,...emptyModelAssetFields()};
  render();
  if(removePending) removeUnreferencedModelAsset(currentRef);
}

function readDraftFromForm(){
  const get = (id)=> ($("#"+id)?.value ?? "");
  const rotationInput=get("f_model3dAssetRotation");
  const assetRotation=normalizedModelAssetRotation(rotationInput==="" ? state.draft.model3dAssetRotation : rotationInput);
  const payload = {
    name: String(get("f_name")).trim(),
    brand: String(get("f_brand")||"").trim(),
    category: String(get("f_category")).trim() || "Custom",
    status: String(get("f_status")) || "Researching",
    priority: String(get("f_priority")) || "Nice-to-have",
    qty: Math.max(0, Math.floor(safeNum(get("f_qty")))),
    unit: (["in","cm","ft"].includes(get("f_unit")) ? get("f_unit") : "in"),
    length: get("f_length")==="" ? "" : safeNum(get("f_length")),
    width: get("f_width")==="" ? "" : safeNum(get("f_width")),
    height: get("f_height")==="" ? "" : safeNum(get("f_height")),
    lengthIn: get("f_unit")==="ft" ? (get("f_lengthIn")==="" ? "" : safeNum(get("f_lengthIn"))) : "",
    widthIn: get("f_unit")==="ft" ? (get("f_widthIn")==="" ? "" : safeNum(get("f_widthIn"))) : "",
    heightIn: get("f_unit")==="ft" ? (get("f_heightIn")==="" ? "" : safeNum(get("f_heightIn"))) : "",
    requiredCeilingFt: get("f_requiredCeilingFt")==="" ? "" : safeNum(get("f_requiredCeilingFt")),
    powerVoltage: String(get("f_powerVoltage")||"").trim(),
    powerAmps: get("f_powerAmps")==="" ? "" : safeNum(get("f_powerAmps")),
    outletNotes: String(get("f_outletNotes")||""),
    price: safeNum(get("f_price")),
    fees: safeNum(get("f_fees")),
    productLink: String(get("f_productLink")).trim(),
    notes: String(get("f_notes")||""),
    rackHolePattern: String(get("f_rackHolePattern")||""),
    rackCustomSpec: String(get("f_rackCustomSpec")||""),
    equipmentTags: (Array.isArray(state.draft.equipmentTags) ? state.draft.equipmentTags : []).filter(t=> ITEM_BODY_PART_TAGS.includes(t)),
    isRack: !!$("#f_isRack")?.checked,
    rackPosts: String($("#f_rackPosts")?.value || "4-post"),
    rackHeight: safeNum(get("f_rackHeight")),
    rackUprightSize: String(get("f_rackUprightSize")||""),
    rackHoleDiameter: String(get("f_rackHoleDiameter")||""),
    rackCrossmemberDepth: safeNum(get("f_rackCrossmemberDepth")),
    rackOutsideWidth: safeNum(get("f_rackOutsideWidth")),
    rackTotalLength: safeNum(get("f_rackTotalLength")),
    isRackAttachment: !!$("#f_isRackAttachment")?.checked,
    attachToRackId: String(get("f_attachToRackId")||""),
    storesEquipment: !!$("#f_storesEquipment")?.checked,
    storageLength: safeNum(get("f_storageLength")),
    storageWidth: safeNum(get("f_storageWidth")),
    storageHeight: safeNum(get("f_storageHeight")),
    equipmentTypes: (Array.isArray(state.draft.equipmentTypes) ? state.draft.equipmentTypes : []).filter(t=> EQUIPMENT_TYPES.includes(t)),
    color: String(state.draft.color || ""),
    layoutUseImage: !!$("#f_layoutUseImage")?.checked,
    layoutImageDataUrl: String(state.draft.layoutImageDataUrl || ""),
    model3dFamily: MODEL3D_FAMILIES.some(x=>x.value===get("f_model3dFamily")) ? get("f_model3dFamily") : "auto",
    model3dProfile: MODEL3D_PROFILES.some(x=>x.value===get("f_model3dProfile")) ? get("f_model3dProfile") : "auto",
    model3dFacing: get("f_model3dFacing")==="reverse" ? "reverse" : "default",
    model3dAssetRef: String(state.draft.model3dAssetRef||""),
    model3dAssetName: String(state.draft.model3dAssetName||"").slice(0,180),
    model3dAssetSize: Math.max(0,safeNum(state.draft.model3dAssetSize)),
    model3dAssetUpdatedAt: Math.max(0,safeNum(state.draft.model3dAssetUpdatedAt)),
    model3dAssetRotation: assetRotation,
  };
  return payload;
}

async function autoFillFromUrl(url){
  const provider = state.settings.aiProvider;
  const apiKey = headerValueLatin1(String(state.settings.aiApiKey || "")).trim();

  if(!provider || provider==="none" || !apiKey){
    alert("Please configure AI provider and API key in Settings first.");
    return null;
  }

  function buildReadableProxyUrl(rawUrl){
    try{
      const u = new URL(rawUrl);
      return `https://r.jina.ai/http://${u.host}${u.pathname}${u.search}`;
    }catch{
      return "";
    }
  }

  function cleanPageText(text){
    return String(text||"")
      .replace(/\r/g, "")
      .replace(/[“”]/g, '"')
      .replace(/[′’]/g, "'")
      .replace(/[″]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ");
  }

  async function fetchProductPageText(rawUrl){
    const proxyUrl = buildReadableProxyUrl(rawUrl);
    if(!proxyUrl) return "";
    try{
      const res = await fetch(proxyUrl, {
        headers: {
          "Accept": headerValueLatin1("text/plain, text/markdown, text/html"),
          "X-Respond-With": headerValueLatin1("text"),
        }
      });
      if(!res.ok) return "";
      const text = await res.text();
      return cleanPageText(text);
    }catch{
      return "";
    }
  }

  function extractJsonObject(text){
    const match = String(text||"").match(/\{[\s\S]*\}/);
    if(!match) return null;
    try{ return JSON.parse(match[0]); }catch{ return null; }
  }

  function toInchesToken(token){
    const s = String(token||"").trim().toLowerCase();
    if(!s) return 0;

    const feetInches = s.match(/(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch|inches)?/);
    if(feetInches){
      const ft = safeNum(feetInches[1]);
      const inches = safeNum(feetInches[2] || 0);
      return round1(ft * 12 + inches);
    }

    if(/\bft\b|\bfeet\b|'/.test(s)) return round1(safeNum(s) * 12);
    if(/\bcm\b/.test(s)) return round1(safeNum(s) / 2.54);
    return round1(safeNum(s));
  }

  function extractDimensionsFromText(text){
    const src = cleanPageText(text);
    const candidates = [];
    const triple = /((?:\d+(?:\.\d+)?\s*'\s*\d*(?:\.\d+)?\s*"?|\d+(?:\.\d+)?\s*(?:"|in|inch|inches|ft|feet)?))\s*(?:l|w|d|h|length|width|depth|height)?\s*[x×]\s*((?:\d+(?:\.\d+)?\s*'\s*\d*(?:\.\d+)?\s*"?|\d+(?:\.\d+)?\s*(?:"|in|inch|inches|ft|feet)?))\s*(?:l|w|d|h|length|width|depth|height)?\s*[x×]\s*((?:\d+(?:\.\d+)?\s*'\s*\d*(?:\.\d+)?\s*"?|\d+(?:\.\d+)?\s*(?:"|in|inch|inches|ft|feet)?))/ig;
    let match;
    while((match = triple.exec(src))){
      const start = Math.max(0, match.index - 120);
      const end = Math.min(src.length, match.index + match[0].length + 120);
      const context = src.slice(start, end).toLowerCase();
      let score = 0;
      if(/\bdim|\bsize|\bfootprint|\boverall|\bwidth|\bdepth|\blength|\bheight/.test(context)) score += 3;
      if(/\bpackage|\bshipping|\bbox\b/.test(context)) score -= 2;
      if(/\brack\b|\bmachine\b|\btrainer\b|\bsmith\b/.test(context)) score += 1;
      const length = toInchesToken(match[1]);
      const width = toInchesToken(match[2]);
      const height = toInchesToken(match[3]);
      if(length > 0 && width > 0 && height > 0){
        candidates.push({ length, width, height, score, raw: match[0] });
      }
    }
    candidates.sort((a,b)=> b.score - a.score);
    return candidates[0] || null;
  }

  function extractDimensionHints(text){
    const src = cleanPageText(text);
    const getNum = (re)=>{
      const m = src.match(re);
      return m ? round1(safeNum(m[1])) : 0;
    };

    let length = 0;
    let width = 0;
    let height = 0;

    length = getNum(/\bfootprint\s+depth\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*"/i) ||
      getNum(/\bdepth\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*"/i) ||
      getNum(/\bfootprint\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*"/i);

    width = getNum(/\boverall\s+width\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*"/i) ||
      getNum(/\bwidth\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*"/i);

    if(!width && /\b42"\s+pull up bar\b/i.test(src)) width = 42;
    if(!width && /\b42"\s+black crossbar\b/i.test(src)) width = 42;

    height = getNum(/\btotal\s+height\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*"/i) ||
      getNum(/\bceiling is lower than (\d+(?:\.\d+)?)"/i) ||
      getNum(/\b(\d+(?:\.\d+)?)"\s+rack\b/i);

    if(length || width || height) return { length, width, height };
    return null;
  }

  function detectRackHolePattern(text){
    const s = cleanPageText(text).toLowerCase();
    const has = (re)=> re.test(s);
    if((has(/3\s*["x]\s*3|3\s*x\s*3/) || has(/3x3/)) && has(/11[- ]?gauge/) && has(/\b1[" -]?(?:inch)?\s+holes?|\b1-inch holes?/) && has(/\b2[" -]?(?:inch)?\s+spacing|\b2-inch spacing/)) return "3x3_11g_1in_2in";
    if((has(/3\s*["x]\s*3|3\s*x\s*3/) || has(/3x3/)) && has(/11[- ]?gauge/) && has(/⅝|5\/8|\b0\.625/) && has(/\b1[" -]?(?:inch)?\s+spacing|\b1-inch spacing/)) return "3x3_11g_5_8in_1in";
    if((has(/3\s*["x]\s*3|3\s*x\s*3/) || has(/3x3/)) && has(/11[- ]?gauge/) && has(/\b1[" -]?(?:inch)?\s+holes?|\b1-inch holes?/) && has(/\b1[" -]?(?:inch)?\s+spacing|\b1-inch spacing/)) return "3x3_11g_1in_1in";
    if((has(/2\s*["x]\s*3|2\s*x\s*3/) || has(/2x3/)) && has(/11[- ]?gauge/) && has(/\b1[" -]?(?:inch)?\s+holes?|\b1-inch holes?/) && has(/\b2[" -]?(?:inch)?\s+spacing|\b2-inch spacing/)) return "2x3_11g_1in_2in";
    if((has(/2\s*["x]\s*3|2\s*x\s*3/) || has(/2x3/)) && has(/11[- ]?gauge/) && has(/⅝|5\/8|\b0\.625/) && has(/\b1[" -]?(?:inch)?\s+spacing|\b1-inch spacing/)) return "2x3_11g_5_8in_1in";
    if((has(/2\s*["x]\s*2|2\s*x\s*2/) || has(/2x2/)) && has(/12[- ]?gauge/) && has(/\b1[" -]?(?:inch)?\s+holes?|\b1-inch holes?/) && has(/\b2[" -]?(?:inch)?\s+spacing|\b2-inch spacing/)) return "2x2_12g_1in_2in";
    return "";
  }

  function extractFirstPrice(text){
    const matches = [...String(text||"").matchAll(/\$ ?(\d[\d,]*(?:\.\d{2})?)/g)];
    if(!matches.length) return 0;
    const nums = matches.map(m=> safeNum(String(m[1]).replace(/,/g, ""))).filter(x=>x>0);
    return nums.length ? nums.sort((a,b)=>b-a)[0] : 0;
  }

  function extractInterestingNotes(text, dims, holePatternId){
    const s = cleanPageText(text);
    const lines = s.split("\n").map(x=>x.trim()).filter(Boolean);
    const out = [];
    const seen = new Set();
    const add = (line)=>{
      const val = String(line||"").trim();
      const key = val.toLowerCase();
      if(!val || seen.has(key)) return;
      seen.add(key);
      out.push(val);
    };

    if(dims && dims.length && dims.width && dims.height){
      add(`Overall dimensions: ${round1(dims.length)}" L x ${round1(dims.width)}" W x ${round1(dims.height)}" H`);
    }else if(dims){
      const parts = [];
      if(dims.length) parts.push(`${round1(dims.length)}" length/depth`);
      if(dims.width) parts.push(`${round1(dims.width)}" width`);
      if(dims.height) parts.push(`${round1(dims.height)}" height`);
      if(parts.length) add(`Dimensions found: ${parts.join(", ")}.`);
    }

    if(holePatternId){
      const spec = RACK_HOLE_PATTERNS.find(x=>x.id===holePatternId);
      if(spec) add(`Rack spec: ${spec.label}.`);
    }

    const keywordMatchers = [
      /\b3"\s*x\s*3"|\b3x3\b|\b2x3\b|\b2x2\b/i,
      /\b11-gauge\b|\b12-gauge\b/i,
      /\b1-inch holes?\b|\b5\/8\b|⅝|\bhole/i,
      /\b2-inch spacing\b|\b1-inch spacing\b|\bspacing\b/i,
      /\bweight capacity\b|\b1400\+?\s*lb/i,
      /\b48\s*lb\b|\b28mm\b|\b13 inches\b|\bsmith bar\b/i,
      /\b2:1\b|\bweight ratio\b/i,
      /\bfunctional trainer\b|\bhalf rack\b|\bcompact footprint\b/i,
      /\b94"\b|\b86"\b|\b32"\b|\b6'6"\b|\b6\.8"/i,
    ];

    for(const line of lines){
      if(out.length >= 7) break;
      if(keywordMatchers.some(re=>re.test(line))) add(line);
    }

    return out.join("\n");
  }

  const pageText = await fetchProductPageText(url);
  const dimsFromText = extractDimensionsFromText(pageText);
  const hintedDims = extractDimensionHints(pageText);
  const priceFromText = extractFirstPrice(pageText);
  const rackHolePatternFromText = detectRackHolePattern(pageText);

  const pageExcerpt = pageText ? pageText.slice(0, 18000) : "";
  const prompt = `Extract gym equipment product information from the page content below. Prefer the page content over guessing from the URL.

Return ONLY a JSON object with these fields:
{
  "name": "product name",
  "brand": "brand name",
  "category": "exact string from allowed list below",
  "unit": "in, cm, or ft",
  "length": number,
  "width": number,
  "height": number,
  "price": number,
  "powerVoltage": "120V or 240V or empty if no power needed",
  "rackHolePattern": "one of: 3x3_11g_1in_2in, 3x3_11g_5_8in_1in, 3x3_11g_1in_1in, 2x3_11g_1in_2in, 2x3_11g_5_8in_1in, 2x2_12g_1in_2in, custom, or empty",
  "rackCustomSpec": "custom rack spec if pattern is not one of the presets",
  "notes": "short notes including rack dimensions, hole size, spacing, and important specs"
}

Rules:
- Allowed categories (use exact spelling): ${EQUIPMENT_CATEGORIES.join(", ")}.
- Use the equipment's overall product dimensions, not shipping box dimensions.
- If the page uses depth instead of width, map depth to width.
- If dimensions are in inches, set unit to "in".
- If this is a rack/cage/rig/smith machine, include tubing size, gauge, hole size, and hole spacing in notes.
- If a field is missing, use empty string.

URL: ${url}

PAGE CONTENT:
${pageExcerpt || "(page text unavailable)"}
`;

  try {
    let result;
    
    if(provider === "gemini"){
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });
      
      if(!response.ok){
        const err = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${err}`);
      }
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      result = extractJsonObject(text);
    } else if(provider === "openai"){
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      
      if(!response.ok){
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
      }
      
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      result = extractJsonObject(text);
    }

    result = result || {};

    const merged = {
      ...result,
      unit: String(result.unit || "").trim() || ((dimsFromText || hintedDims) ? "in" : ""),
      length: safeNum(result.length) || (dimsFromText ? dimsFromText.length : safeNum(hintedDims?.length)),
      width: safeNum(result.width) || (dimsFromText ? dimsFromText.width : safeNum(hintedDims?.width)),
      height: safeNum(result.height) || (dimsFromText ? dimsFromText.height : safeNum(hintedDims?.height)),
      price: safeNum(result.price) || priceFromText,
      rackHolePattern: String(result.rackHolePattern || "").trim() || rackHolePatternFromText,
      notes: String(result.notes || "").trim(),
    };

    const noteDims = dimsFromText || hintedDims;
    const fallbackNotes = extractInterestingNotes(pageText, noteDims, merged.rackHolePattern);
    if(fallbackNotes){
      merged.notes = merged.notes ? `${merged.notes}\n\n${fallbackNotes}` : fallbackNotes;
    }

    if(merged.category && isRackCategory(merged.category) && !merged.rackHolePattern && /hole|spacing|gauge|3x3|2x3|2x2|smith|rack|rig|cage/i.test(pageText)){
      merged.rackHolePattern = rackHolePatternFromText;
    }

    if(!merged.category && /rack|rig|cage|smith/i.test(pageText)) merged.category = "Racks & Cages";

    const catStr = String(merged.category||"").trim();
    const catMatch = EQUIPMENT_CATEGORIES.find(x=>x.toLowerCase()===catStr.toLowerCase());
    merged.category = catMatch || inferCategory(String(merged.name||"")+" "+String(merged.notes||"")+" "+pageText.slice(0,1200));

    if(!merged.brand && /get rxd|getrxd/i.test(pageText)) merged.brand = "Get RXd";

    return merged;
  } catch(err) {
    console.error("Auto-fill error:", err);
    alert(`Auto-fill failed: ${err.message}`);
    return null;
  }
}

async function compareItemsWithAI(itemIds, customPrompt){
  const provider = state.settings.aiProvider;
  const apiKey = headerValueLatin1(String(state.settings.aiApiKey || "")).trim();

  if(!provider || provider === "none" || !apiKey){
    alert("Please configure AI provider and API key in Settings first.");
    return null;
  }

  const items = itemIds.map(id => state.items.find(x => x.id === id)).filter(Boolean);
  if(items.length < 2){
    alert("Select at least 2 items to compare.");
    return null;
  }

  const currency = state.settings.currency || "USD";

  const itemDescriptions = items.map((item, i) => {
    const fp = footprint(item);
    const tc = totalCost(item);
    const lines = [
      `ITEM ${i+1}: ${item.name}${item.brand ? ` (${item.brand})` : ""}`,
      `Category: ${item.category || "—"}`,
      `Status: ${item.status || "—"}`,
      `Priority: ${item.priority || "—"}`,
      `Price: ${money(tc, currency)}`,
      `Qty: ${Math.max(0, Math.floor(safeNum(item.qty)))}`,
    ];
    if(fp.L && fp.W){
      lines.push(`Dimensions: ${formatFtIn(fp.L)} L × ${formatFtIn(fp.W)} W${fp.H ? ` × ${formatFtIn(fp.H)} H` : ""} (${round1(fp.L)}×${round1(fp.W)}${fp.H?`×${round1(fp.H)}`:""} ft)`);
    }
    if(item.requiredCeilingFt) lines.push(`Required ceiling: ${item.requiredCeilingFt} ${item.unit || "in"}`);
    if(item.powerVoltage && item.powerVoltage !== "None" && item.powerVoltage !== ""){
      lines.push(`Power: ${item.powerVoltage}${item.powerAmps ? `, ${item.powerAmps}A` : ""}`);
    }
    if(item.rackHolePattern) lines.push(`Rack hole pattern: ${item.rackHolePattern}`);
    if(item.rackCustomSpec) lines.push(`Rack custom spec: ${item.rackCustomSpec}`);
    if(Array.isArray(item.equipmentTags) && item.equipmentTags.length){
      lines.push(`Muscle groups: ${item.equipmentTags.join(", ")}`);
    }
    if(item.productLink) lines.push(`Product link: ${item.productLink}`);
    if(item.notes) lines.push(`Notes:\n${item.notes}`);
    return lines.join("\n");
  }).join("\n\n---\n\n");

  const fullPrompt = `${customPrompt || DEFAULT_COMPARE_PROMPT}\n\nITEMS TO COMPARE:\n\n${itemDescriptions}`;

  try {
    let text = "";

    if(provider === "gemini"){
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });
      if(!response.ok){
        const err = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${err}`);
      }
      const data = await response.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if(provider === "openai"){
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.2,
        })
      });
      if(!response.ok){
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
      }
      const data = await response.json();
      text = data.choices?.[0]?.message?.content || "";
    }

    // Strip markdown code fences if AI wrapped in ```html ... ``` etc.
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();

    return text || "<p>No comparison result returned.</p>";
  } catch(err){
    console.error("Compare error:", err);
    alert(`AI comparison failed: ${err.message}`);
    return null;
  }
}

function exportDateTag(){
  return new Date().toISOString().slice(0,10);
}

function slugifyFilePart(s){
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "layout";
}

function syncedLayoutsForExport(){
  const lib = Array.isArray(state.layouts) ? deepCopy(state.layouts) : [];
  const idx = lib.findIndex(x=>x.id===state.activeLayoutId);
  if(idx >= 0) lib[idx].layout = normalizeLayout(deepCopy(state.layout), state.settings);
  return lib;
}

function settingsForExport(){
  const settings=deepCopy(state.settings||{});
  delete settings.aiApiKey;
  return settings;
}

function exportPayloadFromState(){
  const mode = state.exportMode || "full";
  const scope = state.exportLayoutScope === "all" ? "all" : "active";
  const allLayouts = syncedLayoutsForExport();
  const activeEntry = allLayouts.find(x=>x.id===state.activeLayoutId) || allLayouts[0] || { id: uid("ly"), name: "Layout 1", layout: normalizeLayout(state.layout, state.settings) };
  const selectedLayouts = scope === "all" ? allLayouts : [activeEntry];
  const exportSettings=settingsForExport();

  if(mode === "noLayouts"){
    return {
      filename: `gym-planner-no-layouts-${exportDateTag()}.json`,
      payload: {
        version: 13,
        exportType: "noLayouts",
        exportedAt: new Date().toISOString(),
        tab: state.tab,
        settings: exportSettings,
        categories: state.categories,
        items: state.items,
      },
    };
  }

  if(mode === "layoutsOnly"){
    const filePart = scope === "all" ? "all-layouts" : slugifyFilePart(activeEntry.name);
    return {
      filename: `gym-planner-layouts-${filePart}-${exportDateTag()}.json`,
      payload: {
        version: 13,
        exportType: "layoutsOnly",
        exportedAt: new Date().toISOString(),
        settings: exportSettings,
        categories: state.categories,
        items: state.items,
        layout: normalizeLayout(deepCopy(activeEntry.layout), state.settings),
        layouts: selectedLayouts,
        activeLayoutId: activeEntry.id,
      },
    };
  }

  const filePart = scope === "all" ? "all-layouts" : slugifyFilePart(activeEntry.name);
  return {
    filename: `gym-planner-export-${filePart}-${exportDateTag()}.json`,
    payload: {
      version: 13,
      exportType: "full",
      exportedAt: new Date().toISOString(),
      tab: state.tab,
      settings: exportSettings,
      categories: state.categories,
      items: state.items,
      layout: normalizeLayout(deepCopy(activeEntry.layout), state.settings),
      layouts: selectedLayouts,
      activeLayoutId: activeEntry.id,
    },
  };
}

function downloadJsonExport(filename, payload){
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Opens a modal listing every HTML-import batch (most recent first) with a
// checkbox per batch + "Select all" / "Select latest". The caller's onConfirm
// callback receives the array of batch IDs the user chose to delete. Pure DOM,
// no state changes of its own — keeps this feature isolated from render().
function openImportBatchPicker(onConfirm){
  const batches = getImportBatches();
  if(!batches.length){
    alert("No HTML-imported items were found.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "modalOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const totalCount = batches.reduce((s,b)=> s + b.count, 0);
  const rowsHtml = batches.map((b, i)=>{
    const label = escapeHtml(formatImportBatchLabel(b));
    const metaParts = [];
    if(b.file) metaParts.push(escapeHtml(b.file));
    if(b.brands && b.brands.length) metaParts.push(escapeHtml(b.brands.join(", ")));
    const meta = metaParts.join(" • ");
    const sample = (b.sampleNames || []).slice(0,3).map(n=> escapeHtml(n)).join(" · ");
    const sampleMore = b.count > 3 ? ` +${b.count - 3} more` : "";
    const checked = i === 0 ? " checked" : ""; // pre-select latest batch
    return `
      <label class="batchRow${i===0?' selected':''}" data-batch-id="${escapeAttr(b.id)}">
        <input type="checkbox" data-batch-checkbox value="${escapeAttr(b.id)}"${checked}>
        <div class="batchBody">
          <div class="batchTitle">${label}</div>
          ${meta ? `<div class="batchMeta">${meta}</div>` : ``}
          ${sample ? `<div class="batchSample">${sample}${escapeHtml(sampleMore)}</div>` : ``}
        </div>
        <div class="batchCount">${b.count} item${b.count===1?"":"s"}</div>
      </label>
    `;
  }).join("");

  overlay.innerHTML = `
    <div class="modalCard" role="document">
      <div class="hd">
        <div>
          <div class="h1">Delete imported items</div>
          <div class="h2">${batches.length} import batch${batches.length===1?"":"es"} — ${totalCount} total imported item${totalCount===1?"":"s"}</div>
        </div>
        <button type="button" class="btn ghost" data-batch-close aria-label="Close">✕</button>
      </div>
      <div class="bd">
        <div class="row" style="padding:6px 8px 2px; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn ghost" data-batch-select-all>Select all</button>
          <button type="button" class="btn ghost" data-batch-select-none>Clear</button>
          <button type="button" class="btn ghost" data-batch-select-latest>Select latest only</button>
        </div>
        ${rowsHtml}
      </div>
      <div class="ft">
        <div class="muted" style="font-size:12px; margin-right:auto;" data-batch-summary></div>
        <button type="button" class="btn" data-batch-close>Cancel</button>
        <button type="button" class="btn danger" data-batch-confirm>Delete selected</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const getChecked = ()=> Array.from(overlay.querySelectorAll("[data-batch-checkbox]:checked")).map(el=> el.value);
  const updateSummary = ()=>{
    const ids = new Set(getChecked());
    const count = batches.filter(b=> ids.has(b.id)).reduce((s,b)=> s + b.count, 0);
    const sum = overlay.querySelector("[data-batch-summary]");
    if(sum) sum.textContent = count ? `${count} item${count===1?"":"s"} selected` : "Nothing selected";
    const btn = overlay.querySelector("[data-batch-confirm]");
    if(btn) btn.disabled = !count;
    overlay.querySelectorAll("[data-batch-checkbox]").forEach(cb=>{
      const row = cb.closest(".batchRow");
      if(row) row.classList.toggle("selected", !!cb.checked);
    });
  };

  const close = ()=>{
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  };
  const onKey = (e)=>{
    if(e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  overlay.addEventListener("click", (e)=>{
    const tgt = e.target;
    if(tgt === overlay){ close(); return; }
    if(tgt.closest("[data-batch-close]")){ close(); return; }
    if(tgt.closest("[data-batch-select-all]")){
      overlay.querySelectorAll("[data-batch-checkbox]").forEach(cb=> cb.checked = true);
      updateSummary();
      return;
    }
    if(tgt.closest("[data-batch-select-none]")){
      overlay.querySelectorAll("[data-batch-checkbox]").forEach(cb=> cb.checked = false);
      updateSummary();
      return;
    }
    if(tgt.closest("[data-batch-select-latest]")){
      const boxes = Array.from(overlay.querySelectorAll("[data-batch-checkbox]"));
      boxes.forEach((cb,i)=> cb.checked = (i===0));
      updateSummary();
      return;
    }
    if(tgt.closest("[data-batch-confirm]")){
      const ids = getChecked();
      if(!ids.length) return;
      const count = batches.filter(b=> ids.includes(b.id)).reduce((s,b)=> s + b.count, 0);
      const ok = confirm(`Delete ${count} imported item${count===1?"":"s"} from ${ids.length} batch${ids.length===1?"":"es"}? This cannot be undone.`);
      if(!ok) return;
      close();
      try{ onConfirm(ids); }catch(err){ console.error(err); }
      return;
    }
  });

  overlay.addEventListener("change", (e)=>{
    if(e.target && e.target.matches && e.target.matches("[data-batch-checkbox]")) updateSummary();
  });

  updateSummary();
}

function wireTop(){
  $("#exportBtn").onclick = ()=>{
    state.exportDialogOpen = true;
    state.exportMode = state.exportMode || "full";
    state.exportLayoutScope = state.exportLayoutScope || "active";
    render();
  };

  $("#importLabel")?.addEventListener("keydown", (e)=>{
    if(e.key === "Enter" || e.key === " "){
      e.preventDefault();
      $("#importFile")?.click();
    }
  });

  $("#importFile").onchange = (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const input = e.target;
    const reader = new FileReader();
    reader.onload = ()=>{
      const raw = String(reader.result || "");
      const trimmed = raw.trim();
      const resetInput = ()=>{ try{ input.value = ""; }catch{} };

      if(trimmed.startsWith("{")){
        try{
          const data = JSON.parse(trimmed);
          discardPendingDraftModelAsset();
          if(data.settings){
            state.settings = {...DEFAULT_SETTINGS, ...state.settings, ...data.settings};
            state.settings.wishlistVisibleColumns = Array.isArray(state.settings.wishlistVisibleColumns) && state.settings.wishlistVisibleColumns.length ? state.settings.wishlistVisibleColumns : DEFAULT_WISHLIST_COLUMNS.slice();
            state.settings.flooringPrices = {...DEFAULT_FLOORING_PRICES, ...(state.settings.flooringPrices||{})};
            state.settings.layoutEditorUnit = (state.settings.layoutEditorUnit === "in" || state.settings.layoutEditorUnit === "ft") ? state.settings.layoutEditorUnit : "ft";
          }
          if(Array.isArray(data.categories)) state.categories = data.categories;
          if(Array.isArray(data.items)) state.items = data.items.map(normalizeItemRecord);

          const importedLayouts=normalizeImportedLayoutPayload(data,state.settings,state.items);
          if(importedLayouts){
            state.layouts=importedLayouts.layouts;
            // setActiveLayout normally saves the current layout before switching.
            // During a full import there is no current entry to save, so clear the
            // pointer first to avoid overwriting the imported active layout.
            state.activeLayoutId = null;
            state.setActiveLayout(importedLayouts.activeLayoutId);
          }
          state.tab = data.tab==="ingest" ? "wishlist" : (data.tab || state.tab);
          state.editingId = null;
          state.draft = {...DEFAULT_ITEM};
          render();
        }catch(err){
          alert("Import failed: invalid JSON backup.");
        }
        resetInput();
        return;
      }

      if(looksLikeGymEquipmentExportHtml(raw)){
        const parsed = parseGymEquipmentExportHtml(raw);
        if(!parsed.length){
          alert("This HTML file did not contain any equipment cards (.cards > .card).");
          resetInput();
          return;
        }
        // Add new categories
        const lower = new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
        parsed.forEach(x=>{
          const c = (x.data?.category||"").trim();
          if(c && !lower.has(c.toLowerCase())){ state.categories.push(c); lower.add(c.toLowerCase()); }
        });
        // Stamp every item in this import with the same batch marker so the
        // user can later delete imports by batch (see deleteAllImported).
        const batchTime = Date.now();
        const batchId = `batch_${batchTime}_${Math.random().toString(36).slice(2,7)}`;
        const batchFile = (file && file.name) ? String(file.name) : "";
        // Compress images then add items
        (async ()=>{
          let added = 0;
          for(const x of parsed){
            if(!x.data) continue;
            const data = {...x.data};
            if(data.layoutImageDataUrl){
              // Aggressive compression so many imports fit in localStorage's ~5MB
              // budget. ~280px longest side at JPEG q=0.55 lands near 12-25 KB
              // per item while still looking clean at layout thumbnail sizes.
              data.layoutImageDataUrl = await compressDataUrl(data.layoutImageDataUrl, 280, 0.55);
            }
            if(data.layoutImageDataUrl) data.layoutUseImage = true;
            const item = {
              ...DEFAULT_ITEM,
              ...data,
              id: uid("item"),
              importBatch: batchId,
              importBatchTime: batchTime,
              importBatchFile: batchFile,
            };
            state.items.push(item);
            added++;
          }
          state.tab = "wishlist";
          state.editingId = null;
          discardPendingDraftModelAsset();
          state.draft = {...DEFAULT_ITEM};
          render();
          alert(`Imported ${added} items from HTML export (images compressed for storage).`);
        })();
        resetInput();
        return;
      }

      alert("Import failed: choose a JSON backup from this app, or an HTML export with equipment cards (e.g. gym-equipment-export-….html).");
      resetInput();
    };
    reader.readAsText(file);
  };
}

function wireTab(){
  $$(".tab").forEach(btn=>{
    btn.onclick = ()=>{
      state.tab = btn.dataset.tab;
      saveJSON(LS.tab, state.tab);
      render();
    };
  });
}

function selectPlanAreaFromKeyboard(event){
  if(event.key!=="Enter"&&event.key!==" ") return false;
  const group=event.target?.closest?.('g[data-type="area"][role="button"]');
  if(!group) return false;
  const area=(state.layout.areas||[]).find(entry=>entry.id===group.dataset.id);
  if(!area) return false;
  event.preventDefault();
  event.stopPropagation();
  clearAllSelections();
  state.layout.selectedAreaId=area.id;
  render();
  return true;
}

function wireMain(){
  document.body.onclick = (e)=>{
    let t = e.target;
    if(t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
    if(!t || !(t instanceof Element)) return;
    const actEl = t.closest("[data-action]");
    if(actEl) t = actEl;

    if(t.dataset.action==="openLightbox"){
      const src = t.dataset.src || "";
      const caption = t.dataset.caption || "";
      const box = $("#imgLightbox");
      const img = $("#imgLightboxImg");
      const cap = $("#imgLightboxCaption");
      if(!box || !img || !cap) return;
      img.src = src;
      img.alt = caption;
      cap.textContent = caption;
      box.classList.add("open");
      box.setAttribute("aria-hidden","false");
      return;
    }
    if(t.dataset.action==="closeLightbox"){
      const box = $("#imgLightbox");
      const img = $("#imgLightboxImg");
      const cap = $("#imgLightboxCaption");
      if(!box) return;
      box.classList.remove("open");
      box.setAttribute("aria-hidden","true");
      if(img) img.src = "";
      if(cap) cap.textContent = "";
      return;
    }
    if(t.dataset.action==="closeExportDialog"){
      state.exportDialogOpen = false;
      render();
      return;
    }
    if(t.dataset.action==="setExportMode"){
      const mode = String(t.dataset.mode || "");
      if(!["full","noLayouts","layoutsOnly"].includes(mode)) return;
      state.exportMode = mode;
      render();
      return;
    }
    if(t.dataset.action==="setExportLayoutScope"){
      const scope = String(t.dataset.scope || "");
      if(!["active","all"].includes(scope)) return;
      state.exportLayoutScope = scope;
      render();
      return;
    }
    if(t.dataset.action==="confirmExport"){
      const { filename, payload } = exportPayloadFromState();
      downloadJsonExport(filename, payload);
      state.exportDialogOpen = false;
      render();
      return;
    }

    // Shared plan / 3D / first-person controls.
    if(t.dataset.action==="spatial_mode"){
      const mode=String(t.dataset.mode||"");
      if(!["plan","split","3d"].includes(mode)) return;
      state.layout.spatialViewMode=mode;
      render();
      return;
    }
    if(t.dataset.action==="toggle_layout_focus"){
      state.layoutFocusMode=!state.layoutFocusMode;
      render();
      return;
    }
    if(t.dataset.action==="spatial_frame_selected"){
      if(typeof frameSelectedGym3D==="function") frameSelectedGym3D();
      return;
    }
    if(t.dataset.action==="spatial_toggle"){
      const key=String(t.dataset.key||"");
      if(!["walls","ceiling","clearances","collisions"].includes(key)) return;
      state.layout.spatial3d={...DEFAULT_LAYOUT.spatial3d,...(state.layout.spatial3d||{}),[key]:!!t.checked};
      render();
      return;
    }
    if(t.dataset.action==="spatial_walkthrough_open"){
      state.layout.walkthroughOpen=true;
      render();
      return;
    }
    if(t.dataset.action==="spatial_walkthrough_close"){
      try{ if(document.pointerLockElement) document.exitPointerLock(); }catch{}
      state.layout.walkthroughOpen=false;
      render();
      return;
    }
    if(t.dataset.action==="spatial_walkthrough_reset"){
      if(typeof resetGymWalkthrough==="function") resetGymWalkthrough();
      return;
    }
    if(t.dataset.action==="gym3d_lock"){
      if(typeof startGymWalkthrough==="function") startGymWalkthrough();
      return;
    }

    // Layout library actions
    if(t.dataset.action==="layout_new"){
      if(!performLayoutLibraryAction("new")) return;
      render();
      return;
    }
    if(t.dataset.action==="layout_dup"){
      if(!performLayoutLibraryAction("duplicate")) return;
      render();
      return;
    }
    if(t.dataset.action==="layout_delete"){
      if((state.layouts||[]).length<=1){
        alert("You need at least one layout.");
        return;
      }
      if(!confirm("Delete this layout?")) return;
      const delId = state.activeLayoutId;
      state.layouts = (state.layouts||[]).filter(x=>x.id!==delId);
      const nextId = state.layouts[0].id;
      if(state.setActiveLayout) state.setActiveLayout(nextId);
      state.tab = "layout";
      render();
      return;
    }
    if(t.dataset.action==="layout_rename"){
      if(!performLayoutLibraryAction("rename")) return;
      render();
      return;
    }

    // Wall extensions
    if(t.dataset.action==="addWallExt"){
      const wall = t.dataset.wall || "right";
      const r = room();
      let startFt = 1, lengthFt = 6, depthFt = 4;
      const wallLen = (wall==="left"||wall==="right") ? r.L : r.W;
      if(lengthFt > wallLen) lengthFt = Math.max(0.5, wallLen);
      const we = { id: uid("we"), label: "Extension", wall, startFt: snap(startFt), startIn: 0, lengthFt: snap(lengthFt), lengthIn: 0, depthFt: snap(depthFt), depthIn: 0 };
      state.layout.wallExtensions = [...(state.layout.wallExtensions||[]), we];
      clearAllSelections();
      state.layout.selectedWallExtId = we.id;
      state.tab = "layout";
      state._roomCache = null;
      render();
      return;
    }
    if(t.dataset.action==="removeWallExt"){
      const id = t.dataset.id;
      state.layout.wallExtensions = (state.layout.wallExtensions||[]).filter(w=>w.id!==id);
      if(state.layout.selectedWallExtId===id) state.layout.selectedWallExtId = null;
      state._roomCache = null;
      render();
      return;
    }
    if(t.dataset.action==="we_grow" || t.dataset.action==="we_shrink"){
      const id = t.dataset.id;
      const prop = t.dataset.prop;
      const stepDisplay = (e && e.shiftKey) ? (layoutEditorUnit()==="in" ? 60 : 5) : (layoutEditorUnit()==="in" ? 12 : 1);
      const step = stepDisplay / 12;
      const isShrink = t.dataset.action==="we_shrink";
      const s = isShrink ? -step : step;
      state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=>{
        if(w.id!==id) return w;
        const next = {...w};
        if(prop==="length"){
          const t = wallExtLengthTotalFt(next) + s;
          next.lengthFt = Math.max(0.5, snap(t));
          next.lengthIn = 0;
        }
        if(prop==="depth"){
          const t = wallExtDepthTotalFt(next) + s;
          next.depthFt = Math.max(0.5, snap(t));
          next.depthIn = 0;
        }
        return next;
      });
      state._roomCache = null;
      render();
      return;
    }

    // Ceiling zones
    if(t.dataset.action==="addCeilingZone"){
      const cz = {
        id: uid("cz"),
        label: "Low ceiling",
        xFt: snap(0.5), xIn: 0,
        yFt: snap(0.5), yIn: 0,
        widthFt: snap(6), widthIn: 0,
        heightFt: snap(4), heightIn: 0,
        ceilingHeightFt: 7, ceilingHeightIn: 0,
      };
      state.layout.ceilingZones = [...(state.layout.ceilingZones||[]), cz];
      clearAllSelections();
      state.layout.selectedCeilingZoneId = cz.id;
      render();
      return;
    }
    if(t.dataset.action==="removeCeilingZone"){
      const id = t.dataset.id;
      state.layout.ceilingZones = (state.layout.ceilingZones||[]).filter(z=>z.id!==id);
      if(state.layout.selectedCeilingZoneId===id) state.layout.selectedCeilingZoneId = null;
      render();
      return;
    }

    // Floor zones
    if(t.dataset.action==="addFloorZone"){
      const fz = {
        id: uid("fz"),
        label: "Elevated floor",
        xFt: snap(0.5),
        xIn: 0,
        yFt: snap(0.5),
        yIn: 0,
        widthFt: snap(6),
        widthIn: 0,
        heightFt: snap(4),
        heightIn: 0,
        elevationIn: 4,
      };
      state.layout.floorZones = [...(state.layout.floorZones||[]), fz];
      clearAllSelections();
      state.layout.selectedFloorZoneId = fz.id;
      render();
      return;
    }
    if(t.dataset.action==="removeFloorZone"){
      const id = t.dataset.id;
      state.layout.floorZones = (state.layout.floorZones||[]).filter(z=>z.id!==id);
      if(state.layout.selectedFloorZoneId===id) state.layout.selectedFloorZoneId = null;
      render();
      return;
    }

    // Flooring pieces
    if(t.dataset.action==="addFlooring"){
      const typeId = t.dataset.type || "stall_mat_4x6";
      addFlooring(typeId);
      return;
    }
    if(t.dataset.action==="removeFlooring"){
      const id = t.dataset.id;
      state.layout.flooringPieces = (state.layout.flooringPieces||[]).filter(f=>f.id!==id);
      if(state.layout.selectedFlooringId===id) state.layout.selectedFlooringId = null;
      render();
      return;
    }
    if(t.dataset.action==="rotateFlooring"){
      const id = t.dataset.id;
      state.layout.flooringPieces = (state.layout.flooringPieces||[]).map(f=> f.id===id ? {...f, rotated: !f.rotated} : f);
      render();
      return;
    }

    // Exercise filters
    if(t.dataset.action==="ex_view"){
      state.exerciseFilterView = t.dataset.value || "available";
      render();
      return;
    }
    if(t.dataset.action==="ex_bodypart"){
      state.exerciseFilterBodyPart = t.dataset.value || "All";
      render();
      return;
    }
    if(t.dataset.action==="ex_type"){
      state.exerciseFilterType = t.dataset.value || "All";
      render();
      return;
    }
    
    // Layout category filter
    if(t.dataset.action==="layoutCatFilter"){
      state.layoutSelectedCategory = t.dataset.cat || "All";
      state.layoutFilterUpright = "All";
      state.layoutFilterHole = "All";
      state.layoutExpandedItemId = null;
      render();
      return;
    }
    if(t.dataset.action==="toggleEquipmentType"){
      const type = t.dataset.type || "";
      if(!type || !EQUIPMENT_TYPES.includes(type)) return;
      const types = new Set(Array.isArray(state.draft.equipmentTypes) ? state.draft.equipmentTypes : []);
      if(types.has(type)) types.delete(type); else types.add(type);
      state.draft = {...state.draft, equipmentTypes: Array.from(types)};
      render();
      return;
    }

    if(t.dataset.action==="setColor"){
      const color = t.dataset.color || "";
      state.draft = {...state.draft, color};
      render();
      return;
    }

    // Brand autocomplete selection
    if(t.classList && t.classList.contains("autocompleteItem")){
      const brand = t.dataset.brand || "";
      $("#f_brand").value = brand;
      state.draft.brand = brand;
      render();
      return;
    }

    if(t.id==="f_isRack" || t.id==="f_isRackAttachment" || t.id==="f_storesEquipment"){
      state.draft[t.id.substring(2)] = t.checked;
      render();
      return;
    }

    if(t.dataset.action==="toggleLayoutToolsPanel"){
      state.layoutToolsPanelOpen = !state.layoutToolsPanelOpen;
      render();
      return;
    }

    if(t.dataset.action==="toggle_layout_dim_overlay"){
      if(t instanceof HTMLInputElement && t.type==="checkbox"){
        state.settings.layoutDimOverlay = !!t.checked;
        render();
        return;
      }
    }

    if(t.dataset.action==="layout_show_in"){
      applyLayoutShowIn(t.dataset.dim, t.dataset.id);
      return;
    }

    if(t.dataset.action==="toggleWishlistCategories"){
      state.wishlistCategoriesOpen = !state.wishlistCategoriesOpen;
      render();
      return;
    }

    if(t.dataset.action==="toggleExpandItem"){
      const id = t.dataset.id;
      if(!id) return;
      if(state.layoutExpandedItemId === id){
        state.layoutExpandedItemId = null;
      } else {
        state.layoutExpandedItemId = id;
        state.layoutExpandedTab = "general";
      }
      render();
      return;
    }

    if(t.dataset.action==="setItemTab"){
      const id = t.dataset.id;
      const tab = t.dataset.tab;
      if(!id || !tab) return;
      state.layoutExpandedItemId = id;
      state.layoutExpandedTab = tab;
      render();
      return;
    }
    
    // Go to wishlist to add equipment
    if(t.dataset.action==="goToWishlist"){
      e.preventDefault();
      discardPendingDraftModelAsset();
      state.tab = "wishlist";
      state.editingId = null;
      state.draft = {...DEFAULT_ITEM};
      render();
      return;
    }
    
    // Edit room dimensions (go to settings)
    if(t.dataset.action==="editRoomDims"){
      state.tab = "settings";
      render();
      return;
    }

    // Cancel edit
    if(t.id==="cancelEdit"){
      discardPendingDraftModelAsset();
      state.editingId = null;
      state.draft = {...DEFAULT_ITEM};
      render();
      return;
    }

    // Add category
    if(t.id==="addCategoryBtn"){
      const v = ($("#f_newCategory")?.value || "").trim();
      if(!v) return;
      const lower = new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
      if(!lower.has(v.toLowerCase())) state.categories.push(v);
      const catSel = $("#f_category");
      if(catSel) catSel.value = v;
      state.draft.category = v;
      render();
      return;
    }

    if(t.dataset.action==="addWishlistCategory"){
      const v = ($("#wishlistNewCategoryInput")?.value || "").trim();
      if(!v) return;
      const lower = new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
      if(!lower.has(v.toLowerCase())) state.categories.push(v);
      render();
      return;
    }

    if(t.dataset.action==="renameCategory"){
      const current = String(t.dataset.category || "").trim();
      if(!current) return;
      const next = (prompt("Edit category name:", current) || "").trim();
      if(!next || next===current) return;
      const existing = state.categories.find(cat=> String(cat).toLowerCase()===next.toLowerCase());
      const target = existing || next;
      state.categories = state.categories.map(cat=> cat===current ? target : cat).filter((cat, idx, arr)=> arr.findIndex(x=>String(x).toLowerCase()===String(cat).toLowerCase())===idx);
      state.items = state.items.map(item=> item.category===current ? {...item, category: target} : item);
      if(state.draft.category===current) state.draft.category = target;
      render();
      return;
    }

    // Open the import-batch picker so the user can delete entire batches
    // (e.g. most recent import only). Falls back to the legacy "delete every
    // HTML-imported item" flow if there's exactly one batch.
    if(t.dataset.action==="deleteAllImported"){
      openImportBatchPicker((batchIds)=>{
        if(!batchIds || !batchIds.length) return;
        const wantedBatches = new Set(batchIds);
        const importedItems = (state.items || []).filter(isHtmlImportedItem);
        const toRemove = importedItems.filter(it=>{
          const bid = it.importBatch || "legacy";
          return wantedBatches.has(bid);
        });
        if(!toRemove.length) return;
        const removeIds = new Set(toRemove.map(it=> it.id));
        const assetRefs=toRemove.map(item=>item.model3dAssetRef).filter(Boolean);
        removeItemReferencesFromAllLayouts(removeIds);
        state.items = (state.items || []).filter(it=> !removeIds.has(it.id));
        if(removeIds.has(state.editingId)){
          discardPendingDraftModelAsset();
          state.editingId=null;
          state.draft={...DEFAULT_ITEM};
        }
        render();
        assetRefs.forEach(removeUnreferencedModelAsset);
      });
      return;
    }

    // Rename / set the brand for every item in the current brand group at once.
    // Use "__noBrand__" as the data-brand for items that currently have no brand set.
    if(t.dataset.action==="editBrand"){
      const currentRaw = String(t.dataset.brand || "").trim();
      const isNoBrand = currentRaw === "__noBrand__";
      const currentMatch = isNoBrand ? "" : currentRaw;
      const promptDefault = isNoBrand ? "" : currentMatch;
      const next = prompt(isNoBrand
        ? "Set brand / company name for all items with no brand:"
        : `Edit brand / company name (applies to all items currently listed as "${currentMatch}"):`,
        promptDefault);
      if(next === null) return;
      const target = String(next || "").trim();
      state.items = (state.items || []).map(item=>{
        const ib = String(item.brand||"").trim();
        if(ib === currentMatch) return { ...item, brand: target };
        return item;
      });
      render();
      return;
    }

    if(t.dataset.action==="deleteCategory"){
      const category = String(t.dataset.category || "").trim();
      if(!category || category==="Custom") return;
      const itemCount = (state.items || []).filter(item => item.category === category).length;
      const msg = itemCount > 0 
        ? `Delete "${category}"?\n\n${itemCount} item${itemCount===1?"":"s"} will be moved to "Custom".`
        : `Delete empty category "${category}"?`;
      if(!confirm(msg)) return;
      state.categories = state.categories.filter(cat=>cat!==category);
      state.items = state.items.map(item=> item.category===category ? {...item, category:"Custom"} : item);
      if(state.draft.category===category) state.draft.category = "Custom";
      render();
      return;
    }

    if(t.dataset.action==="toggleWishlistColumn"){
      const column = String(t.dataset.column || "");
      if(!DEFAULT_WISHLIST_COLUMNS.includes(column)) return;
      const visible = new Set(wishlistVisibleColumns());
      if(visible.has(column)){
        if(visible.size===1) return;
        visible.delete(column);
      } else {
        visible.add(column);
      }
      state.settings.wishlistVisibleColumns = DEFAULT_WISHLIST_COLUMNS.filter(col=>visible.has(col));
      render();
      return;
    }

    if(t.dataset.action==="toggleItemTag"){
      const tag = t.dataset.tag || "";
      if(!tag || !ITEM_BODY_PART_TAGS.includes(tag)) return;
      const tags = new Set(Array.isArray(state.draft.equipmentTags) ? state.draft.equipmentTags : []);
      if(tags.has(tag)) tags.delete(tag); else tags.add(tag);
      state.draft = {...state.draft, equipmentTags: Array.from(tags)};
      render();
      return;
    }

    if(t.dataset.action==="toggleTagForItem"){
      const id = t.dataset.id;
      const tag = t.dataset.tag || "";
      if(!id || !tag || !ITEM_BODY_PART_TAGS.includes(tag)) return;
      state.items = state.items.map(item=>{
        if(item.id!==id) return item;
        const tags = new Set(Array.isArray(item.equipmentTags) ? item.equipmentTags : []);
        if(tags.has(tag)) tags.delete(tag); else tags.add(tag);
        return {...item, equipmentTags: Array.from(tags)};
      });
      if(state.editingId===id){
        const item = state.items.find(x=>x.id===id);
        if(item) state.draft = {...DEFAULT_ITEM, ...item};
      }
      render();
      return;
    }

    // Save item (BUG FIX: preserve item ID when editing)
    if(t.id==="saveItemBtn"){
      const payload = readDraftFromForm();
      if(!payload.name.trim()) return;

      const lower = new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
      if(payload.category && !lower.has(payload.category.toLowerCase())) state.categories.push(payload.category);

      let previousAssetRef="";
      let saved=false;
      if(state.editingId){
        const existingItem = state.items.find(it=>it.id===state.editingId);
        if(existingItem){
          previousAssetRef=String(existingItem.model3dAssetRef||"");
          state.items = state.items.map(it=> it.id===state.editingId ? {...existingItem, ...payload, id: state.editingId} : it);
          saved=true;
        }
      }else{
        const now = Date.now();
        state.items = [{...DEFAULT_ITEM, ...payload, id: uid("item"), createdAt: now}, ...state.items];
        saved=true;
      }
      const pendingRef=pendingDraftModelAssetRef;
      setPendingDraftModelAsset("");
      state.editingId = null;
      state.draft = {...DEFAULT_ITEM};
      render();
      if(!saved && pendingRef) removeUnreferencedModelAsset(pendingRef);
      if(previousAssetRef && previousAssetRef!==payload.model3dAssetRef) removeUnreferencedModelAsset(previousAssetRef);
      return;
    }

    // Compare actions
    if(t.dataset.action==="toggleCompare"){
      const id = t.dataset.id;
      if(!id) return;
      const ids = state.compareSelectedIds || [];
      const set = new Set(ids);
      if(set.has(id)) set.delete(id); else set.add(id);
      state.compareSelectedIds = Array.from(set);
      state.compareResult = null; // clear old result when selection changes
      render();
      return;
    }
    if(t.dataset.action==="clearCompare"){
      state.compareSelectedIds = [];
      state.compareResult = null;
      render();
      return;
    }
    if(t.id==="runCompareBtn"){
      const prompt = $("#comparePromptArea")?.value || DEFAULT_COMPARE_PROMPT;
      state.comparePrompt = prompt;
      t.disabled = true;
      t.textContent = "Comparing...";
      compareItemsWithAI(state.compareSelectedIds || [], prompt).then(result=>{
        if(result !== null){
          state.compareResult = result;
        }
        render();
      }).catch(()=>{ render(); });
      return;
    }

    // Wishlist actions
    if(t.dataset.action==="edit"){
      const id = t.dataset.id;
      const item = state.items.find(x=>x.id===id);
      if(!item) return;
      discardPendingDraftModelAsset();
      state.tab = "wishlist";
      state.editingId = id;
      state.draft = {...DEFAULT_ITEM, ...item};
      render();
      return;
    }
    if(t.dataset.action==="delete"){
      const id = t.dataset.id;
      if(!confirm("Delete this item?")) return;
      const deletedItem=state.items.find(x=>x.id===id);
      state.items = state.items.filter(x=>x.id!==id);
      removeItemReferencesFromAllLayouts(new Set([id]));
      if(state.editingId===id){
        discardPendingDraftModelAsset();
        state.editingId = null;
        state.draft = {...DEFAULT_ITEM};
      }
      render();
      removeUnreferencedModelAsset(deletedItem?.model3dAssetRef);
      return;
    }
    if(t.dataset.action==="place"){
      const itemId = t.dataset.id;
      addInstance(itemId);
      state.tab = "layout";
      render();
      return;
    }

    // Auto-fill button
    if(t.id==="autoFillBtn"){
      const url = $("#f_productLink")?.value || "";
      if(!url.trim()){
        alert("Please enter a product URL first.");
        return;
      }
      
      t.disabled = true;
      t.textContent = "Loading...";
      
      autoFillFromUrl(url).then(result=>{
        if(result){
          const keepImg = state.draft.layoutImageDataUrl;
          const keepUseImg = state.draft.layoutUseImage;
          state.draft = {
            ...state.draft,
            ...(result.name ? {name: result.name} : {}),
            ...(result.brand ? {brand: result.brand} : {}),
            ...(result.category ? {category: result.category} : {}),
            ...(result.unit ? {unit: result.unit} : {}),
            ...(safeNum(result.length) > 0 ? {length: safeNum(result.length)} : {}),
            ...(safeNum(result.width) > 0 ? {width: safeNum(result.width)} : {}),
            ...(safeNum(result.height) > 0 ? {height: safeNum(result.height)} : {}),
            ...(safeNum(result.price) > 0 ? {price: safeNum(result.price)} : {}),
            ...(result.powerVoltage ? {powerVoltage: result.powerVoltage} : {}),
            ...(result.rackHolePattern ? {rackHolePattern: result.rackHolePattern} : {}),
            ...(result.rackCustomSpec ? {rackCustomSpec: result.rackCustomSpec} : {}),
            ...(result.notes ? {notes: result.notes} : {}),
            layoutImageDataUrl: keepImg,
            layoutUseImage: keepUseImg,
          };
          render();
        }
        t.disabled = false;
        t.textContent = "Auto-fill";
      }).catch(()=>{
        t.disabled = false;
        t.textContent = "Auto-fill";
      });
      return;
    }

    // Settings actions
    if(t.id==="saveSettingsBtn"){
      const cur = state.settings;
      const currency = ($("#set_currency")?.value || "USD").trim() || "USD";
      const snapFt = safeNum($("#set_snap")?.value);
      const len = safeNum($("#set_len")?.value);
      const lenIn = safeNum($("#set_lenIn")?.value);
      const wid = safeNum($("#set_wid")?.value);
      const widIn = safeNum($("#set_widIn")?.value);
      const clear = safeNum($("#set_clear")?.value);
      const clearIn = safeNum($("#set_clearIn")?.value);
      const ceiling = safeNum($("#set_ceiling")?.value);
      const ceilingIn = safeNum($("#set_ceilingIn")?.value);
      const cord = safeNum($("#set_cord")?.value);

      const floorMode = ($("#set_floorMode")?.value || cur.flooringMode || "tiles");
      const floorWaste = safeNum($("#set_floorWaste")?.value);

      const tileW = safeNum($("#set_tileW")?.value);
      const tileL = safeNum($("#set_tileL")?.value);
      const tilesPerBox = safeNum($("#set_tilesPerBox")?.value);

      const rollW = safeNum($("#set_rollW")?.value);
      const rollL = safeNum($("#set_rollL")?.value);

      const aiProvider = $("#set_aiProvider")?.value || "none";
      const aiApiKey = headerValueLatin1(String($("#set_aiApiKey")?.value || "")).trim();

      state.settings = {
        ...cur,
        currency,
        snapFt: Math.max(0, snapFt),
        roomLengthFt: Math.max(0, len),
        roomLengthIn: Math.max(0, lenIn),
        roomWidthFt: Math.max(0, wid),
        roomWidthIn: Math.max(0, widIn),
        clearanceFt: Math.max(0, clear),
        clearanceIn: Math.max(0, clearIn),
        ceilingHeightFt: Math.max(0, ceiling),
        ceilingHeightIn: Math.max(0, ceilingIn),
        maxCordLengthFt: Math.max(0, cord),

        flooringMode: (floorMode==="roll" ? "roll" : "tiles"),
        floorWastePct: clamp(floorWaste, 0, 50),
        tileWidthIn: Math.max(0, tileW || cur.tileWidthIn),
        tileLengthIn: Math.max(0, tileL || cur.tileLengthIn),
        tilesPerBox: Math.max(1, Math.floor(tilesPerBox || cur.tilesPerBox || 1)),
        rollWidthFt: Math.max(0, rollW || cur.rollWidthFt),
        rollLengthFt: Math.max(0, rollL || cur.rollLengthFt),
        
        aiProvider,
        aiApiKey,
        wishlistVisibleColumns: Array.isArray(cur.wishlistVisibleColumns) && cur.wishlistVisibleColumns.length ? cur.wishlistVisibleColumns : DEFAULT_WISHLIST_COLUMNS.slice(),
        flooringPrices: {...DEFAULT_FLOORING_PRICES, ...(cur.flooringPrices||{})},
      };

      state._roomCache = null;
      render();
      return;
    }
    if(t.dataset.action==="toggleDefaultSide"){
      const side = t.dataset.side;
      const sides = Array.isArray(state.settings.defaultDeadspaceSides) ? state.settings.defaultDeadspaceSides : [];
      const set = new Set(sides);
      if(set.has(side)) set.delete(side); else set.add(side);
      state.settings.defaultDeadspaceSides = Array.from(set);
      render();
      return;
    }
    if(t.dataset.action==="defaultSidesAll"){
      state.settings.defaultDeadspaceSides = ["left","right","top","bottom"];
      render(); return;
    }
    if(t.dataset.action==="defaultSidesNone"){
      state.settings.defaultDeadspaceSides = [];
      render(); return;
    }

    if(t.dataset.action==="toggleReservedSubtract"){
      const kind = t.dataset.kind;
      if(!kind) return;
      const set = new Set(Array.isArray(state.settings.reservedAreaKindsSubtractSpace) ? state.settings.reservedAreaKindsSubtractSpace : []);
      if(set.has(kind)) set.delete(kind);
      else set.add(kind);
      state.settings.reservedAreaKindsSubtractSpace = Array.from(set);
      render();
      return;
    }
    if(t.dataset.action==="reservedSubtractAll"){
      state.settings.reservedAreaKindsSubtractSpace = ["walkway", "door", "garagedoor", "nogospace", "cutout"];
      render(); return;
    }
    if(t.dataset.action==="reservedSubtractNone"){
      state.settings.reservedAreaKindsSubtractSpace = [];
      render(); return;
    }

    if(t.dataset.action==="toggleReservedBlock"){
      const kind = t.dataset.kind;
      if(!kind) return;
      const set = new Set(Array.isArray(state.settings.reservedAreaKindsBlockPlacement) ? state.settings.reservedAreaKindsBlockPlacement : []);
      if(set.has(kind)) set.delete(kind);
      else set.add(kind);
      state.settings.reservedAreaKindsBlockPlacement = Array.from(set);
      // Re-validate all equipment instances
      state.layout.instances = (state.layout.instances||[]).map(inst=>{
        const it = getItemById(inst.itemId);
        if(!it) return inst;
        const er = effectiveRectForInst(inst, it);
        return {...inst, __invalid: isInvalidPlacement(inst.id, er.base, er.eff)};
      });
      render();
      return;
    }
    if(t.dataset.action==="reservedBlockAll"){
      state.settings.reservedAreaKindsBlockPlacement = ["walkway", "door", "garagedoor", "nogospace", "cutout"];
      // Re-validate all equipment instances
      state.layout.instances = (state.layout.instances||[]).map(inst=>{
        const it = getItemById(inst.itemId);
        if(!it) return inst;
        const er = effectiveRectForInst(inst, it);
        return {...inst, __invalid: isInvalidPlacement(inst.id, er.base, er.eff)};
      });
      render(); 
      return;
    }
    if(t.dataset.action==="reservedBlockNone"){
      state.settings.reservedAreaKindsBlockPlacement = [];
      // Re-validate all equipment instances
      state.layout.instances = (state.layout.instances||[]).map(inst=>{
        const it = getItemById(inst.itemId);
        if(!it) return inst;
        const er = effectiveRectForInst(inst, it);
        return {...inst, __invalid: isInvalidPlacement(inst.id, er.base, er.eff)};
      });
      render(); 
      return;
    }

    // Ingest actions (legacy; section removed)
    if(t.id==="ing_parse"){
      state.ingestErr = "";
      try{
        state.ingestText = $("#ing_text")?.value || "";
        state.ingestParsed = parseIngest(state.ingestText);
        const lower = new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
        state.ingestParsed.forEach(x=>{
          const c = (x.data?.category||"").trim();
          if(c && !lower.has(c.toLowerCase())){ state.categories.push(c); lower.add(c.toLowerCase()); }
        });
      }catch(err){
        state.ingestErr = "Parse failed.";
        state.ingestParsed = [];
      }
      render();
      return;
    }
    if(t.id==="ing_clear"){
      state.ingestText = "";
      state.ingestParsed = [];
      state.ingestErr = "";
      render();
      return;
    }
    if(t.id==="ing_addSelected"){
      const selected = (state.ingestParsed||[]).filter(x=>x.selected).map(x=>x.data);
      if(!selected.length) return;
      selected.forEach(d=>{
        const cat = (d.category||"Custom").trim() || "Custom";
        const lower = new Set((state.categories||[]).map(x=>String(x).toLowerCase()));
        if(cat && !lower.has(cat.toLowerCase())) state.categories.push(cat);

        state.items.unshift({
          ...DEFAULT_ITEM,
          ...d,
          id: uid("item"),
          name: String(d.name||"").trim() || "New item",
          category: cat,
          qty: Math.max(0, Math.floor(safeNum(d.qty||1))),
          createdAt: Date.now(),
        });
      });
      state.ingestText = "";
      state.ingestParsed = [];
      state.tab = "wishlist";
      render();
      return;
    }
    if(t.dataset.action==="ing_toggle"){
      const id = t.dataset.id;
      state.ingestParsed = (state.ingestParsed||[]).map(x=> x.id===id ? {...x, selected: !x.selected} : x);
      render(); return;
    }
    if(t.dataset.action==="ing_cat"){
      const id = t.dataset.id;
      const v = (t.value||"").trim();
      state.ingestParsed = (state.ingestParsed||[]).map(x=> x.id===id ? {...x, data:{...x.data, category:v}} : x);
      render(); return;
    }
    if(t.dataset.action==="ing_price"){
      const id = t.dataset.id;
      const v = t.value;
      state.ingestParsed = (state.ingestParsed||[]).map(x=> x.id===id ? {...x, data:{...x.data, price:v}} : x);
      render(); return;
    }
    if(t.dataset.action==="ing_link"){
      const id = t.dataset.id;
      const v = t.value;
      state.ingestParsed = (state.ingestParsed||[]).map(x=> x.id===id ? {...x, data:{...x.data, productLink:v}} : x);
      render(); return;
    }

    // Layout area add
    if(t.dataset.action==="addArea"){
      const kind = t.dataset.kind || "walkway";
      addArea(kind);
      return;
    }

    if(t.dataset.action==="add_wall_feature"){
      addWallFeature(t.dataset.kind || "mirror");
      return;
    }
    if(t.dataset.action==="remove_wall_feature"){
      removeWallFeature(t.dataset.id);
      return;
    }
    if(t.dataset.action==="wf_nudge"){
      const feature=(state.layout.wallFeatures||[]).find(x=>x.id===t.dataset.id);
      if(!feature) return;
      const roomData=wallFeatureRoomData(state.layout, state.settings);
      const wallLength=GymWallFeatures.wallLength(feature, roomData);
      const start=clamp(GymWallFeatures.start(feature)+safeNum(t.dataset.inches)/12, 0, Math.max(0,wallLength-GymWallFeatures.width(feature)));
      const parts=splitTotalFtToFtIn(start);
      patchWallFeature(feature.id, {startFt:parts.ft,startIn:parts.inch});
      return;
    }

    if(t.dataset.action==="addOutlet"){
      const o = { id: uid("out"), label: "Outlet", xFt: snap(1), xIn: 0, yFt: snap(1), yIn: 0, voltage: "120V" };
      state.layout.outlets = [ ...(state.layout.outlets||[]), o ];
      clearAllSelections();
      state.layout.selectedOutletId = o.id;
      render();
      return;
    }
    if(t.dataset.action==="removeOutlet"){
      const id = t.dataset.id;
      state.layout.outlets = (state.layout.outlets||[]).filter(o=>o.id!==id);
      if(state.layout.selectedOutletId===id) state.layout.selectedOutletId = null;
      render();
      return;
    }

    // Layout instance add/remove/rotate
    if(t.dataset.action==="addInst"){
      addInstance(t.dataset.id);
      render(); return;
    }

    // Layout: inline "Add photo" shortcut on an equipment rect that has no
    // layoutImageDataUrl yet. Opens a file picker, compresses the selected
    // image, and saves it directly to the item — no page switch needed.
    if(t.dataset.action==="editItemPhoto"){
      const id = t.dataset.id;
      const item = state.items.find(x=> x.id === id);
      if(!item) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = (ev)=>{
        const f = ev.target.files && ev.target.files[0];
        try{ document.body.removeChild(input); }catch{}
        if(!f) return;
        compressImageFileToDataUrl(f, 520, 0.82).then(dataUrl=>{
          if(String(dataUrl).length > 520000){
            alert("That image is still too large after compression. Try a smaller or simpler photo.");
            return;
          }
          const idx = state.items.findIndex(x=> x.id === id);
          if(idx < 0) return;
          state.items[idx] = { ...state.items[idx], layoutImageDataUrl: dataUrl, layoutUseImage: true };
          render();
        }).catch(err=>{
          alert(String(err && err.message ? err.message : err) || "Could not process image.");
        });
      };
      input.click();
      return;
    }

    // Staging zone size preset (grow/shrink the parking strip).
    if(t.dataset.action==="staging_size"){
      const size = t.dataset.size;
      const allowed = ["small","medium","large","xlarge"];
      if(!allowed.includes(size)) return;
      state.layout.stagingSize = size;
      render(); return;
    }

    // Compare zone (visual size comparison next to staging). Items live in
    // the active compare set (state.layout.compareSets[...].items) as
    // {itemId, xFt?, yFt?} objects; saved xFt/yFt override the auto-stack
    // position so users can drag items freely.
    if(t.dataset.action==="toggleCompareLayout"){
      const id = t.dataset.id;
      if(!id) return;
      const set = getActiveCompareSet();
      const i = set.items.findIndex(e=> e && e.itemId === id);
      if(i >= 0) set.items.splice(i, 1); else set.items.push({ itemId: id });
      render(); return;
    }
    if(t.dataset.action==="removeCompareLayout"){
      const id = t.dataset.id;
      if(!id) return;
      const set = getActiveCompareSet();
      set.items = set.items.filter(e=> e && e.itemId !== id);
      render(); return;
    }
    if(t.dataset.action==="clearCompareLayout"){
      const set = getActiveCompareSet();
      set.items = [];
      render(); return;
    }
    if(t.dataset.action==="rotateCompareLayout"){
      const id = t.dataset.id;
      if(!id) return;
      const set = getActiveCompareSet();
      const entry = set.items.find(e=> e && e.itemId === id);
      if(!entry) return;
      entry.rotated = !entry.rotated;
      render(); return;
    }

    // Compare sets management
    if(t.dataset.action==="compareSet_new"){
      const name = prompt("Name for new compare set:", "New comparison");
      if(name === null) return;
      const trimmed = String(name).trim() || "Untitled";
      const newSet = { id: uid("cmp"), name: trimmed.slice(0, 80), items: [] };
      if(!Array.isArray(state.layout.compareSets)) state.layout.compareSets = [];
      state.layout.compareSets.push(newSet);
      state.layout.activeCompareSetId = newSet.id;
      render(); return;
    }
    if(t.dataset.action==="compareSet_duplicate"){
      const src = getActiveCompareSet();
      const copy = { id: uid("cmp"), name: `${src.name} (copy)`.slice(0, 80), items: src.items.map(e=> ({...e})) };
      state.layout.compareSets.push(copy);
      state.layout.activeCompareSetId = copy.id;
      render(); return;
    }
    if(t.dataset.action==="compareSet_rename"){
      const set = getActiveCompareSet();
      const name = prompt("Rename compare set:", set.name);
      if(name === null) return;
      const trimmed = String(name).trim();
      if(!trimmed) return;
      set.name = trimmed.slice(0, 80);
      render(); return;
    }
    if(t.dataset.action==="compareSet_delete"){
      const sets = Array.isArray(state.layout.compareSets) ? state.layout.compareSets : [];
      if(sets.length <= 1){ alert("Can't delete the last compare set. Rename it or clear its items instead."); return; }
      const set = getActiveCompareSet();
      const ok = confirm(`Delete compare set "${set.name}"? This can't be undone.`);
      if(!ok) return;
      state.layout.compareSets = sets.filter(s=> s.id !== set.id);
      state.layout.activeCompareSetId = state.layout.compareSets[0].id;
      render(); return;
    }
    if(t.dataset.action==="compareSet_select"){
      const id = t.value || t.dataset.id;
      if(!id) return;
      if((state.layout.compareSets||[]).some(s=> s.id === id)){
        state.layout.activeCompareSetId = id;
        render();
      }
      return;
    }
    if(t.dataset.action==="removeInst"){
      const id = t.dataset.id;
      state.layout.instances = (state.layout.instances||[]).filter(x=>x.id!==id);
      if(state.layout.selectedInstId===id) state.layout.selectedInstId = null;
      render(); return;
    }
    if(t.dataset.action==="rotateInst"){
      rotateLayoutInstance90(t.dataset.id);
      return;
    }
    if(t.dataset.action==="toggleInstSide"){
      const id = t.dataset.id;
      const side = t.dataset.side;
      state.layout.instances = (state.layout.instances||[]).map(x=>{
        if(x.id!==id) return x;
        const cur = Array.isArray(x.deadspaceSides) ? x.deadspaceSides.slice() : (state.settings.defaultDeadspaceSides||[]).slice();
        const set = new Set(cur);
        if(set.has(side)) set.delete(side); else set.add(side);
        return {...x, deadspaceSides: Array.from(set)};
      });
      render(); return;
    }
    if(t.dataset.action==="instSidesAll"){
      const id = t.dataset.id;
      state.layout.instances = (state.layout.instances||[]).map(x=> x.id===id ? {...x, deadspaceSides:["left","right","top","bottom"]} : x);
      render(); return;
    }
    if(t.dataset.action==="instSidesNone"){
      const id = t.dataset.id;
      state.layout.instances = (state.layout.instances||[]).map(x=> x.id===id ? {...x, deadspaceSides:[]} : x);
      render(); return;
    }
    if(t.dataset.action==="instReset"){
      const id = t.dataset.id;
      state.layout.instances = (state.layout.instances||[]).map(x=> x.id===id ? {...x, deadspaceFt:null, deadspaceIn:0, deadspaceSides:null} : x);
      render(); return;
    }

    // Area extend / shrink buttons
    if(t.dataset.action==="area_extend" || t.dataset.action==="area_shrink"){
      const id = t.dataset.id;
      const dir = t.dataset.dir;
      const stepDisplay = (e && e.shiftKey) ? (layoutEditorUnit()==="in" ? 60 : 5) : (layoutEditorUnit()==="in" ? 12 : 1);
      const step = stepDisplay / 12;
      const r = room();

      state.layout.areas = (state.layout.areas||[]).map(a=>{
        if(a.id!==id) return a;
        let x = areaXTotalFt(a), y = areaYTotalFt(a);
        let w = areaWidthTotalFt(a), h = areaHeightTotalFt(a);

        const isShrink = t.dataset.action==="area_shrink";
        const s = isShrink ? -step : step;

        if(dir==="right"){ w = w + s; }
        if(dir==="down"){ h = h + s; }
        if(dir==="left"){ x = x - s; w = w + s; }
        if(dir==="up"){ y = y - s; h = h + s; }

        w = Math.max(0.5, w);
        h = Math.max(0.5, h);

        if(x < 0){ w = Math.max(0.5, w + x); x = 0; }
        if(y < 0){ h = Math.max(0.5, h + y); y = 0; }

        if(x + w > r.W){ w = Math.max(0.5, r.W - x); }
        if(y + h > r.L){ h = Math.max(0.5, r.L - y); }

        x = clamp(x, 0, Math.max(0, r.W - w));
        y = clamp(y, 0, Math.max(0, r.L - h));

        x = snap(x); y = snap(y); w = snap(w); h = snap(h);

        if(x + w > r.W){ w = Math.max(0.5, r.W - x); }
        if(y + h > r.L){ h = Math.max(0.5, r.L - y); }

        return {...a, xFt:x, xIn:0, yFt:y, yIn:0, widthFt:w, widthIn:0, heightFt:h, heightIn:0};
      });

      render();
      return;
    }

    // Layout area remove
    if(t.dataset.action==="removeArea"){
      const id = t.dataset.id;
      state.layout.areas = (state.layout.areas||[]).filter(a=>a.id!==id);
      if(state.layout.selectedAreaId===id) state.layout.selectedAreaId = null;
      render(); return;
    }
  };

  // Input changes (delegated)
  document.body.oninput = (e)=>{
    let t = e.target;
    if(t && t.nodeType === 3 && t.parentElement) t = t.parentElement;
    if(!t || !(t instanceof HTMLElement)) return;

    // Layout selector
    if(t.dataset.action==="layout_select"){
      const id = t.value;
      if(state.setActiveLayout) state.setActiveLayout(id);
      state.tab = "layout";
      render();
      return;
    }

    // Compare set selector (on change)
    if(t.dataset.action==="compareSet_select"){
      const id = t.value;
      if(!id) return;
      if((state.layout.compareSets||[]).some(s=> s.id === id)){
        state.layout.activeCompareSetId = id;
        render();
      }
      return;
    }

    // Wall extension edits (ft + in fields; geometry uses totals)
    if(t.dataset.action==="we_label" || t.dataset.action==="we_wall" ||
       t.dataset.action==="we_start_ft" || t.dataset.action==="we_start_in" ||
       t.dataset.action==="we_length_ft" || t.dataset.action==="we_length_in" ||
       t.dataset.action==="we_depth_ft" || t.dataset.action==="we_depth_in"){
      const id = t.dataset.id;
      state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=>{
        if(w.id!==id) return w;
        const next = {...w};
        if(t.dataset.action==="we_label") next.label = t.value;
        if(t.dataset.action==="we_wall") next.wall = t.value || "right";
        if(t.dataset.action==="we_start_ft") next.startFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="we_start_in") next.startIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="we_length_ft") next.lengthFt = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="we_length_in") next.lengthIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="we_depth_ft") next.depthFt = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="we_depth_in") next.depthIn = Math.max(0, safeNum(t.value));
        if(safeNum(next.lengthFt) + safeNum(next.lengthIn)/12 < 0.5 - 1e-9){ next.lengthFt = 0.5; next.lengthIn = 0; }
        if(safeNum(next.depthFt) + safeNum(next.depthIn)/12 < 0.5 - 1e-9){ next.depthFt = 0.5; next.depthIn = 0; }
        return next;
      });
      state._roomCache = null;
      render(); return;
    }

    // Ceiling zone edits
    if(t.dataset.action==="cz_label"){
      const id = t.dataset.id;
      state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, label: t.value} : z);
      render(); return;
    }
    if(t.dataset.action && /^cz_(ceiling|x|y|w|h)_(ft|in)$/.test(t.dataset.action)){
      const id = t.dataset.id;
      state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=>{
        if(z.id!==id) return z;
        const next = {...z};
        const v = safeNum(t.value);
        if(t.dataset.action==="cz_ceiling_ft") next.ceilingHeightFt = Math.max(0, snap(v));
        if(t.dataset.action==="cz_ceiling_in") next.ceilingHeightIn = Math.max(0, v);
        if(t.dataset.action==="cz_x_ft") next.xFt = snap(Math.max(0, v));
        if(t.dataset.action==="cz_x_in") next.xIn = Math.max(0, v);
        if(t.dataset.action==="cz_y_ft") next.yFt = snap(Math.max(0, v));
        if(t.dataset.action==="cz_y_in") next.yIn = Math.max(0, v);
        if(t.dataset.action==="cz_w_ft") next.widthFt = Math.max(0, v);
        if(t.dataset.action==="cz_w_in") next.widthIn = Math.max(0, v);
        if(t.dataset.action==="cz_h_ft") next.heightFt = Math.max(0, v);
        if(t.dataset.action==="cz_h_in") next.heightIn = Math.max(0, v);
        if(safeNum(next.widthFt) + safeNum(next.widthIn)/12 < 0.5 - 1e-9){ next.widthFt = 0.5; next.widthIn = 0; }
        if(safeNum(next.heightFt) + safeNum(next.heightIn)/12 < 0.5 - 1e-9){ next.heightFt = 0.5; next.heightIn = 0; }
        return next;
      });
      render(); return;
    }

    // Floor zone edits
    if(t.dataset.action && t.dataset.action.startsWith("fz_")){
      const id = t.dataset.id;
      state.layout.floorZones = (state.layout.floorZones||[]).map(z=>{
        if(z.id!==id) return z;
        const next = {...z};
        if(t.dataset.action==="fz_label") next.label = t.value;
        if(t.dataset.action==="fz_elev") next.elevationIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fz_x_ft") next.xFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="fz_x_in") next.xIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fz_y_ft") next.yFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="fz_y_in") next.yIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fz_w_ft") next.widthFt = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fz_w_in") next.widthIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fz_d_ft") next.heightFt = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fz_d_in") next.heightIn = Math.max(0, safeNum(t.value));
        if(safeNum(next.widthFt) + safeNum(next.widthIn)/12 < 0.5 - 1e-9){ next.widthFt = 0.5; next.widthIn = 0; }
        if(safeNum(next.heightFt) + safeNum(next.heightIn)/12 < 0.5 - 1e-9){ next.heightFt = 0.5; next.heightIn = 0; }
        return next;
      });
      render(); return;
    }

    // Flooring piece edits
    if(t.dataset.action && t.dataset.action.startsWith("fp_")){
      const id = t.dataset.id;
      state.layout.flooringPieces = (state.layout.flooringPieces||[]).map(f=>{
        if(f.id!==id) return f;
        const next = {...f};
        if(t.dataset.action==="fp_type"){
          next.typeId = t.value || "stall_mat_4x6";
          next.price = safeNum((state.settings.flooringPrices||{})[next.typeId] ?? getFlooringType(next.typeId).defaultPrice);
        }
        if(t.dataset.action==="fp_label") next.label = t.value;
        if(t.dataset.action==="fp_price"){
          next.price = Math.max(0, safeNum(t.value));
          state.settings.flooringPrices = {...DEFAULT_FLOORING_PRICES, ...(state.settings.flooringPrices||{}), [next.typeId]: next.price};
        }
        if(t.dataset.action==="fp_x_ft") next.xFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="fp_x_in") next.xIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="fp_y_ft") next.yFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="fp_y_in") next.yIn = Math.max(0, safeNum(t.value));
        return next;
      });
      render(); return;
    }

    // Compare prompt textarea - save live
    if(t.id === "comparePromptArea"){
      state.comparePrompt = t.value;
      return;
    }

    // Compare checkbox change (input[type=checkbox])
    if(t.dataset.action === "toggleCompare" && t instanceof HTMLInputElement && t.type === "checkbox"){
      const id = t.dataset.id;
      if(!id) return;
      const set = new Set(state.compareSelectedIds || []);
      if(t.checked) set.add(id); else set.delete(id);
      state.compareSelectedIds = Array.from(set);
      state.compareResult = null;
      render();
      return;
    }

    // Update draft live (only in wishlist tab)
    if(state.tab==="wishlist"){
      const map = {
        f_name:"name", f_brand:"brand", f_category:"category", f_status:"status", f_priority:"priority",
        f_qty:"qty", f_unit:"unit", f_length:"length", f_width:"width", f_height:"height",
        f_lengthIn:"lengthIn", f_widthIn:"widthIn", f_heightIn:"heightIn",
        f_requiredCeilingFt:"requiredCeilingFt", f_powerVoltage:"powerVoltage", f_powerAmps:"powerAmps", f_outletNotes:"outletNotes",
        f_price:"price", f_fees:"fees",
        f_productLink:"productLink", f_notes:"notes",
        f_rackHolePattern:"rackHolePattern", f_rackCustomSpec:"rackCustomSpec", f_equipmentTags:"equipmentTags",
        f_model3dFamily:"model3dFamily", f_model3dProfile:"model3dProfile", f_model3dFacing:"model3dFacing",
        f_model3dAssetRotation:"model3dAssetRotation",
      };
      const key = map[t.id];
      if(key){
        let val = (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) ? t.value : state.draft[key];
        if(key === "equipmentTags"){
          // equipmentTags are now managed by toggle buttons only; skip text parsing
          return;
        }
        if(key==="length" || key==="width" || key==="height" || key==="lengthIn" || key==="widthIn" || key==="heightIn"){
          val = t.value==="" ? "" : safeNum(t.value);
        }
        if(key==="model3dAssetRotation") val=normalizedModelAssetRotation(val);
        let nextDraft = {...state.draft, [key]: val};
        if(key === "model3dFamily") nextDraft = {...nextDraft, model3dProfile:"auto"};
        if(key === "unit" && val !== "ft"){
          nextDraft = {...nextDraft, lengthIn:"", widthIn:"", heightIn:""};
        }
        state.draft = nextDraft;
        
        // Re-render for category / unit change (rack fields, ft+inch rows) or product URL (open-link row)
        if(key === "category" || key === "unit" || key === "productLink" || key === "model3dFamily" || key === "model3dProfile"){
          render();
          return;
        }

        updateDraftPreview();
        return;
      }
    }

    // Layout selected inst numeric edits (ft + in)
    if(t.dataset.action==="inst_x_ft"){
      patchInst(t.dataset.id, {xFt: snap(Math.max(0, safeNum(t.value)))}); return;
    }
    if(t.dataset.action==="inst_x_in"){
      patchInst(t.dataset.id, {xIn: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="inst_y_ft"){
      patchInst(t.dataset.id, {yFt: snap(Math.max(0, safeNum(t.value)))}); return;
    }
    if(t.dataset.action==="inst_y_in"){
      patchInst(t.dataset.id, {yIn: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="inst_ds_ft" || t.dataset.action==="inst_ds_in"){
      const id = t.dataset.id;
      const inst = (state.layout.instances||[]).find(I=>I.id===id);
      if(!inst) return;
      let ft = inst.deadspaceFt;
      let inch = inst.deadspaceIn ?? 0;
      if(t.dataset.action==="inst_ds_ft") ft = (t.value==="" ? null : snap(safeNum(t.value)));
      if(t.dataset.action==="inst_ds_in") inch = Math.max(0, safeNum(t.value));
      const ftEmpty = (ft===null || ft===undefined || ft==="");
      if(ftEmpty && inch<=0) patchInst(id, {deadspaceFt:null, deadspaceIn:0});
      else patchInst(id, {deadspaceFt: ftEmpty ? 0 : ft, deadspaceIn: inch});
      return;
    }

    if(t.dataset.action==="area_kind"){
      patchArea(t.dataset.id, {kind: t.value}); return;
    }
    if(t.dataset.action==="wf_kind"){
      patchWallFeature(t.dataset.id, {kind:t.value}); return;
    }
    if(t.dataset.action==="wf_label"){
      patchWallFeature(t.dataset.id, {label:t.value}); return;
    }
    if(t.dataset.action==="wf_wall"){
      patchWallFeature(t.dataset.id, {wall:t.value}); return;
    }
    if(t.dataset.action==="wf_color"){
      patchWallFeature(t.dataset.id, {color:t.value}); return;
    }
    if(t.dataset.action==="wf_brightness"){
      patchWallFeature(t.dataset.id, {brightnessPct:clamp(safeNum(t.value),0,100)}); return;
    }
    if(t.dataset.action==="wf_start_ft"){
      patchWallFeature(t.dataset.id, {startFt:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_start_in"){
      patchWallFeature(t.dataset.id, {startIn:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_bottom_ft"){
      patchWallFeature(t.dataset.id, {bottomFt:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_bottom_in"){
      patchWallFeature(t.dataset.id, {bottomIn:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_width_ft"){
      patchWallFeature(t.dataset.id, {widthFt:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_width_in"){
      patchWallFeature(t.dataset.id, {widthIn:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_height_ft"){
      patchWallFeature(t.dataset.id, {heightFt:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="wf_height_in"){
      patchWallFeature(t.dataset.id, {heightIn:Math.max(0,safeNum(t.value))}); return;
    }
    if(t.dataset.action==="area_label"){
      patchArea(t.dataset.id, {label: t.value}); return;
    }
    if(t.dataset.action==="area_x_ft"){
      patchArea(t.dataset.id, {xFt: snap(Math.max(0, safeNum(t.value)))}); return;
    }
    if(t.dataset.action==="area_x_in"){
      patchArea(t.dataset.id, {xIn: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="area_y_ft"){
      patchArea(t.dataset.id, {yFt: snap(Math.max(0, safeNum(t.value)))}); return;
    }
    if(t.dataset.action==="area_y_in"){
      patchArea(t.dataset.id, {yIn: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="area_w_ft"){
      patchArea(t.dataset.id, {widthFt: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="area_w_in"){
      patchArea(t.dataset.id, {widthIn: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="area_h_ft"){
      patchArea(t.dataset.id, {heightFt: Math.max(0, safeNum(t.value))}); return;
    }
    if(t.dataset.action==="area_h_in"){
      patchArea(t.dataset.id, {heightIn: Math.max(0, safeNum(t.value))}); return;
    }

    // Door swing settings
    if(t.dataset.action==="area_doorEnabled"){
      const id = t.dataset.id;
      const on = String(t.value)==="true";
      patchArea(id, {doorClearEnabled: on});
      return;
    }
    if(t.dataset.action==="area_doorOrientation"){
      const id = t.dataset.id;
      patchArea(id, {doorOrientation: t.value || "auto"});
      return;
    }
    if(t.dataset.action==="area_doorSwing"){
      const id = t.dataset.id;
      patchArea(id, {doorSwing: t.value || "down"});
      return;
    }
    if(t.dataset.action==="area_doorHinge"){
      const id = t.dataset.id;
      patchArea(id, {doorHinge: t.value || "start"});
      return;
    }
    if(t.dataset.action==="area_doorRadius_ft" || t.dataset.action==="area_doorRadius_in"){
      const id = t.dataset.id;
      const a = (state.layout.areas||[]).find(A=>A.id===id);
      if(!a) return;
      let ft = a.doorRadiusFt;
      let inch = a.doorRadiusIn ?? 0;
      if(t.dataset.action==="area_doorRadius_ft") ft = (t.value==="" ? null : snap(safeNum(t.value)));
      if(t.dataset.action==="area_doorRadius_in") inch = Math.max(0, safeNum(t.value));
      const ftEmpty = (ft===null || ft===undefined || ft==="");
      if(ftEmpty && inch<=0) patchArea(id, {doorRadiusFt:null, doorRadiusIn:0});
      else patchArea(id, {doorRadiusFt: ftEmpty ? 0 : ft, doorRadiusIn: inch});
      return;
    }

    // Outlet edits
    if(t.dataset.action==="out_label" || t.dataset.action==="out_voltage" ||
       t.dataset.action==="out_x_ft" || t.dataset.action==="out_x_in" ||
       t.dataset.action==="out_y_ft" || t.dataset.action==="out_y_in"){
      const id = t.dataset.id;
      state.layout.outlets = (state.layout.outlets||[]).map(o=>{
        if(o.id!==id) return o;
        const next = {...o};
        if(t.dataset.action==="out_label") next.label = t.value;
        if(t.dataset.action==="out_voltage") next.voltage = t.value || "120V";
        if(t.dataset.action==="out_x_ft") next.xFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="out_x_in") next.xIn = Math.max(0, safeNum(t.value));
        if(t.dataset.action==="out_y_ft") next.yFt = snap(Math.max(0, safeNum(t.value)));
        if(t.dataset.action==="out_y_in") next.yIn = Math.max(0, safeNum(t.value));
        const tx = outletXTotalFt(next), ty = outletYTotalFt(next);
        const b = room().bounds;
        const cx = clamp(tx, b.minX, b.maxX);
        const cy = clamp(ty, b.minY, b.maxY);
        const sx = splitTotalFtToFtIn(cx);
        const sy = splitTotalFtToFtIn(cy);
        next.xFt = snap(sx.ft);
        next.xIn = sx.inch;
        next.yFt = snap(sy.ft);
        next.yIn = sy.inch;
        if(!pointInRoom(outletXTotalFt(next), outletYTotalFt(next), room().rects)) return o;
        return next;
      });
      render();
      return;
    }

    function patchInst(id, patch){
      state.layout.instances = (state.layout.instances||[]).map(x=>{
        if(x.id!==id) return x;
        const it = getItemById(x.itemId);
        if(!it) return {...x, ...patch};
        const keys = Object.keys(patch);
        const posTouch = keys.some(k=>["xFt","xIn","yFt","yIn"].includes(k));
        const next = {...x, ...patch};
        if(!posTouch){
          const er = effectiveRectForInst(next, it);
          next.__invalid = isInvalidPlacement(id, er.base, er.eff);
          return next;
        }
        // Allow manual position editing without clamping to bounds
        // User can type negative coords for left/top extensions
        const er = effectiveRectForInst(next, it);
        next.__invalid = isInvalidPlacement(id, er.base, er.eff);
        return next;
      });
      render();
    }

    function patchArea(id, patch){
      state.layout.areas = (state.layout.areas||[]).map(a=>{
        if(a.id!==id) return a;
        const keys = Object.keys(patch);
        const geomTouch = keys.some(k=>["xFt","xIn","yFt","yIn","widthFt","widthIn","heightFt","heightIn","kind"].includes(k));
        const next = {...a, ...patch};
        if(!geomTouch) return next;
        const tw = areaWidthTotalFt(next), th = areaHeightTotalFt(next), tx = areaXTotalFt(next), ty = areaYTotalFt(next);
        const rect = clampRectToBounds({x:tx, y:ty, w:Math.max(.5,tw), h:Math.max(.5,th)}, room().bounds);
        const sx = splitTotalFtToFtIn(rect.x);
        const sy = splitTotalFtToFtIn(rect.y);
        const sw = splitTotalFtToFtIn(rect.w);
        const sh = splitTotalFtToFtIn(rect.h);
        next.xFt = snap(sx.ft);
        next.xIn = sx.inch;
        next.yFt = snap(sy.ft);
        next.yIn = sy.inch;
        next.widthFt = snap(sw.ft);
        next.widthIn = sw.inch;
        next.heightFt = snap(sh.ft);
        next.heightIn = sh.inch;
        {
          const test = areaRect(next);
          if(!rectInsideRoom(test)) return a;
        }
        return next;
      });
      render();
    }
  };

  // Layout SVG pointer events
  if(state.tab==="layout"){
    const svg = $("#layoutSvg");
    if(svg){
      svg.onpointerdown = (e)=>{
        const target = e.target;

        // Quick actions inside SVG (e.g., delete X on selected equipment)
        const actionEl = target.closest && target.closest("[data-action]");
        if(actionEl && actionEl.dataset.action==="removeInst"){
          const id = actionEl.dataset.id;
          state.layout.instances = (state.layout.instances||[]).filter(x=>x.id!==id);
          if(state.layout.selectedInstId===id) state.layout.selectedInstId = null;
          render();
          return;
        }
        if(actionEl && actionEl.dataset.action==="rotateInst"){
          // The delegated click route is the sole pointer activation path for
          // this SVG action. Returning here keeps the gesture out of drag
          // handling without rotating once on pointerdown and again on click.
          return;
        }
        // Photo-hint shortcut (fires global click handler; we stop here to
        // prevent the rest of the pointerdown (drag start / selection) from
        // interfering).
        if(actionEl && actionEl.dataset.action==="editItemPhoto"){
          return;
        }
        // Compare zone actions (in-SVG): handled here so they don't start a
        // drag or interfere with item selection.
        if(actionEl && actionEl.dataset.action==="removeCompareLayout"){
          const id = actionEl.dataset.id;
          const set = getActiveCompareSet();
          set.items = set.items.filter(e=> e && e.itemId !== id);
          render();
          return;
        }
        if(actionEl && actionEl.dataset.action==="clearCompareLayout"){
          const set = getActiveCompareSet();
          set.items = [];
          render();
          return;
        }
        if(actionEl && actionEl.dataset.action==="rotateCompareLayout"){
          const id = actionEl.dataset.id;
          const set = getActiveCompareSet();
          const entry = set.items.find(e=> e && e.itemId === id);
          if(entry){
            entry.rotated = !entry.rotated;
            render();
          }
          return;
        }

        // Resize handles
        const handleEl = target.closest && target.closest("[data-resize]");
        if(handleEl){
          const kind = handleEl.dataset.resize;
          const id = handleEl.dataset.id;
          const handle = handleEl.dataset.handle;
          const p = clientToSvgPoint(svg, e.clientX, e.clientY);

          if(kind==="area"){
            const area = (state.layout.areas||[]).find(a=>a.id===id);
            if(!area) return;
            clearAllSelections();
            state.layout.selectedAreaId = id;

            const rect = areaRect(area);
            state.drag = {active:true, type:"resize-area", id, handle, start:p, origin:{x:rect.x,y:rect.y}, originRect:rect};
            svg.setPointerCapture(e.pointerId);
            render();
            return;
          }

          if(kind==="wallext"){
            const we = (state.layout.wallExtensions||[]).find(w=>w.id===id);
            if(!we) return;
            clearAllSelections();
            state.layout.selectedWallExtId = id;

            const r = room();
            const rect = wallExtToRect(we, r.W, r.L);
            state.drag = {active:true, type:"resize-wallext", id, handle, start:p, origin:{x:rect.x,y:rect.y}, originRect:rect, origWe: deepCopy(we)};
            svg.setPointerCapture(e.pointerId);
            render();
            return;
          }

          if(kind==="ceilzone"){
            const cz = (state.layout.ceilingZones||[]).find(z=>z.id===id);
            if(!cz) return;
            clearAllSelections();
            state.layout.selectedCeilingZoneId = id;

            const rect = {x: ceilingZoneXTotalFt(cz), y: ceilingZoneYTotalFt(cz), w: ceilingZoneWidthTotalFt(cz), h: ceilingZoneDepthTotalFt(cz)};
            state.drag = {active:true, type:"resize-ceilzone", id, handle, start:p, origin:{x:rect.x,y:rect.y}, originRect:rect};
            svg.setPointerCapture(e.pointerId);
            render();
            return;
          }

          if(kind==="floorzone"){
            const fz = (state.layout.floorZones||[]).find(z=>z.id===id);
            if(!fz) return;
            clearAllSelections();
            state.layout.selectedFloorZoneId = id;

            const rect = {x: floorZoneXTotalFt(fz), y: floorZoneYTotalFt(fz), w: floorZoneWidthTotalFt(fz), h: floorZoneDepthTotalFt(fz)};
            state.drag = {active:true, type:"resize-floorzone", id, handle, start:p, origin:{x:rect.x,y:rect.y}, originRect:rect};
            svg.setPointerCapture(e.pointerId);
            render();
            return;
          }
        }

        // Normal selection / drag
        const g = target.closest && target.closest("g[data-type]");
        if(!g) return;
        const type = g.dataset.type;
        const id = g.dataset.id;
        const p = clientToSvgPoint(svg, e.clientX, e.clientY);

        clearAllSelections();

        if(type==="inst"){
          const inst = (state.layout.instances||[]).find(x=>x.id===id);
          if(!inst) return;
          state.layout.selectedInstId = id;
          state.drag = {active:true, type:"inst", id, start:p, origin:{x: instXTotalFt(inst), y: instYTotalFt(inst)}, invalid:false};
        }else if(type==="wallfeature"){
          const feature=(state.layout.wallFeatures||[]).find(x=>x.id===id);
          if(!feature) return;
          state.layout.selectedWallFeatureId=id;
          state.drag={active:true,type:"wallfeature",id,start:p,origin:{startFt:GymWallFeatures.start(feature),wall:feature.wall},invalid:false};
          startWallFeatureDrag(e.pointerId);
          render();
          return;
        }else if(type==="area"){
          const area = (state.layout.areas||[]).find(a=>a.id===id);
          if(!area) return;
          state.layout.selectedAreaId = id;
          const ar = areaRect(area);
          state.drag = {active:true, type:"area", id, start:p, origin:{x: ar.x, y: ar.y}, invalid:false};
        }else if(type==="outlet"){
          const o = (state.layout.outlets||[]).find(x=>x.id===id);
          if(!o) return;
          state.layout.selectedOutletId = id;
          state.drag = {active:true, type:"outlet", id, start:p, origin:{x: outletXTotalFt(o), y: outletYTotalFt(o)}, invalid:false};
        }else if(type==="wallext"){
          const we = (state.layout.wallExtensions||[]).find(x=>x.id===id);
          if(!we) return;
          state.layout.selectedWallExtId = id;
          state.drag = {active:true, type:"wallext", id, start:p, origin:{startFt: wallExtStartTotalFt(we)}, invalid:false, origWe: deepCopy(we)};
        }else if(type==="ceilzone"){
          const cz = (state.layout.ceilingZones||[]).find(x=>x.id===id);
          if(!cz) return;
          state.layout.selectedCeilingZoneId = id;
          state.drag = {active:true, type:"ceilzone", id, start:p, origin:{x: ceilingZoneXTotalFt(cz), y: ceilingZoneYTotalFt(cz)}, invalid:false};
        }else if(type==="floorzone"){
          const fz = (state.layout.floorZones||[]).find(x=>x.id===id);
          if(!fz) return;
          state.layout.selectedFloorZoneId = id;
          state.drag = {active:true, type:"floorzone", id, start:p, origin:{x: floorZoneXTotalFt(fz), y: floorZoneYTotalFt(fz)}, invalid:false};
        }else if(type==="flooring"){
          const fp = (state.layout.flooringPieces||[]).find(x=>x.id===id);
          if(!fp) return;
          state.layout.selectedFlooringId = id;
          state.drag = {active:true, type:"flooring", id, start:p, origin:{x: flooringXTotalFt(fp), y: flooringYTotalFt(fp)}, invalid:false};
        }else if(type==="compareItem"){
          // Drag an item out of the compare zone. Dropping it in the compare
          // zone saves a custom xFt/yFt on the entry; dropping it in staging
          // or the room creates a real instance at that position and removes
          // it from the compare set; dropping anywhere else restores it.
          const set = getActiveCompareSet();
          const entryIdx = set.items.findIndex(e=> e && e.itemId === id);
          if(entryIdx < 0) return;
          const r2 = room();
          const entries = set.items.map(e=>{
            const itm = getItemById(e.itemId);
            return itm ? { item: itm, entry: e } : null;
          }).filter(Boolean);
          const cmp = layoutCompareLayout(r2, entries);
          const placed = cmp.placed.find(pp=> pp.item && pp.item.id === id);
          if(!placed) return;
          state.drag = {
            active: true,
            type: "compareDrag",
            id,
            entryIdx,
            start: p,
            origin: { x: placed.x, y: placed.y, w: placed.w, h: placed.h },
            origEntry: { ...set.items[entryIdx] },
            zoneOrigin: { x: cmp.zone.x, y: cmp.zone.y },
            invalid: false,
          };
        }

        svg.setPointerCapture(e.pointerId);
        render();
      };

      svg.onpointermove = (e)=>{
        if(!state.drag.active) return;
        if(state.drag.type==="wallfeature") return;
        const p = clientToSvgPoint(svg, e.clientX, e.clientY);
        const dx = p.x - state.drag.start.x;
        const dy = p.y - state.drag.start.y;

        const r = room();

        function applyResize(originRect, handle){
          let x = originRect.x, y = originRect.y, w = originRect.w, h = originRect.h;

          if(handle.includes("e")) w = w + dx;
          if(handle.includes("s")) h = h + dy;
          if(handle.includes("w")){ x = x + dx; w = w - dx; }
          if(handle.includes("n")){ y = y + dy; h = h - dy; }

          if(w < 0.5){
            if(handle.includes("w")) x = x - (0.5 - w);
            w = 0.5;
          }
          if(h < 0.5){
            if(handle.includes("n")) y = y - (0.5 - h);
            h = 0.5;
          }

          x = snap(x); y = snap(y); w = snap(w); h = snap(h);

          return {x,y,w,h};
        }

        if(state.drag.type==="resize-area"){
          const id = state.drag.id;
          const handle = state.drag.handle || "se";
          const originRect = state.drag.originRect;

          const nextRect = applyResize(originRect, handle);
          const rect = clampRectToBounds(nextRect, r.bounds);

          if(!rectInsideRoom(rect)) return;

          state.layout.areas = (state.layout.areas||[]).map(a=> a.id===id ? {...a, xFt: rect.x, xIn: 0, yFt: rect.y, yIn: 0, widthFt: rect.w, widthIn: 0, heightFt: rect.h, heightIn: 0} : a);
          render();
          return;
        }

        if(state.drag.type==="resize-wallext"){
          const id = state.drag.id;
          const handle = state.drag.handle || "se";
          const origWe = state.drag.origWe;
          if(!origWe) return;

          const wall = origWe.wall;
          const isHoriz = (wall==="left"||wall==="right");
          const oS = wallExtStartTotalFt(origWe);
          const oL = wallExtLengthTotalFt(origWe);
          const oD = wallExtDepthTotalFt(origWe);

          state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=>{
            if(w.id!==id) return w;

            let start = oS, len = oL, dep = oD;

            if(isHoriz){
              if(handle.includes("n")) start = snap(Math.max(0, oS + dy));
              if(handle.includes("s")){
                const newEnd = oS + oL + dy;
                len = Math.max(0.5, snap(newEnd - start));
              }
              if(handle.includes("e") && wall==="right") dep = Math.max(0.5, snap(oD + dx));
              if(handle.includes("w") && wall==="left") dep = Math.max(0.5, snap(oD - dx));
              if(handle.includes("e") && wall==="left") dep = Math.max(0.5, snap(oD - dx));
              if(handle.includes("w") && wall==="right") dep = Math.max(0.5, snap(oD - dx));
            } else {
              if(handle.includes("w")) start = snap(Math.max(0, oS + dx));
              if(handle.includes("e")){
                const newEnd = oS + oL + dx;
                len = Math.max(0.5, snap(newEnd - start));
              }
              if(handle.includes("s") && wall==="bottom") dep = Math.max(0.5, snap(oD + dy));
              if(handle.includes("n") && wall==="top") dep = Math.max(0.5, snap(oD - dy));
              if(handle.includes("s") && wall==="top") dep = Math.max(0.5, snap(oD - dy));
              if(handle.includes("n") && wall==="bottom") dep = Math.max(0.5, snap(oD - dy));
            }

            return {...w, startFt: start, startIn: 0, lengthFt: len, lengthIn: 0, depthFt: dep, depthIn: 0};
          });
          state._roomCache = null;
          render();
          return;
        }

        if(state.drag.type==="resize-ceilzone"){
          const id = state.drag.id;
          const handle = state.drag.handle || "se";
          const originRect = state.drag.originRect;
          const nextRect = applyResize(originRect, handle);

          state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=> z.id===id ? {...z, xFt: nextRect.x, xIn: 0, yFt: nextRect.y, yIn: 0, widthFt: nextRect.w, widthIn: 0, heightFt: nextRect.h, heightIn: 0} : z);
          render();
          return;
        }

        if(state.drag.type==="resize-floorzone"){
          const id = state.drag.id;
          const handle = state.drag.handle || "se";
          const originRect = state.drag.originRect;
          const nextRect = applyResize(originRect, handle);

          state.layout.floorZones = (state.layout.floorZones||[]).map(z=> z.id===id ? {...z, xFt: nextRect.x, xIn: 0, yFt: nextRect.y, yIn: 0, widthFt: nextRect.w, widthIn: 0, heightFt: nextRect.h, heightIn: 0} : z);
          render();
          return;
        }

        if(state.drag.type==="area"){
          const id = state.drag.id;
          state.layout.areas = (state.layout.areas||[]).map(a=>{
            if(a.id!==id) return a;
            const next = {...a};
            const ow = areaWidthTotalFt(a), oh = areaHeightTotalFt(a);
            next.xFt = snap(state.drag.origin.x + dx);
            next.yFt = snap(state.drag.origin.y + dy);
            next.xIn = 0;
            next.yIn = 0;
            const rect = clampRectToBounds({x:next.xFt,y:next.yFt,w:ow,h:oh}, r.bounds);
            next.xFt = rect.x; next.yFt = rect.y;
            const test = {x: next.xFt, y: next.yFt, w: ow, h: oh};
            if(!rectInsideRoom(test)) return a;
            return next;
          });
          render();
          return;
        }

        if(state.drag.type==="outlet"){
          const id = state.drag.id;
          state.layout.outlets = (state.layout.outlets||[]).map(o=>{
            if(o.id!==id) return o;
            const nx = snap(state.drag.origin.x + dx);
            const ny = snap(state.drag.origin.y + dy);
            const x = clamp(nx, r.bounds.minX, r.bounds.maxX);
            const y = clamp(ny, r.bounds.minY, r.bounds.maxY);
            if(!pointInRoom(x, y, r.rects)) return o;
            return {...o, xFt:x, xIn:0, yFt:y, yIn:0};
          });
          render();
          return;
        }

        if(state.drag.type==="wallext"){
          const id = state.drag.id;
          const origWe = state.drag.origWe;
          if(!origWe) return;
          const isHoriz = (origWe.wall==="left"||origWe.wall==="right");
          const delta = isHoriz ? dy : dx;

          state.layout.wallExtensions = (state.layout.wallExtensions||[]).map(w=>{
            if(w.id!==id) return w;
            return {...w, startFt: snap(Math.max(0, state.drag.origin.startFt + delta)), startIn: 0};
          });
          state._roomCache = null;
          render();
          return;
        }

        if(state.drag.type==="ceilzone"){
          const id = state.drag.id;
          state.layout.ceilingZones = (state.layout.ceilingZones||[]).map(z=>{
            if(z.id!==id) return z;
            return {...z, xFt: snap(state.drag.origin.x + dx), xIn: 0, yFt: snap(state.drag.origin.y + dy), yIn: 0};
          });
          render();
          return;
        }

        if(state.drag.type==="floorzone"){
          const id = state.drag.id;
          state.layout.floorZones = (state.layout.floorZones||[]).map(z=>{
            if(z.id!==id) return z;
            return {...z, xFt: snap(state.drag.origin.x + dx), xIn: 0, yFt: snap(state.drag.origin.y + dy), yIn: 0};
          });
          render();
          return;
        }

        if(state.drag.type==="flooring"){
          const id = state.drag.id;
          state.layout.flooringPieces = (state.layout.flooringPieces||[]).map(f=>{
            if(f.id!==id) return f;
            return {...f, xFt: snap(state.drag.origin.x + dx), xIn: 0, yFt: snap(state.drag.origin.y + dy), yIn: 0};
          });
          render();
          return;
        }

        if(state.drag.type==="compareDrag"){
          const d = state.drag;
          const set = getActiveCompareSet();
          const idx = d.entryIdx;
          if(idx < 0 || idx >= set.items.length) return;
          const newX = d.origin.x + dx;
          const newY = d.origin.y + dy;
          // Save as offset relative to the compare zone's origin so the item
          // moves predictably even if the zone is resized later.
          set.items[idx] = { ...set.items[idx], xFt: newX - d.zoneOrigin.x, yFt: newY - d.zoneOrigin.y };
          render();
          return;
        }

        if(state.drag.type==="inst"){
          const id = state.drag.id;
          state.layout.instances = (state.layout.instances||[]).map(x=>{
            if(x.id!==id) return x;
            const it = getItemById(x.itemId);
            if(!it) return x;
            const next = {...x};
            const dims = instanceDims(next, it);
            const prevX = instXTotalFt(x);
            const prevY = instYTotalFt(x);
            const desiredX = snap(state.drag.origin.x + dx);
            const desiredY = snap(state.drag.origin.y + dy);
            const clamped = clampInstToRoom(desiredX, desiredY, dims.w, dims.h, prevX, prevY, r);
            // Wall magnetism: if the clamped position lands within ~4 inches of a
            // wall, attract the item edge to that wall exactly. Keeps things flush
            // to the wall even when the 0.5 ft snap grid would leave a small gap.
            const stuck = wallStick(clamped.x, clamped.y, dims.w, dims.h, 0.34);
            next.xFt = stuck.x;
            next.yFt = stuck.y;
            next.xIn = 0;
            next.yIn = 0;

            const er = effectiveRectForInst(next, it);
            const invalid = isInvalidPlacement(id, er.base, er.eff);
            next.__invalid = invalid;
            state.drag.invalid = invalid;
            return next;
          });
          render();
          return;
        }
      };

      svg.onpointerup = (e)=>{
        if(!state.drag.active) return;
        if(state.drag.type==="wallfeature") return;
        const drag = state.drag;
        svg.releasePointerCapture(e.pointerId);

        const r = room();

        if(drag.type==="resize-area"){
          const area = (state.layout.areas||[]).find(a=>a.id===drag.id);
          if(area){
            const rect = areaRect(area);
            if(!rectInsideRoom(rect)){
              state.layout.areas = (state.layout.areas||[]).map(a=> a.id===drag.id ? {...a, xFt: drag.originRect.x, xIn: 0, yFt: drag.originRect.y, yIn: 0, widthFt: drag.originRect.w, widthIn: 0, heightFt: drag.originRect.h, heightIn: 0} : a);
            }
          }
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        if(drag.type==="resize-wallext" || drag.type==="wallext"){
          state._roomCache = null;
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        if(drag.type==="resize-ceilzone" || drag.type==="ceilzone"){
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        if(drag.type==="resize-floorzone" || drag.type==="floorzone"){
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        if(drag.type==="flooring"){
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        if(drag.type==="outlet"){
          const id = drag.id;
          const o = (state.layout.outlets||[]).find(x=>x.id===id);
          if(o){
            if(!pointInRoom(safeNum(o.xFt), safeNum(o.yFt), r.rects)){
              state.layout.outlets = (state.layout.outlets||[]).map(x=> x.id===id ? {...x, xFt: drag.origin.x, xIn: 0, yFt: drag.origin.y, yIn: 0} : x);
            }
          }
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        if(drag.type==="compareDrag"){
          const set = getActiveCompareSet();
          const idx = drag.entryIdx;
          if(idx < 0 || idx >= set.items.length){
            state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
            render();
            return;
          }
          // Recompute the compare zone (it may have grown while dragging).
          const entry = set.items[idx];
          const itemX = drag.zoneOrigin.x + (typeof entry.xFt === "number" ? entry.xFt : 0);
          const itemY = drag.zoneOrigin.y + (typeof entry.yFt === "number" ? entry.yFt : 0);
          const w = drag.origin.w, h = drag.origin.h;
          const centerX = itemX + w / 2;
          const centerY = itemY + h / 2;

          const r2 = room();
          const staging = layoutStagingRect(r2);

          // Rebuild the compare zone rect using the latest entries (it grows
          // as items move) so we can test "still inside compare".
          const entriesNow = set.items.map(e=>{
            const itm = getItemById(e.itemId);
            return itm ? { item: itm, entry: e } : null;
          }).filter(Boolean);
          const cmpNow = layoutCompareLayout(r2, entriesNow);
          const zoneRect = cmpNow.zone;

          const inCompare = (centerX >= zoneRect.x && centerX <= zoneRect.x + zoneRect.w
                          && centerY >= zoneRect.y && centerY <= zoneRect.y + zoneRect.h);
          const inStaging = (centerX >= staging.x && centerX <= staging.x + staging.w
                          && centerY >= staging.y && centerY <= staging.y + staging.h);
          const inRoom = pointInRoom(centerX, centerY, r2.rects);

          if(inCompare){
            // Keep the new saved xFt/yFt (already written during pointermove).
          }else if(inStaging || inRoom){
            // Create a real instance at the drop position, then remove this
            // entry from the compare set.
            const item = getItemById(entry.itemId);
            if(item){
              const rotated = !!entry.rotated;
              const dims = instanceDims({ rotated }, item);
              // Use the visual top-left of the dragged rect as the spawn
              // position, snapped to the grid and clamped to the room.
              let spawnX = snap(itemX);
              let spawnY = snap(itemY);
              if(inRoom){
                const clamped = clampInstToRoom(spawnX, spawnY, dims.w, dims.h, spawnX, spawnY, r2);
                spawnX = clamped.x;
                spawnY = clamped.y;
              }
              const newInst = {
                id: uid("inst"),
                itemId: item.id,
                xFt: spawnX,
                xIn: 0,
                yFt: spawnY,
                yIn: 0,
                rotated,
                deadspaceFt: null,
                deadspaceIn: 0,
                deadspaceSides: null,
                __invalid: false,
              };
              state.layout.instances = [ ...(state.layout.instances||[]), newInst ];
              clearAllSelections();
              state.layout.selectedInstId = newInst.id;
            }
            set.items.splice(idx, 1);
          }else{
            // Dropped outside any valid drop zone — restore original entry.
            set.items[idx] = drag.origEntry;
          }
          state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
          render();
          return;
        }

        // snap-back only if the placement is HARD invalid (outside room or body-overlap).
        // Soft issues (halo/clearance overlap) stay visible as a warning but do not
        // prevent the user from sticking an item to a wall even if clearances touch.
        if(drag.type==="inst"){
          const inst = (state.layout.instances||[]).find(x=>x.id===drag.id);
          const it = inst ? getItemById(inst.itemId) : null;
          if(inst && it){
            const er = effectiveRectForInst(inst, it);
            const hardInvalid = isHardInvalidPlacement(inst.id, er.base);
            const softInvalid = !hardInvalid && isInvalidPlacement(inst.id, er.base, er.eff);
            if(hardInvalid){
              state.layout.instances = (state.layout.instances||[]).map(x=> x.id===inst.id ? {...x, xFt: drag.origin.x, xIn: 0, yFt: drag.origin.y, yIn: 0, __invalid:false} : x);
            }else{
              state.layout.instances = (state.layout.instances||[]).map(x=> x.id===inst.id ? {...x, __invalid: softInvalid} : x);
            }
          }
        }

        state.drag = {active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false};
        render();
      };

      svg.onkeydown=(e)=>{
        if(selectPlanAreaFromKeyboard(e)) return;
        if(e.key!=="Enter" && e.key!==" ") return;
        const rotate=e.target.closest && e.target.closest('[data-action="rotateInst"]');
        if(rotate){
          e.preventDefault();
          e.stopPropagation();
          rotateLayoutInstance90(rotate.dataset.id);
          return;
        }
        const inst=e.target.closest && e.target.closest('g[data-type="inst"]');
        if(inst){
          e.preventDefault();
          e.stopPropagation();
          clearAllSelections();
          state.layout.selectedInstId=inst.dataset.id;
          render();
          return;
        }
        const g=e.target.closest && e.target.closest('g[data-type="wallfeature"]');
        if(!g) return;
        e.preventDefault();
        clearAllSelections();
        state.layout.selectedWallFeatureId=g.dataset.id;
        render();
      };

  document.addEventListener("keydown", (e)=>{
    if(e.key !== "Escape") return;
    if(state.layout?.walkthroughOpen && !document.pointerLockElement){
      state.layout.walkthroughOpen = false;
      render();
      return;
    }
    const box = $("#imgLightbox");
    if(box && box.classList.contains("open")){
      box.classList.remove("open");
      box.setAttribute("aria-hidden","true");
      const img = $("#imgLightboxImg");
      const cap = $("#imgLightboxCaption");
      if(img) img.src = "";
      if(cap) cap.textContent = "";
      return;
    }
    if(state.exportDialogOpen){
      state.exportDialogOpen = false;
      render();
    }
  });
    }
  }
}

function wireLayoutGridContrast(){
  const sel = $("#layoutGridContrastSelect");
  if(!sel) return;
  sel.onchange = ()=>{
    state.settings.layoutGridContrast = clamp(Math.round(safeNum(sel.value)||1), 1, 3);
    render();
  };
}

function wireSpatialControls(){
  const updateSpatial=(patch)=>{
    state.layout.spatial3d={
      ...DEFAULT_LAYOUT.spatial3d,
      ...(state.layout.spatial3d||{}),
      ...patch,
    };
    render();
  };

  const wallColor=$("#spatialWallColor");
  if(wallColor){
    wallColor.onchange=()=>{
      const value=String(wallColor.value||"");
      updateSpatial({wallColor:["white","black"].includes(value) ? value : DEFAULT_LAYOUT.spatial3d.wallColor});
    };
  }

  const floorType=$("#spatialFloorType");
  if(floorType){
    floorType.onchange=()=>{
      const value=String(floorType.value||"");
      updateSpatial({floorType:["rolled-rubber","rubber-tiles","concrete"].includes(value) ? value : DEFAULT_LAYOUT.spatial3d.floorType});
    };
  }

  const fov=$("#spatialFov");
  if(fov){
    fov.onchange=()=>{
      updateSpatial({fovDeg:clamp(Math.round(safeNum(fov.value)||DEFAULT_LAYOUT.spatial3d.fovDeg),55,100)});
    };
  }

  const eyeHeight=$("#spatialEyeHeight");
  if(eyeHeight){
    eyeHeight.onchange=()=>{
      updateSpatial({eyeHeightFt:clamp(safeNum(eyeHeight.value)||5.67,4,7)});
    };
  }

  const labelMode=$("#spatialLabelMode");
  if(labelMode){
    labelMode.onchange=()=>{
      const value=String(labelMode.value||"");
      const next=["selected","hover","always","off"].includes(value) ? value : "selected";
      updateSpatial({labelMode:next,labels:next!=="off"});
    };
  }
}

function wireEquipmentModelControls(){
  document.querySelectorAll("[data-model-family-item]").forEach(select=>{
    select.onchange=()=>{
      const itemId=String(select.dataset.modelFamilyItem||"");
      const value=String(select.value||"auto");
      if(!itemId || !MODEL3D_FAMILIES.some(x=>x.value===value)) return;
      state.items=(state.items||[]).map(item=>item.id===itemId ? {...item,model3dFamily:value,model3dProfile:"auto"} : item);
      if(state.draft?.id===itemId) state.draft={...state.draft,model3dFamily:value,model3dProfile:"auto"};
      render();
    };
  });

  document.querySelectorAll("[data-model-facing-item]").forEach(select=>{
    select.onchange=()=>{
      const itemId=String(select.dataset.modelFacingItem||"");
      const value=select.value==="reverse" ? "reverse" : "default";
      if(!itemId) return;
      state.items=(state.items||[]).map(item=>item.id===itemId ? {...item,model3dFacing:value} : item);
      if(state.draft?.id===itemId) state.draft={...state.draft,model3dFacing:value};
      render();
    };
  });

  document.querySelectorAll("[data-model-profile-item]").forEach(select=>{
    select.onchange=()=>{
      const itemId=String(select.dataset.modelProfileItem||"");
      const value=String(select.value||"auto");
      if(!itemId || !MODEL3D_PROFILES.some(x=>x.value===value)) return;
      state.items=(state.items||[]).map(item=>item.id===itemId ? {...item,model3dProfile:value} : item);
      if(state.draft?.id===itemId) state.draft={...state.draft,model3dProfile:value};
      render();
    };
  });

  document.querySelectorAll("[data-model-asset-file-item]").forEach(input=>{
    input.onchange=async()=>{
      const itemId=String(input.dataset.modelAssetFileItem||"");
      const file=input.files?.[0];
      try{ input.value=""; }catch{}
      if(!itemId || !file) return;
      input.disabled=true;
      const status=input.closest("label")?.querySelector("[data-model-asset-label]");
      if(status) status.textContent="Loading model…";
      try{
        await attachModelAssetToItem(itemId,file);
      }catch(error){
        input.disabled=false;
        if(status) status.textContent="Try another .glb";
        alert(String(error?.message||error||"Could not add that GLB model."));
      }
    };
  });

  document.querySelectorAll("[data-remove-model-asset-item]").forEach(button=>{
    button.onclick=()=>detachModelAssetFromItem(String(button.dataset.removeModelAssetItem||""));
  });

  document.querySelectorAll("[data-model-asset-rotation-item]").forEach(select=>{
    select.onchange=()=>{
      const itemId=String(select.dataset.modelAssetRotationItem||"");
      if(!itemId) return;
      const rotation=normalizedModelAssetRotation(select.value);
      state.items=(state.items||[]).map(item=>item.id===itemId ? {...item,model3dAssetRotation:rotation} : item);
      if(state.editingId===itemId) state.draft={...state.draft,model3dAssetRotation:rotation};
      render();
    };
  });
}

function wireWishlistExtras(){
  const modelAssetFile=$("#f_model3dAssetFile");
  if(modelAssetFile){
    modelAssetFile.onchange=async()=>{
      const file=modelAssetFile.files?.[0];
      try{ modelAssetFile.value=""; }catch{}
      if(!file) return;
      modelAssetFile.disabled=true;
      const status=modelAssetFile.closest("label")?.querySelector("[data-model-asset-label]");
      if(status) status.textContent="Loading model…";
      try{
        await attachModelAssetToDraft(file);
      }catch(error){
        modelAssetFile.disabled=false;
        if(status) status.textContent="Try another .glb";
        alert(String(error?.message||error||"Could not add that GLB model."));
      }
    };
  }

  const removeModelAsset=$("#f_removeModel3dAsset");
  if(removeModelAsset) removeModelAsset.onclick=detachModelAssetFromDraft;

  const layoutUseChk = $("#f_layoutUseImage");
  if(layoutUseChk){
    layoutUseChk.onchange = ()=>{
      state.draft = {...state.draft, layoutUseImage: !!layoutUseChk.checked};
      render();
    };
  }
  const clearLayoutImg = $("#f_clearLayoutImage");
  if(clearLayoutImg){
    clearLayoutImg.onclick = ()=>{
      state.draft = {...state.draft, layoutImageDataUrl: "", layoutUseImage: false};
      render();
    };
  }

  const layoutImg = $("#f_layoutImage");
  if(layoutImg){
    layoutImg.onchange = (e)=>{
      const input = e.target;
      const file = input.files && input.files[0];
      try{ input.value = ""; }catch{}
      if(!file) return;
      compressImageFileToDataUrl(file, 520, 0.82).then(dataUrl=>{
        if(String(dataUrl).length > 520000){
          alert("That image is still too large after compression. Try a smaller or simpler photo.");
          return;
        }
        state.draft = {...state.draft, layoutImageDataUrl: dataUrl, layoutUseImage: true};
        render();
      }).catch(err=>{
        alert(String(err && err.message ? err.message : err) || "Could not process image.");
      });
    };
  }

  const sel = $("#wishlistSortSelect");
  if(sel){
    sel.onchange = ()=>{
      const v = String(sel.value||"").trim();
      state.settings.wishlistSort = WISHLIST_SORT_OPTIONS.some(o=> o.value===v) ? v : "dateAdded";
      render();
    };
  }

  const groupSel = $("#wishlistGroupSelect");
  if(groupSel){
    groupSel.onchange = ()=>{
      const v = String(groupSel.value||"").trim();
      state.settings.wishlistGroupBy = WISHLIST_GROUP_OPTIONS.some(o=> o.value===v) ? v : "category";
      render();
    };
  }

  const brandSel = $("#filterBrandSel");
  if(brandSel){
    brandSel.onchange = ()=>{
      state.layoutSelectedBrand = String(brandSel.value||"All");
      render();
    };
  }

  const uprightSel = $("#filterUprightSel");
  if(uprightSel){
    uprightSel.onchange = ()=>{
      state.layoutFilterUpright = String(uprightSel.value||"All");
      render();
    };
  }

  const holeSel = $("#filterHoleSel");
  if(holeSel){
    holeSel.onchange = ()=>{
      state.layoutFilterHole = String(holeSel.value||"All");
      render();
    };
  }

  const layoutUnitSel = $("#layoutEditorUnitSelect");
  if(layoutUnitSel){
    layoutUnitSel.onchange = ()=>{
      const v = String(layoutUnitSel.value||"ft");
      state.settings.layoutEditorUnit = v === "in" ? "in" : "ft";
      render();
    };
  }
}
