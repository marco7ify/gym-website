(async function(){
  "use strict";

  const frame=document.querySelector("#planner-frame");
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    const ready=frame.contentDocument?.readyState==="complete";
    const scripts=ready ? Array.from(frame.contentDocument.querySelectorAll("body script[src]")) : [];
    if(scripts.length>=8) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }

  const leafUrl=value=>{
    const url=new URL(value,location.href);
    return `${url.pathname.split("/").pop()}${url.search}`;
  };
  const runtimeScript=frame.contentDocument?.querySelector('script[type="module"][src]');
  const classicScripts=Array.from(frame.contentDocument?.querySelectorAll('body script[src]:not([type="module"])')||[])
    .map(script=>leafUrl(script.src));

  GymTests.test("loads the current runtime entry URL",()=>{
    GymTests.equal(leafUrl(runtimeScript?.src||""),"gltf-runtime.js?v=22");
  });

  GymTests.test("loads every classic production asset at its current cache URL",()=>{
    GymTests.deepEqual(classicScripts,[
      "model-assets.js?v=4",
      "wall-features.js?v=2",
      "app.js?v=77",
      "view3d.js?v=33",
      "panels.js?v=73",
      "layout.js?v=81",
      "events.js?v=78",
      "render.js?v=70",
    ]);
  });

  GymTests.finish();
})().catch(error=>{
  GymTests.test("loads the runtime cache test fixture",()=>{ throw error; });
  GymTests.finish();
});
