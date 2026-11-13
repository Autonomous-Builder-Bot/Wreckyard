import { designStats } from "./robot-data.js";

export const RESEARCH={
  smelting:{name:"High-Yield Smelting",branch:"Industry",description:"Forges produce 3 alloy per 4 scrap instead of 2.",cost:{scrap:55,alloy:9,credits:100},requires:[]},
  logistics:{name:"Express Conveyors",branch:"Industry",description:"Material deliveries travel over twice as fast.",cost:{scrap:95,alloy:18,credits:160},requires:["smelting"]},
  automation:{name:"Automated Tooling",branch:"Industry",description:"Forges and builders work about 30% faster.",cost:{scrap:125,alloy:24,credits:230},requires:["logistics"]},
  precision:{name:"Precision Manufacturing",branch:"Industry",description:"Builders spend less scrap and alloy per component.",cost:{scrap:165,alloy:32,credits:280},requires:["automation"]},
  salvaging:{name:"Salvage Mapping",branch:"Exploration",description:"Increases scrap returns and reveals the Relay Station.",cost:{scrap:35,alloy:5,credits:60},requires:[]},
  prospecting:{name:"Deep Prospecting",branch:"Exploration",description:"Unlocks the Iron Pit and improves alloy finds.",cost:{scrap:90,alloy:13,credits:150},requires:["salvaging"]},
  armorSurvey:{name:"Armored Expeditions",branch:"Exploration",description:"Reduces expedition wear and unlocks the Blacksite.",cost:{scrap:145,alloy:23,credits:240},requires:["prospecting"]}
};
export const REGIONS={
  flats:{name:"The Rust Flats",description:"A scattered field of abandoned haulers and debris.",seconds:24,risk:7,scrap:19,alloy:1,credits:28,requires:null},
  relay:{name:"Broken Relay Station",description:"Old communications equipment and salvage electronics.",seconds:42,risk:12,scrap:29,alloy:3,credits:52,requires:"salvaging"},
  pit:{name:"The Iron Pit",description:"Tough terrain with valuable buried industrial machinery.",seconds:66,risk:19,scrap:44,alloy:7,credits:83,requires:"prospecting"},
  blacksite:{name:"The Blacksite",description:"A remote armored installation full of rare salvage.",seconds:95,risk:27,scrap:59,alloy:12,credits:130,requires:"armorSurvey"}
};
export function ensureProgress(game) {
  game.research ||= {unlocked:[]};
  if(!Array.isArray(game.research.unlocked))game.research.unlocked=[];
  game.missions ||= {active:[],history:[],selectedRobotId:game.fleet?.[0]?.id||null};
  game.missions.active ||= [];
  game.missions.history ||= [];
  return game.missions;
}
export function hasTech(game,id){return game.research?.unlocked?.includes(id)===true;}
export function researchStatus(game,id){
  const tech=RESEARCH[id];
  if(!tech)return {available:false,reason:"Unknown research"};
  if(hasTech(game,id))return {available:false,reason:"Researched"};
  const needed=tech.requires.filter(req=>!hasTech(game,req));
  if(needed.length)return {available:false,reason:"Requires "+needed.map(req=>RESEARCH[req].name).join(", ")};
  const lack=Object.entries(tech.cost).filter(([res,amount])=>(game.resources[res]||0)<amount);
  if(lack.length)return {available:false,reason:"Not enough "+lack.map(([res])=>res).join(" or ")};
  return {available:true,reason:"Ready"};
}
export function purchaseResearch(game,id){
  const check=researchStatus(game,id);
  if(!check.available)return {ok:false,message:check.reason};
  for(const [resource,n]of Object.entries(RESEARCH[id].cost))game.resources[resource]-=n;
  game.research.unlocked.push(id);
  return {ok:true,message:"Research complete: "+RESEARCH[id].name};
}
function missionRewards(game,region,robot){
  const stats=designStats(robot.design),cargo=Math.max(0,stats.cargo);
  const efficiency=Math.max(0.3,Math.min(2,0.68+stats.salvage/24));
  const bonus=hasTech(game,"salvaging")?1.22:1;
  const alloyBonus=hasTech(game,"prospecting")?2:0;
  // One alloy weighs 3 cargo units. All rewards are bounded by actual cargo space.
  const alloy=Math.min(Math.floor(cargo/5),Math.round(region.alloy*efficiency)+alloyBonus);
  const scrap=Math.max(0,Math.min(cargo-alloy*3,Math.round(region.scrap*efficiency*bonus)));
  const credits=Math.round(region.credits*(0.8+Math.min(1,stats.speed/20)));
  const defenses=stats.armor*0.13+stats.hp*0.045+stats.damage*0.07;
  const protection=hasTech(game,"armorSurvey")?4:0;
  const wear=Math.max(2,Math.round(region.risk-defenses*0.12-protection));
  return {scrap,alloy,credits,wear};
}
export function missionStatus(game,regionId,robotId){
  ensureProgress(game);
  const region=REGIONS[regionId],robot=game.fleet.find(r=>r.id===robotId);
  if(!region)return {available:false,reason:"Unknown region"};
  if(region.requires&&!hasTech(game,region.requires))return {available:false,reason:"Research "+RESEARCH[region.requires].name+" first"};
  if(!robot)return {available:false,reason:"Select a robot"};
  if(game.missions.active.some(m=>m.robotId===robot.id))return {available:false,reason:"Robot already deployed"};
  if(robot.status!=="Docked")return {available:false,reason:"Robot is not docked"};
  if(robot.condition<20)return {available:false,reason:"Repair robot first (20% minimum)"};
  const stats=designStats(robot.design);
  if(!stats.ready)return {available:false,reason:stats.issues.join("; ")};
  if(stats.salvage<1)return {available:false,reason:"Install a scavenging tool or scanner"};
  if(stats.cargo<4)return {available:false,reason:"Install cargo equipment"};
  return {available:true,reason:"Ready",rewards:missionRewards(game,region,robot)};
}
export function startMission(game,regionId,robotId,now=Date.now()){
  const status=missionStatus(game,regionId,robotId);
  if(!status.available)return {ok:false,message:status.reason};
  const region=REGIONS[regionId],robot=game.fleet.find(r=>r.id===robotId);
  const duration=Math.max(14,Math.round(region.seconds*(1.08-Math.min(0.35,designStats(robot.design).speed/110))));
  const mission={id:"exp-"+now+"-"+Math.random().toString(36).slice(2,7),
    robotId:robot.id,regionId,startedAt:now,endsAt:now+duration*1000,
    reward:status.rewards};
  game.missions.active.push(mission);
  robot.status="Scavenging";
  return {ok:true,message:robot.name+" deployed to "+region.name+".",mission};
}
export function advanceMissions(game,now=Date.now()){
  ensureProgress(game);
  const events=[];
  const remaining=[];
  for(const mission of game.missions.active){
    if(now<mission.endsAt){remaining.push(mission);continue;}
    const robot=game.fleet.find(r=>r.id===mission.robotId);
    if(robot){
      const r=mission.reward;
      game.resources.scrap+=r.scrap;
      game.resources.alloy+=r.alloy;
      game.resources.credits+=r.credits;
      robot.condition=Math.max(0,Math.round(robot.condition-r.wear));
      robot.status="Docked";
      const item={id:mission.id,robotId:robot.id,robotName:robot.name,regionId:mission.regionId,reward:{...r},finishedAt:now};
      game.missions.history.unshift(item);
      events.push(item);
    }
  }
  game.missions.active=remaining;
  game.missions.history=game.missions.history.slice(0,20);
  return events;
}
export function repairQuote(robot){
  const missing=Math.max(0,100-Math.max(0,Math.min(100,robot.condition||0)));
  return {scrap:Math.ceil(missing*0.65),alloy:Math.ceil(missing/20)};
}
export function repairRobot(game,id){
  ensureProgress(game);
  const robot=game.fleet.find(r=>r.id===id);
  if(!robot)return {ok:false,message:"Robot not found"};
  if(robot.status!=="Docked"||game.missions.active.some(m=>m.robotId===id))
    return {ok:false,message:"Robot must return before repairs"};
  const cost=repairQuote(robot);
  if(cost.scrap===0)return {ok:false,message:"Robot is already fully repaired"};
  if(game.resources.scrap<cost.scrap||game.resources.alloy<cost.alloy)return {ok:false,message:"Not enough materials for repairs"};
  game.resources.scrap-=cost.scrap;
  game.resources.alloy-=cost.alloy;
  robot.condition=100;
  return {ok:true,message:robot.name+" repaired to 100%."};
}
