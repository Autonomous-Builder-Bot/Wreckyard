import { designStats } from "./robot-data.js";
import { enemyDesign, canFight } from "./arena-sim.js";

const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n||0).toLocaleString();
export function arenaMarkup(game){
  const a=game.arena,level=a.level;
  const enemy=enemyDesign(level),enemyStats=designStats(enemy);
  const selected=game.fleet.find(r=>r.id===a.selectedRobotId)||game.fleet[0];
  const check=selected?canFight(game,selected.id):{ready:false,reason:"Build a robot first"};
  const options=game.fleet.map(r=>'<option value="'+esc(r.id)+'"'+
    (r.id===selected?.id?' selected':'')+'>'+esc(r.name)+
    ' · '+(r.status==="Docked"?"READY":esc(r.status))+
    '</option>').join("");
  const p=selected?designStats(selected.design):null;
  const current=a.active;
  const last=a.last;
  const arenaButton=current?
    '<button type="button" class="action-button arena-go" data-arena-watch="1">WATCH CURRENT MATCH</button>':
    '<button type="button" class="action-button arena-go" data-arena-start="1"'+(check.ready?'':' disabled')+
    '>START ROUND '+level+'</button>';
  return '<p class="panel-lead">Two AI pilots. One arena. No manual fighting and no limit on matches. Every victory advances to a tougher opponent; defeats let you retry the same round.</p>'+
    '<div class="section-label">Arena record</div>'+
    '<div class="arena-record">'+
    '<div><b>'+fmt(level)+'</b><small>NEXT ROUND</small></div>'+
    '<div><b>'+fmt(a.wins)+'</b><small>WINS</small></div>'+
    '<div><b>'+fmt(a.losses)+'</b><small>LOSSES</small></div>'+
    '<div><b>'+fmt(a.bestStreak)+'</b><small>BEST STREAK</small></div></div>'+
    '<div class="section-label">Your fighter</div><select id="arena-robot" class="factory-select" data-arena-select="1">'+options+'</select>'+
    (p?'<div class="arena-robot-stats"><span>HULL '+(p.hp+Math.round(p.armor*.58))+'</span><span>ATTACK '+Math.max(4,p.damage)+'</span>'+
    '<span>ARMOR '+p.armor+'</span><span>SPEED '+p.speed+'</span></div>':'')+
    '<div class="section-label">AI opponent · Round '+level+'</div>'+
    '<div class="arena-opponent"><strong>'+esc(enemy.name)+'</strong><span>'+esc(enemy.chassis.toUpperCase())+' CHASSIS</span>'+
    '<div class="arena-opponent-stats"><span>HULL '+enemyStats.hp+'</span><span>ATTACK '+enemyStats.damage+'</span>'+
    '<span>LEVEL '+level+'</span></div><p>Each round scales enemy durability and attack strength, and stronger chassis and weapons appear as you progress.</p></div>'+
    (current?'<div class="notice cool">Match paused when you leave the arena. Return to watch your AI continue fighting.</div>':
      (!check.ready?'<div class="notice">'+esc(check.reason)+'</div>':''))+
    '<div class="action-row">'+arenaButton+'</div>'+
    '<div class="section-label">Last result</div>'+
    (last?'<div class="arena-last '+(last.won?'won':'lost')+'"><strong>'+(last.won?'VICTORY':'DEFEAT')+
      ' · ROUND '+fmt(last.level)+'</strong><small>'+esc(last.robotName)+' vs '+esc(last.enemyName)+' · '+
      last.elapsed+'s</small><span>+'+fmt(last.reward.scrap)+' scrap · +'+fmt(last.reward.alloy)+
      ' alloy · +'+fmt(last.reward.credits)+' credits</span></div>':
      '<p class="muted">No fights recorded. Start a match to test your machine in combat.</p>')+
    '<div class="notice cool">Arena matches have no entry fee or cooldown and do not cause permanent equipment wear. Robots already scavenging cannot enter until they return.</div>';
}
