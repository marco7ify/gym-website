const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../layout-editor-core.js");

const items = [
  {id:"a", name:"Functional Trainer", brand:"Rogue", category:"Cable", rackHolePattern:""},
  {id:"b", name:"Power Rack", brand:"REP", category:"Racks", rackHolePattern:"3x3-1"},
  {id:"c", name:"Adjustable Bench", brand:"REP", category:"Benches", rackHolePattern:""},
];

test("filterEquipment combines query, category, and brand", () => {
  assert.deepEqual(
    core.filterEquipment(items, {query:"rack", category:"Racks", brand:"REP"}).map(x=>x.id),
    ["b"]
  );
});

test("selectionType returns the one active layout selection", () => {
  assert.equal(core.selectionType({selectedInstId:"i1"}), "equipment");
  assert.equal(core.selectionType({selectedAreaId:"a1"}), "area");
  assert.equal(core.selectionType({}), "none");
});

test("clonePlacement creates a new selected-ready instance without transient flags", () => {
  const source = {id:"i1", itemId:"a", xFt:3, xIn:0, yFt:4, yIn:0, rotated:true, __invalid:true};
  assert.deepEqual(core.clonePlacement(source, "i2"), {
    id:"i2", itemId:"a", xFt:3, xIn:0, yFt:4, yIn:0, rotated:true,
  });
});

test("centerPlacement centers the measured footprint in a room rectangle", () => {
  assert.deepEqual(
    core.centerPlacement({x:0,y:0,w:20,h:16}, {w:4,h:6}),
    {xFt:8, xIn:0, yFt:5, yIn:0}
  );
});

test("draftChanged compares normalized serializable values", () => {
  assert.equal(core.draftChanged({name:"Rack", qty:1}, {name:"Rack", qty:1}), false);
  assert.equal(core.draftChanged({name:"Rack", qty:2}, {name:"Rack", qty:1}), true);
});

test("workspaceDefaults contains only transient UI state", () => {
  assert.deepEqual(core.workspaceDefaults(), {
    search:"", inspectorMode:"auto", libraryDrawerOpen:false,
    inspectorDrawerOpen:false, detailsEditorOpen:false,
    detailsEditorItemId:null, detailsEditorDirty:false,
    detailsEditorBaseline:null, discardEditorConfirmOpen:false,
    returnFocusSelector:"", status:null,
    openPageTool:"layout", openAdvancedSection:"",
  });
});

test("filterEquipment supports no-brand and rack metadata filters", () => {
  const filterItems = [
    ...items,
    {id:"d",name:"Unbranded Bench",brand:"",category:"Benches"},
    {id:"e",name:"Compact Rack",brand:"REP",category:"Racks"},
  ];
  const pattern = item => item.id==="b"
    ? {uprightSize:"3×3",holeSize:"1 in"}
    : item.id==="e" ? {uprightSize:"2×2",holeSize:"5/8 in"} : null;
  assert.deepEqual(core.filterEquipment(filterItems,{brand:"__noBrand__"},{rackPatternInfo:pattern}).map(x=>x.id), ["d"]);
  assert.deepEqual(
    core.filterEquipment(filterItems,{category:"Racks",upright:"3×3",hole:"1 in"},{rackPatternInfo:pattern}).map(x=>x.id),
    ["b"]
  );
});
