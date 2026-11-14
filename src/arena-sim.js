import { designStats, normalizeDesign, CHASSIS } from "./robot-data.js";

const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export function initialArena(robotId="robot-1"){
  return {level:1,wins:0,losses:0,streak:0,bestStreak:0,selectedRobotId:robotId,active:null,last:null};
}
export function enemyDesign(level){
  level=Math.max(1,Math.floor(level)||1);
  const big=level>=12,mid=level>=5&&!big;
  const chassis=big?"juggernaut":mid?"hauler":"scout";
  const drive=level>=9?"track":level>=4?"roadwheel":"wheel";
  const slots={driveL:drive,driveR:drive,core:level>=7?"reactor":level>=4?"battery":"cell",
    front:level>=10?"plating":"optic",
    top1:level>=9?"plasma":level>=4?"repeater":"nailgun",
    armL:level>=7?"ram":"claw"};
  if(mid||big)slots.back1="basket";
  if(big){slots.armR="repeater";slots.top2="railgun";slots.back2="cooler";}
  if(level>=18)slots.front="reactive";
  return normalizeDesign({name:level===1?"RUST DRONE":"ARENA BOT "+String(level).padStart(2,"0"),chassis,slots});
}
function archetypeStats(design,level=0,isEnemy=false,condition=100){
  const s=designStats(design);
  const weapons=Object.entries(design.slots).filter(([,id])=>
    ["nailgun","repeater","plasma","ram","railgun"].includes(id));
  const melee=weapons.length>0&&weapons.every(([,id])=>id==="ram");
  const scale=isEnemy?1+level*.125:1;
  return {
    hp:Math.round((s.hp+s.armor*.58)*(isEnemy?(.55+level*.075):1)*limit(.65+condition*.0035,.65,1)),
    damage:limit(Math.round(Math.max(4,s.damage)*(isEnemy?(.54+level*.075):1)),3,99999),
    speed:limit(s.speed||6,3,30),armor:s.armor,range:melee?1.42:weapons.length?3.75:1.4,
    attackTime:melee?.88:weapons.length?.82:1.12,
    category:melee?"ram":weapons.some(([,id])=>id==="railgun")?"railgun":weapons.some(([,id])=>id==="plasma")?"plasma":weapons.length?"gun":"bash",
    scale, stats:s
  };
}
function makeCombatant(id,base,x,z,side){
  return {id,x,z,hp:base.hp,maxHp:base.hp,damage:base.damage,
    speed:base.speed,armor:base.armor,range:base.range,attackTime:base.attackTime,
    category:base.category,heading:side===0?Math.PI/2:-Math.PI/2,
    cooldown:.3+side*.22,dodge:0,side};
}
export function canFight(game,robotId){
  const robot=game.fleet.find(r=>r.id===robotId);
  if(game.arena?.active)return {ready:false,reason:"A match is already in progress"};
  if(!robot)return {ready:false,reason:"Select a robot"};
  if(robot.status!=="Docked")return {ready:false,reason:"Robot is deployed"};
  const stats=designStats(robot.design);
  if(!stats.ready)return {ready:false,reason:stats.issues.join(" • ")};
  // Exhibition combat has no entry fees and no permanent wear.
  return {ready:true,reason:"Ready",stats};
}
export function startFight(game,robotId,now=Date.now()){
  game.arena ||=initialArena(game.fleet[0]?.id);
  const check=canFight(game,robotId);
  if(!check.ready)return {ok:false,message:check.reason};
  const robot=game.fleet.find(r=>r.id===robotId);
  const level=limit(Math.floor(game.arena.level)||1,1,100000);
  const opponent=enemyDesign(level);
  const p=archetypeStats(robot.design,0,false,robot.condition);
  const e=archetypeStats(opponent,level,true);
  const match={
    id:"arena-"+now+"-"+Math.random().toString(36).slice(2,6),
    level,robotId,robotName:robot.name,playerDesign:normalizeDesign(robot.design),
    enemyDesign:opponent,startedAt:now,elapsed:0,status:"running",winner:null,
    player:makeCombatant("player",p,-3.65,-.45,0),
    enemy:makeCombatant("enemy",e,3.65,.45,1),
    events:[],eventSeq:0,frame:0
  };
  robot.status="Fighting";
  game.arena.active=match;game.arena.selectedRobotId=robotId;
  return {ok:true,message:"Round "+level+": "+robot.name+" vs "+opponent.name,match};
}
function pushEvent(match,type,from,to,damage=0){
  match.events.push({seq:++match.eventSeq,t:Math.round(match.elapsed*100)/100,
    type,from,to,damage});
  match.events=match.events.slice(-16);
}
function steer(bot,target,time,dt){
  const dx=target.x-bot.x,dz=target.z-bot.z;
  const distance=Math.max(.001,Math.hypot(dx,dz));
  bot.heading=Math.atan2(dx,dz);
  const targetRange=bot.range==="?"?2:Math.min(3.35,Math.max(1.02,bot.range*.77));
  const approach=distance>targetRange+.18?1:distance<Math.max(1.4,targetRange*.65)?-.55:0;
  const pace=(.36+bot.speed*.057)*dt;
  const strafe=Math.sin(time*(1.1+bot.side*.28)+bot.side*1.5)*pace*.50;
  bot.x+=dx/distance*pace*approach+dz/distance*strafe;
  bot.z+=dz/distance*pace*approach-dx/distance*strafe;
  bot.x=limit(bot.x,-5.7,5.7);bot.z=limit(bot.z,-3.3,3.3);
}
function attack(match,attacker,defender){
  if(attacker.hp<=0||defender.hp<=0)return;
  const distance=Math.hypot(attacker.x-defender.x,attacker.z-defender.z);
  if(distance>attacker.range+(.18))return;
  // Low/medium skill AI duel: movement and equipment determine outcomes.
  const phase=match.frame*1.37+attacker.side*8.11+match.level*.52;
  const accuracy=.89-.10*Math.min(1,defender.speed/25);
  const hit=Math.sin(phase*2.41)*.5+.5<accuracy;
  if(!hit){pushEvent(match,"miss",attacker.id,defender.id);return;}
  const raw=attacker.damage*(.86+(.5+.5*Math.sin(phase*5.33))*.28);
  const reduction=Math.min(.44,defender.armor*.0021);
  const damage=Math.max(1,Math.round(raw*(1-reduction)));
  defender.hp=Math.max(0,defender.hp-damage);
  pushEvent(match,"hit",attacker.id,defender.id,damage);
}
export function advanceFight(match,delta){
  if(!match||match.status!=="running")return [];
  let remain=limit(Number(delta)||0,0,1.5),events=[];
  while(remain>0&&match.status==="running"){
    const dt=Math.min(.10,remain);remain-=dt;match.elapsed+=dt;match.frame++;
    const p=match.player,e=match.enemy;
    if(p.hp>0)steer(p,e,match.elapsed,dt);
    if(e.hp>0)steer(e,p,match.elapsed,dt);
    p.cooldown-=dt;e.cooldown-=dt;
    if(p.cooldown<=0){attack(match,p,e);p.cooldown=p.attackTime;}
    if(e.hp>0&&e.cooldown<=0){attack(match,e,p);e.cooldown=e.attackTime;}
    if(p.hp===0||e.hp===0){
      match.status="finished";match.winner=p.hp>0?"player":"enemy";
      pushEvent(match,"result",match.winner,match.winner==="player"?"enemy":"player");
    }
    if(match.elapsed>=75&&match.status==="running"){
      match.status="finished";
      match.winner=p.hp/e.maxHp>=e.hp/p.maxHp?"player":"enemy";
      pushEvent(match,"result",match.winner,match.winner==="player"?"enemy":"player");
    }
  }
  events=match.events;
  return events;
}
export function fightRewards(level,won){
  if(!won)return {scrap:2,alloy:0,credits:4+Math.min(40,level)};
  return {scrap:9+Math.min(90,Math.round(level*2.2)),
    alloy:level%3===0?1+Math.floor(level/12):0,
    credits:20+Math.min(260,level*7)};
}
export function settleFight(game,match){
  if(!match||match.status!=="finished"||!game.arena?.active||
     game.arena.active.id!==match.id)return {ok:false,message:"Match already settled"};
  const arena=game.arena,win=match.winner==="player";
  const reward=fightRewards(match.level,win);
  for(const [kind,value]of Object.entries(reward))game.resources[kind]+=value;
  if(win){arena.wins++;arena.streak++;arena.level=arena.wins+1;}
  else{arena.losses++;arena.streak=0;}
  arena.bestStreak=Math.max(arena.bestStreak,arena.streak);
  const robot=game.fleet.find(r=>r.id===match.robotId);
  if(robot)robot.status="Docked";
  const result={
    id:match.id,level:match.level,won:win,winner:match.winner,
    robotName:match.robotName,enemyName:match.enemyDesign.name,
    reward,playerHp:match.player.hp,enemyHp:match.enemy.hp,
    elapsed:Math.round(match.elapsed*10)/10,
    finishedAt:Date.now()
  };
  arena.active=null;arena.last=result;
  return {ok:true,result,message:win?"VICTORY — Round "+match.level:"DEFEAT — Retry round "+match.level};
}
export function advanceArena(game,delta){
  const match=game.arena?.active;
  if(!match)return null;
  advanceFight(match,delta);
  return match.status==="finished"?settleFight(game,match):null;
}
export function restoreArena(saved,game){
  const fresh=initialArena(game.fleet[0]?.id);
  if(!saved||typeof saved!=="object")return fresh;
  for(const key of ["wins","losses","streak","bestStreak"]){
    if(Number.isSafeInteger(saved[key])&&saved[key]>=0)fresh[key]=Math.min(saved[key],1000000);
  }
  fresh.level=fresh.wins+1;
  if(game.fleet.some(r=>r.id===saved.selectedRobotId))fresh.selectedRobotId=saved.selectedRobotId;
  if(saved.last&&typeof saved.last==="object")fresh.last={
    id:String(saved.last.id||""),level:Number(saved.last.level)||1,
    won:saved.last.won===true,robotName:String(saved.last.robotName||"Robot").slice(0,40),
    enemyName:String(saved.last.enemyName||"Enemy").slice(0,40),
    reward:{scrap:Math.max(0,Number(saved.last.reward?.scrap)||0),
      alloy:Math.max(0,Number(saved.last.reward?.alloy)||0),
      credits:Math.max(0,Number(saved.last.reward?.credits)||0)},
    elapsed:Number(saved.last.elapsed)||0,finishedAt:Number(saved.last.finishedAt)||0,
    playerHp:Number(saved.last.playerHp)||0,enemyHp:Number(saved.last.enemyHp)||0
  };
  const match=saved.active,robot=game.fleet.find(r=>r.id===match?.robotId);
  if(match?.status==="running"&&robot&&robot.status==="Docked"&&
     Number.isFinite(match.elapsed)&&match.elapsed>=0&&match.elapsed<90&&
     match.player&&match.enemy){
    const opponent=enemyDesign(fresh.level);
    // Validate just enough to exclude malformed saves and preserve legitimate duels.
    const validBot=bot=>["x","z","hp","maxHp","damage","speed","armor","range","attackTime","cooldown"].every(k=>Number.isFinite(bot[k]))&&
      bot.maxHp>0&&bot.maxHp<10000000&&bot.hp>=0&&bot.hp<=bot.maxHp;
    if(validBot(match.player)&&validBot(match.enemy)&&
       match.level===fresh.level){
      fresh.active={
        ...match,robotName:robot.name,playerDesign:normalizeDesign(match.playerDesign||robot.design),
        enemyDesign:opponent,elapsed:match.elapsed,status:"running",winner:null,
        events:Array.isArray(match.events)?match.events.slice(-16):[],eventSeq:Number(match.eventSeq)||0,
        frame:Number(match.frame)||0
      };
      robot.status="Fighting";
    }
  }
  return fresh;
}
