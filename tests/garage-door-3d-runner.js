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
    "./test-harness.js?v=garage-task5-final-1",
    "../wall-features.js?v=garage-task5-final-1",
    "../garage-doors.js?v=garage-task5-final-1",
    "../app.js?v=garage-task5-final-1",
    "../garage-door-3d.js?v=garage-task5-final-1",
    "../view3d.js?v=garage-task5-final-1",
    "./garage-door-fixtures.js?v=garage-task5-final-1",
    "./garage-door-3d.test.js?v=garage-task5-final-1",
  ]) await loadClassicScript(src);
  GymTests.finish();
}catch(error){
  const results=document.querySelector("#test-results");
  results.dataset.complete="true";
  results.dataset.failures="1";
  results.textContent=`Runner failed: ${error?.stack||error}`;
}
