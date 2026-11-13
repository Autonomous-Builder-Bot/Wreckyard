import { loadGame, saveGame, resetGame, GRID_W, GRID_H, MACHINE_TYPES, canPlace, machineAt, machineFootprint } from "./state.js";

const STATIONS = [
  { id: "overview", label: "Hangar", icon: "⌂", title: "THE HANGAR", subtitle: "Build machines. Recover the wasteland." },
  { id: "assembly", label: "Assembly", icon: "◇", title: "ASSEMBLY BAY", subtitle: "Tomorrow's machines start as salvaged parts." },
  { id: "workshop", label: "Workshop", icon: "⚒", title: "WORKSHOP", subtitle: "Repair, reinforce, and refine your designs." },
  { id: "factory", label: "Factory", icon: "▦", title: "FACTORY FLOOR", subtitle: "Plan the production line that will build an empire." },
  { id: "research", label: "Research", icon: "⌬", title: "RESEARCH LAB", subtitle: "Turn scrap science into better machinery." },
  { id: "missions", label: "Missions", icon: "◎", title: "MISSION CONTROL", subtitle: "Beyond the gates, everything has a price." },
  { id: "warehouse", label: "Warehouse", icon: "▤", title: "WAREHOUSE", subtitle: "Every spare bolt is a future machine." },
  { id: "fleet", label: "Fleet", icon: "▧", title: "ROBOT HANGAR", subtitle: "Manage the machines that work for you." }
];

let game = loadGame();
let currentStation = "overview";
let currentTool = "conveyor";
let toolRotation = 0;
let sceneApi = null;
let toastTimer = null;
let saveLabelTimer = null;
let nextMachineId = Date.now();
const el = id => document.getElementById(id);

function station(id) { return STATIONS.find(item => item.id === id) || STATIONS[0]; }

function updateHUD() {
  el("hud-scrap").textContent = game.resources.scrap.toLocaleString();
  el("hud-alloy").textContent = game.resources.alloy.toLocaleString();
  el("hud-credits").textContent = game.resources.credits.toLocaleString();
  el("fleet-count").textContent = String(game.fleet.length).padStart(2, "0");
}

function toast(message) {
  const node = el("toast");
  node.textContent = message;
  node.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("visible"), 2400);
}

function persist() {
  const ok = saveGame(game);
  const status = el("save-status");
  status.textContent = ok ? "SAVED" : "SAVE BLOCKED";
  clearTimeout(saveLabelTimer);
  if (ok) saveLabelTimer = setTimeout(() => status.textContent = "LOCAL SAVE", 1800);
  return ok;
}

function renderNav() {
  el("station-nav").innerHTML = STATIONS.map(s =>
    '<button type="button" class="nav-button' + (s.id === currentStation ? ' active' : '') +
    '" data-nav="' + s.id + '" aria-current="' + (s.id === currentStation ? 'page' : 'false') +
    '" title="' + s.title + '"><span class="nav-glyph">' + s.icon + '</span><span>' + s.label + '</span></button>'
  ).join("");
}

function stationCard(icon, name, description) {
  return '<div class="station-card"><div class="station-icon">' + icon +
    '</div><div><strong>' + name + '</strong><small>' + description + '</small></div></div>';
}

function stat(value, label) {
  return '<div class="stat-card"><b>' + value + '</b><span>' + label + '</span></div>';
}

function starterNotice(message) {
  return '<div class="notice cool">STEP 1 FOUNDATION — ' + message + '</div>';
}

function infoMarkup(id) {
  switch (id) {
    case "assembly":
      return '<p class="panel-lead">The center platform is ready for a modular robot builder. Here you will mount chassis, wheels, tools, weapons, batteries and armor onto standardized sockets.</p>' +
        '<div class="stat-grid">' + stat('01', 'ASSEMBLY PLATFORM') + stat('02', 'PLANNED BUILD SLOTS') + '</div>' +
        '<div class="section-label">Assembly system // Step 2</div>' +
        stationCard("◇", "Snap-fit building", "Select a chassis and fit individual parts into mounting sockets.") +
        stationCard("≡", "Blueprint library", "Name, save, duplicate and revise designs over time.") +
        stationCard("⚡", "Mechanical constraints", "Weight, power draw, tools and mobility affect performance.") +
        starterNotice("Robot construction will be implemented in Step 2. The station and navigation are ready.");
    case "workshop":
      return '<p class="panel-lead">Repair damage and tune components on every robot you own. Individual parts will have upgrade levels and material costs.</p>' +
        stationCard("⚒", "Repair benches", "Restore damaged robot components to working condition.") +
        stationCard("↟", "Component upgrades", "Improve durability, efficiency, power and carrying capacity.") +
        stationCard("□", "Parts inspection", "Review part stats and durability in detail.") +
        starterNotice("Upgrades and repairs connect to actual robot parts in the next milestones.");
    case "research":
      return '<p class="panel-lead">Unlock new manufacturing methods, chassis designs, automation tools and stronger robot equipment. Progress through branching technologies.</p>' +
        '<div class="section-label">Planned technology branches</div>' +
        stationCard("⚙", "Mechanical engineering", "Better locomotion, hydraulics and chassis.") +
        stationCard("◈", "Material science", "Higher-strength alloys and advanced forging.") +
        stationCard("⌘", "Automation", "Smarter factories, machine controllers and AI targeting.") +
        starterNotice("Research branches will consume materials once production is simulated.");
    case "missions":
      return '<p class="panel-lead">Send specialized machines to recover parts, map abandoned facilities and eventually challenge hostile robots in arena battles.</p>' +
        stationCard("01", "The Rust Flats", "Small deposits of common scrap. Recommended for early scavengers.") +
        stationCard("02", "Broken Relay Station", "Damaged infrastructure with valuable electronic components.") +
        stationCard("03", "The Iron Pit", "Dangerous machines guard heavier salvage and rare blueprints.") +
        starterNotice("Mission selection is a preview. Deployments and combat are not active yet.");
    case "warehouse":
      return '<p class="panel-lead">Inventory connects the factory, assembly bay and salvage missions. Your opening stock is reserved for the future production economy.</p>' +
        '<div class="stat-grid">' + stat(game.resources.scrap, 'SCRAP METAL') + stat(game.resources.alloy, 'REFINED ALLOY') + stat(game.resources.credits, 'CREDITS') + stat(game.fleet.length, 'ROBOTS') + '</div>' +
        stationCard("▣", "Component storage", "Recovered and crafted parts will be stored here.") +
        starterNotice("Resource amounts persist locally. Transactions will be added with the factory simulation.");
    case "fleet":
      return '<p class="panel-lead">Your machines will live here between jobs. Assign scavenging tasks, form fighting squads, and maintain a production fleet.</p>' +
        '<div class="section-label">Registered units</div>' +
        game.fleet.map(robot => stationCard("▧", robot.name, robot.type + " • " + robot.condition + "% condition • " + robot.status)).join("") +
        '<div class="stat-grid">' + stat(game.fleet.length, 'ROBOTS OWNED') + stat('01', 'ACTIVE HANGAR') + '</div>' +
        starterNotice("Robot deployment and blueprint production arrive after the builder is implemented.");
    default:
      return '';
  }
}

function cellMarkup(x, y) {
  return '<button type="button" role="gridcell" class="factory-cell" data-cell="1" data-x="' + x + '" data-y="' + y +
    '" style="grid-column:' + (x + 1) + ';grid-row:' + (y + 1) + '" aria-label="Factory cell, column ' + (x + 1) + ', row ' + (y + 1) + '"></button>';
}

function factoryMarkup() {
  const machines = game.factory.machines;
  let cells = "";
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) cells += cellMarkup(x, y);
  let area = 0;
  const placed = machines.map(m => {
    const { w, h } = machineFootprint(m);
    area += w * h;
    const symbol = m.type === "conveyor" ? ["→","↓","←","↑"][m.rotation / 90] : MACHINE_TYPES[m.type].short;
    return '<div class="factory-placed ' + m.type + '" title="' + MACHINE_TYPES[m.type].name +
      '" style="grid-column:' + (m.x + 1) + ' / span ' + w + ';grid-row:' + (m.y + 1) +
      ' / span ' + h + '"><span>' + symbol + '</span>' +
      (m.type === "conveyor" ? '' : '<span>' + MACHINE_TYPES[m.type].name.toUpperCase() + '</span>') + '</div>';
  }).join("");
  const tools = Object.keys(MACHINE_TYPES).map(type => {
    const m = MACHINE_TYPES[type];
    return '<button type="button" class="machine-tool' + (currentTool === type ? ' selected' : '') +
      '" data-tool="' + type + '" aria-pressed="' + (currentTool === type) + '"><strong>' + m.short +
      ' ' + m.name + '</strong><small>' + m.width + ' × ' + m.height + ' tiles</small></button>';
  }).join("");
  return '<p class="panel-lead">Design your future production floor. Place forges, conveyors, builders, storage and power generators on the grid. Your layout is automatically saved.</p>' +
    '<div class="notice">BLUEPRINT MODE — This is a placement prototype. Machines do not consume resources or manufacture parts yet.</div>' +
    '<div class="section-label">Machine palette</div><div class="machine-list">' + tools +
    '<button type="button" class="machine-tool' + (currentTool === "erase" ? ' selected' : '') +
    '" data-tool="erase"><strong>× Remove</strong><small>Delete placed machine</small></button></div>' +
    '<div class="planner-toolbar"><span class="tag">ROTATION ' + toolRotation + '°</span><button type="button" class="small-button" data-rotate="1">ROTATE ↻ (R)</button></div>' +
    '<div class="factory-grid-wrap"><div id="factory-grid" class="factory-grid" role="grid" aria-label="Factory floor layout">' + cells + placed + '</div></div>' +
    '<p class="factory-legend">' + machines.length + ' machine segments • ' + area + '/' + (GRID_W * GRID_H) +
    ' occupied cells. Tap an empty tile to place; choose Remove and tap a machine to erase it.</p>' +
    '<div class="action-row"><button type="button" class="action-button secondary" data-factory-action="save">SAVE LAYOUT</button>' +
    '<button type="button" class="action-button danger" data-factory-action="reset">RESET LAYOUT</button></div>' +
    '<div class="divider"></div><div class="section-label">Future processing chain</div>' +
    stationCard("▤", "Storage → Forge", "Conveyors will route salvage into a smelting station.") +
    stationCard("⚙", "Forge → Builder", "Smelted metal and other ingredients will feed part assemblers.") +
    stationCard("◇", "Builder → Warehouse", "Completed components will become usable robot inventory.");
}

function renderPanel() {
  if (currentStation === "overview") return;
  const s = station(currentStation);
  el("panel-kicker").textContent = "FACILITY / STATION " + String(STATIONS.indexOf(s)).padStart(2, "0");
  el("panel-title").textContent = s.title;
  const scroll = el("panel-body").scrollTop;
  el("panel-body").innerHTML = currentStation === "factory" ? factoryMarkup() : infoMarkup(currentStation);
  el("panel-body").scrollTop = scroll;
}

function selectStation(id) {
  const s = station(id);
  currentStation = s.id;
  el("stage-title").textContent = s.title;
  el("stage-subtitle").textContent = s.subtitle;
  const panel = el("detail-panel");
  const closed = currentStation === "overview";
  panel.classList.toggle("is-closed", closed);
  panel.setAttribute("aria-hidden", String(closed));
  if (!closed) { el("panel-body").scrollTop = 0; renderPanel(); }
  renderNav();
  sceneApi?.focus(currentStation);
  document.querySelectorAll(".hotspot").forEach(node => node.classList.toggle("active", node.dataset.station === currentStation));
}

function placeAt(x, y) {
  const machines = game.factory.machines;
  if (currentTool === "erase") {
    const target = machineAt(machines, x, y);
    if (!target) return toast("No machine in this tile.");
    game.factory.machines = machines.filter(m => m.id !== target.id);
    persist();
    renderPanel();
    toast(MACHINE_TYPES[target.type].name + " removed.");
    return;
  }
  if (!canPlace(machines, currentTool, x, y, toolRotation)) {
    return toast("Not enough clear floor space for that machine.");
  }
  game.factory.machines.push({ id: "m-" + (++nextMachineId), type: currentTool, x, y, rotation: toolRotation });
  persist();
  renderPanel();
  toast(MACHINE_TYPES[currentTool].name + " placed.");
}

function onPanelClick(event) {
  const open = event.target.closest("[data-open]");
  if (open) { selectStation(open.dataset.open); return; }
  if (currentStation !== "factory") return;
  const tool = event.target.closest("[data-tool]");
  if (tool) { currentTool = tool.dataset.tool; renderPanel(); return; }
  const rotate = event.target.closest("[data-rotate]");
  if (rotate) { toolRotation = (toolRotation + 90) % 360; renderPanel(); return; }
  const cell = event.target.closest("[data-cell]");
  if (cell) { placeAt(Number(cell.dataset.x), Number(cell.dataset.y)); return; }
  const action = event.target.closest("[data-factory-action]");
  if (!action) return;
  if (action.dataset.factoryAction === "save") {
    persist();
    toast("Factory layout saved to this browser.");
  }
  if (action.dataset.factoryAction === "reset" && window.confirm("Reset the factory floor to its starter layout?")) {
    game.factory = resetGame().factory;
    // Do not reset unrelated inventory or fleet when restoring the default layout.
    persist(); renderPanel(); toast("Factory floor reset.");
  }
}

function initUI() {
  updateHUD();
  renderNav();
  el("station-nav").addEventListener("click", event => {
    const button = event.target.closest("[data-nav]");
    if (button) selectStation(button.dataset.nav);
  });
  el("panel-body").addEventListener("click", onPanelClick);
  el("close-panel").addEventListener("click", () => selectStation("overview"));
  el("home-button").addEventListener("click", () => selectStation("overview"));
  el("camera-reset").addEventListener("click", () => {
    selectStation("overview");
    sceneApi?.resetCamera();
  });
  el("save-button").addEventListener("click", () => { persist(); toast("Game data saved locally."); });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") selectStation("overview");
    if (currentStation === "factory" && (event.key === "r" || event.key === "R")) {
      toolRotation = (toolRotation + 90) % 360; renderPanel();
    }
  });
}

initUI();

// Keep UI functional if external Three.js modules fail to load.
import("./scene.js").then(module => {
  sceneApi = module.createHangar(el("viewport"), el("hotspots"), selectStation);
  const loading = el("loading-message");
  if (loading) loading.remove();
  sceneApi.focus(currentStation);
}).catch(error => {
  console.error("Unable to initialize the Three.js hangar:", error);
  el("loading-message").textContent = "3D HANGAR UNAVAILABLE — CHECK WEBGL / CONNECTION. ALL STATION MENUS REMAIN ACCESSIBLE.";
});
