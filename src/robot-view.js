import * as THREE from "three";
import { CHASSIS, SOCKETS, PARTS, normalizeDesign } from "./robot-data.js";

/**
 * Socket-based robot meshes. Every component is built from its socket in a
 * consistent coordinate system: +Z = forward, +Y = upward, ±X = side mounts.
 * Frame brackets and connector shafts connect EVERY mount to the chassis.
 * The renderer does not change robot statistics, saves or compatibility rules.
 */
export function createRobotDisplays(scene){
  const mat=(color,metalness=.58,roughness=.53)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const dark=mat(0x263840), steel=mat(0x6c8187),bright=mat(0x9bafb4),edge=mat(0x3d5258);
  const brass=mat(0xd8a05e,.47,.38),rubber=mat(0x182327,.12,.86);
  const glass=new THREE.MeshStandardMaterial({color:0x66cdd2,emissive:0x25777f,emissiveIntensity:1.1,metalness:.24,roughness:.26});
  const warning=mat(0xc96745,.4,.5);
  const shared=[dark,steel,bright,edge,brass,rubber,glass,warning];
  const root=new THREE.Group();root.name="Modular robotic fleet";scene.add(root);
  const draftRoot=new THREE.Group(),fleetRoot=new THREE.Group();root.add(draftRoot,fleetRoot);

  function block(parent,w,h,d,x,y,z,m){
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
    o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function bevel(parent,w,h,d,x,y,z,m,b=.055){
    const shape=new THREE.Shape(),r=Math.min(b,w*.16,h*.16);
    shape.moveTo(-w/2+r,-h/2);
    shape.lineTo(w/2-r,-h/2);shape.lineTo(w/2,-h/2+r);
    shape.lineTo(w/2,h/2-r);shape.lineTo(w/2-r,h/2);
    shape.lineTo(-w/2+r,h/2);shape.lineTo(-w/2,h/2-r);
    shape.lineTo(-w/2,-h/2+r);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{
      depth:d,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.02,bevelThickness:.02,curveSegments:2
    }),m);
    mesh.position.set(x,y,z-d/2);mesh.castShadow=true;mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  }
  function cylinder(parent,r,h,x,y,z,m,axis="y",segments=14){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),m);
    mesh.position.set(x,y,z);
    if(axis==="x")mesh.rotation.z=Math.PI/2;
    if(axis==="z")mesh.rotation.x=Math.PI/2;
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function pipe(parent,a,b,r,m){
    const p1=new THREE.Vector3(...a),p2=new THREE.Vector3(...b),v=p2.clone().sub(p1);
    if(v.lengthSq()<0.0001)return;
    const piece=cylinder(parent,r,v.length(),0,0,0,m);
    piece.position.copy(p1.clone().add(p2).multiplyScalar(.5));
    piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
    return piece;
  }
  function bolt(parent,x,y,z,m=brass){
    cylinder(parent,.05,.026,x,y,z,m,"z",8);
  }
  function moduleBase(parent,accent=steel){
    bevel(parent,.52,.24,.49,0,0,0,edge,.04);
    cylinder(parent,.19,.16,0,0,.19,accent,"z");
    cylinder(parent,.11,.20,0,0,.22,dark,"z");
  }
  function build(design,parent,position,scale=1){
    const cfg=normalizeDesign(design),frame=CHASSIS[cfg.chassis];
    const width=cfg.chassis==="juggernaut"?2.14:cfg.chassis==="hauler"?1.82:1.46;
    const depth=cfg.chassis==="juggernaut"?1.86:cfg.chassis==="hauler"?1.71:1.58;
    const paint=mat(frame.color,.45,.44);
    const robot=new THREE.Group();robot.position.set(...position);robot.scale.setScalar(scale);
    robot.userData.robotName=cfg.name;parent.add(robot);

    // Welded frame, chamfered armor, rivets, undercarriage, rear cooling vents.
    bevel(robot,width,.63,depth,0,1.12,0,paint,.13);
    block(robot,width*.85,.15,depth*.88,0,.74,0,dark);
    bevel(robot,width+.13,.14,depth+.04,0,1.51,0,steel);
    for(const side of [-1,1]){
      bevel(robot,.16,.44,depth*.79,side*(width/2-.015),1.16,0,steel,.02);
      for(const z of [-depth*.29,depth*.29]){
        bolt(robot,side*(width/2+.07),1.22,z);
        block(robot,.18,.12,.22,side*(width/2+.09),.9,z,edge);
      }
    }
    for(const side of [-1,1]){
      const x=side*(width*.33);
      for(const z of [-depth*.29,depth*.29])bevel(robot,.31,.075,.21,x,1.59,z,edge,.02);
    }
    // Front optics beneath the dedicated front hardpoint, with a real bezel.
    bevel(robot,width*.53,.19,.12,0,1.18,depth/2+.06,dark,.025);
    for(const x of [-width*.17,width*.17]){
      bevel(robot,.22,.11,.065,x,1.19,depth/2+.13,glass,.018);
    }
    for(let x=-width*.3;x<=width*.3+.001;x+=.24)
      block(robot,.11,.075,.09,x,1.3,-depth/2-.04,edge);

    for(const socketId of frame.slots){
      const part=PARTS[cfg.slots[socketId]];
      const socket=SOCKETS[socketId];
      const sign=socketId.endsWith("L")||socketId==="arm3"?-1:
                 socketId.endsWith("R")||socketId==="arm4"?1:0;
      const pos=[...socket.pos];
      const drive=socketId.startsWith("drive");
      const arm=socketId.startsWith("arm");
      if(drive)pos[0]=sign*(width/2+.20);
      if(arm)pos[0]=sign*(width/2+.31);
      // Separate power unit and weapon turrets vertically and longitudinally.
      if(socketId==="core"){pos[1]=1.76;pos[2]=-.15;}
      if(socketId==="top1"){pos[1]=2.16;pos[2]=.44;}
      if(socketId==="top2"){pos[1]=2.16;pos[2]=-.62;}
      if(socketId==="front")pos[2]=depth/2+.16;
      if(socketId==="back1")pos[2]=-depth/2-.22;
      if(socketId==="back2")pos[2]=-depth/2-.74;
      const support=[
        sign?sign*(width/2-.07):0,
        drive?.55:arm?1.13:socketId==="core"||socketId.startsWith("top")?1.51:1.15,
        socketId==="front"?depth/2-.03:
        socketId.startsWith("back")?-depth/2+.03:pos[2]
      ];
      // Structural strut fixes the floating-part problem. It attaches at both ends.
      pipe(robot,support,pos,drive?.11:arm?.10:.095,steel);
      if(arm){
        cylinder(robot,.19,.25,sign*(width/2+.06),pos[1],pos[2],brass,"x");
        cylinder(robot,.11,.28,sign*(width/2+.23),pos[1],pos[2],dark,"x");
      }
      if(socketId.startsWith("back")){
        for(const side of [-.22,.22]){
          pipe(robot,[side,1.45,-depth/2],[side,pos[1],pos[2]],.045,edge);
        }
      }
      const mount=new THREE.Group();
      mount.position.set(...pos);mount.userData.socketId=socketId;
      robot.add(mount);
      // Matching universal collar on every module, even when empty.
      const collar=bevel(mount,.43,.24,.40,0,0,0,dark,.035);
      cylinder(mount,.16,.18,0,0,.16,brass,"z");
      bolt(mount,-.15,.14,.19);
      bolt(mount,.15,.14,.19);
      if(!part){
        bevel(mount,.26,.20,.20,0,.17,.07,edge,.025);
        cylinder(mount,.075,.09,0,.31,.07,glass);
        continue;
      }
      if(part.category==="mobility"){
        // Wheel and track hubs share the same side-facing axle flange.
        if(part.id==="track"){
          bevel(mount,.39,.57,1.26,sign*.08,-.05,0,rubber,.045);
          for(const z of [-.40,0,.40]){
            cylinder(mount,.27,.38,sign*.08,-.09,z,dark,"x");
            cylinder(mount,.16,.41,sign*.08,-.09,z,steel,"x");
          }
          for(let z=-.56;z<=.57;z+=.18)block(mount,.43,.08,.07,sign*.08,.23,z,edge);
          bevel(mount,.12,.36,.88,sign*.30,.03,0,paint,.02);
        }else if(part.id==="spider"){
          for(const z of [-.31,.31]){
            const hip=[sign*.10,-.02,z],knee=[sign*.36,-.18,z+(z>0?.18:-.18)],foot=[sign*.54,-.43,z+(z>0?.31:-.31)];
            pipe(mount,hip,knee,.105,steel);pipe(mount,knee,foot,.085,paint);
            cylinder(mount,.12,.18,...knee,brass,"x");
            bevel(mount,.37,.10,.28,...[foot[0],foot[1]-.03,foot[2]],rubber,.02);
          }
        }else if(part.id==="hover"){
          bevel(mount,.54,.25,1.07,sign*.09,-.13,0,steel,.05);
          for(const z of [-.31,.31]){
            cylinder(mount,.21,.075,sign*.09,-.30,z,glass);
            cylinder(mount,.29,.07,sign*.09,-.22,z,dark);
          }
          block(mount,.10,.13,.83,sign*.32,-.15,0,brass);
        }else{
          const r=part.id==="roadwheel"?.39:.34;
          for(const z of [-.39,.39]){
            cylinder(mount,r,.24,sign*.13,-.04,z,rubber,"x",18);
            cylinder(mount,r*.68,.255,sign*.14,-.04,z,steel,"x");
            cylinder(mount,r*.34,.285,sign*.15,-.04,z,brass,"x");
            for(let j=0;j<6;j++){
              const angle=Math.PI*j/3;
              cylinder(mount,.045,.29,sign*.17,-.04+Math.cos(angle)*r*.49,z+Math.sin(angle)*r*.49,dark,"x",8);
            }
          }
          block(mount,.15,.17,.92,sign*.05,.22,0,edge);
        }
      }else if(part.category==="power"){
        bevel(mount,.68,.47,.66,0,.17,.07,paint,.055);
        for(const side of [-1,1]){
          bevel(mount,.09,.44,.55,side*.31,.18,.07,steel,.015);
          bolt(mount,side*.28,.36,.41);
        }
        cylinder(mount,.23,.52,0,.25,.06,dark);
        cylinder(mount,.17,.53,0,.26,.06,glass);
        if(part.id==="reactor"){
          for(const z of [-.22,.22])cylinder(mount,.10,.14,0,.42,z,brass,"z");
          cylinder(mount,.31,.13,0,.55,.06,edge);
        }
      }else if(part.category==="tool"||part.category==="weapon"){
        const tool=part.category==="tool";
        // Articulated shoulder, telescopic forearm, universal forward tool head.
        cylinder(mount,.19,.35,0,.06,.18,brass,"x");
        bevel(mount,.34,.28,.53,0,-.04,.43,tool?paint:edge,.055);
        pipe(mount,[-.16,-.06,.2],[-.16,-.06,.77],.057,steel);
        pipe(mount,[.16,-.06,.2],[.16,-.06,.77],.057,steel);
        bevel(mount,.44,.29,.24,0,-.04,.77,steel,.03);
        const tip=.91;
        if(["claw","extractor","magnet"].includes(part.id)){
          for(const side of [-1,1]){
            const grip=bevel(mount,.11,.17,.40,side*.20,-.08,tip+.16,part.id==="extractor"?glass:brass,.02);
            grip.rotation.y=side*.27;
            bevel(mount,.09,.16,.12,side*.12,-.05,tip+.39,dark,.015);
          }
          if(part.id==="magnet")cylinder(mount,.20,.17,0,-.06,tip+.19,glass,"z");
          if(part.id==="extractor")cylinder(mount,.10,.22,0,.16,tip+.10,glass);
        }else if(part.id==="cutter"){
          cylinder(mount,.23,.09,0,-.06,tip+.17,dark,"z");
          cylinder(mount,.29,.045,0,-.06,tip+.18,bright,"z",18);
          cylinder(mount,.09,.06,0,-.06,tip+.22,brass,"z");
          for(let k=0;k<8;k++){
            const a=k*Math.PI/4;
            const tooth=block(mount,.12,.05,.06,Math.sin(a)*.31,-.06+Math.cos(a)*.31,tip+.17,steel);
            tooth.rotation.z=-a;
          }
        }else if(part.id==="drill"){
          cylinder(mount,.20,.28,0,-.07,tip+.07,steel,"z");
          const cone=new THREE.Mesh(new THREE.ConeGeometry(.21,.56,12),bright);
          cone.rotation.x=Math.PI/2;cone.position.set(0,-.07,tip+.43);
          cone.castShadow=true;mount.add(cone);
        }else if(part.id==="ram"){
          bevel(mount,.53,.43,.28,0,-.05,tip+.09,brass,.06);
          for(const x of [-.17,.17])pipe(mount,[x,-.17,tip-.15],[x,-.17,tip+.2],.055,steel);
        }else{
          const barrel=part.id==="railgun"?.18:part.id==="plasma"?.13:.095;
          const length=part.id==="railgun"?.92:.62;
          for(const x of part.id==="repeater"?[-.12,.12]:[0]){
            cylinder(mount,barrel,length,x,-.07,tip+length*.43,part.id==="plasma"?glass:dark,"z",16);
            cylinder(mount,barrel*1.32,.09,x,-.07,tip+length*.89,brass,"z",12);
            cylinder(mount,barrel*.5,.1,x,-.07,tip+length*.94,edge,"z");
          }
          if(part.id==="railgun"){
            for(const side of [-1,1])pipe(mount,[side*.25,.05,.63],[side*.25,.05,tip+.74],.045,glass);
          }
        }
      }else if(part.category==="sensor"){
        bevel(mount,.46,.37,.40,0,.10,.09,paint,.04);
        for(const x of [-.14,.14]){
          cylinder(mount,.105,.14,x,.13,.34,dark,"z");
          cylinder(mount,.067,.15,x,.13,.35,glass,"z");
        }
        if(part.id==="lidar"||part.id==="scanner"){
          cylinder(mount,.20,.13,0,.38,.10,brass);
          cylinder(mount,.13,.20,0,.48,.10,glass);
        }
      }else if(part.category==="cargo"){
        const large=part.id==="pod";
        bevel(mount,large?.92:.77,large?.61:.48,large?.73:.68,0,.08,-.12,large?paint:steel,.07);
        bevel(mount,large?.77:.62,.07,large?.59:.56,0,.44,-.12,edge,.018);
        for(const side of [-1,1]){
          block(mount,.05,.50,.54,side*(large?.38:.31),.13,-.12,brass);
        }
      }else if(part.category==="armor"){
        bevel(mount,.97,.67,.19,0,.05,.25,part.id==="reactive"?paint:steel,.09);
        for(const x of [-.31,0,.31]){
          bevel(mount,.20,.50,.07,x,.04,.35,edge,.02);
          bolt(mount,x,.29,.39);
        }
      }else{
        bevel(mount,.50,.45,.44,0,.13,.08,paint,.045);
        cylinder(mount,.18,.22,0,.43,.09,part.id==="shield"?glass:brass);
        for(const side of [-1,1])block(mount,.07,.28,.30,side*.23,.21,.08,steel);
        if(part.id==="welder"){
          pipe(mount,[0,.3,.12],[0,.55,.45],.055,steel);
          cylinder(mount,.085,.13,0,.56,.47,glass,"z");
        }
      }
    }
    return robot;
  }

  function clear(parent){
    while(parent.children.length){
      const child=parent.children[0];
      child.traverse(o=>{
        o.geometry?.dispose();
        if(o.material&&!shared.includes(o.material))o.material.dispose();
      });
      parent.remove(child);
    }
  }
  function updateDraft(design){clear(draftRoot);build(design,draftRoot,[0,.61,2],1.03);}
  function updateFleet(fleet){
    clear(fleetRoot);
    const spots=[[10.8,.14,1.25],[12.75,.14,-.92],[10.45,.14,-1.25],[12.7,.14,1.3]];
    fleet.slice(0,4).forEach((unit,i)=>build(unit.design||{},fleetRoot,spots[i],.51));
  }
  function pickSocket(raycaster){
    for(const hit of raycaster.intersectObjects(draftRoot.children,true)){
      let node=hit.object;
      while(node&&node!==draftRoot){
        if(node.userData?.socketId)return node.userData.socketId;
        node=node.parent;
      }
    }
    return null;
  }
  function dispose(){clear(draftRoot);clear(fleetRoot);shared.forEach(m=>m.dispose());scene.remove(root);}
  return {updateDraft,updateFleet,pickSocket,dispose};
}
