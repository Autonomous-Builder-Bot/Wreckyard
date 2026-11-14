import test from "node:test";
import assert from "node:assert/strict";
import { defaultGame, loadGame, saveGame, SAVE_KEY, SAVE_VERSION } from "../src/state.js";
import { enemyDesign, initialArena, canFight, startFight, advanceFight, advanceArena, settleFight, fightRewards } from "../src/arena-sim.js";
import { designStats } from "../src/robot-data.js";
import { startMission } from "../src/progression.js";

const finish=(game)=>{let done=null;for(let i=0;i<1000&&!done;i++)done=advanceArena(game,.10);return done;};

test("arena is available immediately and the starting robot is combat-ready",()=>{
  const game=defaultGame();
  assert.equal(game.version,5);
  assert.equal(game.arena.level,1);
  assert.equal(game.arena.wins,0);
  assert.equal(canFight(game,"robot-1").ready,true);
  for(const lvl of [1,2,4,5,9,12,20,80]){
    const enemy=enemyDesign(lvl);
    assert.ok(designStats(enemy).ready,"Enemy round "+lvl+" must use a valid build");
  }
});

test("arena matches have no entry cost and lock a single fighter until completion",()=>{
  const game=defaultGame();
  const resources={...game.resources};
  const started=startFight(game,"robot-1",10000);
  assert.equal(started.ok,true);
  assert.deepEqual(game.resources,resources);
  assert.equal(game.fleet[0].status,"Fighting");
  assert.equal(canFight(game,"robot-1").ready,false);
  assert.equal(startFight(game,"robot-1",20000).ok,false);
  assert.equal(game.arena.active.level,1);
});

test("both autonomous AIs move and attack without player input, eventually resolving the duel",()=>{
  const game=defaultGame();
  const started=startFight(game,"robot-1",30000);
  assert.equal(started.ok,true);
  const before=started.match.player.x;
  const result=finish(game);
  assert.equal(result.ok,true);
  assert.equal(game.arena.active,null);
  assert.ok(started.match.elapsed>1);
  assert.notEqual(started.match.player.x,before);
  assert.ok(started.match.events.some(e=>e.type==="hit"));
  assert.ok(["player","enemy"].includes(started.match.winner));
  assert.equal(game.fleet[0].status,"Docked");
});

test("wins pay rewards exactly once, increase difficulty and permit unlimited successive fights",()=>{
  const game=defaultGame(),resources={...game.resources};
  const started=startFight(game,"robot-1",40000);
  started.match.enemy.hp=1;
  started.match.player.damage=200;
  const result=finish(game);
  assert.equal(result.ok,true);
  assert.equal(result.result.won,true);
  assert.equal(game.arena.level,2);
  assert.equal(game.arena.wins,1);
  assert.equal(game.arena.streak,1);
  const reward=fightRewards(1,true);
  assert.equal(game.resources.scrap,resources.scrap+reward.scrap);
  assert.equal(game.resources.alloy,resources.alloy+reward.alloy);
  assert.equal(game.resources.credits,resources.credits+reward.credits);
  assert.equal(advanceArena(game,5),null);
  assert.equal(settleFight(game,started.match).ok,false);
  assert.equal(game.resources.scrap,resources.scrap+reward.scrap);
  const next=startFight(game,"robot-1",41000);
  assert.equal(next.ok,true);
  assert.equal(next.match.level,2);
  assert.equal(game.fleet[0].condition,84,"Exhibition fights do not permanently damage equipment");
});

test("losing an arena fight permits retrying at the same level with no cooldown",()=>{
  const game=defaultGame();
  const match=startFight(game,"robot-1",50000).match;
  match.player.hp=1;
  match.enemy.damage=250;
  const result=finish(game);
  assert.equal(result.result.won,false);
  assert.equal(game.arena.level,1);
  assert.equal(game.arena.losses,1);
  assert.equal(game.arena.streak,0);
  assert.equal(game.arena.last.won,false);
  assert.equal(startFight(game,"robot-1",51000).ok,true);
});

test("fighting a robot currently deployed scavenging is blocked",()=>{
  const game=defaultGame();
  const mission=startMission(game,"flats","robot-1",60000);
  assert.equal(mission.ok,true);
  assert.equal(canFight(game,"robot-1").ready,false);
  assert.equal(startFight(game,"robot-1",61000).ok,false);
});

test("unresolved fights persist through save/load and cannot be cashed twice",()=>{
  const data=new Map();
  globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  const game=defaultGame();
  const match=startFight(game,"robot-1",70000).match;
  advanceArena(game,2);
  assert.equal(saveGame(game),true);
  const restored=loadGame();
  assert.equal(restored.version,SAVE_VERSION);
  assert.equal(restored.arena.active.id,match.id);
  assert.equal(restored.fleet[0].status,"Fighting");
  assert.ok(restored.arena.active.elapsed>=1.5);
  restored.arena.active.enemy.hp=1;
  restored.arena.active.player.damage=200;
  const result=finish(restored);
  assert.equal(result.ok,true);
  saveGame(restored);
  const loaded=loadGame();
  assert.equal(loaded.arena.active,null);
  assert.equal(loaded.arena.wins+loaded.arena.losses,1);
  assert.equal(loaded.fleet[0].status,"Docked");
});

test("version 4 files migrate without damaging existing robots, machine stock or missions",()=>{
  const old=defaultGame();
  old.version=4;delete old.arena;
  old.inventory.machines.conveyor=9;
  old.resources.scrap=321;
  old.fleet[0].condition=49;
  globalThis.localStorage={getItem:k=>k===SAVE_KEY?JSON.stringify(old):null,setItem:()=>{}};
  const restored=loadGame();
  assert.equal(restored.version,5);
  assert.equal(restored.arena.level,1);
  assert.equal(restored.inventory.machines.conveyor,9);
  assert.equal(restored.resources.scrap,321);
  assert.equal(restored.fleet[0].condition,49);
});
