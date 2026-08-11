(function(){
  "use strict";

  const DB_NAME="gym-planner-assets";
  const DB_VERSION=1;
  const STORE_NAME="models";
  const MAX_BYTES=25*1024*1024;
  const MAX_CACHE_BYTES=50*1024*1024;
  const cache=new Map();
  let cacheBytes=0;
  let dbPromise=null;

  function remember(record){
    if(!record?.id) return record;
    const previous=cache.get(record.id);
    if(previous) cacheBytes-=Math.max(0,Number(previous.size)||previous.buffer?.byteLength||0);
    cache.delete(record.id);
    cache.set(record.id,record);
    cacheBytes+=Math.max(0,Number(record.size)||record.buffer?.byteLength||0);
    while(cacheBytes>MAX_CACHE_BYTES && cache.size>1){
      const oldestId=cache.keys().next().value;
      const oldest=cache.get(oldestId);
      cache.delete(oldestId);
      cacheBytes-=Math.max(0,Number(oldest?.size)||oldest?.buffer?.byteLength||0);
    }
    return record;
  }

  function assetId(ref){
    const value=String(ref||"");
    return value.startsWith("local:") ? value.slice(6) : value;
  }

  function openDb(){
    if(dbPromise) return dbPromise;
    if(!window.indexedDB) return Promise.reject(new Error("This browser does not support local 3D model storage."));
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{keyPath:"id"});
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>{
          db.close();
          dbPromise=null;
        };
        resolve(db);
      };
      request.onerror=()=>{
        dbPromise=null;
        reject(request.error||new Error("Could not open local 3D model storage."));
      };
      request.onblocked=()=>{
        dbPromise=null;
        reject(new Error("3D model storage is blocked by another open tab."));
      };
    });
    return dbPromise;
  }

  function validateGlb(buffer){
    if(!(buffer instanceof ArrayBuffer) || buffer.byteLength<20) throw new Error("That file is not a valid GLB model.");
    if(buffer.byteLength>MAX_BYTES) throw new Error("GLB files must be 25 MB or smaller.");
    const view=new DataView(buffer);
    if(view.getUint32(0,true)!==0x46546c67) throw new Error("That file is not a binary .glb model.");
    if(view.getUint32(4,true)!==2) throw new Error("Only GLB 2.0 models are supported.");
    if(view.getUint32(8,true)!==buffer.byteLength) throw new Error("The GLB file length is invalid or incomplete.");
    const firstChunkLength=view.getUint32(12,true);
    const firstChunkType=view.getUint32(16,true);
    if(firstChunkType!==0x4e4f534a || firstChunkLength<2 || 20+firstChunkLength>buffer.byteLength){
      throw new Error("The GLB is missing its required JSON scene data.");
    }
    let json;
    try{
      const text=new TextDecoder().decode(new Uint8Array(buffer,20,firstChunkLength)).replace(/[\u0000\s]+$/g,"");
      json=JSON.parse(text);
    }catch{
      throw new Error("The GLB scene data is not valid JSON.");
    }
    if(String(json?.asset?.version||"")!=="2.0") throw new Error("Only GLB 2.0 models are supported.");
    const external=[...(json.buffers||[]),...(json.images||[])]
      .map(entry=>String(entry?.uri||""))
      .filter(uri=>uri && !uri.startsWith("data:"));
    if(external.length) throw new Error("This GLB links to external files. Export one self-contained binary GLB and try again.");
    const unsupported=(json.extensionsRequired||[]).filter(name=>[
      "KHR_draco_mesh_compression",
      "EXT_meshopt_compression",
      "KHR_texture_basisu",
    ].includes(name));
    if(unsupported.length){
      throw new Error("This GLB uses compressed geometry or textures that are not supported yet. Export a standard uncompressed GLB and try again.");
    }
    return json;
  }

  function transaction(db,mode,work){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,mode);
      const store=tx.objectStore(STORE_NAME);
      let result;
      try{ result=work(store); }catch(err){ reject(err); return; }
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error||new Error("3D model storage failed."));
      tx.onabort=()=>reject(tx.error||new Error("3D model storage was cancelled."));
    });
  }

  async function put(file){
    if(!(file instanceof Blob)) throw new Error("Choose a .glb model file first.");
    const name=String(file.name||"equipment.glb");
    if(!/\.glb$/i.test(name)) throw new Error("Choose a binary .glb file.");
    if(file.size>MAX_BYTES) throw new Error("GLB files must be 25 MB or smaller.");
    const buffer=await file.arrayBuffer();
    validateGlb(buffer);
    const id=(window.crypto?.randomUUID?.()||`model_${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9_-]/gi,"");
    const record={id,name:name.slice(0,180),size:buffer.byteLength,type:"model/gltf-binary",updatedAt:Date.now(),buffer};
    const db=await openDb();
    await transaction(db,"readwrite",store=>store.put(record));
    remember(record);
    return {ref:`local:${id}`,name:record.name,size:record.size,updatedAt:record.updatedAt};
  }

  async function get(ref){
    const id=assetId(ref);
    if(!id) return null;
    if(cache.has(id)) return remember(cache.get(id));
    const db=await openDb();
    const record=await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,"readonly");
      const request=tx.objectStore(STORE_NAME).get(id);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error("Could not read the local 3D model."));
    });
    if(record) remember(record);
    return record;
  }

  async function remove(ref){
    const id=assetId(ref);
    if(!id) return;
    const cached=cache.get(id);
    if(cached) cacheBytes-=Math.max(0,Number(cached.size)||cached.buffer?.byteLength||0);
    cache.delete(id);
    const db=await openDb();
    await transaction(db,"readwrite",store=>store.delete(id));
  }

  window.GymModelAssets={MAX_BYTES,put,get,remove,validateGlb,assetId};
})();
