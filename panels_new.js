// This file contains the new, full itemForm function to be integrated

function itemForm(currency){
  const d = state.draft;
  const fp = footprint(d);
  const tc = totalCost(d);
  const selectedTags = new Set(Array.isArray(d.equipmentTags) ? d.equipmentTags : []);
  const selectedTypes = new Set(Array.isArray(d.equipmentTypes) ? d.equipmentTypes : []);

  const catOptions = (state.categories||DEFAULT_CATEGORIES).map(c=>`<option value="${escapeAttr(c)}"${d.category===c?" selected":""}>${escapeHtml(c)}</option>`).join("");
  const brandFilteredList = d.brand ? BRAND_LIST.filter(b=> b.toLowerCase().includes(String(d.brand).toLowerCase())) : BRAND_LIST.slice(0, 10);

  return `
    <div class="two">
      ${field("Item name", `<input id="f_name" value="${escapeAttr(d.name||"")}" placeholder="e.g., Functional trainer" />`)}
      ${field("Brand", `
        <div style="position:relative;">
          <input id="f_brand" value="${escapeAttr(d.brand||"")}" placeholder="e.g., Rogue" autocomplete="off" />
          <div id="brandList" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-top:none;max-height:200px;overflow-y:auto;display:${d.brand && brandFilteredList.length ? 'block' : 'none'};z-index:10;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            ${brandFilteredList.map(b=>`<div class="autocompleteItem" data-brand="${escapeAttr(b)}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;">${escapeHtml(b)}</div>`).join("")}
          </div>
        </div>
      `)}
      ${field("Category", `
        <select id="f_category">${catOptions}</select>
        <div class="row" style="justify-content:flex-start;margin-top:8px;">
          <input id="f_newCategory" placeholder="Add custom category" style="flex:1; min-width:180px;" />
          <button class="btn" id="addCategoryBtn">Add</button>
        </div>
      `)}
      ${field("Status", `<select id="f_status">${STATUSES.map(s=>`<option value="${escapeAttr(s)}"${d.status===s?" selected":""}>${escapeHtml(s)}</option>`).join("")}</select>`)}
      ${field("Priority", `<select id="f_priority">${PRIORITIES.map(p=>`<option value="${escapeAttr(p)}"${d.priority===p?" selected":""}>${escapeHtml(p)}</option>`).join("")}</select>`)}
      ${field("Quantity", `<input id="f_qty" type="number" min="0" value="${escapeAttr(d.qty)}" />`)}
    </div>

    <div class="divider"></div>

    <!-- Rack Features -->
    <div style="margin-top:10px;">
      <label class="checkLabel"><input type="checkbox" id="f_isRack" ${d.isRack ? "checked" : ""} /> This is a power rack / squat rack</label>
    </div>
    ${d.isRack ? `
      <div class="two" style="margin-top:10px;">
        ${field("Posts", `<select id="f_rackPosts"><option value="4-post" ${d.rackPosts==="4-post"?"selected":""}>4-post</option><option value="2-post" ${d.rackPosts==="2-post"?"selected":""}>2-post</option><option value="half-rack" ${d.rackPosts==="half-rack"?"selected":""}>Half-rack</option><option value="3-post" ${d.rackPosts==="3-post"?"selected":""}>3-post</option></select>`)}
        ${field("Height (in)", `<input id="f_rackHeight" type="number" min="0" value="${escapeAttr(d.rackHeight)}" />`)}
        ${field("Upright Size", `<input id="f_rackUprightSize" value="${escapeAttr(d.rackUprightSize||"")}" placeholder="e.g., 3×3" />`)}
        ${field("Hole Diameter", `<input id="f_rackHoleDiameter" value="${escapeAttr(d.rackHoleDiameter||"")}" placeholder="e.g., 1" or ⅝"" />`)}
      </div>
      <div class="two" style="margin-top:10px;">
        ${field("Crossmember Depth (in)", `<input id="f_rackCrossmemberDepth" type="number" min="0" value="${escapeAttr(d.rackCrossmemberDepth)}" />`)}
        ${field("Outside Width (in)", `<input id="f_rackOutsideWidth" type="number" min="0" value="${escapeAttr(d.rackOutsideWidth)}" />`)}
        ${field("Total Length (in)", `<input id="f_rackTotalLength" type="number" min="0" value="${escapeAttr(d.rackTotalLength)}" />`)}
      </div>
    ` : ""}

    <div style="margin-top:10px;">
      <label class="checkLabel"><input type="checkbox" id="f_isRackAttachment" ${d.isRackAttachment ? "checked" : ""} /> This is a rack attachment</label>
    </div>
    ${d.isRackAttachment ? `
      <div style="margin-top:10px;">
        ${field("Attach to Rack", `<select id="f_attachToRackId"><option value="">Select a rack...</option>${(state.items||[]).filter(it=> it.isRack).map(it=>`<option value="${escapeAttr(it.id)}" ${d.attachToRackId===it.id?"selected":""}>${escapeHtml(it.name)}</option>`).join("")}</select>`, "Choose which rack this attaches to")}
      </div>
    ` : ""}

    <div style="margin-top:10px;">
      <label class="checkLabel"><input type="checkbox" id="f_storesEquipment" ${d.storesEquipment ? "checked" : ""} /> This stores equipment</label>
    </div>
    ${d.storesEquipment ? `
      <div class="two" style="margin-top:10px;">
        ${field("Storage Length (in)", `<input id="f_storageLength" type="number" min="0" value="${escapeAttr(d.storageLength)}" />`)}
        ${field("Storage Width (in)", `<input id="f_storageWidth" type="number" min="0" value="${escapeAttr(d.storageWidth)}" /)`)}
        ${field("Storage Height (in)", `<input id="f_storageHeight" type="number" min="0" value="${escapeAttr(d.storageHeight)}" />`)}
      </div>
    ` : ""}

    <div class="divider"></div>

    <div class="two">
      ${field("Unit", `<select id="f_unit"><option value="in"${d.unit==="in"?" selected":""}>in</option><option value="cm"${d.unit==="cm"?" selected":""}>cm</option><option value="ft"${d.unit==="ft"?" selected":""}>ft</option></select>`)}
      ${field("Length", `<input id="f_length" type="number" min="0" value="${escapeAttr(d.length)}" />`)}
      ${field("Width", `<input id="f_width" type="number" min="0" value="${escapeAttr(d.width)}" />`)}
      ${field("Height (optional)", `<input id="f_height" type="number" min="0" value="${escapeAttr(d.height)}" />`)}
    </div>

    <div class="two">
      ${field("Ceiling required (ft)", `<input id="f_requiredCeilingFt" type="number" min="0" step="0.1" value="${escapeAttr(d.requiredCeilingFt)}" placeholder="(blank = use Height)" />`, "Warns if ceiling/zones are too low")}
      ${field("Power voltage", `<select id="f_powerVoltage"><option value="" ${!d.powerVoltage ? "selected":""}>None</option><option value="120V" ${d.powerVoltage==="120V" ? "selected":""}>120V</option><option value="240V" ${d.powerVoltage==="240V" ? "selected":""}>240V</option></select>`, "Outlet-distance warnings in Layout")}
      ${field("Power amps (optional)", `<input id="f_powerAmps" type="number" min="0" step="0.1" value="${escapeAttr(d.powerAmps)}" />`)}
    </div>

    <div style="margin-top:10px;">
      ${field("Outlet location notes", `<textarea id="f_outletNotes" rows="2" placeholder="e.g., Needs outlet on back wall...">${escapeHtml(d.outletNotes||"")}</textarea>`)}
    </div>

    <div class="divider"></div>

    <div class="two">
      ${field("Price", `<input id="f_price" type="number" min="0" value="${escapeAttr(d.price)}" />`)}
      ${field("Shipping/Fees", `<input id="f_fees" type="number" min="0" value="${escapeAttr(d.fees)}" />`)}
    </div>

    <div style="margin-top:10px;" class="kpiBox">
      <div class="row" style="justify-content:flex-start; gap:10px;">
        <span class="chip" id="previewTotal">Total: ${money(tc, currency)}</span>
        <span class="chip" id="previewFootprint">Footprint: ${escapeHtml(fp.L&&fp.W ? formatDimsDual(fp.L, fp.W) : "—")}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div>
      <div class="field">
        <div class="label"><span>Product link</span></div>
        <div style="display:flex; gap:8px;">
          <input id="f_productLink" value="${escapeAttr(d.productLink||"")}" placeholder="https://..." style="flex:1;" />
          <button class="btn autoFillBtn" id="autoFillBtn" type="button" ${state.settings.aiProvider==="none" ? "disabled title=\"Set API key in Settings\"" : ""}>Auto-fill</button>
        </div>
      </div>
    </div>

    ${isRackCategory(d.category) ? `
      <div class="divider"></div>
      <div class="kpiBox">
        <div style="font-weight:900;">Rack specifications</div>
        <div class="two" style="margin-top:10px;">
          ${field("Hole pattern", `<select id="f_rackHolePattern"><option value="" ${!d.rackHolePattern ? "selected":""}>Not specified</option>${RACK_HOLE_PATTERNS.map(p=>`<option value="${escapeAttr(p.id)}" ${d.rackHolePattern===p.id?"selected":""}>${escapeHtml(p.label)}</option>`).join("")}</select>`)}
          ${d.rackHolePattern==="custom" ? field("Custom spec", `<input id="f_rackCustomSpec" value="${escapeAttr(d.rackCustomSpec||"")}" placeholder="e.g., 2.5×2.5..." />`) : ""}
        </div>
      </div>
    ` : ""}

    <div class="divider"></div>

    <div style="margin-top:10px;">
      <div class="field">
        <div class="label"><span>Equipment Types</span></div>
        <div class="checks" style="margin-top:8px;">
          ${EQUIPMENT_TYPES.map(type=>`<button class="checkBtn ${selectedTypes.has(type)?"on":""}" type="button" data-action="toggleEquipmentType" data-type="${escapeAttr(type)}" style="margin-bottom:6px;">${escapeHtml(type)}</button>`).join("")}
        </div>
      </div>
    </div>

    <div style="margin-top:10px;">
      <div class="field">
        <div class="label"><span>Muscle groups</span></div>
        <div class="checks" style="margin-top:8px;">
          ${ITEM_BODY_PART_TAGS.map(tag=>`<button class="checkBtn ${selectedTags.has(tag)?"on":""}" data-action="toggleItemTag" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}
        </div>
      </div>
    </div>

    <div style="margin-top:10px;">
      <div class="field">
        <div class="label"><span>Color</span></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          ${["#000000","#6B6B6B","#FFFFFF","#FFC966","#1E90FF","#00D9D9","#228B22","#FF6B35","#FFA500","#7B2FF7","#FF1493"].map(color=>`<button type="button" class="colorBtn" data-action="setColor" data-color="${color}" style="width:30px;height:30px;background:${color};border:${d.color===color?"3px solid #333":"1px solid #999"};border-radius:50%;cursor:pointer;" title="${color}"></button>`).join("")}
        </div>
      </div>
    </div>

    <div style="margin-top:10px;">
      ${field("Notes", `<textarea id="f_notes" rows="3" placeholder="Any notes...">${escapeHtml(d.notes||"")}</textarea>`)}
    </div>

    <div class="row" style="margin-top:12px; justify-content:space-between;">
      <button class="btn primary" id="saveItemBtn" ${!String(d.name||"").trim() ? "disabled":""}>${state.editingId ? "Save" : "Add"}</button>
      <div class="muted" style="font-size:12px;">Auto-fill can also add dimensions from product links.</div>
    </div>
  `;
}
