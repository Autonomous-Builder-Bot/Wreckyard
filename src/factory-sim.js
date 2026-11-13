import { GRID_W, GRID_H, machineAt, machineFootprint } from "./state.js";
import { PARTS } from "./robot-data.js";

const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
export const POWER={generator:30,forge:8,assembler:10,conveyor:1,storage:0};
export const FORGE_INPUT={scrap:4};
const validPart=id=>Object.hasOwn(PARTS,id);

/** Directed routes: a belt takes material only from behind it and only forwards. */
export function findRoute(machines,source,target){
  if(!source||!target||source.id===target.id)return null;
  const footprint=machineFootprint(source),targetArea=machineFootprint(target);
  const center=unit=>{
    const size=machineFootprint(unit);
    return {x:unit.x+(size.w-1)/2,y:unit.y+(size.h-1)/2};
  };
  const exits=[];
  for(let y=source.y;y<source.y+footprint.h;y++)for(let x=source.x;x<source.x+footprint.w;x++)
    for(const [dx,dy] of DIRS){
      const next=machineAt(machines,x+dx,y+dy);
      if(!next||next.id===source.id)continue;
      if(next.id===target.id)return [center(source),center(target)];
      if(next.type!=="conveyor")continue;
      const [vx,vy]=DIRS[(next.rotation/90)%4]||DIRS[0];
      if(vx===dx&&vy===dy)exits.push(next);
    }
  const queue=exits.map(m=>({m,path:[center(source),{x:m.x,y:m.y}]}));
  const visited=new Set();
  while(queue.length){
    const {m,path}=queue.shift();
    if(visited.has(m.id))continue;
    visited.add(m.id);
    const [dx,dy]=DIRS[(m.rotation/90)%4]||DIRS[0];
    const next=machineAt(machines,m.x+dx,m.y+dy);
    if(!next)continue;
    if(next.id===target.id)return [...path,center(target)];
    if(next.type==="conveyor"&&!visited.has(next.id)){
      const [nx,ny]=DIRS[(next.rotation/90)%4]||DIRS[0];
      // Next belt must accept the packet from the current belt's direction.
      if(nx===dx&&ny===dy)queue.push({m:next,path:[...path,{x:next.x,y:next.y}]});
    }
  }
  return null;
}

function findDestination(machines,source,types){
  const results=machines.filter(m=>types.includes(m.type)&&m.id!==source.id)
    .map(m=>({target:m,path:findRoute(machines,source,m)})).filter(x=>x.path);
  results.sort((a,b)=>a.path.length-b.path.length);
  return results[0]||null;
}
function sourceFor(machines,target,types){
  const results=machines.filter(m=>types.includes(m.type)&&m.id!==target.id)
    .map(m=>({source:m,path:findRoute(machines,m,target)})).filter(x=>x.path);
  results.sort((a,b)=>a.path.length-b.path.length);
  return results[0]||null;
}
export function ensureProduction(game){
  game.factory ||= {machines:[]};
  game.factory.production ||= {};
  const p=game.factory.production;
  p.running=Boolean(p.running);
  p.jobs ||= {};
  p.deliveries ||= [];
  p.recipes ||= {};
  p.enabled ||= {};
  p.totals ||= {alloy:0,parts:0};
  return p;
}
export function powerReport(game){
  const machines=game.factory.machines;
  const total=machines.filter(m=>m.type==="generator").length*POWER.generator;
  let used=machines.filter(m=>m.type==="conveyor").length*POWER.conveyor;
  const powered=new Set(),demand=used;
  for(const m of machines.filter(m=>m.type==="forge"||m.type==="assembler")){
    const required=POWER[m.type];
    if(used+required<=total){powered.add(m.id);used+=required;}
  }
  return {capacity:total,used,demand, powered,overloaded:used>total};
}
export function factoryReport(game){
  const machines=game.factory.machines;
  const power=powerReport(game);
  const processors=machines.filter(m=>m.type==="forge"||m.type==="assembler").map(machine=>{
    const input=sourceFor(machines,machine,machine.type==="forge"?["storage"]:["storage","forge"]);
    const output=findDestination(machines,machine,machine.type==="forge"?["assembler","storage"]:["storage"]);
    const running=ensureProduction(game).running;
    const powered=power.powered.has(machine.id);
    let reason=null;
    if(!running)reason="Factory is paused";
    else if(game.factory.production.enabled[machine.id]===false)reason="Machine disabled";
    else if(!powered)reason="Insufficient generator power";
    else if(!input)reason="No directed input route";
    else if(!output)reason="No directed output route";
    const recipe=validPart(game.factory.production.recipes[machine.id])?game.factory.production.recipes[machine.id]:"wheel";
    return {machine,input,output,powered,ready:reason===null,reason,recipe,job:game.factory.production.jobs[machine.id]||null};
  });
  return {power,processors,storages:machines.filter(m=>m.type==="storage").length,conveyors:machines.filter(m=>m.type==="conveyor").length};
}
function spend(game,cost){
  if(Object.entries(cost).some(([id,n])=>(game.resources[id]||0)<n))return false;
  for(const [id,n]of Object.entries(cost))game.resources[id]-=n;
  return true;
}
function credit(game,kind,part,quantity){
  if(kind==="alloy")game.resources.alloy+=quantity;
  if(kind==="part")game.inventory.parts[part]=(game.inventory.parts[part]||0)+quantity;
}
function makeCost(game,part){
  const entry=PARTS[part];
  const bonus=game.research?.unlocked?.includes("precision")?0.57:0.72;
  return {
    scrap:Math.max(1,Math.ceil(entry.cost.scrap*bonus)),
    alloy:Math.ceil(entry.cost.alloy*(game.research?.unlocked?.includes("precision")?0.55:0.8))
  };
}
export function recipeCost(game,part){return validPart(part)?makeCost(game,part):null;}
function jobFor(game,entry){
  const {machine,output,recipe}=entry;
  if(machine.type==="forge"){
    const cost={...FORGE_INPUT};
    if(!spend(game,cost))return null;
    return {machineId:machine.id,cost,elapsed:0,
      duration:game.research?.unlocked?.includes("automation")?5.3:7.2,
      output:{kind:"alloy",part:null,quantity:game.research?.unlocked?.includes("smelting")?3:2},
      path:output.path};
  }
  if(!validPart(recipe))return null;
  const cost=makeCost(game,recipe);
  if(!spend(game,cost))return null;
  return {machineId:machine.id,cost,elapsed:0,
    duration:game.research?.unlocked?.includes("automation")?7.2:11,
    output:{kind:"part",part:recipe,quantity:1},path:output.path};
}
export function refundJobs(game){
  const p=ensureProduction(game);
  for(const job of Object.values(p.jobs)){
    for(const [id,qty]of Object.entries(job.cost||{}))if(id in game.resources)game.resources[id]+=qty;
  }
  p.jobs={};
  // Completed items have already spent their inputs; cash them in before layout changes.
  for(const packet of p.deliveries)credit(game,packet.kind,packet.part,packet.quantity);
  p.deliveries=[];
}
export function removeMachineProduction(game,id){
  const p=ensureProduction(game);
  const job=p.jobs[id];
  if(job){
    for(const [resource,qty]of Object.entries(job.cost))game.resources[resource]+=qty;
    delete p.jobs[id];
  }
  delete p.recipes[id];
  delete p.enabled[id];
  // Other in-flight deliveries are guaranteed to reach the global warehouse ledger.
}
export function toggleProduction(game){const p=ensureProduction(game);p.running=!p.running;return p.running;}
export function setMachineRecipe(game,id,part){
  const machine=game.factory.machines.find(m=>m.id===id&&m.type==="assembler");
  if(!machine||!validPart(part))return false;
  ensureProduction(game).recipes[id]=part;
  return true;
}
export function setMachineEnabled(game,id,enabled){
  const machine=game.factory.machines.find(m=>m.id===id&&(m.type==="assembler"||m.type==="forge"));
  if(!machine)return false;
  ensureProduction(game).enabled[id]=Boolean(enabled);
  return true;
}
export function advanceFactory(game,delta){
  const p=ensureProduction(game),events=[];
  // Avoid giant surprise purchases when a background tab resumes.
  if(!p.running)return events;
  let left=Math.max(0,Math.min(2,Number(delta)||0));
  while(left>0){
    const dt=Math.min(left,0.25);left-=dt;
    const currentIds=new Set(game.factory.machines.map(m=>m.id));
    for(const id of Object.keys(p.jobs)){
      if(!currentIds.has(id))removeMachineProduction(game,id);
    }
    const report=factoryReport(game);
    for(const entry of report.processors){
      const id=entry.machine.id;
      if(!entry.ready)continue;
      if(!p.jobs[id])p.jobs[id]=jobFor(game,entry);
      const job=p.jobs[id];
      if(!job)continue;
      job.elapsed+=dt;
      if(job.elapsed+1e-7>=job.duration){
        p.deliveries.push({
          ...job.output,path:job.path,elapsed:0,
          duration:Math.max(0.9,(job.path.length-1)*(game.research?.unlocked?.includes("logistics")?0.3:0.65))
        });
        delete p.jobs[id];
      }
    }
    for(let i=p.deliveries.length-1;i>=0;i--){
      const packet=p.deliveries[i];
      packet.elapsed+=dt;
      if(packet.elapsed+1e-7<packet.duration)continue;
      credit(game,packet.kind,packet.part,packet.quantity);
      if(packet.kind==="alloy")p.totals.alloy+=packet.quantity;
      else p.totals.parts+=packet.quantity;
      events.push({kind:packet.kind,part:packet.part,quantity:packet.quantity});
      p.deliveries.splice(i,1);
    }
  }
  return events;
}
export function factoryStatus(game){
  const report=factoryReport(game),p=ensureProduction(game);
  return { ...report,running:p.running,active:report.processors.filter(x=>x.ready).length,
    inFlight:p.deliveries.length,jobs:Object.keys(p.jobs).length,totals:p.totals};
}
