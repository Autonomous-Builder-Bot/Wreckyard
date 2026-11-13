import { CHASSIS, SOCKETS, PARTS, normalizeDesign, designStats, cleanName } from "./robot-data.js";
import { buildQuote, manufacture, saveBlueprint, deleteBlueprint } from "./robot-logic.js";

const esc=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cost=c=>c.scrap+" scrap • "+c.alloy+" alloy";
const number=n=>Number(n||0).toLocaleString();
const button=(name,label,active=false)=>'<button type="button" class="builder-tab'+(active?' selected':'')+'" '+name+'>'+label+'</button>';

export function createRobotBuilder(getGame,onUpdate,toast) {
  let slot="armL";
  function updated(){onUpdate();}
  function markup() {
    const game=getGame(),b=game.builder,draft=normalizeDesign(b.draft);
    const chassis=CHASSIS[draft.chassis],stats=designStats(draft);
    const quote=buildQuote(game,draft,b.editingRobotId);
    if(!chassis.slots.includes(slot))slot=chassis.slots[0];
    const equipped=draft.slots[slot];
    const compatibles=Object.values(PARTS).filter(p=>SOCKETS[slot].accepts.includes(p.category));
    const status=stats.ready?'<span class="builder-ok">BUILD VALID</span>':'<span class="builder-bad">'+esc(stats.issues.join(" • "))+'</span>';
    const powerPct=Math.min(100,Math.round(stats.draw/Math.max(1,stats.power)*100));
    const weightPct=Math.min(100,Math.round(stats.mass/stats.maxMass*100));
    const meter=(label,value,pct,bad)=>'<div class="builder-meter"><div><span>'+label+'</span><b>'+value+'</b></div><div class="builder-meter-track"><i style="width:'+pct+'%;background:'+(bad?'#d37f6d':'#8fc3b4')+'"></i></div></div>';
    const robotButtons=game.fleet.map(r=>button('data-builder-robot="'+esc(r.id)+'"',esc(r.name),r.id===b.editingRobotId)).join("");
    const chassisButtons=Object.values(CHASSIS).map(c=>'<button type="button" class="builder-chassis'+(c.id===draft.chassis?' selected':'')+'" data-builder-chassis="'+c.id+'"><strong>'+esc(c.name)+'</strong><small>'+c.slots.length+' mounts • '+c.capacity+' kg • '+cost(c.cost)+'</small></button>').join("");
    const sockets=chassis.slots.map(id=>{
      const p=PARTS[draft.slots[id]];
      return '<button type="button" class="builder-socket'+(id===slot?' selected':'')+'" data-builder-slot="'+id+'"><span>'+esc(SOCKETS[id].name)+'</span><b>'+esc(p?.name||"EMPTY")+'</b></button>';
    }).join("");
    const partButtons=compatibles.map(p=>{
      const stock=game.inventory.parts[p.id]||0,selected=equipped===p.id;
      return '<button type="button" class="builder-part'+(selected?' selected':'')+'" data-builder-part="'+p.id+'"><strong>'+esc(p.name)+'</strong><small>'+esc(p.description||p.category)+'<span class="builder-part-cost">'+(stock?'In stock: '+stock:'Craft: '+cost(p.cost))+'</span></small></button>';
    }).join("");
    const blueprints=game.blueprints.length ? game.blueprints.map(bp=>{
      const d=normalizeDesign(bp.design);
      return '<div class="blueprint-item"><span><b>'+esc(d.name)+'</b><small>'+esc(CHASSIS[d.chassis].name)+' • '+Object.keys(d.slots).length+' parts</small></span><button type="button" class="small-button" data-builder-load="'+esc(bp.id)+'">LOAD</button><button type="button" class="small-button" data-builder-delete="'+esc(bp.id)+'" aria-label="Delete '+esc(d.name)+'">×</button></div>';
    }).join(""):'<p class="muted">No saved designs yet.</p>';
    const refit=!!b.editingRobotId;
    return '<p class="panel-lead">Fit parts onto chassis sockets. Every piece affects mass, power, and performance. Changes are previews until you fabricate or refit.</p>'+
      '<div class="section-label">Work order</div><div class="builder-fleet-bar">'+
      button('data-builder-new="1"',"＋ New design",!refit&&!b.selectedBlueprintId)+robotButtons+'</div>'+
      '<label class="builder-field-label" for="robot-name">Robot name</label><input id="robot-name" class="builder-name" maxlength="32" autocomplete="off" value="'+esc(draft.name)+'">'+
      '<div class="section-label">1 / Choose chassis</div><div class="builder-chassis-list">'+chassisButtons+'</div>'+
      '<div class="section-label">2 / Fit components</div>'+
      '<div class="builder-socket-list">'+sockets+'</div>'+
      '<div class="builder-selected-slot"><strong>'+esc(SOCKETS[slot].name)+'</strong><span>Accepts: '+esc(SOCKETS[slot].accepts.join(", "))+'</span></div>'+
      '<div class="builder-parts">'+
      '<button type="button" class="builder-part empty" data-builder-part=""><strong>× Remove component</strong><small>Return this piece to spare inventory when you refit.</small></button>'+
      partButtons+'</div>'+
      '<div class="section-label">3 / System diagnostics</div><div class="builder-diagnostics">'+status+
      meter("WEIGHT",stats.mass+" / "+stats.maxMass+" kg",weightPct,stats.mass>stats.maxMass)+
      meter("POWER DRAW",stats.draw+" / "+stats.power+" units",powerPct,stats.draw>stats.power)+
      '<div class="builder-stats">'+[
        ["ARMOR",stats.armor],["DAMAGE",stats.damage],["SALVAGE",stats.salvage],["CARGO",stats.cargo+" kg"],["SPEED",stats.speed],["HULL",stats.hp]
      ].map(([key,val])=>'<div><small>'+key+'</small><b>'+val+'</b></div>').join("")+'</div></div>'+
      '<div class="section-label">4 / Fabrication estimate</div>'+
      '<div class="builder-quote"><strong>'+cost(quote.cost)+'</strong><small>'+Object.keys(quote.craft).length+' part types to craft • '+Object.keys(quote.spendStock).length+' from inventory</small></div>'+
      (quote.errors.length?'<div class="notice">'+esc(quote.errors.join(" • "))+'</div>':'')+
      '<div class="action-row"><button type="button" class="action-button" data-builder-action="build" '+(!quote.ready?'disabled':'')+'>'+(refit?'APPLY REFIT':'BUILD NEW ROBOT')+'</button>'+
      '<button type="button" class="action-button secondary" data-builder-action="save">SAVE BLUEPRINT</button></div>'+
      '<div class="action-row"><button type="button" class="small-button" data-builder-action="reset">REVERT CHANGES</button>'+
      '<button type="button" class="small-button" data-builder-action="view">VIEW ROBOT IN 3D</button></div>'+
      '<div class="section-label">Saved blueprints ('+game.blueprints.length+'/30)</div><div class="blueprint-list">'+blueprints+'</div>'+
      '<div class="section-label">Spare parts</div><p class="muted">'+(Object.entries(game.inventory.parts).filter(([k,v])=>PARTS[k]&&v>0).map(([k,v])=>esc(PARTS[k].name)+' ×'+number(v)).join(" • ")||"No spare components")+'</p>'+
      '<div class="notice cool">STEP 2 — Manual fabrication uses scrap and alloy. Factory automation, scavenging and battle simulation come later.</div>';
  }
  function click(event){
    const target=event.target.closest("[data-builder-slot], [data-builder-part], [data-builder-chassis], [data-builder-robot], [data-builder-new], [data-builder-load], [data-builder-delete], [data-builder-action]");
    if(!target)return false;
    const game=getGame(),b=game.builder;
    if(target.dataset.builderSlot){slot=target.dataset.builderSlot;updated();return true;}
    if(target.hasAttribute("data-builder-part")){
      const id=target.dataset.builderPart;
      const part=PARTS[id];
      if(id && (!part||!SOCKETS[slot].accepts.includes(part.category)))return true;
      if(id)b.draft.slots[slot]=id;else delete b.draft.slots[slot];
      b.draft=normalizeDesign(b.draft);updated();return true;
    }
    if(target.dataset.builderChassis){
      b.draft=normalizeDesign({...b.draft,chassis:target.dataset.builderChassis});
      updated();return true;
    }
    if(target.dataset.builderRobot){
      const robot=game.fleet.find(r=>r.id===target.dataset.builderRobot);
      if(robot){b.editingRobotId=robot.id;b.selectedBlueprintId=null;b.draft=normalizeDesign(robot.design);slot="armL";updated();}
      return true;
    }
    if(target.hasAttribute("data-builder-new")){
      b.draft=normalizeDesign({name:"NEW UNIT",chassis:"scout",slots:{driveL:"wheel",driveR:"wheel",core:"cell"}});
      b.editingRobotId=null;b.selectedBlueprintId=null;slot="armL";updated();return true;
    }
    if(target.dataset.builderLoad){
      const bp=game.blueprints.find(x=>x.id===target.dataset.builderLoad);
      if(bp){b.draft=normalizeDesign(bp.design);b.editingRobotId=null;b.selectedBlueprintId=bp.id;slot="armL";updated();}
      return true;
    }
    if(target.dataset.builderDelete){
      if(window.confirm("Delete this saved blueprint?")){
        deleteBlueprint(game,target.dataset.builderDelete);
        if(b.selectedBlueprintId===target.dataset.builderDelete)b.selectedBlueprintId=null;
        updated();toast("Blueprint deleted.");
      }
      return true;
    }
    if(target.dataset.builderAction){
      const action=target.dataset.builderAction;
      if(action==="save"){
        const result=saveBlueprint(game,b.draft,b.selectedBlueprintId);
        if(result.ok)b.selectedBlueprintId=result.id;
        updated();toast(result.message);return true;
      }
      if(action==="build"){
        const result=manufacture(game,b.draft,b.editingRobotId);
        if(result.ok){b.editingRobotId=result.robot.id;b.selectedBlueprintId=null;b.draft=normalizeDesign(result.robot.design);updated();}
        toast(result.message);return true;
      }
      if(action==="reset"){
        if(b.editingRobotId){
          const unit=game.fleet.find(r=>r.id===b.editingRobotId);
          if(unit)b.draft=normalizeDesign(unit.design);
        }else if(b.selectedBlueprintId){
          const bp=game.blueprints.find(x=>x.id===b.selectedBlueprintId);
          if(bp)b.draft=normalizeDesign(bp.design);
        }else b.draft=normalizeDesign({name:"NEW UNIT",chassis:"scout",slots:{driveL:"wheel",driveR:"wheel",core:"cell"}});
        updated();return true;
      }
      if(action==="view"){
        document.querySelector(".main-stage")?.classList.add("builder-preview-mode");
        return true;
      }
    }
    return false;
  }
  function nameChanged(event){
    if(event.target.id!=="robot-name")return false;
    const game=getGame();
    game.builder.draft.name=cleanName(event.target.value);
    onUpdate(false);
    return true;
  }
  function selectSocket(id){
    const game=getGame();
    if(CHASSIS[game.builder.draft.chassis].slots.includes(id)){
      slot=id;
      onUpdate();
      return true;
    }
    return false;
  }
  return {markup,click,nameChanged,selectSocket};
}
