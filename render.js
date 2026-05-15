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
  const currency = state.settings.currency || "USD";

  const app = $("#app");
  app.innerHTML = `
    <div class="container">
      <div class="row">
        <div>
          <div class="title">Gym Wishlist + Layout Planner</div>
          <div class="subtitle">Offline planner. Tracks totals, dimensions, layout with outlets, ceiling zones, and floor zones.</div>
        </div>
        <div class="row" style="justify-content:flex-end;">
          <div class="tabs" role="tablist">
            ${tabBtn("wishlist","Wishlist")}
            ${tabBtn("ready","Ready to Buy")}
            ${tabBtn("layout","Layout")}
            ${tabBtn("settings","Settings")}
          </div>
          <button class="btn" id="exportBtn">Export</button>
          <label class="btn" style="cursor:pointer;">
            Import <input type="file" id="importFile" accept="application/json,.json,text/html,.html,.htm" style="display:none;" />
          </label>
        </div>
      </div>

      <div class="gridcards">
        ${kpiCard("Ready-to-buy total","Sum of items with Status = Ready to Buy", `<div class="big">${money(readyTotal,currency)}</div>`, `<span class="pill">${rows.filter(x=>x.status==="Ready to Buy").length} items</span>`)}
        ${kpiCard("Planned total","All items (Price×Qty + Fees)", `<div class="big">${money(planTotal,currency)}</div>`)}
        ${kpiCard("Room", `${round1(r.L)} ft × ${round1(r.W)} ft`, `<div class="big">${round1(r.area)} sq ft</div><div class="muted" style="font-size:12px;margin-top:6px;">Default deadspace: ${round1(r.clearance)} ft</div>`)}
        ${kpiCard("Reserved","Walkways / doors / no-go / cutouts", `<div class="big">${round1(reserved)} sq ft</div><div class="muted" style="font-size:12px;margin-top:6px;">Usable: ${round1(usable)} sq ft</div>`)}
        ${kpiCard("Area estimate","Effective footprints × qty (rough)", `<div style="font-size:13px;"><div>Used: <b>${round1(usedEst)}</b> sq ft</div><div style="margin-top:6px;">Remaining: <b style="${remainEst<0?'color:#be123c;':''}">${round1(remainEst)}</b> sq ft</div></div>`, `<span class="pill">${remainEst<0?'Over':'OK'}</span>`)}
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
          <div class="muted" style="margin-top:6px;font-size:13px;">Choose what you want to download.</div>

          <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px;">
            ${[
              { id: "full", title: "Full backup", desc: "Everything in one file, including all wishlist items and layouts." },
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

function tabBtn(value,label){
  const active = state.tab===value ? "active" : "";
  return `<button class="tab ${active}" data-tab="${value}">${label}</button>`;
}

function kpiCard(title,subtitle,body,right=""){
  return `
    <div class="card">
      <div class="hd">
        <div>
          <div class="h1">${escapeHtml(title)}</div>
          <div class="h2">${escapeHtml(subtitle)}</div>
        </div>
        <div>${right||""}</div>
      </div>
      <div class="bd">${body}</div>
    </div>
  `;
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

document.addEventListener('DOMContentLoaded', function() {
  render({immediate:true});
});
