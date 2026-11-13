import { MACHINE_TYPES, STARTER_MACHINE_STOCK, defaultGame, canPlace } from "./state.js";
import { refundJobs, removeMachineProduction } from "./factory-sim.js";

// Stock counts represent physical, unplaced machines. Placed machines remain owned
// and always go back to stock when removed. Only purchases spend raw materials.
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function machineStock(game) {
  game.inventory ||= {parts:{}};
  if(!game.inventory.machines || typeof game.inventory.machines!=="object")
    game.inventory.machines={...STARTER_MACHINE_STOCK};
  for(const type of Object.keys(MACHINE_TYPES)) {
    const n=game.inventory.machines[type];
    game.inventory.machines[type]=Number.isSafeInteger(n)&&n>=0?Math.min(n,9999):0;
  }
  return game.inventory.machines;
}
export function stockCount(game,type) {
  return MACHINE_TYPES[type]?machineStock(game)[type]:0;
}
export function machineTotals(game) {
  const totals={};
  for(const type of Object.keys(MACHINE_TYPES))totals[type]=stockCount(game,type);
  for(const machine of game.factory.machines)if(own(totals,machine.type))totals[machine.type]++;
  return totals;
}
export function canAffordMachine(game,type,count=1) {
  if(!MACHINE_TYPES[type]||!Number.isInteger(count)||count<1)return false;
  const cost=MACHINE_TYPES[type].cost;
  return game.resources.scrap>=count*cost.scrap && game.resources.alloy>=count*cost.alloy;
}
export function buyMachine(game,type) {
  if(!MACHINE_TYPES[type])return {ok:false,message:"Unknown machine type"};
  if(!canAffordMachine(game,type))return {ok:false,message:"Not enough scrap or alloy to buy "+MACHINE_TYPES[type].name+"."};
  const cost=MACHINE_TYPES[type].cost;
  game.resources.scrap-=cost.scrap;
  game.resources.alloy-=cost.alloy;
  machineStock(game)[type]++;
  return {ok:true,message:MACHINE_TYPES[type].name+" purchased. Now in machine storage."};
}
export function placeOwnedMachine(game,type,x,y,rotation=0,id="m-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)){
  if(!MACHINE_TYPES[type])return {ok:false,message:"Choose a machine type"};
  if(!stockCount(game,type))return {ok:false,message:"No "+MACHINE_TYPES[type].name+" in storage. Buy another from the palette."};
  if(!Number.isInteger(x)||!Number.isInteger(y)||![0,90,180,270].includes(rotation)||
    !canPlace(game.factory.machines,type,x,y,rotation))return {ok:false,message:"The selected footprint is blocked or outside the factory."};
  if(game.factory.machines.some(m=>m.id===id))return {ok:false,message:"Duplicate machine ID"};
  machineStock(game)[type]--;
  game.factory.machines.push({id,type,x,y,rotation});
  return {ok:true,message:MACHINE_TYPES[type].name+" installed.",machineId:id};
}
export function removeOwnedMachine(game,id){
  const index=game.factory.machines.findIndex(m=>m.id===id);
  if(index<0)return {ok:false,message:"No machine to remove."};
  const machine=game.factory.machines[index];
  removeMachineProduction(game,id);
  game.factory.machines.splice(index,1);
  machineStock(game)[machine.type]++;
  return {ok:true,message:MACHINE_TYPES[machine.type].name+" returned to storage."};
}
export function clearFactoryLayout(game){
  const stock=machineStock(game);
  const count=game.factory.machines.length;
  refundJobs(game); // refunds unfinished inputs; banks completed deliveries
  for(const machine of game.factory.machines)stock[machine.type]++;
  game.factory.machines=[];
  game.factory.production.running=false;
  game.factory.production.recipes={};
  game.factory.production.enabled={};
  return {ok:true,message:count+" machine"+(count===1?"":"s")+" returned to storage. Factory cleared.",count};
}
export function starterLineQuote(game){
  const desired=defaultGame().factory.machines;
  const stock={...machineStock(game)};
  for(const machine of game.factory.machines)stock[machine.type]++;
  const missing={};
  const cost={scrap:0,alloy:0};
  for(const machine of desired){
    if(stock[machine.type]>0){stock[machine.type]--;continue;}
    missing[machine.type]=(missing[machine.type]||0)+1;
    cost.scrap+=MACHINE_TYPES[machine.type].cost.scrap;
    cost.alloy+=MACHINE_TYPES[machine.type].cost.alloy;
  }
  return {cost,missing,affordable:game.resources.scrap>=cost.scrap&&game.resources.alloy>=cost.alloy};
}
export function installStarterLine(game){
  const quote=starterLineQuote(game);
  if(!quote.affordable)return {ok:false,message:"Starter line requires "+quote.cost.scrap+" scrap and "+quote.cost.alloy+" alloy for missing machines."};
  const stock=machineStock(game);
  const starter=defaultGame().factory;
  clearFactoryLayout(game);
  // Buy missing equipment exactly once. Reused machines cost nothing.
  game.resources.scrap-=quote.cost.scrap;
  game.resources.alloy-=quote.cost.alloy;
  for(const [type,count] of Object.entries(quote.missing))stock[type]+=count;
  for(const item of starter.machines){
    stock[item.type]--;
    game.factory.machines.push({...item});
  }
  game.factory.production.recipes={...starter.production.recipes};
  return {ok:true,message:"Starter production line installed; unused machines returned to storage.",cost:quote.cost};
}
