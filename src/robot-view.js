import * as THREE from "three";
import { CHASSIS, SOCKETS, PARTS, normalizeDesign } from "./robot-data.js";

/**
 * Procedural socket-based robots, deliberately rig-free. Every equipped part gets
 * its own visible geometry, so new catalog entries remain usable without GLB assets.
 */
export function createRobotDisplays(scene) {
  const material=(color,metalness=0.65,roughness=0.46)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const dark=material(0x213039),steel=material(0x728286),silver=material(0xadc4c2);
  const orange=material(0xe5a45d,0.3,0.42),rubber=material(0x171f26,0.1,0.85);
  const teal=new THREE.MeshStandardMaterial({color:0x81d1d3,emissive:0x20676a,emissiveIntensity:1.0,metalness:0.3,roughness:0.24});
  const mats=[dark,steel,silver,orange,rubber,teal];
  const root=new THREE.Group();root.name="Robot display";scene.add(root);
  const draftRoot=new THREE.Group(),fleetRoot=new THREE.Group();
  root.add(draftRoot,fleetRoot);

  function cube(parent,w,h,d,x,y,z,mat){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cyl(parent,r,h,x,y,z,mat,axis=null){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),mat);
    mesh.position.set(x,y,z);
    if(axis==="z")mesh.rotation.z=Math.PI/2;
    if(axis==="x")mesh.rotation.x=Math.PI/2;
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function build(design,parent,position,scale=1){
    design=normalizeDesign(design);
    const chassis=CHASSIS[design.chassis],big=design.chassis==="juggernaut",medium=design.chassis==="hauler";
    const width=big?2.15:medium?1.75:1.38;
    const paint=material(chassis.color);
    const group=new THREE.Group();group.position.set(...position);group.scale.setScalar(scale);
    parent.add(group);
    cube(group,width,0.64,1.54,0,1.07,0,paint);
    cube(group,width+0.16,0.15,1.66,0,1.44,0,steel);
    cube(group,width*0.78,0.12,1.30,0,0.72,0,dark);
    for(const sign of [-1,1]){
      cube(group,0.18,0.65,0.36,sign*width/2,1.04,0.2,steel);
      cyl(group,0.11,0.22,sign*(width/2+0.14),1.24,0.2,orange,"z");
    }
    cube(group,0.65,0.17,0.08,0,1.17,0.82,teal);
    // Raised sensor mast helps distant robots read as industrial machines.
    cube(group,0.08,0.32,0.08,0,1.74,-0.38,steel);
    cyl(group,0.13,0.14,0,1.93,-0.38,teal);
    for(const socketId of chassis.slots){
      const part=PARTS[design.slots[socketId]];
      const socket=SOCKETS[socketId];
      const mount=new THREE.Group();
      const p=[...socket.pos];
      if(socketId==="driveL"||socketId==="driveR")p[0]=Math.sign(p[0])*(width/2+0.14);
      if(socketId==="armL"||socketId==="armR"||socketId==="arm3"||socketId==="arm4")p[0]=Math.sign(p[0])*(width/2+0.28);
      mount.position.set(...p);
      mount.userData.socketId=socketId;
      group.add(mount);
      const forward=socketId==="front"||socketId.startsWith("arm");
      if(!part) {
        // Empty slots remain visible and tappable on the assembly platform.
        cube(mount,0.24,0.22,0.24,0,0,0,orange);
        cube(mount,0.11,0.24,0.11,0,0.15,0,teal);
        continue;
      }
      if(part.category==="mobility"){
        if(part.id==="track"){
          cube(mount,0.50,0.66,1.18,0,0,0,rubber);
          for(const z of [-0.38,0.38])cyl(mount,0.30,0.48,0,-0.06,z,steel,"z");
        }else if(part.id==="spider"){
          for(const z of [-0.31,0.31]){
            const leg=cube(mount,0.19,0.75,0.16,Math.sign(p[0])*0.24,-0.08,z,steel);
            leg.rotation.z=Math.sign(p[0])*0.42;
            cube(mount,0.34,0.11,0.25,Math.sign(p[0])*0.43,-0.46,z,rubber);
          }
        }else if(part.id==="hover"){
          cube(mount,0.54,0.27,0.91,0,0,0,steel);
          for(const z of [-0.30,0.30])cyl(mount,0.19,0.06,0,-0.19,z,teal);
        }else{
          const radius=part.id==="roadwheel"?0.42:0.35;
          for(const z of [-0.41,0.41]){
            cyl(mount,radius,0.20,0,-0.02,z,rubber,"z");
            cyl(mount,radius*0.48,0.23,Math.sign(p[0])*0.08,-0.02,z,part.id==="roadwheel"?orange:steel,"z");
          }
        }
      }else if(part.category==="power"){
        cube(mount,0.68,0.48,0.67,0,0,0,dark);
        cyl(mount,0.24,0.50,0,0.05,0,teal);
        for(const sign of [-1,1])cube(mount,0.10,0.39,0.51,sign*0.29,0,0,steel);
      }else if(part.category==="tool"||part.category==="weapon"){
        const arm=part.category==="tool";
        cyl(mount,0.20,0.29,0,0,0,orange,"z");
        cube(mount,0.30,0.28,0.68,0,-0.04,0.39,arm?steel:dark);
        if(part.id==="claw"||part.id==="extractor"||part.id==="magnet"){
          for(const sign of [-1,1]){
            const finger=cube(mount,0.10,0.14,0.42,sign*0.21,-0.04,0.79,arm?orange:steel);
            finger.rotation.y=sign*0.28;
          }
        }else if(part.id==="cutter"||part.id==="drill"){
          cyl(mount,part.id==="drill"?0.12:0.25,0.12,0,-0.06,0.83,orange,"x");
        }else if(part.id==="ram"){
          cube(mount,0.49,0.38,0.20,0,-0.03,0.81,steel);
        }else{
          cyl(mount,part.id==="railgun"?0.16:0.11,0.62,0,-0.03,0.83,part.id==="plasma"?teal:silver,"x");
        }
      }else if(part.category==="sensor"){
        cube(mount,0.48,0.37,0.35,0,0,0,steel);
        for(const sign of [-1,1])cyl(mount,0.12,0.18,sign*0.15,0.04,0.23,teal,"x");
      }else if(part.category==="cargo"){
        cube(mount,part.id==="pod"?0.98:0.79,0.58,0.68,0,0,0,part.id==="pod"?steel:orange);
        cube(mount,0.60,0.08,0.46,0,0.32,0,dark);
      }else if(part.category==="armor"){
        cube(mount,0.91,0.65,0.20,0,0,0,part.id==="reactive"?orange:steel);
        for(const x of [-0.31,0.31])cube(mount,0.08,0.52,0.23,x,0,0,dark);
      }else{
        cube(mount,0.48,0.45,0.47,0,0,0,steel);
        cyl(mount,0.15,0.28,0,0.25,0,part.id==="shield"?teal:orange);
      }
      if(forward&&part.category==="sensor")mount.rotation.y=0;
    }
    return group;
  }
  function clear(parent){
    while(parent.children.length){
      const child=parent.children[0];
      child.traverse(o=>{
        o.geometry?.dispose();
        if(o.material && !mats.includes(o.material))o.material.dispose();
      });
      parent.remove(child);
    }
  }
  function updateDraft(design){
    clear(draftRoot);
    build(design,draftRoot,[0,0.61,2],1.03);
  }
  function updateFleet(fleet){
    clear(fleetRoot);
    const spots=[[10.8,0.14,1.25],[12.75,0.14,-0.92],[10.45,0.14,-1.25],[12.7,0.14,1.3]];
    fleet.slice(0,4).forEach((robot,index)=>build(robot.design||{},fleetRoot,spots[index],0.51));
  }
  function pickSocket(raycaster) {
    for(const hit of raycaster.intersectObjects(draftRoot.children,true)){
      let node=hit.object;
      while(node && node!==draftRoot){
        if(node.userData?.socketId)return node.userData.socketId;
        node=node.parent;
      }
    }
    return null;
  }
  function dispose(){
    clear(draftRoot);clear(fleetRoot);mats.forEach(x=>x.dispose());scene.remove(root);
  }
  return {updateDraft,updateFleet,pickSocket,dispose};
}
