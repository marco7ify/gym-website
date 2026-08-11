(function(){
  "use strict";

  const exactProfiles=[
    "ice-barrel-500",
    "syedee-stair-machine",
    "nordictrack-x16",
    "ritfit-gator-bench",
    "brightway-hs08-row",
    "shizhuo-seated-standing-row",
    "wanjia-combo-adductor",
    "yindun-three-tier-rack",
  ];

  GymTests.test("routes each photo-matched item to its exact profile",()=>{
    const cases=[
      [{brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge"},"ice-barrel-500"],
      [{brand:"syedee",name:"Stair Machine",category:"Cardio & Conditioning"},"syedee-stair-machine"],
      [{brand:"NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning"},"nordictrack-x16"],
      [{brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches"},"ritfit-gator-bench"],
      [{brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine",category:"Selectorized Upper"},"brightway-hs08-row"],
      [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row",category:"Plate-Loaded Upper"},"shizhuo-seated-standing-row"],
      [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"wanjia-combo-adductor"],
      [{brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack",category:"Storage"},"yindun-three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>GymTests.equal(equipmentModelProfile(item),expected));
  });

  GymTests.test("keeps broad lookalikes on legacy or standard profiles",()=>{
    const cases=[
      [{brand:"Another Brand",name:"Adjustable Weight Bench",category:"Benches"},"incline-bench"],
      [{brand:"Another Brand",name:"Incline Treadmill",category:"Cardio & Conditioning"},"incline-treadmill"],
      [{brand:"Another Brand",name:"HS08",category:"Selectorized Upper"},"standard"],
      [{brand:"Another Brand",name:"Three-Tier Dumbbell Rack",category:"Storage"},"three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>{
      const profile=equipmentModelProfile(item);
      GymTests.equal(profile,expected);
      GymTests.assert(!exactProfiles.includes(profile),`${item.name} must not receive an exact photo-matched profile`);
    });
  });

  GymTests.test("keeps clone brands and accessory names on broad fallback profiles",()=>{
    const cases=[
      [{brand:"Ice Barrel Clone Co.",name:"Ice Barrel 500",category:"Cold Plunge"},"step-in-plunge"],
      [{brand:"Ice Barrel",name:"Ice Barrel 500 Replacement Lid",category:"Cold Plunge"},"step-in-plunge"],
      [{brand:"syedee Authorized Reseller",name:"Stair Machine",category:"Cardio & Conditioning"},"commercial-stair"],
      [{brand:"syedee",name:"Stair Machine Replacement Console",category:"Cardio & Conditioning"},"commercial-stair"],
      [{brand:"Some NordicTrack",name:"X16 Treadmill",category:"Cardio & Conditioning"},"incline-treadmill"],
      [{brand:"NordicTrack",name:"X16 Treadmill Walking Deck",category:"Cardio & Conditioning"},"incline-treadmill"],
      [{brand:"RitFit Clone",name:"RitFit GATOR 1600LB Adjustable Weight Bench",category:"Benches"},"incline-bench"],
      [{brand:"RitFit",name:"RitFit GATOR 1600LB Adjustable Weight Bench Replacement Pad",category:"Benches"},"incline-bench"],
      [{brand:"Shandong Brightway Fitness Reseller",name:"HS08 — Rowing Machine",category:"Selectorized Upper"},"selectorized-seated-row"],
      [{brand:"Shandong Brightway Fitness",name:"HS08 — Rowing Machine Attachment",category:"Selectorized Upper"},"selectorized-seated-row"],
      [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd. Clone",name:"Seated/standing row",category:"Plate-Loaded Upper"},"seated-standing-row"],
      [{brand:"Dezhou Shizhuo Fitness Technology Co., Ltd.",name:"Seated/standing row accessory",category:"Plate-Loaded Upper"},"seated-standing-row"],
      [{brand:"Shandong Wanjia Fitness Equipment Clone",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"adductor-combo"],
      [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor Attachment",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"adductor-combo"],
      [{brand:"Dezhou Yindun Seiko Technology Co., Ltd. Reseller",name:"Three-Tier Dumbbell Rack",category:"Storage"},"three-tier-rack"],
      [{brand:"Dezhou Yindun Seiko Technology Co., Ltd.",name:"Three-Tier Dumbbell Rack Cover",category:"Storage"},"three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>{
      const profile=equipmentModelProfile(item);
      GymTests.equal(profile,expected);
      GymTests.assert(!exactProfiles.includes(profile),`${item.brand} / ${item.name} must not receive an exact photo-matched profile`);
      GymTests.assert(!itemUsesPhotoMatched3d(item),`${item.brand} / ${item.name} must not receive a photo-matched label`);
    });
  });

  GymTests.test("accepts documented punctuation variants without ignoring extra words",()=>{
    const cases=[
      [{brand:"Dezhou Shizhuo Fitness Technology Co Ltd",name:"Seated - standing row",category:"Plate-Loaded Upper"},"shizhuo-seated-standing-row"],
      [{brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor and Abductor",category:"Selectorized Lower",unit:"ft",length:4.99,width:2.38,height:4.61},"wanjia-combo-adductor"],
      [{brand:"Dezhou Yindun Seiko Technology Co Ltd",name:"Three Tier Dumbbell Rack",category:"Storage"},"yindun-three-tier-rack"],
    ];
    cases.forEach(([item,expected])=>GymTests.equal(equipmentModelProfile(item),expected));
  });

  GymTests.test("requires Wanjia's measured dimensions for its exact profile",()=>{
    const item={brand:"Shandong Wanjia Fitness Equipment",name:"Combo Adductor & Abductor",category:"Selectorized Lower",unit:"ft",length:5.26,width:1.89,height:5.30};
    GymTests.equal(equipmentModelProfile(item),"adductor-combo");
  });

  GymTests.test("maps exact profiles to their matching families",()=>{
    GymTests.deepEqual(exactProfiles.map(profile=>MODEL3D_PROFILE_FAMILY[profile]),[
      "cold-plunge","stair-climber","treadmill","bench",
      "rowing-machine","rowing-machine","adductor","storage-rack",
    ]);
  });

  GymTests.test("labels only dedicated procedural models as photo-matched",()=>{
    const exactItem={brand:"Ice Barrel",name:"Ice Barrel 500",category:"Cold Plunge"};
    GymTests.assert(itemUsesPhotoMatched3d(exactItem));
    GymTests.assert(itemUsesPhotoMatched3d({name:"Gazelle Pro",category:"Leg Press"}));
    GymTests.assert(!itemUsesPhotoMatched3d({brand:"Another Brand",name:"Incline Treadmill",category:"Cardio & Conditioning"}));
    GymTests.assert(!itemUsesPhotoMatched3d({...exactItem,model3dAssetRef:"local:ice-barrel.glb"}));
  });

  GymTests.test("provides an initially empty external equipment-model registry",()=>{
    GymTests.assert(window.GymEquipmentModels,"Expected the GymEquipmentModels registry namespace");
    ["has","keys","build","createModelKit"].forEach(key=>GymTests.equal(typeof window.GymEquipmentModels[key],"function"));
    GymTests.deepEqual(window.GymEquipmentModels.keys(),[]);
    exactProfiles.forEach(profile=>GymTests.assert(!window.GymEquipmentModels.has(profile),`${profile} should not be registered before its builder lands`));
  });
})();
