import * as THREE_MODULE from "../vendor/three.module.js";

globalThis.THREE=THREE_MODULE;
globalThis.render=()=>{};
globalThis.requestAnimationFrame=()=>0;
globalThis.cancelAnimationFrame=()=>{};

function loadClassicScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=src;
    script.async=false;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.body.appendChild(script);
  });
}

try{
  for(const src of [
    "./test-harness.js?v=1",
    "../wall-features.js?v=3",
    "../garage-doors.js?v=2",
    "../app.js?v=86",
    "../walkthrough-editing.js?v=1",
    "./garage-door-fixtures.js?v=2",
    "../equipment-models.js?v=5",
    "../garage-door-3d.js?v=1",
    "../view3d.js?v=42",
    "../layout.js?v=87",
    "../events.js?v=83",
    "./equipment-dispatch-3d.test.js?v=walkthrough-edit-v1",
  ]) await loadClassicScript(src);
  GymTests.finish();
}catch(error){
  const results=document.querySelector("#test-results");
  results.dataset.complete="true";
  results.dataset.failures="1";
  results.textContent=`Runner failed: ${error?.stack||error}`;
}
