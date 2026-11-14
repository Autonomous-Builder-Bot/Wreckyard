import test from "node:test";
import assert from "node:assert/strict";
import { defaultGame, loadGame, saveGame, SAVE_KEY, SAVE_VERSION, MACHINE_TYPES, STARTER_MACHINE_STOCK } from "../src/state.js";
import { advanceFactory, toggleProduction } from "../src/factory-sim.js";
import {
  machineStock, stockCount, machineTotals, buyMachine, placeOwnedMachine,
  removeOwnedMachine, clearFactoryLayout, starterLineQuote, installStarterLine
} from "../src/machine-inventory.js";

function freezeResources(g){return JSON.stringify(g.resources);}
const copy=v=>JSON.parse(JSON.stringify(v));

test("default stock is separate from machines already on the factory floor",()=>{
  const game=defaultGame();
  const installed=game.factory.machines.filter(x=>x.type==="conveyor").length;
  assert.ok(installed>0);
  assert.equal(stockCount(game,"conveyor"),STARTER_MACHINE_STOCK.conveyor);
  assert.equal(machineTotals(game).conveyor,installed+stockCount(game,"conveyor"));
  assert.ok(Object.keys(MACHINE_TYPES).every(type=>stockCount(game,type)>=0));
});

test("placing a purchased machine consumes stock but does not double charge raw resources",()=>{
  const game=defaultGame();
  const original=stockCount(game,"conveyor"),res=freezeResources(game);
  const placed=placeOwnedMachine(game,"conveyor",3,5,180,"new1");
  assert.equal(placed.ok,true);
  assert.equal(stockCount(game,"conveyor"),original-1);
  assert.equal(freezeResources(game),res);
  const overlap=placeOwnedMachine(game,"conveyor",3,5,180,"new2");
  assert.equal(overlap.ok,false);
  assert.equal(stockCount(game,"conveyor"),original-1);
  const removed=removeOwnedMachine(game,"new1");
  assert.equal(removed.ok,true);
  assert.equal(stockCount(game,"conveyor"),original);
  assert.equal(removeOwnedMachine(game,"new1").ok,false);
});

test("buying equipment spends scrap and alloy exactly once",()=>{
  const game=defaultGame();
  const cost=MACHINE_TYPES.forge.cost,res=copy(game.resources),stock=stockCount(game,"forge");
  const result=buyMachine(game,"forge");
  assert.equal(result.ok,true);
  assert.equal(game.resources.scrap,res.scrap-cost.scrap);
  assert.equal(game.resources.alloy,res.alloy-cost.alloy);
  assert.equal(stockCount(game,"forge"),stock+1);
  game.resources.scrap=0;
  assert.equal(buyMachine(game,"forge").ok,false);
  assert.equal(stockCount(game,"forge"),stock+1);
  assert.equal(buyMachine(game,"invalid").ok,false);
});

test("clearing the layout returns every owned machine and refunds in-progress inputs",()=>{
  const game=defaultGame();
  const all=machineTotals(game),res=copy(game.resources);
  toggleProduction(game);
  advanceFactory(game,0.25);
  assert.ok(game.resources.scrap<res.scrap);
  const result=clearFactoryLayout(game);
  assert.equal(result.ok,true);
  assert.equal(game.factory.machines.length,0);
  assert.equal(game.factory.production.running,false);
  assert.deepEqual(game.factory.production.jobs,{});
  assert.equal(game.resources.scrap,res.scrap);
  assert.equal(game.resources.alloy,res.alloy);
  for(const [type,total] of Object.entries(all))assert.equal(stockCount(game,type),total);
  assert.equal(clearFactoryLayout(game).count,0);
  for(const [type,total] of Object.entries(all))assert.equal(stockCount(game,type),total);
});

test("starter line rearrangement never duplicates free machines",()=>{
  const game=defaultGame(),original=machineTotals(game),resources=freezeResources(game);
  assert.equal(starterLineQuote(game).cost.scrap,0);
  assert.equal(installStarterLine(game).ok,true);
  assert.equal(installStarterLine(game).ok,true);
  assert.deepEqual(machineTotals(game),original);
  assert.equal(freezeResources(game),resources);
  clearFactoryLayout(game);
  assert.equal(installStarterLine(game).ok,true);
  assert.deepEqual(machineTotals(game),original);
});

test("starter line purchases only missing machines and refuses unaffordable changes atomically",()=>{
  const game=defaultGame();
  clearFactoryLayout(game);
  game.inventory.machines.forge=0;
  const earlier=copy(game.inventory.machines);
  const missing=starterLineQuote(game);
  assert.equal(missing.missing.forge,1);
  assert.equal(missing.cost.scrap,MACHINE_TYPES.forge.cost.scrap);
  game.resources.scrap=0;
  const before=JSON.stringify({stock:game.inventory.machines,machines:game.factory.machines,resources:game.resources});
  assert.equal(installStarterLine(game).ok,false);
  assert.equal(JSON.stringify({stock:game.inventory.machines,machines:game.factory.machines,resources:game.resources}),before);
  game.resources.scrap=100;
  const pre=copy(game.resources);
  assert.equal(installStarterLine(game).ok,true);
  assert.equal(game.resources.scrap,pre.scrap-MACHINE_TYPES.forge.cost.scrap);
  assert.equal(game.inventory.machines.forge,0);
});

test("v3 migration retains custom layout and grants starter spare equipment once",()=>{
  const data=new Map();
  globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,v)=>data.set(key,v)};
  const old=defaultGame();
  old.version=3;
  delete old.inventory.machines;
  old.factory.machines=[{id:"custom-forge",type:"forge",x:2,y:2,rotation:0}];
  data.set(SAVE_KEY,JSON.stringify(old));
  const migrated=loadGame();
  assert.equal(migrated.version,5);
  assert.equal(migrated.factory.machines[0].id,"custom-forge");
  assert.equal(stockCount(migrated,"conveyor"),STARTER_MACHINE_STOCK.conveyor);
  assert.equal(stockCount(migrated,"forge"),STARTER_MACHINE_STOCK.forge);
  buyMachine(migrated,"conveyor");
  saveGame(migrated);
  const loaded=loadGame();
  assert.equal(loaded.inventory.machines.conveyor,STARTER_MACHINE_STOCK.conveyor+1);
  assert.equal(loaded.factory.machines[0].id,"custom-forge");
  assert.equal(loadGame().inventory.machines.conveyor,loaded.inventory.machines.conveyor);
});
