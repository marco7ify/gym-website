// Layout panel rendering with SVG

function layoutInchSuffix(id, inchVal, dataInAction, dimTag){
  const show = safeNum(inchVal) > 1e-9;
  if(show){
    return `<input type="number" min="0" step="1" inputmode="numeric" style="flex:1; min-width:56px;" data-action="${dataInAction}" data-id="${escapeAttr(id)}" value="${escapeAttr(inchVal)}" /><span class="muted" style="font-size:12px;">in</span>`;
  }
  return `<button type="button" class="btn" style="font-size:11px;padding:3px 8px;flex-shrink:0;" data-action="layout_show_in" data-id="${escapeAttr(id)}" data-dim="${escapeAttr(dimTag)}">+ in</button>`;
}

function layoutFtInRow(label, id, ftVal, inchVal, dataFtAction, dataInAction, dimTag, hint){
  const row = `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input type="number" min="0" step="1" inputmode="numeric" style="flex:1; min-width:72px;" data-action="${dataFtAction}" data-id="${escapeAttr(id)}" value="${escapeAttr(ftVal)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span>${layoutInchSuffix(id, inchVal, dataInAction, dimTag)}</div>`;
  return hint ? field(label, row, hint) : field(label, row);
}

function wallFeatureDisplayName(kind){
  return ({mirror:"Mirror",slat:"Wood slat panel",led:"LED strip"})[kind] || "Wall feature";
}

function garageDoorResolution(area,roomData){
  return GymGarageDoors.resolveOpening(
    areaRect(area),
    GymGarageDoors.boundarySegments(Array.isArray(roomData?.rects)?roomData.rects:[]),
    {areaId:area.id,label:area.label}
  );
}

function garageDoorAreaSvg(area,roomData,selected=false){
  const rect=areaRect(area);
  const resolution=garageDoorResolution(area,roomData);
  const vertical=resolution.ok ? resolution.axis==="z" : rect.h>rect.w;
  const classes=["garageDoorArea","garageDoorArchitectural"];
  if(selected) classes.push("garageDoorSelected");
  if(!resolution.ok) classes.push("garageDoorInvalid");
  const warning=resolution.ok ? "" : resolution.message;
  const widthFt=resolution.ok ? resolution.widthFt : Math.max(rect.w,rect.h);
  const accessibleName=`Garage door, ${round1(widthFt)} ft wide, architectural only${warning ? `. Invalid: ${warning}` : ""}`;
  const title=warning ? `Garage door. Invalid: ${warning}` : "Garage door, architectural only";
  const panels=[];
  for(let row=0;row<4;row+=1){
    for(let column=0;column<4;column+=1){
      const x=rect.x+(vertical?row:column)*rect.w/4;
      const y=rect.y+(vertical?column:row)*rect.h/4;
      panels.push(`<rect x="${x}" y="${y}" width="${rect.w/4}" height="${rect.h/4}" class="garagePanelFace" data-section="${row+1}" data-bay="${column+1}" />`);
    }
  }
  const lines=GymGarageDoors.planPanelLines(rect,{axis:vertical?"z":"x"});
  const sectionLines=lines.slice(0,3).map(line=>`<line x1="${line.x1}" y1="${line.z1}" x2="${line.x2}" y2="${line.z2}" class="garageSectionLine" />`).join("");
  const bayLines=lines.slice(3).map(line=>`<line x1="${line.x1}" y1="${line.z1}" x2="${line.x2}" y2="${line.z2}" class="garageBayLine" />`).join("");
  const openingLine=resolution.ok ? (resolution.axis==="x"
    ? `<line x1="${resolution.start}" y1="${resolution.fixed}" x2="${resolution.end}" y2="${resolution.fixed}" class="garageOpeningLine" />`
    : `<line x1="${resolution.fixed}" y1="${resolution.start}" x2="${resolution.fixed}" y2="${resolution.end}" class="garageOpeningLine" />`) : "";
  return `<g data-type="area" data-id="${escapeAttr(area.id)}" class="${classes.join(" ")}" role="button" tabindex="0" aria-label="${escapeAttr(accessibleName)}" aria-pressed="${selected?"true":"false"}"${warning?' aria-invalid="true"':""}>
    <title>${escapeSvg(title)}</title>
    <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="areaGarage" />
    ${panels.join("")}
    ${sectionLines}${bayLines}${openingLine}
    <rect x="${rect.x+0.12}" y="${rect.y+0.12}" width="${Math.max(0,rect.w-0.24)}" height="0.8" class="labelBox" />
    <text x="${rect.x+0.22}" y="${rect.y+0.68}" class="labelText">${escapeSvg(area.label||"Garage door")}</text>
    ${selected ? resizeHandles("area",area.id,rect) : ""}
  </g>`;
}

function spatialFrameSelectedControl(selection){
  const hasSelection=!!(selection.selectedInstId || selection.selectedAreaId || selection.selectedWallFeatureId);
  if(!hasSelection || selection.spatialMode==="plan") return "";
  const featureOnly=!!selection.selectedWallFeatureId && !selection.selectedInstId && !selection.selectedAreaId;
  let unavailableReason="";
  if(featureOnly && selection.wallsVisible===false){
    unavailableReason="Turn Walls on to frame this wall feature.";
  }else if(featureOnly && selection.wallFeatureValid===false){
    unavailableReason=String(selection.wallFeatureReason||"Fix this wall feature before framing it.");
  }
  if(unavailableReason){
    return `<button type="button" class="focusCanvasBtn" data-action="spatial_frame_selected" disabled aria-disabled="true" aria-label="Frame selected unavailable. ${escapeAttr(unavailableReason)}" title="${escapeAttr(unavailableReason)}">Frame selected</button>`;
  }
  return `<button type="button" class="focusCanvasBtn" data-action="spatial_frame_selected">Frame selected</button>`;
}

function walkthroughModeSwitch(){
  const editor=GymWalkthroughEditing.state();
  return `<div class="walkthroughModeSwitch" role="radiogroup" aria-label="Walkthrough mode">
    <button type="button" role="radio" aria-checked="${editor.mode==="walk"?"true":"false"}" data-action="walkthrough_mode" data-mode="walk" data-focus-key="walkthrough-mode-walk">Walk</button>
    <button type="button" role="radio" aria-checked="${editor.mode==="edit"?"true":"false"}" data-action="walkthrough_mode" data-mode="edit" data-focus-key="walkthrough-mode-edit">Edit</button>
  </div>`;
}

function walkthroughCompactField(label,control){
  return `<label class="walkthroughCompactField"><span>${escapeHtml(label)}</span>${control}</label>`;
}

function walkthroughMeasurementField(label,feature,name){
  const id=escapeAttr(feature.id);
  const ft=escapeAttr(feature[`${name}Ft`]??0);
  const inch=escapeAttr(feature[`${name}In`]??0);
  return `<fieldset class="walkthroughMeasureField">
    <legend>${escapeHtml(label)}</legend>
    <label><span>Feet</span><input type="number" min="0" step="1" inputmode="numeric" aria-label="${escapeAttr(label)} feet" data-action="walkthrough_wf_${name}_ft" data-id="${id}" data-focus-key="walkthrough-wf-${name}-ft:${id}" value="${ft}"></label>
    <label><span>Inches</span><input type="number" min="0" max="11" step="1" inputmode="numeric" aria-label="${escapeAttr(label)} inches" data-action="walkthrough_wf_${name}_in" data-id="${id}" data-focus-key="walkthrough-wf-${name}-in:${id}" value="${inch}"></label>
  </fieldset>`;
}

function walkthroughEditPanel(includeModeSwitch=true){
  const editor=GymWalkthroughEditing.state();
  const selectedFeature=(state.layout.wallFeatures||[]).find(feature=>feature.id===state.layout.selectedWallFeatureId)||null;
  const selectedInst=(state.layout.instances||[]).find(inst=>inst.id===state.layout.selectedInstId)||null;
  const selectedItem=selectedInst ? getItemById(selectedInst.itemId) : null;
  const undoDisabled=!editor.undo;
  const status=editor.status?.message || (selectedFeature
    ? "Edit the selected wall feature."
    : selectedInst
      ? "Move in room coordinates or rotate 90 degrees."
      : editor.wallTool
        ? "Choose a wall surface in the room."
        : "Select equipment, or choose a wall feature to place.");
  let body="";

  if(selectedFeature){
    const id=escapeAttr(selectedFeature.id);
    const name=wallFeatureDisplayName(selectedFeature.kind);
    body=`<section class="walkthroughEditorSection walkthroughFeatureEditor" aria-labelledby="walkthrough-feature-heading">
      <div class="walkthroughEditorHeading">
        <div><span class="walkthroughEditorKicker">Selected wall feature</span><h2 id="walkthrough-feature-heading">${escapeHtml(selectedFeature.label||name)}</h2></div>
        <div class="walkthroughEditorHeadingActions">
          <button type="button" data-action="walkthrough_clear_selection" data-focus-key="walkthrough-clear-selection" aria-label="Clear selected wall feature">Back to wall tools</button>
          <button type="button" class="walkthroughDangerAction" data-action="walkthrough_wf_remove" data-id="${id}" data-focus-key="walkthrough-wf-remove:${id}">Delete</button>
        </div>
      </div>
      <div class="walkthroughFeatureFields">
        ${walkthroughCompactField("Type",`<select aria-label="Wall feature type" data-action="walkthrough_wf_kind" data-id="${id}" data-focus-key="walkthrough-wf-kind:${id}">${GymWallFeatures.KINDS.map(kind=>`<option value="${kind}"${selectedFeature.kind===kind?" selected":""}>${wallFeatureDisplayName(kind)}</option>`).join("")}</select>`)}
        ${walkthroughCompactField("Label",`<input aria-label="Wall feature label" data-action="walkthrough_wf_label" data-id="${id}" data-focus-key="walkthrough-wf-label:${id}" value="${escapeAttr(selectedFeature.label||name)}">`)}
        ${walkthroughCompactField("Wall",`<select aria-label="Wall" data-action="walkthrough_wf_wall" data-id="${id}" data-focus-key="walkthrough-wf-wall:${id}">${GymWallFeatures.SIDES.map(wall=>`<option value="${wall}"${selectedFeature.wall===wall?" selected":""}>${wall[0].toUpperCase()+wall.slice(1)}</option>`).join("")}</select>`)}
        ${walkthroughCompactField(selectedFeature.kind==="led"?"LED color":"Color",`<input type="color" aria-label="Wall feature color" data-action="walkthrough_wf_color" data-id="${id}" data-focus-key="walkthrough-wf-color:${id}" value="${escapeAttr(selectedFeature.color||"#cbd5e1")}">`)}
        ${walkthroughMeasurementField("Along wall",selectedFeature,"start")}
        ${walkthroughMeasurementField("Mount height",selectedFeature,"bottom")}
        ${walkthroughMeasurementField("Width",selectedFeature,"width")}
        ${walkthroughMeasurementField("Height",selectedFeature,"height")}
        ${selectedFeature.kind==="led" ? walkthroughCompactField("Brightness",`<input type="range" min="0" max="100" step="1" aria-label="Brightness" data-action="walkthrough_wf_brightness" data-id="${id}" data-focus-key="walkthrough-wf-brightness:${id}" value="${escapeAttr(safeNum(selectedFeature.brightnessPct))}">`) : ""}
      </div>
      <div class="walkthroughNudgeGroup" role="group" aria-label="Nudge along wall">
        ${[-6,-1,1,6].map(inches=>`<button type="button" data-action="walkthrough_wf_nudge" data-id="${id}" data-inches="${inches}" data-focus-key="walkthrough-wf-nudge-${inches}:${id}" aria-label="Nudge ${Math.abs(inches)} inches ${inches<0?"back":"forward"}">${inches>0?"+":"−"}${Math.abs(inches)} in</button>`).join("")}
      </div>
    </section>`;
  }else if(selectedInst){
    const id=escapeAttr(selectedInst.id);
    const stepLabel=editor.moveStep==="fine" ? "1 inch" : "6 inches";
    body=`<section class="walkthroughEditorSection walkthroughEquipmentEditor" aria-labelledby="walkthrough-equipment-heading">
      <div class="walkthroughEditorHeading">
        <div><span class="walkthroughEditorKicker">Selected equipment</span><h2 id="walkthrough-equipment-heading">${escapeHtml(selectedItem?.name||"Equipment")}</h2></div>
        <div class="walkthroughEditorHeadingActions">
          <button type="button" data-action="walkthrough_clear_selection" data-focus-key="walkthrough-clear-selection" aria-label="Clear selected equipment">Back to wall tools</button>
          <button type="button" class="walkthroughRotateAction" data-action="walkthrough_rotate" data-id="${id}" data-focus-key="walkthrough-rotate:${id}" aria-label="Rotate selected equipment 90 degrees">↻ 90°</button>
        </div>
      </div>
      <div class="walkthroughPosition" aria-label="Current room position and orientation"><span>X <strong>${escapeHtml(formatFtIn(instXTotalFt(selectedInst)))}</strong></span><span>Y <strong>${escapeHtml(formatFtIn(instYTotalFt(selectedInst)))}</strong></span><span>Orientation: <strong>${selectedInst.rotated?"90°":"0°"}</strong></span></div>
      <div class="walkthroughDirectionalPad" role="group" aria-label="Move selected equipment in room coordinates">
        <button type="button" data-direction="up" data-action="walkthrough_move" data-id="${id}" data-dx="0" data-dy="-1" data-focus-key="walkthrough-move-up:${id}" aria-label="Move up ${stepLabel}">↑</button>
        <button type="button" data-direction="left" data-action="walkthrough_move" data-id="${id}" data-dx="-1" data-dy="0" data-focus-key="walkthrough-move-left:${id}" aria-label="Move left ${stepLabel}">←</button>
        <button type="button" data-direction="right" data-action="walkthrough_move" data-id="${id}" data-dx="1" data-dy="0" data-focus-key="walkthrough-move-right:${id}" aria-label="Move right ${stepLabel}">→</button>
        <button type="button" data-direction="down" data-action="walkthrough_move" data-id="${id}" data-dx="0" data-dy="1" data-focus-key="walkthrough-move-down:${id}" aria-label="Move down ${stepLabel}">↓</button>
      </div>
      <div class="walkthroughStepGroup" role="group" aria-label="Movement step">
        <button type="button" data-action="walkthrough_step" data-step="coarse" data-focus-key="walkthrough-step-coarse" aria-pressed="${editor.moveStep==="coarse"?"true":"false"}">6 in</button>
        <button type="button" data-action="walkthrough_step" data-step="fine" data-focus-key="walkthrough-step-fine" aria-pressed="${editor.moveStep==="fine"?"true":"false"}">Fine · 1 in</button>
      </div>
    </section>`;
  }else{
    body=`<section class="walkthroughEditorSection walkthroughWallTools" aria-labelledby="walkthrough-wall-heading">
      <span class="walkthroughEditorKicker">Add to a wall</span>
      <h2 id="walkthrough-wall-heading">Choose a wall feature</h2>
      <p>Select a tool, then choose a wall surface in the room.</p>
      <div class="walkthroughWallToolGroup" role="group" aria-label="Wall feature tools">
        ${GymWallFeatures.KINDS.map(kind=>`<button type="button" data-action="walkthrough_wall_tool" data-kind="${kind}" data-focus-key="walkthrough-wall-tool-${kind}" aria-pressed="${editor.wallTool===kind?"true":"false"}">${wallFeatureDisplayName(kind)}</button>`).join("")}
      </div>
      ${editor.wallTool ? `<button type="button" class="walkthroughCancelTool" data-action="walkthrough_cancel_tool" data-focus-key="walkthrough-cancel-tool">Cancel ${escapeHtml(wallFeatureDisplayName(editor.wallTool))}</button>` : ""}
    </section>`;
  }

  return `${includeModeSwitch?walkthroughModeSwitch():""}<aside class="walkthroughEditPanel" aria-label="Walkthrough editor">
    <div class="walkthroughEditPanelTop">
      <span class="walkthroughGuideKicker">Edit layout</span>
      <button type="button" class="walkthroughUndoAction" data-action="walkthrough_undo" data-focus-key="walkthrough-undo" aria-disabled="${undoDisabled?"true":"false"}"${undoDisabled?" disabled":""}>Undo</button>
    </div>
    ${body}
    <div class="walkthroughLiveStatus ${escapeAttr(editor.status?.tone||"")}" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(status)}</div>
  </aside>`;
}

function wallFeatureSvg(feature, roomData, selected=false, validation={valid:true,reasons:[]}){
  const rect=GymWallFeatures.planRect(feature, roomData);
  const kind=feature.kind;
  const name=wallFeatureDisplayName(kind);
  const horizontal=feature.wall==="top" || feature.wall==="bottom";
  const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2;
  const classes=["wallFeature", `wallFeature${kind[0].toUpperCase()}${kind.slice(1)}`];
  if(selected) classes.push("wallFeatureSelected");
  if(!validation?.valid) classes.push("wallFeatureInvalid");
  const invalidReason=!validation?.valid
    ? (validation?.reasons||[]).map(reason=>String(reason?.message||"").trim()).filter(Boolean).join(" ") || "Invalid wall feature placement."
    : "";
  const accessibleName=invalidReason ? `${name}. Invalid: ${invalidReason}` : name;
  const title=`${name}: ${feature.wall} wall${invalidReason ? `. Invalid: ${invalidReason}` : ""}`;
  const hatch=kind==="slat" ? Array.from({length:Math.max(2,Math.floor((horizontal?rect.w:rect.h)/.35))},(_,i)=>{
    const at=(horizontal?rect.x:rect.y)+.12+i*.35;
    return horizontal
      ? `<line x1="${at}" y1="${rect.y+.03}" x2="${at+.13}" y2="${rect.y+rect.h-.03}" class="wallFeatureSlatTick" />`
      : `<line x1="${rect.x+.03}" y1="${at}" x2="${rect.x+rect.w-.03}" y2="${at+.13}" class="wallFeatureSlatTick" />`;
  }).join("") : "";
  const mirror=kind==="mirror" ? (horizontal
    ? `<line x1="${rect.x}" y1="${cy-.055}" x2="${rect.x+rect.w}" y2="${cy-.055}" class="wallFeatureMirrorLine" /><line x1="${rect.x}" y1="${cy+.055}" x2="${rect.x+rect.w}" y2="${cy+.055}" class="wallFeatureMirrorLine" />`
    : `<line x1="${cx-.055}" y1="${rect.y}" x2="${cx-.055}" y2="${rect.y+rect.h}" class="wallFeatureMirrorLine" /><line x1="${cx+.055}" y1="${rect.y}" x2="${cx+.055}" y2="${rect.y+rect.h}" class="wallFeatureMirrorLine" />`) : "";
  const led=kind==="led" ? (horizontal
    ? `<line x1="${rect.x}" y1="${cy}" x2="${rect.x+rect.w}" y2="${cy}" class="wallFeatureLedGlow" style="stroke:${escapeAttr(feature.color||"#ffb36b")}" /><line x1="${rect.x}" y1="${cy}" x2="${rect.x+rect.w}" y2="${cy}" class="wallFeatureLedLine" style="stroke:${escapeAttr(feature.color||"#ffb36b")}" />`
    : `<line x1="${cx}" y1="${rect.y}" x2="${cx}" y2="${rect.y+rect.h}" class="wallFeatureLedGlow" style="stroke:${escapeAttr(feature.color||"#ffb36b")}" /><line x1="${cx}" y1="${rect.y}" x2="${cx}" y2="${rect.y+rect.h}" class="wallFeatureLedLine" style="stroke:${escapeAttr(feature.color||"#ffb36b")}" />`) : "";
  const symbol=kind==="mirror" ? "M" : kind==="slat" ? "SLAT" : "LED";
  return `<g data-type="wallfeature" data-id="${escapeAttr(feature.id)}" class="${classes.join(" ")}" role="button" tabindex="0" aria-label="${escapeAttr(accessibleName)}" aria-pressed="${selected?"true":"false"}"${invalidReason?' aria-invalid="true"':""}>
    <title>${escapeSvg(title)}</title>
    <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="wallFeatureHit" />
    ${mirror}${kind==="slat" ? `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="wallFeatureSlatFill" />${hatch}` : ""}${led}
    <text x="${cx}" y="${cy+.05}" class="wallFeatureMark" text-anchor="middle" dominant-baseline="middle">${symbol}</text>
    ${selected || !validation?.valid ? `<rect x="${rect.x-.04}" y="${rect.y-.04}" width="${rect.w+.08}" height="${rect.h+.08}" class="wallFeatureOutline" />` : ""}
  </g>`;
}

function layoutDimOverlaySvg(){
  if(!state.settings?.layoutDimOverlay) return "";
  const lines = [];
  const inst = (state.layout.instances||[]).find(x=>x.id===state.layout.selectedInstId);
  if(inst){
    const item = getItemById(inst.itemId);
    const {base} = item ? effectiveRectForInst(inst, item) : {base:{x: instXTotalFt(inst), y: instYTotalFt(inst)}};
    const ix = instXTotalFt(inst), iy = instYTotalFt(inst);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(base.x, base.y - 0.22, `Pos ${formatFtIn(ix)} × ${formatFtIn(iy)}`)}</g>`);
  }
  const area = (state.layout.areas||[]).find(x=>x.id===state.layout.selectedAreaId);
  if(area){
    const ar = areaRect(area);
    const t = `Pos ${formatFtIn(areaXTotalFt(area))} × ${formatFtIn(areaYTotalFt(area))} · ${formatFtIn(ar.w)} × ${formatFtIn(ar.h)}`;
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(ar.x, ar.y - 0.28, t)}</g>`);
  }
  const o = (state.layout.outlets||[]).find(x=>x.id===state.layout.selectedOutletId);
  if(o){
    const ox = outletXTotalFt(o), oy = outletYTotalFt(o);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(ox, oy - 0.35, `Pos ${formatFtIn(ox)} × ${formatFtIn(oy)}`)}</g>`);
  }
  const fz = (state.layout.floorZones||[]).find(x=>x.id===state.layout.selectedFloorZoneId);
  if(fz){
    const x = floorZoneXTotalFt(fz), y = floorZoneYTotalFt(fz), w = floorZoneWidthTotalFt(fz), h = floorZoneDepthTotalFt(fz);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(x, y - 0.28, `Pos ${formatFtIn(x)} × ${formatFtIn(y)} · ${formatFtIn(w)} × ${formatFtIn(h)}`)}</g>`);
  }
  const cz = (state.layout.ceilingZones||[]).find(x=>x.id===state.layout.selectedCeilingZoneId);
  if(cz){
    const x = ceilingZoneXTotalFt(cz), y = ceilingZoneYTotalFt(cz), w = ceilingZoneWidthTotalFt(cz), h = ceilingZoneDepthTotalFt(cz);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(x, y - 0.28, `Pos ${formatFtIn(x)} × ${formatFtIn(y)} · ${formatFtIn(w)} × ${formatFtIn(h)}`)}</g>`);
  }
  const we = (state.layout.wallExtensions||[]).find(x=>x.id===state.layout.selectedWallExtId);
  if(we){
    const r = room();
    const wr = wallExtToRect(we, r.W, r.L);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(wr.x, wr.y - 0.28, `Run ${formatFtIn(wallExtLengthTotalFt(we))} · depth ${formatFtIn(wallExtDepthTotalFt(we))}`)}</g>`);
  }
  const fp = (state.layout.flooringPieces||[]).find(x=>x.id===state.layout.selectedFlooringId);
  if(fp){
    const pr = flooringPieceRect(fp);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(pr.x, pr.y - 0.22, `Pos ${formatFtIn(flooringXTotalFt(fp))} × ${formatFtIn(flooringYTotalFt(fp))} · ${formatFtIn(pr.w)} × ${formatFtIn(pr.h)}`)}</g>`);
  }
  const wf = (state.layout.wallFeatures||[]).find(x=>x.id===state.layout.selectedWallFeatureId);
  if(wf){
    const roomData=wallFeatureRoomData(state.layout, state.settings);
    lines.push(`<g class="layoutDimOverlay">${dimOverlayText(GymWallFeatures.planRect(wf, roomData).x, GymWallFeatures.planRect(wf, roomData).y-.28, `${wallFeatureDisplayName(wf.kind)} · ${wf.wall} · ${formatFtIn(GymWallFeatures.start(wf))} · mount ${formatFtIn(GymWallFeatures.bottom(wf))} · ${formatFtIn(GymWallFeatures.width(wf))} × ${formatFtIn(GymWallFeatures.height(wf))}`)}</g>`);
  }
  return lines.join("");
}

function dimOverlayText(x, y, text){
  return `<text x="${x}" y="${y}" class="layoutDimOverlayText">${escapeSvg(text)}</text>`;
}

/** Outer room dimension annotations: ticks + labels on right and bottom sides,
 *  including individual extension measurements. */
function roomDimensionsSvg(r){
  const exts  = Array.isArray(state.layout.wallExtensions) ? state.layout.wallExtensions : [];
  const GAP   = 0.55;  // gap between wall and dim line
  const TICK  = 0.22;  // half-length of end tick

  function dimLabel(ft){
    const {feet, inches} = feetToFeetInches(Math.abs(ft));
    return inches > 0 ? `${feet}′${inches}″` : `${feet}′`;
  }

  // Horizontal dimension line: measures from x1→x2, drawn at y
  function hDim(x1, x2, y, txt){
    if(Math.abs(x2-x1) < 0.01) return "";
    const mx = (x1+x2)/2;
    return `<g class="roomDim">
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="dimLine"/>
      <line x1="${x1}" y1="${y-TICK}" x2="${x1}" y2="${y+TICK}" class="dimLine"/>
      <line x1="${x2}" y1="${y-TICK}" x2="${x2}" y2="${y+TICK}" class="dimLine"/>
      <text x="${mx}" y="${y+0.42}" text-anchor="middle" class="dimText">${escapeSvg(txt)}</text>
    </g>`;
  }

  // Vertical dimension line: measures from y1→y2, drawn at x
  function vDim(y1, y2, x, txt){
    if(Math.abs(y2-y1) < 0.01) return "";
    const my = (y1+y2)/2;
    return `<g class="roomDim">
      <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="dimLine"/>
      <line x1="${x-TICK}" y1="${y1}" x2="${x+TICK}" y2="${y1}" class="dimLine"/>
      <line x1="${x-TICK}" y1="${y2}" x2="${x+TICK}" y2="${y2}" class="dimLine"/>
      <text x="${x+0.12}" y="${my}" dominant-baseline="middle" class="dimText">${escapeSvg(txt)}</text>
    </g>`;
  }

  const parts = [];

  // Base room: width across the bottom, height down the right
  parts.push(hDim(0, r.W, r.L + GAP, dimLabel(r.W)));
  parts.push(vDim(0, r.L, r.W + GAP, dimLabel(r.L)));

  // Extension dimensions
  exts.forEach(we=>{
    const rect = wallExtToRect(we, r.W, r.L);
    if(we.wall==="bottom"){
      // depth (how far it sticks out) — shown at the right side of the extension
      parts.push(vDim(r.L, r.L + rect.h, rect.x + rect.w + GAP, dimLabel(rect.h)));
      // width — shown below the extension
      parts.push(hDim(rect.x, rect.x + rect.w, r.L + rect.h + GAP, dimLabel(rect.w)));
    } else if(we.wall==="top"){
      parts.push(vDim(rect.y, 0, rect.x + rect.w + GAP, dimLabel(rect.h)));
      parts.push(hDim(rect.x, rect.x + rect.w, rect.y - GAP, dimLabel(rect.w)));
    } else if(we.wall==="right"){
      parts.push(hDim(r.W, r.W + rect.w, rect.y + rect.h + GAP, dimLabel(rect.w)));
      parts.push(vDim(rect.y, rect.y + rect.h, r.W + rect.w + GAP, dimLabel(rect.h)));
    } else if(we.wall==="left"){
      parts.push(hDim(rect.x, 0, rect.y + rect.h + GAP, dimLabel(rect.w)));
      parts.push(vDim(rect.y, rect.y + rect.h, rect.x - GAP, dimLabel(rect.h)));
    }
  });

  return parts.join("");
}

function layoutPanel(rows, currency){
  const r = room();
  const reserved = reservedSqFt();
  const usable = usableSqFt();
  const b = r.bounds;
  const spatial = {
    ...DEFAULT_LAYOUT.spatial3d,
    ...(state.layout.spatial3d || {}),
  };
  const labelMode = ["selected", "hover", "always", "off"].includes(spatial.labelMode)
    ? spatial.labelMode
    : (spatial.labels === false ? "off" : "selected");
  // Include a staging/parking strip on the right for rearranging, plus an
  // optional Compare zone to the right of staging (same SVG coord space so
  // equipment shows at real-world scale for visual size comparison).
  const staging = layoutStagingRect(r);
  const inRoomInstances = typeof layoutRoomInstances === "function"
    ? layoutRoomInstances(state.layout, r)
    : (state.layout.instances || []);
  const resolvedInstanceCount = (state.layout.instances || []).filter(inst=>getItemById(inst.itemId)).length;
  const stagedInstanceCount = Math.max(0, resolvedInstanceCount - inRoomInstances.length);
  const activeCompareSet = getActiveCompareSet();
  // compareSet.items is an array of {itemId, xFt?, yFt?}. Resolve each to a
  // full item record and pass to the layout helper with its entry so saved
  // drag positions are honored.
  const compareEntries = (Array.isArray(activeCompareSet.items) ? activeCompareSet.items : [])
    .map(entry=>{
      const id = entry && entry.itemId;
      const item = id ? (getItemById(id) || rows.find(x=> x && x.id===id)) : null;
      return item ? { item, entry } : null;
    })
    .filter(Boolean);
  const compare = layoutCompareLayout(r, compareEntries);
  const hasCompare = compareEntries.length > 0;
  const compareItemsResolved = compareEntries.map(e=> e.item);
  const rightEdge = hasCompare
    ? (compare.zone.x + compare.zone.w)
    : (staging.x + staging.w);
  const stagingBottom = staging.y + staging.h;
  const compareBottom = hasCompare ? (compare.zone.y + compare.zone.h) : b.maxY;
  const bottomEdge = Math.max(b.maxY, stagingBottom, compareBottom);
  const maxX = Math.max(b.maxX, rightEdge);
  const overallW = Math.max(1e-6, maxX - b.minX);
  const overallH = Math.max(1e-6, bottomEdge - b.minY);
  // overallW already includes the full staging + compare span, so padR is
  // just the right gutter for dimension labels (kept modest regardless of
  // staging size so larger staging presets don't create huge empty margins).
  const padL = 1.5, padT = 1.5, padR = 3.4, padB = 2.2;
  const vb = `${b.minX - padL} ${b.minY - padT} ${Math.max(1, overallW + padL + padR)} ${Math.max(1, overallH + padT + padB)}`;
  
  const selectedCat = state.layoutSelectedCategory || "All";
  const categories = ["All", ...new Set(rows.map(it=>it.category))];

  // Brand filter (new): lets the user narrow the layout equipment list by
  // company / factory / brand name.
  const selectedBrand = state.layoutSelectedBrand || "All";
  const allBrands = [...new Set(rows.map(it=> String(it.brand||"").trim()).filter(Boolean))]
    .sort((a,b)=> a.localeCompare(b, undefined, { sensitivity:"base" }));

  // Rack filter helpers
  const isRackLikeCat = (cat)=>{
    const c = String(cat||"").toLowerCase();
    return c.includes("rack") || c.includes("cage") || c.includes("smith") || c.includes("plate-loaded") || c.includes("selectorized") || c.includes("attachment");
  };
  const showRackFilters = selectedCat !== "All" && isRackLikeCat(selectedCat);
  const filterUpright = state.layoutFilterUpright || "All";
  const filterHole    = state.layoutFilterHole    || "All";

  // Unique upright sizes / hole diameters from current category items
  const rackPatternInfo = (item)=>{
    const pat = RACK_HOLE_PATTERNS.find(p=> p.id === item.rackHolePattern);
    return pat || null;
  };
  const catsForRack = selectedCat === "All" ? rows : rows.filter(it=> it.category === selectedCat);
  const allUprights = [...new Set(catsForRack.map(it=> rackPatternInfo(it)?.uprightSize).filter(Boolean))].sort();
  const allHoles    = [...new Set(catsForRack.map(it=> rackPatternInfo(it)?.holeSize).filter(Boolean))].sort();

  const searchQuery = state.layoutWorkspace?.search || "";
  const filteredRows = LayoutEditorCore.filterEquipment(rows, {
    query:searchQuery,
    category:selectedCat,
    brand:selectedBrand,
    upright:showRackFilters ? filterUpright : "All",
    hole:showRackFilters ? filterHole : "All",
  }, {rackPatternInfo});

  const expandedItemId = state.layoutExpandedItemId || null;
  const expandedTab    = state.layoutExpandedTab || "general";

  // Grid lines (clipped to the valid room area so the grid doesn't bleed past
  // walls). The grid range is extended to also cover the staging and compare
  // zones so the user sees the same 1-foot squares inside those side panels.
  const grid = [];
  const gx0 = Math.floor(b.minX);
  const gy0 = Math.floor(b.minY);
  const gx1 = Math.ceil(Math.max(b.maxX, staging.x + staging.w, hasCompare ? (compare.zone.x + compare.zone.w) : b.maxX));
  const gy1 = Math.ceil(Math.max(b.maxY, staging.y + staging.h, hasCompare ? (compare.zone.y + compare.zone.h) : b.maxY));

  for(let x=gx0; x<=gx1; x+=1){
    const major = (Math.abs(x)%5===0);
    grid.push(`<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}" class="${major?'gridMajor':'gridMinor'}" />`);
  }
  for(let y=gy0; y<=gy1; y+=1){
    const major = (Math.abs(y)%5===0);
    grid.push(`<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}" class="${major?'gridMajor':'gridMinor'}" />`);
  }

  // Build a clipPath containing the base room + every wall extension + the
  // staging zone + (if visible) the compare zone, so grid lines only render
  // inside those rectangles.
  const _gridWallExts = Array.isArray(state.layout.wallExtensions) ? state.layout.wallExtensions : [];
  const gridClipRects = [
    `<rect x="0" y="0" width="${r.W}" height="${r.L}" />`,
    ..._gridWallExts.map(we => {
      const rc = wallExtToRect(we, r.W, r.L);
      return `<rect x="${rc.x}" y="${rc.y}" width="${rc.w}" height="${rc.h}" />`;
    }),
    `<rect x="${staging.x}" y="${staging.y}" width="${staging.w}" height="${staging.h}" />`,
    hasCompare ? `<rect x="${compare.zone.x}" y="${compare.zone.y}" width="${compare.zone.w}" height="${compare.zone.h}" />` : "",
  ].join("");

  const baseRect = {x:0, y:0, w:r.W, h:r.L};

  // Wall extensions SVG
  const wallExts = Array.isArray(state.layout.wallExtensions) ? state.layout.wallExtensions : [];
  const wallExtsSvg = wallExts.map(we=>{
    const rect = wallExtToRect(we, r.W, r.L);
    const sel = state.layout.selectedWallExtId===we.id;
    return `
      <g data-type="wallext" data-id="${we.id}">
        <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="wallExt ${sel?'wallExtSelected':''}" />
        <rect x="${rect.x+0.12}" y="${rect.y+0.12}" width="${Math.max(0,rect.w-0.24)}" height="${0.8}" class="labelBox" />
        <text x="${rect.x+0.22}" y="${rect.y+0.68}" class="labelText">${escapeSvg(we.label||"Extension")}</text>
        ${sel ? resizeHandles("wallext", we.id, rect) : ""}
      </g>
    `;
  }).join("");

  const roomSvg = `<rect x="${baseRect.x}" y="${baseRect.y}" width="${baseRect.w}" height="${baseRect.h}" class="roomBorder" />`;

  // Ceiling zones SVG
  const ceilZonesSvg = (state.layout.ceilingZones||[]).map(cz=>{
    const sel = state.layout.selectedCeilingZoneId===cz.id;
    const x = ceilingZoneXTotalFt(cz), y = ceilingZoneYTotalFt(cz);
    const w = ceilingZoneWidthTotalFt(cz), h = ceilingZoneDepthTotalFt(cz);
    const rect = {x, y, w, h};
    return `
      <g data-type="ceilzone" data-id="${cz.id}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" class="ceilZone ${sel?'ceilZoneSelected':''}" />
        <rect x="${x+0.12}" y="${y+0.12}" width="${Math.max(0,w-0.24)}" height="${0.8}" class="labelBox" />
        <text x="${x+0.22}" y="${y+0.68}" class="labelText">${escapeSvg(cz.label||"Low ceiling")} (${round1(ceilingZoneClearanceTotalFt(cz))}ft)</text>
        ${sel ? resizeHandles("ceilzone", cz.id, rect) : ""}
      </g>
    `;
  }).join("");

  // Floor zones SVG
  const floorZonesSvg = (state.layout.floorZones||[]).map(fz=>{
    const sel = state.layout.selectedFloorZoneId===fz.id;
    const x = floorZoneXTotalFt(fz), y = floorZoneYTotalFt(fz);
    const w = floorZoneWidthTotalFt(fz), h = floorZoneDepthTotalFt(fz);
    const rect = {x, y, w, h};
    return `
      <g data-type="floorzone" data-id="${fz.id}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" class="floorZone ${sel?'floorZoneSelected':''}" />
        <rect x="${x+0.12}" y="${y+0.12}" width="${Math.max(0,w-0.24)}" height="${0.8}" class="labelBox" />
        <text x="${x+0.22}" y="${y+0.68}" class="labelText">${escapeSvg(fz.label||"Elevated")} (+${round1(safeNum(fz.elevationIn))}in)</text>
        ${sel ? resizeHandles("floorzone", fz.id, rect) : ""}
      </g>
    `;
  }).join("");

  // Flooring pieces SVG (rendered below equipment)
  const flooringSvg = (state.layout.flooringPieces||[]).map(fp=>{
    const sel = state.layout.selectedFlooringId===fp.id;
    const type = getFlooringType(fp.typeId);
    const rect = flooringPieceRect(fp);
    const labelText = fp.label || type.name;
    return `
      <g data-type="flooring" data-id="${fp.id}">
        <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${type.color}" class="flooringPiece ${sel?'flooringPieceSelected':''}" />
        <text x="${rect.x + rect.w/2}" y="${rect.y + rect.h/2}" text-anchor="middle" dominant-baseline="middle" class="flooringLabel">${escapeSvg(labelText)}</text>
        ${sel ? `<text x="${rect.x + rect.w/2}" y="${rect.y + rect.h/2 + 0.5}" text-anchor="middle" class="flooringLabel" style="font-size:.3px;">$${safeNum(fp.price)}</text>` : ""}
      </g>
    `;
  }).join("");

  const areasSvg = (state.layout.areas||[]).map(a=>{
    const m = kindMeta(a.kind);
    const rect = areaRect(a);
    const sel = state.layout.selectedAreaId===a.id;
    if(a.kind==="garagedoor") return garageDoorAreaSvg(a,r,sel);
    const doorPath = (a.kind==="door" && a.doorClearEnabled!==false) ? doorArcPath(a) : "";
    return `
      <g data-type="area" data-id="${a.id}">
        <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="${m.cls}" />
        ${doorPath ? `<path d="${doorPath}" class="doorArc" />` : ``}
        <rect x="${rect.x+0.12}" y="${rect.y+0.12}" width="${Math.max(0,rect.w-0.24)}" height="${0.8}" class="labelBox" />
        <text x="${rect.x+0.22}" y="${rect.y+0.68}" class="labelText">${escapeSvg(a.label||m.label)}</text>
        ${sel ? resizeHandles("area", a.id, rect) : ""}
      </g>
    `;
  }).join("");

  // Wall features stay below equipment so equipment remains the top selection layer.
  const wallFeaturesSvg=(state.layout.wallFeatures||[]).map(feature=>{
    const validation=GymWallFeatures.validate(feature, state.layout, wallFeatureRoomData(state.layout, state.settings));
    return wallFeatureSvg(feature, r, state.layout.selectedWallFeatureId===feature.id, validation);
  }).join("");

  const outletsSvg = (state.layout.outlets||[]).map(o=>{
    const sel = state.layout.selectedOutletId===o.id;
    const x = outletXTotalFt(o), y = outletYTotalFt(o);
    return `
      <g data-type="outlet" data-id="${o.id}">
        <circle cx="${x}" cy="${y}" r="0.28" class="outletDot ${sel?'outletDotSelected':''}" />
        <rect x="${x+0.15}" y="${y-0.35}" width="2.2" height="0.75" class="labelBox" />
        <text x="${x+0.25}" y="${y+0.05}" class="labelText">${escapeSvg(o.label||"Outlet")} ${escapeSvg(o.voltage||"120V")}</text>
      </g>
    `;
  }).join("");

  function partialEdgeSvg(rect){
    const segs = [];
    const EPS = 1e-6;
    const rx0 = rect.x, ry0 = rect.y;
    const rx1 = rect.x + rect.w, ry1 = rect.y + rect.h;
    const gx0 = Math.floor(rx0);
    const gy0 = Math.floor(ry0);
    const gx1 = Math.ceil(rx1);
    const gy1 = Math.ceil(ry1);

    function fmtInches(ft){
      const inch = Math.max(0, ft) * 12;
      if(inch < 0.25) return "";
      const rounded = Math.round(inch * 10) / 10;
      return `${rounded}"`;
    }

    // Only show each label once per side (not per square)
    let anyL = false, anyR = false, anyT = false, anyB = false;

    for(let cx=gx0; cx<gx1; cx++){
      for(let cy=gy0; cy<gy1; cy++){
        const ix0 = Math.max(rx0, cx);
        const iy0 = Math.max(ry0, cy);
        const ix1 = Math.min(rx1, cx + 1);
        const iy1 = Math.min(ry1, cy + 1);
        const covW = ix1 - ix0;
        const covH = iy1 - iy0;
        if(covW <= EPS || covH <= EPS) continue;
        if(covW >= 1 - EPS && covH >= 1 - EPS) continue;

        const leftEdge   = rx0 > cx + EPS && rx0 < cx + 1 - EPS;
        const rightEdge  = rx1 > cx + EPS && rx1 < cx + 1 - EPS;
        const topEdge    = ry0 > cy + EPS && ry0 < cy + 1 - EPS;
        const bottomEdge = ry1 > cy + EPS && ry1 < cy + 1 - EPS;

        if(leftEdge){
          segs.push(`<line x1="${rx0}" y1="${iy0}" x2="${rx0}" y2="${iy1}" class="equipEdgeLine" />`);
          anyL = true;
        }
        if(rightEdge){
          segs.push(`<line x1="${rx1}" y1="${iy0}" x2="${rx1}" y2="${iy1}" class="equipEdgeLine" />`);
          anyR = true;
        }
        if(topEdge){
          segs.push(`<line x1="${ix0}" y1="${ry0}" x2="${ix1}" y2="${ry0}" class="equipEdgeLine" />`);
          anyT = true;
        }
        if(bottomEdge){
          segs.push(`<line x1="${ix0}" y1="${ry1}" x2="${ix1}" y2="${ry1}" class="equipEdgeLine" />`);
          anyB = true;
        }
      }
    }

    // One label per side (if that side is partial in any square)
    const midX = (rx0 + rx1) / 2;
    const midY = (ry0 + ry1) / 2;

    if(anyL){
      const cx = Math.floor(rx0);
      const uncoveredFt = rx0 - cx;
      const label = fmtInches(uncoveredFt);
      if(label && uncoveredFt > 0.16){
        const lx = cx + uncoveredFt / 2;
        segs.push(`<text x="${lx}" y="${midY + 0.08}" class="equipEdgeLabel" text-anchor="middle">${label}</text>`);
      }
    }
    if(anyR){
      const cx = Math.floor(rx1);
      const uncoveredFt = (cx + 1) - rx1;
      const label = fmtInches(uncoveredFt);
      if(label && uncoveredFt > 0.16){
        const lx = rx1 + uncoveredFt / 2;
        segs.push(`<text x="${lx}" y="${midY + 0.08}" class="equipEdgeLabel" text-anchor="middle">${label}</text>`);
      }
    }
    if(anyT){
      const cy = Math.floor(ry0);
      const uncoveredFt = ry0 - cy;
      const label = fmtInches(uncoveredFt);
      if(label && uncoveredFt > 0.16){
        const ly = cy + uncoveredFt / 2 + 0.08;
        segs.push(`<text x="${midX}" y="${ly}" class="equipEdgeLabel" text-anchor="middle">${label}</text>`);
      }
    }
    if(anyB){
      const cy = Math.floor(ry1);
      const uncoveredFt = (cy + 1) - ry1;
      const label = fmtInches(uncoveredFt);
      if(label && uncoveredFt > 0.16){
        const ly = ry1 + uncoveredFt / 2 + 0.08;
        segs.push(`<text x="${midX}" y="${ly}" class="equipEdgeLabel" text-anchor="middle">${label}</text>`);
      }
    }

    return segs.join("");
  }

  const instSvg = (state.layout.instances||[]).map(inst=>{
    const item = getItemById(inst.itemId);
    if(!item) return "";
    const {base, halos} = effectiveRectForInst(inst, item);
    const selected = state.layout.selectedInstId===inst.id;
    const invalid = !!inst.__invalid;
    const dims = instanceDims(inst, item);
    const name = item.name || "Item";
    const brandStr = item.brand || "";
    const imgUrl = normalizeDataImageUrl(item.layoutImageDataUrl || "");
    const useImg = !!imgUrl;
    const clipId = `clip_eq_${String(inst.id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const imgHref = escapeAttr(imgUrl);
    const partialEdgesSvg = partialEdgeSvg(base);

    const localCeiling = effectiveCeilingForRect(base);
    const fp = footprint(item);
    const reqCeil = (String(item.requiredCeilingFt||"").trim()!=="") ? Math.max(0, safeNum(item.requiredCeilingFt)) : fp.H;
    const zoneCeilWarn = (reqCeil > 0 && localCeiling > 0 && reqCeil > localCeiling + 1e-6);

    const equipStrokeClass = `equip ${selected?"equipSelected":""} ${invalid?"equipInvalid":""} ${zoneCeilWarn && !invalid?"equipInvalid":""}`;

    const delX = base.x + base.w - 0.28;
    const delY = base.y + 0.28;
    const rotX = base.x + base.w - 0.86;
    const rotY = delY;
    const quickActions = selected ? `
      <g class="instQuickRotate" data-action="rotateInst" data-id="${inst.id}" role="button" tabindex="0" aria-label="Rotate 90°">
        <title>Rotate 90°</title>
        <circle cx="${rotX}" cy="${rotY}" r="0.22" class="instQuickActionBg" />
        <text x="${rotX}" y="${rotY+0.02}" text-anchor="middle" dominant-baseline="middle" class="instQuickActionIcon">↻</text>
      </g>
      <g class="instQuickDelete" data-action="removeInst" data-id="${inst.id}">
        <circle cx="${delX}" cy="${delY}" r="0.22" class="instQuickActionBg instQuickDeleteBg" />
        <text x="${delX}" y="${delY+0.03}" text-anchor="middle" dominant-baseline="middle" class="instQuickActionIcon instQuickDeleteX">×</text>
      </g>
    ` : "";

    // Compact label strip at the top of the rect (matches the Compare zone
    // card style): faded image fills the rect, a small semi-transparent
    // strip shows the name on line 1 and dims + brand on line 2 so the
    // product photo stays visible below. When an item has no photo yet, a
    // centered "add photo" shortcut appears in the empty area so the user
    // can spot which items need one and upload a photo in one click (opens
    // the item editor for that item).
    const labelBoxH = Math.min(0.92, Math.max(0.55, base.h - 0.18));
    const dimsStr = `${escapeSvg(formatDimsDual(dims.h, dims.w))}${zoneCeilWarn ? " CEIL!" : ""}${labelMode === "always" && brandStr ? " • " + escapeSvg(String(brandStr).slice(0,16)) : ""}`;
    const planLabelChars = Math.max(8, Math.floor(Math.max(0.8, base.w - (selected ? 1.15 : 0.35)) / 0.18));
    const planLabelName = name.length > planLabelChars ? `${name.slice(0, Math.max(4, planLabelChars-1))}…` : name;

    // Center point of the area below the label strip where we show the
    // "add photo" hint when no image is attached.
    const photoHintCx = base.x + base.w / 2;
    const photoHintCy = base.y + Math.max(labelBoxH + 0.1, (base.h + labelBoxH) / 2);
    const photoHintVisible = !useImg && base.w >= 1.6 && base.h >= 1.6;
    const photoHintHtml = photoHintVisible ? `
      <g class="instPhotoHint" data-action="editItemPhoto" data-id="${escapeAttr(item.id)}" style="cursor:pointer;">
        <rect x="${photoHintCx - 0.9}" y="${photoHintCy - 0.3}" width="1.8" height="0.6" rx="0.12" class="instPhotoHintBg" />
        <text x="${photoHintCx}" y="${photoHintCy + 0.05}" text-anchor="middle" class="instPhotoHintText">📷 Add photo</text>
      </g>
    ` : "";
    const labelClass = labelMode === "hover" && !selected
      ? "equipLabel equipLabelHover"
      : "equipLabel";
    const labelHtml = labelMode === "off" || (labelMode === "selected" && !selected) ? "" : `
      <g class="${labelClass}">
        <title>${escapeSvg(name)}</title>
        <rect x="${base.x+0.08}" y="${base.y+0.08}" width="${Math.max(0.1, base.w - 0.16)}" height="${labelBoxH}" class="labelBox" rx="0.06" />
        <text x="${base.x+0.2}" y="${base.y+0.42}" class="labelText" style="font-size:0.32px;">${escapeSvg(planLabelName)}</text>
        <text x="${base.x+0.2}" y="${base.y+0.72}" class="labelSub" style="font-size:0.26px;">${dimsStr}</text>
      </g>
    `;

    return `
      <g data-type="inst" data-id="${inst.id}">
        <g class="instSelectControl" role="button" tabindex="0" aria-label="Select ${escapeAttr(name)}" aria-pressed="${selected?"true":"false"}">
          ${halos.map(h=>`<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" class="halo" />`).join("")}
          <rect x="${base.x}" y="${base.y}" width="${base.w}" height="${base.h}" class="${equipStrokeClass}${useImg ? " equipHasPhoto" : ""}" />
          ${useImg ? `<svg x="${base.x}" y="${base.y}" width="${base.w}" height="${base.h}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" overflow="hidden">
            <image href="${imgHref}" xlink:href="${imgHref}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" opacity="0.78" />
          </svg>
          <rect x="${base.x}" y="${base.y}" width="${base.w}" height="${base.h}" fill="none" class="${equipStrokeClass}" />` : ""}
          ${partialEdgesSvg}
          ${labelHtml}
        </g>
        ${photoHintHtml}
        ${quickActions}
      </g>
    `;
  }).join("");

  const selectedInst = (state.layout.instances||[]).find(x=>x.id===state.layout.selectedInstId) || null;
  const selectedArea = (state.layout.areas||[]).find(x=>x.id===state.layout.selectedAreaId) || null;
  const selectedOutlet = (state.layout.outlets||[]).find(x=>x.id===state.layout.selectedOutletId) || null;
  const selectedWallExt = (state.layout.wallExtensions||[]).find(x=>x.id===state.layout.selectedWallExtId) || null;
  const selectedCeilZone = (state.layout.ceilingZones||[]).find(x=>x.id===state.layout.selectedCeilingZoneId) || null;
  const selectedFloorZone = (state.layout.floorZones||[]).find(x=>x.id===state.layout.selectedFloorZoneId) || null;
  const selectedFlooring = (state.layout.flooringPieces||[]).find(x=>x.id===state.layout.selectedFlooringId) || null;
  const selectedWallFeature = (state.layout.wallFeatures||[]).find(x=>x.id===state.layout.selectedWallFeatureId) || null;
  const selectedWallFeatureValidation=selectedWallFeature
    ? GymWallFeatures.validate(selectedWallFeature,state.layout,wallFeatureRoomData(state.layout,state.settings))
    : null;

  const opts = (Array.isArray(state.layouts)?state.layouts:[]).map(l=>`<option value="${l.id}" ${l.id===state.activeLayoutId?'selected':''}>${escapeHtml(l.name)}</option>`).join("");

  // Helper: body part chips for an item
  function itemBodyPartChips(it){
    const covered = getItemCoveredBodyParts(it);
    if(!covered.size) return "";
    return Array.from(covered).map(bp=>{
      const cnt = EXERCISE_DATABASE.filter(ex=> ex.bodyPart===bp).length;
      const colors = {Chest:"#ef4444",Back:"#f59e0b",Shoulders:"#f97316",Biceps:"#eab308",Triceps:"#84cc16",
        Quads:"#10b981",Hamstrings:"#14b8a6",Glutes:"#06b6d4",Calves:"#3b82f6",Core:"#8b5cf6",Cardio:"#6b7280"};
      const c = colors[bp]||"#94a3b8";
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:999px;border:1.5px solid ${c}33;background:${c}12;color:${c};font-size:11px;font-weight:700;">${escapeHtml(bp)} <span style="opacity:.8;">(${cnt})</span></span>`;
    }).join("");
  }

  // Helper: item detail card (GymScape-style)
  function equipItemCard(it){
    const placed = countPlaced(it.id);
    const isExpanded = expandedItemId === it.id;
    const tab = isExpanded ? expandedTab : "general";
    const pat = rackPatternInfo(it);
    const fp = footprint(it);
    const effSqFt = Math.max(0.01, ((fp.L + 2*r.clearance) * (fp.W + 2*r.clearance)));
    const covered = getItemCoveredBodyParts(it);
    const availEx = exerciseCountAvailableForCoverage(covered);
    const totalEx = exerciseCountSumByBodyPart(covered);
    const availPerSq = round1(availEx / effSqFt);
    const totalPerSq = round1(totalEx / effSqFt);
    const tags = getItemBodyPartTags(it);

    const specsHtml = `
      <div class="gymItemSpecs">
        ${it.brand ? `<div class="specRow"><span class="specLabel">Brand</span><span class="specVal">${escapeHtml(it.brand)}</span></div>` : ""}
        ${fp.L ? `<div class="specRow"><span class="specLabel">Length</span><span class="specVal">${round1(fp.L)} ft</span></div>` : ""}
        ${fp.W ? `<div class="specRow"><span class="specLabel">Width</span><span class="specVal">${round1(fp.W)} ft</span></div>` : ""}
        ${fp.H ? `<div class="specRow"><span class="specLabel">Height</span><span class="specVal">${round1(fp.H)} ft</span></div>` : ""}
        <div class="specRow"><span class="specLabel">Price</span><span class="specVal">${money(it.total,currency)}</span></div>
        ${safeHttpUrl(it.productLink) ? `<div class="specRow"><span class="specLabel">Link</span><span class="specVal">${productLinkAnchorHtml(it.productLink, productLinkLabel(it.productLink))}</span></div>` : ""}
        ${pat ? `<div class="specRow"><span class="specLabel">Uprights</span><span class="specVal">${escapeHtml(pat.uprightSize||"—")}</span></div>` : ""}
        ${pat ? `<div class="specRow"><span class="specLabel">Holes</span><span class="specVal">${escapeHtml(pat.holeSize||"—")} / ${escapeHtml(pat.holeSpacing||"—")} spacing</span></div>` : ""}
      </div>
    `;

    const tagSet = new Set(tags);
    const tagTogglesHtml = `
      <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
        <div class="muted" style="font-size:11px; font-weight:700; margin-bottom:6px;">Muscle groups (tap to add / remove)</div>
        <div class="checks" style="gap:5px;">
          ${ITEM_BODY_PART_TAGS.map(tag=>`
            <button type="button" class="checkBtn ${tagSet.has(tag)?"on":""}" data-action="toggleTagForItem" data-id="${escapeAttr(it.id)}" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>
          `).join("")}
        </div>
      </div>
    `;
    const exercisesHtml = `
      <div style="padding:6px 0;">
        <div class="gymStatRow"><span class="gymStatLabel">Total Exercises</span><span class="gymStatVal">${totalEx}</span></div>
        <div class="gymStatRow gymStatNew"><span class="gymStatLabel">Exercises / sq ft</span><span class="gymStatVal">${availPerSq}</span></div>
        <div class="gymStatRow"><span class="gymStatLabel">Available exercises</span><span class="gymStatVal">${availEx}</span></div>
        <div class="gymStatRow gymStatNew"><span class="gymStatLabel">Avail / sq ft</span><span class="gymStatVal">${totalPerSq}</span></div>
        ${tags.length ? `
          <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;">
            ${itemBodyPartChips(it)}
          </div>
        ` : `<div class="muted" style="font-size:12px; margin-top:6px;">Add muscle group tags below to see exercise stats.</div>`}
        ${tagTogglesHtml}
      </div>
    `;

    const generalHtml = `
      <div style="padding:6px 0;">
        ${specsHtml}
        ${it.notes ? `<div class="muted" style="font-size:12px;margin-top:8px;white-space:pre-wrap;">${escapeHtml(it.notes)}</div>` : ""}
      </div>
    `;

    const thumbSrc = (it.layoutImageDataUrl && String(it.layoutImageDataUrl).startsWith("data:")) ? it.layoutImageDataUrl : "";
    const thumbHtml = thumbSrc
      ? `<img src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(it.name)}" class="gymItemCardThumb" data-action="openLightbox" data-src="${escapeAttr(thumbSrc)}" data-caption="${escapeAttr(it.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;cursor:zoom-in;background:#f8fafc;" />`
      : `<div class="gymItemCardThumb" aria-hidden="true" style="width:48px;height:48px;border-radius:8px;border:1px dashed var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:18px;background:#f8fafc;">▦</div>`;
    const isComparing = activeCompareSet.items.some(e=> e && e.itemId === it.id);
    return `
      <div class="gymItemCard ${isExpanded ? "expanded" : ""}" data-id="${it.id}">
        <div class="gymItemCardRow">
          <button type="button" class="gymItemCardHeader" data-action="toggleExpandItem" data-id="${it.id}" aria-expanded="${isExpanded?"true":"false"}" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
            ${thumbHtml}
            <div style="min-width:0; flex:1;">
              ${it.brand ? `<div style="font-size:10px;color:var(--muted);font-weight:600;margin-bottom:1px;">${escapeHtml(it.brand)}</div>` : ""}
              <div style="font-weight:800;font-size:13px;line-height:1.3;">${escapeHtml(it.name)}</div>
              <div style="font-size:12px;margin-top:2px;">
                <span style="font-weight:700;color:#0f172a;">${money(it.total,currency)}</span>
                ${pat ? `<span style="color:var(--muted);margin-left:6px;font-size:11px;">${escapeHtml(pat.uprightSize||"")}${pat.holeSize ? ` • ${pat.holeSize}`:""}</span>` : ""}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              <span style="font-size:12px;color:var(--muted);font-weight:600;">${placed > 0 ? `${placed} placed` : ""}</span>
              <span style="font-size:14px;color:#94a3b8;" aria-hidden="true">${isExpanded ? "▲" : "▼"}</span>
            </div>
          </button>
          <div class="quickBtnStack">
            <button type="button" class="quickAddBtn" data-action="addInst" data-id="${it.id}" title="Quick add to layout (skip expand)" aria-label="Add ${escapeAttr(it.name)} to layout">+</button>
            <button type="button" class="quickCompareBtn ${isComparing ? "on" : ""}" data-action="toggleCompareLayout" data-id="${it.id}" title="${isComparing ? "Remove from compare" : "Add to compare (shows size next to staging)"}" aria-label="${isComparing ? "Remove" : "Compare"} ${escapeAttr(it.name)}">⇌</button>
          </div>
        </div>

        ${isExpanded ? `
          <div style="padding:10px 12px 4px;">
            ${safeHttpUrl(it.productLink) ? `<div style="margin-bottom:10px;">${productLinkAnchorHtml(it.productLink, productLinkLabel(it.productLink) + " ↗")}</div>` : ""}
            <div style="display:flex;gap:6px;margin-bottom:10px;">
              <button type="button" class="btn primary" style="flex:1;padding:10px;font-size:13px;font-weight:700;" data-action="addInst" data-id="${it.id}">Add to Layout</button>
              <div style="display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:12px;padding:4px 8px;background:#fff;">
                <span style="font-size:12px;font-weight:600;color:var(--muted);">Qty</span>
                <span style="font-weight:800;font-size:14px;min-width:18px;text-align:center;">${placed}</span>
              </div>
            </div>
            <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:10px;">
              ${["general","exercises"].map(t=>`
                <button type="button" class="gymTab ${tab===t?"active":""}" data-action="setItemTab" data-id="${it.id}" data-tab="${t}" style="flex:1;padding:7px 4px;font-size:12px;font-weight:700;border:none;border-bottom:2px solid ${tab===t?"#2563eb":"transparent"};background:transparent;cursor:pointer;color:${tab===t?"#2563eb":"#64748b"};">${t==="general"?"General":"Exercises"}</button>
              `).join("")}
            </div>
            ${tab === "general" ? generalHtml : exercisesHtml}
          </div>
        ` : ""}
      </div>
    `;
  }

  // Left sidebar - Equipment list
  const leftSidebar = `
    <aside class="layoutEquipmentLibrary leftSidebar layoutEquipmentScroll ${state.layoutWorkspace?.libraryDrawerOpen?"isOpen":""}" aria-label="Equipment library">
      <div class="card">
        <div class="hd" style="padding:12px;">
          <div>
            <div class="h1">Room Dimensions</div>
          </div>
          <button type="button" class="btn ghost" data-action="editRoomDims">Edit</button>
        </div>
        <div class="bd" style="padding:12px; padding-top:0;">
          <div class="row" style="justify-content:space-between; font-size:13px;">
            <span>L: <b>${round1(r.L)}</b></span>
            <span>W: <b>${round1(r.W)}</b></span>
            <span>H: <b>${round1(settingsCeilingHeightTotalFt())}</b></span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="hd" style="padding:12px;">
          <div>
            <div class="h1">My Equipment</div>
            <div class="h2">${rows.length} items</div>
          </div>
        </div>
        <div class="bd" style="padding:0;">
          <label class="layoutSearchField">
            <span class="srOnly">Search equipment</span>
            <input id="layoutEquipmentSearch" type="search" value="${escapeAttr(searchQuery)}" placeholder="Search equipment…" autocomplete="off" />
          </label>
          <!-- Category filter -->
          <div style="padding:0 12px 8px; display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-top:8px;">
            ${categories.map(cat=>`
              <button class="catBtn ${selectedCat===cat?'active':''}" data-action="layoutCatFilter" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)}</button>
            `).join("")}
          </div>

          <!-- Brand / company filter -->
          ${allBrands.length ? `
          <div style="padding:10px 12px; border-bottom:1px solid var(--border);">
            <div class="outlinedSelectWrap" style="margin-bottom:0; max-width:none;">
              <label class="outlinedSelectLabel" for="filterBrandSel">Brand / Company</label>
              <select id="filterBrandSel" class="outlinedSelect" style="font-size:12px; padding:8px 10px; border-width:1px;">
                <option value="All"${selectedBrand==="All"?" selected":""}>All brands</option>
                ${allBrands.map(b=>`<option value="${escapeAttr(b)}"${selectedBrand===b?" selected":""}>${escapeHtml(b)}</option>`).join("")}
                <option value="__noBrand__"${selectedBrand==="__noBrand__"?" selected":""}>— No brand —</option>
              </select>
            </div>
          </div>
          ` : ""}

          ${showRackFilters ? `
          <!-- Rack filters: Upright Size + Hole Diameter -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:10px 12px; border-bottom:1px solid var(--border);">
            <div class="outlinedSelectWrap" style="margin-bottom:0; max-width:none;">
              <label class="outlinedSelectLabel" for="filterUprightSel">Upright Size</label>
              <select id="filterUprightSel" class="outlinedSelect" style="font-size:12px; padding:8px 10px; border-width:1px;" data-action="layoutFilterUpright">
                <option value="All"${filterUpright==="All"?" selected":""}>All</option>
                ${allUprights.map(u=>`<option value="${escapeAttr(u)}"${filterUpright===u?" selected":""}>${escapeHtml(u)}</option>`).join("")}
              </select>
            </div>
            <div class="outlinedSelectWrap" style="margin-bottom:0; max-width:none;">
              <label class="outlinedSelectLabel" for="filterHoleSel">Hole Diameter</label>
              <select id="filterHoleSel" class="outlinedSelect" style="font-size:12px; padding:8px 10px; border-width:1px;" data-action="layoutFilterHole">
                <option value="All"${filterHole==="All"?" selected":""}>All</option>
                ${allHoles.map(h=>`<option value="${escapeAttr(h)}"${filterHole===h?" selected":""}>${escapeHtml(h)}</option>`).join("")}
              </select>
            </div>
          </div>
          ` : ""}

          <!-- Equipment list -->
          <div class="gymItemList">
            ${filteredRows.map(it=> equipItemCard(it)).join("")}
            ${!filteredRows.length ? `<div class="layoutLibraryEmpty" role="status"><strong>No equipment matches</strong><span>Try another search or clear the current filters.</span><button class="btn" data-action="layout_clear_filters">Clear filters</button></div>` : ""}
          </div>
        </div>
      </div>
    </aside>
  `;

  const toolsOpen = !!state.layoutToolsPanelOpen;
  const spatialMode = ["plan", "split", "3d"].includes(state.layout.spatialViewMode)
    ? state.layout.spatialViewMode
    : "plan";
  const selectedItem = selectedInst ? getItemById(selectedInst.itemId) : null;
  const selectedStatus = state.layoutActionStatus?.instId===selectedInst?.id
    ? state.layoutActionStatus
    : null;
  const selectedEquipmentToolbar = selectedInst && selectedItem && spatialMode!=="3d" ? `
    <div class="selectedEquipmentToolbar" role="group" aria-label="Selected equipment actions">
      <span class="selectedEquipmentToolbarLabel">Selected: ${escapeHtml(selectedItem.name||"Equipment")}</span>
      <button type="button" class="planRotateBtn" data-action="rotateInst" data-id="${escapeAttr(selectedInst.id)}" data-focus-key="plan-toolbar-rotate:${escapeAttr(selectedInst.id)}" aria-keyshortcuts="R">↻ Rotate 90° <kbd>R</kbd></button>
      ${selectedStatus ? `<div class="selectedEquipmentStatus ${escapeAttr(selectedStatus.tone||"success")}">${escapeHtml(selectedStatus.message||"")}</div>` : ""}
    </div>
  ` : "";
  const activeLayoutName = (state.layouts || []).find(x=>x.id===state.activeLayoutId)?.name || "Current layout";
  const walkthroughEditor=GymWalkthroughEditing.state();
  const walkthroughEditing=walkthroughEditor.mode==="edit";
  // Right sidebar - layout tools (collapsible) + layout selector
  const selectionInspector = `
    ${selectedInst ? selectedEquipmentPanel(selectedInst) : ""}
    ${selectedArea ? selectedAreaPanel(selectedArea) : ""}
    ${selectedOutlet ? selectedOutletPanel(selectedOutlet) : ""}
    ${selectedWallExt ? selectedWallExtPanel(selectedWallExt) : ""}
    ${selectedCeilZone ? selectedCeilingZonePanel(selectedCeilZone) : ""}
    ${selectedFloorZone ? selectedFloorZonePanel(selectedFloorZone) : ""}
    ${selectedFlooring ? selectedFlooringPanel(selectedFlooring) : ""}
    ${selectedWallFeature ? selectedWallFeaturePanel(selectedWallFeature,selectedWallFeatureValidation) : ""}
  `;
  const hasLayoutSelection=LayoutEditorCore.selectionType(state.layout)!=="none";
  const rightSidebar = `
    <aside class="layoutContextInspector rightSidebar layoutInspectorScroll ${state.layoutWorkspace?.inspectorDrawerOpen?"isOpen":""}" aria-label="Layout inspector">
      ${hasLayoutSelection ? `<div class="layoutInspectorSelectionHeader"><div><span class="layoutInspectorEyebrow">Selected</span><strong>${escapeHtml(LayoutEditorCore.selectionType(state.layout).replaceAll("-"," "))}</strong></div><button type="button" class="iconBtn" data-action="layout_clear_selection">Clear</button></div>${selectionInspector}` : ""}
      <div class="card spatialSettingsCard">
        <div class="hd" style="padding:12px 12px 8px;">
          <div>
            <div class="h1">View Settings</div>
            <div class="h2">3D and walkthrough</div>
          </div>
        </div>
        <div class="bd spatialSettingsBody">
          <label class="spatialField" for="spatialWallColor">
            <span>Wall color</span>
            <select id="spatialWallColor">
              <option value="white"${spatial.wallColor==="white"?" selected":""}>White</option>
              <option value="black"${spatial.wallColor==="black"?" selected":""}>Black</option>
            </select>
          </label>
          <label class="spatialField" for="spatialFloorType">
            <span>Floor</span>
            <select id="spatialFloorType">
              <option value="rolled-rubber"${spatial.floorType==="rolled-rubber"?" selected":""}>Rolled rubber</option>
              <option value="rubber-tiles"${spatial.floorType==="rubber-tiles"?" selected":""}>Rubber tiles</option>
              <option value="concrete"${spatial.floorType==="concrete"?" selected":""}>Concrete</option>
            </select>
          </label>
          <label class="spatialField" for="spatialFov">
            <span>Field of view</span>
            <select id="spatialFov">
              ${[
                [60, "Standard"],
                [70, "Wide"],
                [80, "Wider"],
                [90, "Widest"],
              ].map(([value,label])=>`<option value="${value}"${Math.round(safeNum(spatial.fovDeg))===value?" selected":""}>${label} · ${value}°</option>`).join("")}
            </select>
          </label>
          <label class="spatialField" for="spatialEyeHeight">
            <span>Eye height</span>
            <select id="spatialEyeHeight">
              ${[4.5,5,5.25,5.5,5.67,6,6.5].map(v=>`<option value="${v}"${Math.abs(safeNum(spatial.eyeHeightFt)-v)<0.02?" selected":""}>${v===5.67?"5 ft 8 in":v===5.25?"5 ft 3 in":`${v} ft`}</option>`).join("")}
            </select>
          </label>
          ${[
            ["walls", "Walls"],
            ["ceiling", "Ceiling"],
            ["clearances", "Clearances"],
            ["collisions", "Walkthrough collisions"],
          ].map(([key,label])=>`
            <label class="spatialToggle">
              <span>${label}</span>
              <input type="checkbox" data-action="spatial_toggle" data-key="${key}" ${spatial[key] ? "checked" : ""} />
              <span class="spatialToggleTrack" aria-hidden="true"></span>
            </label>
          `).join("")}
          <label class="spatialField" for="spatialLabelMode">
            <span>Equipment labels</span>
            <select id="spatialLabelMode">
              <option value="selected"${labelMode==="selected"?" selected":""}>Selected only</option>
              <option value="hover"${labelMode==="hover"?" selected":""}>Hover or selected</option>
              <option value="always"${labelMode==="always"?" selected":""}>Always</option>
              <option value="off"${labelMode==="off"?" selected":""}>Off</option>
            </select>
          </label>
        </div>
      </div>

      <div class="card">
        <button type="button" class="hd collapsiblePanelHd" style="padding:12px; cursor:pointer; user-select:none; width:100%; margin:0; font:inherit; color:inherit; text-align:left; background:transparent; border:none; border-radius:0; appearance:none; -webkit-appearance:none;" data-action="toggleLayoutToolsPanel" title="Show or hide layout tools" aria-expanded="${toolsOpen?"true":"false"}">
          <div>
            <div class="h1">Layout Tools</div>
            <div class="h2">${toolsOpen ? "Wall extensions, zones, flooring" : "Tap to expand"}</div>
          </div>
          <span class="collapseChev" aria-hidden="true">${toolsOpen ? "▲" : "▼"}</span>
        </button>
        ${toolsOpen ? `
        <div class="bd" style="padding:12px; padding-top:0;">
          <div class="outlinedSelectWrap" style="margin-bottom:12px; max-width:none;">
            <label class="outlinedSelectLabel" for="layoutEditorUnitSelect">Editor units</label>
            <select id="layoutEditorUnitSelect" class="outlinedSelect" style="font-size:12px; padding:8px 10px; border-width:1px;">
              <option value="ft"${layoutEditorUnit()==="ft"?" selected":""}>Feet (decimals)</option>
              <option value="in"${layoutEditorUnit()==="in"?" selected":""}>Inches</option>
            </select>
          </div>
            <div class="muted" style="font-size:11px; margin:-6px 0 10px;">Editor unit affects axis labels. Sub-foot precision: use <b>+ in</b> to show an inch field, or type feet as decimals.</div>
          <label class="row" style="align-items:center; gap:8px; font-size:12px; margin:0 0 10px; cursor:pointer; flex-wrap:wrap;">
            <input type="checkbox" data-action="toggle_layout_dim_overlay" ${state.settings.layoutDimOverlay ? "checked" : ""} />
            <span>Show dimensions on layout (selected item)</span>
          </label>
          <div class="outlinedSelectWrap" style="margin-bottom:12px; max-width:none;">
            <label class="outlinedSelectLabel" for="layoutGridContrastSelect">Grid darkness</label>
            <select id="layoutGridContrastSelect" class="outlinedSelect" style="font-size:12px; padding:8px 10px; border-width:1px;">
              <option value="1"${(safeNum(state.settings.layoutGridContrast)||1)===1?" selected":""}>Normal</option>
              <option value="2"${(safeNum(state.settings.layoutGridContrast)||1)===2?" selected":""}>Darker</option>
              <option value="3"${(safeNum(state.settings.layoutGridContrast)||1)===3?" selected":""}>Darkest</option>
            </select>
          </div>
          <div class="label"><span>Wall Extensions</span></div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px;">
            <button class="btn" style="font-size:11px;" data-action="addWallExt" data-wall="left">← Left</button>
            <button class="btn" style="font-size:11px;" data-action="addWallExt" data-wall="right">Right →</button>
            <button class="btn" style="font-size:11px;" data-action="addWallExt" data-wall="top">↑ Top</button>
            <button class="btn" style="font-size:11px;" data-action="addWallExt" data-wall="bottom">Bottom ↓</button>
          </div>

          <div class="label"><span>Wall finishes &amp; lighting</span></div>
          <div class="wallFeatureToolGroup">
            <button type="button" class="btn wallFeatureToolBtn" data-action="add_wall_feature" data-kind="mirror">Mirror</button>
            <button type="button" class="btn wallFeatureToolBtn" data-action="add_wall_feature" data-kind="slat">Wood slat panel</button>
            <button type="button" class="btn wallFeatureToolBtn" data-action="add_wall_feature" data-kind="led">LED strip</button>
          </div>
          
          <div class="label"><span>Reserved Areas</span></div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
            <button class="btn" style="font-size:11px; flex:1;" data-action="addArea" data-kind="walkway">Walkway</button>
            <button class="btn" style="font-size:11px; flex:1;" data-action="addArea" data-kind="door">Door</button>
            <button class="btn" style="font-size:11px; flex:1;" data-action="addArea" data-kind="nogospace">No-go</button>
          </div>
          
          <div class="label"><span>Utilities & Zones</span></div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
            <button class="btn" style="font-size:11px; flex:1;" data-action="addOutlet">Outlet</button>
            <button class="btn" style="font-size:11px; flex:1;" data-action="addCeilingZone">Ceiling</button>
            <button class="btn" style="font-size:11px; flex:1;" data-action="addFloorZone">Floor</button>
          </div>
          
          <div class="label"><span>Flooring</span></div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${FLOORING_TYPES.map(ft=>`<button class="btn" style="font-size:11px;" data-action="addFlooring" data-type="${ft.id}">${escapeHtml(ft.name)}</button>`).join("")}
          </div>
          <div class="muted" style="font-size:11px; margin-top:8px;">
            ${(state.layout.flooringPieces||[]).length} pcs • ${round1(totalFlooringArea())} sq ft • ${money(totalFlooringCost(), currency)}
          </div>
        </div>
        ` : ""}
      </div>
      
      <div class="card">
        <div class="hd" style="padding:12px;">
          <div>
            <div class="h1">Layout</div>
          </div>
        </div>
        <div class="bd" style="padding:12px; padding-top:0;">
          <select data-action="layout_select" style="width:100%; margin-bottom:8px;">
            ${opts}
          </select>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button class="btn" style="font-size:11px;" data-action="layout_new">New</button>
            <button class="btn" style="font-size:11px;" data-action="layout_dup">Duplicate</button>
            <button class="btn" style="font-size:11px;" data-action="layout_rename">Rename</button>
            <button class="btn danger" style="font-size:11px;" data-action="layout_delete">Delete</button>
          </div>
        </div>
      </div>
    </aside>
  `;

  // Center - Canvas
  const compareSets = Array.isArray(state.layout.compareSets) ? state.layout.compareSets : [];
  const compareSetsBar = `
    <div class="compareSetsBar">
      <span class="compareSetsBadge" title="Compare sets let you build and save multiple size comparisons (e.g. one for racks, one for benches) and switch between them.">Compare</span>
      <select class="compareSetsSelect" data-action="compareSet_select" title="Switch active compare set">
        ${compareSets.map(s=> `<option value="${escapeAttr(s.id)}"${s.id===activeCompareSet.id?' selected':''}>${escapeHtml(s.name)} (${(s.items||[]).length})</option>`).join("")}
      </select>
      <button type="button" class="btn ghost compareSetsBtn" data-action="compareSet_new" title="Start a brand new empty compare set">+ New</button>
      <button type="button" class="btn ghost compareSetsBtn" data-action="compareSet_duplicate" title="Duplicate the active set (same items, new name)">Duplicate</button>
      <button type="button" class="btn ghost compareSetsBtn" data-action="compareSet_rename" title="Rename the active compare set">Rename</button>
      <button type="button" class="btn ghost compareSetsBtn compareSetsBtnDanger" data-action="compareSet_delete" title="Delete the active compare set" ${compareSets.length<=1?'disabled':''}>Delete</button>
      ${activeCompareSet.items.length ? `<button type="button" class="btn ghost compareSetsBtn" data-action="clearCompareLayout" title="Remove all items from the active set (keeps the set itself)">Clear items</button>` : ``}
    </div>
  `;
  const currentStagingSize = (typeof getStagingSize === "function" ? getStagingSize() : "small");
  const stagingPresets = [
    { key: "small",  label: "S",  desc: "Small • 6 ft wide" },
    { key: "medium", label: "M",  desc: "Medium • 10 ft wide" },
    { key: "large",  label: "L",  desc: "Large • 14 ft wide, +6 ft tall" },
    { key: "xlarge", label: "XL", desc: "X-Large • 20 ft wide, +14 ft tall" },
  ];
  const stagingBar = `
    <div class="stagingBar">
      <span class="stagingBadge" title="Grow the staging / parking strip so more equipment can sit there while you rearrange the layout.">Staging</span>
      <div class="stagingSizeGroup" role="group" aria-label="Staging size">
        ${stagingPresets.map(p=> `<button type="button" class="stagingSizeBtn ${currentStagingSize===p.key?'active':''}" data-action="staging_size" data-size="${p.key}" title="${escapeAttr(p.desc)}">${p.label}</button>`).join("")}
      </div>
      <span class="stagingSizeHint">${escapeHtml(round1(staging.w))} × ${escapeHtml(round1(staging.h))} ft</span>
    </div>
  `;
  const centerCanvas = `
    <div class="layoutCanvasCard canvasCard card" aria-label="Layout canvas">
      <div class="spatialTopbar">
        <div class="workspaceDrawerActions">
          <button type="button" class="workspaceDrawerBtn" data-action="toggleLibraryDrawer" aria-expanded="${state.layoutWorkspace?.libraryDrawerOpen?"true":"false"}">Equipment</button>
          <button type="button" class="workspaceDrawerBtn" data-action="toggleInspectorDrawer" aria-expanded="${state.layoutWorkspace?.inspectorDrawerOpen?"true":"false"}">Inspector</button>
        </div>
        <div class="spatialModeGroup" role="group" aria-label="Layout view">
          <button type="button" class="spatialModeBtn ${spatialMode==="plan"?"active":""}" data-action="spatial_mode" data-mode="plan">Plan</button>
          <button type="button" class="spatialModeBtn ${spatialMode==="split"?"active":""}" data-action="spatial_mode" data-mode="split">Split 2D + 3D</button>
          <button type="button" class="spatialModeBtn ${spatialMode==="3d"?"active":""}" data-action="spatial_mode" data-mode="3d">3D</button>
        </div>
        <div class="spatialTopbarActions">
          ${spatialFrameSelectedControl({
            spatialMode,
            selectedInstId:state.layout.selectedInstId,
            selectedAreaId:state.layout.selectedAreaId,
            selectedWallFeatureId:state.layout.selectedWallFeatureId,
            wallFeatureValid:selectedWallFeatureValidation?.valid!==false,
            wallFeatureReason:selectedWallFeatureValidation?.reasons[0]?.message||"",
            wallsVisible:spatial.walls!==false,
          })}
          <button type="button" class="focusCanvasBtn ${state.layoutFocusMode?"active":""}" data-action="toggle_layout_focus" aria-pressed="${state.layoutFocusMode?"true":"false"}">${state.layoutFocusMode?"Show panels":"Focus canvas"}</button>
          <button type="button" class="walkthroughEnterBtn" data-action="spatial_walkthrough_open" data-focus-key="walkthrough-launcher">Enter walkthrough</button>
        </div>
      </div>
      <div class="spatialUtilityBars">
        ${stagingBar}
        ${compareSetsBar}
      </div>
      <div class="spatialCanvasGrid spatialMode-${spatialMode}">
        <div class="spatialPlanPane">
          <div class="spatialPaneLabel"><span>Floor plan</span><span>Drag equipment to reposition</span></div>
          ${selectedEquipmentToolbar}
          <div class="svgWrap">
            <div class="svgTopTag">
              ${round1(r.W)} × ${round1(r.L)} ft • ${round1(r.area)} sq ft • Ceiling ${round1(settingsCeilingHeightTotalFt())} ft
            </div>
            <svg id="layoutSvg" class="svg" data-grid="${clamp(Math.round(safeNum(state.settings.layoutGridContrast)||1),1,3)}" viewBox="${vb}" preserveAspectRatio="xMinYMin meet">
              <defs>
                <clipPath id="roomGridClip" clipPathUnits="userSpaceOnUse">
                  ${gridClipRects}
                </clipPath>
              </defs>
              <g clip-path="url(#roomGridClip)">
                ${grid.join("")}
              </g>
              <g class="stagingZone" data-type="staging">
                <rect x="${staging.x}" y="${staging.y}" width="${staging.w}" height="${staging.h}" fill="rgba(59, 130, 246, 0.06)" stroke="rgba(59, 130, 246, 0.35)" stroke-width="0.08" stroke-dasharray="0.22 0.18" rx="0.18" />
                <text x="${staging.x+0.28}" y="${staging.y+0.55}" style="font-size:0.5px; font-weight:800; fill:rgba(30, 64, 175, 0.9);">Staging / Parking</text>
                <text x="${staging.x+0.28}" y="${staging.y+0.92}" style="font-size:0.38px; font-weight:600; fill:rgba(30, 64, 175, 0.75);">Drag equipment here while rearranging</text>
              </g>
          ${hasCompare ? `
          <g class="compareZone" data-type="compare">
            <rect x="${compare.zone.x}" y="${compare.zone.y}" width="${compare.zone.w}" height="${compare.zone.h}" fill="rgba(124, 58, 237, 0.06)" stroke="rgba(124, 58, 237, 0.4)" stroke-width="0.08" stroke-dasharray="0.22 0.18" rx="0.18" />
            <text x="${compare.zone.x+0.28}" y="${compare.zone.y+0.55}" style="font-size:0.5px; font-weight:800; fill:rgba(91, 33, 182, 0.95);">${escapeSvg(activeCompareSet.name)} (${compareItemsResolved.length})</text>
            <g data-action="clearCompareLayout" style="cursor:pointer;">
              <rect x="${compare.zone.x + compare.zone.w - 1.7}" y="${compare.zone.y + 0.18}" width="1.5" height="0.42" rx="0.12" fill="rgba(124, 58, 237, 0.15)" stroke="rgba(124, 58, 237, 0.55)" stroke-width="0.04" />
              <text x="${compare.zone.x + compare.zone.w - 0.95}" y="${compare.zone.y + 0.46}" text-anchor="middle" style="font-size:0.28px; font-weight:700; fill:rgba(91, 33, 182, 0.95); pointer-events:none;">Clear all</text>
            </g>
            ${compare.placed.map((p)=>{
              const it = p.item;
              const thumbSrc = (it.layoutImageDataUrl && String(it.layoutImageDataUrl).startsWith("data:")) ? it.layoutImageDataUrl : "";
              const dimsStr = `${round1(p.L)}' L × ${round1(p.W)}' W`;
              const brand = String(it.brand||"").trim();
              const labelBoxH = Math.min(0.92, Math.max(0.48, p.h - 0.16));
              const isDragging = state.drag && state.drag.active && state.drag.type === "compareDrag" && state.drag.id === it.id;
              return `
                <g class="compareItem${isDragging?' dragging':''}" data-type="compareItem" data-id="${escapeAttr(it.id)}" style="cursor:move;${isDragging?' opacity:0.85;':''}">
                  <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#fff" stroke="rgba(124, 58, 237, ${isDragging?'0.95':'0.6'})" stroke-width="${isDragging?'0.1':'0.06'}" rx="0.1" />
                  ${thumbSrc ? `<svg x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" overflow="hidden">
                    <image href="${escapeAttr(thumbSrc)}" xlink:href="${escapeAttr(thumbSrc)}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" opacity="0.78" />
                  </svg>
                  <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="none" stroke="rgba(124, 58, 237, 0.6)" stroke-width="0.06" rx="0.1" />` : ""}
                  <rect x="${p.x+0.08}" y="${p.y+0.08}" width="${Math.max(0.1, p.w - 0.16)}" height="${labelBoxH}" fill="rgba(255,255,255,0.92)" rx="0.06" />
                  <text x="${p.x+0.2}" y="${p.y+0.42}" style="font-size:0.32px; font-weight:800; fill:#1f2937;">${escapeSvg((it.name||"").slice(0,60))}</text>
                  <text x="${p.x+0.2}" y="${p.y+0.72}" style="font-size:0.26px; font-weight:600; fill:#6b7280;">${escapeSvg(dimsStr)}${brand ? " • " + escapeSvg(brand.slice(0,24)) : ""}</text>
                  <g data-action="rotateCompareLayout" data-id="${escapeAttr(it.id)}" style="cursor:pointer;">
                    <title>Rotate 90°</title>
                    <circle cx="${p.x + p.w - 0.68}" cy="${p.y + 0.24}" r="0.2" fill="rgba(59, 130, 246, 0.92)" />
                    <text x="${p.x + p.w - 0.68}" y="${p.y + 0.28}" text-anchor="middle" dominant-baseline="middle" style="font-size:0.26px; font-weight:900; fill:#fff; pointer-events:none;">⟳</text>
                  </g>
                  <g data-action="removeCompareLayout" data-id="${escapeAttr(it.id)}" style="cursor:pointer;">
                    <title>Remove from compare</title>
                    <circle cx="${p.x + p.w - 0.24}" cy="${p.y + 0.24}" r="0.2" fill="rgba(124, 58, 237, 0.92)" />
                    <text x="${p.x + p.w - 0.24}" y="${p.y + 0.28}" text-anchor="middle" dominant-baseline="middle" style="font-size:0.3px; font-weight:900; fill:#fff; pointer-events:none;">×</text>
                  </g>
                </g>
              `;
            }).join("")}
          </g>
          ` : ""}
          ${roomSvg}
          ${wallExtsSvg}
          ${flooringSvg}
          ${ceilZonesSvg}
          ${floorZonesSvg}
          ${areasSvg}
          ${outletsSvg}
          ${wallFeaturesSvg}
          ${instSvg}
          ${layoutDimOverlaySvg()}
          ${roomDimensionsSvg(r)}
            </svg>
          </div>
        </div>
        <div class="spatial3dPane">
          <div class="spatialPaneLabel"><span>Live 3D</span><span>${inRoomInstances.length} in room${stagedInstanceCount ? ` · ${stagedInstanceCount} parked in staging` : ""} · drag to orbit</span></div>
          <div class="gym3dViewport" data-gym3d="preview">
            <div class="gym3dLoading">Building your room…</div>
            <div class="gym3dCornerNote">Perspective preview</div>
            <div class="gym3dWarnings" data-gym3d-warnings></div>
          </div>
        </div>
      </div>
    </div>
    ${state.layout.walkthroughOpen ? `
      <dialog class="walkthroughOverlay" aria-modal="true" aria-label="First-person gym walkthrough">
        <div class="walkthroughHeader">
          <div class="walkthroughTitle">
            <span class="walkthroughEyebrow">First-person walkthrough</span>
            <strong>${escapeHtml(activeLayoutName)}</strong>
          </div>
          ${walkthroughModeSwitch()}
          <div class="walkthroughHeaderActions">
            <button type="button" class="btn walkthroughReset" data-action="spatial_walkthrough_reset">Reset view</button>
            <button type="button" class="btn walkthroughExit" data-action="spatial_walkthrough_close" autofocus>Exit walkthrough</button>
          </div>
        </div>
        <div class="walkthroughStage${walkthroughEditing?" isEditing":""}">
          <div class="gym3dViewport walkthroughViewport${walkthroughEditing?" isEditing":""}" data-gym3d="walkthrough">
            <div class="gym3dLoading">Preparing walkthrough…</div>
            <button type="button" class="walkthroughStart" data-action="gym3d_lock">
              <strong>Click to walk</strong>
              <span>W A S D to move · drag in the room to look</span>
            </button>
            <div class="walkthroughStatus" data-walkthrough-status>Click to activate walking controls</div>
            <div class="walkthroughControls"><b>W A S D</b><span>Move</span><b>Mouse drag</b><span>Look</span></div>
            <canvas class="walkthroughMinimap" width="220" height="150" data-gym3d-minimap aria-label="Walkthrough minimap"></canvas>
            <div class="gym3dWarnings" data-gym3d-warnings></div>
          </div>
          ${walkthroughEditing ? walkthroughEditPanel(false) : `<aside class="walkthroughGuide">
            <div>
              <span class="walkthroughGuideKicker">Safety view</span>
              <h2>Move through the real plan</h2>
              <p>The camera uses the same room, equipment, doors, and clearance zones as the floor plan.</p>
            </div>
            <div class="walkthroughLegend">
              <span><i class="legendSwatch clearance"></i>Working clearance</span>
              <span><i class="legendSwatch warning"></i>Placement warning</span>
              <span><i class="legendSwatch selection"></i>Selected equipment</span>
            </div>
            <div class="walkthroughGuideStatus">
              <span>Eye height</span><strong>${round1(spatial.eyeHeightFt)} ft</strong>
              <span>Collision check</span><strong>${spatial.collisions ? "On" : "Off"}</strong>
              <span>In-room equipment</span><strong>${inRoomInstances.length}</strong>
              ${stagedInstanceCount ? `<span>Parked in staging</span><strong>${stagedInstanceCount}</strong>` : ""}
            </div>
          </aside>`}
        </div>
      </dialog>
    ` : ""}
  `;

  // Exercise coverage analysis (based on placed items only)
  const coverage = getLayoutCoverage();
  
  // Body part colors matching screenshot
  const bodyPartColors = {
    "Chest":      "#ef4444",  // red
    "Back":       "#f59e0b",  // amber
    "Shoulders":  "#f97316",  // orange
    "Biceps":     "#eab308",  // yellow
    "Triceps":    "#84cc16",  // lime
    "Quads":      "#10b981",  // emerald
    "Hamstrings": "#14b8a6",  // teal
    "Glutes":     "#06b6d4",  // cyan
    "Calves":     "#3b82f6",  // blue
    "Core":       "#8b5cf6",  // violet
    "Cardio":     "#6b7280",  // gray
  };

  const exerciseParts = BODY_PARTS.filter(bp=> bp !== "All");

  // Count exercises available for each body part
  const availByPart = {};
  const totalByPart = {};
  exerciseParts.forEach(bp=>{
    const all = EXERCISE_DATABASE.filter(ex=> ex.bodyPart === bp);
    totalByPart[bp] = all.length;
    availByPart[bp] = coverage.covered.has(bp) ? all.length : 0;
  });

  const totalAvail = exerciseParts.reduce((s,bp)=> s + availByPart[bp], 0);
  const totalAll   = EXERCISE_DATABASE.length;
  const needsEquipment = totalAll - totalAvail;

  const untaggedPlaced = coverage.placedItems.filter(item=> getItemBodyPartTags(item).length === 0);

  const coverageHtml = `
    <div class="card" style="margin-top:14px;">
      <div class="bd" style="padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border);">
          <div>
            <span style="font-weight:700; font-size:14px; color:#1f2937;">Total Exercises Available</span>
            <span style="font-weight:800; font-size:18px; color:#1f2937; margin-left:12px;">${totalAvail}</span>
          </div>
          <div>
            <span style="font-weight:700; font-size:14px; color:#6b7280;">Needs Equipment</span>
            <span style="font-weight:800; font-size:18px; color:#6b7280; margin-left:12px;">${needsEquipment}</span>
          </div>
        </div>

        ${coverage.placedItems.length ? `
          <div style="margin-bottom:20px;">
            <div style="font-weight:700; font-size:13px; color:#374151; margin-bottom:10px;">Muscle Engagement:</div>
            <div style="display:flex; gap:0; height:32px; border-radius:6px; overflow:hidden; border:1px solid #e5e7eb;">
              <div style="flex:1; background:#3b82f6; display:flex; align-items:center; justify-content:center; color:white; font-weight:600; font-size:12px;">Primary</div>
              <div style="flex:1; background:#e5e7eb; display:flex; align-items:center; justify-content:center; color:#6b7280; font-weight:600; font-size:12px;">Secondary</div>
              <div style="flex:1; background:#f3f4f6; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-weight:600; font-size:12px;">Tertiary</div>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-weight:700; font-size:13px; color:#374151;">Exercise Coverage by Body Part</span>
            </div>
            <div style="display:flex; align-items:flex-end; gap:4px; height:120px; padding:10px 0; border-bottom:2px solid #1f2937;">
              ${exerciseParts.map(bp=>{
                const color = bodyPartColors[bp] || "#94a3b8";
                const count = availByPart[bp];
                const maxCount = Math.max(...exerciseParts.map(p=> availByPart[p]));
                const heightPct = maxCount > 0 ? (count / maxCount * 100) : 0;
                return `
                  <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="width:100%; height:${heightPct}%; background:${color}; border-radius:3px 3px 0 0; min-height:${count > 0 ? '8px' : '0'}; transition:height 0.3s;"></div>
                    <span style="font-weight:700; font-size:11px; color:#1f2937;">${count}</span>
                  </div>
                `;
              }).join("")}
            </div>
            <div style="display:flex; gap:4px; margin-top:6px;">
              ${exerciseParts.map(bp=>`
                <div style="flex:1; text-align:center;">
                  <span style="font-size:9px; color:#6b7280; font-weight:600; writing-mode:horizontal-tb;">${escapeHtml(bp)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : `
          <div style="padding:40px 20px; text-align:center; color:#9ca3af; font-size:14px;">
            No equipment placed yet. Add items to the layout to see exercise coverage.
          </div>
        `}

        ${untaggedPlaced.length ? `
          <div style="margin-top:16px; padding:12px; border:1px solid #fbbf24; border-radius:8px; background:#fef3c7;">
            <span style="font-size:12px; font-weight:700; color:#92400e;">⚠ Items placed but not tagged:</span>
            ${untaggedPlaced.map(item=>`
              <span style="font-size:12px; color:#92400e;"> ${escapeHtml(item.name)}</span><span style="color:#92400e;">,</span>
            `).join("").replace(/,\s*$/, "")}
            — open an item’s <b>Exercises</b> tab (left list) or <a href="#" data-action="goToWishlist" style="font-size:12px; color:#1d4ed8; font-weight:600;">Wishlist</a> to tag.
          </div>
        ` : ""}
      </div>
    </div>
  `;

  return `
    <div class="layoutWorkspace layout3col ${state.layoutFocusMode?"isFocusMode layoutFocusMode":""}">
      ${leftSidebar}
      ${centerCanvas}
      ${rightSidebar}
    </div>
    ${(state.layoutWorkspace?.libraryDrawerOpen||state.layoutWorkspace?.inspectorDrawerOpen)?`<button class="workspaceDrawerBackdrop" data-action="closeLayoutDrawers" aria-label="Close layout panel"></button>`:""}
    ${state.layoutFocusMode ? "" : coverageHtml}
    ${equipmentDetailsEditor(currency)}
    <div class="srOnly" role="status" aria-live="polite" aria-atomic="true">${selectedStatus ? escapeHtml(selectedStatus.message||"") : ""}</div>
  `;
}

function equipmentDetailsEditor(currency){
  const workspace=state.layoutWorkspace;
  if(!workspace?.detailsEditorOpen) return "";
  const item=getItemById(workspace.detailsEditorItemId);
  if(!item) return "";
  return `
    <div class="equipmentDetailsBackdrop" data-action="closeEquipmentDetails" aria-hidden="true"></div>
    <section class="equipmentDetailsSheet" role="dialog" aria-modal="true" aria-labelledby="equipmentDetailsTitle">
      <header class="equipmentDetailsHeader">
        <div><span class="layoutInspectorEyebrow">Equipment details</span><h2 id="equipmentDetailsTitle">${escapeHtml(item.name||"Equipment")}</h2></div>
        <button type="button" class="iconBtn" data-action="closeEquipmentDetails">Close</button>
      </header>
      ${workspace.discardEditorConfirmOpen ? `
        <div class="equipmentDiscardPrompt" role="alertdialog" aria-modal="true" aria-label="Discard unsaved equipment changes?">
          <strong>Discard unsaved changes?</strong><span>Your edits have not been saved.</span>
          <div><button class="btn" data-action="keepEquipmentEditing">Keep editing</button><button class="btn danger" data-action="discardEquipmentDetails">Discard</button></div>
        </div>
      ` : ""}
      <div class="equipmentDetailsBody">${itemForm(currency)}</div>
    </section>
  `;
}

function selectedEquipmentPanel(inst){
  const item = getItemById(inst.itemId);
  if(!item) return "";
  const r = room();
  const dims = instanceDims(inst, item);

  const cfg = deadspaceConfig(inst);
  const sides = (Array.isArray(inst.deadspaceSides) && inst.deadspaceSides.length) ? inst.deadspaceSides : (state.settings.defaultDeadspaceSides||[]);

  const {base} = effectiveRectForInst(inst, item);
  const localCeiling = effectiveCeilingForRect(base);
  const defaultCeiling = settingsCeilingHeightTotalFt();
  const fp = footprint(item);
  const reqCeil = (String(item.requiredCeilingFt||"").trim()!=="") ? Math.max(0, safeNum(item.requiredCeilingFt)) : fp.H;
  const ceilingWarn = (reqCeil>0 && localCeiling>0 && reqCeil > localCeiling + 1e-6);
  const inZone = localCeiling < defaultCeiling - 0.01;

  const voltage = String(item.powerVoltage||"").trim();
  const cordMax = Math.max(0, safeNum(state.settings.maxCordLengthFt));
  const near = nearestOutletInfo(inst, item);
  const powerWarn = (!!voltage) && (!near.has || (Number.isFinite(near.dist) && cordMax>0 && near.dist > cordMax + 1e-6));

  return `
    <div class="card">
      <div class="hd selectedEquipmentHeader">
        <div>
          <div class="h1">Selected equipment</div>
          <div class="h2">${escapeHtml(item.name||"Item")}${item.brand?` • ${escapeHtml(item.brand)}`:""}</div>
        </div>
        <div class="row selectedEquipmentHeaderActions" style="justify-content:flex-end;gap:8px;flex-wrap:wrap;">
          <button type="button" class="planRotateBtn" data-action="rotateInst" data-id="${escapeAttr(inst.id)}" data-focus-key="inspector-rotate:${escapeAttr(inst.id)}" aria-keyshortcuts="R">↻ Rotate 90° <kbd>R</kbd></button>
          <button type="button" class="btn danger" data-action="removeInst" data-id="${escapeAttr(inst.id)}">Remove</button>
        </div>
      </div>
      <div class="bd">
        ${state.layoutWorkspace?.status ? `<div class="layoutInspectorStatus ${state.layoutWorkspace.status.kind}" role="status">${escapeHtml(state.layoutWorkspace.status.message)}</div>` : ""}
        <div class="layoutPlacementActions" role="group" aria-label="Equipment placement actions">
          <button type="button" class="btn" data-action="duplicateInst" data-id="${escapeAttr(inst.id)}">Duplicate</button>
          <button type="button" class="btn" data-action="centerInst" data-id="${escapeAttr(inst.id)}">Center</button>
        </div>
        <div class="row" style="justify-content:flex-start; gap:8px; flex-wrap:wrap;">
          <span class="pill">${round1(dims.w)}×${round1(dims.h)} ft</span>
          <span class="pill">Default ds: ${round1(r.clearance)} ft</span>
          ${ceilingWarn ? `<span class="pill" style="border-color:#fecdd3;background:#fff1f2;color:#881337;">Ceiling: need ${round1(reqCeil)}ft (available ${round1(localCeiling)}ft${inZone?" in zone":""})</span>` : (localCeiling>0 ? `<span class="pill">Ceiling OK: ${round1(reqCeil)}ft${inZone?` (zone: ${round1(localCeiling)}ft)`:""}</span>` : ``)}
          ${voltage ? (powerWarn ? `<span class="pill" style="border-color:#fecdd3;background:#fff1f2;color:#881337;">Power: ${escapeHtml(voltage)} ${near.has?`• ${round1(near.dist)}ft from outlet`:"• no matching outlet"}</span>` : `<span class="pill">Power: ${escapeHtml(voltage)} ${near.has?`• ${round1(near.dist)}ft`:""}</span>`) : ``}
          ${powerWarn && isTreadmill(item) ? `<span class="pill" style="border-color:#fecdd3;background:#fff1f2;color:#881337;">Treadmill needs outlet closer</span>` : ``}
        </div>

        <div class="kpiBox" style="margin-top:10px;">
          <div class="label"><span>3D model calibration</span><span>Footprint stays ${round1(dims.w)}×${round1(dims.h)} ft</span></div>
          <div class="two" style="margin-top:8px;">
            ${field("Machine shape", `
              <select data-model-family-item="${escapeAttr(item.id)}" aria-label="3D machine shape for ${escapeAttr(item.name||"equipment")}">
                ${MODEL3D_FAMILIES.map(x=>`<option value="${escapeAttr(x.value)}" ${String(item.model3dFamily||"auto")===x.value?"selected":""}>${escapeHtml(x.value==="auto"?`Auto — ${equipmentModelFamilyLabel(equipmentModelFamily(item))}`:x.label)}</option>`).join("")}
              </select>
            `)}
            ${field("Front direction", `
              <select data-model-facing-item="${escapeAttr(item.id)}" aria-label="3D front direction for ${escapeAttr(item.name||"equipment")}">
                <option value="default" ${String(item.model3dFacing||"default")==="default"?"selected":""}>As placed</option>
                <option value="reverse" ${String(item.model3dFacing||"")==="reverse"?"selected":""}>Reverse 180°</option>
              </select>
            `)}
          </div>
          <div style="margin-top:8px;">
            ${field("Reference detail", `
              <select data-model-profile-item="${escapeAttr(item.id)}" aria-label="3D reference detail for ${escapeAttr(item.name||"equipment")}">
                ${equipmentModelProfilesForItem(item).map(x=>`<option value="${escapeAttr(x.value)}" ${String(item.model3dProfile||"auto")===x.value?"selected":""}>${escapeHtml(x.value==="auto"?`Auto — ${equipmentModelProfileLabel(equipmentModelProfile(item))}`:x.label)}</option>`).join("")}
              </select>
            `)}
          </div>
          <div class="muted" style="font-size:12px;line-height:1.4;">Reference details were tuned against the saved equipment photos; Auto matches by item name. The exact measured footprint stays locked.</div>
          <div class="divider"></div>
          <div class="label"><span>Real 3D model (.glb)</span><span>${itemHasLocal3dModel(item)?"Local model":itemUsesPhotoMatched3d(item)?"Photo-matched reconstruction":"Procedural model"}</span></div>
          <div class="muted" style="font-size:12px;line-height:1.4;">Upload an optional GLB (25 MB max) for this machine. It will be uniformly scaled inside the saved width, length, and height; the plan footprint never changes.</div>
          <div class="row" style="justify-content:flex-start;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px;">
            <label class="btn" style="cursor:pointer;">
              <span data-model-asset-label aria-live="polite">${itemHasLocal3dModel(item)?"Replace .glb":"Upload .glb"}</span>
              <input type="file" accept=".glb,model/gltf-binary" data-model-asset-file-item="${escapeAttr(item.id)}" style="display:none;" />
            </label>
            ${itemHasLocal3dModel(item)?`<button type="button" class="btn danger" data-remove-model-asset-item="${escapeAttr(item.id)}">Remove model</button>`:""}
            ${itemHasLocal3dModel(item)?`<span class="pill">${escapeHtml(item.model3dAssetName||"Local GLB")}${item.model3dAssetSize?` • ${escapeHtml(formatFileSize(item.model3dAssetSize))}`:""}</span>`:""}
          </div>
          ${itemHasLocal3dModel(item)?`
            <div style="margin-top:8px;">
              ${field("GLB orientation", `
                <select data-model-asset-rotation-item="${escapeAttr(item.id)}" aria-label="GLB orientation for ${escapeAttr(item.name||"equipment")}">
                  ${[0,90,180,270].map(angle=>`<option value="${angle}" ${safeNum(item.model3dAssetRotation)===angle?"selected":""}>${angle}°${angle===0?" (as uploaded)":""}</option>`).join("")}
                </select>
              `)}
            </div>
            <div class="muted" style="font-size:11px;line-height:1.4;">Orientation turns only the visual model inside the same footprint. Stored only in this browser; JSON backups do not include the GLB file.</div>
          `:""}
        </div>

        <div class="muted" style="font-size:12px;margin-top:6px;line-height:1.45;">
          <span style="font-weight:700;">Corner</span> ${escapeHtml(formatFtIn(instXTotalFt(inst)))} × ${escapeHtml(formatFtIn(instYTotalFt(inst)))}
          <span class="muted"> (${round1(instXTotalFt(inst))} ft, ${round1(instYTotalFt(inst))} ft)</span>
        </div>

        <div class="two" style="margin-top:10px;">
          ${layoutFtInRow(layoutAxisLabel("X"), inst.id, inst.xFt, inst.xIn ?? 0, "inst_x_ft", "inst_x_in", "inst_x")}
          ${layoutFtInRow(layoutAxisLabel("Y"), inst.id, inst.yFt, inst.yIn ?? 0, "inst_y_ft", "inst_y_in", "inst_y")}
        </div>

        ${safeHttpUrl(item.productLink) ? `<div style="margin-top:10px;">${productLinkAnchorHtml(item.productLink, productLinkLabel(item.productLink) + " ↗")}</div>` : ""}

        <div class="divider"></div>

        ${field("Deadspace override", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input type="number" min="0" step="1" inputmode="numeric" style="flex:1; min-width:72px;" data-action="inst_ds_ft" data-id="${inst.id}" value="${instHasDeadspaceOverride(inst) ? escapeAttr(inst.deadspaceFt ?? 0) : ""}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span>${layoutInchSuffix(inst.id, instHasDeadspaceOverride(inst) ? safeNum(inst.deadspaceIn) : 0, "inst_ds_in", "inst_ds")}</div>`, "(blank = room default)")}

        <div style="margin-top:10px;">
          <div class="label"><span>Deadspace sides</span><span class="muted">current: ${cfg.sides.length?cfg.sides.join(", "):"none"}</span></div>
          <div class="checks">
            ${DEADSPACE_SIDES.map(x=>{
              const on = sides.includes(x.value);
              return `<button class="checkBtn ${on?"on":""}" data-action="toggleInstSide" data-id="${inst.id}" data-side="${x.value}">${x.label}</button>`;
            }).join("")}
            <button class="btn" data-action="instSidesAll" data-id="${inst.id}">All</button>
            <button class="btn" data-action="instSidesNone" data-id="${inst.id}">None</button>
            <button class="btn" data-action="instReset" data-id="${inst.id}">Reset</button>
          </div>
        </div>
        <button type="button" class="btn primary layoutEditDetailsBtn" data-action="openEquipmentDetails" data-id="${escapeAttr(item.id)}">Edit equipment details</button>
      </div>
    </div>
  `;
}

function selectedAreaPanel(area){
  const m = kindMeta(area.kind);

  const isDoor = area.kind==="door";
  const isGarage = area.kind==="garagedoor";
  const dc = isDoor ? doorClearanceRect(area) : null;
  const garageResolution=isGarage ? garageDoorResolution(area,room()) : null;
  const garageWarning=isGarage&&!garageResolution.ok ? garageResolution.message : "";
  const areaSqFt=round1(areaWidthTotalFt(area)*areaHeightTotalFt(area));
  const subtracts=areaSubtractsSpace(area);
  const blocks=areaBlocksPlacement(area);
  const areaId=escapeAttr(area.id);
  const policySummary=`This ${areaSqFt}-square-foot editor footprint ${subtracts?"is subtracted from usable space":"is not subtracted from usable space"} and ${blocks?"blocks equipment":"does not block equipment"}.`;

  const stepNote = layoutEditorUnit()==="in"
    ? "Nudge arrows: 12 in (1 ft) per click, or 60 in (5 ft) with Shift."
    : "Hold Shift for 5 ft steps.";
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Selected area</div>
          <div class="h2">${escapeHtml(m.label)}</div>
        </div>
        <button class="btn danger" data-action="removeArea" data-id="${areaId}">Remove</button>
      </div>
      <div class="bd">
        <div class="muted" style="font-size:12px;margin-bottom:8px;line-height:1.45;">
          <span style="font-weight:700;">Origin</span> ${escapeHtml(formatFtIn(areaXTotalFt(area)))} × ${escapeHtml(formatFtIn(areaYTotalFt(area)))}
          <span style="font-weight:700;margin-left:8px;">Size</span> ${escapeHtml(formatFtIn(areaWidthTotalFt(area)))} × ${escapeHtml(formatFtIn(areaHeightTotalFt(area)))}
        </div>
        <div class="two">
          ${field("Type", `
            <select data-action="area_kind" data-id="${areaId}">
              ${AREA_KINDS.map(k=>`<option value="${k.value}" ${area.kind===k.value?"selected":""}>${escapeHtml(k.label)}</option>`).join("")}
            </select>
          `)}
          ${field("Label", `<input data-action="area_label" data-id="${areaId}" value="${escapeAttr(area.label||"")}" />`)}
          ${layoutFtInRow(layoutAxisLabel("X"), area.id, area.xFt, area.xIn ?? 0, "area_x_ft", "area_x_in", "area_x")}
          ${layoutFtInRow(layoutAxisLabel("Y"), area.id, area.yFt, area.yIn ?? 0, "area_y_ft", "area_y_in", "area_y")}
          ${layoutFtInRow(layoutAxisLabel("Width"), area.id, area.widthFt, area.widthIn ?? 0, "area_w_ft", "area_w_in", "area_w", "Total min 6 in")}
          ${layoutFtInRow(layoutAxisLabel("Height"), area.id, area.heightFt, area.heightIn ?? 0, "area_h_ft", "area_h_in", "area_h", "Total min 6 in")}
        </div>

        ${isGarage&&area.blocksPlacement===false&&area.subtractsSpace===false ? `
          <div class="kpiBox garageDoorPolicyNote" style="margin-top:10px;">
            Architectural door only. It does not reserve operating clearance, so the existing machines against this wall remain valid. Add a No-go area if you want to keep the door path clear.
          </div>
        ` : ""}

        ${garageWarning ? `<div class="garageDoorWarning" role="alert">${escapeHtml(garageWarning)}</div>` : ""}

        ${isDoor ? `
          <div class="divider"></div>
          <div class="kpiBox">
            <div style="font-weight:900;">Door swing / clearance arc</div>
            <div class="muted" style="font-size:12px;margin-top:6px;">Machines cannot overlap the swing zone.</div>

            <div class="two" style="margin-top:10px;">
              ${field("Enable swing zone", `
                <select data-action="area_doorEnabled" data-id="${areaId}">
                  <option value="true" ${area.doorClearEnabled!==false?"selected":""}>On</option>
                  <option value="false" ${area.doorClearEnabled===false?"selected":""}>Off</option>
                </select>
              `)}
              ${field("Orientation", `
                <select data-action="area_doorOrientation" data-id="${areaId}">
                  <option value="auto" ${(area.doorOrientation||"auto")==="auto"?"selected":""}>Auto</option>
                  <option value="horizontal" ${(area.doorOrientation||"auto")==="horizontal"?"selected":""}>Horizontal</option>
                  <option value="vertical" ${(area.doorOrientation||"auto")==="vertical"?"selected":""}>Vertical</option>
                </select>
              `)}
              ${field("Swing direction", `
                <select data-action="area_doorSwing" data-id="${areaId}">
                  <option value="down" ${area.doorSwing==="down"?"selected":""}>Down</option>
                  <option value="up" ${area.doorSwing==="up"?"selected":""}>Up</option>
                  <option value="right" ${area.doorSwing==="right"?"selected":""}>Right</option>
                  <option value="left" ${area.doorSwing==="left"?"selected":""}>Left</option>
                </select>
              `)}
              ${field("Hinge", `
                <select data-action="area_doorHinge" data-id="${areaId}">
                  <option value="start" ${(area.doorHinge||"start")==="start"?"selected":""}>Start</option>
                  <option value="end" ${(area.doorHinge||"start")==="end"?"selected":""}>End</option>
                </select>
              `)}
              ${field("Swing radius", (()=>{ const drAuto = (area.doorRadiusFt==null || area.doorRadiusFt==="") && safeNum(area.doorRadiusIn)<=0; const inV = drAuto ? 0 : safeNum(area.doorRadiusIn); return `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input type="number" min="0" step="1" inputmode="numeric" style="flex:1; min-width:72px;" data-action="area_doorRadius_ft" data-id="${areaId}" value="${drAuto ? "" : escapeAttr(area.doorRadiusFt ?? 0)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span>${layoutInchSuffix(area.id, inV, "area_doorRadius_in", "area_door_r")}</div>`; })(), "(blank = auto)")}
            </div>

            ${dc ? `<div class="muted" style="font-size:12px;margin-top:10px;">Swing zone: ~${round1(dc.w)}×${round1(dc.h)} ft</div>` : ``}
          </div>
        ` : ``}

        <div class="divider"></div>

        <div class="kpiBox">
          <div style="font-weight:900;">Extend / shrink</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">${escapeHtml(stepNote)}</div>

          <div class="row" style="justify-content:flex-start; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <span class="pill">Extend</span>
            <button class="btn" data-action="area_extend" data-id="${areaId}" data-dir="left">←</button>
            <button class="btn" data-action="area_extend" data-id="${areaId}" data-dir="right">→</button>
            <button class="btn" data-action="area_extend" data-id="${areaId}" data-dir="up">↑</button>
            <button class="btn" data-action="area_extend" data-id="${areaId}" data-dir="down">↓</button>
          </div>

          <div class="row" style="justify-content:flex-start; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <span class="pill">Shrink</span>
            <button class="btn" data-action="area_shrink" data-id="${areaId}" data-dir="left">←</button>
            <button class="btn" data-action="area_shrink" data-id="${areaId}" data-dir="right">→</button>
            <button class="btn" data-action="area_shrink" data-id="${areaId}" data-dir="up">↑</button>
            <button class="btn" data-action="area_shrink" data-id="${areaId}" data-dir="down">↓</button>
          </div>
        </div>

        <div class="muted" style="font-size:12px;margin-top:10px;">
          Area: <b>${areaSqFt}</b> sq ft. ${escapeHtml(policySummary)}
        </div>
      </div>
    </div>
  `;
}

function selectedWallExtPanel(we){
  const extArea = wallExtLengthTotalFt(we) * wallExtDepthTotalFt(we);
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Selected wall extension</div>
          <div class="h2">${escapeHtml(we.label||"Extension")} (${escapeHtml(we.wall)} wall)</div>
        </div>
        <button class="btn danger" data-action="removeWallExt" data-id="${we.id}">Remove</button>
      </div>
      <div class="bd">
        <div class="muted" style="font-size:12px;margin-bottom:8px;line-height:1.45;">
          <span style="font-weight:700;">Along wall</span> ${escapeHtml(formatFtIn(wallExtStartTotalFt(we)))}
          <span style="font-weight:700;margin-left:8px;">Run</span> ${escapeHtml(formatFtIn(wallExtLengthTotalFt(we)))}
          <span style="font-weight:700;margin-left:8px;">Depth</span> ${escapeHtml(formatFtIn(wallExtDepthTotalFt(we)))}
        </div>
        <div class="two">
          ${field("Label", `<input data-action="we_label" data-id="${we.id}" value="${escapeAttr(we.label||"")}" />`)}
          ${field("Wall side", `
            <select data-action="we_wall" data-id="${we.id}">
              ${WALL_SIDES.map(w=>`<option value="${w.value}" ${we.wall===w.value?"selected":""}>${escapeHtml(w.label)}</option>`).join("")}
            </select>
          `)}
          ${layoutFtInRow("Along wall", we.id, we.startFt, we.startIn ?? 0, "we_start_ft", "we_start_in", "we_start", "Start position along the wall")}
          ${layoutFtInRow("Run length", we.id, we.lengthFt, we.lengthIn ?? 0, "we_length_ft", "we_length_in", "we_length", "How far the extension runs along the wall (total min 6 in)")}
          ${layoutFtInRow("Depth", we.id, we.depthFt, we.depthIn ?? 0, "we_depth_ft", "we_depth_in", "we_depth", "How far the extension sticks out (total min 6 in)")}
        </div>

        <div class="divider"></div>

        <div class="kpiBox">
          <div style="font-weight:900;">Quick adjust</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">${layoutEditorUnit()==="in" ? "Each click: 12 in (1 ft); Shift: 60 in (5 ft)." : "Hold Shift for 5 ft steps."}</div>

          <div class="row" style="justify-content:flex-start; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <span class="pill">Grow</span>
            <button class="btn" data-action="we_grow" data-id="${we.id}" data-prop="length">+ Length</button>
            <button class="btn" data-action="we_grow" data-id="${we.id}" data-prop="depth">+ Depth</button>
          </div>
          <div class="row" style="justify-content:flex-start; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <span class="pill">Shrink</span>
            <button class="btn" data-action="we_shrink" data-id="${we.id}" data-prop="length">- Length</button>
            <button class="btn" data-action="we_shrink" data-id="${we.id}" data-prop="depth">- Depth</button>
          </div>
        </div>

        <div class="ok" style="margin-top:10px;">
          Extension adds <b>${round1(extArea)}</b> sq ft to the room
        </div>
      </div>
    </div>
  `;
}

function selectedCeilingZonePanel(cz){
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Ceiling zone</div>
          <div class="h2">${escapeHtml(cz.label||"Low ceiling")} — ${round1(ceilingZoneClearanceTotalFt(cz))} ft</div>
        </div>
        <button class="btn danger" data-action="removeCeilingZone" data-id="${cz.id}">Remove</button>
      </div>
      <div class="bd">
        <div class="muted" style="font-size:12px;margin-bottom:8px;line-height:1.45;">
          <span style="font-weight:700;">Clearance</span> ${escapeHtml(formatFtIn(ceilingZoneClearanceTotalFt(cz)))}
          <span style="font-weight:700;margin-left:8px;">Box</span> ${escapeHtml(formatFtIn(ceilingZoneXTotalFt(cz)))}×${escapeHtml(formatFtIn(ceilingZoneYTotalFt(cz)))} · ${escapeHtml(formatFtIn(ceilingZoneWidthTotalFt(cz)))}×${escapeHtml(formatFtIn(ceilingZoneDepthTotalFt(cz)))}
        </div>
        <div class="two">
          ${field("Label", `<input data-action="cz_label" data-id="${cz.id}" value="${escapeAttr(cz.label||"")}" />`)}
          ${layoutFtInRow("Zone ceiling clearance", cz.id, cz.ceilingHeightFt, cz.ceilingHeightIn ?? 0, "cz_ceiling_ft", "cz_ceiling_in", "cz_ceiling", "Equipment taller than this will warn in this zone")}
          ${layoutFtInRow("X position", cz.id, cz.xFt, cz.xIn ?? 0, "cz_x_ft", "cz_x_in", "cz_x")}
          ${layoutFtInRow("Y position", cz.id, cz.yFt, cz.yIn ?? 0, "cz_y_ft", "cz_y_in", "cz_y")}
          ${layoutFtInRow("Width", cz.id, cz.widthFt, cz.widthIn ?? 0, "cz_w_ft", "cz_w_in", "cz_w", "Total min 6 in")}
          ${layoutFtInRow("Depth", cz.id, cz.heightFt, cz.heightIn ?? 0, "cz_h_ft", "cz_h_in", "cz_h", "Total min 6 in")}
        </div>
        <div class="muted" style="font-size:12px;margin-top:10px;">
          Use for garage door rails, beams, HVAC, or anything that lowers available clearance.
          Equipment placed under this zone checks against <b>${round1(ceilingZoneClearanceTotalFt(cz))}</b> ft instead of the room default (<b>${round1(settingsCeilingHeightTotalFt())}</b> ft).
        </div>
      </div>
    </div>
  `;
}

function selectedFloorZonePanel(fz){
  const defaultCeiling = settingsCeilingHeightTotalFt();
  const elevFt = Math.max(0, safeNum(fz.elevationIn)) / 12;
  const effectiveCeil = Math.max(0, defaultCeiling - elevFt);
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Elevated floor zone</div>
          <div class="h2">${escapeHtml(fz.label||"Elevated floor")} — +${round1(safeNum(fz.elevationIn))} in</div>
        </div>
        <button class="btn danger" data-action="removeFloorZone" data-id="${fz.id}">Remove</button>
      </div>
      <div class="bd">
        <div class="muted" style="font-size:12px;margin-bottom:8px;line-height:1.45;">
          <span style="font-weight:700;">Origin</span> ${escapeHtml(formatFtIn(floorZoneXTotalFt(fz)))} × ${escapeHtml(formatFtIn(floorZoneYTotalFt(fz)))}
          <span style="font-weight:700;margin-left:8px;">Size</span> ${escapeHtml(formatFtIn(floorZoneWidthTotalFt(fz)))} × ${escapeHtml(formatFtIn(floorZoneDepthTotalFt(fz)))}
          <span class="muted"> · +${round1(safeNum(fz.elevationIn))} in up</span>
        </div>
        <div class="two">
          ${field("Label", `<input data-action="fz_label" data-id="${fz.id}" value="${escapeAttr(fz.label||"")}" />`)}
          ${field("Elevation (inches)", `<input type="number" step="1" min="0" data-action="fz_elev" data-id="${fz.id}" value="${escapeAttr(round1(safeNum(fz.elevationIn)))}" />`, "How many inches the floor is raised")}
          ${layoutFtInRow(layoutAxisLabel("X"), fz.id, fz.xFt, fz.xIn ?? 0, "fz_x_ft", "fz_x_in", "fz_x")}
          ${layoutFtInRow(layoutAxisLabel("Y"), fz.id, fz.yFt, fz.yIn ?? 0, "fz_y_ft", "fz_y_in", "fz_y")}
          ${layoutFtInRow(layoutAxisLabel("Width"), fz.id, fz.widthFt, fz.widthIn ?? 0, "fz_w_ft", "fz_w_in", "fz_w", "Total min 6 in")}
          ${layoutFtInRow(layoutAxisLabel("Depth"), fz.id, fz.heightFt, fz.heightIn ?? 0, "fz_d_ft", "fz_d_in", "fz_d", "Total min 6 in")}
        </div>
        <div class="muted" style="font-size:12px;margin-top:10px;">
          A raised section of floor (step, platform, concrete slab). Reduces effective ceiling to <b>${round1(effectiveCeil)}</b> ft here.
        </div>
      </div>
    </div>
  `;
}

function addInstance(itemId){
  const item = getItemById(itemId);
  if(!item) return;
  
  // Find a valid starting position (default 0.5,0.5 might be outside room if there are left/top extensions)
  const r = room();
  let startX = 0.5, startY = 0.5;
  
  // If default position is outside room bounds, use the first room rect's position + small offset
  const testRect = {x: startX, y: startY, w: 0.1, h: 0.1};
  if(!rectInsideRoom(testRect) && r.rects.length > 0){
    // Use base room rect (id === "base") or first rect
    const baseRect = r.rects.find(rect => rect.id === "base") || r.rects[0];
    startX = Math.max(r.bounds.minX, baseRect.x + 0.5);
    startY = Math.max(r.bounds.minY, baseRect.y + 0.5);
  }
  
  state.layout.instances = [
    ...(state.layout.instances||[]),
    { id: uid("inst"), itemId, xFt: startX, xIn: 0, yFt: startY, yIn: 0, rotated:false, deadspaceFt:null, deadspaceIn: 0, deadspaceSides:null, __invalid:false }
  ];
  clearAllSelections();
  state.layout.selectedInstId = state.layout.instances[state.layout.instances.length-1].id;
}

function addArea(kind){
  const presets = {
    walkway:{w:4,h:10,label:"Walkway"},
    door:{w:3,h:1,label:"Door"},
    garagedoor:{w:8,h:1,label:"Garage door"},
    nogospace:{w:4,h:4,label:"No-go"},
    cutout:{w:4,h:4,label:"Cutout"},
  };
  const p = presets[kind] || presets.walkway;

  const base = { id: uid("area"), kind, label:p.label, xFt: 0.5, xIn: 0, yFt: 0.5, yIn: 0, widthFt:p.w, widthIn: 0, heightFt:p.h, heightIn: 0 };

  if(kind==="door"){
    base.doorOrientation = "auto";
    base.doorSwing = "down";
    base.doorHinge = "start";
    base.doorRadiusFt = null;
    base.doorRadiusIn = 0;
    base.doorClearEnabled = true;
  }

  state.layout.areas = [ ...(state.layout.areas||[]), base ];

  clearAllSelections();
  state.layout.selectedAreaId = base.id;

  render();
}

function selectedFlooringPanel(fp){
  const type = getFlooringType(fp.typeId);
  const rect = flooringPieceRect(fp);
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Selected flooring</div>
          <div class="h2">${escapeHtml(type.name)} — ${round1(rect.w)}×${round1(rect.h)} ft</div>
        </div>
        <button class="btn danger" data-action="removeFlooring" data-id="${fp.id}">Remove</button>
      </div>
      <div class="bd">
        <div class="muted" style="font-size:12px;margin-bottom:8px;line-height:1.45;">
          <span style="font-weight:700;">Corner</span> ${escapeHtml(formatFtIn(flooringXTotalFt(fp)))} × ${escapeHtml(formatFtIn(flooringYTotalFt(fp)))}
          <span style="font-weight:700;margin-left:8px;">Piece</span> ${escapeHtml(formatFtIn(rect.w))} × ${escapeHtml(formatFtIn(rect.h))}
        </div>
        <div class="two">
          ${field("Type", `
            <select data-action="fp_type" data-id="${fp.id}">
              ${FLOORING_TYPES.map(ft=>`<option value="${ft.id}" ${fp.typeId===ft.id?"selected":""}>${escapeHtml(ft.name)} (${ft.widthFt}×${ft.lengthFt} ft)</option>`).join("")}
            </select>
          `)}
          ${field("Label (optional)", `<input data-action="fp_label" data-id="${fp.id}" value="${escapeAttr(fp.label||"")}" placeholder="${escapeAttr(type.name)}" />`)}
          ${field("Price ($)", `<input type="number" min="0" step="1" data-action="fp_price" data-id="${fp.id}" value="${escapeAttr(safeNum(fp.price))}" />`)}
        </div>
        <div class="two" style="margin-top:10px;">
          ${layoutFtInRow(layoutAxisLabel("X"), fp.id, fp.xFt, fp.xIn ?? 0, "fp_x_ft", "fp_x_in", "fp_x")}
          ${layoutFtInRow(layoutAxisLabel("Y"), fp.id, fp.yFt, fp.yIn ?? 0, "fp_y_ft", "fp_y_in", "fp_y")}
        </div>
        <div class="row" style="justify-content:flex-start; margin-top:10px;">
          <button class="btn" data-action="rotateFlooring" data-id="${fp.id}">Rotate 90°</button>
          <span class="pill">${fp.rotated ? "Rotated" : "Normal orientation"}</span>
        </div>
        <div class="ok" style="margin-top:10px;">
          Area: <b>${round1(type.widthFt * type.lengthFt)}</b> sq ft • Price: <b>${money(safeNum(fp.price), state.settings.currency||"USD")}</b>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px;">Changing the price here updates the default for the next ${escapeHtml(type.name)} pieces you add.</div>
      </div>
    </div>
  `;
}

function selectedWallFeaturePanel(feature, validation={valid:true,reasons:[]}){
  const name=wallFeatureDisplayName(feature.kind);
  const warning=!validation.valid ? `<div class="wallFeatureWarning" role="status">${escapeHtml(validation.reasons.map(reason=>reason.message).join(" ") || "This placement needs attention, but remains editable.")}</div>` : "";
  return `
    <div class="card wallFeatureInspector">
      <div class="hd">
        <div>
          <div class="h1">Selected wall feature</div>
          <div class="h2">${escapeHtml(name)} · ${escapeHtml(feature.wall)} wall</div>
        </div>
        <button type="button" class="btn danger" data-action="remove_wall_feature" data-id="${escapeAttr(feature.id)}">Remove</button>
      </div>
      <div class="bd">
        ${warning}
        <div class="two">
          ${field("Type", `<select data-action="wf_kind" data-id="${escapeAttr(feature.id)}">${["mirror","slat","led"].map(kind=>`<option value="${kind}" ${feature.kind===kind?"selected":""}>${wallFeatureDisplayName(kind)}</option>`).join("")}</select>`)}
          ${field("Label", `<input data-action="wf_label" data-id="${escapeAttr(feature.id)}" value="${escapeAttr(feature.label||name)}" />`)}
          ${field("Wall", `<select data-action="wf_wall" data-id="${escapeAttr(feature.id)}">${WALL_SIDES.map(wall=>`<option value="${wall.value}" ${feature.wall===wall.value?"selected":""}>${escapeHtml(wall.label)}</option>`).join("")}</select>`)}
          ${field(feature.kind==="led" ? "LED Color" : "Color", `<input type="color" data-action="wf_color" data-id="${escapeAttr(feature.id)}" value="${escapeAttr(feature.color||"#cbd5e1")}" />`)}
          ${layoutFtInRow("Along wall", feature.id, feature.startFt, feature.startIn??0, "wf_start_ft", "wf_start_in", "wf_start", "Top/bottom measure from the left; left/right measure from the top.")}
          ${layoutFtInRow("Mounting height", feature.id, feature.bottomFt, feature.bottomIn??0, "wf_bottom_ft", "wf_bottom_in", "wf_bottom", "Height above the finished floor")}
          ${layoutFtInRow("Width", feature.id, feature.widthFt, feature.widthIn??0, "wf_width_ft", "wf_width_in", "wf_width", "Along-wall length")}
          ${layoutFtInRow("Height", feature.id, feature.heightFt, feature.heightIn??0, "wf_height_ft", "wf_height_in", "wf_height", "Vertical size")}
          ${feature.kind==="led" ? field("Brightness", `<div class="row" style="gap:8px;"><input aria-label="Brightness" type="range" min="0" max="100" step="1" data-action="wf_brightness" data-id="${escapeAttr(feature.id)}" value="${safeNum(feature.brightnessPct)}" /><input aria-label="Brightness percent" type="number" min="0" max="100" step="1" data-action="wf_brightness" data-id="${escapeAttr(feature.id)}" value="${safeNum(feature.brightnessPct)}" /></div>`) : ""}
        </div>
        <div class="divider"></div>
        <div class="kpiBox">
          <div style="font-weight:900;">Nudge along wall</div>
          <div class="row wallFeatureNudges">
            <button type="button" class="btn" data-action="wf_nudge" data-id="${escapeAttr(feature.id)}" data-inches="-6">−6 in</button>
            <button type="button" class="btn" data-action="wf_nudge" data-id="${escapeAttr(feature.id)}" data-inches="-1">−1 in</button>
            <button type="button" class="btn" data-action="wf_nudge" data-id="${escapeAttr(feature.id)}" data-inches="1">+1 in</button>
            <button type="button" class="btn" data-action="wf_nudge" data-id="${escapeAttr(feature.id)}" data-inches="6">+6 in</button>
          </div>
        </div>
        <div class="muted" style="font-size:12px;margin-top:10px;">Top/bottom measure from the left; left/right measure from the top.</div>
      </div>
    </div>
  `;
}

function addWallFeature(kind){
  if(!GymWallFeatures.KINDS.includes(kind)) return;
  const id=uid("wf");
  const feature=GymWallFeatures.normalize({id,kind}, wallFeatureRoomData(state.layout, state.settings), ()=>id, state.layout);
  state.layout.wallFeatures=[...(state.layout.wallFeatures||[]), feature];
  clearAllSelections();
  state.layout.selectedWallFeatureId=id;
  state.tab="layout";
  render();
}

function patchWallFeature(id, patch){
  state.layout.wallFeatures=(state.layout.wallFeatures||[]).map(feature=>{
    if(feature.id!==id) return feature;
    return GymWallFeatures.normalize({...feature,...patch}, wallFeatureRoomData(state.layout, state.settings), ()=>id, state.layout);
  });
  render();
}

function removeWallFeature(id){
  state.layout.wallFeatures=(state.layout.wallFeatures||[]).filter(feature=>feature.id!==id);
  if(state.layout.selectedWallFeatureId===id) state.layout.selectedWallFeatureId=null;
  render();
}

function addFlooring(typeId){
  const type = getFlooringType(typeId);
  const savedPrice = safeNum((state.settings.flooringPrices||{})[typeId] ?? type.defaultPrice);
  const fp = {
    id: uid("floor"),
    typeId,
    label: "",
    xFt: snap(0.5),
    xIn: 0,
    yFt: snap(0.5),
    yIn: 0,
    rotated: false,
    price: savedPrice,
  };
  state.layout.flooringPieces = [...(state.layout.flooringPieces||[]), fp];
  clearAllSelections();
  state.layout.selectedFlooringId = fp.id;
  render();
}
