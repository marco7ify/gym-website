(function(){
  "use strict";

  const BUILDERS=Object.create(null);

  function createModelKit(view,group,inst,base,height){
    const w=Math.max(.4,base.w),d=Math.max(.4,base.h),h=Math.max(.45,height);
    const material=spec=>view.material(spec);
    const addBox=(size,pos,mat,options={})=>view.box(group,size,pos,mat,{...options,instId:inst.id});
    const addCylinder=(radius,length,pos,mat,options={})=>view.cylinder(group,radius,length,pos,mat,{...options,instId:inst.id});
    const addBeam=(start,end,width,mat,depth=width)=>view.beam(group,start,end,width,depth,mat,{instId:inst.id});
    const addTube=(start,end,radius,mat,segments=14)=>view.tube(group,start,end,radius,mat,{instId:inst.id,segments});
    return {w,d,h,material,addBox,addCylinder,addBeam,addTube};
  }

  function build(profile,view,group,inst,base,height){
    const builder=BUILDERS[profile];
    if(!builder) return null;
    return {builderKey:profile,modelType:builder(view,group,inst,base,height)};
  }

  window.GymEquipmentModels=Object.freeze({has:key=>!!BUILDERS[key],keys:()=>Object.keys(BUILDERS),build,createModelKit});
})();
