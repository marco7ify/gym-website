(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  root.LayoutEditorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  function filterEquipment(items, filters={}){
    const query = String(filters.query||"").trim().toLowerCase();
    return (items||[]).filter(item=>{
      const haystack = `${item.name||""} ${item.brand||""}`.toLowerCase();
      if(query && !haystack.includes(query)) return false;
      if(filters.category && filters.category!=="All" && item.category!==filters.category) return false;
      if(filters.brand && filters.brand!=="All" && item.brand!==filters.brand) return false;
      return true;
    });
  }

  function selectionType(layout={}){
    const ordered = [
      ["selectedInstId","equipment"], ["selectedAreaId","area"],
      ["selectedOutletId","outlet"], ["selectedWallExtId","wall-extension"],
      ["selectedCeilingZoneId","ceiling-zone"], ["selectedFloorZoneId","floor-zone"],
      ["selectedFlooringId","flooring"],
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

  function centerPlacement(roomRect, footprint){
    const x = roomRect.x + Math.max(0, (roomRect.w-footprint.w)/2);
    const y = roomRect.y + Math.max(0, (roomRect.h-footprint.h)/2);
    return {xFt:Math.floor(x), xIn:Math.round((x-Math.floor(x))*12), yFt:Math.floor(y), yIn:Math.round((y-Math.floor(y))*12)};
  }

  function draftChanged(a,b){ return JSON.stringify(a||{}) !== JSON.stringify(b||{}); }
  return {filterEquipment, selectionType, clonePlacement, centerPlacement, draftChanged};
});
