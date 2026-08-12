(async function(){
  "use strict";

  const frame=document.querySelector("#planner-frame");
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    const ready=frame.contentDocument?.readyState==="complete";
    const scripts=ready ? Array.from(frame.contentDocument.querySelectorAll("body script[src]")) : [];
    if(scripts.length>=11) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }

  const leafUrl=value=>{
    const url=new URL(value,location.href);
    return `${url.pathname.split("/").pop()}${url.search}`;
  };
  const runtimeScript=frame.contentDocument?.querySelector('script[type="module"][src]');
  const classicScripts=Array.from(frame.contentDocument?.querySelectorAll('body script[src]:not([type="module"])')||[])
    .map(script=>leafUrl(script.src));
  const logicHtml=await fetch(`./planner-logic-runner.html?runtime-cache-contract=${Date.now()}`,{cache:"no-store"}).then(response=>response.text());
  const logicDocument=new DOMParser().parseFromString(logicHtml,"text/html");
  const logicProductionScripts=Array.from(logicDocument.querySelectorAll('script[src^="../"]'))
    .map(script=>leafUrl(script.getAttribute("src")))
    .filter(url=>[
      "wall-features.js?","garage-doors.js?","app.js?","walkthrough-editing.js?","equipment-models.js?","layout.js?","events.js?",
    ].some(prefix=>url.startsWith(prefix)));
  const runnerContracts=[
    ["garage-door-3d-runner.html","garage-door-3d-runner.js?v=final-fix-v1"],
    ["wall-features-3d-runner.html","wall-features-3d-runner.js?v=final-fix-v2"],
    ["equipment-dispatch-3d-runner.html","equipment-dispatch-3d-runner.js?v=final-fix-v2"],
  ];
  const runnerModuleScripts=await Promise.all(runnerContracts.map(async ([html])=>{
    const source=await fetch(`./${html}?runtime-cache-contract=${Date.now()}`,{cache:"no-store"}).then(response=>response.text());
    const document=new DOMParser().parseFromString(source,"text/html");
    return leafUrl(document.querySelector('script[type="module"][src]')?.getAttribute("src")||"");
  }));
  const equipmentRunnerSource=await fetch(`./equipment-dispatch-3d-runner.js?runtime-cache-contract=${Date.now()}`,{cache:"no-store"}).then(response=>response.text());
  const equipmentInnerMatch=equipmentRunnerSource.match(/["'](\.\/equipment-dispatch-3d\.test\.js\?v=[^"']+)["']/);
  const equipmentInnerScript=leafUrl(equipmentInnerMatch?.[1]||"");
  const wallRunnerSource=await fetch(`./wall-features-3d-runner.js?runtime-cache-contract=${Date.now()}`,{cache:"no-store"}).then(response=>response.text());
  const wallInnerMatch=wallRunnerSource.match(/["'](\.\/wall-features-3d\.test\.js\?v=[^"']+)["']/);
  const wallInnerScript=leafUrl(wallInnerMatch?.[1]||"");
  const garageRunnerSource=await fetch(`./garage-door-3d-runner.js?runtime-cache-contract=${Date.now()}`,{cache:"no-store"}).then(response=>response.text());
  const garageInnerProduction=Array.from(garageRunnerSource.matchAll(/["'](\.\.\/(?:app|view3d)\.js\?v=[^"']+)["']/g))
    .map(match=>leafUrl(match[1]));

  GymTests.test("loads the current runtime entry URL",()=>{
    GymTests.equal(leafUrl(runtimeScript?.src||""),"gltf-runtime.js?v=42");
  });

  GymTests.test("loads every classic production asset at its current cache URL",()=>{
    GymTests.deepEqual(classicScripts,[
      "model-assets.js?v=4",
      "wall-features.js?v=3",
      "garage-doors.js?v=2",
      "app.js?v=87",
      "walkthrough-editing.js?v=2",
      "equipment-models.js?v=6",
      "garage-door-3d.js?v=1",
      "view3d.js?v=43",
      "panels.js?v=73",
      "layout.js?v=88",
      "events.js?v=84",
      "render.js?v=71",
    ]);
  });

  GymTests.test("loads current app and equipment assets in the shared logic runner",()=>{
    GymTests.deepEqual(logicProductionScripts,[
      "wall-features.js?v=3",
      "garage-doors.js?v=2",
      "app.js?v=87",
      "walkthrough-editing.js?v=2",
      "equipment-models.js?v=6",
      "layout.js?v=88",
      "events.js?v=84",
    ]);
  });

  GymTests.test("loads every real-Three runner module at its current cache URL",()=>{
    GymTests.deepEqual(runnerModuleScripts,runnerContracts.map(([,script])=>script));
  });

  GymTests.test("loads the current inner equipment real-Three test at its cache URL",()=>{
    GymTests.equal(equipmentInnerScript,"equipment-dispatch-3d.test.js?v=final-fix-v2");
  });

  GymTests.test("loads the current inner wall-feature real-Three test at its cache URL",()=>{
    GymTests.equal(wallInnerScript,"wall-features-3d.test.js?v=final-fix-v2");
  });

  GymTests.test("loads the garage real-Three runner against current app and view sources",()=>{
    GymTests.deepEqual(garageInnerProduction,["app.js?v=87","view3d.js?v=43"]);
  });

  GymTests.finish();
})().catch(error=>{
  GymTests.test("loads the runtime cache test fixture",()=>{ throw error; });
  GymTests.finish();
});
