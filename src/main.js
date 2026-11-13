import { loadGame, saveGame, defaultGame, GRID_W, GRID_H, MACHINE_TYPES, canPlace, machineAt, machineFootprint } from "./state.js";
import { createRobotBuilder } from "./builder-ui.js";
import { PARTS } from "./robot-data.js";
import { ensureProduction, advanceFactory, refundJobs, removeMachineProduction, toggleProduction, setMachineRecipe, setMachineEnabled, factoryStatus } from "./factory-sim.js";
import { ensureProgress, advanceMissions, startMission, purchaseResearch, repairRobot } from "./progression.js";
import { factoryControls, missionsMarkup, groupedResearchMarkup, workshopMarkup } from "./step3-ui.js";
import { stockCount, buyMachine, placeOwnedMachine, removeOwnedMachine, clearFactoryLayout, installStarterLine, starterLineQuote } from "./machine-inventory.js";

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
ensureProduction(game);
ensureProgress(game);
advanceMissions(game);
let currentStation = "overview";
let currentTool = "conveyor";
let toolRotation = 0;
let sceneApi = null;
let toastTimer = null;
let saveLabelTimer = null;
let nextMachineId = Date.now();
let hoverCell = null;
let touchArmedCell = null;
let touchPlacement = false;
const el = id => document.getElementById(id);

function station(id) { return STATIONS.find(item => item.id === id) || STATIONS[0]; }
const builderUI = createRobotBuilder(() => game, refresh => {
  persist();
  updateHUD();
  sceneApi?.setRobotState(game.builder.draft, game.fleet);
  if (refresh !== false && currentStation === "assembly") renderPanel();
}, toast);

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
      return workshopMarkup(game);
    case "research":
      return groupedResearchMarkup(game);
    case "missions":
      return missionsMarkup(game);
    case "warehouse":
      return '<p class="panel-lead">Inventory connects the factory, assembly bay and salvage missions. Your opening stock is reserved for the future production economy.</p>' +
        '<div class="stat-grid">' + stat(game.resources.scrap, 'SCRAP METAL') + stat(game.resources.alloy, 'REFINED ALLOY') + stat(game.resources.credits, 'CREDITS') + stat(game.fleet.length, 'ROBOTS') + '</div>' +
        stationCard("▣", "Component storage", Object.entries(game.inventory.parts).filter(([id,n]) => PARTS[id] && n > 0).map(([id,n]) => PARTS[id].name + " ×" + n).join(" • ") || "No spare components in stock.") +
        stationCard("▣", "Production totals", game.factory.production.totals.alloy + " alloy refined • " + game.factory.production.totals.parts + " parts manufactured") +
        '<div class="notice cool">Your warehouse contains resources earned by expeditions and produced by the factory. Manual assembly and automation both draw from this inventory.</div>';
    case "fleet":
      return '<p class="panel-lead">Your machines will live here between jobs. Assign scavenging tasks, form fighting squads, and maintain a production fleet.</p>' +
        '<div class="section-label">Registered units</div>' +
        game.fleet.map(robot => stationCard("▧", robot.name, robot.type + " • " + robot.condition + "% condition • " + robot.status)).join("") +
        '<div class="stat-grid">' + stat(game.fleet.length, 'ROBOTS OWNED') + stat('01', 'ACTIVE HANGAR') + '</div>' +
        '<div class="notice cool">Use Assembly to customize robots, Missions to deploy scavengers, and Workshop to repair damage.</div>';
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
  const report=factoryStatus(game);
  const needsStarter=report.power.capacity===0 || !report.processors.some(p=>p.machine.type==="assembler"&&p.input&&p.output) ||
    !report.processors.some(p=>p.machine.type==="forge"&&p.input&&p.output);
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
    const m = MACHINE_TYPES[type], stock=stockCount(game,type);
    return '<div class="machine-palette-entry"><button type="button" class="machine-tool' +
      (currentTool === type ? ' selected' : '') +
      '" data-tool="' + type + '" aria-pressed="' + (currentTool === type) + '"><strong>' + m.short +
      ' ' + m.name + '</strong><span class="machine-stock-badge" aria-label="' + stock +
      ' available">' + stock + '</span><small>' + m.width + ' × ' + m.height +
      ' tiles · available to place</small></button><button type="button" class="machine-buy" data-buy-machine="' +
      type + '" title="Buy ' + m.name + ' for ' + m.cost.scrap + ' scrap and ' + m.cost.alloy +
      ' alloy">BUY +1 · ' + m.cost.scrap + 'S ' + m.cost.alloy + 'A</button></div>';
  }).join("");
  return '<p class="panel-lead">Design your production floor. Connect storage, forges, builders and generators with directional conveyors.</p>' +
    (needsStarter ? '<div class="notice">This older or incomplete layout does not have a full working production chain. You can rebuild it manually or install a connected starter line without losing your robots, inventory or research.</div><div class="action-row"><button type="button" class="action-button" data-factory-action="demo">INSTALL STARTER LINE</button></div>' : '') +
    '<div class="notice cool">LIVE FACTORY — Machinery costs resources, uses power and must be connected. Start production below the grid.</div>' +
    '<div class="section-label">Machine palette</div><div class="machine-list">' + tools +
    '<button type="button" class="machine-tool' + (currentTool === "erase" ? ' selected' : '') +
    '" data-tool="erase"><strong>× Remove</strong><small>Delete placed machine</small></button></div>' +
    '<div class="planner-toolbar"><span class="tag">ROTATION ' + toolRotation + '°</span><button type="button" class="small-button" data-rotate="1">ROTATE ↻ (R)</button></div>' +
    '<div class="factory-grid-wrap"><div id="factory-grid" class="factory-grid" role="grid" aria-label="Factory floor layout">' + cells + placed +
    '<div id="factory-ghost" class="factory-ghost" aria-hidden="true"></div></div></div>' +
    '<p class="factory-legend">' + machines.length + ' placed machines • ' + area + '/' + (GRID_W * GRID_H) +
    ' occupied cells. Hover for a ghost preview. On touch: tap a tile to preview, then tap again to confirm. Red means blocked; purchase extra machines with BUY +1.</p>' +
    '<div class="action-row"><button type="button" class="small-button" data-factory-confirm="1">PLACE AT PREVIEW</button>'+
    '<button type="button" class="small-button" data-factory-clear-preview="1">CLEAR PREVIEW</button></div>' +
    '<div class="action-row"><button type="button" class="action-button secondary" data-factory-action="save">SAVE LAYOUT</button>' +
    '<button type="button" class="action-button danger" data-factory-action="reset">CLEAR LAYOUT · RETURN MACHINES</button></div>' +
    '<div class="divider"></div>' + factoryControls(game);
}

function renderPanel() {
  if (currentStation === "overview") return;
  const s = station(currentStation);
  el("panel-kicker").textContent = "FACILITY / STATION " + String(STATIONS.indexOf(s)).padStart(2, "0");
  el("panel-title").textContent = s.title;
  const scroll = el("panel-body").scrollTop;
  el("panel-body").innerHTML = currentStation === "factory" ? factoryMarkup() : currentStation === "assembly" ? builderUI.markup() : infoMarkup(currentStation);
  el("panel-body").scrollTop = scroll;
  if(currentStation==="factory")refreshFactoryGhost();
}

function selectStation(id) {
  const s = station(id);
  document.querySelector(".main-stage")?.classList.remove("builder-preview-mode");
  currentStation = s.id;
  if(currentStation!=="factory"){hoverCell=null;touchArmedCell=null;sceneApi?.setFactoryGhost(null);}
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

function refreshFactoryGhost(){
  const ghost=el("factory-ghost");
  if(!ghost || !hoverCell || currentStation!=="factory"){
    if(ghost)ghost.style.display="none";
    sceneApi?.setFactoryGhost(null);
    return;
  }
  const {x,y}=hoverCell;
  const remove=currentTool==="erase";
  const target=remove?machineAt(game.factory.machines,x,y):null;
  const spec=target||(!remove?{type:currentTool,x,y,rotation:toolRotation}:null);
  const valid=remove?Boolean(target):Boolean(stockCount(game,currentTool)&&canPlace(game.factory.machines,currentTool,x,y,toolRotation));
  if(!spec){ghost.style.display="none";sceneApi?.setFactoryGhost(null);return;}
  const {w,h}=machineFootprint(spec);
  ghost.style.display="flex";
  // Clip invalid previews to the visible grid; never create implicit CSS rows/columns.
  ghost.style.gridColumn=(spec.x+1)+" / span "+Math.max(1,Math.min(w,GRID_W-spec.x));
  ghost.style.gridRow=(spec.y+1)+" / span "+Math.max(1,Math.min(h,GRID_H-spec.y));
  ghost.className="factory-ghost "+(valid?"ghost-valid":"ghost-invalid")+(remove?" ghost-remove":"");
  const symbol=spec.type==="conveyor"?["→","↓","←","↑"][spec.rotation/90]:MACHINE_TYPES[spec.type].short;
  ghost.innerHTML='<span>'+symbol+'</span><small>'+(remove?"RETURN":valid?"PLACE":stockCount(game,currentTool)?"BLOCKED":"OUT OF STOCK")+'</small>';
  sceneApi?.setFactoryGhost({type:spec.type,x:spec.x,y:spec.y,rotation:spec.rotation,valid,remove});
}

function previewCell(x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=GRID_W||y>=GRID_H)return;
  hoverCell={x,y};
  refreshFactoryGhost();
}

function refreshFactoryReadouts() {
  if(currentStation!=="factory")return;
  const panel=el("panel-body"),report=factoryStatus(game);
  const values=[
    report.power.used+" / "+report.power.capacity,
    report.active+"/"+report.processors.length,
    String(report.inFlight),
    report.totals.parts.toLocaleString()
  ];
  panel.querySelectorAll(".production-metrics b").forEach((node,i)=>{
    if(i<values.length&&node.textContent!==values[i])node.textContent=values[i];
  });
  const statuses=panel.querySelectorAll(".production-machine");
  report.processors.forEach((entry,i)=>{
    const card=statuses[i];if(!card)return;
    const label=card.querySelector(".production-signal");
    if(label){
      label.textContent=entry.reason||(entry.job?"WORKING":"READY");
      label.classList.toggle("online",!entry.reason);
      label.classList.toggle("offline",Boolean(entry.reason));
    }
    const progress=entry.job?Math.min(100,Math.floor(entry.job.elapsed/entry.job.duration*100)):0;
    const text=card.querySelector(".production-machine-footer span");
    if(text)text.textContent=entry.job?"Cycle "+progress+"%":entry.reason?"Needs attention":"Waiting for materials";
    const bar=card.querySelector(".builder-meter-track i");
    if(bar)bar.style.width=progress+"%";
  });
}
function refreshMissionReadouts() {
  const now=Date.now();
  el("panel-body").querySelectorAll("[data-mission-clock]").forEach(node=>{
    const mission=game.missions.active.find(m=>m.id===node.dataset.missionClock);
    if(!mission)return;
    const seconds=Math.max(0,Math.ceil((mission.endsAt-now)/1000));
    node.textContent=seconds+"s remaining";
    const bar=node.parentElement?.querySelector(".builder-meter-track i");
    if(bar)bar.style.width=Math.max(0,Math.min(100,Math.floor((now-mission.startedAt)/(mission.endsAt-mission.startedAt)*100)))+"%";
  });
}

function placeAt(x,y){
  if(currentTool==="erase"){
    const target=machineAt(game.factory.machines,x,y);
    const result=target?removeOwnedMachine(game,target.id):{ok:false,message:"No machine in this tile."};
    if(result.ok){sceneApi?.setFactoryMachines(game.factory.machines);persist();updateHUD();renderPanel();}
    toast(result.message);return;
  }
  const result=placeOwnedMachine(game,currentTool,x,y,toolRotation,"m-"+(++nextMachineId));
  if(result.ok){
    sceneApi?.setFactoryMachines(game.factory.machines);
    persist();updateHUD();renderPanel();
  }
  toast(result.message);
}

function onPanelClick(event) {
  if (currentStation === "assembly") { builderUI.click(event); return; }
  const repair=event.target.closest("[data-repair-robot]");
  if(repair){
    const result=repairRobot(game,repair.dataset.repairRobot);
    if(result.ok)persist();updateHUD();renderPanel();toast(result.message);return;
  }
  const research=event.target.closest("[data-research-buy]");
  if(research){
    const result=purchaseResearch(game,research.dataset.researchBuy);
    if(result.ok)persist();updateHUD();renderPanel();toast(result.message);return;
  }
  const mission=event.target.closest("[data-mission-start]");
  if(mission){
    const result=startMission(game,mission.dataset.missionStart,game.missions.selectedRobotId);
    if(result.ok){persist();renderPanel();updateHUD();}
    toast(result.message);return;
  }
  const open = event.target.closest("[data-open]");
  if (open) { selectStation(open.dataset.open); return; }
  if (currentStation !== "factory") return;
  const prod=event.target.closest("[data-production-toggle]");
  if(prod){const running=toggleProduction(game);persist();renderPanel();toast(running?"Production started.":"Production paused.");return;}
  const machineToggle=event.target.closest("[data-machine-toggle]");
  if(machineToggle){
    const id=machineToggle.dataset.machineToggle;
    setMachineEnabled(game,id,game.factory.production.enabled[id]===false);
    persist();renderPanel();return;
  }
  const buy=event.target.closest("[data-buy-machine]");
  if(buy){const result=buyMachine(game,buy.dataset.buyMachine);if(result.ok){persist();updateHUD();renderPanel();}toast(result.message);return;}
  const tool = event.target.closest("[data-tool]");
  if (tool) { currentTool = tool.dataset.tool;touchArmedCell=null;renderPanel(); return; }
  const rotate = event.target.closest("[data-rotate]");
  if (rotate) { toolRotation = (toolRotation + 90) % 360;touchArmedCell=null;renderPanel(); return; }
  const cell = event.target.closest("[data-cell]");
  if(cell){
    const x=Number(cell.dataset.x),y=Number(cell.dataset.y);
    const armed=touchArmedCell&&touchArmedCell.x===x&&touchArmedCell.y===y&&
      touchArmedCell.type===currentTool&&touchArmedCell.rotation===toolRotation;
    previewCell(x,y);
    if(touchPlacement&&!armed){
      touchArmedCell={x,y,type:currentTool,rotation:toolRotation};
      toast("Preview set. Tap again or use PLACE AT PREVIEW.");
      return;
    }
    touchArmedCell=null;placeAt(x,y);return;
  }
  if(event.target.closest("[data-factory-confirm]")){
    if(!hoverCell)return toast("Select a factory tile first.");
    const {x,y}=hoverCell;touchArmedCell=null;placeAt(x,y);return;
  }
  if(event.target.closest("[data-factory-clear-preview]")){
    hoverCell=null;touchArmedCell=null;refreshFactoryGhost();return;
  }
  const action = event.target.closest("[data-factory-action]");
  if (!action) return;
  if (action.dataset.factoryAction === "save") {
    persist();
    toast("Factory layout saved to this browser.");
  }
  if(action.dataset.factoryAction==="reset" && window.confirm(
    "Clear the factory floor? Every placed machine will return to storage. Unfinished production inputs will be refunded."
  )){
    const result=clearFactoryLayout(game);
    sceneApi?.setFactoryMachines(game.factory.machines);
    sceneApi?.setFactoryActivity([]);
    hoverCell=null;touchArmedCell=null;
    persist();updateHUD();renderPanel();toast(result.message);
  }
  if(action.dataset.factoryAction==="demo"){
    const quote=starterLineQuote(game);
    if(!quote.affordable)return toast("Need "+quote.cost.scrap+" scrap and "+quote.cost.alloy+" alloy for missing starter equipment.");
    if(window.confirm("Reconfigure the factory using your owned machines? Missing equipment costs "+
      quote.cost.scrap+" scrap and "+quote.cost.alloy+" alloy. Extra machines return to storage."
    )){
      const result=installStarterLine(game);
      if(result.ok){
        sceneApi?.setFactoryMachines(game.factory.machines);
        sceneApi?.setFactoryActivity([]);
        hoverCell=null;touchArmedCell=null;
        persist();updateHUD();renderPanel();
      }
      toast(result.message);
    }
  }
}

function initUI() {
  updateHUD();
  renderNav();
  el("station-nav").addEventListener("click", event => {
    const button = event.target.closest("[data-nav]");
    if (button) selectStation(button.dataset.nav);
  });
  el("panel-body").addEventListener("click",onPanelClick);
  el("panel-body").addEventListener("pointerdown",event=>{
    if(currentStation==="factory"&&event.target.closest("[data-cell]"))
      touchPlacement=event.pointerType==="touch"||event.pointerType==="pen";
  });
  el("panel-body").addEventListener("pointermove",event=>{
    if(currentStation!=="factory")return;
    const cell=event.target.closest("[data-cell]");
    if(cell)previewCell(Number(cell.dataset.x),Number(cell.dataset.y));
  });
  el("panel-body").addEventListener("pointerleave",()=>{
    if(currentStation==="factory"&&!touchPlacement){
      hoverCell=null;refreshFactoryGhost();
    }
  });
  el("panel-body").addEventListener("focusin",event=>{
    if(currentStation==="factory"){
      const cell=event.target.closest("[data-cell]");
      if(cell)previewCell(Number(cell.dataset.x),Number(cell.dataset.y));
    }
  });
  el("panel-body").addEventListener("change", event => {
    if(currentStation==="assembly")builderUI.nameChanged(event);
    if(currentStation==="factory"&&event.target.matches("[data-machine-recipe]")){
      if(setMachineRecipe(game,event.target.dataset.machineRecipe,event.target.value)){
        persist();renderPanel();toast("Production recipe updated.");
      }
    }
    if(currentStation==="missions"&&event.target.matches("[data-mission-select]")){
      game.missions.selectedRobotId=event.target.value;
      persist();renderPanel();
    }
  });
  el("builder-return").addEventListener("click", () => document.querySelector(".main-stage")?.classList.remove("builder-preview-mode"));
  el("close-panel").addEventListener("click", () => selectStation("overview"));
  el("home-button").addEventListener("click", () => selectStation("overview"));
  el("camera-reset").addEventListener("click", () => {
    selectStation("overview");
    sceneApi?.resetCamera();
  });
  el("save-button").addEventListener("click", () => { persist(); toast("Game data saved locally."); });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") selectStation("overview");
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (currentStation === "factory" && (event.key === "r" || event.key === "R")) {
      toolRotation = (toolRotation + 90) % 360;touchArmedCell=null; renderPanel();
    }
  });
}

initUI();

// Keep UI functional if external Three.js modules fail to load.
import("./scene.js").then(module => {
  sceneApi = module.createHangar(el("viewport"), el("hotspots"), selectStation, socketId => {
    document.querySelector(".main-stage")?.classList.remove("builder-preview-mode");
    builderUI.selectSocket(socketId);
  });
  sceneApi.setFactoryMachines(game.factory.machines);
  if(currentStation==="factory")refreshFactoryGhost();
  sceneApi.setFactoryActivity(game.factory.production.deliveries);
  sceneApi.setRobotState(game.builder.draft, game.fleet);
  const loading = el("loading-message");
  if (loading) loading.remove();
  sceneApi.focus(currentStation);
}).catch(error => {
  console.error("Unable to initialize the Three.js hangar:", error);
  el("loading-message").textContent = "3D HANGAR UNAVAILABLE — CHECK WEBGL / CONNECTION. ALL STATION MENUS REMAIN ACCESSIBLE.";
});

// Factory ticks in foreground time only (paused when hidden), while expedition
// completion uses timestamps and is resilient to closing/reopening the browser.
let lastTick=performance.now();
let ticks=0;
window.setInterval(()=>{
  const now=performance.now(),delta=Math.max(0,Math.min(1.5,(now-lastTick)/1000));
  lastTick=now;
  const missionEvents=advanceMissions(game);
  const factoryEvents=document.hidden?[]:advanceFactory(game,delta);
  sceneApi?.setFactoryActivity(game.factory.production.deliveries);
  const changed=missionEvents.length>0||factoryEvents.length>0;
  ticks++;
  if(changed||ticks%20===0)persist();
  updateHUD();
  if(changed){
    if(currentStation==="warehouse"||currentStation==="fleet"||currentStation==="research"||currentStation==="workshop")
      renderPanel();
    if(missionEvents.length){
      const last=missionEvents[0];
      toast(last.robotName+" returned: +"+last.reward.scrap+" scrap, +"+last.reward.alloy+" alloy.");
      sceneApi?.setRobotState(game.builder.draft,game.fleet);
    }
  }
  // Never replace the factory panel on a timer: doing so destroys elements
  // between pointerdown and click on touch devices (Clear Layout becomes untappable).
  if(currentStation==="factory")refreshFactoryReadouts();
  if(currentStation==="missions")refreshMissionReadouts();
},250);
document.addEventListener("visibilitychange",()=>{lastTick=performance.now();if(document.hidden)persist();});
window.addEventListener("pagehide",()=>persist());
