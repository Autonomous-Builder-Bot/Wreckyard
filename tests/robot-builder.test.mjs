import test from "node:test";
import assert from "node:assert/strict";
import { CHASSIS, PARTS, STARTER_DESIGN, normalizeDesign, designStats } from "../src/robot-data.js";
import { defaultGame, loadGame, saveGame, SAVE_KEY, SAVE_VERSION, canPlace } from "../src/state.js";
import { buildQuote, manufacture, saveBlueprint, MAX_FLEET } from "../src/robot-logic.js";

test("catalog and initial design support socket-based building", () => {
  assert.equal(Object.keys(CHASSIS).length, 3);
  assert.ok(Object.keys(PARTS).length >= 20);
  assert.equal(designStats(STARTER_DESIGN).ready, true);
  assert.equal(CHASSIS.juggernaut.slots.length, 12);
  const wrong=normalizeDesign({chassis:"scout",slots:{core:"nailgun",driveL:"wheel",driveR:"wheel"}});
  assert.equal(wrong.slots.core,undefined);
  assert.equal(designStats(wrong).ready,false);
});

test("factory placement from Step 1 remains intact", () => {
  const game=defaultGame();
  assert.equal(canPlace(game.factory.machines,"forge",2,2),false);
  assert.equal(canPlace(game.factory.machines,"conveyor",0,0),true);
  assert.equal(canPlace(game.factory.machines,"forge",11,7),false);
});

test("fabrication charges materials and rejects unaffordable units", () => {
  const game=defaultGame(),initial=game.resources.scrap;
  const design={name:"Runner",chassis:"scout",slots:{driveL:"wheel",driveR:"wheel",core:"cell"}};
  const quoted=buildQuote(game,design);
  assert.equal(quoted.ready,true);
  const done=manufacture(game,design);
  assert.equal(done.ok,true);
  assert.equal(game.resources.scrap,initial-quoted.cost.scrap);
  assert.equal(game.fleet.length,2);
  const funds=game.resources.scrap;
  game.resources.alloy=0;
  const failed=manufacture(game,{...design,chassis:"juggernaut"});
  assert.equal(failed.ok,false);
  assert.equal(game.resources.scrap,funds);
  assert.equal(game.fleet.length,2);
});

test("refits reuse installed components and stash removed parts", () => {
  const game=defaultGame();
  const same=buildQuote(game,STARTER_DESIGN,"robot-1");
  assert.equal(same.cost.scrap,0);
  assert.equal(same.cost.alloy,0);
  const changed={...STARTER_DESIGN,slots:{...STARTER_DESIGN.slots,armL:"cutter"}};
  const quote=buildQuote(game,changed,"robot-1");
  assert.equal(quote.spendStock.cutter,1);
  assert.equal(quote.returnStock.claw,1);
  const total=game.resources.scrap;
  const result=manufacture(game,changed,"robot-1");
  assert.equal(result.ok,true);
  assert.equal(game.resources.scrap,total);
  assert.equal(game.inventory.parts.claw,1);
  assert.equal(game.inventory.parts.cutter,undefined);
});

test("blueprints round-trip through the versioned save", () => {
  const saved=new Map();
  globalThis.localStorage={
    getItem:k=>saved.get(k)||null,
    setItem:(k,v)=>saved.set(k,v)
  };
  const game=defaultGame();
  const bp=saveBlueprint(game,STARTER_DESIGN);
  assert.equal(bp.ok,true);
  assert.equal(saveGame(game),true);
  const loaded=loadGame();
  assert.equal(loaded.version,SAVE_VERSION);
  assert.equal(loaded.blueprints.length,1);
  assert.equal(loaded.blueprints[0].design.name,STARTER_DESIGN.name);
});

test("version 1 saves preserve resources and factory tiles", () => {
  const legacy={
    version:1,resources:{scrap:97,alloy:4,credits:13},
    fleet:[{id:"robot-1",name:"OLDBOT",condition:47,status:"Docked"}],
    factory:{machines:[{id:"abc",type:"forge",x:0,y:0,rotation:0}]}
  };
  globalThis.localStorage={getItem:k=>k===SAVE_KEY?JSON.stringify(legacy):null,setItem:()=>{}};
  const game=loadGame();
  assert.equal(game.version,4);
  assert.equal(game.resources.scrap,97);
  assert.equal(game.factory.machines[0].id,"abc");
  assert.equal(game.fleet[0].name,"OLDBOT");
  assert.equal(game.fleet[0].condition,47);
  assert.ok(game.fleet[0].design);
});

test("fleet limit and power constraints prevent invalid builds", () => {
  const game=defaultGame();
  const weak={name:"Too hungry",chassis:"scout",slots:{driveL:"hover",driveR:"hover",core:"cell",armL:"plasma",armR:"plasma"}};
  assert.equal(designStats(weak).ready,false);
  assert.equal(manufacture(game,weak).ok,false);
  game.fleet=Array.from({length:MAX_FLEET},(_,i)=>({...game.fleet[0],id:"robot-"+i}));
  assert.equal(buildQuote(game,STARTER_DESIGN).ready,false);
});
