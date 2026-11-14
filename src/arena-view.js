import * as THREE from "three";
import { createRobotDisplays } from "./robot-view.js";

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createArenaView(host,initialMatch){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0d171c);
  scene.fog=new THREE.Fog(0x0d171c,17,32);
  const camera=new THREE.PerspectiveCamera(43,1,.1,65);
  camera.position.set(0,9.4,12.2);
  camera.lookAt(0,.35,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.55;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText="display:block;width:100%;height:100%;";
  host.replaceChildren(renderer.domElement);
  const ambient=new THREE.HemisphereLight(0xc9e2d8,0x13232a,2.2);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffdfb2,3.1);
  key.position.set(4,12,9);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-12;key.shadow.camera.right=12;
  key.shadow.camera.top=10;key.shadow.camera.bottom=-10;
  scene.add(key);
  const fill=new THREE.PointLight(0x6ce2cf,32,18);
  fill.position.set(-5,3,-5);scene.add(fill);
  const mats={
    floor:new THREE.MeshStandardMaterial({color:0x26383a,metalness:.45,roughness:.72}),
    tile:new THREE.MeshStandardMaterial({color:0x334749,metalness:.5,roughness:.75}),
    edge:new THREE.MeshStandardMaterial({color:0xca8952,metalness:.54,roughness:.45}),
    bolt:new THREE.MeshStandardMaterial({color:0x9cb3ad,metalness:.72,roughness:.3}),
    dark:new THREE.MeshStandardMaterial({color:0x14272e,metalness:.7,roughness:.6}),
    glow:new THREE.MeshStandardMaterial({color:0x69ccb7,emissive:0x36a893,emissiveIntensity:.8}),
    red:new THREE.MeshStandardMaterial({color:0xd2695c,emissive:0x9c3428,emissiveIntensity:.7})
  };
  const env=new THREE.Group();scene.add(env);
  function box(w,h,d,x,y,z,material,group=env){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
    group.add(mesh);return mesh;
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(15.6,9.8),mats.floor);
  floor.rotation.x=-Math.PI/2;floor.position.y=-.07;floor.receiveShadow=true;env.add(floor);
  for(let x=-7;x<=7;x+=1){
    box(.027,.012,8.85,x,-.03,0,mats.tile);
    if(Math.abs(x)%2===0)for(const z of [-4.22,4.22])box(.13,.03,.13,x,.01,z,mats.bolt);
  }
  for(let z=-4;z<=4;z+=1)box(14,.018,.024,0,-.03,z,mats.tile);
  for(const z of [-4.45,4.45])box(15,.19,.20,0,.045,z,mats.edge);
  for(const x of [-7.18,7.18])box(.2,.18,8.85,x,.04,0,mats.edge);
  for(const x of [-5.8,5.8]){
    for(const z of [-3.66,3.66]){
      const post=box(.37,1.65,.37,x,.79,z,mats.dark);
      box(.53,.16,.53,x,1.7,z,mats.edge);
      box(.34,.23,.34,x,1.58,z,x>0?mats.red:mats.glow);
    }
  }
  for(let i=0;i<12;i++){
    const x=(i%6-2.5)*2.42,z=(Math.floor(i/6)===0?-4.25:4.25);
    box(.30,.10,.12,x,.04,z,mats.glow);
  }
  // Static industrial wreckage outside the fighting rectangle.
  for(const x of [-8.4,8.4])for(const z of [-2.5,0,2.5]){
    box(1.2,.8,1.5,x,.28,z,mats.dark);
    box(1.3,.13,1.55,x,.73,z,mats.edge);
  }
  const fighters=createRobotDisplays(scene);
  let models=fighters.setCombatants(initialMatch.playerDesign,initialMatch.enemyDesign);
  let currentId=initialMatch.id,lastSeq=initialMatch.eventSeq||0,match=initialMatch;
  const beams=[],flashMats=[];
  const clock=new THREE.Clock();
  let disposed=false,frameId=0;
  function clearFx(){
    for(const b of beams){
      scene.remove(b.object);
      b.object.geometry.dispose();
      b.object.material.dispose();
    }
    beams.length=0;
  }
  function addBeam(event){
    const source=event.from==="player"?models.player:models.enemy;
    const target=event.to==="player"?models.player:models.enemy;
    if(!source||!target)return;
    const from=new THREE.Vector3(source.position.x,1.40,source.position.z);
    const to=new THREE.Vector3(target.position.x,1.25,target.position.z);
    const delta=to.clone().sub(from),length=Math.max(.001,delta.length());
    const material=new THREE.MeshBasicMaterial({color:event.type==="miss"?0xe8c37a:event.from==="player"?0x8cecdf:0xff9768,
      transparent:true,opacity:.85,depthWrite:false});
    const ray=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,length,7),material);
    ray.position.copy(from.add(to).multiplyScalar(.5));
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    scene.add(ray);beams.push({object:ray,time:.20});
    if(beams.length>22){
      const item=beams.shift();scene.remove(item.object);item.object.geometry.dispose();item.object.material.dispose();
    }
  }
  function setMatch(next){
    if(!next)return;
    if(next.id!==currentId){
      clearFx();
      models=fighters.setCombatants(next.playerDesign,next.enemyDesign);
      currentId=next.id;lastSeq=0;
    }
    for(const event of next.events||[]){
      if(event.seq>lastSeq&&(event.type==="hit"||event.type==="miss"))addBeam(event);
      lastSeq=Math.max(lastSeq,event.seq);
    }
    match=next;
  }
  function resize(){
    const rect=host.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    camera.aspect=rect.width/rect.height;
    camera.fov=rect.width<580?59:43;
    camera.position.set(0,rect.width<580?13:9.4,rect.width<580?15.4:12.2);
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width,rect.height,false);
  }
  const onResize=()=>resize();
  window.addEventListener("resize",onResize);
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;
  observer?.observe(host);
  function frame(){
    if(disposed)return;
    frameId=requestAnimationFrame(frame);
    const dt=Math.min(.06,clock.getDelta()),t=match?.elapsed||0;
    if(match&&models){
      const positions=[["player",models.player],["enemy",models.enemy]];
      for(const [side,model] of positions){
        const combatant=match[side];if(!combatant||!model)continue;
        const moving=match.status==="running"&&combatant.hp>0;
        model.position.set(combatant.x,moving?.022+Math.sin(performance.now()*.006+(side==="player"?0:1.4))*.023:0,combatant.z);
        model.rotation.y=combatant.heading;
        model.rotation.z=moving?Math.sin(performance.now()*.009+(side==="player"?0:1.1))*.023:combatant.hp<=0?.26:0;
        model.rotation.x=combatant.hp<=0?.29:0;
        model.scale.setScalar(combatant.hp<=0?.66:.76);
      }
    }
    for(let i=beams.length-1;i>=0;i--){
      const beam=beams[i];beam.time-=dt;
      beam.object.material.opacity=clamp(beam.time/.20,0,.85);
      if(beam.time<=0){
        scene.remove(beam.object);beam.object.geometry.dispose();beam.object.material.dispose();beams.splice(i,1);
      }
    }
    renderer.render(scene,camera);
  }
  resize();frame();
  function dispose(){
    disposed=true;cancelAnimationFrame(frameId);observer?.disconnect();window.removeEventListener("resize",onResize);
    clearFx();fighters.dispose();
    env.traverse(o=>o.geometry?.dispose());
    floor.geometry.dispose();Object.values(mats).forEach(m=>m.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  }
  return {setMatch,dispose};
}
