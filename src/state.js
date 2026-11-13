export const SAVE_KEY = "wreckyard_save_v1";
export const SAVE_VERSION = 1;
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
    fleet: [{ id: "robot-1", name: "SCRAPPER-01", type: "Utility", condition: 84, status: "Docked" }],
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
    if (!saved || saved.version !== SAVE_VERSION || !saved.factory || !Array.isArray(saved.factory.machines)) return defaultGame();
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
