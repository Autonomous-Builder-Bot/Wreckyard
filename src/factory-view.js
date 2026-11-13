import * as THREE from "three";
import { GRID_W, GRID_H, MACHINE_TYPES, machineFootprint } from "./state.js";

// Real machine layout plus moving completed resource/part deliveries.
export function createFactoryView(scene) {
  const TILE = 0.79, cx = -9, cz = -4;
  const mat = (color, glow = false) => new THREE.MeshStandardMaterial({
    color, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 0.6 : 0,
    metalness: 0.4, roughness: 0.6
  });
  const m = {
    metal: mat(0x637578), dark: mat(0x203038), copper: mat(0x9c6040),
    light: mat(0xa0b6b1), belt: mat(0x304a4f), amber: mat(0xe9a65f, true),
    cyan: mat(0x70bfc5, true), crate: mat(0x8c7559)
  };
  const root = new THREE.Group();
  root.name = "Factory layout preview";
  scene.add(root);
  const models = new THREE.Group();
  const cargo = new THREE.Group();
  const preview=new THREE.Group();
  root.add(models,cargo,preview);
  const ghostGreen=new THREE.MeshStandardMaterial({
    color:0x88eac0,emissive:0x276d57,emissiveIntensity:0.6,transparent:true,opacity:0.47,
    depthWrite:false,metalness:0.08,roughness:0.36,side:THREE.DoubleSide
  });
  const ghostRed=new THREE.MeshStandardMaterial({
    color:0xed7874,emissive:0x762521,emissiveIntensity:0.6,transparent:true,opacity:0.48,
    depthWrite:false,metalness:0.08,roughness:0.4,side:THREE.DoubleSide
  });
  let lastPreview="";
  function clearPreview() {
    while(preview.children.length){
      const child=preview.children[0];
      child.traverse(o=>o.geometry?.dispose());
      preview.remove(child);
    }
  }
  function setGhost(value) {
    const key=value?JSON.stringify(value):"";
    if(key===lastPreview)return;
    lastPreview=key;clearPreview();
    if(!value||!MACHINE_TYPES[value.type])return;
    draw({...value,id:"preview"},preview);
    const ghostMaterial=value.valid&&!value.remove?ghostGreen:ghostRed;
    preview.traverse(object=>{
      if(object.isMesh){
        object.material=ghostMaterial;
        object.castShadow=false;object.receiveShadow=false;
        object.renderOrder=7;
      }
    });
    preview.position.y=0.07;
  }
  const cargoMats={
    alloy:new THREE.MeshStandardMaterial({color:0xf8b975,emissive:0xc37529,emissiveIntensity:0.9,metalness:0.38}),
    part:new THREE.MeshStandardMaterial({color:0x86d8c8,emissive:0x227f72,emissiveIntensity:0.9,metalness:0.4})
  };
  const cargoGeometry=new THREE.BoxGeometry(0.23,0.21,0.23);
  let activeDeliveries=[];
  const cargoMeshes=[];
  function setActivity(deliveries){activeDeliveries=deliveries||[];}
  function animateDeliveries(){
    // Smoothly interpolate between discrete factory time steps.
    for(let i=0;i<Math.min(32,activeDeliveries.length);i++){
      const packet=activeDeliveries[i];
      let mesh=cargoMeshes[i];
      if(!mesh){
        mesh=new THREE.Mesh(cargoGeometry,cargoMats.alloy);
        cargoMeshes[i]=mesh;
        cargo.add(mesh);
      }
      mesh.visible=true;mesh.material=cargoMats[packet.kind]||cargoMats.alloy;
      if(!Array.isArray(packet.path)||packet.path.length<2)continue;
      const ratio=Math.max(0,Math.min(0.999,(packet.elapsed||0)/Math.max(0.01,packet.duration||1)));
      const offset=ratio*(packet.path.length-1),index=Math.floor(offset),blend=offset-index;
      const from=packet.path[index],to=packet.path[Math.min(index+1,packet.path.length-1)];
      const tileX=from.x+(to.x-from.x)*blend, tileY=from.y+(to.y-from.y)*blend;
      const point=new THREE.Vector3(cx+(tileX+0.5-GRID_W/2)*TILE,0.57,cz+(tileY+0.5-GRID_H/2)*TILE);
      if(mesh.userData.packet!==packet){mesh.position.copy(point);mesh.userData.packet=packet;}
      else mesh.position.lerp(point,0.28);
      mesh.rotation.y+=0.015;
    }
    for(let i=activeDeliveries.length;i<cargoMeshes.length;i++)cargoMeshes[i].visible=false;
  }
  const lines = [];
  for (let x = 0; x <= GRID_W; x++) {
    const a = cx + (x - GRID_W/2)*TILE;
    lines.push(a,0.15,cz-GRID_H*TILE/2, a,0.15,cz+GRID_H*TILE/2);
  }
  for (let y = 0; y <= GRID_H; y++) {
    const a = cz + (y - GRID_H/2)*TILE;
    lines.push(cx-GRID_W*TILE/2,0.15,a, cx+GRID_W*TILE/2,0.15,a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(lines,3));
  const tileLines = new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x667977,transparent:true,opacity:0.4}));
  root.add(tileLines);

  function box(group,w,h,d,x,y,z,material) {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    obj.position.set(x,y,z); obj.castShadow=true; obj.receiveShadow=true; group.add(obj);
    return obj;
  }
  function cylinder(group,r,h,x,y,z,material) {
    const obj = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),material);
    obj.position.set(x,y,z); obj.castShadow=true; group.add(obj);
    return obj;
  }
  function draw(item,parent=models) {
    if (!MACHINE_TYPES[item.type]) return;
    const {w,h}=machineFootprint(item);
    const group=new THREE.Group();
    group.name=item.type+" "+item.id;
    group.position.set(cx+(item.x+w/2-GRID_W/2)*TILE,0,cz+(item.y+h/2-GRID_H/2)*TILE);
    const width=w*TILE-0.08, depth=h*TILE-0.08;
    box(group,width,0.12,depth,0,0.20,0,m.dark);
    if(item.type==="conveyor") {
      const moving=new THREE.Group();
      moving.rotation.y=-(item.rotation||0)*Math.PI/180;
      group.add(moving);
      box(moving,0.60,0.13,0.45,0,0.34,0,m.belt);
      for(const z of [-0.28,0.28]) box(moving,0.67,0.16,0.065,0,0.36,z,m.metal);
      box(moving,0.26,0.03,0.06,-0.11,0.43,0,m.amber);
      for(const sign of [-1,1]) {
        const head=box(moving,0.23,0.03,0.06,0.13,0.43,sign*0.084,m.amber);
        head.rotation.y=sign*Math.PI/4;
      }
    } else if(item.type==="forge") {
      box(group,1.18,1.03,1.06,0,0.82,0,m.copper);
      box(group,0.70,0.51,0.06,0,0.72,0.56,m.amber);
      box(group,1.32,0.16,1.22,0,1.41,0,m.dark);
      cylinder(group,0.20,0.82,-0.38,1.88,-0.30,m.metal);
    } else if(item.type==="assembler") {
      box(group,1.13,0.18,1.06,0,0.47,0,m.metal);
      for(const x of [-0.46,0.46]) box(group,0.11,1.20,0.11,x,1.15,-0.39,m.light);
      box(group,1.06,0.16,0.16,0,1.80,-0.39,m.amber);
      box(group,0.16,0.68,0.18,0.04,1.37,-0.31,m.metal);
      box(group,0.43,0.13,0.16,0.04,1.02,-0.16,m.cyan);
      box(group,0.40,0.30,0.38,-0.18,0.73,0.16,m.crate);
    } else if(item.type==="storage") {
      for(const x of [-0.51,0.51])for(const z of [-0.49,0.49])
        box(group,0.10,1.50,0.10,x,0.95,z,m.metal);
      for(const y of [0.50,1.05,1.62]) box(group,1.20,0.09,1.16,0,y,0,m.light);
      for(const [x,y,z] of [[-0.27,0.76,0.02],[0.28,0.76,-0.09],[-0.10,1.32,0.11]])
        box(group,0.44,0.34,0.42,x,y,z,m.crate);
    } else if(item.type==="generator") {
      box(group,1.12,0.50,1.10,0,0.50,0,m.metal);
      cylinder(group,0.42,0.90,0,1.15,0,m.dark);
      cylinder(group,0.33,0.12,0,1.20,0,m.cyan);
      cylinder(group,0.50,0.13,0,1.69,0,m.amber);
      for(const x of [-0.43,0.43])box(group,0.11,0.70,0.11,x,1.21,0,m.light);
    }
    parent.add(group);
  }
  function setMachines(machines) {
    while(models.children.length) {
      const child=models.children[0];
      child.traverse(o=>o.geometry?.dispose());
      models.remove(child);
    }
    machines.forEach(draw);
  }
  function dispose() {
    setMachines([]);
    setGhost(null);ghostGreen.dispose();ghostRed.dispose();
    geometry.dispose(); tileLines.material.dispose();
    cargoGeometry.dispose();
    Object.values(cargoMats).forEach(material=>material.dispose());
    Object.values(m).forEach(material=>material.dispose());
    scene.remove(root);
  }
  return {setMachines,setGhost,setActivity,animateDeliveries,dispose};
}
