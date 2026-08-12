import * as THREE_MODULE from "three";
import { GLTFLoader } from "./vendor/examples/jsm/loaders/GLTFLoader.js";

const loader=new GLTFLoader();

// The planner's existing scripts intentionally share browser globals. Expose
// the same module instance used by GLTFLoader, then load those scripts in their
// established order so rendering never mixes two copies of Three.js.
globalThis.THREE=THREE_MODULE;

window.GymGLTFRuntime={
  parse(arrayBuffer){
    return new Promise((resolve,reject)=>{
      loader.parse(arrayBuffer,"",resolve,error=>reject(error instanceof Error ? error : new Error(String(error||"Could not read GLB model."))));
    });
  },
};

window.dispatchEvent(new CustomEvent("gym-gltf-ready"));

const classicScripts=[
  "./model-assets.js?v=4",
  "./wall-features.js?v=3",
  "./garage-doors.js?v=2",
  "./app.js?v=86",
  "./walkthrough-editing.js?v=1",
  "./equipment-models.js?v=5",
  "./garage-door-3d.js?v=1",
  "./view3d.js?v=42",
  "./panels.js?v=73",
  "./layout.js?v=87",
  "./events.js?v=83",
  "./render.js?v=70",
];

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
  for(const src of classicScripts) await loadClassicScript(src);
}catch(error){
  console.error("Gym Planner could not start",error);
  const app=document.querySelector("#app");
  if(app) app.innerHTML='<div style="max-width:720px;margin:48px auto;padding:24px;font:16px/1.5 system-ui;color:#111827;">Gym Planner could not start. Refresh the page to try again.</div>';
}
