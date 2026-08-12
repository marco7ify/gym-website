(function(){
  "use strict";

  const DEFAULT=()=>({mode:"walk",moveStep:"coarse",wallTool:null,status:null,undo:null});
  let editor=DEFAULT();

  const snapshot=()=>({
    layoutId:state.activeLayoutId||null,
    instances:deepCopy(state.layout.instances||[]),
    wallFeatures:deepCopy(state.layout.wallFeatures||[]),
    selectedInstId:state.layout.selectedInstId||null,
    selectedWallFeatureId:state.layout.selectedWallFeatureId||null,
  });

  const commitUndo=before=>{ editor.undo=before; };
  const finish=(tone,message,result)=>{
    editor.status={tone,message};
    render();
    return result;
  };

  function editorState(){ return editor; }

  function reset(){ editor=DEFAULT(); }

  function setMode(mode){
    editor.mode=mode==="edit" ? "edit" : "walk";
    if(editor.mode==="walk") editor.wallTool=null;
    return editor;
  }

  function setMoveStep(mode){
    editor.moveStep=mode==="fine" ? "fine" : "coarse";
    return editor;
  }

  function setWallTool(kind){
    editor.wallTool=GymWallFeatures.KINDS.includes(kind) ? kind : null;
    return editor;
  }

  function nudgeInstance(instId,dxSign,dySign){
    const inst=(state.layout.instances||[]).find(entry=>entry.id===instId);
    const item=inst&&getItemById(inst.itemId);
    if(!inst||!item){
      return finish("error","That equipment is no longer in this layout.",{ok:false,reason:"not-found"});
    }

    const before=snapshot();
    const step=editor.moveStep==="fine" ? 1/12 : .5;
    const rawX=instXTotalFt(inst)+Math.sign(dxSign)*step;
    const rawY=instYTotalFt(inst)+Math.sign(dySign)*step;
    const x=splitTotalFtToFtIn(rawX);
    const y=splitTotalFtToFtIn(rawY);
    const candidate={...inst,xFt:x.ft,xIn:x.inch,yFt:y.ft,yIn:y.inch};
    const rects=effectiveRectForInst(candidate,item);
    const conflict=hardPlacementConflict(instId,rects.base);
    if(conflict){
      const message=String(conflict.message||"That movement is not valid.")
        .replace(/^Can’t rotate here/,"Can’t move there");
      return finish("error",message,{ok:false,reason:"hard-invalid",conflict});
    }

    candidate.__invalid=isInvalidPlacement(instId,rects.base,rects.eff);
    state.layout.instances=state.layout.instances.map(entry=>entry.id===instId ? candidate : entry);
    commitUndo(before);
    return finish(
      candidate.__invalid ? "warning" : "success",
      candidate.__invalid ? "Moved. Clearance overlaps another item." : "Moved equipment.",
      {ok:true,instance:candidate}
    );
  }

  function rotateInstance(instId){
    const before=snapshot();
    const result=rotateLayoutInstance90(instId,{render:false});
    if(result.ok) commitUndo(before);
    const status=state.layoutActionStatus?.instId===instId
      ? state.layoutActionStatus
      : {tone:result.ok?"success":"error",message:result.ok?"Rotated equipment 90°.":"That rotation is not valid."};
    return finish(status.tone,status.message,result);
  }

  function featureFromWallHit(kind,hit){
    if(!GymWallFeatures.KINDS.includes(kind)||!GymWallFeatures.SIDES.includes(hit?.wall)){
      return {ok:false,reason:"Choose a real wall surface."};
    }
    const id=uid("wf");
    const room=wallFeatureRoomData(state.layout,state.settings);
    let feature=GymWallFeatures.normalize({id,kind,wall:hit.wall},room,()=>id,state.layout);
    const featureWidth=GymWallFeatures.width(feature);
    const runStart=Number.isFinite(Number(hit.runStartFt)) ? safeNum(hit.runStartFt) : 0;
    const runEnd=Number.isFinite(Number(hit.runEndFt)) ? safeNum(hit.runEndFt) : GymWallFeatures.wallLength(feature,room);
    if(runEnd-runStart<featureWidth-1e-9){
      return {ok:false,reason:"This wall run is too short for that feature."};
    }
    const centeredStart=clamp(safeNum(hit.alongFt)-featureWidth/2,runStart,runEnd-featureWidth);
    const centeredBottom=Math.max(0,safeNum(hit.mountFt)-GymWallFeatures.height(feature)/2);
    const start=splitTotalFtToFtIn(centeredStart);
    const bottom=splitTotalFtToFtIn(centeredBottom);
    feature=GymWallFeatures.normalize({
      ...feature,
      startFt:start.ft,startIn:start.inch,
      bottomFt:bottom.ft,bottomIn:bottom.inch,
    },room,()=>id,state.layout);
    const validation=GymWallFeatures.validate(feature,state.layout,room);
    return validation.valid
      ? {ok:true,feature}
      : {ok:false,reason:validation.reasons[0]?.message||"This wall placement is not valid."};
  }

  function addFeatureFromWallHit(kind,hit){
    const candidate=featureFromWallHit(kind,hit);
    if(!candidate.ok) return finish("error",candidate.reason,candidate);
    const before=snapshot();
    state.layout.wallFeatures=[...(state.layout.wallFeatures||[]),candidate.feature];
    clearAllSelections();
    state.layout.selectedWallFeatureId=candidate.feature.id;
    editor.wallTool=null;
    commitUndo(before);
    return finish("success","Added wall feature.",{ok:true,feature:candidate.feature});
  }

  function patchFeature(id,patch){
    const current=(state.layout.wallFeatures||[]).find(feature=>feature.id===id);
    if(!current){
      return finish("error","That wall feature no longer exists.",{ok:false,reason:"not-found"});
    }
    if(patch&&Object.prototype.hasOwnProperty.call(patch,"kind")&&!GymWallFeatures.KINDS.includes(patch.kind)){
      return finish("error","Choose a supported wall feature type.",{ok:false,reason:"invalid-kind"});
    }
    if(patch&&Object.prototype.hasOwnProperty.call(patch,"wall")&&!GymWallFeatures.SIDES.includes(patch.wall)){
      return finish("error","Choose a base-room wall.",{ok:false,reason:"invalid-wall"});
    }
    const room=wallFeatureRoomData(state.layout,state.settings);
    const candidate=GymWallFeatures.normalize({...current,...patch},room,()=>id,state.layout);
    const validation=GymWallFeatures.validate(candidate,state.layout,room);
    if(!validation.valid){
      return finish("error",validation.reasons[0].message,{ok:false,reason:validation.reasons[0].code});
    }
    const before=snapshot();
    state.layout.wallFeatures=state.layout.wallFeatures.map(feature=>feature.id===id ? candidate : feature);
    commitUndo(before);
    return finish("success","Updated wall feature.",{ok:true,feature:candidate});
  }

  function removeFeature(id){
    if(!(state.layout.wallFeatures||[]).some(feature=>feature.id===id)){
      return finish("error","That wall feature no longer exists.",{ok:false,reason:"not-found"});
    }
    const before=snapshot();
    state.layout.wallFeatures=state.layout.wallFeatures.filter(feature=>feature.id!==id);
    if(state.layout.selectedWallFeatureId===id) state.layout.selectedWallFeatureId=null;
    commitUndo(before);
    return finish("success","Removed wall feature.",{ok:true});
  }

  function clearSelection(){
    clearAllSelections();
    return finish("success","Selection cleared. Choose a wall feature to place.",{ok:true});
  }

  function undoLast(){
    if(!editor.undo){
      return finish("error","There is no Walkthrough edit to undo.",{ok:false,reason:"empty"});
    }
    const restore=editor.undo;
    editor.undo=null;
    if(restore.layoutId!==state.activeLayoutId){
      return finish("error","The active layout changed, so that Walkthrough edit cannot be undone.",{ok:false,reason:"layout-changed"});
    }
    const {layoutId,...layout}=restore;
    Object.assign(state.layout,deepCopy(layout));
    return finish("success","Undid the last Walkthrough edit.",{ok:true});
  }

  window.GymWalkthroughEditing=Object.freeze({
    state:editorState,
    reset,
    setMode,
    setMoveStep,
    setWallTool,
    nudgeInstance,
    rotateInstance,
    featureFromWallHit,
    addFeatureFromWallHit,
    patchFeature,
    removeFeature,
    clearSelection,
    undoLast,
  });
})();
