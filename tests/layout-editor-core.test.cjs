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
