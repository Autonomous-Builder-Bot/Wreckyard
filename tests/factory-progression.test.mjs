import test from "node:test";
import assert from "node:assert/strict";
import { defaultGame, loadGame, saveGame, SAVE_KEY, MACHINE_TYPES } from "../src/state.js";
import { buildQuote } from "../src/robot-logic.js";
import { findRoute, factoryStatus, advanceFactory, toggleProduction, refundJobs, removeMachineProduction, recipeCost, setMachineRecipe } from "../src/factory-sim.js";
import { RESEARCH, REGIONS, researchStatus, purchaseResearch, missionStatus, startMission, advanceMissions, repairRobot } from "../src/progression.js";

const run=(game,seconds)=>{for(let elapsed=0;elapsed<seconds;elapsed+=0.25)advanceFactory(game,0.25);};
const currentMachines=game=>game.factory.machines;

test("starter line has a valid directed storage → forge → builder → warehouse route",()=>{
  const game=defaultGame(),list=currentMachines(game);
  const storage=list.find(x=>x.id==="m1");
  const forge=list.find(x=>x.type==="forge");
  const assembler=list.find(x=>x.type==="assembler");
  const output=list.find(x=>x.id==="m8");
  assert.ok(findRoute(list,storage,forge));
  assert.ok(findRoute(list,forge,assembler));
  assert.ok(findRoute(list,assembler,output));
  assert.equal(factoryStatus(game).power.capacity,30);
  assert.equal(factoryStatus(game).running,false);
  toggleProduction(game);
  const report=factoryStatus(game);
  assert.equal(report.active,2);
  assert.equal(report.processors.filter(p=>p.ready).length,2);
});

test("production spends materials only for actual jobs and delivers usable parts",()=>{
  const game=defaultGame();
  const scrap=game.resources.scrap,parts=game.inventory.parts.wheel||0;
  toggleProduction(game);
  run(game,36);
  assert.ok(game.resources.scrap<scrap);
  assert.ok(game.resources.scrap>=0);
  assert.ok(game.resources.alloy>=0);
  assert.ok(game.factory.production.totals.alloy>0);
  assert.ok(game.factory.production.totals.parts>=1);
  assert.ok((game.inventory.parts.wheel||0)>parts);
  const jobs=Object.values(game.factory.production.jobs);
  assert.ok(jobs.every(j=>j.cost.scrap>=0));
});

test("pausing freezes production and prevents hidden resource spending",()=>{
  const game=defaultGame();
  toggleProduction(game);
  advanceFactory(game,0.25);
  toggleProduction(game);
  const saved=JSON.stringify({resources:game.resources,jobs:game.factory.production.jobs,packets:game.factory.production.deliveries});
  run(game,60);
  const after=JSON.stringify({resources:game.resources,jobs:game.factory.production.jobs,packets:game.factory.production.deliveries});
  assert.equal(after,saved);
});

test("conveyor directions, bottlenecks and power actually gate forge production",()=>{
  const game=defaultGame();
  toggleProduction(game);
  const forge=game.factory.machines.find(m=>m.type==="forge");
  assert.equal(factoryStatus(game).processors.find(x=>x.machine.id===forge.id).ready,true);
  game.factory.machines.find(m=>m.id==="m5").rotation=180;
  assert.equal(factoryStatus(game).processors.find(x=>x.machine.id===forge.id).ready,false);
  game.factory.machines.find(m=>m.id==="m5").rotation=0;
  game.factory.machines=game.factory.machines.filter(m=>m.type!=="generator");
  assert.equal(factoryStatus(game).processors.every(x=>!x.powered),true);
});

test("removing a running machine refunds reserved inputs but not finished items",()=>{
  const game=defaultGame(),startScrap=game.resources.scrap,startAlloy=game.resources.alloy;
  toggleProduction(game);
  advanceFactory(game,0.25);
  assert.ok(game.resources.scrap<startScrap);
  refundJobs(game);
  assert.equal(game.resources.scrap,startScrap);
  assert.equal(game.resources.alloy,startAlloy);
  assert.deepEqual(game.factory.production.jobs,{});
  assert.deepEqual(game.factory.production.deliveries,[]);
  advanceFactory(game,0.25);
  const forge=game.factory.machines.find(m=>m.type==="forge");
  const before=game.resources.scrap;
  removeMachineProduction(game,forge.id);
  assert.ok(game.resources.scrap>before);
  assert.equal(game.factory.production.jobs[forge.id],undefined);
});

test("factory recipes share catalog, use discounted inputs, and reject bad IDs",()=>{
  const game=defaultGame(),builder=game.factory.machines.find(m=>m.type==="assembler");
  const cost=recipeCost(game,"railgun");
  assert.ok(cost.scrap>0);
  assert.ok(cost.scrap<MACHINE_TYPES.assembler.cost.scrap*3);
  assert.ok(cost.scrap<85);
  assert.equal(setMachineRecipe(game,builder.id,"railgun"),true);
  assert.equal(setMachineRecipe(game,builder.id,"not_a_part"),false);
  assert.equal(game.factory.production.recipes[builder.id],"railgun");
  assert.equal(recipeCost(game,"not_a_part"),null);
});

test("expeditions use installed robot performance and pay once after completion",()=>{
  const game=defaultGame();
  const now=10000,initial={...game.resources},condition=game.fleet[0].condition;
  assert.equal(missionStatus(game,"flats","robot-1").available,true);
  const launch=startMission(game,"flats","robot-1",now);
  assert.equal(launch.ok,true);
  assert.equal(game.fleet[0].status,"Scavenging");
  assert.equal(startMission(game,"flats","robot-1",now).ok,false);
  assert.ok(launch.mission.reward.scrap<=24);
  assert.equal(buildQuote(game,game.fleet[0].design,"robot-1").ready,false);
  assert.equal(repairRobot(game,"robot-1").ok,false);
  assert.equal(advanceMissions(game,launch.mission.endsAt-1).length,0);
  const events=advanceMissions(game,launch.mission.endsAt);
  assert.equal(events.length,1);
  assert.equal(game.resources.scrap,initial.scrap+launch.mission.reward.scrap);
  assert.equal(game.resources.alloy,initial.alloy+launch.mission.reward.alloy);
  assert.equal(game.resources.credits,initial.credits+launch.mission.reward.credits);
  assert.ok(game.fleet[0].condition<condition);
  assert.equal(game.fleet[0].status,"Docked");
  assert.equal(advanceMissions(game,launch.mission.endsAt+60000).length,0);
});

test("repairs consume materials and restore condition",()=>{
  const game=defaultGame(),scrap=game.resources.scrap;
  const result=repairRobot(game,"robot-1");
  assert.equal(result.ok,true);
  assert.equal(game.fleet[0].condition,100);
  assert.ok(game.resources.scrap<scrap);
  assert.equal(repairRobot(game,"robot-1").ok,false);
});

test("research prerequisites gate expedition regions and production bonuses",()=>{
  const game=defaultGame();
  assert.equal(missionStatus(game,"relay","robot-1").available,false);
  assert.equal(researchStatus(game,"prospecting").available,false);
  assert.equal(purchaseResearch(game,"prospecting").ok,false);
  const before=game.resources.credits;
  assert.equal(purchaseResearch(game,"salvaging").ok,true);
  assert.ok(game.resources.credits<before);
  assert.equal(missionStatus(game,"relay","robot-1").available,true);
  assert.equal(purchaseResearch(game,"salvaging").ok,false);
  assert.equal(purchaseResearch(game,"smelting").ok,true);
  assert.equal(game.research.unlocked.includes("smelting"),true);
  assert.equal(RESEARCH.smelting.cost.scrap>0,true);
  assert.equal(Object.keys(REGIONS).length,4);
});

test("version 2 files migrate without changing blueprints, resources or factory",()=>{
  const prior={
    version:2,resources:{scrap:84,alloy:19,credits:220},
    factory:{machines:[{id:"custom",type:"forge",x:0,y:0,rotation:0}]},
    inventory:{parts:{cutter:4}},blueprints:[{id:"bp-test",design:{name:"VAULT",chassis:"scout",slots:{}}}],
    builder:{draft:{name:"VAULT",chassis:"scout",slots:{}},editingRobotId:"robot-1",selectedBlueprintId:"bp-test"},
    fleet:[{id:"robot-1",name:"OLD",type:"Utility",condition:55,status:"Docked",design:{name:"OLD",chassis:"scout",slots:{}}}]
  };
  globalThis.localStorage={getItem:key=>key===SAVE_KEY?JSON.stringify(prior):null,setItem:()=>{}};
  const game=loadGame();
  assert.equal(game.version,3);
  assert.equal(game.factory.machines.length,1);
  assert.equal(game.factory.machines[0].id,"custom");
  assert.equal(game.resources.scrap,84);
  assert.equal(game.fleet[0].condition,55);
  assert.equal(game.inventory.parts.cutter,4);
  assert.equal(game.blueprints[0].design.name,"VAULT");
});

test("version 3 saves persist active expeditions and partially completed factory jobs",()=>{
  const store=new Map();
  globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
  const game=defaultGame();
  toggleProduction(game);
  advanceFactory(game,0.25);
  assert.ok(Object.keys(game.factory.production.jobs).length>0);
  const launch=startMission(game,"flats","robot-1",15000);
  assert.equal(launch.ok,true);
  assert.equal(saveGame(game),true);
  const restored=loadGame();
  assert.equal(restored.version,3);
  assert.equal(restored.factory.production.running,true);
  assert.ok(Object.keys(restored.factory.production.jobs).length>0);
  assert.equal(restored.missions.active.length,1);
  assert.equal(restored.fleet[0].status,"Scavenging");
  const result=advanceMissions(restored,launch.mission.endsAt);
  assert.equal(result.length,1);
  assert.equal(advanceMissions(restored,launch.mission.endsAt).length,0);
});
