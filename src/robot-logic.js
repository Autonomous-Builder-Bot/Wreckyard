import { CHASSIS, PARTS, STARTER_DESIGN, normalizeDesign, designStats } from "./robot-data.js";

export const MAX_FLEET=12, MAX_BLUEPRINTS=30;

export function starterRobot(){
  return {id:"robot-1",name:STARTER_DESIGN.name,type:"Utility",condition:84,status:"Docked",design:normalizeDesign(STARTER_DESIGN)};
}
export function countParts(design){
  const counts={};
  for(const id of Object.values(normalizeDesign(design).slots))counts[id]=(counts[id]||0)+1;
  return counts;
}
export function buildQuote(game,raw,robotId=null){
  const design=normalizeDesign(raw);
  const existing=robotId ? game.fleet.find(r=>r.id===robotId) : null;
  const old=existing?.design ? normalizeDesign(existing.design) : null;
  const owned=old ? countParts(old) : {};
  const required=countParts(design);
  const stock=game.inventory?.parts||{};
  const spendStock={},craft={},returnStock={},cost={scrap:0,alloy:0};
  for(const [part,quantity] of Object.entries(required)){
    const fromCurrent=Math.min(owned[part]||0,quantity);
    owned[part]=(owned[part]||0)-fromCurrent;
    let shortage=quantity-fromCurrent;
    const take=Math.min(Math.max(0,Number(stock[part])||0),shortage);
    if(take){spendStock[part]=take;shortage-=take;}
    if(shortage){
      craft[part]=shortage;
      cost.scrap+=PARTS[part].cost.scrap*shortage;
      cost.alloy+=PARTS[part].cost.alloy*shortage;
    }
  }
  for(const [id,count] of Object.entries(owned))if(count>0)returnStock[id]=count;
  const chassisChanged=!old||old.chassis!==design.chassis;
  if(chassisChanged){
    cost.scrap+=CHASSIS[design.chassis].cost.scrap;
    cost.alloy+=CHASSIS[design.chassis].cost.alloy;
  }
  const stats=designStats(design);
  const errors=[...stats.issues];
  if(existing && existing.status!=="Docked")errors.push("Robot must return before refitting");
  if(!existing && game.fleet.length>=MAX_FLEET)errors.push("Hangar full (12 robots)");
  if((game.resources.scrap||0)<cost.scrap)errors.push("Not enough scrap");
  if((game.resources.alloy||0)<cost.alloy)errors.push("Not enough alloy");
  return {design,robotId:existing?.id||null,cost,craft,spendStock,returnStock,stats,errors,ready:errors.length===0};
}
export function manufacture(game,raw,robotId=null){
  const quote=buildQuote(game,raw,robotId);
  if(!quote.ready)return {ok:false,message:quote.errors.join(" • "),quote};
  const existing=robotId ? game.fleet.find(r=>r.id===robotId) : null;
  game.resources.scrap-=quote.cost.scrap;
  game.resources.alloy-=quote.cost.alloy;
  game.inventory ||= {parts:{}};
  game.inventory.parts ||= {};
  for(const [id,count] of Object.entries(quote.spendStock)){
    game.inventory.parts[id]-=count;
    if(game.inventory.parts[id]===0)delete game.inventory.parts[id];
  }
  for(const [id,count] of Object.entries(quote.returnStock)){
    game.inventory.parts[id]=(game.inventory.parts[id]||0)+count;
  }
  if(existing){
    existing.design=quote.design;
    existing.name=quote.design.name;
    existing.type=quote.stats.salvage>=quote.stats.damage ? "Utility":"Combat";
    return {ok:true,message:existing.name+" refitted.",robot:existing};
  }
  const robot={
    id:"robot-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),
    name:quote.design.name,type:quote.stats.salvage>=quote.stats.damage?"Utility":"Combat",
    condition:100,status:"Docked",design:quote.design
  };
  game.fleet.push(robot);
  return {ok:true,message:robot.name+" built and added to fleet.",robot};
}
export function saveBlueprint(game,raw,existingId=null){
  const design=normalizeDesign(raw);
  game.blueprints||=[];
  const existing=game.blueprints.find(b=>b.id===existingId);
  if(existing){existing.design=design;return {ok:true,id:existing.id,message:"Blueprint updated."};}
  if(game.blueprints.length>=MAX_BLUEPRINTS)return {ok:false,message:"Blueprint library full (30 designs)."};
  const id="bp-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
  game.blueprints.push({id,design});
  return {ok:true,id,message:"Blueprint saved."};
}
export function deleteBlueprint(game,id){
  const before=game.blueprints.length;
  game.blueprints=game.blueprints.filter(b=>b.id!==id);
  return game.blueprints.length!==before;
}
