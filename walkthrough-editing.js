(function(){
  "use strict";

  const DEFAULT=()=>({mode:"walk",moveStep:"coarse",wallTool:null,status:null,undo:null});
  let editor=DEFAULT();

  const snapshot=()=>({
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
    const x=splitTotalFtToFtIn(instXTotalFt(inst)+Math.sign(dxSign)*step);
    const y=splitTotalFtToFtIn(instYTotalFt(inst)+Math.sign(dySign)*step);
    const candidate={...inst,xFt:x.ft,xIn:x.inch,yFt:y.ft,yIn:y.inch};
    const rects=effectiveRectForInst(candidate,item);
    const conflict=hardPlacementConflict(instId,rects.base);
    if(conflict){
      return finish("error",conflict.message,{ok:false,reason:"hard-invalid",conflict});
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
    const result=rotateLayoutInstance90(instId);
    if(result.ok) commitUndo(before);
    return result;
  }

  function featureFromWallHit(kind,hit){
    if(!GymWallFeatures.KINDS.includes(kind)||!GymWallFeatures.SIDES.includes(hit?.wall)){
      return {ok:false,reason:"Choose a real wall surface."};
    }
    const id=uid("wf");
    const room=wallFeatureRoomData(state.layout,state.settings);
    let feature=GymWallFeatures.normalize({id,kind,wall:hit.wall},room,()=>id,state.layout);
    const centeredStart=Math.max(0,safeNum(hit.alongFt)-GymWallFeatures.width(feature)/2);
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

  function undoLast(){
    if(!editor.undo){
      return finish("error","There is no Walkthrough edit to undo.",{ok:false,reason:"empty"});
    }
    const restore=editor.undo;
    editor.undo=null;
    Object.assign(state.layout,deepCopy(restore));
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
    undoLast,
  });
})();
