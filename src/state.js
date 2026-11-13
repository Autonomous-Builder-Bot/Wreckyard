import { STARTER_DESIGN, normalizeDesign, PARTS, designStats } from "./robot-data.js";
import { starterRobot, MAX_FLEET, MAX_BLUEPRINTS } from "./robot-logic.js";

export const SAVE_KEY = "wreckyard_save_v1";
export const SAVE_VERSION = 2;
export const GRID_W = 12;
export const GRID_H = 8;

export const MACHINE_TYPES = {
  conveyor: { name: "Conveyor", width: 1, height: 1, short: "→", summary: "Transfers materials between connected machines." },
  forge: { name: "Forge", width: 2, height: 2, short: "F", summary: "Smelts scrap into usable metal." },
  assembler: { name: "Builder", width: 2, height: 2, short: "B", summary: "Assembles crafted parts from materials." },
  storage: { name: "Storage", width: 2, height: 2, short: "S", summary: "Holds inputs and manufactured components." },
  generator: { name: "Generator", width: 2, height: 2, short: "G", summary: "Supplies power to factory machinery." }
};

const starterFactory = [
  { id: "m1", type: "forge", x: 2, y: 2, rotation: 0 },
  { id: "m2", type: "conveyor", x: 4, y: 3, rotation: 0 },
  { id: "m3", type: "conveyor", x: 5, y: 3, rotation: 0 },
  { id: "m4", type: "storage", x: 7, y: 2, rotation: 0 }
];

export function defaultGame() {
  return {
    version: SAVE_VERSION,
    resources: { scrap: 240, alloy: 35, credits: 800 },
    fleet: [starterRobot()],
    inventory: { parts: { cutter: 1, scanner: 1 } },
    blueprints: [],
    builder: { draft: normalizeDesign(STARTER_DESIGN), editingRobotId: "robot-1", selectedBlueprintId: null },
    factory: { machines: starterFactory.map(m => ({ ...m })) },
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
    if (!saved || ![1,SAVE_VERSION].includes(saved.version) || !saved.factory || !Array.isArray(saved.factory.machines)) return defaultGame();
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
    if(saved.version===SAVE_VERSION) {
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
