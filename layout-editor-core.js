(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  root.LayoutEditorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  function filterEquipment(items, filters={}, deps={}){
    const query = String(filters.query||"").trim().toLowerCase();
    return (items||[]).filter(item=>{
      const haystack = `${item.name||""} ${item.brand||""}`.toLowerCase();
      if(query && !haystack.includes(query)) return false;
      if(filters.category && filters.category!=="All" && item.category!==filters.category) return false;
      if(filters.brand==="__noBrand__" && String(item.brand||"").trim()) return false;
      if(filters.brand && !["All","__noBrand__"].includes(filters.brand) && item.brand!==filters.brand) return false;
      const pattern = deps.rackPatternInfo?.(item);
      if(filters.upright && filters.upright!=="All" && pattern?.uprightSize!==filters.upright) return false;
      if(filters.hole && filters.hole!=="All" && pattern?.holeSize!==filters.hole) return false;
      return true;
    });
  }

  function scopeEquipment(items,instances,scope="all"){
    if(scope!=="placed") return items||[];
    const placedIds=new Set((instances||[]).map(instance=>instance.itemId).filter(Boolean));
    return (items||[]).filter(item=>placedIds.has(item.id));
  }

  function selectionType(layout={}){
    const ordered = [
      ["selectedInstId","equipment"], ["selectedAreaId","area"],
      ["selectedOutletId","outlet"], ["selectedWallExtId","wall-extension"],
      ["selectedCeilingZoneId","ceiling-zone"], ["selectedFloorZoneId","floor-zone"],
      ["selectedFlooringId","flooring"],
      ["selectedWallFeatureId","wall-feature"],
    ];
    return ordered.find(([key])=>layout[key])?.[1] || "none";
  }

  function clonePlacement(source, id){
    const keep = ["itemId","xFt","xIn","yFt","yIn","rotated","deadspaceFt","deadspaceIn","deadspaceSides"];
    return keep.reduce((copy,key)=>{
      if(source[key] !== undefined) copy[key] = Array.isArray(source[key]) ? [...source[key]] : source[key];
      return copy;
    }, {id});
  }

  function splitFeet(value){
    let ft=Math.floor(value);
    let inch=Math.round((value-ft)*12);
    if(inch===12){ ft+=1; inch=0; }
    return {ft,inch};
  }

  function centerPlacement(roomRect, footprint){
    const x = roomRect.x + Math.max(0, (roomRect.w-footprint.w)/2);
    const y = roomRect.y + Math.max(0, (roomRect.h-footprint.h)/2);
    const sx=splitFeet(x), sy=splitFeet(y);
    return {xFt:sx.ft, xIn:sx.inch, yFt:sy.ft, yIn:sy.inch};
  }

  function draftChanged(a,b){ return JSON.stringify(a||{}) !== JSON.stringify(b||{}); }

  function workspaceDefaults(){
    return {
      search:"", equipmentScope:"all", inspectorMode:"auto", libraryDrawerOpen:false,
      inspectorDrawerOpen:false, detailsEditorOpen:false,
      detailsEditorItemId:null, detailsEditorDirty:false,
      detailsEditorBaseline:null, discardEditorConfirmOpen:false,
      returnFocusSelector:"", status:null, layoutRenameOpen:false,
      openPageTool:"layout", openAdvancedSection:"",
    };
  }

  function toggleDrawer(state,which){
    const next={libraryDrawerOpen:false,inspectorDrawerOpen:false};
    if(which==="library") next.libraryDrawerOpen=!state.libraryDrawerOpen;
    if(which==="inspector") next.inspectorDrawerOpen=!state.inspectorDrawerOpen;
    return {...state,...next};
  }

  return {filterEquipment, scopeEquipment, selectionType, clonePlacement, centerPlacement, splitFeet, draftChanged, workspaceDefaults, toggleDrawer};
});
