// Step 2 modular catalog. All robot systems use these same data definitions.
export const CHASSIS = {
  scout: { id:"scout",name:"Scout Frame",tier:1,description:"Fast, cheap starter frame.",mass:18,capacity:88,power:5,hp:75,cost:{scrap:30,alloy:3},slots:["driveL","driveR","core","armL","armR","top1","front","back1"],color:0xd8a56d },
  hauler: { id:"hauler",name:"Hauler Frame",tier:2,description:"A wider platform with two extra mounts.",mass:32,capacity:155,power:8,hp:135,cost:{scrap:75,alloy:10},slots:["driveL","driveR","core","armL","armR","top1","front","back1","top2","back2"],color:0x72a9a4 },
  juggernaut: { id:"juggernaut",name:"Juggernaut Frame",tier:3,description:"Heavy armor and four arm mounts.",mass:55,capacity:245,power:12,hp:220,cost:{scrap:120,alloy:25},slots:["driveL","driveR","core","armL","armR","top1","front","back1","top2","back2","arm3","arm4"],color:0xa98977 }
};
export const SOCKETS = {
  driveL:{name:"Left drive",accepts:["mobility"],pos:[-1.12,0.38,0.24]},
  driveR:{name:"Right drive",accepts:["mobility"],pos:[1.12,0.38,0.24]},
  core:{name:"Power core",accepts:["power"],pos:[0,1.24,0]},
  armL:{name:"Left arm",accepts:["tool","weapon","utility"],pos:[-1.05,1.12,0.05]},
  armR:{name:"Right arm",accepts:["tool","weapon","utility"],pos:[1.05,1.12,0.05]},
  top1:{name:"Upper mount A",accepts:["weapon","sensor","utility"],pos:[0,1.96,0.10]},
  top2:{name:"Upper mount B",accepts:["weapon","sensor","utility"],pos:[0,1.96,-0.55]},
  front:{name:"Front module",accepts:["sensor","armor"],pos:[0,1.22,0.78]},
  back1:{name:"Rear mount A",accepts:["cargo","utility"],pos:[0,1.16,-0.82]},
  back2:{name:"Rear mount B",accepts:["cargo","power","utility"],pos:[0,1.16,-1.36]},
  arm3:{name:"Auxiliary arm L",accepts:["tool","weapon"],pos:[-1.35,1.00,-0.64]},
  arm4:{name:"Auxiliary arm R",accepts:["tool","weapon"],pos:[1.35,1.00,-0.64]}
};
const p=(id,name,category,mass,draw,cost,extra={})=>({id,name,category,mass,draw,cost:{scrap:cost[0],alloy:cost[1]},supply:0,hp:0,armor:0,damage:0,salvage:0,cargo:0,speed:0,...extra});
export const PARTS = {
  wheel:p("wheel","Scrap Wheel","mobility",6,2,[8,0],{speed:10,description:"Reliable starter wheel."}),
  roadwheel:p("roadwheel","Road Wheel","mobility",7,2,[13,1],{speed:14,description:"Improved traction and speed."}),
  track:p("track","Steel Track","mobility",12,3,[25,3],{speed:7,armor:8,description:"Durable all-terrain treads."}),
  spider:p("spider","Crawler Legs","mobility",10,5,[28,4],{speed:11,description:"Agile climbing legs."}),
  hover:p("hover","Hover Drive","mobility",9,9,[40,7],{speed:18,description:"Power-hungry rapid drive."}),
  cell:p("cell","Scrap Battery","power",6,0,[15,1],{supply:26,description:"Recovered energy cells."}),
  battery:p("battery","Industrial Battery","power",11,0,[30,4],{supply:48,description:"Extended operating capacity."}),
  reactor:p("reactor","Micro Reactor","power",16,0,[75,15],{supply:90,description:"Experimental high-output core."}),
  claw:p("claw","Grip Claw","tool",7,3,[10,1],{salvage:7,description:"Pulls loose salvage."}),
  cutter:p("cutter","Rotary Cutter","tool",10,5,[22,2],{salvage:12,damage:3,description:"Slices metal panels."}),
  drill:p("drill","Rock Drill","tool",14,6,[30,4],{salvage:18,description:"Extracts buried ore."}),
  magnet:p("magnet","Magnetic Crane","tool",12,5,[26,3],{salvage:13,cargo:8,description:"Lifts magnetic debris."}),
  extractor:p("extractor","Precision Extractor","tool",9,6,[35,5],{salvage:22,description:"Retrieves fragile machinery."}),
  nailgun:p("nailgun","Scrap Blaster","weapon",7,5,[15,1],{damage:11,description:"Makeshift close-range gun."}),
  repeater:p("repeater","Auto Repeater","weapon",12,8,[35,4],{damage:23,description:"High-rate ballistic fire."}),
  plasma:p("plasma","Plasma Lance","weapon",15,13,[55,9],{damage:37,description:"Short-range energy weapon."}),
  ram:p("ram","Impact Ram","weapon",15,4,[29,3],{damage:20,armor:7,description:"Heavy kinetic strike."}),
  railgun:p("railgun","Rail Cannon","weapon",21,20,[85,14],{damage:62,description:"Extreme long-range power."}),
  optic:p("optic","Basic Optics","sensor",3,1,[6,0],{salvage:2,description:"Basic visual targeting."}),
  scanner:p("scanner","Scrap Scanner","sensor",5,3,[16,2],{salvage:8,description:"Highlights valuable salvage."}),
  lidar:p("lidar","Survey Lidar","sensor",7,6,[33,5],{salvage:15,description:"Maps hazards and targets."}),
  basket:p("basket","Cargo Basket","cargo",6,0,[12,1],{cargo:24,description:"Light salvaging storage."}),
  pod:p("pod","Cargo Pod","cargo",13,1,[28,3],{cargo:65,description:"Large sealed cargo bay."}),
  welder:p("welder","Repair Welder","utility",9,5,[25,3],{hp:20,salvage:3,description:"Field service attachment."}),
  cooler:p("cooler","Heat Sink","utility",7,1,[17,2],{hp:15,description:"Protects high-power systems."}),
  shield:p("shield","Shield Emitter","utility",12,11,[48,8],{armor:38,description:"Energy shield plating."}),
  plating:p("plating","Armor Plating","armor",14,0,[21,2],{armor:45,description:"Bolt-on front protection."}),
  reactive:p("reactive","Reactive Armor","armor",19,3,[46,8],{armor:82,description:"Heavy impact protection."})
};
export const STARTER_DESIGN = {
  name:"SCRAPPER-01",chassis:"scout",
  slots:{driveL:"wheel",driveR:"wheel",core:"cell",armL:"claw",top1:"nailgun",front:"optic",back1:"basket"}
};
export function cleanName(name,fallback="UNNAMED UNIT"){
  return String(name ?? "").replace(/[<>]/g,"").replace(/\s+/g," ").trim().slice(0,32)||fallback;
}
export function normalizeDesign(raw) {
  const chassis=CHASSIS[raw?.chassis] ? raw.chassis : "scout";
  const slots={};
  for(const id of CHASSIS[chassis].slots){
    const part=PARTS[raw?.slots?.[id]];
    if(part && SOCKETS[id].accepts.includes(part.category)) slots[id]=part.id;
  }
  return {name:cleanName(raw?.name),chassis,slots};
}
export function designStats(raw){
  const design=normalizeDesign(raw), base=CHASSIS[design.chassis], stats={
    mass:base.mass,maxMass:base.capacity,power:base.power,draw:0,
    hp:base.hp,armor:0,damage:0,salvage:0,cargo:0,speed:0,slots:Object.keys(design.slots).length
  };
  let drives=0;
  for(const [slot,id] of Object.entries(design.slots)){
    const part=PARTS[id];
    for(const stat of ["mass","draw","supply","hp","armor","damage","salvage","cargo"]){
      if(stat==="supply")stats.power+=part.supply;else stats[stat]+=part[stat]||0;
    }
    if(slot==="driveL"||slot==="driveR"){drives++;stats.speed+=part.speed||0;}
  }
  stats.speed=drives ? Math.round(stats.speed/drives) : 0;
  stats.issues=[];
  if(drives!==2)stats.issues.push("Install both drive modules");
  if(!design.slots.core)stats.issues.push("Install a power core");
  if(stats.mass>stats.maxMass)stats.issues.push("Exceeds chassis weight limit");
  if(stats.draw>stats.power)stats.issues.push("Insufficient power output");
  stats.ready=stats.issues.length===0;
  return stats;
}
export function designCost(raw){
  const design=normalizeDesign(raw),cost={...CHASSIS[design.chassis].cost};
  for(const id of Object.values(design.slots)){
    cost.scrap+=PARTS[id].cost.scrap;cost.alloy+=PARTS[id].cost.alloy;
  }
  return cost;
}
