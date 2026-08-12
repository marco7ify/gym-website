// Render functions for Gym Wishlist + Layout Planner

let __renderQueued = false;
let __persistTimer = null;

function schedulePersist(){
  if(__persistTimer) clearTimeout(__persistTimer);
  __persistTimer = setTimeout(()=>{
    __persistTimer = null;
    persist();
  }, state.drag?.active ? 250 : 100);
}

// Selectors for scrollable containers whose scroll positions we preserve
// across renders so clicking quick-add / quick-compare / etc. doesn't bounce
// the user back to the top of the equipment list or sidebars.
const SCROLL_PRESERVE_SELECTORS = [
  ".gymItemList",
  ".equipList",
  ".leftSidebar",
  ".rightSidebar",
  ".layoutEquipmentScroll",
  ".layoutInspectorScroll",
  ".svgWrap",
];

function captureScrollPositions(){
  const map = new Map();
  SCROLL_PRESERVE_SELECTORS.forEach(sel=>{
    document.querySelectorAll(sel).forEach((el, i)=>{
      map.set(`${sel}|${i}`, { top: el.scrollTop, left: el.scrollLeft });
    });
  });
  // Also capture the window scroll so handlers that happen to re-enter the
  // page (e.g. focus change after select dropdowns) can restore it.
  map.set("__window__", { top: window.scrollY || 0, left: window.scrollX || 0 });
  return map;
}

function restoreScrollPositions(map){
  if(!map || !map.size) return;
  SCROLL_PRESERVE_SELECTORS.forEach(sel=>{
    document.querySelectorAll(sel).forEach((el, i)=>{
      const pos = map.get(`${sel}|${i}`);
      if(pos){
        el.scrollTop = pos.top;
        el.scrollLeft = pos.left;
      }
    });
  });
}

// Snapshot of scroll positions captured at the moment the user presses the
// mouse/touch (or types a key), BEFORE any handler has a chance to mutate
// state or move focus. This gives `performRender` a reliable "last known
// good" scroll to restore, even when the triggering click is on a focusable
// element in the right sidebar that the browser would otherwise auto-scroll
// into view.
let __lastPointerScroll = null;
if(typeof window !== "undefined" && !window.__scrollSnapshotWired){
  window.__scrollSnapshotWired = true;
  const snap = ()=>{ try{ __lastPointerScroll = captureScrollPositions(); }catch{} };
  // Capture phase so we run before any app handler / focus change.
  window.addEventListener("pointerdown", snap, true);
  window.addEventListener("mousedown", snap, true);
  window.addEventListener("touchstart", snap, { capture: true, passive: true });
  window.addEventListener("keydown", snap, true);
}

function performRender(){
  if(typeof destroyGym3DViews === "function") destroyGym3DViews();
  const shouldRestoreUi = !state.drag?.active;
  const __focus = shouldRestoreUi ? captureFocus() : null;
  // Prefer the scroll snapshot taken at pointerdown (before any handler
  // mutated state or moved focus). Fall back to a fresh capture if we don't
  // have one yet (e.g., programmatic render on startup).
  const __innerScroll = shouldRestoreUi
    ? (__lastPointerScroll || captureScrollPositions())
    : null;
  const __scrollY = shouldRestoreUi
    ? ((__innerScroll && __innerScroll.get("__window__")?.top) ?? (window.scrollY || 0))
    : 0;
  const __scrollX = shouldRestoreUi
    ? ((__innerScroll && __innerScroll.get("__window__")?.left) ?? (window.scrollX || 0))
    : 0;
  schedulePersist();

  const rows = computedRows();
  const groups = groupByCategory(rows);
  const r = room();
  const usable = usableSqFt();
  const reserved = reservedSqFt();
  const readyTotal = readyToBuyTotal(rows);
  const planTotal = plannedTotal(rows);
  const usedEst = usedAreaEstimate(rows);
  const remainEst = usable - usedEst;
  const freePercent = usable > 0 ? clamp((remainEst / usable) * 100, 0, 100) : 0;
  const currency = state.settings.currency || "USD";

  const app = $("#app");
  app.innerHTML = `
    <div class="container">
      <header class="appHeader">
        <div class="brand" aria-label="Gym Planner home">
          <span class="brandMark" aria-hidden="true">GP</span>
          <span class="title">Gym Planner</span>
        </div>
        <div class="headerNav">
          <div class="tabs" role="tablist" aria-label="Planner sections">
            ${tabBtn("wishlist","Wishlist", "list")}
            ${tabBtn("ready","Ready to Buy", "cart")}
            ${tabBtn("layout","Layout", "layout")}
            ${tabBtn("settings","Settings", "settings")}
          </div>
        </div>
        <div class="headerActions">
          <button class="btn headerAction" id="exportBtn">${appIcon("export")}<span>Export</span></button>
          <label class="btn headerAction" id="importLabel" role="button" tabindex="0" style="cursor:pointer;">
            ${appIcon("import")}<span>Import</span><input type="file" id="importFile" accept="application/json,.json,text/html,.html,.htm" style="display:none;" />
          </label>
        </div>
      </header>

      <div class="gridcards">
        ${kpiCard("cart", "Ready to buy", `${money(readyTotal,currency)} committed`, `<div class="big">${rows.filter(x=>x.status==="Ready to Buy").length} <span>item${rows.filter(x=>x.status==="Ready to Buy").length===1?"":"s"}</span></div>`)}
        ${kpiCard("tag", "Planned total", `${rows.length} item${rows.length===1?"":"s"} in wishlist`, `<div class="big">${money(planTotal,currency)}</div>`)}
        ${kpiCard("layout", "Room", `${round1(r.area)} sq ft total`, `<div class="big">${round1(r.L)} × ${round1(r.W)} <span>ft</span></div>`)}
        ${kpiCard("space", "Space remaining", `${round1(freePercent)}% of usable area free`, `<div class="big ${remainEst<0?'isNegative':''}">${round1(remainEst)} <span>sq ft</span></div>`)}
      </div>

      ${mainPanel(state.tab, rows, groups, currency)}

      <div class="foot">
        Layout rules: equipment cannot overlap reserved areas; deadspace halos cannot overlap other equipment.
        Drag on the grid; invalid placement snaps back. Outlets show power proximity for treadmills and powered equipment.
      </div>
    </div>

    <div id="imgLightbox" class="lightbox" aria-hidden="true">
      <div class="lightbox-backdrop" data-action="closeLightbox"></div>
      <div class="lightbox-inner" role="dialog" aria-modal="true">
        <button class="lightbox-close" type="button" data-action="closeLightbox" aria-label="Close">×</button>
        <img id="imgLightboxImg" alt="" />
        <div id="imgLightboxCaption" class="lightbox-caption"></div>
      </div>
    </div>

    <div id="exportModal" class="lightbox ${state.exportDialogOpen ? "open" : ""}" aria-hidden="${state.exportDialogOpen ? "false" : "true"}">
      <div class="lightbox-backdrop" data-action="closeExportDialog"></div>
      <div class="lightbox-inner" role="dialog" aria-modal="true" style="max-width:min(94vw,680px);">
        <button class="lightbox-close" type="button" data-action="closeExportDialog" aria-label="Close">×</button>
        <div style="background:#fff;border:1px solid var(--border);border-radius:18px;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.3);">
          <div style="font-size:22px;font-weight:900;color:#0f172a;">Export options</div>
          <div class="muted" style="margin-top:6px;font-size:13px;">Choose what you want to download. API keys are never included in downloaded files.</div>

          <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px;">
            ${[
              { id: "full", title: "Full backup", desc: "Wishlist items and layouts. Local GLB model files stay in this browser." },
              { id: "noLayouts", title: "Everything except layouts", desc: "Wishlist, categories, settings, and items only." },
              { id: "layoutsOnly", title: "Layouts only", desc: "Only layout data, with the equipment records needed to reopen it." },
            ].map(opt=>`
              <button type="button" class="btn" data-action="setExportMode" data-mode="${opt.id}" style="text-align:left;justify-content:flex-start;padding:14px 16px;border-width:2px;${state.exportMode===opt.id?"border-color:#3b82f6;background:#eff6ff;box-shadow:0 0 0 1px rgba(59,130,246,.12) inset;":"background:#fff;"}">
                <span style="display:block;">
                  <span style="display:block;font-weight:900;color:#0f172a;">${opt.title}</span>
                  <span style="display:block;margin-top:4px;font-size:12px;color:#64748b;">${opt.desc}</span>
                </span>
              </button>
            `).join("")}
          </div>

          ${(state.exportMode==="full" || state.exportMode==="layoutsOnly") ? `
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">
              <div style="font-size:13px;font-weight:800;color:#0f172a;">Layout scope</div>
              <div class="muted" style="font-size:12px;margin-top:4px;">Choose the current layout or your whole layout library.</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
                <button type="button" class="btn" data-action="setExportLayoutScope" data-scope="active" style="border-width:2px;${state.exportLayoutScope==="active"?"border-color:#3b82f6;background:#eff6ff;":"background:#fff;"}">Current layout only</button>
                <button type="button" class="btn" data-action="setExportLayoutScope" data-scope="all" style="border-width:2px;${state.exportLayoutScope==="all"?"border-color:#3b82f6;background:#eff6ff;":"background:#fff;"}">All layouts</button>
              </div>
            </div>
          ` : ""}

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
            <button type="button" class="btn" data-action="closeExportDialog">Cancel</button>
            <button type="button" class="btn primary" data-action="confirmExport">Download export</button>
          </div>
        </div>
      </div>
    </div>
  `;

  wireTop();
  wireTab();
  wireMain();
  wireWishlistExtras();
  wireLayoutGridContrast();
  wireSpatialControls();
  wireEquipmentModelControls();
  const walkthroughDialog=app.querySelector("dialog.walkthroughOverlay");
  if(walkthroughDialog&&!walkthroughDialog.open){
    try{ walkthroughDialog.showModal(); }
    catch{ walkthroughDialog.setAttribute("open",""); }
  }
  if(state.tab === "layout" && typeof initGym3DViews === "function") initGym3DViews();

  if(shouldRestoreUi){
    // Restore inner scrollbars AND window scroll synchronously (same tick as
    // innerHTML reset) so the user never sees a flash at the top of the list
    // or page. Then re-apply on the next animation frame and again in a
    // double-rAF to defeat any late focus-induced scrollIntoView from the
    // browser.
    restoreScrollPositions(__innerScroll);
    try{ window.scrollTo({top: __scrollY, left: __scrollX, behavior: 'auto'}); }catch{ try{ window.scrollTo(__scrollX, __scrollY); }catch{} }
    requestAnimationFrame(()=>{
      try{ window.scrollTo({top: __scrollY, left: __scrollX, behavior: 'auto'}); }catch{ try{ window.scrollTo(__scrollX, __scrollY); }catch{} }
      restoreScrollPositions(__innerScroll);
      restoreFocus(__focus);
      requestAnimationFrame(()=>{
        try{ window.scrollTo({top: __scrollY, left: __scrollX, behavior: 'auto'}); }catch{}
        restoreScrollPositions(__innerScroll);
      });
    });
  }
}

function render(options={}){
  if(options.immediate){
    __renderQueued = false;
    performRender();
    return;
  }
  if(__renderQueued) return;
  __renderQueued = true;
  requestAnimationFrame(()=>{
    __renderQueued = false;
    performRender();
  });
}

function tabBtn(value,label,icon){
  const active = state.tab===value ? "active" : "";
  return `<button class="tab ${active}" data-tab="${value}" role="tab" aria-selected="${state.tab===value}">${appIcon(icon)}<span>${label}</span></button>`;
}

function kpiCard(icon,title,subtitle,body){
  return `
    <div class="kpiCard kpi-${escapeAttr(icon)}">
      <div class="kpiIcon" aria-hidden="true">${appIcon(icon)}</div>
      <div class="kpiContent">
        <div class="kpiLabel">${escapeHtml(title)}</div>
        ${body}
        <div class="kpiMeta">${escapeHtml(subtitle)}</div>
      </div>
    </div>
  `;
}

function appIcon(name){
  const common = `width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const paths = {
    list: `<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>`,
    cart: `<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6"/>`,
    layout: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 10h12"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>`,
    export: `<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>`,
    import: `<path d="M12 15V3M7 10l5 5 5-5"/><path d="M5 20h14"/>`,
    tag: `<path d="M20 13 13 20l-9-9V4h7Z"/><circle cx="8.5" cy="8.5" r="1"/>`,
    space: `<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>`,
  };
  return `<svg ${common}>${paths[name] || paths.list}</svg>`;
}

function mainPanel(tab, rows, groups, currency){
  if(tab==="settings") return settingsPanel();
  if(tab==="layout") return layoutPanel(rows, currency);
  if(tab==="ready") return readyPanel(rows, currency);
  return wishlistPanel(groups, currency);
}

function field(label, inner, hint=""){
  return `
    <label class="field">
      <div class="label"><span>${escapeHtml(label)}</span>${hint?`<span>${escapeHtml(hint)}</span>`:""}</div>
      ${inner}
    </label>
  `;
}

function countPlaced(itemId){
  return (state.layout.instances||[]).filter(x=>x.itemId===itemId).length;
}

function selectedOutletPanel(outlet){
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">Selected outlet/socket</div>
          <div class="h2">${escapeHtml(outlet.label||"Outlet")} — ${escapeHtml(outlet.voltage||"120V")}</div>
        </div>
        <button class="btn danger" data-action="removeOutlet" data-id="${outlet.id}">Remove</button>
      </div>
      <div class="bd">
        <div class="muted" style="font-size:12px;margin-bottom:8px;line-height:1.45;">
          <span style="font-weight:700;">Position</span> ${escapeHtml(formatFtIn(outletXTotalFt(outlet)))} × ${escapeHtml(formatFtIn(outletYTotalFt(outlet)))}
        </div>
        <div class="two">
          ${field("Label", `<input data-action="out_label" data-id="${outlet.id}" value="${escapeAttr(outlet.label||"")}" />`)}
          ${field("Voltage", `
            <select data-action="out_voltage" data-id="${outlet.id}">
              <option value="120V" ${outlet.voltage==="120V"?"selected":""}>120V (standard)</option>
              <option value="240V" ${outlet.voltage==="240V"?"selected":""}>240V (high power)</option>
              <option value="Any" ${outlet.voltage==="Any"?"selected":""}>Any</option>
            </select>
          `)}
          ${layoutFtInRow(layoutAxisLabel("X"), outlet.id, outlet.xFt, outlet.xIn ?? 0, "out_x_ft", "out_x_in", "out_x")}
          ${layoutFtInRow(layoutAxisLabel("Y"), outlet.id, outlet.yFt, outlet.yIn ?? 0, "out_y_ft", "out_y_in", "out_y")}
        </div>
        <div class="muted" style="font-size:12px;margin-top:10px;">
          Place outlets where your wall sockets are. Powered equipment (like treadmills) will warn if they're too far from a matching outlet.
          Max cord length is set in Settings (currently ${round1(safeNum(state.settings.maxCordLengthFt))} ft).
        </div>
      </div>
    </div>
  `;
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",()=>render({immediate:true}),{once:true});
}else{
  render({immediate:true});
}
