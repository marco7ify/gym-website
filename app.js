// Gym Wishlist + Layout Planner - Main Application Logic
// Utilities
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const uid = (p="id") => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
const safeNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const round1 = (n) => Math.round(safeNum(n)*10)/10;

/** Resize image file to a JPEG data URL for offline storage (localStorage-safe size). */
function compressImageFileToDataUrl(file, maxSide = 520, jpegQuality = 0.82){
  return new Promise((resolve, reject)=>{
    if(!file || !String(file.type||"").startsWith("image/")){
      reject(new Error("Choose an image file (JPEG, PNG, WebP, or GIF)."));
      return;
    }
    const fr = new FileReader();
    fr.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        try{
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if(!w || !h){ reject(new Error("Invalid image dimensions.")); return; }
          const scale = Math.min(1, maxSide / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          if(!ctx){ reject(new Error("Canvas not available.")); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const url = c.toDataURL("image/jpeg", jpegQuality);
          if(url.length > 480000){
            const c2 = document.createElement("canvas");
            const w2 = Math.max(1, Math.round(w * 0.75)), h2 = Math.max(1, Math.round(h * 0.75));
            c2.width = w2;
            c2.height = h2;
            const ctx2 = c2.getContext("2d");
            if(!ctx2){ resolve(url); return; }
            ctx2.drawImage(c, 0, 0, w2, h2);
            resolve(c2.toDataURL("image/jpeg", Math.min(0.72, jpegQuality)));
            return;
          }
          resolve(url);
        }catch(err){ reject(err); }
      };
      img.onerror = ()=> reject(new Error("Could not decode image."));
      img.src = fr.result;
    };
    fr.onerror = ()=> reject(new Error("Could not read file."));
    fr.readAsDataURL(file);
  });
}

/** Fetch() header values must be ISO-8859-1; strip other code units (ZWSP, smart quotes, etc. from pasted keys). */
function headerValueLatin1(s){
  let out = "";
  const str = String(s ?? "");
  for(let i = 0; i < str.length; i++){
    const c = str.charCodeAt(i);
    if(c <= 0xff) out += str.charAt(i);
  }
  return out;
}

// Wishlist item categories (Layout “My Equipment” uses the same set, plus “All” in the filter row)
const EQUIPMENT_CATEGORIES = [
  "Racks & Cages",
  "Rack Attachments",
  "Benches",
  "Barbells & Specialty Bars",
  "Dumbbells",
  "Kettlebells",
  "Weight Plates",
  "Cable & Functional",
  "Selectorized Upper",
  "Selectorized Lower",
  "Plate-Loaded Upper",
  "Plate-Loaded Lower",
  "Smith & All-in-One",
  "Strongman",
  "Cardio & Conditioning",
  "Bodyweight & Mobility",
  "Sauna",
  "Cold Plunge",
  "Storage",
  "Platforms",
  "Accessories",
  "Custom",
];
const DEFAULT_CATEGORIES = EQUIPMENT_CATEGORIES;
const STATUSES = ["Researching","Shortlist","Ready to Buy","Ordered","Delivered","Installed","Returned/Cancelled"];
const PRIORITIES = ["Must-have","Nice-to-have","Later"];
const DEFAULT_WISHLIST_COLUMNS = ["dimensions","power","ceiling","total","maxFit"];
const WISHLIST_SORT_OPTIONS = [
  { value: "dateAdded", label: "Date added" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "brand", label: "Brand / Company" },
  { value: "availableExercises", label: "Available exercises" },
  { value: "availablePerSqft", label: "Available exercises / sq ft" },
  { value: "price", label: "Price" },
  { value: "totalExercises", label: "Total exercises" },
  { value: "totalExercisesPerSqft", label: "Total Exercises / sq ft" },
  { value: "maxExByBodyPart", label: "Most exercises by body part" },
];

const WISHLIST_GROUP_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "brand",    label: "Brand / Company" },
];
const DEFAULT_COMPARE_PROMPT = `Compare these gym equipment items side-by-side. Consider price, dimensions, power requirements, ceiling clearance, rack specs, and key details from the notes. Return ONLY an HTML table (no markdown fences) with items as columns and attributes as rows, using inline styles for borders (style="border:1px solid #e2e8f0; padding:8px; text-align:left;"). Then add a short <p> recommendation paragraph highlighting the best choice and key trade-offs.`;

const AREA_KINDS = [
  { value:"walkway", label:"Walkway", cls:"areaWalk" },
  { value:"door", label:"Door", cls:"areaDoor" },
  { value:"garagedoor", label:"Garage door", cls:"areaGarage" },
  { value:"nogospace", label:"No-go", cls:"areaNoGo" },
  { value:"cutout", label:"Cutout", cls:"areaCut" },
];
const kindMeta = (k)=> AREA_KINDS.find(x=>x.value===k) || AREA_KINDS[0];

const DEADSPACE_SIDES = [
  { value:"left", label:"Left" },
  { value:"right", label:"Right" },
  { value:"top", label:"Top" },
  { value:"bottom", label:"Bottom" },
];

const WALL_SIDES = [
  { value:"right", label:"Right wall →" },
  { value:"left", label:"Left wall ←" },
  { value:"bottom", label:"Bottom wall ↓" },
  { value:"top", label:"Top wall ↑" },
];

function toFeet(v, unit){
  const n = safeNum(v);
  if(n<=0) return 0;
  if(unit==="in") return n/12;
  if(unit==="cm") return n/30.48;
  return n;
}

/** Layout sidebar / selection panels: show positions in ft or inches (storage always feet). */
function layoutEditorUnit(){
  return state.settings?.layoutEditorUnit === "in" ? "in" : "ft";
}
function layoutAxisLabel(name){
  const u = layoutEditorUnit();
  return `${name} (${u==="in" ? "in" : "ft"})`;
}
function layoutFtToDisplay(ft){
  if(layoutEditorUnit()==="in"){
    return Math.round(safeNum(ft)*12*100)/100;
  }
  return round1(ft);
}
function layoutDisplayToFt(v){
  if(layoutEditorUnit()==="in") return safeNum(v)/12;
  return safeNum(v);
}
function layoutEditorFineStepAttr(){
  return layoutEditorUnit()==="in" ? "1" : "0.1";
}
function layoutEditorCoarseStepAttr(){
  return layoutEditorUnit()==="in" ? "6" : "0.5";
}
function layoutEditorMinDimAttr(){
  return layoutEditorUnit()==="in" ? "6" : "0.5";
}

/** Room + default ceiling in Settings: feet plus optional extra inches (stored separately). */
function settingsRoomLengthTotalFt(s){
  const x = s || state.settings;
  return Math.max(0, safeNum(x.roomLengthFt) + safeNum(x.roomLengthIn)/12);
}
function settingsRoomWidthTotalFt(s){
  const x = s || state.settings;
  return Math.max(0, safeNum(x.roomWidthFt) + safeNum(x.roomWidthIn)/12);
}
function settingsCeilingHeightTotalFt(s){
  const x = s || state.settings;
  return Math.max(0, safeNum(x.ceilingHeightFt) + safeNum(x.ceilingHeightIn)/12);
}
function settingsClearanceTotalFt(s){
  const x = s || state.settings;
  return Math.max(0, safeNum(x.clearanceFt) + safeNum(x.clearanceIn)/12);
}

function feetToFeetInches(ft){
  const totalIn = Math.round(safeNum(ft)*12);
  const feet = Math.floor(totalIn/12);
  const inches = Math.abs(totalIn%12);
  return {feet, inches};
}

function formatFtIn(ft){
  const {feet, inches} = feetToFeetInches(ft);
  return `${feet}′${inches}″`;
}

/** Split a total-feet value (may be negative for wall extensions) into integer ft + inch. */
function splitTotalFtToFtIn(totalFt){
  const t = safeNum(totalFt);
  let ft = Math.floor(t + 1e-9);
  let inch = (t - ft) * 12;
  if(inch < 1e-6) inch = 0;
  inch = Math.round(inch * 100) / 100;
  if(inch >= 12 - 1e-6){ inch = 0; ft += 1; }
  return { ft, inch };
}

function formatDimsDual(aFt, bFt){
  if(!aFt || !bFt) return "—";
  return `${formatFtIn(aFt)}×${formatFtIn(bFt)} (${round1(aFt)}×${round1(bFt)} ft)`;
}

function money(n, currency="USD"){
  const v = safeNum(n);
  try { return v.toLocaleString(undefined, {style:"currency", currency}); }
  catch { return `$${v.toFixed(2)}`; }
}

function decisionScore(item){
  const fit = clamp(safeNum(item.fitScore),0,10);
  const qual = clamp(safeNum(item.qualityScore),0,10);
  const val = clamp(safeNum(item.valueScore),0,10);
  return round1(fit*0.4 + qual*0.3 + val*0.3);
}

function totalCost(item){
  const qty = Math.max(0, Math.floor(safeNum(item.qty)));
  return safeNum(item.price)*qty + safeNum(item.fees);
}

function footprint(item){
  const u = item.unit;
  const L = u==="ft" ? safeNum(item.length) + safeNum(item.lengthIn)/12 : toFeet(item.length, u);
  const W = u==="ft" ? safeNum(item.width) + safeNum(item.widthIn)/12 : toFeet(item.width, u);
  let H = 0;
  if(u==="ft"){
    const hFt = item.height==="" && item.heightIn==="" ? 0 : safeNum(item.height) + safeNum(item.heightIn)/12;
    H = hFt;
  }else{
    H = item.height==="" ? 0 : toFeet(item.height, u);
  }
  return {L, W, H, area: L*W};
}

function rectsOverlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clampRectToBounds(r, b){
  return {
    ...r,
    x: clamp(r.x, b.minX, Math.max(b.minX, b.maxX - r.w)),
    y: clamp(r.y, b.minY, Math.max(b.minY, b.maxY - r.h)),
  };
}

function pointInRoom(x, y, rects){
  const list = rects || (room().rects || []);
  for(const r of list){
    if(x >= r.x - 1e-9 && x <= r.x + r.w + 1e-9 && y >= r.y - 1e-9 && y <= r.y + r.h + 1e-9) return true;
  }
  return false;
}

function rectInsideRoom(rect){
  const r = room();
  const rs = r.validRects || r.rects;
  const x0=rect.x, y0=rect.y, x1=rect.x+rect.w, y1=rect.y+rect.h;
  const yBreaks=[y0,y1];
  for(const zone of rs){
    const top=zone.y, bottom=zone.y+zone.h;
    if(top>y0 && top<y1) yBreaks.push(top);
    if(bottom>y0 && bottom<y1) yBreaks.push(bottom);
  }
  yBreaks.sort((a,b)=>a-b);
  for(let i=0;i<yBreaks.length-1;i++){
    if(yBreaks[i+1]-yBreaks[i]<=1e-9) continue;
    const mid=(yBreaks[i]+yBreaks[i+1])/2;
    const spans=rs
      .filter(zone=>zone.y<=mid && zone.y+zone.h>=mid)
      .map(zone=>({start:Math.max(x0,zone.x),end:Math.min(x1,zone.x+zone.w)}))
      .filter(span=>span.end>=span.start)
      .sort((a,b)=>a.start-b.start);
    let covered=x0;
    for(const span of spans){
      if(span.start>covered+1e-9) return false;
      covered=Math.max(covered,span.end);
      if(covered>=x1-1e-9) break;
    }
    if(covered<x1-1e-9) return false;
  }
  return true;
}

function rectInsideRect(rect, container){
  if(!container) return false;
  const x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.w, y1 = rect.y + rect.h;
  const pts = [
    [x0,y0],[x1,y0],[x0,y1],[x1,y1],
    [(x0+x1)/2,y0],[(x0+x1)/2,y1],[x0,(y0+y1)/2],[x1,(y0+y1)/2],
    [(x0+x1)/2,(y0+y1)/2],
  ];
  for(const [x,y] of pts){
    if(x < container.x - 1e-9) return false;
    if(y < container.y - 1e-9) return false;
    if(x > container.x + container.w + 1e-9) return false;
    if(y > container.y + container.h + 1e-9) return false;
  }
  return true;
}

// Returns the currently active compare set (always returns a valid set;
// creates a default one if somehow missing).
function getActiveCompareSet(){
  const L = state.layout;
  if(!Array.isArray(L.compareSets) || !L.compareSets.length){
    L.compareSets = [{ id: uid("cmp"), name: "Default", items: [] }];
    L.activeCompareSetId = L.compareSets[0].id;
  }
  let set = L.compareSets.find(s=> s.id === L.activeCompareSetId);
  if(!set){
    set = L.compareSets[0];
    L.activeCompareSetId = set.id;
  }
  if(!Array.isArray(set.items)) set.items = [];
  return set;
}

// Convenience: item IDs in the active compare set.
function getActiveCompareItemIds(){
  return getActiveCompareSet().items.slice();
}

// Preset dimensions (width × extra height beyond room height) for the
// staging zone. The zone starts at the top of the room; larger presets both
// widen the zone and let it extend down past the bottom of the room so you
// can park more equipment during rearrangement.
const STAGING_SIZE_PRESETS = {
  small:  { w: 6,  extraH: 0  },
  medium: { w: 10, extraH: 0  },
  large:  { w: 14, extraH: 6  },
  xlarge: { w: 20, extraH: 14 },
};

function getStagingSize(){
  const k = state && state.layout && state.layout.stagingSize;
  return STAGING_SIZE_PRESETS[k] ? k : "small";
}

function layoutStagingRect(r){
  const rr = r || room();
  const b = rr.bounds;
  const gap = 0.75; // ft space between room and staging
  const preset = STAGING_SIZE_PRESETS[getStagingSize()] || STAGING_SIZE_PRESETS.small;
  const w = preset.w;
  const h = b.h + (preset.extraH || 0);
  return { id: "staging", isStaging: true, x: b.maxX + gap, y: b.minY, w, h };
}

// Returns geometry for the Compare zone drawn to the right of staging and
// the per-item rectangles positioned inside it at real-world scale.
// `entries` should be an array of { item, entry } where `entry.xFt/yFt`
// (if present) are saved offsets relative to the compare-zone origin that
// override the auto-stacked position. All sizes are in ft.
function layoutCompareLayout(r, entries){
  const rr = r || room();
  const staging = layoutStagingRect(rr);
  const gap = 0.75;
  const pad = 0.4; // inner padding from compare-zone edges
  const rowGap = 0.5; // vertical space between stacked compare items
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];

  // Footprints (honoring per-entry rotation) and split into auto-placed vs
  // manually-placed entries. Manually-placed entries (with saved xFt/yFt
  // from a drag) keep their exact position; auto entries wrap into multiple
  // columns so the compare zone stays roughly the same height as the room
  // and the overall SVG doesn't need to zoom way out to fit.
  const footprints = list.map(e=>{
    const fp = footprint(e.item);
    const rot = !!(e.entry && e.entry.rotated);
    return rot ? { L: fp.W, W: fp.L } : { L: fp.L, W: fp.W };
  });

  const headerH = 0.7; // "Compare" label strip at top
  const x = staging.x + staging.w + gap;
  const y = staging.y;

  // Target max inner height for auto-wrapping: keep it near the room height
  // (clamped to a sensible range) so the overall SVG aspect ratio stays
  // close to the room's, instead of becoming a tall narrow strip.
  const maxAutoH = Math.max(8, Math.min(rr.L * 1.05, Math.max(staging.h, rr.L)));

  // First pass: wrap auto items into columns.
  const autoCols = []; // [{w, items:[{idx, fp}]}], w is the widest item in the column
  let curCol = null;
  let curColH = headerH + pad; // reserve top header space in the first column
  let firstCol = true;
  list.forEach((e, i)=>{
    const hasSaved = (typeof e.entry?.xFt === "number") && (typeof e.entry?.yFt === "number");
    if(hasSaved) return; // saved items don't participate in auto wrap
    const fp = footprints[i];
    const thisRowH = fp.L + rowGap;
    // Start a new column if this item would overflow the max auto height.
    // Always allow at least one item per column so even huge items fit.
    if(!curCol || (curCol.items.length > 0 && (curColH + fp.L) > maxAutoH)){
      curCol = { items: [], w: 0 };
      autoCols.push(curCol);
      curColH = pad; // subsequent columns don't reserve header (header is only in first)
      if(firstCol){ firstCol = false; }
    }
    curCol.items.push({ idx: i, fp });
    if(fp.W > curCol.w) curCol.w = fp.W;
    curColH += thisRowH;
  });

  // Column widths: each column is at least 8 ft min or its widest item+pad,
  // so items don't look cramped. Columns are laid out left-to-right.
  const colMinW = 8;
  const colGap = 0.4;
  const colWidths = autoCols.map(c=> Math.max(colMinW, c.w + pad * 2));

  // Place each item.
  const placed = [];
  // First: auto items in their columns.
  let colX = x;
  autoCols.forEach((col, colIdx)=>{
    const colW = colWidths[colIdx];
    // First column reserves headerH at the top; later columns start at pad.
    let cursorY = y + (colIdx === 0 ? (headerH + pad) : pad);
    col.items.forEach(({ idx, fp })=>{
      const itemX = colX + (colW - fp.W) / 2;
      const itemY = cursorY;
      cursorY += fp.L + rowGap;
      placed.push({
        item: list[idx].item,
        entry: list[idx].entry,
        index: idx,
        x: itemX,
        y: itemY,
        w: fp.W,
        h: fp.L,
        L: fp.L,
        W: fp.W,
        autoPlaced: true,
      });
    });
    colX += colW + colGap;
  });
  // Then: saved (manually-dragged) items at their exact offsets.
  list.forEach((e, i)=>{
    const hasSaved = (typeof e.entry?.xFt === "number") && (typeof e.entry?.yFt === "number");
    if(!hasSaved) return;
    const fp = footprints[i];
    placed.push({
      item: e.item,
      entry: e.entry,
      index: i,
      x: x + e.entry.xFt,
      y: y + e.entry.yFt,
      w: fp.W,
      h: fp.L,
      L: fp.L,
      W: fp.W,
      autoPlaced: false,
    });
  });

  // Auto-column area width (sum of column widths + gaps). If there are no
  // auto items but there are saved items, fall back to a sensible default
  // width so the zone still looks reasonable.
  const autoAreaW = autoCols.length
    ? (colWidths.reduce((s,w)=> s+w, 0) + Math.max(0, autoCols.length - 1) * colGap)
    : 0;
  const defaultInnerW = Math.max(colMinW, autoAreaW);

  // Grow the zone rectangle to fit all items (saved or auto) plus padding.
  let maxRight = x + defaultInnerW;
  let maxBottom = y + Math.max(staging.h, maxAutoH);
  placed.forEach(p=>{
    if(p.x + p.w + pad > maxRight) maxRight = p.x + p.w + pad;
    if(p.y + p.h + pad > maxBottom) maxBottom = p.y + p.h + pad;
  });
  const innerW = Math.max(defaultInnerW, maxRight - x);
  const h = Math.max(staging.h, maxBottom - y);

  const zone = { id: "compare", isCompare: true, x, y, w: innerW, h };

  return { zone, placed, headerH, pad };
}

function rectsTouch(a,b){
  if(rectsOverlap(a,b)) return true;
  const eps = 1e-9;
  const ax1 = a.x + a.w, ay1 = a.y + a.h;
  const bx1 = b.x + b.w, by1 = b.y + b.h;
  const yOverlap = Math.min(ay1, by1) - Math.max(a.y, b.y);
  const xOverlap = Math.min(ax1, bx1) - Math.max(a.x, b.x);

  if(Math.abs(ax1 - b.x) < eps && yOverlap > 0) return true;
  if(Math.abs(bx1 - a.x) < eps && yOverlap > 0) return true;
  if(Math.abs(ay1 - b.y) < eps && xOverlap > 0) return true;
  if(Math.abs(by1 - a.y) < eps && xOverlap > 0) return true;

  return false;
}

// Storage
const LS = {
  tab: "gym_v4_tab",
  settings: "gym_v4_settings",
  categories: "gym_v4_categories",
  items: "gym_v4_items",
  layout: "gym_v4_layout",
  layouts: "gym_v4_layouts",
  activeLayoutId: "gym_v4_active_layout_id",
};

const DEFAULT_SETTINGS = {
  currency:"USD",
  roomLengthFt: 20,
  roomLengthIn: 0,
  roomWidthFt: 12,
  roomWidthIn: 0,
  clearanceFt: 2.5,
  clearanceIn: 0,
  defaultDeadspaceSides: ["left","right","top","bottom"],
  snapFt: 0.5,
  ceilingHeightFt: 9,
  ceilingHeightIn: 0,
  maxCordLengthFt: 8,
  flooringMode: "tiles",
  floorWastePct: 10,
  tileWidthIn: 24,
  tileLengthIn: 24,
  tilesPerBox: 6,
  rollWidthFt: 4,
  rollLengthFt: 25,
  aiProvider: "none",
  aiApiKey: "",
  wishlistVisibleColumns: DEFAULT_WISHLIST_COLUMNS.slice(),
  wishlistSort: "dateAdded",
  wishlistGroupBy: "category",
  flooringPrices: {},
  layoutEditorUnit: "ft",
  layoutDimOverlay: false,
  layoutGridContrast: 1, // 1=normal, 2=darker, 3=darkest
  reservedAreaKindsSubtractSpace: ["walkway", "door", "garagedoor", "nogospace", "cutout"],
  reservedAreaKindsBlockPlacement: ["walkway", "door", "garagedoor", "nogospace", "cutout"],
};

// Flooring types for visualization
const FLOORING_TYPES = [
  { id: "stall_mat_4x6", name: "Horse Stall Mat 4×6", widthFt: 4, lengthFt: 6, defaultPrice: 50, color: "rgba(30,30,30,.85)" },
  { id: "rolled_4x25", name: "Rolled Rubber 4×25", widthFt: 4, lengthFt: 25, defaultPrice: 200, color: "rgba(45,45,45,.80)" },
  { id: "rolled_4x50", name: "Rolled Rubber 4×50", widthFt: 4, lengthFt: 50, defaultPrice: 380, color: "rgba(40,40,40,.80)" },
];
const DEFAULT_FLOORING_PRICES = Object.fromEntries(FLOORING_TYPES.map(type=> [type.id, type.defaultPrice]));

const RACK_HOLE_PATTERNS = [
  { id: "3x3_11g_1in_2in", label: "3×3\" 11-gauge, 1\" holes, 2\" spacing", uprightSize: "3×3\"", gauge: "11", holeSize: "1\"", holeSpacing: "2\"" },
  { id: "3x3_11g_5_8in_1in", label: "3×3\" 11-gauge, ⅝\" holes, 1\" spacing (Westside)", uprightSize: "3×3\"", gauge: "11", holeSize: "⅝\"", holeSpacing: "1\"" },
  { id: "3x3_11g_1in_1in", label: "3×3\" 11-gauge, 1\" holes, 1\" spacing", uprightSize: "3×3\"", gauge: "11", holeSize: "1\"", holeSpacing: "1\"" },
  { id: "2x3_11g_1in_2in", label: "2×3\" 11-gauge, 1\" holes, 2\" spacing", uprightSize: "2×3\"", gauge: "11", holeSize: "1\"", holeSpacing: "2\"" },
  { id: "2x3_11g_5_8in_1in", label: "2×3\" 11-gauge, ⅝\" holes, 1\" spacing", uprightSize: "2×3\"", gauge: "11", holeSize: "⅝\"", holeSpacing: "1\"" },
  { id: "2x2_12g_1in_2in", label: "2×2\" 12-gauge, 1\" holes, 2\" spacing", uprightSize: "2×2\"", gauge: "12", holeSize: "1\"", holeSpacing: "2\"" },
  { id: "custom", label: "Custom / Other", uprightSize: "", gauge: "", holeSize: "", holeSpacing: "" },
];

// Equipment type/brand autocomplete list
const BRAND_LIST = [
  "AbMat", "Assault Fitness", "BandBell", "BeachBody Fitness", "Bells of Steel", "BenchBlokz", "Body-Solid", "Concept2",
  "Dezhou Shizhou Fitness Technology Co., Ltd.",
  "Dynasty Fitness", "EnergyFit", "Exponent Edge", "Force 6 Fitness", "Freak Athlete", "Ghost", "Kabuki Strength",
  "Legend Fitness", "LifeFitness", "Marcy", "Metallic Pro", "Muscle Driver", "Nautilus", "NordicTrack", "OneFitWill",
  "Pendulum", "Power Blocks", "PRx Performance", "Rogue Fitness", "Row Monolith", "Santa Monica", "Sorinex",
  "Stair Master", "Stenger", "Tech Strength", "TechnoGym", "TheraBody", "Titan Fitness", "True Fitness", "Valor Fitness",
  "VersaClimber", "Westside Barbell", "Whatafit", "Xmark Fitness", "Ybell", "Zerofitness",
];

// Equipment types for exercise coverage
const EQUIPMENT_TYPES = [
  "Barbell", "Bench", "Cable Machine", "Chest Press Machine", "Decline Bench", "Dip Station", "Dumbbells", "Ez Bar",
  "Functional Trainer", "Kettlebells", "Lat Pulldown Machine", "Leg Press", "Leg Curl Machine", "Pec Deck Machine",
  "Power Rack", "Pull-up Bar", "Rowing Machine", "Smith Machine", "T-Bar Row", "Weight Plates", "Landmine",
];

// Exercise database with equipment requirements
const EXERCISE_DATABASE = [
  // Chest
  { name: "Bench Press", bodyPart: "Chest", equipment: ["Barbell", "Bench", "Rack"], type: "Compound", primary: true },
  { name: "Incline Bench Press", bodyPart: "Chest", equipment: ["Barbell", "Incline Bench", "Rack"], type: "Compound", primary: true },
  { name: "Decline Bench Press", bodyPart: "Chest", equipment: ["Barbell", "Decline Bench", "Rack"], type: "Compound", primary: false },
  { name: "Dumbbell Bench Press", bodyPart: "Chest", equipment: ["Dumbbells", "Bench"], type: "Compound", primary: true },
  { name: "Dumbbell Flyes", bodyPart: "Chest", equipment: ["Dumbbells", "Bench"], type: "Isolation", primary: false },
  { name: "Cable Crossover", bodyPart: "Chest", equipment: ["Cable Machine", "Functional Trainer"], type: "Isolation", primary: false },
  { name: "Push-ups", bodyPart: "Chest", equipment: [], type: "Bodyweight", primary: true },
  { name: "Chest Dips", bodyPart: "Chest", equipment: ["Dip Station"], type: "Compound", primary: false },
  { name: "Machine Chest Press", bodyPart: "Chest", equipment: ["Chest Press Machine"], type: "Machine", primary: false },
  { name: "Pec Deck", bodyPart: "Chest", equipment: ["Pec Deck Machine"], type: "Isolation", primary: false },
  
  // Back
  { name: "Deadlift", bodyPart: "Back", equipment: ["Barbell", "Weight Plates"], type: "Compound", primary: true },
  { name: "Barbell Row", bodyPart: "Back", equipment: ["Barbell"], type: "Compound", primary: true },
  { name: "Pull-ups", bodyPart: "Back", equipment: ["Pull-up Bar"], type: "Bodyweight", primary: true },
  { name: "Lat Pulldown", bodyPart: "Back", equipment: ["Lat Pulldown Machine", "Cable Machine"], type: "Compound", primary: true },
  { name: "Seated Cable Row", bodyPart: "Back", equipment: ["Cable Machine", "Row Handle"], type: "Compound", primary: true },
  { name: "Dumbbell Row", bodyPart: "Back", equipment: ["Dumbbells", "Bench"], type: "Compound", primary: true },
  { name: "T-Bar Row", bodyPart: "Back", equipment: ["T-Bar Row", "Landmine"], type: "Compound", primary: false },
  { name: "Face Pulls", bodyPart: "Back", equipment: ["Cable Machine", "Rope Attachment"], type: "Isolation", primary: false },
  { name: "Chin-ups", bodyPart: "Back", equipment: ["Pull-up Bar"], type: "Bodyweight", primary: true },
  { name: "Rack Pulls", bodyPart: "Back", equipment: ["Barbell", "Rack"], type: "Compound", primary: false },
  
  // Shoulders
  { name: "Overhead Press", bodyPart: "Shoulders", equipment: ["Barbell", "Rack"], type: "Compound", primary: true },
  { name: "Dumbbell Shoulder Press", bodyPart: "Shoulders", equipment: ["Dumbbells", "Bench"], type: "Compound", primary: true },
  { name: "Lateral Raises", bodyPart: "Shoulders", equipment: ["Dumbbells"], type: "Isolation", primary: true },
  { name: "Front Raises", bodyPart: "Shoulders", equipment: ["Dumbbells"], type: "Isolation", primary: false },
  { name: "Rear Delt Flyes", bodyPart: "Shoulders", equipment: ["Dumbbells", "Bench"], type: "Isolation", primary: false },
  { name: "Arnold Press", bodyPart: "Shoulders", equipment: ["Dumbbells"], type: "Compound", primary: false },
  { name: "Upright Row", bodyPart: "Shoulders", equipment: ["Barbell", "Dumbbells"], type: "Compound", primary: false },
  { name: "Cable Lateral Raise", bodyPart: "Shoulders", equipment: ["Cable Machine"], type: "Isolation", primary: false },
  { name: "Machine Shoulder Press", bodyPart: "Shoulders", equipment: ["Shoulder Press Machine"], type: "Machine", primary: false },
  { name: "Shrugs", bodyPart: "Shoulders", equipment: ["Barbell", "Dumbbells"], type: "Isolation", primary: false },
  
  // Arms - Biceps
  { name: "Barbell Curl", bodyPart: "Biceps", equipment: ["Barbell", "EZ Bar"], type: "Isolation", primary: true },
  { name: "Dumbbell Curl", bodyPart: "Biceps", equipment: ["Dumbbells"], type: "Isolation", primary: true },
  { name: "Hammer Curl", bodyPart: "Biceps", equipment: ["Dumbbells"], type: "Isolation", primary: true },
  { name: "Preacher Curl", bodyPart: "Biceps", equipment: ["EZ Bar", "Preacher Bench"], type: "Isolation", primary: false },
  { name: "Concentration Curl", bodyPart: "Biceps", equipment: ["Dumbbells"], type: "Isolation", primary: false },
  { name: "Cable Curl", bodyPart: "Biceps", equipment: ["Cable Machine"], type: "Isolation", primary: false },
  { name: "Incline Dumbbell Curl", bodyPart: "Biceps", equipment: ["Dumbbells", "Incline Bench"], type: "Isolation", primary: false },
  
  // Arms - Triceps
  { name: "Tricep Pushdown", bodyPart: "Triceps", equipment: ["Cable Machine"], type: "Isolation", primary: true },
  { name: "Skull Crushers", bodyPart: "Triceps", equipment: ["EZ Bar", "Bench"], type: "Isolation", primary: true },
  { name: "Overhead Tricep Extension", bodyPart: "Triceps", equipment: ["Dumbbells", "Cable Machine"], type: "Isolation", primary: true },
  { name: "Close-Grip Bench Press", bodyPart: "Triceps", equipment: ["Barbell", "Bench", "Rack"], type: "Compound", primary: false },
  { name: "Tricep Dips", bodyPart: "Triceps", equipment: ["Dip Station"], type: "Bodyweight", primary: true },
  { name: "Diamond Push-ups", bodyPart: "Triceps", equipment: [], type: "Bodyweight", primary: false },
  { name: "Rope Pushdown", bodyPart: "Triceps", equipment: ["Cable Machine", "Rope Attachment"], type: "Isolation", primary: false },
  
  // Legs - Quads
  { name: "Squat", bodyPart: "Quads", equipment: ["Barbell", "Rack"], type: "Compound", primary: true },
  { name: "Front Squat", bodyPart: "Quads", equipment: ["Barbell", "Rack"], type: "Compound", primary: true },
  { name: "Leg Press", bodyPart: "Quads", equipment: ["Leg Press Machine"], type: "Compound", primary: true },
  { name: "Leg Extension", bodyPart: "Quads", equipment: ["Leg Extension Machine"], type: "Isolation", primary: false },
  { name: "Lunges", bodyPart: "Quads", equipment: ["Dumbbells", "Barbell"], type: "Compound", primary: true },
  { name: "Bulgarian Split Squat", bodyPart: "Quads", equipment: ["Dumbbells", "Bench"], type: "Compound", primary: false },
  { name: "Hack Squat", bodyPart: "Quads", equipment: ["Hack Squat Machine"], type: "Compound", primary: false },
  { name: "Goblet Squat", bodyPart: "Quads", equipment: ["Dumbbell", "Kettlebell"], type: "Compound", primary: true },
  { name: "Step-ups", bodyPart: "Quads", equipment: ["Dumbbells", "Plyo Box"], type: "Compound", primary: false },
  
  // Legs - Hamstrings
  { name: "Romanian Deadlift", bodyPart: "Hamstrings", equipment: ["Barbell", "Dumbbells"], type: "Compound", primary: true },
  { name: "Leg Curl", bodyPart: "Hamstrings", equipment: ["Leg Curl Machine"], type: "Isolation", primary: true },
  { name: "Stiff-Leg Deadlift", bodyPart: "Hamstrings", equipment: ["Barbell"], type: "Compound", primary: false },
  { name: "Good Mornings", bodyPart: "Hamstrings", equipment: ["Barbell", "Rack"], type: "Compound", primary: false },
  { name: "Nordic Curl", bodyPart: "Hamstrings", equipment: ["Nordic Curl Bench"], type: "Bodyweight", primary: false },
  { name: "Glute-Ham Raise", bodyPart: "Hamstrings", equipment: ["GHD Machine"], type: "Compound", primary: false },
  
  // Legs - Glutes
  { name: "Hip Thrust", bodyPart: "Glutes", equipment: ["Barbell", "Bench"], type: "Compound", primary: true },
  { name: "Cable Kickback", bodyPart: "Glutes", equipment: ["Cable Machine"], type: "Isolation", primary: false },
  { name: "Glute Bridge", bodyPart: "Glutes", equipment: [], type: "Bodyweight", primary: true },
  { name: "Sumo Deadlift", bodyPart: "Glutes", equipment: ["Barbell"], type: "Compound", primary: false },
  
  // Legs - Calves
  { name: "Standing Calf Raise", bodyPart: "Calves", equipment: ["Calf Raise Machine", "Smith Machine"], type: "Isolation", primary: true },
  { name: "Seated Calf Raise", bodyPart: "Calves", equipment: ["Seated Calf Machine"], type: "Isolation", primary: true },
  { name: "Donkey Calf Raise", bodyPart: "Calves", equipment: ["Donkey Calf Machine"], type: "Isolation", primary: false },
  
  // Core
  { name: "Plank", bodyPart: "Core", equipment: [], type: "Bodyweight", primary: true },
  { name: "Hanging Leg Raise", bodyPart: "Core", equipment: ["Pull-up Bar"], type: "Bodyweight", primary: true },
  { name: "Cable Crunch", bodyPart: "Core", equipment: ["Cable Machine"], type: "Isolation", primary: false },
  { name: "Ab Wheel Rollout", bodyPart: "Core", equipment: ["Ab Wheel"], type: "Bodyweight", primary: false },
  { name: "Russian Twist", bodyPart: "Core", equipment: ["Medicine Ball"], type: "Bodyweight", primary: false },
  { name: "Decline Sit-ups", bodyPart: "Core", equipment: ["Decline Bench"], type: "Bodyweight", primary: false },
  { name: "Pallof Press", bodyPart: "Core", equipment: ["Cable Machine"], type: "Isolation", primary: false },
  { name: "Dead Bug", bodyPart: "Core", equipment: [], type: "Bodyweight", primary: true },
  
  // Cardio
  { name: "Treadmill Running", bodyPart: "Cardio", equipment: ["Treadmill"], type: "Cardio", primary: true },
  { name: "Rowing", bodyPart: "Cardio", equipment: ["Rowing Machine", "Concept2"], type: "Cardio", primary: true },
  { name: "Cycling", bodyPart: "Cardio", equipment: ["Stationary Bike", "Spin Bike", "Air Bike"], type: "Cardio", primary: true },
  { name: "Elliptical", bodyPart: "Cardio", equipment: ["Elliptical Machine"], type: "Cardio", primary: true },
  { name: "Stair Climbing", bodyPart: "Cardio", equipment: ["Stair Climber", "StairMaster"], type: "Cardio", primary: false },
  { name: "Jump Rope", bodyPart: "Cardio", equipment: ["Jump Rope"], type: "Cardio", primary: true },
  { name: "Battle Ropes", bodyPart: "Cardio", equipment: ["Battle Ropes"], type: "Cardio", primary: false },
  { name: "Ski Erg", bodyPart: "Cardio", equipment: ["Ski Erg"], type: "Cardio", primary: false },
];

const BODY_PARTS = ["All", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio"];
const EXERCISE_TYPES = ["All", "Compound", "Isolation", "Bodyweight", "Machine", "Cardio"];

// Simple body-part tags for wishlist items
const ITEM_BODY_PART_TAGS = ["Upper Body", "Lower Body", "Back", "Chest", "Shoulders", "Arms", "Legs", "Glutes", "Core", "Cardio", "Full Body"];

// Maps each item body-part tag to which exercise body parts it covers
const BODY_PART_TAG_MAP = {
  "Upper Body":  ["Chest", "Back", "Shoulders", "Biceps", "Triceps"],
  "Lower Body":  ["Quads", "Hamstrings", "Glutes", "Calves"],
  "Back":        ["Back"],
  "Chest":       ["Chest"],
  "Shoulders":   ["Shoulders"],
  "Arms":        ["Biceps", "Triceps"],
  "Legs":        ["Quads", "Hamstrings", "Calves"],
  "Glutes":      ["Glutes"],
  "Core":        ["Core"],
  "Cardio":      ["Cardio"],
  "Full Body":   ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio"],
};

const MODEL3D_FAMILIES = [
  {value:"auto", label:"Auto-detect from equipment"},
  {value:"smith-cable", label:"Smith / cable machine"},
  {value:"pulley-tower", label:"Pulley tower"},
  {value:"leg-press", label:"Leg press / hack squat"},
  {value:"rowing-machine", label:"Row / rowing machine"},
  {value:"adductor", label:"Adductor / abductor"},
  {value:"treadmill", label:"Treadmill"},
  {value:"stair-climber", label:"Stair climber"},
  {value:"bike", label:"Exercise bike"},
  {value:"bench", label:"Adjustable bench"},
  {value:"storage-rack", label:"Dumbbell / storage rack"},
  {value:"strength-rack", label:"Strength rack / cage"},
  {value:"cold-plunge", label:"Cold plunge"},
  {value:"sauna", label:"Sauna"},
  {value:"general", label:"General selectorized machine"},
];

const MODEL3D_PROFILES = [
  {value:"auto", label:"Auto-match saved equipment"},
  {value:"standard", label:"Standard family model"},
  {value:"rx3-compact-smith", label:"Get RX'd RX3 Tornado Compact Smith"},
  {value:"compact-smith", label:"Compact dual-stack Smith"},
  {value:"commercial-stair", label:"Enclosed commercial stairmill"},
  {value:"selectorized-seated-row", label:"Selectorized seated row"},
  {value:"seated-standing-row", label:"Seated / standing row"},
  {value:"gazelle-pro", label:"RitFit Gazelle Pro 3-in-1"},
  {value:"sled-leg-press", label:"Incline leg press / hack squat"},
  {value:"incline-bench", label:"Adjustable incline bench"},
  {value:"step-in-plunge", label:"Step-in cold plunge"},
  {value:"maxwell-903bh", label:"Maxwell 903BH 3-person sauna"},
  {value:"infrared-sauna", label:"Glass-front infrared sauna"},
  {value:"three-tier-rack", label:"Three-tier dumbbell rack"},
  {value:"adductor-combo", label:"Combo adductor / abductor"},
  {value:"incline-treadmill", label:"Incline treadmill"},
  {value:"ice-barrel-500", label:"Ice Barrel 500"},
  {value:"syedee-stair-machine", label:"syedee Stair Machine"},
  {value:"nordictrack-x16", label:"NordicTrack X16 Treadmill"},
  {value:"ritfit-gator-bench", label:"RitFit GATOR adjustable bench"},
  {value:"brightway-hs08-row", label:"Brightway HS08 rowing machine"},
  {value:"shizhuo-seated-standing-row", label:"Shizhuo seated / standing row"},
  {value:"wanjia-combo-adductor", label:"Wanjia combo adductor / abductor"},
  {value:"yindun-three-tier-rack", label:"Yindun three-tier dumbbell rack"},
  {value:"rogue-echo-rower", label:"Rogue Echo Rower"},
];

const MODEL3D_PROFILE_FAMILY = {
  "rx3-compact-smith":"smith-cable",
  "compact-smith":"smith-cable",
  "commercial-stair":"stair-climber",
  "selectorized-seated-row":"rowing-machine",
  "seated-standing-row":"rowing-machine",
  "gazelle-pro":"leg-press",
  "sled-leg-press":"leg-press",
  "incline-bench":"bench",
  "step-in-plunge":"cold-plunge",
  "maxwell-903bh":"sauna",
  "infrared-sauna":"sauna",
  "three-tier-rack":"storage-rack",
  "adductor-combo":"adductor",
  "incline-treadmill":"treadmill",
  "ice-barrel-500":"cold-plunge",
  "syedee-stair-machine":"stair-climber",
  "nordictrack-x16":"treadmill",
  "ritfit-gator-bench":"bench",
  "brightway-hs08-row":"rowing-machine",
  "shizhuo-seated-standing-row":"rowing-machine",
  "wanjia-combo-adductor":"adductor",
  "yindun-three-tier-rack":"storage-rack",
  "rogue-echo-rower":"rowing-machine",
};

const DEDICATED_MODEL_PROFILES = new Set([
  "ice-barrel-500",
  "syedee-stair-machine",
  "nordictrack-x16",
  "ritfit-gator-bench",
  "brightway-hs08-row",
  "shizhuo-seated-standing-row",
  "wanjia-combo-adductor",
  "yindun-three-tier-rack",
  "gazelle-pro",
  "maxwell-903bh",
  "rx3-compact-smith",
  "rogue-echo-rower",
]);

function inferEquipmentModelFamily(item){
  const text = `${item?.category||""} ${item?.name||""} ${item?.equipmentTypes||""}`.toLowerCase();
  if(/sauna/.test(text)) return "sauna";
  if(/ice barrel|cold plunge|plunge tub/.test(text)) return "cold-plunge";
  if(/stair|stepper|stairmill/.test(text)) return "stair-climber";
  if(/smith|functional trainer|cable crossover/.test(text)) return "smith-cable";
  if(/pulley tower|weight stack.*tower|single tower/.test(text)) return "pulley-tower";
  if(/leg press|hack squat/.test(text)) return "leg-press";
  if(/adductor|abductor/.test(text)) return "adductor";
  if(/rower|rowing|seated(?:\s*[-/]\s*|\s+)standing row|seated row|t.?bar.*row|linear row/.test(text)) return "rowing-machine";
  if(/treadmill/.test(text)) return "treadmill";
  if(/bike|cycle/.test(text)) return "bike";
  if(/bench/.test(text)) return "bench";
  if(/dumbbell|kettlebell|plate|storage|tree/.test(text)) return "storage-rack";
  if(/rack|rig|cage/.test(text)) return "strength-rack";
  return "general";
}

function equipmentModelFamily(item){
  const requested = String(item?.model3dFamily||"auto");
  return MODEL3D_FAMILIES.some(x=>x.value===requested && requested!=="auto")
    ? requested
    : inferEquipmentModelFamily(item);
}

function equipmentModelFamilyLabel(value){
  return MODEL3D_FAMILIES.find(x=>x.value===value)?.label || "General selectorized machine";
}

function normalizedEquipmentModelText(value){
  return String(value||"").toLowerCase().replace(/\s+/g," ").trim();
}

function canonicalEquipmentModelText(value){
  return String(value||"").normalize("NFKD").toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g,"-")
    .replace(/&/g," and ")
    .replace(/[/-]/g," ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ").trim();
}

function inferEquipmentModelProfile(item){
  const brand=normalizedEquipmentModelText(item?.brand);
  const name=normalizedEquipmentModelText(item?.name);
  const canonicalBrand=canonicalEquipmentModelText(item?.brand);
  const canonicalName=canonicalEquipmentModelText(item?.name);
  const text = `${brand} ${name} ${normalizedEquipmentModelText(item?.category)}`.trim();
  const exact=(expectedBrand,expectedName)=>canonicalBrand===expectedBrand && canonicalName===expectedName;
  const wanjiaDimensions=()=>{
    const fp=footprint(item);
    return Math.abs(fp.L-4.99)<=.02 && Math.abs(fp.W-2.38)<=.02 && Math.abs(fp.H-4.61)<=.02;
  };

  if(exact("ice barrel","ice barrel 500")) return "ice-barrel-500";
  if(exact("syedee","stair machine")) return "syedee-stair-machine";
  if(exact("nordictrack","x16 treadmill")) return "nordictrack-x16";
  if(exact("ritfit","ritfit gator 1600lb adjustable weight bench")) return "ritfit-gator-bench";
  if(exact("shandong brightway fitness","hs08 rowing machine")) return "brightway-hs08-row";
  if(exact("dezhou shizhuo fitness technology co ltd","seated standing row")) return "shizhuo-seated-standing-row";
  if(exact("shandong wanjia fitness equipment","combo adductor and abductor") && wanjiaDimensions()) return "wanjia-combo-adductor";
  if(exact("dezhou yindun seiko technology co ltd","three tier dumbbell rack")) return "yindun-three-tier-rack";
  if(exact("rogue fitness","rogue echo rower")) return "rogue-echo-rower";

  if(/rx3 tornado compact smith/.test(text)) return "rx3-compact-smith";
  if(/stair machine|stairmill|stair climber/.test(text)) return "commercial-stair";
  if(/hs08/.test(text)) return "selectorized-seated-row";
  if(/seated.?standing row/.test(text)) return "seated-standing-row";
  if(/gazelle pro/.test(text)) return "gazelle-pro";
  if(/leg press|hack squat/.test(text)) return "sled-leg-press";
  if(/gator.*bench|adjustable.*bench/.test(text)) return "incline-bench";
  if(/ice barrel 500|step.?in.*plunge/.test(text)) return "step-in-plunge";
  if(/maxwell.?903bh/.test(text)) return "maxwell-903bh";
  if(/maxwell.*sauna|infrared sauna/.test(text)) return "infrared-sauna";
  if(/three.?tier.*dumbbell/.test(text)) return "three-tier-rack";
  if(/combo adductor|adductor.*abductor|abductor.*adductor/.test(text)) return "adductor-combo";
  if(/x16 treadmill|incline treadmill/.test(text)) return "incline-treadmill";
  return "standard";
}

function equipmentModelProfile(item){
  const requested = String(item?.model3dProfile||"auto");
  const raw = MODEL3D_PROFILES.some(x=>x.value===requested && requested!=="auto")
    ? requested
    : inferEquipmentModelProfile(item);
  if(raw==="standard") return raw;
  return MODEL3D_PROFILE_FAMILY[raw]===equipmentModelFamily(item) ? raw : "standard";
}

function equipmentModelProfileLabel(value){
  return MODEL3D_PROFILES.find(x=>x.value===value)?.label || "Standard family model";
}

function equipmentModelVisualHeight(profile,fp,ceilingFt){
  const measured=Math.max(0,safeNum(fp?.H));
  const requested=profile==="rogue-echo-rower" ? Math.max(measured,3.25) : measured;
  return clamp(requested || 3.2,.45,Math.max(.6,safeNum(ceilingFt)+1.5));
}

function equipmentModelPresentation(profile,hasCustomAsset,fp){
  const longFaceProfile=!hasCustomAsset && [
    "maxwell-903bh","infrared-sauna","rx3-compact-smith","compact-smith",
    "three-tier-rack","yindun-three-tier-rack",
  ].includes(profile);
  return {
    longFaceProfile,
    modelBase:longFaceProfile
      ? {w:Math.max(.4,fp.L),h:Math.max(.4,fp.W)}
      : {w:Math.max(.4,fp.W),h:Math.max(.4,fp.L)},
    profileFacingRotation:profile==="maxwell-903bh" ? -Math.PI/2 : (longFaceProfile ? Math.PI/2 : 0),
  };
}

function itemUsesPhotoMatched3d(item){
  return !itemHasLocal3dModel(item) && DEDICATED_MODEL_PROFILES.has(equipmentModelProfile(item));
}

function equipmentModelProfilesForItem(item){
  const family=equipmentModelFamily(item);
  return MODEL3D_PROFILES.filter(x=>x.value==="auto" || x.value==="standard" || MODEL3D_PROFILE_FAMILY[x.value]===family);
}

function itemHasLocal3dModel(item){
  return String(item?.model3dAssetRef||"").startsWith("local:");
}

function formatFileSize(bytes){
  const value=Math.max(0,safeNum(bytes));
  if(!value) return "";
  if(value<1024) return `${Math.round(value)} B`;
  if(value<1024*1024) return `${round1(value/1024)} KB`;
  return `${round1(value/(1024*1024))} MB`;
}

const DEFAULT_ITEM = {
  id:"",
  name:"",
  brand:"",
  category:"Custom",
  status:"Researching",
  priority:"Nice-to-have",
  qty: 1,
  unit:"in",
  length:"",
  width:"",
  height:"",
  lengthIn:"",
  widthIn:"",
  heightIn:"",
  requiredCeilingFt:"",
  powerVoltage:"",
  powerAmps:"",
  outletNotes:"",
  price:"",
  fees:"",
  productLink:"",
  notes:"",
  rackHolePattern:"",
  rackCustomSpec:"",
  equipmentTags: [],
  // GymScape features
  isRack: false,
  rackPosts: "4-post",
  rackHeight: "",
  rackUprightSize: "",
  rackHoleDiameter: "",
  rackCrossmemberDepth: "",
  rackOutsideWidth: "",
  rackTotalLength: "",
  isRackAttachment: false,
  attachToRackId: "",
  storesEquipment: false,
  storageLength: "",
  storageWidth: "",
  storageHeight: "",
  equipmentTypes: [],
  color: "",
  /** data:image/jpeg;base64,... — optional layout thumbnail */
  layoutImageDataUrl: "",
  /** When true and layoutImageDataUrl is set, layout SVG shows the photo inside the footprint. */
  layoutUseImage: false,
  /** Parametric 3D shape. "auto" infers the closest family from the item name/category. */
  model3dFamily: "auto",
  /** Item-specific detail profile tuned from references and inferred from the saved item name. */
  model3dProfile: "auto",
  /** Reverse turns only the visual model 180°; the measured footprint and plan rotation stay unchanged. */
  model3dFacing: "default",
  /** IndexedDB reference to an optional user-supplied binary GLB model. */
  model3dAssetRef: "",
  model3dAssetName: "",
  model3dAssetSize: 0,
  model3dAssetUpdatedAt: 0,
  /** Quarter-turn applied to a custom GLB before it is fitted to the measured envelope. */
  model3dAssetRotation: 0,
};

function normalizeItemRecord(value){
  const source=value && typeof value==="object" ? value : {};
  const image=normalizeDataImageUrl(source.layoutImageDataUrl);
  const ref=/^local:[a-z0-9_-]+$/i.test(String(source.model3dAssetRef||""))
    ? String(source.model3dAssetRef)
    : "";
  const rotation=Number(source.model3dAssetRotation);
  return {
    ...DEFAULT_ITEM,
    ...source,
    layoutImageDataUrl:image,
    layoutUseImage:!!image || !!source.layoutUseImage,
    model3dFamily:MODEL3D_FAMILIES.some(x=>x.value===source.model3dFamily) ? source.model3dFamily : "auto",
    model3dProfile:MODEL3D_PROFILES.some(x=>x.value===source.model3dProfile) ? source.model3dProfile : "auto",
    model3dFacing:source.model3dFacing==="reverse" ? "reverse" : "default",
    model3dAssetRef:ref,
    model3dAssetName:ref ? String(source.model3dAssetName||"Local GLB").slice(0,180) : "",
    model3dAssetSize:ref ? Math.max(0,Number(source.model3dAssetSize)||0) : 0,
    model3dAssetUpdatedAt:ref ? Math.max(0,Number(source.model3dAssetUpdatedAt)||0) : 0,
    model3dAssetRotation:[0,90,180,270].includes(rotation) ? rotation : 0,
  };
}

const DEFAULT_LAYOUT = {
  instances: [],
  areas: [],
  outlets: [],
  wallExtensions: [],
  ceilingZones: [],
  floorZones: [],
  flooringPieces: [],
  wallFeatures: [],
  // Staging / parking zone size preset. Controls how wide (and sometimes
  // taller) the off-room staging strip is so you can park more equipment
  // there while rearranging. One of "small" | "medium" | "large" | "xlarge".
  stagingSize: "small",
  // Named compare sets for visual size comparison (shown stacked to the
  // right of the staging zone at real-world scale). Each set = { id, name,
  // items: [itemIds] }. Exactly one is always "active".
  compareSets: [],
  activeCompareSetId: null,
  // Legacy single compare list (kept for backward compat; auto-migrated to a
  // "Default" compareSet on load).
  compareItems: [],
  selectedInstId: null,
  selectedAreaId: null,
  selectedOutletId: null,
  selectedWallExtId: null,
  selectedCeilingZoneId: null,
  selectedFloorZoneId: null,
  selectedFlooringId: null,
  selectedWallFeatureId: null,
  // A single spatial state powers the plan, split, 3D, and walkthrough views.
  // Keeping these preferences with each saved layout makes switching layouts
  // feel predictable without changing the underlying placement data.
  spatialViewMode: "plan",
  spatial3d: {
    walls: true,
    ceiling: false,
    clearances: true,
    collisions: true,
    labels: false,
    labelMode: "selected",
    eyeHeightFt: 5.67,
    wallColor: "white",
    floorType: "rolled-rubber",
    fovDeg: 80,
  },
  walkthroughOpen: false,
};

function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{ return fallback; }
}

function saveJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){
    if(e && (e.name==="QuotaExceededError" || (e.message||"").toLowerCase().includes("quota"))){
      if(!saveJSON._warnedQuota){
        saveJSON._warnedQuota = true;
        setTimeout(()=> alert("Storage is full — some data (like images) may not persist after reload. Try removing unused items or re-importing with fewer images."), 50);
      }
    }
  }
}

function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }

function wallExtStartTotalFt(w){
  return Math.max(0, safeNum(w.startFt) + safeNum(w.startIn)/12);
}
function wallExtLengthTotalFt(w){
  return Math.max(0.5, safeNum(w.lengthFt) + safeNum(w.lengthIn)/12);
}
function wallExtDepthTotalFt(w){
  return Math.max(0.5, safeNum(w.depthFt) + safeNum(w.depthIn)/12);
}

/** Ceiling zone rectangle + clearance (ft + optional inch fields on the zone object). */
function ceilingZoneClearanceTotalFt(z){
  return Math.max(0, safeNum(z.ceilingHeightFt) + safeNum(z.ceilingHeightIn)/12);
}
function ceilingZoneXTotalFt(z){
  return safeNum(z.xFt) + safeNum(z.xIn)/12;
}
function ceilingZoneYTotalFt(z){
  return safeNum(z.yFt) + safeNum(z.yIn)/12;
}
function ceilingZoneWidthTotalFt(z){
  return Math.max(0.5, safeNum(z.widthFt) + safeNum(z.widthIn)/12);
}
function ceilingZoneDepthTotalFt(z){
  return Math.max(0.5, safeNum(z.heightFt) + safeNum(z.heightIn)/12);
}

function instXTotalFt(inst){
  return safeNum(inst.xFt) + safeNum(inst.xIn)/12;
}
function instYTotalFt(inst){
  return safeNum(inst.yFt) + safeNum(inst.yIn)/12;
}
function instHasDeadspaceOverride(inst){
  const ftEmpty = (inst.deadspaceFt===null || inst.deadspaceFt===undefined || inst.deadspaceFt==="");
  if(!ftEmpty) return true;
  return safeNum(inst.deadspaceIn) > 0;
}
function instDeadspaceOverrideTotalFt(inst){
  if(!instHasDeadspaceOverride(inst)) return null;
  const ftEmpty = (inst.deadspaceFt===null || inst.deadspaceFt===undefined || inst.deadspaceFt==="");
  const ft = ftEmpty ? 0 : safeNum(inst.deadspaceFt);
  return clamp(ft + safeNum(inst.deadspaceIn)/12, 0, 10);
}

function areaXTotalFt(a){
  return Math.max(0, safeNum(a.xFt) + safeNum(a.xIn)/12);
}
function areaYTotalFt(a){
  return Math.max(0, safeNum(a.yFt) + safeNum(a.yIn)/12);
}
function areaWidthTotalFt(a){
  return Math.max(0.5, safeNum(a.widthFt) + safeNum(a.widthIn)/12);
}
function areaHeightTotalFt(a){
  return Math.max(0.5, safeNum(a.heightFt) + safeNum(a.heightIn)/12);
}
function areaDoorRadiusTotalFt(a){
  const ftEmpty = (a.doorRadiusFt===null || a.doorRadiusFt===undefined || a.doorRadiusFt==="");
  const inV = Math.max(0, safeNum(a.doorRadiusIn));
  if(ftEmpty && inV <= 0) return null;
  const ft = ftEmpty ? 0 : safeNum(a.doorRadiusFt);
  return Math.max(0.5, ft + inV/12);
}

function outletXTotalFt(o){
  return safeNum(o.xFt) + safeNum(o.xIn)/12;
}
function outletYTotalFt(o){
  return safeNum(o.yFt) + safeNum(o.yIn)/12;
}

function floorZoneXTotalFt(z){
  return Math.max(0, safeNum(z.xFt) + safeNum(z.xIn)/12);
}
function floorZoneYTotalFt(z){
  return Math.max(0, safeNum(z.yFt) + safeNum(z.yIn)/12);
}
function floorZoneWidthTotalFt(z){
  return Math.max(0.5, safeNum(z.widthFt) + safeNum(z.widthIn)/12);
}
function floorZoneDepthTotalFt(z){
  return Math.max(0.5, safeNum(z.heightFt) + safeNum(z.heightIn)/12);
}

function flooringXTotalFt(p){
  return safeNum(p.xFt) + safeNum(p.xIn)/12;
}
function flooringYTotalFt(p){
  return safeNum(p.yFt) + safeNum(p.yIn)/12;
}

function wallExtToRect(ext, baseW, baseL){
  const start = wallExtStartTotalFt(ext);
  const length = wallExtLengthTotalFt(ext);
  const depth = wallExtDepthTotalFt(ext);

  switch(ext.wall){
    case "right":  return { x: baseW, y: start, w: depth, h: length };
    case "left":   return { x: -depth, y: start, w: depth, h: length };
    case "bottom": return { x: start, y: baseL, w: length, h: depth };
    case "top":    return { x: start, y: -depth, w: length, h: depth };
    default:       return { x: baseW, y: start, w: depth, h: length };
  }
}

function wallFeatureRoomData(layout, settings){
  const sourceSettings=settings && typeof settings==="object" ? settings : DEFAULT_SETTINGS;
  const W=settingsRoomWidthTotalFt(sourceSettings);
  const L=settingsRoomLengthTotalFt(sourceSettings);
  return {
    W,
    L,
    ceiling:settingsCeilingHeightTotalFt(sourceSettings),
    rects:[
      {x:0,y:0,w:W,h:L},
      ...(Array.isArray(layout?.wallExtensions) ? layout.wallExtensions : []).map(ext=>wallExtToRect(ext,W,L)),
    ],
  };
}

/**
 * Normalize persisted layout data. Pass `settingsForRoomMigration` whenever `state` may not
 * exist yet (e.g. while building initial `state`) so old `roomBlocks` migration does not
 * touch `state` (TDZ ReferenceError).
 */
function normalizeLayout(l, settingsForRoomMigration, {name="",items=[]}={}){
  const source=l&&typeof l==="object" ? l : {};
  const hadWallFeatures=Object.prototype.hasOwnProperty.call(source,"wallFeatures");
  const base = {...DEFAULT_LAYOUT, ...source};
  base.instances = Array.isArray(base.instances) ? base.instances : [];
  base.areas = Array.isArray(base.areas) ? base.areas : [];
  base.outlets = Array.isArray(base.outlets) ? base.outlets : [];
  base.wallExtensions = Array.isArray(base.wallExtensions) ? base.wallExtensions : [];
  base.ceilingZones = Array.isArray(base.ceilingZones) ? base.ceilingZones : [];
  base.floorZones = Array.isArray(base.floorZones) ? base.floorZones : [];
  base.flooringPieces = Array.isArray(base.flooringPieces) ? base.flooringPieces : [];
  base.wallFeatures = Array.isArray(base.wallFeatures) ? base.wallFeatures : [];
  base.garageWallRevision=Math.max(0,Math.floor(safeNum(base.garageWallRevision)));
  base.spatialViewMode = ["plan", "split", "3d"].includes(base.spatialViewMode) ? base.spatialViewMode : "plan";
  const sourceSpatial3d = base.spatial3d && typeof base.spatial3d === "object" ? base.spatial3d : {};
  base.spatial3d = {
    ...DEFAULT_LAYOUT.spatial3d,
    ...sourceSpatial3d,
  };
  base.spatial3d.labelMode = ["selected", "hover", "always", "off"].includes(sourceSpatial3d.labelMode)
    ? sourceSpatial3d.labelMode
    : (Object.prototype.hasOwnProperty.call(sourceSpatial3d, "labels") && sourceSpatial3d.labels === false ? "off" : "selected");
  base.spatial3d.labels = base.spatial3d.labelMode !== "off";
  base.spatial3d.eyeHeightFt = clamp(safeNum(base.spatial3d.eyeHeightFt) || 5.67, 4, 7);
  base.spatial3d.wallColor = ["white", "black"].includes(base.spatial3d.wallColor)
    ? base.spatial3d.wallColor
    : DEFAULT_LAYOUT.spatial3d.wallColor;
  base.spatial3d.floorType = ["rolled-rubber", "rubber-tiles", "concrete"].includes(base.spatial3d.floorType)
    ? base.spatial3d.floorType
    : DEFAULT_LAYOUT.spatial3d.floorType;
  base.spatial3d.fovDeg = clamp(Math.round(safeNum(base.spatial3d.fovDeg) || DEFAULT_LAYOUT.spatial3d.fovDeg), 55, 100);
  base.walkthroughOpen = false;
  base.compareItems = Array.isArray(base.compareItems)
    ? base.compareItems.map(x=> String(x)).filter(Boolean)
    : [];
  const STAGING_PRESETS = ["small", "medium", "large", "xlarge"];
  base.stagingSize = STAGING_PRESETS.includes(base.stagingSize) ? base.stagingSize : "small";
  // Normalize a single compare-set entry into {itemId, xFt?, yFt?}. Strings
  // (legacy format) become {itemId: <string>}. Entries without a saved
  // xFt/yFt are auto-positioned at render time.
  const normalizeCompareEntry = (x)=>{
    if(x == null) return null;
    if(typeof x === "string"){
      const s = x.trim();
      return s ? { itemId: s } : null;
    }
    if(typeof x === "object"){
      const id = String(x.itemId || x.id || "").trim();
      if(!id) return null;
      const out = { itemId: id };
      if(x.xFt !== undefined && x.xFt !== null && !Number.isNaN(Number(x.xFt))) out.xFt = Number(x.xFt);
      if(x.yFt !== undefined && x.yFt !== null && !Number.isNaN(Number(x.yFt))) out.yFt = Number(x.yFt);
      if(x.rotated) out.rotated = true;
      return out;
    }
    return null;
  };
  base.compareSets = Array.isArray(base.compareSets)
    ? base.compareSets
        .filter(s=> s && typeof s === "object")
        .map(s=> ({
          id: String(s.id || uid("cmp")),
          name: String(s.name || "Untitled").slice(0, 80),
          items: Array.isArray(s.items) ? s.items.map(normalizeCompareEntry).filter(Boolean) : [],
        }))
    : [];
  // Migrate legacy single compareItems into a "Default" set the first time.
  if(!base.compareSets.length && base.compareItems.length){
    base.compareSets = [{ id: uid("cmp"), name: "Default", items: base.compareItems.map(id=> ({ itemId: String(id) })) }];
  }
  // Ensure at least one set exists so the UI always has something to show.
  if(!base.compareSets.length){
    base.compareSets = [{ id: uid("cmp"), name: "Default", items: [] }];
  }
  // Ensure activeCompareSetId points at a real set.
  if(!base.activeCompareSetId || !base.compareSets.some(s=> s.id === base.activeCompareSetId)){
    base.activeCompareSetId = base.compareSets[0].id;
  }
  // compareItems is deprecated; keep empty to avoid drift.
  base.compareItems = [];

  // Migrate old roomBlocks to wallExtensions
  if(Array.isArray(base.roomBlocks) && base.roomBlocks.length && !base.wallExtensions.length){
    const s = settingsForRoomMigration || DEFAULT_SETTINGS;
    const baseW = settingsRoomWidthTotalFt(s);
    const baseL = settingsRoomLengthTotalFt(s);
    base.wallExtensions = base.roomBlocks.map(rb=>{
      const x = safeNum(rb.xFt), y = safeNum(rb.yFt);
      const w = Math.max(.5, safeNum(rb.widthFt)), h = Math.max(.5, safeNum(rb.heightFt));
      let wall = "right", startFt = y, lengthFt = h, depthFt = w;
      if(x >= baseW - 0.1){ wall = "right"; startFt = y; lengthFt = h; depthFt = w; }
      else if(x + w <= 0.1){ wall = "left"; startFt = y; lengthFt = h; depthFt = w; }
      else if(y >= baseL - 0.1){ wall = "bottom"; startFt = x; lengthFt = w; depthFt = h; }
      else if(y + h <= 0.1){ wall = "top"; startFt = x; lengthFt = w; depthFt = h; }
      return {
        id: rb.id || uid("we"),
        label: rb.label || "Extension",
        wall,
        startFt: Math.max(0, startFt),
        startIn: 0,
        lengthFt: Math.max(0.5, lengthFt),
        lengthIn: 0,
        depthFt: Math.max(0.5, depthFt),
        depthIn: 0,
      };
    });
  }
  delete base.roomBlocks;
  delete base.selectedRoomBlockId;

  base.selectedInstId = base.selectedInstId || null;
  base.selectedAreaId = base.selectedAreaId || null;
  base.selectedOutletId = base.selectedOutletId || null;
  base.selectedWallExtId = base.selectedWallExtId || null;
  base.selectedCeilingZoneId = base.selectedCeilingZoneId || null;
  base.selectedFloorZoneId = base.selectedFloorZoneId || null;
  base.selectedFlooringId = base.selectedFlooringId || null;

  base.instances = base.instances.map(x=>{
    const ftEmpty = (x.deadspaceFt===null || x.deadspaceFt===undefined || x.deadspaceFt==="");
    const inN = Math.max(0, safeNum(x.deadspaceIn));
    const hasOv = !ftEmpty || inN > 0;
    return {
      id: x.id || uid("inst"),
      itemId: x.itemId,
      xFt: safeNum(x.xFt),
      xIn: Math.max(0, safeNum(x.xIn)),
      yFt: safeNum(x.yFt),
      yIn: Math.max(0, safeNum(x.yIn)),
      rotated: !!x.rotated,
      deadspaceFt: hasOv ? (ftEmpty ? 0 : safeNum(x.deadspaceFt)) : null,
      deadspaceIn: hasOv ? inN : 0,
      deadspaceSides: Array.isArray(x.deadspaceSides) ? x.deadspaceSides : null,
      __invalid: !!x.__invalid,
    };
  });

  base.areas = base.areas.map(a=>{
    const o = {
      ...(a.kind==="garagedoor"?a:{}),
      id: a.id || uid("area"),
      kind: a.kind || "walkway",
      label: a.label || "",
      xFt: Math.max(0, safeNum(a.xFt)),
      xIn: Math.max(0, safeNum(a.xIn)),
      yFt: Math.max(0, safeNum(a.yFt)),
      yIn: Math.max(0, safeNum(a.yIn)),
      widthFt: Math.max(0, safeNum(a.widthFt) || 3),
      widthIn: Math.max(0, safeNum(a.widthIn)),
      heightFt: Math.max(0, safeNum(a.heightFt) || 3),
      heightIn: Math.max(0, safeNum(a.heightIn)),
      doorOrientation: a.doorOrientation || "auto",
      doorSwing: a.doorSwing || "down",
      doorHinge: a.doorHinge || "start",
      doorRadiusFt: (a.doorRadiusFt===null || a.doorRadiusFt===undefined || a.doorRadiusFt==="") ? null : safeNum(a.doorRadiusFt),
      doorRadiusIn: Math.max(0, safeNum(a.doorRadiusIn)),
      doorClearEnabled: (a.doorClearEnabled===undefined) ? true : !!a.doorClearEnabled,
      ...(typeof a.blocksPlacement==="boolean"?{blocksPlacement:a.blocksPlacement}:{}),
      ...(typeof a.subtractsSpace==="boolean"?{subtractsSpace:a.subtractsSpace}:{}),
    };
    if(typeof a.blocksPlacement!=="boolean") delete o.blocksPlacement;
    if(typeof a.subtractsSpace!=="boolean") delete o.subtractsSpace;
    const wRaw = safeNum(o.widthFt) + safeNum(o.widthIn)/12;
    const hRaw = safeNum(o.heightFt) + safeNum(o.heightIn)/12;
    if(wRaw < 0.5 - 1e-9){ o.widthFt = 3; o.widthIn = 0; }
    if(hRaw < 0.5 - 1e-9){ o.heightFt = 3; o.heightIn = 0; }
    const radFtEmpty = (o.doorRadiusFt===null || o.doorRadiusFt===undefined || o.doorRadiusFt==="");
    const radIn = safeNum(o.doorRadiusIn);
    if(radFtEmpty && radIn <= 0){
      o.doorRadiusFt = null;
      o.doorRadiusIn = 0;
    }else if(radFtEmpty){
      o.doorRadiusFt = 0;
    }
    if(o.kind==="garagedoor"){
      delete o.doorOrientation;
      delete o.doorSwing;
      delete o.doorHinge;
      delete o.doorRadiusFt;
      delete o.doorRadiusIn;
      delete o.doorClearEnabled;
    }
    return GymGarageDoors.normalizeArea(a,o);
  });

  base.outlets = base.outlets.map(o=>({
    id: o.id || uid("out"),
    label: o.label || "Outlet",
    xFt: safeNum(o.xFt),
    xIn: Math.max(0, safeNum(o.xIn)),
    yFt: safeNum(o.yFt),
    yIn: Math.max(0, safeNum(o.yIn)),
    voltage: o.voltage || "120V",
  }));

  base.wallExtensions = base.wallExtensions.map(w=>{
    const o = {
      id: w.id || uid("we"),
      label: w.label || "Extension",
      wall: (["left","right","top","bottom"].includes(w.wall)) ? w.wall : "right",
      startFt: Math.max(0, safeNum(w.startFt)),
      startIn: Math.max(0, safeNum(w.startIn)),
      lengthFt: Math.max(0, safeNum(w.lengthFt)),
      lengthIn: Math.max(0, safeNum(w.lengthIn)),
      depthFt: Math.max(0, safeNum(w.depthFt)),
      depthIn: Math.max(0, safeNum(w.depthIn)),
    };
    const lenRaw = safeNum(o.lengthFt) + safeNum(o.lengthIn)/12;
    const depRaw = safeNum(o.depthFt) + safeNum(o.depthIn)/12;
    if(lenRaw < 0.5 - 1e-9){ o.lengthFt = 4; o.lengthIn = 0; }
    if(depRaw < 0.5 - 1e-9){ o.depthFt = 3; o.depthIn = 0; }
    return o;
  });

  base.ceilingZones = base.ceilingZones.map(z=>{
    const o = {
      id: z.id || uid("cz"),
      label: z.label || "Low ceiling",
      xFt: Math.max(0, safeNum(z.xFt)),
      xIn: Math.max(0, safeNum(z.xIn)),
      yFt: Math.max(0, safeNum(z.yFt)),
      yIn: Math.max(0, safeNum(z.yIn)),
      widthFt: Math.max(0, safeNum(z.widthFt)),
      widthIn: Math.max(0, safeNum(z.widthIn)),
      heightFt: Math.max(0, safeNum(z.heightFt)),
      heightIn: Math.max(0, safeNum(z.heightIn)),
      ceilingHeightFt: Math.max(0, safeNum(z.ceilingHeightFt) || 7),
      ceilingHeightIn: Math.max(0, safeNum(z.ceilingHeightIn)),
    };
    const wRaw = safeNum(o.widthFt) + safeNum(o.widthIn)/12;
    const hRaw = safeNum(o.heightFt) + safeNum(o.heightIn)/12;
    if(wRaw < 0.5 - 1e-9){ o.widthFt = 4; o.widthIn = 0; }
    if(hRaw < 0.5 - 1e-9){ o.heightFt = 4; o.heightIn = 0; }
    return o;
  });

  base.floorZones = base.floorZones.map(z=>{
    const o = {
      id: z.id || uid("fz"),
      label: z.label || "Elevated floor",
      xFt: Math.max(0, safeNum(z.xFt)),
      xIn: Math.max(0, safeNum(z.xIn)),
      yFt: Math.max(0, safeNum(z.yFt)),
      yIn: Math.max(0, safeNum(z.yIn)),
      widthFt: Math.max(0, safeNum(z.widthFt) || 4),
      widthIn: Math.max(0, safeNum(z.widthIn)),
      heightFt: Math.max(0, safeNum(z.heightFt) || 4),
      heightIn: Math.max(0, safeNum(z.heightIn)),
      elevationIn: Math.max(0, safeNum(z.elevationIn) || 4),
    };
    const wRaw = safeNum(o.widthFt) + safeNum(o.widthIn)/12;
    const hRaw = safeNum(o.heightFt) + safeNum(o.heightIn)/12;
    if(wRaw < 0.5 - 1e-9){ o.widthFt = 4; o.widthIn = 0; }
    if(hRaw < 0.5 - 1e-9){ o.heightFt = 4; o.heightIn = 0; }
    return o;
  });

  base.flooringPieces = base.flooringPieces.map(f=>({
    id: f.id || uid("floor"),
    typeId: f.typeId || "stall_mat_4x6",
    label: f.label || "",
    xFt: safeNum(f.xFt),
    xIn: Math.max(0, safeNum(f.xIn)),
    yFt: safeNum(f.yFt),
    yIn: Math.max(0, safeNum(f.yIn)),
    rotated: !!f.rotated,
    price: safeNum(f.price),
  }));

  const wallFeatureRoom=wallFeatureRoomData(base,settingsForRoomMigration || DEFAULT_SETTINGS);
  const wallFeatureIds=new Set();
  const freshWallFeatureId=()=>{
    let id="";
    do{ id=String(uid("wf")||"").trim(); }while(!id || wallFeatureIds.has(id));
    return id;
  };
  base.wallFeatures=base.wallFeatures
    .filter(feature=>feature && typeof feature==="object" && GymWallFeatures.KINDS.includes(feature.kind) && GymWallFeatures.SIDES.includes(feature.wall))
    .map(feature=>{
      const sourceId=typeof feature.id==="string" ? feature.id.trim() : "";
      const id=sourceId && !wallFeatureIds.has(sourceId) ? sourceId : freshWallFeatureId();
      wallFeatureIds.add(id);
      return GymWallFeatures.normalize({...feature,id},wallFeatureRoom,()=>id,base);
    });
  const byId=new Map((items||[]).map(item=>[item.id,item]));
  const profileKeys=[...new Set(base.instances.map(inst=>byId.get(inst.itemId)).filter(Boolean).map(equipmentModelProfile))].sort();
  const migrated=GymGarageDoors.migrateLayout3(base,{
    name,
    room:wallFeatureRoom,
    profileKeys,
    hadWallFeatures,
    legacyFeatures:GymWallFeatures.layout3LegacyStarter(),
    starterFeatures:GymWallFeatures.layout3Starter(),
  });
  const migratedWallFeatureIds=new Set(migrated.wallFeatures.map(feature=>feature.id));
  const selectedWallFeatureId=typeof migrated.selectedWallFeatureId==="string"
    ? migrated.selectedWallFeatureId.trim()
    : "";
  migrated.selectedWallFeatureId=migratedWallFeatureIds.has(selectedWallFeatureId)
    ? selectedWallFeatureId
    : null;

  return migrated;
}

function normalizeNamedLayout(name, rawLayout, settings, items=[]){
  return normalizeLayout(rawLayout,settings,{name,items});
}

function loadInitialSettings(){
  const saved = {...DEFAULT_SETTINGS, ...(loadJSON(LS.settings, {}))};
  saved.wishlistVisibleColumns = Array.isArray(saved.wishlistVisibleColumns) && saved.wishlistVisibleColumns.length ? saved.wishlistVisibleColumns : DEFAULT_WISHLIST_COLUMNS.slice();
  const sk = String(saved.wishlistSort||"").trim();
  saved.wishlistSort = WISHLIST_SORT_OPTIONS.some(o=> o.value===sk) ? sk : "dateAdded";
  const gk = String(saved.wishlistGroupBy||"").trim();
  saved.wishlistGroupBy = WISHLIST_GROUP_OPTIONS.some(o=> o.value===gk) ? gk : "category";
  saved.flooringPrices = {...DEFAULT_FLOORING_PRICES, ...(saved.flooringPrices||{})};
  saved.layoutEditorUnit = (saved.layoutEditorUnit === "in" || saved.layoutEditorUnit === "ft") ? saved.layoutEditorUnit : "ft";
  saved.layoutDimOverlay = !!saved.layoutDimOverlay;
  saved.layoutGridContrast = clamp(Math.round(safeNum(saved.layoutGridContrast)||1), 1, 3);
  return saved;
}

const __initialSettings = loadInitialSettings();

// State
const state = {
  tab: (()=> {
    const saved = loadJSON(LS.tab, "wishlist");
    return (saved==="ingest" || saved==="exercises") ? "wishlist" : saved;
  })(),
  settings: __initialSettings,
  categories: (()=>{
    const c = loadJSON(LS.categories, DEFAULT_CATEGORIES);
    const list = Array.isArray(c) ? c : DEFAULT_CATEGORIES;
    const lower = new Set(list.map(x=>String(x).toLowerCase()));
    DEFAULT_CATEGORIES.forEach(x=>{ if(!lower.has(x.toLowerCase())) list.push(x); });
    return list;
  })(),
  items: (()=>{
    const it = loadJSON(LS.items, null);
    if(Array.isArray(it) && it.length){
      return it.map(normalizeItemRecord);
    }
    return [{
      ...DEFAULT_ITEM,
      id: uid("item"),
      name:"Functional Trainer",
      brand:"",
      category:"Cable & Functional",
      status:"Ready to Buy",
      priority:"Must-have",
      qty:1,
      unit:"in",
      length:55,
      width:45,
      height:85,
      price:3200,
      fees:250,
    }];
  })(),
  layout: normalizeLayout(loadJSON(LS.layout, DEFAULT_LAYOUT), __initialSettings),
  draft: {...DEFAULT_ITEM},
  editingId: null,
  ingestText: "",
  ingestParsed: [],
  ingestErr: "",
  drag: { active:false, type:null, id:null, start:{x:0,y:0}, origin:{x:0,y:0}, invalid:false },
  exerciseFilterBodyPart: "All",
  exerciseFilterType: "All",
  exerciseFilterView: "available",
  layoutSelectedCategory: "All",
  layoutFilterUpright: "All",
  layoutFilterHole: "All",
  layoutExpandedItemId: null,
  layoutExpandedTab: "general",
  layoutToolsPanelOpen: false,
  layoutFocusMode: false,
  layoutActionStatus: null,
  wishlistCategoriesOpen: false,
  exportDialogOpen: false,
  exportMode: "full",
  exportLayoutScope: "active",
  compareSelectedIds: [],
  comparePrompt: DEFAULT_COMPARE_PROMPT,
  compareResult: null,
};

// Initialize layouts
(function initLayouts(){
  const lib = loadJSON(LS.layouts, null);
  const active = loadJSON(LS.activeLayoutId, null);

  if(Array.isArray(lib) && lib.length){
    state.layouts = lib.map(x=>({
      id: x.id || uid("ly"),
      name: x.name || "Layout",
      layout: normalizeNamedLayout(x.name, x.layout || x.data || x, state.settings, state.items),
    }));
  } else {
    state.layouts = [{
      id: uid("ly"),
      name: "Layout 1",
      layout: normalizeLayout(state.layout, state.settings, {name:"Layout 1",items:state.items}),
    }];
  }

  state.activeLayoutId = (active && state.layouts.some(x=>x.id===active)) ? active : state.layouts[0].id;
  const activeEntry = state.layouts.find(x=>x.id===state.activeLayoutId) || state.layouts[0];
  state.layout = normalizeLayout(activeEntry.layout, state.settings, {name:activeEntry.name,items:state.items});

  function setActiveLayout(id){
    if(Array.isArray(state.layouts) && state.layouts.length){
      const curIdx = state.layouts.findIndex(x=>x.id===state.activeLayoutId);
      if(curIdx>=0) state.layouts[curIdx].layout = deepCopy(state.layout);
    }

    const next = state.layouts.find(x=>x.id===id) || state.layouts[0];
    state.activeLayoutId = next.id;
    state.layout = normalizeLayout(next.layout, state.settings, {name:next.name,items:state.items});

    state.layout.selectedInstId = null;
    state.layout.selectedAreaId = null;
    state.layout.selectedOutletId = null;
    state.layout.selectedWallExtId = null;
    state.layout.selectedCeilingZoneId = null;
    state.layout.selectedFloorZoneId = null;
    state.layout.selectedWallFeatureId = null;
    state._roomCache = null;
  }

  state.setActiveLayout = setActiveLayout;
})();

function persist(){
  if(Array.isArray(state.layouts) && state.layouts.length){
    const idx = state.layouts.findIndex(x=>x.id===state.activeLayoutId);
    if(idx>=0) state.layouts[idx].layout = deepCopy(state.layout);
  }

  saveJSON(LS.tab, state.tab);
  saveJSON(LS.settings, state.settings);
  saveJSON(LS.categories, state.categories);
  saveJSON(LS.items, state.items);
  saveJSON(LS.layout, state.layout);
  saveJSON(LS.layouts, state.layouts);
  saveJSON(LS.activeLayoutId, state.activeLayoutId);
}

function room(){
  const baseL = settingsRoomLengthTotalFt();
  const baseW = settingsRoomWidthTotalFt();
  const clearance = clamp(settingsClearanceTotalFt(), 0, 10);

  const exts = Array.isArray(state.layout.wallExtensions) ? state.layout.wallExtensions : [];
  const extRects = exts.map(e=>({ id: e.id, isExt: true, label: e.label || "Extension", ...wallExtToRect(e, baseW, baseL) }));

  const rects = [
    { id: "base", isExt: false, x: 0, y: 0, w: baseW, h: baseL },
    ...extRects,
  ];

  let minX = 0, minY = 0, maxX = baseW, maxY = baseL;
  rects.forEach(r=>{
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  });
  const bounds = { minX, minY, maxX, maxY, w: Math.max(1e-6, maxX-minX), h: Math.max(1e-6, maxY-minY) };
  const staging = layoutStagingRect({ bounds });

  // Include effective ft+in totals per extension so cache invalidates when inch fields change (not just startFt/lengthFt/depthFt).
  const key = JSON.stringify({
    baseL: round1(baseL),
    baseW: round1(baseW),
    exts: exts.map(e=>`${e.wall}:${round1(wallExtStartTotalFt(e))}:${round1(wallExtLengthTotalFt(e))}:${round1(wallExtDepthTotalFt(e))}`).sort(),
  });
  if(state._roomCache && state._roomCache.key === key){
    return { L: baseL, W: baseW, clearance, rects, validRects: [...rects, staging], bounds, staging, area: state._roomCache.area };
  }

  const step = 0.5;
  const x0 = Math.floor(bounds.minX/step)*step;
  const y0 = Math.floor(bounds.minY/step)*step;
  const x1 = Math.ceil(bounds.maxX/step)*step;
  const y1 = Math.ceil(bounds.maxY/step)*step;

  let count = 0;
  for(let x=x0; x<x1; x+=step){
    for(let y=y0; y<y1; y+=step){
      const cx = x + step/2;
      const cy = y + step/2;
      if(pointInRoom(cx, cy, rects)) count++;
    }
  }
  const area = count * step * step;
  state._roomCache = { key, area };

  return { L: baseL, W: baseW, clearance, rects, validRects: [...rects, staging], bounds, staging, area };
}

function areaSubtractsSpace(area,settings=state.settings){
  const enabled=new Set(Array.isArray(settings.reservedAreaKindsSubtractSpace)?settings.reservedAreaKindsSubtractSpace:["walkway","door","garagedoor","nogospace","cutout"]);
  return GymGarageDoors.subtractsSpace(area,enabled);
}
function areaBlocksPlacement(area,settings=state.settings){
  const enabled=new Set(Array.isArray(settings.reservedAreaKindsBlockPlacement)?settings.reservedAreaKindsBlockPlacement:["walkway","door","garagedoor","nogospace","cutout"]);
  return GymGarageDoors.blocksPlacement(area,enabled);
}

function reservedSqFt(){
  let sum = 0;
  for(const a of (state.layout.areas||[])){
    if(!areaSubtractsSpace(a)) continue;
    const w = areaWidthTotalFt(a);
    const h = areaHeightTotalFt(a);
    sum += w*h;

    const dc = doorClearanceRect(a);
    if(dc) sum += Math.max(0, dc.w) * Math.max(0, dc.h);
  }
  return sum;
}

function usableSqFt(){
  const r = room();
  return Math.max(0, r.area - reservedSqFt());
}

function effectiveCeilingAtPoint(x, y){
  const defaultCeiling = settingsCeilingHeightTotalFt();
  let minCeiling = defaultCeiling;

  for(const cz of (state.layout.ceilingZones||[])){
    const zx = ceilingZoneXTotalFt(cz), zy = ceilingZoneYTotalFt(cz);
    const zw = ceilingZoneWidthTotalFt(cz), zh = ceilingZoneDepthTotalFt(cz);
    if(x >= zx && x <= zx+zw && y >= zy && y <= zy+zh){
      const czH = ceilingZoneClearanceTotalFt(cz);
      minCeiling = Math.min(minCeiling, czH);
    }
  }

  for(const fz of (state.layout.floorZones||[])){
    const zx = floorZoneXTotalFt(fz), zy = floorZoneYTotalFt(fz);
    const zw = floorZoneWidthTotalFt(fz), zh = floorZoneDepthTotalFt(fz);
    if(x >= zx && x <= zx+zw && y >= zy && y <= zy+zh){
      const elev = Math.max(0, safeNum(fz.elevationIn)) / 12;
      minCeiling = Math.min(minCeiling, defaultCeiling - elev);
    }
  }

  return Math.max(0, minCeiling);
}

function effectiveCeilingForRect(rect){
  const pts = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w/2, rect.y + rect.h/2],
  ];
  let min = Infinity;
  for(const [x,y] of pts){
    min = Math.min(min, effectiveCeilingAtPoint(x, y));
  }
  return min;
}

function computedRows(){
  const r = room();
  const usable = usableSqFt();
  const ceiling = settingsCeilingHeightTotalFt();

  return state.items.map(it=>{
    const tc = totalCost(it);
    const fp = footprint(it);
    const effective = (fp.L + 2*r.clearance) * (fp.W + 2*r.clearance);
    const maxFit = effective>0 ? Math.floor(usable / effective) : 0;

    const reqCeiling = (String(it.requiredCeilingFt||"").trim() !== "") ? Math.max(0, safeNum(it.requiredCeilingFt)) : fp.H;
    const ceilingWarn = (reqCeiling > 0 && ceiling > 0 && reqCeiling > ceiling + 1e-6);

    const powerVoltage = String(it.powerVoltage||"").trim();
    const powerAmps = (String(it.powerAmps||"").trim() !== "") ? safeNum(it.powerAmps) : 0;
    const requiresPower = !!powerVoltage;

    return {
      ...it,
      total: tc,
      Lft: fp.L,
      Wft: fp.W,
      Hft: fp.H,
      effSq: effective,
      maxFit,
      reqCeilingFt: reqCeiling,
      ceilingWarn,
      requiresPower,
      powerVoltage,
      powerAmps,
    };
  });
}

function readyToBuyTotal(rows){
  return rows.reduce((s,r)=> s + (r.status==="Ready to Buy" ? r.total : 0), 0);
}

function plannedTotal(rows){
  return rows.reduce((s,r)=> s + r.total, 0);
}

function usedAreaEstimate(rows){
  const instances = state.layout.instances || [];
  let total = 0;
  
  instances.forEach(inst=>{
    const item = getItemById(inst.itemId);
    if(!item) return;
    const er = effectiveRectForInst(inst, item);
    total += (er.eff.w * er.eff.h);
  });
  
  return total;
}

// Group wishlist rows by the currently-selected grouping (category or brand).
// Returns an array of [groupName, items[]] pairs, with items sorted within each
// group by the current sort setting.
function groupRows(rows, groupByKeyRaw){
  const groupBy = WISHLIST_GROUP_OPTIONS.some(o=> o.value===groupByKeyRaw)
    ? groupByKeyRaw
    : (state.settings.wishlistGroupBy || "category");

  const map = new Map();
  rows.forEach(r=>{
    let key;
    if(groupBy === "brand"){
      const b = String(r.brand||"").trim();
      key = b || "— No brand —";
    } else {
      key = (r.category || "Custom");
    }
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });

  const out = [];
  if(groupBy === "brand"){
    // Alphabetical brand order, with the "no brand" bucket pinned to the end.
    const keys = [...map.keys()].sort((a,b)=>{
      const aNo = a === "— No brand —", bNo = b === "— No brand —";
      if(aNo && !bNo) return 1;
      if(!aNo && bNo) return -1;
      return String(a).localeCompare(String(b), undefined, { sensitivity:"base" });
    });
    keys.forEach(k=> out.push([k, map.get(k)]));
  } else {
    const order = state.categories || DEFAULT_CATEGORIES;
    order.forEach(c=>{ if(map.has(c)) out.push([c, map.get(c)]); });
    for(const [k,v] of map.entries()){
      if(!order.includes(k)) out.push([k, v]);
    }
  }

  const sortKeyRaw = state.settings.wishlistSort || "dateAdded";
  const sortKey = WISHLIST_SORT_OPTIONS.some(o=> o.value===sortKeyRaw) ? sortKeyRaw : "dateAdded";
  out.forEach(([, items])=>{
    items.sort((a,b)=> wishlistSortCompare(a, b, sortKey));
  });
  return out;
}

// Back-compat alias (was the original function name).
function groupByCategory(rows){
  return groupRows(rows, state.settings.wishlistGroupBy || "category");
}

// Ingest parsing
function splitBlocks(text){
  const lines = String(text||"").replace(/\r/g,"").split("\n");
  const blocks = [];
  let cur = [];
  for(const line of lines){
    if(!line.trim()){
      if(cur.length){ blocks.push(cur.join("\n").trim()); cur=[]; }
    } else cur.push(line);
  }
  if(cur.length) blocks.push(cur.join("\n").trim());
  return blocks.length ? blocks : lines.map(l=>l.trim()).filter(Boolean);
}

function extractUrls(text){
  const tokens = String(text||"").split(/\s+/).map(t=>t.trim()).filter(Boolean);
  const urls = [];
  for(let t of tokens){
    t = t.replace(/[),;]+$/g,"");
    if(t.startsWith("http://") || t.startsWith("https://")) urls.push(t);
    if(t.startsWith("www.")) urls.push("https://" + t);
  }
  return Array.from(new Set(urls));
}

function parsePrice(text){
  const s = String(text||"");
  const idx = s.indexOf("$");
  if(idx>=0){
    let out="";
    for(let i=idx+1;i<s.length;i++){
      const ch=s[i];
      const ok=(ch>="0"&&ch<="9")||ch==="."||ch===",";
      if(ok) out+=ch; else if(out) break;
    }
    return safeNum(out.replace(/,/g,""));
  }
  return 0;
}

function normalizeDataImageUrl(url){
  const s = String(url || "").trim().replace(/\s+/g, "");
  return s.startsWith("data:image/") ? s : "";
}

/** Compress a data:image URL to a small JPEG via offscreen canvas. Returns a Promise<string>. */
function compressDataUrl(dataUrl, maxSide=400, quality=0.7){
  return new Promise(resolve=>{
    const src = normalizeDataImageUrl(dataUrl);
    if(!src){ resolve(""); return; }
    const img = new Image();
    img.onload = ()=>{
      try{
        let w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
        if(!w||!h){ resolve(src); return; }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w*scale));
        h = Math.max(1, Math.round(h*scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if(!ctx){ resolve(src); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      }catch{ resolve(src); }
    };
    img.onerror = ()=> resolve("");
    img.src = src;
  });
}

function firstNumber(str){
  const m = String(str||"").match(/(\d+(\.\d+)?)/);
  return m ? safeNum(m[1]) : NaN;
}

function parseDims(text){
  const lines = String(text||"").split("\n").map(l=>l.trim());
  for(const raw of lines){
    const line = raw.replace(/×/g,"x");
    if(!line.toLowerCase().includes("x")) continue;
    const lower = line.toLowerCase();
    let unit = "in";
    if(lower.includes("cm")) unit="cm";
    else if(lower.includes("ft") || lower.includes("feet")) unit="ft";
    else unit="in";

    const cleaned = line
      .replace(/,/g,"")
      .replace(/"/g,"")
      .replace(/inches|inch/gi,"")
      .replace(/cm|ft|feet/gi,"");

    const parts = cleaned.split("x").map(p=>p.trim());
    if(parts.length<2) continue;
    const a = firstNumber(parts[0]);
    const b = firstNumber(parts[1]);
    const c = parts.length>=3 ? firstNumber(parts[2]) : NaN;
    if(!Number.isFinite(a) || !Number.isFinite(b)) continue;
    return {unit, length:a, width:b, height:Number.isFinite(c)?c:0};
  }
  return null;
}

function inferCategory(text){
  const t = String(text||"").toLowerCase();
  const has = (k)=>t.includes(k);
  if(has("sauna")||has("infrared")||has("cold plunge")||has("recovery")) return "Accessories";
  if(has("treadmill")||has("elliptical")||has("rower")||has("bike")||has("air bike")||has("spin")||has("ski erg")) return "Cardio & Conditioning";
  if(has("smith")||has("all-in-one")||has("all in one")) return "Smith & All-in-One";
  if(has("functional trainer")||has("cable machine")||has("pulley")||has("lat tower")) return "Cable & Functional";
  if(has("selectorized")||has("pin select")||has("stack")) {
    if(has("leg")||has("squat")||has("hack")||has("extension")||has("curl")) return "Selectorized Lower";
    return "Selectorized Upper";
  }
  if(has("plate-loaded")||has("plate loaded")) {
    if(has("leg")||has("squat")||has("press")) return "Plate-Loaded Lower";
    return "Plate-Loaded Upper";
  }
  if(has("strongman")||has("yoke")||has("sled")||has("log press")||has("atlas stone")) return "Strongman";
  if(has("pull-up")||has("pullup")||has("dip station")||has("gymnastic")||has("mobility")) return "Bodyweight & Mobility";
  if(has("platform")||has("deadlift platform")) return "Platforms";
  if(has("attachment")||has("j-cup")||has("jcup")||has("dip horn")||has("landmine")) return "Rack Attachments";
  if(has("power rack")||has("squat rack")||has("half rack")||has("rig")||has("cage")) return "Racks & Cages";
  if(has("bench")||has("fid")) return "Benches";
  if(has("trap bar")||has("safety squat bar")||has("specialty bar")||has("ez bar")) return "Barbells & Specialty Bars";
  if(has("barbell")||has("olympic bar")) return "Barbells & Specialty Bars";
  if(has("dumbbell")) return "Dumbbells";
  if(has("kettlebell")) return "Kettlebells";
  if(has("plate")||has("bumper")||has("iron plate")) return "Weight Plates";
  if(has("mirror")) return "Accessories";
  if(has("floor")||has("rubber")||has("mat")||has("stall mat")||has("rolled rubber")) return "Platforms";
  if(has("storage")||has("shelf")||has("tree")||has("holder")) return "Storage";
  return "Custom";
}

function guessNameFromUrl(url){
  try{
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean).slice(-2).join(" ").replace(/[-_]/g," ").trim();
    if(!parts) return "";
    return parts.split(" ").filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  }catch{ return ""; }
}

/** Sniff for gym-equipment-export style HTML (large files: only scan a prefix). */
function looksLikeGymEquipmentExportHtml(s){
  // Only scan the first few KB — the marker tags appear near the top of the file.
  // "similarity group" / "product id" are ~450 KB deep (after base64 images) so don't require them here.
  const head = String(s || "").slice(0, 8000).toLowerCase();
  if(!head.includes("<")) return false;
  if(!head.includes("gym equipment export")) return false;
  if(!head.includes("meta-card")) return false;
  return true;
}

/**
 * Parse standalone HTML export with `.cards > .card`, `.name`, `.price`, `.meta-card` rows.
 * Returns the same shape as parseIngest() for wishlist ingest / Add selected.
 */
// Returns true if the item looks like it was imported from an HTML export file.
// We use notes markers ("Product ID:" / "Similarity group:") that are always
// added by `parseGymEquipmentExportHtml` for every imported card. Items from
// newer imports also carry an explicit `importBatch` field.
function isHtmlImportedItem(item){
  if(!item) return false;
  if(item.importBatch) return true;
  const n = String(item.notes || "");
  return /^\s*Product\s*ID\s*:/mi.test(n) || /^\s*Similarity\s*group\s*:/mi.test(n);
}

// Group imported items by their `importBatch` stamp so the user can delete by
// batch. Items imported before batch tracking existed are collected under a
// synthetic "legacy" batch so they can still be cleaned up.
// Returns an array of batch objects sorted most-recent first:
//   { id, time, file, count, sampleNames, brands, items }
function getImportBatches(items){
  const list = Array.isArray(items) ? items : (state.items || []);
  const imported = list.filter(isHtmlImportedItem);
  const byId = new Map();
  imported.forEach(it=>{
    const bid = it.importBatch || "legacy";
    if(!byId.has(bid)){
      byId.set(bid, {
        id: bid,
        time: Number.isFinite(it.importBatchTime) ? it.importBatchTime : 0,
        file: String(it.importBatchFile || ""),
        items: [],
      });
    }
    const b = byId.get(bid);
    b.items.push(it);
    if(Number.isFinite(it.importBatchTime) && it.importBatchTime > b.time){
      b.time = it.importBatchTime;
    }
    if(!b.file && it.importBatchFile) b.file = String(it.importBatchFile);
  });
  const batches = Array.from(byId.values()).map(b=>{
    const brands = Array.from(new Set(
      b.items.map(x=> String(x.brand||"").trim()).filter(Boolean)
    )).slice(0, 3);
    const sampleNames = b.items.slice(0, 4).map(x=> String(x.name||"").trim()).filter(Boolean);
    return {
      ...b,
      count: b.items.length,
      brands,
      sampleNames,
    };
  });
  batches.sort((a,b)=>{
    if(a.id === "legacy" && b.id !== "legacy") return 1;
    if(b.id === "legacy" && a.id !== "legacy") return -1;
    return (b.time || 0) - (a.time || 0);
  });
  return batches;
}

// Format a batch timestamp for humans. Falls back to "Older imports" for
// items that predate batch tracking.
function formatImportBatchLabel(batch){
  if(!batch) return "";
  if(batch.id === "legacy" || !batch.time) return "Older imports (no batch info)";
  try{
    const d = new Date(batch.time);
    const opts = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
    return d.toLocaleString(undefined, opts);
  }catch{
    return "Imported batch";
  }
}

function parseGymEquipmentExportHtml(htmlString){
  let doc;
  try{
    doc = new DOMParser().parseFromString(String(htmlString || ""), "text/html");
  }catch{ return []; }
  const root = doc.querySelector(".cards");
  if(!root) return [];
  const cards = root.querySelectorAll(":scope > .card");
  // Handles "×", "x", "*", and "A-" (mojibake) separators
  const ftDimRe = /([\d.,]+)\s*ft\s*(?:[×x*]|A-)\s*([\d.,]+)\s*ft\s*(?:[×x*]|A-)\s*([\d.,]+)\s*ft/i;

  // Document-level fallback: the header sometimes has "Company: <factory name>".
  let docCompany = "";
  doc.querySelectorAll(".sub").forEach(el=>{
    const t = (el.textContent || "").trim();
    const m = t.match(/Company:\s*([^•\n\r]+?)(?:\s*•|\s*$)/i);
    if(m && m[1] && !docCompany) docCompany = m[1].trim();
  });

  const out = [];
  cards.forEach(card=>{
    const name = (card.querySelector(".name")?.textContent || "").trim() || "New item";
    const priceEl = card.querySelector(".price");
    const price = priceEl ? parsePrice(priceEl.textContent || "") : 0;
    const priceSource = (card.querySelector(".price-source")?.textContent || "").trim();
    const noteBlock = (card.querySelector(".note")?.textContent || "").trim();

    // Extract embedded thumbnail image (base64 data URL)
    const imgEl = card.querySelector(".thumb img[src^='data:image']");
    const layoutImageDataUrl = normalizeDataImageUrl(imgEl ? imgEl.getAttribute("src") : "");

    // Extract brand/factory from badges. The export format always lays out badges
    // in this order: [equipment type] [body part] [factory / company].
    // The factory name is therefore whichever of the last-positioned badges isn't
    // an equipment category or body-part-style label.
    const badges = Array.from(card.querySelectorAll(".badges .badge")).map(b=>(b.textContent||"").trim()).filter(Boolean);
    const categoryLikeWords = new Set(["other","storage","cardio","bench","rack","cable","selectorized","plate-loaded","smith","custom","accessories","strongman","bodyweight","platforms","dumbbells","barbells","kettlebells","weight plates"]);
    const bodyPartWord = /\b(back|legs|chest|shoulders|arms|core|hips?|glutes|quads?|hamstrings|calves|biceps|triceps|forearms|abs|neck|posterior\s+chain|inner[-\s]*outer\s+thigh|upper\s+back|lower\s+back|upper\s+body|lower\s+body|row)\b/i;
    const looksLikeBodyPart = (s)=>{
      const v = String(s||"").trim();
      if(!v) return false;
      // Body-part badges almost always contain a "/" separator or common body-part words.
      if(v.includes("/")) return true;
      if(bodyPartWord.test(v)) return true;
      return false;
    };
    let brandBadge = "";
    for(let i = badges.length - 1; i >= 0; i--){
      const b = badges[i];
      if(b.length < 3) continue;
      if(categoryLikeWords.has(b.toLowerCase())) continue;
      if(looksLikeBodyPart(b)) continue;
      brandBadge = b;
      break;
    }
    // Fallback to the document-level "Company: X" header if present.
    if(!brandBadge && docCompany) brandBadge = docCompany;

    let similarity = "";
    let productId = "";
    let dimsStr = "";
    card.querySelectorAll(".meta-card").forEach(row=>{
      const k = (row.querySelector(".k")?.textContent || "").trim().toLowerCase();
      const vText = (row.querySelector(".v")?.textContent || "").replace(/\s+/g, " ").trim();
      if(k.includes("similarity")) similarity = vText;
      else if(k.includes("product id")) productId = vText;
      else if(k.includes("dimension")) dimsStr = vText;
    });
    let unit = "ft";
    let length = "";
    let width = "";
    let height = "";
    const m = dimsStr.match(ftDimRe);
    if(m){
      length = String(safeNum(m[1].replace(/,/g, "")));
      width = String(safeNum(m[2].replace(/,/g, "")));
      height = String(safeNum(m[3].replace(/,/g, "")));
    }else{
      const d = parseDims(dimsStr.replace(/×/g, "x").replace(/A-/g, "x"));
      if(d){
        unit = d.unit;
        length = String(d.length);
        width = String(d.width);
        height = String(d.height);
      }
    }
    const linkEl = card.querySelector("a[href^=\"http\"], a[href^='http']");
    const productLink = linkEl?.getAttribute("href")?.trim() || "";
    const noteParts = [];
    if(similarity) noteParts.push(`Similarity group: ${similarity}`);
    if(productId) noteParts.push(`Product ID: ${productId}`);
    if(priceSource) noteParts.push(priceSource);
    if(noteBlock) noteParts.push(noteBlock);
    const notes = noteParts.join("\n");
    const inferText = [name, similarity, productId, dimsStr].filter(Boolean).join("\n");
    const category = inferCategory(inferText);
    out.push({
      ...DEFAULT_ITEM,
      id: uid("ing"),
      selected: true,
      data: {
        ...DEFAULT_ITEM,
        name,
        brand: brandBadge,
        category,
        unit,
        length,
        width,
        height,
        price: price || "",
        productLink,
        notes,
        layoutImageDataUrl: layoutImageDataUrl || "",
        layoutUseImage: !!layoutImageDataUrl,
      },
    });
  });
  return out;
}

function parseIngest(text){
  const blocks = splitBlocks(text);
  const out = [];
  for(const block of blocks){
    const urls = extractUrls(block);
    const lines = String(block).split("\n").map(l=>l.trim()).filter(Boolean);
    const price = parsePrice(block);
    const dims = parseDims(block);
    let name="";
    for(const line of lines){
      if(!extractUrls(line).length && line.length>2){ name=line; break; }
    }
    if(!name && urls[0]) name = guessNameFromUrl(urls[0]);
    if(!name) name = "New item";
    out.push({
      ...DEFAULT_ITEM,
      id: uid("ing"),
      selected:true,
      data:{
        ...DEFAULT_ITEM,
        name,
        category: inferCategory(block),
        unit: dims?.unit || "in",
        length: dims?.length || "",
        width: dims?.width || "",
        height: dims?.height || "",
        price: price || "",
        productLink: urls[0] || "",
        specLink: urls[1] || "",
        notes: lines.slice(1).join("\n"),
      }
    });
  }
  return out;
}

// Layout helpers
function getItemById(id){ return state.items.find(x=>x.id===id) || null; }

function instanceDims(inst, item){
  const fp = footprint(item);
  const len = fp.L, wid = fp.W;
  return inst.rotated ? {w:len, h:wid} : {w:wid, h:len};
}

function rotatedInstanceCandidate(inst,item){
  const oldDims=instanceDims(inst,item);
  const candidate={...inst,rotated:!inst.rotated};
  const newDims=instanceDims(candidate,item);
  const x=instXTotalFt(inst)+(oldDims.w-newDims.w)/2;
  const y=instYTotalFt(inst)+(oldDims.h-newDims.h)/2;
  const clean=n=>Math.round(n*1200)/1200;
  return {...candidate,xFt:clean(x),xIn:0,yFt:clean(y),yIn:0};
}

function deadspaceConfig(inst){
  const r = room();
  const ov = instDeadspaceOverrideTotalFt(inst);
  const ds = (ov==null ? r.clearance : ov);
  const sides = (Array.isArray(inst.deadspaceSides) && inst.deadspaceSides.length) ? inst.deadspaceSides : (state.settings.defaultDeadspaceSides || []);
  return {ds, sides: Array.from(new Set(sides))};
}

function deadspaceRects(base, ds, sides){
  const out = [];
  if(!ds || !sides || !sides.length) return out;
  if(sides.includes("left")) out.push({x:base.x-ds, y:base.y, w:ds, h:base.h});
  if(sides.includes("right")) out.push({x:base.x+base.w, y:base.y, w:ds, h:base.h});
  if(sides.includes("top")) out.push({x:base.x, y:base.y-ds, w:base.w, h:ds});
  if(sides.includes("bottom")) out.push({x:base.x, y:base.y+base.h, w:base.w, h:ds});
  const hasL=sides.includes("left"), hasR=sides.includes("right"), hasT=sides.includes("top"), hasB=sides.includes("bottom");
  if(hasL && hasT) out.push({x:base.x-ds, y:base.y-ds, w:ds, h:ds});
  if(hasR && hasT) out.push({x:base.x+base.w, y:base.y-ds, w:ds, h:ds});
  if(hasL && hasB) out.push({x:base.x-ds, y:base.y+base.h, w:ds, h:ds});
  if(hasR && hasB) out.push({x:base.x+base.w, y:base.y+base.h, w:ds, h:ds});
  return out;
}

function effectiveRectForInst(inst, item){
  const dims = instanceDims(inst, item);
  const base = {x: instXTotalFt(inst), y: instYTotalFt(inst), w:dims.w, h:dims.h};
  const cfg = deadspaceConfig(inst);
  const halos = deadspaceRects(base, cfg.ds, cfg.sides);
  let minX=base.x, minY=base.y, maxX=base.x+base.w, maxY=base.y+base.h;
  halos.forEach(r=>{
    minX=Math.min(minX,r.x); minY=Math.min(minY,r.y);
    maxX=Math.max(maxX,r.x+r.w); maxY=Math.max(maxY,r.y+r.h);
  });
  return {base, eff:{x:minX,y:minY,w:maxX-minX,h:maxY-minY}, halos, cfg};
}

// The 2D editor includes a parking strip beside the physical room. Items in
// that strip remain part of the layout library, but they are not physically in
// the room and must not leak into the orbit view, walkthrough, collisions, or
// minimap.
function layoutRoomInstances(layout=state.layout, roomData=room()){
  const staging = roomData && roomData.staging;
  return (Array.isArray(layout?.instances) ? layout.instances : []).filter(inst=>{
    const item = getItemById(inst.itemId);
    if(!item) return false;
    const base = effectiveRectForInst(inst, item).base;
    return !(staging && rectInsideRect(base, staging));
  });
}

function areaRect(a){
  return {x: areaXTotalFt(a), y: areaYTotalFt(a), w: areaWidthTotalFt(a), h: areaHeightTotalFt(a)};
}

function doorClearanceRect(a){
  if(!a || a.kind!=="door") return null;
  if(a.doorClearEnabled === false) return null;

  const x = areaXTotalFt(a), y = areaYTotalFt(a);
  const w = areaWidthTotalFt(a);
  const h = areaHeightTotalFt(a);

  const orient = (a.doorOrientation && a.doorOrientation!=="auto") ? a.doorOrientation : (w>=h ? "horizontal" : "vertical");
  const hinge = a.doorHinge || "start";
  const swing = a.doorSwing || (orient==="horizontal" ? "down" : "right");

  const doorWidth = Math.max(w,h);
  const radTotal = areaDoorRadiusTotalFt(a);
  const radius = (radTotal==null ? doorWidth : radTotal);

  let hingeX = x, hingeY = y;
  let x0=0,y0=0;

  if(orient==="horizontal"){
    hingeY = (swing==="up") ? (y+h) : y;
    hingeX = (hinge==="end") ? (x+w) : x;
    x0 = (hinge==="end") ? (hingeX - radius) : hingeX;
    y0 = (swing==="up") ? (hingeY - radius) : hingeY;
  } else {
    hingeX = (swing==="left") ? (x+w) : x;
    hingeY = (hinge==="end") ? (y+h) : y;
    x0 = (swing==="left") ? (hingeX - radius) : hingeX;
    y0 = (hinge==="end") ? (hingeY - radius) : hingeY;
  }

  return { x:x0, y:y0, w:radius, h:radius, hingeX, hingeY, radius, orient, swing, hinge };
}

function doorArcPath(a){
  const c = doorClearanceRect(a);
  if(!c) return "";
  const r = c.radius;
  const hx = c.hingeX, hy = c.hingeY;

  let sx=hx, sy=hy, ex=hx, ey=hy;

  if(c.orient==="horizontal"){
    const startIsRight = (c.hinge!=="end");
    sx = startIsRight ? (hx + r) : (hx - r);
    sy = hy;
    ex = hx;
    ey = (c.swing==="up") ? (hy - r) : (hy + r);
  } else {
    const startIsDown = (c.hinge!=="end");
    sx = hx;
    sy = startIsDown ? (hy + r) : (hy - r);
    ex = (c.swing==="left") ? (hx - r) : (hx + r);
    ey = hy;
  }

  return `M ${hx} ${hy} L ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey} Z`;
}

function resizeHandles(target, id, rect){
  const hs = 0.35;
  const safeTarget = escapeAttr(target);
  const safeId = escapeAttr(id);
  const x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.w, y1 = rect.y + rect.h;
  const xm = (x0+x1)/2, ym = (y0+y1)/2;

  const pts = [
    ["nw", x0, y0], ["n", xm, y0], ["ne", x1, y0],
    ["w", x0, ym],                ["e", x1, ym],
    ["sw", x0, y1], ["s", xm, y1], ["se", x1, y1],
  ];

  return pts.map(([h,x,y])=>(
    `<rect data-resize="${safeTarget}" data-id="${safeId}" data-handle="${escapeAttr(h)}" x="${x - hs/2}" y="${y - hs/2}" width="${hs}" height="${hs}" class="handle" />`
  )).join("");
}

function outletMatches(required, outletV){
  const req = String(required||"").trim();
  if(!req) return false;
  const ov = String(outletV||"").trim() || "120V";
  if(ov==="Any") return true;
  return ov === req;
}

function nearestOutletInfo(inst, item){
  const voltage = String(item?.powerVoltage||"").trim();
  if(!voltage) return { has:false, dist:Infinity, outlet:null };

  const outs = state.layout.outlets || [];
  if(!outs.length) return { has:false, dist:Infinity, outlet:null };

  const er = effectiveRectForInst(inst, item);
  const cx = er.base.x + er.base.w/2;
  const cy = er.base.y + er.base.h/2;

  let best = { d: Infinity, outlet: null };
  for(const o of outs){
    if(!outletMatches(voltage, o.voltage)) continue;
    const dx = (outletXTotalFt(o) - cx);
    const dy = (outletYTotalFt(o) - cy);
    const d = Math.sqrt(dx*dx + dy*dy);
    if(d < best.d){
      best = { d, outlet: o };
    }
  }

  if(!best.outlet) return { has:false, dist:Infinity, outlet:null };
  return { has:true, dist: best.d, outlet: best.outlet };
}

function isTreadmill(item){
  const name = String(item?.name||"").toLowerCase();
  return name.includes("treadmill");
}

/**
 * Smart drag clamping: equipment sticks to walls where there is NO extension,
 * but can pass through walls into extension areas that exist at its position.
 * Uses a "slide along wall" fallback: try X-only, then Y-only, then stay put.
 */
function clampInstToRoom(desiredX, desiredY, w, h, prevX, prevY, r){
  const validAt = (x, y) => rectInsideRoom({x, y, w, h});
  const rr = r || room();
  const staging = rr.staging || layoutStagingRect(rr);
  // Allow jumping across the gap into staging (otherwise wall-stick prevents crossing)
  if(staging && rectInsideRect({x: desiredX, y: desiredY, w, h}, staging)){
    return {x: desiredX, y: desiredY};
  }

  // 1. Desired position is fully inside room → allow
  if(validAt(desiredX, desiredY)) return {x: desiredX, y: desiredY};

  // 2. Slide along X only (sticks to top/bottom walls)
  if(validAt(desiredX, prevY)) return {x: desiredX, y: prevY};

  // 3. Slide along Y only (sticks to left/right walls)
  if(validAt(prevX, desiredY)) return {x: prevX, y: desiredY};

  // 4. Neither axis alone works → binary-search for the farthest valid point
  //    in each direction, then pick the one with more movement
  function bsX(x0, x1, fy){
    if(!validAt(x0, fy)) return x0;
    let lo = x0, hi = x1;
    for(let i=0; i<20; i++){ const m=(lo+hi)/2; if(validAt(m,fy)) lo=m; else hi=m; }
    return lo;
  }
  function bsY(y0, y1, fx){
    if(!validAt(fx, y0)) return y0;
    let lo = y0, hi = y1;
    for(let i=0; i<20; i++){ const m=(lo+hi)/2; if(validAt(fx,m)) lo=m; else hi=m; }
    return lo;
  }

  const bx = bsX(prevX, desiredX, prevY);
  const by = bsY(prevY, desiredY, prevX);
  const mdx = Math.abs(bx - prevX), mdy = Math.abs(by - prevY);

  if(mdx >= mdy && validAt(bx, prevY)) return {x: bx, y: prevY};
  if(mdy > 0 && validAt(prevX, by))    return {x: prevX, y: by};

  // 5. Stay put
  return {x: prevX, y: prevY};
}

// Magnetically snap item edges to a wall when within tolerance.
// Considers the base room's 4 walls and each extension's outer walls,
// and only applies the snap if the resulting position is still valid.
function wallStick(x, y, w, h, tol){
  const validAt = (xx, yy) => rectInsideRoom({x: xx, y: yy, w, h});
  const r = room();
  // If the item is fully inside the staging zone, don't wall-stick (free placement).
  if(rectInsideRect({x, y, w, h}, r.staging || layoutStagingRect(r))){
    return {x, y};
  }
  const T = Math.max(0, safeNum(tol) || 0.3);
  const baseL = r.L, baseW = r.W;
  const exts = Array.isArray(state.layout.wallExtensions) ? state.layout.wallExtensions : [];

  // Collect vertical (x) and horizontal (y) candidate wall lines.
  const xLines = [0, baseW];
  const yLines = [0, baseL];
  for(const e of exts){
    const er = wallExtToRect(e, baseW, baseL);
    if(e.wall === "left")   xLines.push(er.x);
    if(e.wall === "right")  xLines.push(er.x + er.w);
    if(e.wall === "top")    yLines.push(er.y);
    if(e.wall === "bottom") yLines.push(er.y + er.h);
  }

  // Best x snap: try matching either the item's left edge (x) or right edge (x+w) to any xLine.
  let bestX = x, bestDx = T + 1e-9;
  for(const lx of xLines){
    const tryLeft = lx;              // snap left edge to wall
    const dL = Math.abs(x - tryLeft);
    if(dL <= T && dL < bestDx && validAt(tryLeft, y)){
      bestX = tryLeft; bestDx = dL;
    }
    const tryRight = lx - w;         // snap right edge to wall
    const dR = Math.abs(x - tryRight);
    if(dR <= T && dR < bestDx && validAt(tryRight, y)){
      bestX = tryRight; bestDx = dR;
    }
  }
  x = bestX;

  // Best y snap: same idea vertically.
  let bestY = y, bestDy = T + 1e-9;
  for(const ly of yLines){
    const tryTop = ly;
    const dT = Math.abs(y - tryTop);
    if(dT <= T && dT < bestDy && validAt(x, tryTop)){
      bestY = tryTop; bestDy = dT;
    }
    const tryBot = ly - h;
    const dB = Math.abs(y - tryBot);
    if(dB <= T && dB < bestDy && validAt(x, tryBot)){
      bestY = tryBot; bestDy = dB;
    }
  }
  y = bestY;

  return {x, y};
}

function isInvalidPlacement(instId, baseRect, effRect){
  const r = room();
  if(!rectInsideRoom(baseRect)) return true;
  // If fully in staging/parking zone, allow free overlap (acts like a holding area)
  if(rectInsideRect(baseRect, r.staging || layoutStagingRect(r))) return false;
  
  for(const a of state.layout.areas||[]){
    if(!areaBlocksPlacement(a)) continue;
    if(rectsOverlap(baseRect, areaRect(a))) return true;
    const dc = doorClearanceRect(a);
    if(dc && rectsOverlap(baseRect, dc)) return true;
  }
  for(const other of state.layout.instances||[]){
    if(other.id===instId) continue;
    const it = getItemById(other.itemId);
    if(!it) continue;
    const o = effectiveRectForInst(other, it).eff;
    if(rectsOverlap(effRect, o)) return true;
  }
  return false;
}

// Hard-invalid: would cause an item to be outside the room or physically overlap
// another item's body (or a hard-blocked area). This is the ONLY condition that
// causes a drag to snap back. Halo/clearance overlap alone is a soft warning so
// users can still stick items to walls even when clearance zones touch.
function hardPlacementConflict(instId, baseRect){
  const r = room();
  if(!rectInsideRoom(baseRect)){
    return {kind:"outside-room", message:"Can’t rotate here — the equipment would extend outside the room."};
  }
  // Free-placement zone: anything inside staging is always hard-valid.
  if(rectInsideRect(baseRect, r.staging || layoutStagingRect(r))) return null;

  for(const a of state.layout.areas||[]){
    if(!areaBlocksPlacement(a)) continue;
    const areaName=String(a.label||"").trim() || kindMeta(a.kind).label;
    if(rectsOverlap(baseRect, areaRect(a))){
      return {kind:"reserved-area", areaId:a.id, message:`Can’t rotate here — it would overlap ${areaName}.`};
    }
    const dc = doorClearanceRect(a);
    if(dc && rectsOverlap(baseRect, dc)){
      return {kind:"door-clearance", areaId:a.id, message:`Can’t rotate here — it would block the clearance for ${areaName}.`};
    }
  }
  for(const other of state.layout.instances||[]){
    if(other.id===instId) continue;
    const it = getItemById(other.itemId);
    if(!it) continue;
    const otherBase=effectiveRectForInst(other, it).base;
    if(rectsOverlap(baseRect, otherBase)){
      const itemName=String(it.name||"").trim() || "another item";
      return {
        kind:"equipment-overlap",
        instanceId:other.id,
        itemId:other.itemId,
        message:`Can’t rotate here — it would overlap ${itemName}.`,
      };
    }
  }
  return null;
}

function isHardInvalidPlacement(instId, baseRect){
  return !!hardPlacementConflict(instId, baseRect);
}

function snap(v){
  const s = Math.max(0, safeNum(state.settings.snapFt));
  if(!s) return v;
  return Math.round(v/s)*s;
}

function clientToSvgPoint(svgEl, clientX, clientY){
  const pt = svgEl.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if(!ctm) return {x:0,y:0};
  const inv = ctm.inverse();
  const p = pt.matrixTransform(inv);
  return {x:p.x, y:p.y};
}

function updateDraftPreview(){
  const d = state.draft || {...DEFAULT_ITEM};
  const currency = (state.settings && state.settings.currency) ? state.settings.currency : "USD";

  const tc = totalCost(d);
  const fp = footprint(d);

  const elT = document.getElementById("previewTotal");
  const elF = document.getElementById("previewFootprint");
  if(elT) elT.textContent = `Total: ${money(tc, currency)}`;
  if(elF) elF.textContent = `Footprint: ${fp.L && fp.W ? formatDimsDual(fp.L, fp.W) : "—"}`;

  const saveBtn = document.getElementById("saveItemBtn");
  if(saveBtn){
    const ok = !!String(d.name||"").trim();
    saveBtn.disabled = !ok;
  }
}

function cssEscapeAttrForSelector(s){
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function captureFocus(){
  const el = document.activeElement;
  if(!el) return null;
  const tag = (el.tagName||"").toLowerCase();
  const textControl=["input","textarea","select"].includes(tag);
  const focusKey=el.dataset?.focusKey || "";
  const hasStableButtonTarget=tag==="button" && !!(el.id || focusKey || (el.dataset?.action && el.dataset?.id));
  if(!textControl && !hasStableButtonTarget) return null;

  const info = { tag, id: el.id || null, focusKey: focusKey || null, selector: null, selection: null };
  if(!info.id){
    if(!info.focusKey){
      const act = el.dataset && el.dataset.action ? el.dataset.action : "";
      const did = el.dataset && el.dataset.id ? el.dataset.id : "";
      if(act || did){
        const parts = [];
        if(act) parts.push(`[data-action="${cssEscapeAttrForSelector(act)}"]`);
        if(did) parts.push(`[data-id="${cssEscapeAttrForSelector(did)}"]`);
        info.selector = parts.join("");
      }
    }
  }
  if(textControl && typeof el.selectionStart === "number"){
    info.selection = { start: el.selectionStart, end: el.selectionEnd, dir: el.selectionDirection || "none" };
  }
  return info;
}

function restoreFocus(info){
  if(!info) return;
  let el = null;
  if(info.id) el = document.getElementById(info.id);
  else if(info.focusKey) el = document.querySelector(`[data-focus-key="${cssEscapeAttrForSelector(info.focusKey)}"]`);
  else if(info.selector) el = document.querySelector(info.selector);

  if(el){
    try{ el.focus({preventScroll:true}); }catch{ try{ el.focus(); }catch{} }
    if(info.selection && typeof el.setSelectionRange === "function"){
      try{ el.setSelectionRange(info.selection.start, info.selection.end, info.selection.dir); }catch{}
    }
  }
}

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, (c)=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function escapeAttr(s){ return escapeHtml(s).replace(/`/g,"&#96;"); }
function escapeSvg(s){ return escapeHtml(s); }

/** Allow only http(s) URLs for inline product links (avoids javascript: etc.). */
function safeHttpUrl(s){
  const raw = String(s || "").trim();
  if(!raw) return "";
  try{
    const u = new URL(raw);
    if(u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  }catch{
    return "";
  }
}

function productLinkLabel(url){
  const href = safeHttpUrl(url);
  if(!href) return "Product page";
  try{
    const host = new URL(href).host;
    return host ? `Open ${host}` : "Open product page";
  }catch{
    return "Open product page";
  }
}

/** Safe `<a>` for opening the vendor page in a new tab. */
function productLinkAnchorHtml(url, linkText){
  const href = safeHttpUrl(url);
  if(!href) return "";
  const text = String(linkText || "").trim() || productLinkLabel(url);
  return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="productPageLink">${escapeHtml(text)}</a>`;
}

function clearAllSelections(){
  state.layout.selectedInstId = null;
  state.layout.selectedAreaId = null;
  state.layout.selectedOutletId = null;
  state.layout.selectedWallExtId = null;
  state.layout.selectedCeilingZoneId = null;
  state.layout.selectedFloorZoneId = null;
  state.layout.selectedFlooringId = null;
  state.layout.selectedWallFeatureId = null;
}

function getFlooringType(typeId){
  return FLOORING_TYPES.find(t=>t.id===typeId) || FLOORING_TYPES[0];
}

function flooringPieceRect(piece){
  const type = getFlooringType(piece.typeId);
  const w = piece.rotated ? type.lengthFt : type.widthFt;
  const h = piece.rotated ? type.widthFt : type.lengthFt;
  return { x: flooringXTotalFt(piece), y: flooringYTotalFt(piece), w, h };
}

function totalFlooringCost(){
  return (state.layout.flooringPieces||[]).reduce((sum, p)=> sum + safeNum(p.price), 0);
}

function totalFlooringArea(){
  return (state.layout.flooringPieces||[]).reduce((sum, p)=>{
    const type = getFlooringType(p.typeId);
    return sum + (type.widthFt * type.lengthFt);
  }, 0);
}

function getCoveredExerciseBodyParts(){
  const covered = new Set();
  (state.items||[]).forEach(item=>{
    (item.equipmentTags||[]).forEach(tag=>{
      const parts = BODY_PART_TAG_MAP[tag] || [];
      parts.forEach(p=> covered.add(p));
    });
  });
  return covered;
}

function canDoExercise(exercise, covered){
  if(!exercise.bodyPart) return true;
  return covered.has(exercise.bodyPart);
}

function getExerciseStats(){
  const equipmentSet = getCoveredExerciseBodyParts();
  const available = EXERCISE_DATABASE.filter(ex=> canDoExercise(ex, equipmentSet));
  const needed = EXERCISE_DATABASE.filter(ex=> !canDoExercise(ex, equipmentSet));
  
  const byBodyPart = {};
  BODY_PARTS.filter(bp=>bp!=="All").forEach(bp=>{
    const all = EXERCISE_DATABASE.filter(ex=>ex.bodyPart===bp);
    const avail = all.filter(ex=> canDoExercise(ex, equipmentSet));
    byBodyPart[bp] = { total: all.length, available: avail.length, pct: all.length ? Math.round(avail.length/all.length*100) : 0 };
  });
  
  return { available, needed, byBodyPart, totalAvailable: available.length, totalExercises: EXERCISE_DATABASE.length };
}

function getItemBodyPartTags(item){
  return (Array.isArray(item?.equipmentTags) ? item.equipmentTags : []).filter(t=> ITEM_BODY_PART_TAGS.includes(t));
}

function getItemCoveredBodyParts(item){
  const covered = new Set();
  getItemBodyPartTags(item).forEach(tag=>{
    (BODY_PART_TAG_MAP[tag]||[]).forEach(p=> covered.add(p));
  });
  return covered;
}

function exerciseCountAvailableForCoverage(coveredSet){
  return EXERCISE_DATABASE.filter(ex=> canDoExercise(ex, coveredSet)).length;
}

function exerciseCountSumByBodyPart(coveredSet){
  let sum = 0;
  coveredSet.forEach(bp=>{
    sum += EXERCISE_DATABASE.filter(ex=> ex.bodyPart===bp).length;
  });
  return sum;
}

function exerciseMaxCountSingleBodyPart(coveredSet){
  let max = 0;
  coveredSet.forEach(bp=>{
    const c = EXERCISE_DATABASE.filter(ex=> ex.bodyPart===bp).length;
    if(c > max) max = c;
  });
  return max;
}

function itemCreatedAtMs(item){
  if(item && Number.isFinite(Number(item.createdAt))) return Number(item.createdAt);
  const parts = String(item?.id||"").split("_");
  const last = parts[parts.length-1] || "";
  const n = parseInt(last, 16);
  return Number.isFinite(n) ? n : 0;
}

function wishlistSortMetrics(row){
  const covered = getItemCoveredBodyParts(row);
  const availUnique = exerciseCountAvailableForCoverage(covered);
  const totalSum = exerciseCountSumByBodyPart(covered);
  const maxByPart = exerciseMaxCountSingleBodyPart(covered);
  const effSq = Math.max(1e-9, safeNum(row.effSq));
  const price = safeNum(row.price);
  const dateMs = itemCreatedAtMs(row);
  return {
    dateMs,
    availUnique,
    totalSum,
    maxByPart,
    availPerSq: availUnique / effSq,
    totalPerSq: totalSum / effSq,
    price,
  };
}

function wishlistSortCompare(a, b, sortKey){
  const A = wishlistSortMetrics(a);
  const B = wishlistSortMetrics(b);
  let cmp = 0;
  switch(sortKey){
    case "dateAdded": cmp = B.dateMs - A.dateMs; break;
    case "alphabetical": cmp = String(a.name||"").localeCompare(String(b.name||""), undefined, { sensitivity: "base" }); break;
    case "brand": {
      const ab = String(a.brand||"").trim();
      const bb = String(b.brand||"").trim();
      // Empty brands go at the bottom, then alphabetical brand, then by name.
      if(!ab && bb) cmp = 1;
      else if(ab && !bb) cmp = -1;
      else cmp = ab.localeCompare(bb, undefined, { sensitivity: "base" });
      break;
    }
    case "availableExercises": cmp = B.availUnique - A.availUnique; break;
    case "availablePerSqft": cmp = B.availPerSq - A.availPerSq; break;
    case "price": cmp = A.price - B.price; break;
    case "totalExercises": cmp = B.totalSum - A.totalSum; break;
    case "totalExercisesPerSqft": cmp = B.totalPerSq - A.totalPerSq; break;
    case "maxExByBodyPart": cmp = B.maxByPart - A.maxByPart; break;
    default: cmp = B.dateMs - A.dateMs;
  }
  if(cmp !== 0) return cmp;
  return String(a.name||"").localeCompare(String(b.name||""), undefined, { sensitivity: "base" });
}

// Returns coverage info for items currently placed in the layout.
// { covered: Set<exerciseBodyPart>, byTag: Map<itemBodyPartTag, count>, placedItems: [...] }
function getLayoutCoverage(){
  const placedItemIds = new Set((state.layout.instances||[]).map(inst=> inst.itemId));
  const placedItems = (state.items||[]).filter(item=> placedItemIds.has(item.id));

  const byTag = new Map(); // item body part tag → count of items with that tag
  placedItems.forEach(item=>{
    getItemBodyPartTags(item).forEach(tag=>{
      byTag.set(tag, (byTag.get(tag)||0) + 1);
    });
  });

  const covered = new Set();
  for(const [tag] of byTag){
    (BODY_PART_TAG_MAP[tag]||[]).forEach(p=> covered.add(p));
  }

  return { covered, byTag, placedItems };
}

function wishlistVisibleColumns(){
  const cols = Array.isArray(state.settings.wishlistVisibleColumns) ? state.settings.wishlistVisibleColumns : DEFAULT_WISHLIST_COLUMNS;
  return cols.filter(col=> DEFAULT_WISHLIST_COLUMNS.includes(col));
}
