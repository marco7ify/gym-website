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
      "wall-features.js?","garage-doors.js?","app.js?","equipment-models.js?","layout.js?","events.js?",
    ].some(prefix=>url.startsWith(prefix)));
  const runnerContracts=[
    ["garage-door-3d-runner.html","garage-door-3d-runner.js?v=garage-final-fix-wave-1"],
    ["wall-features-3d-runner.html","wall-features-3d-runner.js?v=garage-final-fix-wave-1"],
    ["equipment-dispatch-3d-runner.html","equipment-dispatch-3d-runner.js?v=equipment-faithful-cardio-v1"],
  ];
  const runnerModuleScripts=await Promise.all(runnerContracts.map(async ([html])=>{
    const source=await fetch(`./${html}?runtime-cache-contract=${Date.now()}`,{cache:"no-store"}).then(response=>response.text());
    const document=new DOMParser().parseFromString(source,"text/html");
    return leafUrl(document.querySelector('script[type="module"][src]')?.getAttribute("src")||"");
  }));

  GymTests.test("loads the current runtime entry URL",()=>{
    GymTests.equal(leafUrl(runtimeScript?.src||""),"gltf-runtime.js?v=38");
  });

  GymTests.test("loads every classic production asset at its current cache URL",()=>{
    GymTests.deepEqual(classicScripts,[
      "model-assets.js?v=4",
      "wall-features.js?v=3",
      "garage-doors.js?v=2",
      "app.js?v=85",
      "equipment-models.js?v=3",
      "garage-door-3d.js?v=1",
      "view3d.js?v=40",
      "panels.js?v=73",
      "layout.js?v=86",
      "events.js?v=82",
      "render.js?v=70",
    ]);
  });

  GymTests.test("loads current app and equipment assets in the shared logic runner",()=>{
    GymTests.deepEqual(logicProductionScripts,[
      "wall-features.js?v=3",
      "garage-doors.js?v=2",
      "app.js?v=85",
      "equipment-models.js?v=3",
      "layout.js?v=86",
      "events.js?v=82",
    ]);
  });

  GymTests.test("loads every real-Three runner module at its current cache URL",()=>{
    GymTests.deepEqual(runnerModuleScripts,runnerContracts.map(([,script])=>script));
  });

  GymTests.finish();
})().catch(error=>{
  GymTests.test("loads the runtime cache test fixture",()=>{ throw error; });
  GymTests.finish();
});
