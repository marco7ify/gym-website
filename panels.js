// Panel rendering functions

function isRackCategory(cat){
  const c = String(cat||"").toLowerCase();
  return c.includes("rack") || c.includes("cage") || c.includes("rig") || c.includes("smith") || c.includes("attachment");
}

function categoryManagerPanel(){
  const categories = state.categories || DEFAULT_CATEGORIES;
  const open = !!state.wishlistCategoriesOpen;
  return `
    <div class="kpiBox" style="margin-bottom:12px;">
      <div class="collapsibleWishlistCatHd" style="display:flex; justify-content:space-between; align-items:center; gap:10px; cursor:pointer; user-select:none;" data-action="toggleWishlistCategories" title="Show or hide category manager">
        <div>
          <div style="font-weight:900;">Manage categories</div>
          <div class="muted" style="font-size:12px;margin-top:2px;">${open ? "Add, rename, or remove wishlist categories" : "Tap to expand"}</div>
        </div>
        <span class="collapseChev" aria-hidden="true" style="font-size:14px;color:#64748b;">${open ? "▲" : "▼"}</span>
      </div>
      ${open ? `
      <div class="muted" style="font-size:12px;margin-top:8px;">Removing a category moves its items to <b>Custom</b>. <b>Custom</b> cannot be deleted.</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:stretch; margin-top:10px;">
        <input type="text" id="wishlistNewCategoryInput" placeholder="New category name" autocomplete="off" style="flex:1; min-width:200px; padding:10px 12px; border:1px solid var(--border); border-radius:12px; font-size:14px;" />
        <button class="btn primary" type="button" data-action="addWishlistCategory">Add category</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:12px;">
        ${categories.map(cat=>`
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid var(--border-light); border-radius:12px; padding:12px 14px; background:#fff; transition:all 0.15s ease;"  onmouseover="this.style.borderColor='var(--border)';this.style.boxShadow='0 2px 6px rgba(0,0,0,0.06)'" onmouseout="this.style.borderColor='var(--border-light)';this.style.boxShadow='none'">
            <div>
              <div style="font-weight:700; font-size:14px;">${escapeHtml(cat)}</div>
              <div class="muted" style="font-size:12px; margin-top:4px;">${state.items.filter(item=>item.category===cat).length} items</div>
            </div>
            <div class="actions" style="display:flex; gap:6px;">
              <button class="btn" type="button" data-action="renameCategory" data-category="${escapeAttr(cat)}" title="Rename this category">Edit</button>
              <button class="btn danger" type="button" data-action="deleteCategory" data-category="${escapeAttr(cat)}" ${cat==="Custom" ? "disabled title=\"Cannot delete Custom category\"" : "title=\"Remove this category (items move to Custom)\""} style="padding:10px 16px;">Delete</button>
            </div>
          </div>
        `).join("")}
      </div>
      ` : ""}
    </div>
  `;
}

function wishlistSortSelectHtml(){
  const cur = state.settings.wishlistSort || "dateAdded";
  return `
    <div class="outlinedSelectWrap">
      <label class="outlinedSelectLabel" for="wishlistSortSelect">Sort by</label>
      <select id="wishlistSortSelect" class="outlinedSelect">
        ${WISHLIST_SORT_OPTIONS.map(o=>`<option value="${escapeAttr(o.value)}"${cur===o.value?" selected":""}>${escapeHtml(o.label)}</option>`).join("")}
      </select>
    </div>
  `;
}

function wishlistGroupSelectHtml(){
  const cur = state.settings.wishlistGroupBy || "category";
  return `
    <div class="outlinedSelectWrap">
      <label class="outlinedSelectLabel" for="wishlistGroupSelect">Group by</label>
      <select id="wishlistGroupSelect" class="outlinedSelect">
        ${WISHLIST_GROUP_OPTIONS.map(o=>`<option value="${escapeAttr(o.value)}"${cur===o.value?" selected":""}>${escapeHtml(o.label)}</option>`).join("")}
      </select>
    </div>
  `;
}

function wishlistControlsHtml(){
  return `
    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:6px;">
      ${wishlistGroupSelectHtml()}
      ${wishlistSortSelectHtml()}
    </div>
  `;
}

function comparePanel(rows, currency){
  const selectedIds = state.compareSelectedIds || [];
  if(!selectedIds.length) return "";

  const selectedItems = selectedIds.map(id => rows.find(r => r.id === id)).filter(Boolean);
  const prompt = state.comparePrompt || DEFAULT_COMPARE_PROMPT;
  const result = state.compareResult;
  const hasAI = state.settings.aiProvider && state.settings.aiProvider !== "none" && state.settings.aiApiKey;

  return `
    <div class="card" style="border-radius:18px; box-shadow:none; margin-bottom:12px; border-color:#6366f1;">
      <div class="hd" style="padding:12px 12px 0 12px;">
        <div>
          <div class="h1">Compare items</div>
          <div class="h2">${selectedItems.length} selected — pick items using the checkboxes in the table</div>
        </div>
        <button class="btn ghost" data-action="clearCompare">Clear all</button>
      </div>
      <div class="bd" style="padding:12px;">
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
          ${selectedItems.map(r => `
            <span style="display:inline-flex; align-items:center; gap:6px; background:#eef2ff; border:1px solid #c7d2fe; color:#3730a3; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:800;">
              ${escapeHtml(r.name)}
              <button style="background:none;border:none;cursor:pointer;color:#6366f1;font-size:15px;line-height:1;padding:0;font-weight:900;" data-action="toggleCompare" data-id="${r.id}" title="Remove">×</button>
            </span>
          `).join("")}
        </div>

        <label class="field" style="margin-bottom:10px;">
          <div class="label"><span>AI comparison prompt (editable)</span></div>
          <textarea id="comparePromptArea" rows="3">${escapeHtml(prompt)}</textarea>
        </label>

        ${hasAI
          ? `<button class="btn primary" id="runCompareBtn" ${selectedItems.length < 2 ? "disabled" : ""} style="width:100%;">
               ${selectedItems.length < 2 ? "Select at least 2 items to compare" : `Compare ${selectedItems.length} items with AI`}
             </button>`
          : `<div class="muted" style="font-size:12px; background:#f8fafc; border:1px solid var(--border); border-radius:12px; padding:10px;">
               Configure your AI provider and API key in <b>Settings</b> to enable comparison.
             </div>`
        }

        ${result ? `
          <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
            <div style="font-weight:800; font-size:13px; margin-bottom:10px;">AI Comparison</div>
            <div class="compareResult">${result}</div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function wishlistColumnToggles(){
  const labels = {
    status: "Status",
    priority: "Priority",
    dimensions: "Dims",
    power: "Power",
    ceiling: "Ceiling",
    total: "Total",
    maxFit: "Max fit",
  };
  const visible = new Set(wishlistVisibleColumns());
  return `
    <div class="kpiBox" style="margin-bottom:12px;">
      <div style="font-weight:900;">Show / hide wishlist properties</div>
      <div class="muted" style="font-size:12px;margin-top:6px;">Toggle table columns to keep the Wishlist simpler.</div>
      <div class="checks" style="margin-top:10px;">
        ${DEFAULT_WISHLIST_COLUMNS.map(col=>`
          <button class="checkBtn ${visible.has(col)?"on":""}" data-action="toggleWishlistColumn" data-column="${col}">${labels[col] || col}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function wishlistPanel(groups, currency){
  return `
    <div class="layout">
      <div class="card">
        <div class="hd">
          <div>
            <div class="h1">${state.editingId ? "Edit equipment" : "Add equipment"}</div>
            <div class="h2">Capture the details that affect price and fit.</div>
          </div>
          ${state.editingId ? `<button class="btn ghost" id="cancelEdit">Cancel</button>` : ``}
        </div>
        <div class="bd">
          ${itemForm(currency)}
        </div>
      </div>

      <div class="card">
        <div class="hd">
          <div>
            <div class="h1">Wishlist</div>
            <div class="h2">Compare options and place equipment into your layout.</div>
          </div>
        </div>
        <div class="bd">
          ${wishlistControlsHtml()}
          ${comparePanel(groups.flatMap(([,items])=>items), currency)}
          ${categoryManagerPanel()}
          ${wishlistColumnToggles()}
          ${groups.map(([cat, items])=> groupTable(cat, items, currency)).join("") || `<div class="muted">No items yet.</div>`}
        </div>
      </div>

      ${ingestPanel()}
    </div>
  `;
}

function groupTable(category, items, currency){
  const visible = new Set(wishlistVisibleColumns());
  const compareIds = new Set(state.compareSelectedIds || []);
  const isBrandGroup = (state.settings.wishlistGroupBy || "category") === "brand";
  const subtitle = isBrandGroup ? `${items.length} item${items.length===1?"":"s"}` : `${items.length} items`;
  // For brand groups, pass the actual brand string (or "__noBrand__" for the
  // no-brand bucket) so the Edit handler knows which items to update.
  const brandKeyForEdit = category === "— No brand —"
    ? "__noBrand__"
    : (items[0]?.brand && String(items[0].brand).trim()) || "__noBrand__";
  const headerActions = isBrandGroup
    ? `<span class="pill">${items.reduce((s,r)=>s+Math.max(0,Math.floor(safeNum(r.qty))),0)} qty</span>
       <button class="btn" type="button" data-action="editBrand" data-brand="${escapeAttr(brandKeyForEdit)}" title="Rename this brand (updates every item in this group)">Edit brand</button>`
    : `<span class="pill">${items.reduce((s,r)=>s+Math.max(0,Math.floor(safeNum(r.qty))),0)} qty</span>
       <button class="btn" type="button" data-action="renameCategory" data-category="${escapeAttr(category)}" title="Rename this category">Edit</button>
       <button class="btn danger" type="button" data-action="deleteCategory" data-category="${escapeAttr(category)}" ${category==="Custom" ? "disabled title=\"Cannot delete Custom category\"" : "title=\"Remove this category (items move to Custom)\""}style="padding:10px 16px;">Delete</button>`;
  return `
    <div class="card" style="border-radius:18px; box-shadow:none; margin-bottom:12px;">
      <div class="hd" style="padding:12px 12px 0 12px;">
        <div>
          <div class="h1">${escapeHtml(category)}</div>
          <div class="h2">${subtitle}</div>
        </div>
        <div class="actions" style="display:flex; gap:6px;">
          ${headerActions}
        </div>
      </div>
      <div class="bd" style="padding:12px;">
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th style="width:32px;" title="Select to compare">Cmp</th>
                <th>Item</th>
                ${visible.has("status") ? `<th>Status</th>` : ""}
                ${visible.has("priority") ? `<th>Priority</th>` : ""}
                ${visible.has("dimensions") ? `<th>Dims</th>` : ""}
                ${visible.has("power") ? `<th>Power</th>` : ""}
                ${visible.has("ceiling") ? `<th>Ceiling</th>` : ""}
                ${visible.has("total") ? `<th>Total</th>` : ""}
                ${visible.has("maxFit") ? `<th>Est. Max Fit</th>` : ""}
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(r=>`
                <tr style="${compareIds.has(r.id) ? "background:#f5f3ff;" : ""}">
                  <td style="text-align:center; vertical-align:middle;">
                    <input type="checkbox" data-action="toggleCompare" data-id="${r.id}" ${compareIds.has(r.id) ? "checked" : ""} style="width:16px;height:16px;cursor:pointer;" />
                  </td>
                  <td>
                    <div style="display:flex;align-items:flex-start;gap:10px;">
                      <div style="flex:1;min-width:0;">
                        <div style="font-weight:900;">${escapeHtml(r.name)}</div>
                        ${r.brand ? `<div class="muted" style="font-size:12px;margin-top:4px;">Brand: ${escapeHtml(r.brand)}</div>` : ``}
                        <div class="muted" style="font-size:12px;margin-top:4px;">Qty: ${Math.max(0,Math.floor(safeNum(r.qty)))}</div>
                        ${getItemBodyPartTags(r).length ? `<div class="muted" style="font-size:12px;margin-top:4px;">Muscles: ${escapeHtml(getItemBodyPartTags(r).join(", "))}</div>` : ``}
                        ${safeHttpUrl(r.productLink) ? `<div style="margin-top:8px;">${productLinkAnchorHtml(r.productLink, productLinkLabel(r.productLink) + " ↗")}</div>` : ""}
                      </div>
                      ${r.layoutImageDataUrl && String(r.layoutImageDataUrl).startsWith("data:") ? `<img src="${escapeAttr(r.layoutImageDataUrl)}" alt="${escapeAttr(r.name)}" data-action="openLightbox" data-src="${escapeAttr(r.layoutImageDataUrl)}" data-caption="${escapeAttr(r.name)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;cursor:zoom-in;" />` : ""}
                    </div>
                  </td>
                  ${visible.has("status") ? `<td>${escapeHtml(r.status||"")}</td>` : ""}
                  ${visible.has("priority") ? `<td>${escapeHtml(r.priority||"")}</td>` : ""}
                  ${visible.has("dimensions") ? `<td>${escapeHtml(formatDimsDual(r.Lft, r.Wft))}</td>` : ""}
                  ${visible.has("power") ? `<td>${r.requiresPower ? `${escapeHtml(r.powerVoltage)}${(r.powerAmps?` • ${escapeHtml(String(r.powerAmps))}A`:"")}` : "—"}</td>` : ""}
                  ${visible.has("ceiling") ? `<td>${(r.reqCeilingFt>0 && settingsCeilingHeightTotalFt()>0) ? (r.ceilingWarn ? `<span class="chip" style="background:#fff1f2;border-color:#fecdd3;color:#881337;">⚠ ${round1(r.reqCeilingFt)}ft &gt; ${round1(settingsCeilingHeightTotalFt())}ft</span>` : `${round1(r.reqCeilingFt)}ft`) : "—"}</td>` : ""}
                  ${visible.has("total") ? `<td>${money(r.total,currency)}</td>` : ""}
                  ${visible.has("maxFit") ? `<td>
                    ${Number.isFinite(r.maxFit) ? r.maxFit : 0}
                    <div class="muted" style="font-size:12px;margin-top:4px;">using ${round1(room().clearance)} ft default</div>
                  </td>` : ""}
                  <td style="text-align:right;">
                    <div class="actions">
                      <button type="button" class="btn" data-action="place" data-id="${r.id}">Place</button>
                      <button type="button" class="btn" data-action="edit" data-id="${r.id}">Edit</button>
                      <button type="button" class="btn danger" data-action="delete" data-id="${r.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function itemForm(currency){
  const d = state.draft;
  const fp = footprint(d);
  const tc = totalCost(d);
  const selectedTags = new Set(Array.isArray(d.equipmentTags) ? d.equipmentTags : []);
  const selectedTypes = new Set(Array.isArray(d.equipmentTypes) ? d.equipmentTypes : []);

  const catOptions = (state.categories||DEFAULT_CATEGORIES).map(c=>`<option value="${escapeAttr(c)}"${d.category===c?" selected":""}>${escapeHtml(c)}</option>`).join("");

  return `
    <div class="two">
      ${field("Item name", `<input id="f_name" value="${escapeAttr(d.name||"")}" placeholder="e.g., Functional trainer" />`)}
      ${field("Brand", `
        <div style="position:relative;">
          <input id="f_brand" value="${escapeAttr(d.brand||"")}" placeholder="e.g., Rogue" autocomplete="off" />
          <div id="brandList" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-top:none;max-height:200px;overflow-y:auto;display:none;z-index:10;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
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
      ${field("Status", `
        <select id="f_status">${STATUSES.map(s=>`<option value="${escapeAttr(s)}"${d.status===s?" selected":""}>${escapeHtml(s)}</option>`).join("")}</select>
      `)}
      ${field("Priority", `
        <select id="f_priority">${PRIORITIES.map(p=>`<option value="${escapeAttr(p)}"${d.priority===p?" selected":""}>${escapeHtml(p)}</option>`).join("")}</select>
      `)}
      ${field("Quantity", `<input id="f_qty" type="number" min="0" value="${escapeAttr(d.qty)}" />`)}
    </div>

    <div class="divider"></div>

    <div class="two">
      ${field("Unit", `
        <select id="f_unit">
          <option value="in"${d.unit==="in"?" selected":""}>in</option>
          <option value="cm"${d.unit==="cm"?" selected":""}>cm</option>
          <option value="ft"${d.unit==="ft"?" selected":""}>ft</option>
        </select>
      `)}
      ${d.unit==="ft" ? `
      ${field("Length", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="f_length" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(d.length)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="f_lengthIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(d.lengthIn ?? "")}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`, "Feet plus extra inches (e.g. 4 ft + 3 in)")}
      ${field("Width", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="f_width" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(d.width)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="f_widthIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(d.widthIn ?? "")}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`)}
      ${field("Height (optional)", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="f_height" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(d.height)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="f_heightIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(d.heightIn ?? "")}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`)}
      ` : `
      ${field("Length", `<input id="f_length" type="number" min="0" value="${escapeAttr(d.length)}" />`)}
      ${field("Width", `<input id="f_width" type="number" min="0" value="${escapeAttr(d.width)}" />`)}
      ${field("Height (optional)", `<input id="f_height" type="number" min="0" value="${escapeAttr(d.height)}" />`)}
      `}
    </div>

    <div class="two">
      ${field("Ceiling required (ft)", `<input id="f_requiredCeilingFt" type="number" min="0" step="0.1" value="${escapeAttr(d.requiredCeilingFt)}" placeholder="(blank = use Height)" />`, "Warns if ceiling/zones are too low")}
      ${field("Power voltage", `
        <select id="f_powerVoltage">
          <option value="" ${!d.powerVoltage ? "selected":""}>None</option>
          <option value="120V" ${d.powerVoltage==="120V" ? "selected":""}>120V</option>
          <option value="240V" ${d.powerVoltage==="240V" ? "selected":""}>240V</option>
        </select>
      `, "Outlet-distance warnings in Layout")}
      ${field("Power amps (optional)", `<input id="f_powerAmps" type="number" min="0" step="0.1" value="${escapeAttr(d.powerAmps)}" />`)}
    </div>

    <div style="margin-top:10px;">
      ${field("Outlet location notes", `<textarea id="f_outletNotes" rows="2" placeholder="e.g., Needs outlet on back wall near treadmill">${escapeHtml(d.outletNotes||"")}</textarea>`)}
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
        ${safeHttpUrl(d.productLink) ? `<div style="margin-top:10px;">${productLinkAnchorHtml(d.productLink, productLinkLabel(d.productLink) + " ↗")}</div>` : (String(d.productLink||"").trim() ? `<div class="muted" style="font-size:12px;margin-top:8px;">Use a full <b>https://</b> URL to enable the open link.</div>` : "")}
      </div>
    </div>

    <div class="divider"></div>
    <div class="field">
      <div class="label"><span>Layout photo (optional)</span><span>Upload a picture or keep the default block on the floor plan.</span></div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;margin-top:4px;">
        <input type="checkbox" id="f_layoutUseImage" ${d.layoutUseImage ? "checked" : ""} />
        Use photo on layout (when unchecked, the usual rectangle is used)
      </label>
      <div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center;">
        <input type="file" id="f_layoutImage" accept="image/jpeg,image/png,image/webp,image/gif" />
        <button type="button" class="btn" id="f_clearLayoutImage">Remove photo</button>
      </div>
      ${d.layoutImageDataUrl ? `<div style="margin-top:10px;"><img src="${escapeAttr(d.layoutImageDataUrl)}" alt="Layout photo preview" style="max-width:100%;max-height:180px;border-radius:12px;border:1px solid var(--border);object-fit:contain;background:var(--chip);" /></div>` : `<div class="muted" style="font-size:12px;margin-top:8px;">No photo yet — choose a file above. Images are compressed and stored in this browser only.</div>`}
    </div>

    <div class="divider"></div>
    <div class="kpiBox">
      <div style="font-weight:900;">3D model calibration</div>
      <div class="muted" style="font-size:12px;margin-top:6px;line-height:1.45;">Detail profiles were tuned against your saved reference photos. Auto selects the matching profile from the item name; your saved length, width, and height remain the exact source for the floor footprint.</div>
      <div class="two" style="margin-top:10px;">
        ${field("Model family", `
          <select id="f_model3dFamily">
            ${MODEL3D_FAMILIES.map(x=>`<option value="${escapeAttr(x.value)}" ${String(d.model3dFamily||"auto")===x.value?"selected":""}>${escapeHtml(x.label)}</option>`).join("")}
          </select>
        `)}
        ${field("Reference detail", `
          <select id="f_model3dProfile">
            ${equipmentModelProfilesForItem(d).map(x=>`<option value="${escapeAttr(x.value)}" ${String(d.model3dProfile||"auto")===x.value?"selected":""}>${escapeHtml(x.label)}</option>`).join("")}
          </select>
        `)}
      </div>
      <div style="margin-top:10px;">
        ${field("Front direction", `
          <select id="f_model3dFacing">
            <option value="default" ${String(d.model3dFacing||"default")==="default"?"selected":""}>As placed</option>
            <option value="reverse" ${String(d.model3dFacing||"")==="reverse"?"selected":""}>Reverse 180°</option>
          </select>
        `)}
      </div>
      <div class="ok" style="margin-top:10px;">Current shape: <b>${escapeHtml(equipmentModelFamilyLabel(equipmentModelFamily(d)))}</b> • detail: <b>${escapeHtml(equipmentModelProfileLabel(equipmentModelProfile(d)))}</b>${String(d.model3dProfile||"auto")==="auto"?" (matched from item name)":""}.</div>

      <div class="divider"></div>
      <div class="label"><span style="font-weight:900;">Real 3D model (.glb)</span><span>${itemHasLocal3dModel(d)?"Local model":itemUsesPhotoMatched3d(d)?"Photo-matched reconstruction":"Procedural model"}</span></div>
      <div class="muted" style="font-size:12px;margin-top:6px;line-height:1.45;">Optional GLB models (25 MB max) are stored locally in this browser and fitted inside the exact saved width, length, and height. If the file is unavailable or invalid, the procedural model remains visible.</div>
      <div class="row" style="justify-content:flex-start;gap:10px;margin-top:10px;align-items:center;">
        <label class="btn" style="cursor:pointer;">
          <span data-model-asset-label aria-live="polite">${itemHasLocal3dModel(d)?"Replace .glb":"Upload .glb"}</span>
          <input id="f_model3dAssetFile" type="file" accept=".glb,model/gltf-binary" style="display:none;" />
        </label>
        ${itemHasLocal3dModel(d)?`<button type="button" class="btn danger" id="f_removeModel3dAsset">Remove model</button>`:""}
        ${itemHasLocal3dModel(d)?`<span class="pill">${escapeHtml(d.model3dAssetName||"Local GLB")}${d.model3dAssetSize?` • ${escapeHtml(formatFileSize(d.model3dAssetSize))}`:""}</span>`:""}
      </div>
      ${itemHasLocal3dModel(d)?`
        <div style="margin-top:10px;">
          ${field("Model orientation", `
            <select id="f_model3dAssetRotation">
              ${[0,90,180,270].map(angle=>`<option value="${angle}" ${safeNum(d.model3dAssetRotation)===angle?"selected":""}>${angle}°${angle===0?" (as uploaded)":""}</option>`).join("")}
            </select>
          `, "Turn the visual model inside the same measured footprint")}
        </div>
        <div class="muted" style="font-size:11px;margin-top:6px;">Local-only asset — JSON backups keep the reference, not the GLB file itself.</div>
      `:""}
    </div>

    ${isRackCategory(d.category) ? `
      <div class="divider"></div>
      <div class="kpiBox">
        <div style="font-weight:900;">Rack specifications (for attachment compatibility)</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">Select hole pattern to check which attachments are compatible.</div>
        <div class="two" style="margin-top:10px;">
          ${field("Hole pattern", `
            <select id="f_rackHolePattern">
              <option value="" ${!d.rackHolePattern ? "selected":""}>Not specified</option>
              ${RACK_HOLE_PATTERNS.map(p=>`<option value="${escapeAttr(p.id)}" ${d.rackHolePattern===p.id?"selected":""}>${escapeHtml(p.label)}</option>`).join("")}
            </select>
          `)}
          ${d.rackHolePattern==="custom" ? field("Custom spec", `<input id="f_rackCustomSpec" value="${escapeAttr(d.rackCustomSpec||"")}" placeholder="e.g., 2.5×2.5 14-gauge..." />`) : ""}
        </div>
        ${d.rackHolePattern && d.rackHolePattern!=="custom" ? `
          <div class="ok" style="margin-top:10px;">
            ${(()=>{
              const spec = RACK_HOLE_PATTERNS.find(p=>p.id===d.rackHolePattern);
              if(!spec) return "";
              return `Upright: <b>${escapeHtml(spec.uprightSize)}</b> • Gauge: <b>${escapeHtml(spec.gauge)}</b> • Holes: <b>${escapeHtml(spec.holeSize)}</b> • Spacing: <b>${escapeHtml(spec.holeSpacing)}</b>`;
            })()}
          </div>
        ` : ""}
      </div>
    ` : ""}

    <div class="divider"></div>

    <div style="margin-top:10px;">
      <div class="field">
        <div class="label"><span>Muscle groups</span></div>
        <div class="checks" style="margin-top:8px;">
          ${ITEM_BODY_PART_TAGS.map(tag=>`<button class="checkBtn ${selectedTags.has(tag)?"on":""}" data-action="toggleItemTag" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join("")}
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div style="margin-top:10px;">
      <div class="field">
        <div class="label"><span>Equipment Types</span></div>
        <div class="checks" style="margin-top:8px;">
          ${EQUIPMENT_TYPES.map(type=>`<button class="checkBtn" type="button" data-action="toggleEquipmentType" data-type="${escapeAttr(type)}" style="margin-bottom:6px;">${escapeHtml(type)}</button>`).join("")}
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

    <div class="row" style="margin-top:12px; justify-content:space-between;">
      <button class="btn primary" id="saveItemBtn" ${!String(d.name||"").trim() ? "disabled":""}>${state.editingId ? "Save" : "Add"}</button>
      <div class="muted" style="font-size:12px;">Auto-fill can also add rack notes and dimensions from product links.</div>
    </div>
  `;
}

function readyPanel(rows, currency){
  const sortKeyRaw = state.settings.wishlistSort || "dateAdded";
  const sortKey = WISHLIST_SORT_OPTIONS.some(o=> o.value===sortKeyRaw) ? sortKeyRaw : "dateAdded";
  const list = rows.filter(r=>r.status==="Ready to Buy").sort((a,b)=> wishlistSortCompare(a, b, sortKey));
  return `
    <div class="card" style="margin-top:16px;">
      <div class="hd">
        <div>
          <div class="h1">Ready to Buy</div>
          <div class="h2">Items where Status = Ready to Buy</div>
        </div>
        <span class="pill">${list.length} items</span>
      </div>
      <div class="bd">
        <div class="tableWrap">
          <table style="min-width:900px;">
            <thead>
              <tr><th>Item</th><th>Category</th><th>Total</th><th style="text-align:right;">Actions</th></tr>
            </thead>
            <tbody>
              ${list.map(r=>`
                <tr>
                  <td><div style="font-weight:900;">${escapeHtml(r.name)}</div>${r.brand ? `<div class="muted" style="font-size:12px;margin-top:4px;">Brand: ${escapeHtml(r.brand)}</div>` : ``}</td>
                  <td>${escapeHtml(r.category)}</td>
                  <td>${money(r.total,currency)}</td>
                  <td style="text-align:right;">
                    <div class="actions">
                      <button type="button" class="btn" data-action="place" data-id="${r.id}">Place</button>
                      <button type="button" class="btn" data-action="edit" data-id="${r.id}">Edit</button>
                      <button type="button" class="btn danger" data-action="delete" data-id="${r.id}">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
              ${!list.length ? `<tr><td colspan="4" style="text-align:center;" class="muted">No items are marked "Ready to Buy".</td></tr>`:""}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function settingsPanel(){
  const s = state.settings;
  const r = room();
  const sides = Array.isArray(s.defaultDeadspaceSides) ? s.defaultDeadspaceSides : [];

  const cutouts = (state.layout.areas||[]).filter(a=>a.kind==="cutout").reduce((sum,a)=>sum + Math.max(0,safeNum(a.widthFt))*Math.max(0,safeNum(a.heightFt)), 0);
  const floorArea = Math.max(0, r.area - cutouts);
  const wastePct = clamp(safeNum(s.floorWastePct), 0, 50);
  const areaWithWaste = floorArea * (1 + wastePct/100);

  const mode = s.flooringMode || "tiles";
  const tileWft = Math.max(0, safeNum(s.tileWidthIn)/12);
  const tileLft = Math.max(0, safeNum(s.tileLengthIn)/12);
  const tileArea = tileWft * tileLft;
  const tilesPerBox = Math.max(1, Math.floor(safeNum(s.tilesPerBox) || 1));
  const tilesNeeded = tileArea>0 ? Math.ceil(areaWithWaste / tileArea) : 0;
  const boxesNeeded = tilesPerBox>0 ? Math.ceil(tilesNeeded / tilesPerBox) : 0;

  const rollArea = Math.max(0, safeNum(s.rollWidthFt)) * Math.max(0, safeNum(s.rollLengthFt));
  const rollsNeeded = rollArea>0 ? Math.ceil(areaWithWaste / rollArea) : 0;

  return `
    <div class="card" style="margin-top:16px;">
      <div class="hd">
        <div>
          <div class="h1">Settings</div>
          <div class="h2">Room + clearance + fit realism (ceiling, power) + flooring estimator</div>
        </div>
      </div>
      <div class="bd">
        <div class="two">
          ${field("Currency (ISO code)", `<input id="set_currency" value="${escapeAttr(s.currency||"USD")}" placeholder="USD" />`)}
          ${field("Snap increment (ft)", `<input id="set_snap" type="number" min="0" step="0.25" value="${escapeAttr(s.snapFt)}" />`, "0 = no snap")}
        </div>

        <div class="divider"></div>

        <div class="two">
          ${field("Room length", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="set_len" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(s.roomLengthFt)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="set_lenIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(s.roomLengthIn ?? 0)}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`, "Feet plus extra inches (e.g. 20 ft + 6 in)")}
          ${field("Room width", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="set_wid" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(s.roomWidthFt)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="set_widIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(s.roomWidthIn ?? 0)}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`)}
          ${field("Default deadspace", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="set_clear" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(s.clearanceFt)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="set_clearIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(s.clearanceIn ?? 0)}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`, "2–3 ft between machines ≈ 1–1.5 ft per side. Total is clamped to 10 ft.")}
          ${field("Ceiling height", `<div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;"><input id="set_ceiling" type="number" min="0" step="1" style="flex:1; min-width:72px;" value="${escapeAttr(s.ceilingHeightFt)}" placeholder="ft" /><span class="muted" style="font-size:12px;">ft</span><input id="set_ceilingIn" type="number" min="0" step="0.1" style="flex:1; min-width:72px;" value="${escapeAttr(s.ceilingHeightIn ?? 0)}" placeholder="in" /><span class="muted" style="font-size:12px;">in</span></div>`, "Default ceiling. Override per-zone in Layout.")}
          ${field("Max cord length (ft)", `<input id="set_cord" type="number" min="0" step="0.5" value="${escapeAttr(s.maxCordLengthFt)}" />`, "Warns if powered item is farther than this from an outlet")}
        </div>

        <div class="divider"></div>

        <div class="kpiBox">
          <div style="font-weight:900;">Default deadspace sides (multi-select)</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">Used for layout unless an equipment instance overrides.</div>
          <div class="checks" style="margin-top:10px;">
            ${DEADSPACE_SIDES.map(x=>{
              const on = sides.includes(x.value);
              return `<button class="checkBtn ${on?"on":""}" data-action="toggleDefaultSide" data-side="${x.value}">${x.label}</button>`;
            }).join("")}
            <button class="btn" data-action="defaultSidesAll">All</button>
            <button class="btn" data-action="defaultSidesNone">None</button>
          </div>
        </div>

        <div style="margin-top:12px;" class="ok">
          Calculated room bounds: <b>${round1(r.bounds.w)} ft</b> × <b>${round1(r.bounds.h)} ft</b> • Room area (with extensions): <b>${round1(r.area)} sq ft</b>
        </div>

        <div class="divider"></div>

        <div class="kpiBox">
          <div style="font-weight:900;">Reserved area types that subtract from usable space</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">Toggle which reserved area types reduce the "Usable" square footage displayed on the Layout tab.</div>
          <div class="checks" style="margin-top:10px;">
            ${AREA_KINDS.map(k=>{
              const enabled = Array.isArray(s.reservedAreaKindsSubtractSpace) && s.reservedAreaKindsSubtractSpace.includes(k.value);
              return `<button class="checkBtn ${enabled?"on":""}" data-action="toggleReservedSubtract" data-kind="${escapeAttr(k.value)}">${escapeHtml(k.label)}</button>`;
            }).join("")}
            <button class="btn" data-action="reservedSubtractAll">All</button>
            <button class="btn" data-action="reservedSubtractNone">None</button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="kpiBox">
          <div style="font-weight:900;">Reserved area types that block equipment placement</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">Toggle which reserved area types prevent equipment from being placed on top of them. Turn off a type to allow equipment overlap (e.g., ceiling-mounted pull-up bars over walkways).</div>
          <div class="checks" style="margin-top:10px;">
            ${AREA_KINDS.map(k=>{
              const enabled = Array.isArray(s.reservedAreaKindsBlockPlacement) && s.reservedAreaKindsBlockPlacement.includes(k.value);
              return `<button class="checkBtn ${enabled?"on":""}" data-action="toggleReservedBlock" data-kind="${escapeAttr(k.value)}">${escapeHtml(k.label)}</button>`;
            }).join("")}
            <button class="btn" data-action="reservedBlockAll">All</button>
            <button class="btn" data-action="reservedBlockNone">None</button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="card" style="border-radius:18px; box-shadow:none;">
          <div class="hd" style="padding:12px 12px 0 12px;">
            <div>
              <div class="h1">AI Auto-fill (Product Link)</div>
              <div class="h2">Use Gemini or ChatGPT to auto-fill product details from URL</div>
            </div>
          </div>
          <div class="bd" style="padding:12px;">
            <div class="two">
              ${field("AI Provider", `
                <select id="set_aiProvider">
                  <option value="none" ${(s.aiProvider||"none")==="none"?"selected":""}>None (disabled)</option>
                  <option value="gemini" ${s.aiProvider==="gemini"?"selected":""}>Google Gemini</option>
                  <option value="openai" ${s.aiProvider==="openai"?"selected":""}>OpenAI (ChatGPT)</option>
                </select>
              `)}
              ${field("API Key", `<input id="set_aiApiKey" type="password" class="apiKeyInput" value="${escapeAttr(s.aiApiKey||"")}" placeholder="Enter your API key..." />`)}
            </div>
            <div class="muted" style="font-size:12px;margin-top:10px;">
              Your API key is stored locally and never sent anywhere except the AI provider. 
              Get a Gemini key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com</a> or 
              OpenAI key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>.
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="card" style="border-radius:18px; box-shadow:none;">
          <div class="hd" style="padding:12px 12px 0 12px;">
            <div>
              <div class="h1">Flooring planner</div>
              <div class="h2">Estimates tiles/rolls based on room area (minus Cutout areas) + waste</div>
            </div>
          </div>
          <div class="bd" style="padding:12px;">
            <div class="two">
              ${field("Mode", `
                <select id="set_floorMode">
                  <option value="tiles" ${mode==="tiles"?"selected":""}>Tiles</option>
                  <option value="roll" ${mode==="roll"?"selected":""}>Rolls</option>
                </select>
              `)}
              ${field("Waste %", `<input id="set_floorWaste" type="number" min="0" max="50" step="1" value="${escapeAttr(wastePct)}" />`, "Typical: 5–15%")}
            </div>

            ${mode==="tiles" ? `
              <div class="three" style="margin-top:10px;">
                ${field("Tile width (in)", `<input id="set_tileW" type="number" min="0" step="0.5" value="${escapeAttr(s.tileWidthIn)}" />`)}
                ${field("Tile length (in)", `<input id="set_tileL" type="number" min="0" step="0.5" value="${escapeAttr(s.tileLengthIn)}" />`)}
                ${field("Tiles per box", `<input id="set_tilesPerBox" type="number" min="1" step="1" value="${escapeAttr(s.tilesPerBox)}" />`)}
              </div>
              <div class="kpiBox" style="margin-top:10px;">
                <div class="row" style="justify-content:flex-start; gap:10px;">
                  <span class="pill">Floor area: <b>${round1(floorArea)}</b> sq ft</span>
                  <span class="pill">With waste: <b>${round1(areaWithWaste)}</b> sq ft</span>
                  <span class="pill">Tiles needed: <b>${tilesNeeded}</b></span>
                  <span class="pill">Boxes needed: <b>${boxesNeeded}</b></span>
                </div>
              </div>
            ` : `
              <div class="two" style="margin-top:10px;">
                ${field("Roll width (ft)", `<input id="set_rollW" type="number" min="0" step="0.1" value="${escapeAttr(s.rollWidthFt)}" />`)}
                ${field("Roll length (ft)", `<input id="set_rollL" type="number" min="0" step="0.1" value="${escapeAttr(s.rollLengthFt)}" />`)}
              </div>
              <div class="kpiBox" style="margin-top:10px;">
                <div class="row" style="justify-content:flex-start; gap:10px;">
                  <span class="pill">Floor area: <b>${round1(floorArea)}</b> sq ft</span>
                  <span class="pill">With waste: <b>${round1(areaWithWaste)}</b> sq ft</span>
                  <span class="pill">Rolls needed: <b>${rollsNeeded}</b></span>
                </div>
              </div>
            `}
          </div>
        </div>

        <div class="row" style="margin-top:12px; justify-content:flex-start;">
          <button class="btn primary" id="saveSettingsBtn">Save settings</button>
        </div>
      </div>
    </div>
  `;
}

function ingestPanel(){
  const parsed = state.ingestParsed || [];
  // Items created from an HTML export always have "Similarity group:" or
  // "Product ID:" lines in their notes — used as the "imported" marker.
  const importedCount = (state.items || []).filter(isHtmlImportedItem).length;
  return `
    <div class="card" style="margin-top:16px;">
      <div class="hd">
        <div>
          <div class="h1">Paste / Auto-add</div>
          <div class="h2">Paste blocks here, or use <b>Import</b> in the header to load a <b>gym-equipment-export</b> HTML file. Then review and <b>Add selected</b>.</div>
        </div>
        ${importedCount > 0 ? `<button class="btn danger" type="button" data-action="deleteAllImported" title="Open a picker to delete specific import batches (grouped by when they were imported). You can delete just the latest batch or pick any combination.">Delete imported… (${importedCount})</button>` : ``}
      </div>
      <div class="bd">
        ${state.ingestErr ? `<div class="err">${escapeHtml(state.ingestErr)}</div>` : ``}
        ${field("Paste text / links", `<textarea id="ing_text" rows="8" placeholder="Example:\nRogue Echo Bike\n$895\n53&quot; x 24&quot; x 52&quot;\nhttps://...">${escapeHtml(state.ingestText||"")}</textarea>`)}
        <div class="row" style="margin-top:10px; justify-content:flex-start;">
          <button class="btn" id="ing_parse">Parse</button>
          <button class="btn" id="ing_clear">Clear</button>
          <button class="btn primary" id="ing_addSelected" ${parsed.some(x=>x.selected) ? "" : "disabled"}>Add selected</button>
        </div>

        <div style="margin-top:12px;" class="kpiBox">
          <div style="font-weight:900;">Parsed items</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">Check what you want, then "Add selected".</div>
        </div>

        <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
          ${parsed.length ? parsed.map(x=>ingestRow(x)).join("") : `<div class="muted">Nothing parsed yet.</div>`}
        </div>

        <div class="muted" style="font-size:12px;margin-top:12px;">
          Want true hands-free AI extraction? Browsers usually block calling OpenAI/Gemini directly (CORS + key safety).
          Best practice is a small backend proxy. This offline file stays dependency-free so it always loads.
        </div>
      </div>
    </div>
  `;
}

function ingestRow(x){
  const d = x.data || {};
  const catOptions = (state.categories||DEFAULT_CATEGORIES).map(c=>`<option value="${escapeAttr(c)}"${d.category===c?" selected":""}>${escapeHtml(c)}</option>`).join("");
  return `
    <div class="itemCard" data-ing="${x.id}">
      <div class="row" style="justify-content:space-between; align-items:flex-start;">
        <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
          <input type="checkbox" data-action="ing_toggle" data-id="${x.id}" ${x.selected?"checked":""} style="margin-top:3px;" />
          <div>
            <div class="name">${escapeHtml(d.name||"New item")}</div>
            <div class="meta">${escapeHtml(d.category||"Custom")} • ${escapeHtml(d.unit||"in")} • ${escapeHtml(String(d.length||0))}×${escapeHtml(String(d.width||0))}×${escapeHtml(String(d.height||0))} • $${safeNum(d.price)||0}</div>
          </div>
        </label>
        <span class="chip">Decision ${decisionScore(d)}</span>
      </div>

      <div class="two" style="margin-top:10px;">
        ${field("Category", `<select data-action="ing_cat" data-id="${x.id}">${catOptions}</select>`)}
        ${field("Price", `<input type="number" data-action="ing_price" data-id="${x.id}" value="${escapeAttr(d.price)}" />`)}
      </div>
      <div style="margin-top:10px;">
        ${field("Link", `<input data-action="ing_link" data-id="${x.id}" value="${escapeAttr(d.productLink||"")}" placeholder="https://..." />`)}
      </div>
    </div>
  `;
}

function tipsPanel(){
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Tips</div>
          <div class="h2">Make the layout feel real</div>
        </div>
      </div>
      <div class="bd">
        <ul class="helpList">
          <li>Add <b>outlets/sockets</b> where your wall power is. Treadmills and powered equipment will warn if too far.</li>
          <li>Use <b>wall extensions</b> to expand your room where the wall bumps out (alcoves, garage bays).</li>
          <li>Add <b>ceiling zones</b> for areas with low clearance (garage door rails, beams, HVAC ducts).</li>
          <li>Add <b>floor elevation zones</b> for raised platforms, steps, or concrete slabs.</li>
          <li>Add <b>flooring pieces</b> (stall mats, rolled rubber) to visualize coverage and cost.</li>
          <li>Add <b>wall finishes and lighting</b> from Layout Tools, then drag each feature along its chosen wall.</li>
          <li>Add a <b>walkway</b> for aisles so usable sq ft matches reality.</li>
          <li>Add <b>doors / garage doors</b> so you don't block openings.</li>
          <li>Use <b>cutouts</b> to remove a corner (e.g. garage compartment).</li>
          <li>Set <b>deadspace sides</b> per machine to represent clearance only where needed.</li>
        </ul>
      </div>
    </div>
  `;
}

function exercisesPanel(){
  const stats = getExerciseStats();
  const filterBodyPart = state.exerciseFilterBodyPart || "All";
  const filterType = state.exerciseFilterType || "All";
  const filterView = state.exerciseFilterView || "available";
  
  let exercises = filterView === "available" ? stats.available : stats.needed;
  
  if(filterBodyPart !== "All"){
    exercises = exercises.filter(ex=> ex.bodyPart === filterBodyPart);
  }
  if(filterType !== "All"){
    exercises = exercises.filter(ex=> ex.type === filterType);
  }
  
  const bodyPartColors = {
    "Chest": "#ef4444",
    "Back": "#f97316",
    "Shoulders": "#eab308",
    "Biceps": "#84cc16",
    "Triceps": "#22c55e",
    "Quads": "#14b8a6",
    "Hamstrings": "#06b6d4",
    "Glutes": "#3b82f6",
    "Calves": "#8b5cf6",
    "Core": "#d946ef",
    "Cardio": "#ec4899",
  };

  // Show which items have been tagged and which haven't
  const untaggedItems = (state.items||[]).filter(item=> getItemBodyPartTags(item).length === 0);

  return `
    <div class="card" style="margin-top:16px;">
      <div class="hd">
        <div>
          <div class="h1">Exercise Coverage</div>
          <div class="h2">Tag your wishlist items with muscle groups (in Wishlist → Edit item) to see coverage</div>
        </div>
        <div class="row" style="gap:10px;">
          <span class="pill" style="background:#f0fdf4;border-color:#86efac;">Available: <b>${stats.totalAvailable}</b></span>
          <span class="pill" style="background:#fef2f2;border-color:#fecaca;">Needs equipment: <b>${stats.totalExercises - stats.totalAvailable}</b></span>
        </div>
      </div>
      <div class="bd">
        ${untaggedItems.length ? `
          <div class="kpiBox" style="margin-bottom:12px;">
            <div style="font-weight:900;">Items not yet tagged</div>
            <div class="muted" style="font-size:12px;margin-top:6px;">Edit these items and select muscle groups to include them in exercise coverage.</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
              ${untaggedItems.map(item=>`
                <span style="display:inline-flex; align-items:center; gap:6px; border:1px solid var(--border); border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; background:#fff;">
                  ${escapeHtml(item.name||"Untitled")}
                  <button class="btn ghost" style="padding:2px 6px; font-size:11px;" data-action="edit" data-id="${item.id}">Tag it</button>
                </span>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <div class="kpiBox">
          <div style="font-weight:900;">Exercise Coverage by Body Part</div>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:12px; margin-top:12px;">
            ${BODY_PARTS.filter(bp=>bp!=="All").map(bp=>{
              const data = stats.byBodyPart[bp] || {total:0, available:0, pct:0};
              const color = bodyPartColors[bp] || "#64748b";
              return `
                <div style="padding:10px; border:1px solid var(--border); border-radius:12px; background:#fff;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700; font-size:13px;">${escapeHtml(bp)}</span>
                    <span style="font-size:12px; color:var(--muted);">${data.available}/${data.total}</span>
                  </div>
                  <div class="exerciseBar">
                    <div class="exerciseBarFill" style="width:${data.pct}%; background:${color};"></div>
                  </div>
                  <div style="font-size:11px; color:var(--muted); margin-top:4px;">${data.pct}% coverage</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="row" style="justify-content:flex-start; flex-wrap:wrap; gap:8px;">
          <span class="pill">View</span>
          <button class="checkBtn ${filterView==="available"?"on":""}" data-action="ex_view" data-value="available">Available (${stats.totalAvailable})</button>
          <button class="checkBtn ${filterView==="needed"?"on":""}" data-action="ex_view" data-value="needed">Needs Equipment (${stats.totalExercises - stats.totalAvailable})</button>
        </div>
        
        <div class="row" style="justify-content:flex-start; flex-wrap:wrap; gap:8px; margin-top:10px;">
          <span class="pill">Body Part</span>
          ${BODY_PARTS.map(bp=>`<button class="checkBtn ${filterBodyPart===bp?"on":""}" data-action="ex_bodypart" data-value="${bp}">${bp}</button>`).join("")}
        </div>
        
        <div class="row" style="justify-content:flex-start; flex-wrap:wrap; gap:8px; margin-top:10px;">
          <span class="pill">Type</span>
          ${EXERCISE_TYPES.map(t=>`<button class="checkBtn ${filterType===t?"on":""}" data-action="ex_type" data-value="${t}">${t}</button>`).join("")}
        </div>
        
        <div class="divider"></div>
        
        <div style="font-weight:900; margin-bottom:10px;">
          ${filterView === "available" ? "Exercises You Can Do" : "Exercises That Need Equipment"} 
          <span class="muted" style="font-weight:400;">(${exercises.length} exercises)</span>
        </div>
        
        <div class="exerciseGrid">
          ${exercises.map(ex=>`
            <div class="exerciseCard ${filterView==="available"?"available":"needed"}">
              <div class="exName">${escapeHtml(ex.name)}</div>
              <div class="exMeta">${escapeHtml(ex.bodyPart)} • ${escapeHtml(ex.type)}</div>
              ${ex.equipment.length ? `<div class="exMeta" style="margin-top:4px;">Needs: ${ex.equipment.slice(0,3).map(e=>escapeHtml(e)).join(", ")}${ex.equipment.length>3?"...":""}</div>` : `<div class="exMeta" style="margin-top:4px;">No equipment needed</div>`}
            </div>
          `).join("")}
          ${!exercises.length ? `<div class="muted">No exercises match your filters.</div>` : ""}
        </div>
        
        ${filterView === "needed" && exercises.length ? `
          <div class="divider"></div>
          <div class="kpiBox">
            <div style="font-weight:900;">Body Parts to Tag on Your Items</div>
            <div class="muted" style="font-size:12px;margin-top:6px;">Tag your wishlist items with these muscle groups to unlock more exercise coverage.</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
              ${(()=>{
                const covered = getCoveredExerciseBodyParts();
                const missingBodyParts = [...new Set(exercises.map(ex=>ex.bodyPart))].filter(bp=> !covered.has(bp));
                return missingBodyParts.map(bp=>`<span class="pill">${escapeHtml(bp)}</span>`).join("");
              })()}
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}
