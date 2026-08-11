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
    "./test-harness.js",
    "../wall-features.js",
    "../app.js",
    "../equipment-models.js",
    "../view3d.js",
    "./equipment-dispatch-3d.test.js",
  ]) await loadClassicScript(src);
  GymTests.finish();
}catch(error){
  const results=document.querySelector("#test-results");
  results.dataset.complete="true";
  results.dataset.failures="1";
  results.textContent=`Runner failed: ${error?.stack||error}`;
}
