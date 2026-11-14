import { PARTS } from "./robot-data.js";
import { factoryStatus, recipeCost } from "./factory-sim.js";
import { RESEARCH, REGIONS, hasTech, researchStatus, missionStatus, repairQuote } from "./progression.js";

const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const num=n=>Number(n||0).toLocaleString();
const price=p=>num(p.scrap)+" scrap · "+num(p.alloy)+" alloy"+(p.credits!=null?" · "+num(p.credits)+" credits":"");
export function factoryControls(game){
  const status=factoryStatus(game),prod=game.factory.production;
  const powered=status.power.capacity>0?Math.min(100,Math.round(status.power.used/status.power.capacity*100)):0;
  const options=Object.entries(PARTS).map(([id,part])=>
    '<option value="'+id+'">'+esc(part.name)+' ('+price(recipeCost(game,id))+')</option>').join("");
  const processors=status.processors.map(({machine,reason,recipe,job,input,output})=>
    '<div class="production-machine"><div class="production-machine-head"><b>'+esc(machine.type==="forge"?"FORGE":"BUILDER")+' / '+esc(machine.id)+'</b>'+
    '<span class="production-signal '+(reason?'offline':'online')+'">'+esc(reason|| (job?"WORKING":"READY"))+'</span></div>'+
    '<div class="production-machine-route">INPUT: '+esc(input?input.source.type.toUpperCase()+" → "+machine.type.toUpperCase():"NO FEED")+
    ' · OUTPUT: '+esc(output?machine.type.toUpperCase()+" → "+output.target.type.toUpperCase():"NO OUTPUT ROUTE")+'</div>'+
    (machine.type==="assembler"?'<label class="builder-field-label" for="recipe-'+esc(machine.id)+'">Part recipe</label>'+
    '<select class="factory-select" id="recipe-'+esc(machine.id)+'" data-machine-recipe="'+esc(machine.id)+'">'+
    options.replace('value="'+esc(recipe)+'"','value="'+esc(recipe)+'" selected')+'</select>':
    '<p class="muted">Consumes 4 scrap → '+(game.research.unlocked.includes("smelting")?3:2)+' alloy per cycle.</p>')+
    '<div class="production-machine-footer"><span>'+(job?"Cycle "+Math.min(100,Math.floor(job.elapsed/job.duration*100))+"%":reason?"Needs attention":"Waiting for materials")+'</span>'+
    '<button type="button" class="small-button" data-machine-toggle="'+esc(machine.id)+'">'+
    (prod.enabled[machine.id]===false?"ENABLE":"DISABLE")+'</button></div>'+
    '<div class="builder-meter-track"><i style="width:'+(job?Math.min(100,Math.floor(job.elapsed/job.duration*100)):0)+'%;background:#dfb47a"></i></div>'+
    '</div>').join("");
  return '<div class="section-label">Live factory operations</div>'+
    '<div class="factory-operations">'+
    '<div class="production-metrics"><div><small>POWER</small><b>'+status.power.used+' / '+status.power.capacity+'</b></div>'+
    '<div><small>ACTIVE MACHINES</small><b>'+status.active+'/'+status.processors.length+'</b></div>'+
    '<div><small>IN TRANSIT</small><b>'+status.inFlight+'</b></div>'+
    '<div><small>BUILT</small><b>'+num(status.totals.parts)+'</b></div></div>'+
    '<div class="builder-meter-track"><i style="width:'+powered+'%;background:'+(status.power.used>status.power.capacity?'#d6816f':'#e3a65f')+'"></i></div>'+
    '<div class="action-row"><button type="button" class="action-button" data-production-toggle="1">'+(status.running?'PAUSE PRODUCTION':'START PRODUCTION')+'</button>'+
    '<button type="button" class="action-button secondary" data-factory-action="demo">INSTALL STARTER LINE</button></div>'+
    '<p class="muted">Production uses real resources. Forges smelt scrap into alloy; builders consume materials to make usable robot parts. Power and conveyor routes are required. Machines stop when materials run out. The starter-line button returns your installed machines to stock, reuses what you own, and buys only the missing equipment if affordable.</p>'+
    '<div class="section-label">Machine operations</div>'+
    (processors||'<div class="notice">Place a forge or builder, a generator, and storage connected by correctly directed conveyors.</div>')+
    '<p class="factory-legend">Completed: '+num(status.totals.alloy)+' alloy · '+num(status.totals.parts)+' components. Outputs enter your warehouse when the delivery reaches its destination.</p></div>';
}
export function missionsMarkup(game,now=Date.now()){
  const ms=game.missions,unitId=ms.selectedRobotId||game.fleet[0]?.id;
  const options=game.fleet.map(r=>'<option value="'+esc(r.id)+'"'+(unitId===r.id?' selected':'')+'>'+
    esc(r.name)+' · '+r.condition+'%'+(r.status==="Docked"?"":" · DEPLOYED")+'</option>').join("");
  const cards=Object.entries(REGIONS).map(([id,region])=>{
    const state=missionStatus(game,id,unitId);
    const unlocked=!region.requires||hasTech(game,region.requires);
    const rewards=state.rewards;
    return '<div class="mission-card"><div class="mission-head"><b>'+esc(region.name)+'</b><span>'+
    (unlocked?region.seconds+"s BASE":"LOCKED")+'</span></div><p>'+esc(region.description)+'</p>'+
    '<div class="mission-numbers"><span>RISK '+region.risk+'</span><span>SCRAP '+region.scrap+'</span><span>ALLOY '+region.alloy+'</span></div>'+
    (rewards?'<p class="muted">Estimated haul for selected robot: '+num(rewards.scrap)+' scrap / '+num(rewards.alloy)+' alloy / '+num(rewards.credits)+' credits. Wear: '+rewards.wear+'%.</p>':'')+
    '<button type="button" class="action-button'+(state.available?'':' secondary')+'" data-mission-start="'+id+'"'+(state.available?'':' disabled')+'>'+
    (state.available?'SEND SCAVENGER':esc(state.reason))+'</button></div>';
  }).join("");
  const active=ms.active.map(m=>{
    const remain=Math.max(0,Math.ceil((m.endsAt-now)/1000));
    const duration=Math.max(1,m.endsAt-m.startedAt);
    const progress=Math.min(100,Math.floor((now-m.startedAt)/duration*100));
    const robot=game.fleet.find(r=>r.id===m.robotId);
    const phase=progress<20?"Deploying from the hangar":progress<43?"Scanning ruins for scrap":
      progress<72?"Salvaging recovered materials":progress<92?"Loading the cargo hold":"Returning to Wreckyard";
    return '<div class="mission-active"><b>'+esc(robot?.name||"ROBOT")+'</b><small>'+esc(REGIONS[m.regionId]?.name||"Expedition")+
    ' · <span data-mission-clock="'+esc(m.id)+'">'+remain+'s remaining</span></small>'+
    '<div class="scavenge-vista region-'+esc(m.regionId)+'">'+
    '<div class="scavenge-sky"><span class="scavenge-sun"></span><span class="scavenge-building b1"></span><span class="scavenge-building b2"></span>'+
    '<span class="scavenge-building b3"></span><span class="scavenge-building b4"></span></div>'+
    '<div class="scavenge-debris d1"></div><div class="scavenge-debris d2"></div>'+
    '<div class="scavenge-rover" data-scavenge-bot="'+esc(m.id)+'" style="left:'+(6+progress*.82)+'%">'+
    '<span class="scavenge-lamp"></span><span class="scavenge-rover-body"></span><span class="scavenge-rover-top"></span>'+
    '<span class="scavenge-wheel left"></span><span class="scavenge-wheel right"></span><span class="scavenge-cargo"></span></div>'+
    '<div class="scavenge-ground"></div></div>'+
    '<div class="scavenge-expedition-info"><small data-scavenge-message="'+esc(m.id)+'">'+esc(phase)+'</small>'+
    '<small>+'+m.reward.scrap+' scrap · +'+m.reward.alloy+' alloy</small></div>'+
    '<div class="builder-meter-track"><i style="width:'+progress+'%;background:#8cbdb2"></i></div></div>';
  }).join("");
  const history=ms.history.slice(0,5).map(item=>'<div class="mission-history"><b>'+esc(item.robotName)+'</b><span>'+
    esc(REGIONS[item.regionId]?.name||"Mission")+' · +'+num(item.reward.scrap)+' scrap · +'+num(item.reward.alloy)+' alloy · +'+num(item.reward.credits)+' credits</span></div>').join("");
  return '<p class="panel-lead">Deploy your actual assembled robots. Salvage tools, scanners, cargo capacity and mobility determine what each machine can recover. Missions complete on a real timer, even if you close the browser.</p>'+
    '<div class="section-label">Choose scavenger</div><select class="factory-select" id="mission-robot" data-mission-select="1">'+options+'</select>'+
    '<div class="section-label">Active missions ('+ms.active.length+')</div>'+(active||'<p class="muted">No robots deployed. Select an expedition below.</p>')+
    '<div class="section-label">Scavenging regions</div><div class="mission-grid">'+cards+'</div>'+
    '<div class="section-label">Recent expedition results</div>'+(history||'<p class="muted">Your mission history will appear here.</p>')+
    '<div class="notice cool">Scavenging is a simple automated expedition: send a robot, watch it explore, and collect its haul on return. For unlimited AI battles use the Arena station. A deployed scavenger cannot fight or be refitted until it gets home.</div>';
}
export function researchMarkup(game){
  const unlocked=game.research.unlocked.length;
  const cards=Object.entries(RESEARCH).map(([id,tech])=>{
    const status=researchStatus(game,id),done=hasTech(game,id);
    return '<div class="research-card"><div class="research-name"><b>'+esc(tech.name)+'</b>'+
    '<span class="'+(done?'research-done':status.available?'research-ready':'research-locked')+'">'+(done?'UNLOCKED':status.available?'AVAILABLE':'LOCKED')+'</span></div>'+
    '<p>'+esc(tech.description)+'</p><div class="research-cost">'+price(tech.cost)+'</div>'+
    '<div class="research-prereqs">'+(tech.requires.length?'Prerequisites: '+esc(tech.requires.map(t=>RESEARCH[t].name).join(", ")):'Starting technology')+'</div>'+
    '<button type="button" class="action-button secondary" data-research-buy="'+id+'"'+(status.available?'':' disabled')+'>'+
    (done?'RESEARCH COMPLETE':status.available?'UNLOCK TECHNOLOGY':esc(status.reason))+'</button></div>';
  }).join("");
  return '<p class="panel-lead">Reinvest scrap, alloy and credits to improve manufacturing efficiency and unlock more demanding scavenging regions.</p>'+
    '<div class="stat-grid"><div class="stat-card"><b>'+unlocked+' / '+Object.keys(RESEARCH).length+'</b><span>TECHNOLOGIES</span></div><div class="stat-card"><b>'+num(game.resources.credits)+'</b><span>RESEARCH CREDITS</span></div></div>'+
    '<div class="section-label">Industrial technology</div><div class="research-list">'+cards.split('<div class="research-card">').slice(1,5).map(s=>'<div class="research-card">'+s).join("")+'</div>';
}
export function groupedResearchMarkup(game){
  const groups=[["Industry","Production, conveyors and crafting"],["Exploration","Scavenging, rewards and new regions"]];
  return '<p class="panel-lead">Research uses materials and credits to unlock permanent improvements. Technologies build on one another.</p>'+
    '<div class="stat-grid"><div class="stat-card"><b>'+game.research.unlocked.length+'/'+Object.keys(RESEARCH).length+'</b><span>TECH UNLOCKED</span></div>'+
    '<div class="stat-card"><b>'+num(game.resources.credits)+'</b><span>CREDITS</span></div></div>'+
    groups.map(([branch,description])=>'<div class="section-label">'+branch+'</div><p class="muted">'+description+'</p>'+
      Object.entries(RESEARCH).filter(([,tech])=>tech.branch===branch).map(([id,tech])=>{
        const status=researchStatus(game,id),done=hasTech(game,id);
        return '<div class="research-card"><div class="research-name"><b>'+esc(tech.name)+'</b>'+
          '<span class="'+(done?'research-done':status.available?'research-ready':'research-locked')+'">'+(done?'UNLOCKED':status.available?'AVAILABLE':'LOCKED')+'</span></div>'+
          '<p>'+esc(tech.description)+'</p><div class="research-cost">'+price(tech.cost)+'</div>'+
          '<div class="research-prereqs">'+(tech.requires.length?'Requires: '+esc(tech.requires.map(t=>RESEARCH[t].name).join(", ")):'No prerequisite')+'</div>'+
          '<button type="button" class="action-button secondary" data-research-buy="'+id+'"'+(status.available?'':' disabled')+'>'+
          (done?'RESEARCH COMPLETE':status.available?'UNLOCK':' '+esc(status.reason))+'</button></div>';
      }).join("")).join("");
}
export function workshopMarkup(game){
  return '<p class="panel-lead">Scavenging damages robots. Repair them here before the next expedition. Installed parts remain reusable during refits.</p>'+
    '<div class="section-label">Robot maintenance</div>'+
    game.fleet.map(robot=>{
      const cost=repairQuote(robot);
      return '<div class="maintenance-card"><div><b>'+esc(robot.name)+'</b><small>'+robot.condition+'% condition · '+esc(robot.status)+'</small></div>'+
        '<div class="repair-cost">'+(cost.scrap>0?price(cost):"No repairs needed")+'</div>'+
        '<button type="button" class="small-button" data-repair-robot="'+esc(robot.id)+'"'+(cost.scrap===0||robot.status!=="Docked"?' disabled':'')+'>REPAIR</button></div>';
    }).join("")+'<div class="notice cool">Repairs cost scrap and alloy. Component-level durability and upgrades can be expanded after the factory and mission loop is stable.</div>';
}
