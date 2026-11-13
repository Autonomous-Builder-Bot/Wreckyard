import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createFactoryView } from "./factory-view.js";
import { createRobotDisplays } from "./robot-view.js";

const COLORS = {
  metal: 0x45575a, dark: 0x1b2c32, mid: 0x2b3f45, trim: 0x73817c,
  orange: 0xe7a35f, amber: 0xf9c277, glass: 0x69c3c7, rust: 0x8a5136,
  floor: 0x26343a, pale: 0xa9bbb5, green: 0x8bbaa2
};

const POSITIONS = {
  assembly: { position: [0, 2.9, 2], view: [9, 9, 16], target: [0, 1, 1] },
  workshop: { position: [8, 2.6, 6], view: [15, 9, 16], target: [8, 1, 5] },
  factory: { position: [-9, 3.3, -4], view: [-1, 12, 8], target: [-9, 1, -4] },
  research: { position: [8, 2.5, -6], view: [17, 9, 4], target: [8, 1, -5] },
  missions: { position: [0, 2.8, -8], view: [9, 9, 2], target: [0, 1, -7] },
  warehouse: { position: [-10, 3.5, 5], view: [-3, 9, 15], target: [-9, 1, 5] },
  fleet: { position: [12, 2.9, 0], view: [19, 10, 10], target: [10, 1, 0] }
};

export function createHangar(viewport, hotspotLayer, onSelect, onSocketSelect) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b151c);
  scene.fog = new THREE.Fog(0x0b151c, 28, 70);

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 140);
  const overviewPosition = new THREE.Vector3(23, 18, 25);
  const overviewTarget = new THREE.Vector3(0, 1.3, 0);
  camera.position.copy(overviewPosition);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 57;
  controls.maxPolarAngle = Math.PI / 2.12;
  controls.minPolarAngle = 0.25;
  controls.target.copy(overviewTarget);
  controls.update();

  const mat = (color, metalness = 0.58, roughness = 0.53) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const metal = mat(COLORS.metal);
  const dark = mat(COLORS.dark);
  const mid = mat(COLORS.mid);
  const trim = mat(COLORS.trim);
  const amber = mat(COLORS.orange, 0.32, 0.52);
  const rust = mat(COLORS.rust);
  const rubber = mat(0x192329, 0.12, 0.88);
  const glass = new THREE.MeshStandardMaterial({ color: COLORS.glass, emissive: 0x256c72, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.23 });
  const lampMat = new THREE.MeshStandardMaterial({ color: COLORS.amber, emissive: COLORS.orange, emissiveIntensity: 1.9 });

  function box(parent, w, h, d, x, y, z, material = metal, cast = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, r1, r2, h, x, y, z, material = metal, segments = 12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function line(parent, a, b, radius, material) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const dir = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), material);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createLabel(text, position, width = 3.0) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#111e24e8";
    ctx.fillRect(0, 14, 512, 100);
    ctx.strokeStyle = "#e5a45d";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 17, 506, 94);
    ctx.fillStyle = "#efbf89";
    ctx.font = "bold 43px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.set(...position);
    sprite.scale.set(width, width / 4, 1);
    scene.add(sprite);
    return sprite;
  }

  // The outpost shell: broad open floor with exposed supports and a partially roofless hangar.
  box(scene, 32, 0.65, 24, 0, -0.4, 0, mat(COLORS.floor), false);
  box(scene, 32, 8, 0.6, 0, 3.8, -11.8, mid, false);
  box(scene, 0.6, 8, 24, -15.8, 3.8, 0, dark, false);
  box(scene, 0.6, 8, 24, 15.8, 3.8, 0, mid, false);
  box(scene, 32, 0.5, 1.3, 0, 7.9, -11.45, dark);
  const grid = new THREE.GridHelper(31, 31, 0x58706c, 0x34484b);
  grid.position.y = -0.062;
  scene.add(grid);

  for (let x = -14; x <= 14; x += 7) {
    box(scene, 0.75, 8, 0.75, x, 3.8, -11.45, metal);
    box(scene, 0.45, 0.25, 21.5, x, 7.4, -0.6, dark);
    box(scene, 0.5, 0.17, 4, x, 7.26, 1.1, lampMat, false);
  }
  for (let z of [-10, -3, 4, 11]) {
    box(scene, 31, 0.35, 0.36, 0, 7.7, z, dark);
  }
  for (let x of [-14.7, 14.7]) {
    for (let z of [-10, -3, 4, 11]) box(scene, 0.4, 7.7, 0.4, x, 3.75, z, metal);
  }
  for (let x of [-14, 14]) {
    line(scene, [x, 7.25, -11], [x, 0.25, -9.5], 0.06, rust);
    line(scene, [x, 7.25, 11], [x, 0.25, 9.5], 0.06, rust);
  }
  for (let x = -14; x <= 14; x += 3.5) {
    box(scene, 2.9, 2.3, 0.12, x, 4.3, -11.35, x % 7 === 0 ? mid : metal, false);
  }

  const ambient = new THREE.AmbientLight(0x9aafbc, 1.45);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe5b9, 3.0);
  sun.position.set(8, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const glow1 = new THREE.PointLight(0xf1a861, 55, 14);
  glow1.position.set(-9, 4, -4); scene.add(glow1);
  const glow2 = new THREE.PointLight(0x75c9d1, 25, 12);
  glow2.position.set(8, 3.5, -5); scene.add(glow2);

  function floorPad(x, z, w, d, border = amber) {
    box(scene, w, 0.15, d, x, 0.02, z, dark, false);
    const edges = [
      [w, 0.055, 0.09, x, 0.13, z - d / 2],
      [w, 0.055, 0.09, x, 0.13, z + d / 2],
      [0.09, 0.055, d, x - w / 2, 0.13, z],
      [0.09, 0.055, d, x + w / 2, 0.13, z]
    ];
    edges.forEach(part => box(scene, ...part, border, false));
  }

  // Central robot assembly platform with a glowing powered ring.
  floorPad(0, 2, 8, 7);
  cylinder(scene, 3.25, 3.5, 0.42, 0, 0.31, 2, dark, 32);
  cylinder(scene, 2.9, 3.1, 0.1, 0, 0.57, 2, metal, 32);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.055, 8, 50), lampMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.66, 2);
  scene.add(ring);
  for (let k = 0; k < 4; k++) {
    const angle = k * Math.PI / 2 + Math.PI / 4;
    const x = Math.cos(angle) * 3.05, z = 2 + Math.sin(angle) * 3.05;
    box(scene, 0.55, 0.4, 0.55, x, 0.82, z, trim);
    cylinder(scene, 0.12, 0.12, 0.19, x, 1.12, z, lampMat);
  }

  // Both the assembly robot and actual fleet use the player's modular designs.
  const robotDisplays = createRobotDisplays(scene);
  // Tap an installed part or empty socket to select its editor slot.
  // Ignore longer drags so this does not interfere with OrbitControls.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart = null;
  const pointerDown = event => {
    pointerStart = {x:event.clientX,y:event.clientY};
  };
  const pointerUp = event => {
    if(!pointerStart || activeStation!=="assembly")return;
    const start=pointerStart;pointerStart=null;
    if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;
    const bounds=renderer.domElement.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    pointer.set(((event.clientX-bounds.left)/bounds.width)*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const socket=robotDisplays.pickSocket(raycaster);
    if(socket)onSocketSelect?.(socket);
  };
  renderer.domElement.addEventListener("pointerdown",pointerDown);
  renderer.domElement.addEventListener("pointerup",pointerUp);

  // Workshop, welding equipment and maintenance gantry.
  floorPad(8.5, 5.1, 7.4, 6.5);
  box(scene, 3.6, 0.25, 1.4, 8.4, 1.23, 5.1, trim);
  for (let dx of [-1.55, 1.55]) for (let dz of [-0.52, 0.52]) box(scene, 0.2, 1.3, 0.2, 8.4 + dx, 0.55, 5.1 + dz, metal);
  box(scene, 1.2, 0.5, 0.9, 7.5, 1.68, 5.1, dark);
  box(scene, 0.75, 0.48, 0.14, 8.8, 1.73, 4.49, glass);
  box(scene, 1, 0.7, 1, 10.4, 0.46, 6.5, rust);
  line(scene, [10, 1.2, 4.1], [10.3, 3.4, 4.1], 0.23, trim);
  line(scene, [10.3, 3.4, 4.1], [9, 3.0, 4.3], 0.21, amber);
  line(scene, [9, 3.0, 4.3], [8.35, 2.15, 4.7], 0.17, trim);
  createLabel("WORKSHOP", [8.2, 4.3, 4.1], 2.2);

  // Planned machines now appear as 3D previews of the editable factory layout.
  floorPad(-9, -4, 11, 11, trim);
  const factoryView = createFactoryView(scene);
  createLabel("FACTORY", [-9, 4.9, -4.2], 2.7);

  // Warehouse with shelves and piles of recovered industrial scrap.
  floorPad(-10, 5.8, 9, 8);
  for (let shelf of [-12.5, -9.5, -6.5]) {
    for (let level of [0.9, 2.0, 3.1]) box(scene, 2.1, 0.16, 1.4, shelf, level, 7.7, metal);
    for (let sx of [-0.92, 0.92]) for (let sz of [-0.59, 0.59]) box(scene, 0.11, 3.1, 0.11, shelf + sx, 1.6, 7.7 + sz, trim);
    for (let i = 0; i < 3; i++) {
      const x = shelf + (i % 2 ? 0.4 : -0.42);
      box(scene, 0.72, 0.52, 0.7, x, 1.25 + i * 0.85, 7.7, i % 2 ? rust : dark);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = -13 + (i % 3) * 0.86;
    const z = 3.4 + Math.floor(i / 3) * 0.82;
    box(scene, 0.78, 0.5, 0.74, x, 0.38, z, i % 2 ? rust : metal);
  }
  createLabel("WAREHOUSE", [-10, 4.6, 7.4], 2.9);

  // Research and mission control: computers, illuminated readouts and holo table.
  floorPad(9, -6.4, 8.7, 7.3);
  for (let i = 0; i < 3; i++) {
    const x = 7 + i * 1.5;
    box(scene, 1.25, 1.2, 0.8, x, 0.68, -8.3, dark);
    box(scene, 1.05, 0.72, 0.1, x, 1.45, -7.88, glass);
    box(scene, 0.85, 0.12, 0.65, x, 1.38, -7.64, trim);
  }
  cylinder(scene, 1.45, 1.45, 0.32, 9, 0.7, -4.9, metal, 24);
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1),
    new THREE.MeshBasicMaterial({ color: 0x76ccd2, wireframe: true, transparent: true, opacity: 0.62 }));
  globe.position.set(9, 2, -4.9);
  scene.add(globe);
  createLabel("RESEARCH", [9, 4.5, -7.8], 2.5);

  floorPad(0, -8.1, 7.1, 4.9);
  cylinder(scene, 1.55, 1.55, 1.1, 0, 0.72, -8, dark, 20);
  cylinder(scene, 1.33, 1.33, 0.11, 0, 1.32, -8, glass, 20);
  const missionHolo = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.59, 32),
    new THREE.MeshBasicMaterial({ color: 0x8ce3d6, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  missionHolo.rotation.x = -Math.PI / 2;
  missionHolo.position.set(0, 2, -8);
  scene.add(missionHolo);
  createLabel("MISSIONS", [0, 4.1, -9.5], 2.45);

  // Robot storage and departure staging.
  floorPad(11.5, 0, 7, 5.5);
  for (let z of [-1.5, 1.4]) {
    box(scene, 0.35, 3.6, 0.35, 9.65, 1.86, z, metal);
    box(scene, 0.35, 3.6, 0.35, 13.45, 1.86, z, metal);
    box(scene, 4.2, 0.28, 0.4, 11.55, 3.67, z, dark);
  }
  createLabel("ROBOT HANGAR", [11.5, 4.6, 0], 3);

  // Overhead crane reinforces the sense of a working industrial assembly yard.
  box(scene, 8.7, 0.42, 0.5, 0, 6.25, 2, amber);
  for (let x of [-4.15, 4.15]) box(scene, 0.35, 1.5, 0.6, x, 6.85, 2, metal);
  line(scene, [0, 6.1, 2], [0, 3.7, 2], 0.065, trim);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 16, Math.PI * 1.55), amber);
  hook.position.set(0.11, 3.42, 2); hook.rotation.z = 0.35; scene.add(hook);

  // A few light-colored industrial markers break up the broad floor.
  for (let z of [-8.5, 8.5]) for (let x of [-5.2, 5.2]) {
    box(scene, 1.2, 0.025, 0.13, x, 0.01, z, amber, false);
  }

  const hotspotNodes = new Map();
  for (const [id, info] of Object.entries(POSITIONS)) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "hotspot";
    node.dataset.station = id;
    node.title = "Open " + id;
    const names = { assembly: "ASSEMBLY", workshop: "WORKSHOP", factory: "FACTORY", research: "RESEARCH", missions: "MISSIONS", warehouse: "WAREHOUSE", fleet: "FLEET" };
    node.innerHTML = '<span class="hotspot-dot"></span><span class="hotspot-label">' + names[id] + '</span>';
    node.addEventListener("click", () => onSelect(id));
    hotspotLayer.appendChild(node);
    hotspotNodes.set(id, node);
  }

  let activeStation = "overview";
  let movingCamera = false;
  let cameraDestination = overviewPosition.clone();
  let targetDestination = overviewTarget.clone();
  function focus(id) {
    activeStation = POSITIONS[id] ? id : "overview";
    if (POSITIONS[activeStation]) {
      cameraDestination = new THREE.Vector3(...POSITIONS[activeStation].view);
      targetDestination = new THREE.Vector3(...POSITIONS[activeStation].target);
    } else {
      cameraDestination = overviewPosition.clone();
      targetDestination = overviewTarget.clone();
    }
    movingCamera = true;
    hotspotNodes.forEach((node, key) => node.classList.toggle("active", key === activeStation));
  }
  function resetCamera() {
    camera.position.copy(overviewPosition);
    controls.target.copy(overviewTarget);
    controls.update();
    focus("overview");
    movingCamera = false;
  }
  controls.addEventListener("start", () => movingCamera = false);

  function resize() {
    const w = Math.max(1, viewport.clientWidth);
    const h = Math.max(1, viewport.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  const temp = new THREE.Vector3();
  function updateHotspots() {
    const width = hotspotLayer.clientWidth;
    const height = hotspotLayer.clientHeight;
    for (const [id, node] of hotspotNodes) {
      temp.set(...POSITIONS[id].position).project(camera);
      const px = (temp.x * 0.5 + 0.5) * width;
      const py = (-temp.y * 0.5 + 0.5) * height;
      const visible = temp.z > -1 && temp.z < 1 && px >= 30 && py >= 30 && px < width - 30 && py < height - 30;
      node.style.display = visible ? "flex" : "none";
      node.style.left = px + "px";
      node.style.top = py + "px";
      // When focused, prioritize the selected marker over densely overlapping stations.
      node.style.zIndex = id === activeStation ? "4" : "2";
    }
  }

  let frame = 0;
  let running = true;
  const clock = new THREE.Clock();
  function tick() {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    globe.rotation.y = t * 0.29;
    globe.position.y = 2 + Math.sin(t * 1.4) * 0.1;
    missionHolo.rotation.z = t * 0.34;
    glow1.intensity = 44 + Math.sin(t * 3) * 7;
    if (movingCamera) {
      camera.position.lerp(cameraDestination, 0.055);
      controls.target.lerp(targetDestination, 0.055);
      if (camera.position.distanceTo(cameraDestination) < 0.07 && controls.target.distanceTo(targetDestination) < 0.07) {
        camera.position.copy(cameraDestination);
        controls.target.copy(targetDestination);
        movingCamera = false;
      }
    }
    controls.update();
    camera.updateMatrixWorld();
    updateHotspots();
    renderer.render(scene, camera);
  }

  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(viewport);
  window.addEventListener("resize", resize);
  resize();
  tick();

  return {
    focus, resetCamera, resize,
    setFactoryMachines: factoryView.setMachines,
    setRobotState(draft,fleet){robotDisplays.updateDraft(draft);robotDisplays.updateFleet(fleet);},
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointerup",pointerUp);
      controls.dispose();
      factoryView.dispose();
      robotDisplays.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hotspotLayer.replaceChildren();
    }
  };
}
