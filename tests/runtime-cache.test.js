(async function(){
  "use strict";

  const frame=document.querySelector("#planner-frame");
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    const ready=frame.contentDocument?.readyState==="complete";
    const scripts=ready ? Array.from(frame.contentDocument.querySelectorAll("body script[src]")) : [];
    if(scripts.length>=9) break;
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
      "app.js?","equipment-models.js?","layout.js?","events.js?",
    ].some(prefix=>url.startsWith(prefix)));

  GymTests.test("loads the current runtime entry URL",()=>{
    GymTests.equal(leafUrl(runtimeScript?.src||""),"gltf-runtime.js?v=33");
  });

  GymTests.test("loads every classic production asset at its current cache URL",()=>{
    GymTests.deepEqual(classicScripts,[
      "model-assets.js?v=4",
      "wall-features.js?v=2",
      "app.js?v=83",
      "equipment-models.js?v=2",
      "view3d.js?v=37",
      "panels.js?v=73",
      "layout.js?v=85",
      "events.js?v=81",
      "render.js?v=70",
    ]);
  });

  GymTests.test("loads current app and equipment assets in the shared logic runner",()=>{
    GymTests.deepEqual(logicProductionScripts,[
      "app.js?v=83",
      "equipment-models.js?v=2",
      "layout.js?v=85",
      "events.js?v=81",
    ]);
  });

  GymTests.finish();
})().catch(error=>{
  GymTests.test("loads the runtime cache test fixture",()=>{ throw error; });
  GymTests.finish();
});
