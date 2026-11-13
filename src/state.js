import { STARTER_DESIGN, normalizeDesign, PARTS, designStats } from "./robot-data.js";
import { starterRobot, MAX_FLEET, MAX_BLUEPRINTS } from "./robot-logic.js";
import { RESEARCH, REGIONS } from "./progression.js";

export const SAVE_KEY = "wreckyard_save_v1";
export const SAVE_VERSION = 3;
export const GRID_W = 12;
export const GRID_H = 8;

export const MACHINE_TYPES = {
  conveyor: { name: "Conveyor", width: 1, height: 1, short: "→", cost: {scrap:4,alloy:0}, summary: "Moves cargo forward along its arrow." },
  forge: { name: "Forge", width: 2, height: 2, short: "F", cost: {scrap:30,alloy:5}, summary: "Turns 4 scrap into refined alloy." },
  assembler: { name: "Builder", width: 2, height: 2, short: "B", cost: {scrap:36,alloy:7}, summary: "Builds robot components using stored materials." },
  storage: { name: "Storage", width: 2, height: 2, short: "S", cost: {scrap:15,alloy:2}, summary: "Provides raw material input and receives finished goods." },
  generator: { name: "Generator", width: 2, height: 2, short: "G", cost: {scrap:28,alloy:5}, summary: "Adds 30 units of production power." }
};

const starterFactory = [
  // Complete, one-click playable production chain:
  // input storage -> two belts -> forge -> two belts -> builder -> output storage
  { id: "m1", type: "storage", x: 0, y: 2, rotation: 0 },
  { id: "m2", type: "conveyor", x: 2, y: 2, rotation: 0 },
  { id: "m3", type: "conveyor", x: 3, y: 2, rotation: 0 },
  { id: "m4", type: "forge", x: 4, y: 1, rotation: 0 },
  { id: "m5", type: "conveyor", x: 6, y: 2, rotation: 0 },
  { id: "m6", type: "conveyor", x: 7, y: 2, rotation: 0 },
  { id: "m7", type: "assembler", x: 8, y: 1, rotation: 0 },
  { id: "m8", type: "storage", x: 10, y: 1, rotation: 0 },
  { id: "m9", type: "generator", x: 5, y: 5, rotation: 0 }
];

export function defaultGame() {
  return {
    version: SAVE_VERSION,
    resources: { scrap: 240, alloy: 35, credits: 800 },
    fleet: [starterRobot()],
    inventory: { parts: { cutter: 1, scanner: 1 } },
    blueprints: [],
    builder: { draft: normalizeDesign(STARTER_DESIGN), editingRobotId: "robot-1", selectedBlueprintId: null },
    factory: { machines: starterFactory.map(m => ({ ...m })), production: {running:false,jobs:{},deliveries:[],recipes:{m7:"wheel"},enabled:{},totals:{alloy:0,parts:0}} },
    research: {unlocked:[]},
    missions: {active:[],history:[],selectedRobotId:"robot-1"},
    settings: { sound: false },
    updatedAt: Date.now()
  };
}

function isValidMachine(m) {
  if (!m || !MACHINE_TYPES[m.type] || !Number.isInteger(m.x) || !Number.isInteger(m.y)) return false;
  const shape = MACHINE_TYPES[m.type];
  const w = m.rotation % 180 === 90 ? shape.height : shape.width;
  const h = m.rotation % 180 === 90 ? shape.width : shape.height;
  return m.x >= 0 && m.y >= 0 && m.x + w <= GRID_W && m.y + h <= GRID_H;
}

export function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    // v1 is migrated in place. Never discard an existing factory layout or inventory.
    if (!saved || ![1,2,SAVE_VERSION].includes(saved.version) || !saved.factory || !Array.isArray(saved.factory.machines)) return defaultGame();
    const fresh = defaultGame();
    const valid = saved.factory.machines.filter(isValidMachine).slice(0, GRID_W * GRID_H).map(m => ({
      id: String(m.id).slice(0, 60), type: m.type, x: m.x, y: m.y,
      rotation: [0,90,180,270].includes(m.rotation) ? m.rotation : 0
    }));
    const occupied = new Set();
    fresh.factory.machines = valid.filter(m => {
      const p = MACHINE_TYPES[m.type];
      const w = m.rotation % 180 === 90 ? p.height : p.width;
      const h = m.rotation % 180 === 90 ? p.width : p.height;
      const cells = [];
      for (let y = m.y; y < m.y + h; y++) for (let x = m.x; x < m.x + w; x++) cells.push(x + ":" + y);
      if (cells.some(k => occupied.has(k))) return false;
      cells.forEach(k => occupied.add(k));
      return true;
    });
    if (saved.resources && typeof saved.resources === "object") {
      for (const k of ["scrap", "alloy", "credits"]) {
        if (typeof saved.resources[k] === "number" && Number.isFinite(saved.resources[k])) fresh.resources[k] = Math.max(0, Math.floor(saved.resources[k]));
      }
    }
    if (Array.isArray(saved.fleet)) {
      fresh.fleet = saved.fleet.slice(0,MAX_FLEET).filter(r=>r && typeof r==="object").map((r,i)=>{
        const design=normalizeDesign(r.design || {...STARTER_DESIGN,name:r.name||STARTER_DESIGN.name});
        const stats=designStats(design);
        return {id:String(r.id||"robot-"+i).slice(0,80),name:design.name,
          type:stats.salvage>=stats.damage?"Utility":"Combat",
          condition:Number.isFinite(r.condition)?Math.max(0,Math.min(100,Math.round(r.condition))):100,
          status:"Docked",design};
      });
      if (!fresh.fleet.length) fresh.fleet=[starterRobot()];
    }
    if(saved.version>=2) {
      if(saved.inventory && saved.inventory.parts && typeof saved.inventory.parts==="object") {
        fresh.inventory.parts={};
        for(const [id,count] of Object.entries(saved.inventory.parts)){
          if(PARTS[id] && Number.isSafeInteger(count) && count>0)fresh.inventory.parts[id]=Math.min(count,9999);
        }
      }
      if(Array.isArray(saved.blueprints)) {
        fresh.blueprints=saved.blueprints.slice(0,MAX_BLUEPRINTS).filter(b=>b && typeof b==="object" && typeof b.id==="string")
          .map(b=>({id:b.id.slice(0,80),design:normalizeDesign(b.design)}));
      }
      if(saved.builder && typeof saved.builder==="object") {
        fresh.builder.draft=normalizeDesign(saved.builder.draft);
        fresh.builder.editingRobotId=fresh.fleet.some(r=>r.id===saved.builder.editingRobotId)?saved.builder.editingRobotId:null;
        fresh.builder.selectedBlueprintId=fresh.blueprints.some(b=>b.id===saved.builder.selectedBlueprintId)?saved.builder.selectedBlueprintId:null;
      }
    } else {
      // Preserve legacy robot names and promote its design into the editor.
      fresh.builder.draft=normalizeDesign(fresh.fleet[0].design);
      fresh.builder.editingRobotId=fresh.fleet[0].id;
    }
    if(saved.version===SAVE_VERSION) {
      const existingIds=new Set(fresh.factory.machines.map(m=>m.id));
      if(saved.factory.production && typeof saved.factory.production==="object"){
        const old=saved.factory.production,prod=fresh.factory.production;
        prod.running=old.running===true;
        prod.recipes={}; prod.enabled={};prod.jobs={};prod.deliveries=[];
        if(old.recipes && typeof old.recipes==="object")for(const [id,part]of Object.entries(old.recipes)){
          if(existingIds.has(id)&&PARTS[part])prod.recipes[id]=part;
        }
        if(old.enabled && typeof old.enabled==="object")for(const [id,on]of Object.entries(old.enabled)){
          if(existingIds.has(id))prod.enabled[id]=on!==false;
        }
        function safeCost(cost){
          if(!cost||typeof cost!=="object")return null;
          const n={};
          for(const id of ["scrap","alloy"])if(Number.isSafeInteger(cost[id])&&cost[id]>=0&&cost[id]<=100000)n[id]=cost[id];
          return Object.keys(n).length?n:null;
        }
        function safePacket(item){
          if(!item||!["alloy","part"].includes(item.kind))return null;
          if(item.kind==="part"&&!PARTS[item.part])return null;
          if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100)return null;
          if(!Array.isArray(item.path)||item.path.length<2||item.path.length>100)return null;
          const path=item.path.map(p=>({x:Number(p?.x),y:Number(p?.y)}));
          if(path.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
          const duration=Number(item.duration),elapsed=Number(item.elapsed);
          if(!Number.isFinite(duration)||duration<=0||duration>600||
             !Number.isFinite(elapsed)||elapsed<0||elapsed>600)return null;
          return {kind:item.kind,part:item.kind==="part"?item.part:null,
            quantity:item.quantity,path,duration,elapsed};
        }
        if(old.jobs && typeof old.jobs==="object")for(const [id,job]of Object.entries(old.jobs)){
          if(!existingIds.has(id))continue;
          const cost=safeCost(job?.cost),packet=safePacket({...job?.output,path:job?.path,duration:job?.duration,elapsed:job?.elapsed});
          if(cost&&packet)prod.jobs[id]={machineId:id,cost,elapsed:packet.elapsed,duration:packet.duration,
            output:{kind:packet.kind,part:packet.part,quantity:packet.quantity},path:packet.path};
        }
        if(Array.isArray(old.deliveries))prod.deliveries=old.deliveries.slice(0,120).map(safePacket).filter(Boolean);
        if(old.totals)for(const key of ["alloy","parts"]){
          if(Number.isSafeInteger(old.totals[key])&&old.totals[key]>=0)prod.totals[key]=old.totals[key];
        }
      }
      if(saved.research && Array.isArray(saved.research.unlocked)){
        fresh.research.unlocked=[...new Set(saved.research.unlocked.filter(id=>Object.hasOwn(RESEARCH,id)))];
      }
      if(saved.missions && typeof saved.missions==="object"){
        const old=saved.missions;
        const units=new Set(fresh.fleet.map(r=>r.id));
        if(Array.isArray(old.active)){
          const busy=new Set();
          fresh.missions.active=old.active.slice(0,MAX_FLEET).filter(m=>{
            if(!m||!units.has(m.robotId)||busy.has(m.robotId)||!REGIONS[m.regionId]||
              !Number.isFinite(m.endsAt)||!Number.isFinite(m.startedAt)||!m.reward)return false;
            if(["scrap","alloy","credits","wear"].some(k=>!Number.isSafeInteger(m.reward[k])||m.reward[k]<0||m.reward[k]>10000))return false;
            busy.add(m.robotId);return true;
          }).map(m=>({id:String(m.id).slice(0,80),robotId:m.robotId,regionId:m.regionId,
            startedAt:m.startedAt,endsAt:m.endsAt,
            reward:{scrap:m.reward.scrap,alloy:m.reward.alloy,credits:m.reward.credits,wear:m.reward.wear}}));
        }
        if(Array.isArray(old.history))fresh.missions.history=old.history.slice(0,20);
        if(units.has(old.selectedRobotId))fresh.missions.selectedRobotId=old.selectedRobotId;
        for(const unit of fresh.fleet){
          unit.status=fresh.missions.active.some(m=>m.robotId===unit.id)?"Scavenging":"Docked";
        }
      }
    }
    // Version 2 saves keep their original factory, resources, fleet, and blueprints.
    // They can install the new starter line without replacing the rest of their progress.
    fresh.version=SAVE_VERSION;
    return fresh;
  } catch (error) {
    console.warn("Wreckyard save unavailable; starting a new local session.", error);
    return defaultGame();
  }
}

export function saveGame(game) {
  game.updatedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    return true;
  } catch (error) {
    console.warn("Unable to store local Wreckyard save.", error);
    return false;
  }
}

export function resetGame() {
  const fresh = defaultGame();
  saveGame(fresh);
  return fresh;
}

export function machineFootprint(machine) {
  const shape = MACHINE_TYPES[machine.type];
  const sideways = machine.rotation % 180 === 90;
  return { w: sideways ? shape.height : shape.width, h: sideways ? shape.width : shape.height };
}

export function machineAt(machines, x, y) {
  return machines.find(m => {
    const { w, h } = machineFootprint(m);
    return x >= m.x && x < m.x + w && y >= m.y && y < m.y + h;
  }) || null;
}

export function canPlace(machines, type, x, y, rotation = 0) {
  if (!MACHINE_TYPES[type]) return false;
  const { w, h } = machineFootprint({ type, rotation });
  if (x < 0 || y < 0 || x + w > GRID_W || y + h > GRID_H) return false;
  for (let cy = y; cy < y + h; cy++) for (let cx = x; cx < x + w; cx++) if (machineAt(machines, cx, cy)) return false;
  return true;
}
