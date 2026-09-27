import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const mobile = matchMedia('(max-width: 700px)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02060d);
scene.fog = new THREE.FogExp2(0x02060d, 0.0022);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 450);
camera.position.set(0, 72, 116);
const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.querySelector('#space').prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 5;
controls.maxDistance = 190;
controls.zoomToCursor = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0x33435c, 0.46));
scene.add(new THREE.HemisphereLight(0x7895b8, 0x11131b, 0.58));
const sunLight = new THREE.PointLight(0xffd59a, 6300, 230, 1.22);
scene.add(sunLight);

const bodyData = [
  { id:'mercury', cn:'水星', en:'MERCURY', type:'岩石行星', distance:'约 0.39 AU', orbit:'约 88 天', rotation:'约 58.6 天', moons:'0', description:'太阳系最小、最靠近太阳的行星，表面遍布撞击坑。', radius:.82, orbitRadius:14, period:88, spin:58.6, color:'#9b948c', accent:'#d2cbc1' },
  { id:'venus', cn:'金星', en:'VENUS', type:'岩石行星', distance:'约 0.72 AU', orbit:'约 224.7 天', rotation:'约 243 天（逆向）', moons:'0', description:'被浓厚大气包裹的炽热世界，也是夜空中最明亮的行星。', radius:1.23, orbitRadius:19, period:224.7, spin:-243, color:'#d8a85f', accent:'#f4d89a' },
  { id:'earth', cn:'地球', en:'EARTH', type:'岩石行星', distance:'约 1 AU', orbit:'约 365.25 天', rotation:'约 24 小时', moons:'月球', description:'拥有液态海洋与丰富生命的蓝色行星，是我们的家园。', radius:1.3, orbitRadius:25, period:365.25, spin:1, color:'#2878a9', accent:'#65b46c' },
  { id:'mars', cn:'火星', en:'MARS', type:'岩石行星', distance:'约 1.52 AU', orbit:'约 687 天', rotation:'约 24.6 小时', moons:'2', description:'富含氧化铁的红色行星，拥有太阳系最大的火山。', radius:.96, orbitRadius:32, period:687, spin:1.03, color:'#b94f35', accent:'#e68a5d' },
  { id:'jupiter', cn:'木星', en:'JUPITER', type:'气态巨行星', distance:'约 5.2 AU', orbit:'约 11.86 年', rotation:'约 9.9 小时', moons:'115（截至 2026，可能更新）', description:'太阳系最大的行星，拥有醒目的云带与大红斑。', radius:3.7, orbitRadius:43, period:4332.6, spin:.41, color:'#c49b72', accent:'#efe0cb' },
  { id:'saturn', cn:'土星', en:'SATURN', type:'气态巨行星', distance:'约 9.58 AU', orbit:'约 29.45 年', rotation:'约 10.7 小时', moons:'293（截至 2026，可能更新）', description:'以壮观的冰与岩石环系闻名，是密度最低的行星。', radius:3.2, orbitRadius:56, period:10759, spin:.45, color:'#d8bf82', accent:'#fff0b6' },
  { id:'uranus', cn:'天王星', en:'URANUS', type:'冰巨行星', distance:'约 19.2 AU', orbit:'约 84 年', rotation:'约 17.2 小时（逆向）', moons:'29（截至 2026，可能更新）', description:'一颗侧躺自转的淡青色冰巨行星，大气富含甲烷。', radius:2.28, orbitRadius:68, period:30687, spin:-.72, color:'#75c9ce', accent:'#c4f7f5' },
  { id:'neptune', cn:'海王星', en:'NEPTUNE', type:'冰巨行星', distance:'约 30.1 AU', orbit:'约 164.8 年', rotation:'约 16.1 小时', moons:'16（截至 2026，可能更新）', description:'深蓝色的遥远行星，拥有太阳系中最猛烈的风暴。', radius:2.2, orbitRadius:80, period:60190, spin:.67, color:'#3156c7', accent:'#779bff' },
  { id:'pluto', cn:'冥王星', en:'PLUTO', type:'矮行星', distance:'平均约 39.5 AU', orbit:'约 248 年', rotation:'约 6.4 天（逆向）', moons:'5', description:'柯伊伯带中的矮行星，拥有著名的心形氮冰平原。', radius:.56, orbitRadius:91, period:90560, spin:-6.4, color:'#b9a48f', accent:'#ead8c6', inclination:.17 }
];

const sunInfo = { id:'sun', cn:'太阳', en:'SUN', type:'恒星', distance:'太阳系中心', orbit:'—', rotation:'约 25–35 天', moons:'—', description:'太阳是太阳系中心的恒星，其引力维系着所有行星的运行。' };
const bodies = new Map();
const bodyMeshes = [];
const orbiters = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
let running = true;
let timeScale = 1;
let selected = null;
let lastSelectedPosition = new THREE.Vector3();
let cameraFlight = null;
let pointerDown = null;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(value ^ value >>> 15, 1 | value) + 0x6d2b79f5 | 0, ((value ^ value >>> 7) >>> 0) / 4294967296));
}

function textureCanvas(width = mobile ? 256 : 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = width / 2;
  return { canvas, ctx:canvas.getContext('2d'), w:canvas.width, h:canvas.height };
}

function finishTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function addSurfaceNoise(ctx, w, h, seed, amount = 14) {
  const random = seededRandom(seed);
  const image = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (random() - .5) * amount;
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + noise));
    image.data[i+1] = Math.max(0, Math.min(255, image.data[i+1] + noise));
    image.data[i+2] = Math.max(0, Math.min(255, image.data[i+2] + noise));
  }
  ctx.putImageData(image, 0, 0);
}

function drawBlotches(ctx, w, h, random, colors, count, minSize, maxSize) {
  for (let i = 0; i < count; i++) {
    const x=random()*w, y=random()*h, rx=minSize+random()*(maxSize-minSize), ry=rx*(.35+random()*.8);
    ctx.save(); ctx.translate(x,y); ctx.rotate((random()-.5)*1.3);
    ctx.globalAlpha=.13+random()*.32; ctx.fillStyle=colors[i%colors.length];
    ctx.beginPath();
    for(let p=0;p<14;p++){const a=p/14*Math.PI*2;const r=1+(random()-.5)*.32;const px=Math.cos(a)*rx*r,py=Math.sin(a)*ry*r;p?ctx.lineTo(px,py):ctx.moveTo(px,py)}
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha=1;
}

function drawCloudBands(ctx, w, h, colors, seed, strength = 1) {
  const random=seededRandom(seed);
  for(let band=0;band<20;band++){
    const y=(band+.5)*h/20+Math.sin(band*2.1)*4;
    ctx.strokeStyle=colors[band%colors.length]; ctx.globalAlpha=(.11+random()*.28)*strength;
    ctx.lineWidth=2+random()*8;
    ctx.beginPath(); ctx.moveTo(-20,y);
    for(let x=0;x<=w+20;x+=18)ctx.lineTo(x,y+Math.sin(x*.035+band)*3+Math.sin(x*.011+band*2)*5);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}

function makePlanetTexture(data) {
  const {canvas,ctx,w,h}=textureCanvas();
  const random=seededRandom([...data.id].reduce((n,c)=>n+c.charCodeAt(0)*17,31));
  const gradient=ctx.createLinearGradient(0,0,0,h); gradient.addColorStop(0,data.accent); gradient.addColorStop(.5,data.color); gradient.addColorStop(1,data.accent);
  ctx.fillStyle=gradient; ctx.fillRect(0,0,w,h);

  if(data.id==='mercury'){
    drawBlotches(ctx,w,h,random,['#3d3731','#d0c3ae','#6e6256'],95,3,w*.035);
    for(let i=0;i<48;i++){const x=random()*w,y=random()*h,r=2+random()*12;ctx.fillStyle='rgba(35,30,27,.28)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(235,220,196,.18)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x-r*.14,y-r*.15,r*.82,0,Math.PI*2);ctx.stroke()}
  } else if(data.id==='venus'){
    drawCloudBands(ctx,w,h,['#fff0b4','#d7a94f','#fff8d5','#b98338'],91,1.25);
    drawBlotches(ctx,w,h,random,['#fff1ad','#c68c35'],25,10,w*.08);
  } else if(data.id==='earth'){
    ctx.fillStyle='#0d5791';ctx.fillRect(0,0,w,h);
    const land=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.closePath();ctx.fill()};
    land([[.07,.25],[.16,.18],[.24,.24],[.22,.39],[.27,.48],[.20,.60],[.14,.52],[.10,.38]],'#568d4b');
    land([[.20,.52],[.29,.54],[.32,.68],[.28,.88],[.22,.76]],'#8a713e');
    land([[.47,.23],[.58,.15],[.75,.22],[.85,.36],[.77,.48],[.66,.41],[.61,.62],[.53,.78],[.48,.57],[.40,.42]],'#597e42');
    land([[.79,.67],[.88,.64],[.92,.78],[.85,.86]],'#9b7441');
    drawBlotches(ctx,w,h,random,['#2f6b38','#b08a48','#e2c37b'],38,4,w*.035);
    ctx.strokeStyle='rgba(255,255,255,.68)';ctx.lineWidth=2.5;ctx.globalAlpha=.55;
    for(let i=0;i<22;i++){const y=random()*h,x=random()*w,l=18+random()*65;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+l*.3,y-5,x+l*.68,y+7,x+l,y);ctx.stroke()}ctx.globalAlpha=1;
  } else if(data.id==='mars'){
    drawBlotches(ctx,w,h,random,['#5e251c','#7b3422','#dd8050','#3b2924'],62,4,w*.06);
    ctx.fillStyle='rgba(230,219,198,.88)';ctx.fillRect(0,0,w,h*.035);ctx.fillRect(0,h*.965,w,h*.035);
    ctx.strokeStyle='rgba(65,27,22,.44)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(w*.08,h*.56);ctx.bezierCurveTo(w*.28,h*.49,w*.46,h*.67,w*.68,h*.53);ctx.stroke();
  } else if(data.id==='jupiter'){
    const bands=['#d9c29e','#8e563c','#edd9b6','#b87952','#f0dfbf','#7b4634','#d9b17e','#f1dec1'];
    let y=0;let i=0;while(y<h){const bh=7+random()*17;ctx.fillStyle=bands[i++%bands.length];ctx.fillRect(0,y,w,bh);y+=bh}
    drawCloudBands(ctx,w,h,['#fff0d0','#6f382b','#c97948'],204,1);
    ctx.fillStyle='#a8452f';ctx.globalAlpha=.9;ctx.beginPath();ctx.ellipse(w*.72,h*.66,w*.08,h*.065,-.12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e7a16e';ctx.lineWidth=4;ctx.stroke();ctx.globalAlpha=1;
  } else if(data.id==='saturn'){
    const bands=['#ead9a8','#c8a96e','#f2e4bd','#bfa06a','#e1cc94'];let y=0,i=0;
    while(y<h){const bh=8+random()*14;ctx.fillStyle=bands[i++%bands.length];ctx.fillRect(0,y,w,bh);y+=bh}drawCloudBands(ctx,w,h,['#fff4cf','#9d7e52'],401,.6);
  } else if(data.id==='uranus'){
    drawCloudBands(ctx,w,h,['#c7ffff','#4fadb7','#9ee3e5'],661,.38);ctx.fillStyle='rgba(213,255,255,.1)';ctx.fillRect(0,h*.2,w,h*.18);
  } else if(data.id==='neptune'){
    drawCloudBands(ctx,w,h,['#80a7ff','#173b9f','#c7d8ff'],731,.75);
    ctx.fillStyle='rgba(15,23,86,.58)';ctx.beginPath();ctx.ellipse(w*.66,h*.58,w*.06,h*.045,-.15,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(225,237,255,.64)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.15,h*.33);ctx.bezierCurveTo(w*.3,h*.26,w*.42,h*.4,w*.57,h*.3);ctx.stroke();
  } else if(data.id==='pluto'){
    drawBlotches(ctx,w,h,random,['#f0ded0','#6a574d','#9b8374','#cbb8a5'],72,3,w*.055);
    ctx.fillStyle='rgba(238,225,207,.78)';ctx.beginPath();ctx.moveTo(w*.52,h*.33);ctx.bezierCurveTo(w*.45,h*.22,w*.37,h*.34,w*.43,h*.49);ctx.lineTo(w*.52,h*.68);ctx.lineTo(w*.61,h*.49);ctx.bezierCurveTo(w*.68,h*.34,w*.59,h*.22,w*.52,h*.33);ctx.fill();
  }
  addSurfaceNoise(ctx,w,h,data.id.length*193, data.id==='uranus'?6:13);
  return finishTexture(canvas);
}

function makeSunTexture() {
  const {canvas,ctx,w,h}=textureCanvas(); const random=seededRandom(57721);
  const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#ffba32');gradient.addColorStop(.5,'#f46b0d');gradient.addColorStop(1,'#ffc446');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  for(let i=0;i<320;i++){const x=random()*w,y=random()*h,r=2+random()*11;ctx.strokeStyle=i%3?'rgba(255,238,109,.28)':'rgba(116,24,0,.2)';ctx.lineWidth=1+random()*3;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke()}
  drawCloudBands(ctx,w,h,['#fff2a0','#ce3f08','#ffb326'],933,1.05);addSurfaceNoise(ctx,w,h,4011,12);return finishTexture(canvas);
}

function makeEarthCloudTexture() {
  const {canvas,ctx,w,h}=textureCanvas();const random=seededRandom(2024);ctx.clearRect(0,0,w,h);ctx.strokeStyle='#fff';
  for(let i=0;i<42;i++){const x=random()*w,y=random()*h,l=18+random()*75;ctx.globalAlpha=.12+random()*.42;ctx.lineWidth=2+random()*8;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+l*.25,y-7,x+l*.72,y+8,x+l,y);ctx.stroke()}ctx.globalAlpha=1;return finishTexture(canvas);
}

function addStars() {
  const count = mobile ? 1700 : 3200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const radius = 120 + Math.random() * 140;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = radius * Math.cos(phi);
    positions[i*3+2] = radius * Math.sin(phi) * Math.sin(theta);
    color.setHSL(.52 + Math.random() * .13, .25 + Math.random() * .4, .65 + Math.random() * .3);
    colors.set([color.r,color.g,color.b], i*3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size:mobile?.42:.33, vertexColors:true, transparent:true, opacity:.86, sizeAttenuation:true })));
}

function createOrbit(radius, inclination = 0) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(160).map(p => new THREE.Vector3(p.x, 0, p.y));
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color:0x39506b, transparent:true, opacity:.28 }));
  line.rotation.z = inclination;
  scene.add(line);
}

function createSun() {
  const texture = makeSunTexture();
  const material = new THREE.MeshBasicMaterial({ map:texture, color:0xffd06a });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(6, 48, 32), material);
  mesh.userData.body = sunInfo;
  mesh.userData.surfaceTexture = texture;
  scene.add(mesh);
  const glowMaterial = new THREE.SpriteMaterial({ map:createGlowTexture(), color:0xff9f32, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMaterial); glow.scale.set(22,22,1); mesh.add(glow);
  const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowMaterial.map, color:0xff6b17, transparent:true, opacity:.25, depthWrite:false, blending:THREE.AdditiveBlending }));
  outerGlow.scale.set(31,31,1); mesh.add(outerGlow);
  bodies.set('sun', mesh); bodyMeshes.push(mesh);
}

function createGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64,64,8,64,64,64);
  gradient.addColorStop(0,'rgba(255,255,230,1)'); gradient.addColorStop(.16,'rgba(255,180,48,.75)'); gradient.addColorStop(.5,'rgba(255,90,10,.16)'); gradient.addColorStop(1,'rgba(255,80,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}

function createPlanet(data, index) {
  createOrbit(data.orbitRadius, data.inclination || 0);
  const pivot = new THREE.Group();
  pivot.rotation.y = index * .78 + .35;
  pivot.rotation.z = data.inclination || 0;
  scene.add(pivot);
  const texture = makePlanetTexture(data);
  const material = new THREE.MeshStandardMaterial({ map:texture, roughness:data.id==='earth'?.72:.88, metalness:0, emissive:new THREE.Color(data.color).multiplyScalar(.08), emissiveIntensity:data.id==='neptune'?.2:.12 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, mobile ? 28 : 48, mobile ? 18 : 32), material);
  mesh.position.x = data.orbitRadius;
  mesh.rotation.z = data.id === 'uranus' ? Math.PI * .49 : .12;
  mesh.userData.body = data;
  pivot.add(mesh);
  bodies.set(data.id, mesh); bodyMeshes.push(mesh);
  orbiters.push({ pivot, mesh, data });

  if (data.id === 'earth') createMoon(mesh);
  if (data.id === 'earth') createEarthAtmosphere(mesh);
  if (data.id === 'saturn') createSaturnRings(mesh);
}

function createMoon(earth) {
  const pivot = new THREE.Group(); earth.add(pivot);
  const moonData={id:'moon',color:'#8e8a82',accent:'#d8d3c8'};
  const moon = new THREE.Mesh(new THREE.SphereGeometry(.32, 20, 14), new THREE.MeshStandardMaterial({ map:makePlanetTexture(moonData), color:0xbab6ad, roughness:1, emissive:0x111216, emissiveIntensity:.14 }));
  moon.position.x = 2.4; pivot.add(moon);
  earth.userData.moonPivot = pivot;
}

function createEarthAtmosphere(earth) {
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.325,mobile?28:48,mobile?18:32),new THREE.MeshStandardMaterial({map:makeEarthCloudTexture(),transparent:true,opacity:.5,depthWrite:false,roughness:1}));
  earth.add(clouds);earth.userData.clouds=clouds;
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.39,mobile?28:48,mobile?18:32),new THREE.MeshBasicMaterial({color:0x58baff,transparent:true,opacity:.13,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  earth.add(atmosphere);
}

function createSaturnRings(saturn) {
  const ringGroup=new THREE.Group();
  const layers=[
    [3.75,4.18,0xd7c38d,.42],[4.22,4.72,0xf0ddb0,.72],[4.78,5.18,0x9d8562,.46],
    [5.34,5.86,0xead7a7,.68],[5.9,6.28,0xb6a078,.38]
  ];
  layers.forEach(([inner,outer,color,opacity])=>{
    const ring=new THREE.Mesh(new THREE.RingGeometry(inner,outer,mobile?72:128),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false}));
    ring.rotation.x=Math.PI/2;ringGroup.add(ring);
  });
  ringGroup.rotation.z=-.14;saturn.add(ringGroup);
}

function createAsteroidBelt() {
  const count = mobile ? 380 : 720;
  const geometry = new THREE.IcosahedronGeometry(.09, 0);
  const material = new THREE.MeshStandardMaterial({ color:0x8b8178, roughness:1 });
  const belt = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 35.5 + Math.random() * 4.3;
    dummy.position.set(Math.cos(angle)*radius,(Math.random()-.5)*1.2,Math.sin(angle)*radius);
    const scale = .45 + Math.random() * 1.9; dummy.scale.setScalar(scale);
    dummy.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); dummy.updateMatrix(); belt.setMatrixAt(i,dummy.matrix);
  }
  belt.instanceMatrix.needsUpdate = true; scene.add(belt); return belt;
}

addStars();
createSun();
bodyData.forEach(createPlanet);
const asteroidBelt = createAsteroidBelt();

const ui = {
  panel:document.querySelector('#info-panel'), type:document.querySelector('#info-type'), name:document.querySelector('#info-name'), en:document.querySelector('#info-en'),
  distance:document.querySelector('#info-distance'), orbit:document.querySelector('#info-orbit'), rotation:document.querySelector('#info-rotation'), moons:document.querySelector('#info-moons'), description:document.querySelector('#info-description')
};

function worldPosition(object) { return object.getWorldPosition(new THREE.Vector3()); }

function showInfo(data) {
  ui.type.textContent=data.type; ui.name.textContent=data.cn; ui.en.textContent=data.en; ui.distance.textContent=data.distance;
  ui.orbit.textContent=data.orbit; ui.rotation.textContent=data.rotation; ui.moons.textContent=data.moons; ui.description.textContent=data.description;
  ui.panel.classList.add('visible');
  document.querySelectorAll('[data-body]').forEach(button => button.classList.toggle('active', button.dataset.body === data.id));
}

function focusBody(id) {
  const object = bodies.get(id); if (!object) return;
  selected = object; const target = worldPosition(object); lastSelectedPosition.copy(target);
  const radius = id === 'sun' ? 6 : object.userData.body.radius;
  const direction = camera.position.clone().sub(controls.target).normalize();
  const destination = target.clone().add(direction.multiplyScalar(Math.max(radius * 5.1, 6.5))).add(new THREE.Vector3(0, radius * 1.2, 0));
  cameraFlight = { start:performance.now(), duration:1150, fromPos:camera.position.clone(), toPos:destination, fromTarget:controls.target.clone(), toTarget:target };
  controls.enabled = false; showInfo(object.userData.body); document.querySelector('#hint').classList.add('hidden');
}

function overview() {
  selected = null; document.querySelectorAll('[data-body]').forEach(b => b.classList.remove('active'));
  ui.panel.classList.remove('visible');
  cameraFlight = { start:performance.now(), duration:1250, fromPos:camera.position.clone(), toPos:new THREE.Vector3(0,72,116), fromTarget:controls.target.clone(), toTarget:new THREE.Vector3() };
  controls.enabled = false;
}

function updateFlight(now) {
  if (!cameraFlight) return;
  const t = Math.min((now-cameraFlight.start)/cameraFlight.duration,1);
  const eased = t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
  camera.position.lerpVectors(cameraFlight.fromPos,cameraFlight.toPos,eased);
  controls.target.lerpVectors(cameraFlight.fromTarget,cameraFlight.toTarget,eased);
  if (t === 1) { cameraFlight=null; controls.enabled=true; if(selected) lastSelectedPosition.copy(worldPosition(selected)); }
}

renderer.domElement.addEventListener('pointerdown', event => { pointerDown={x:event.clientX,y:event.clientY}; });
renderer.domElement.addEventListener('pointerup', event => {
  if (!pointerDown || Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>7) return;
  pointer.x=(event.clientX/innerWidth)*2-1; pointer.y=-(event.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(bodyMeshes,false)[0]; if(hit) focusBody(hit.object.userData.body.id);
});
document.querySelectorAll('[data-body]').forEach(button => button.addEventListener('click',()=>focusBody(button.dataset.body)));
document.querySelector('#overview').addEventListener('click',overview);
document.querySelector('#close-info').addEventListener('click',overview);
document.querySelector('#play-toggle').addEventListener('click',event=>{
  running=!running; event.currentTarget.textContent=running?'Ⅱ':'▶'; event.currentTarget.setAttribute('aria-label',running?'暂停动画':'播放动画');
});
document.querySelectorAll('[data-speed]').forEach(button=>button.addEventListener('click',()=>{
  timeScale=Number(button.dataset.speed); document.querySelectorAll('[data-speed]').forEach(item=>item.classList.toggle('active',item===button));
}));
addEventListener('keydown',event=>{ if(event.key==='Escape') overview(); if(event.code==='Space'&&event.target===document.body){event.preventDefault();document.querySelector('#play-toggle').click();} });

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2)); renderer.setSize(innerWidth,innerHeight);
});

let animationId;
function animate(now=performance.now()) {
  animationId=requestAnimationFrame(animate);
  const delta=Math.min(clock.getDelta(),.05);
  if (running) {
    const simulatedDays=delta*8*timeScale;
    orbiters.forEach(({pivot,mesh,data})=>{
      pivot.rotation.y += Math.PI*2*simulatedDays/data.period;
      mesh.rotation.y += delta*timeScale*Math.sign(data.spin)*Math.min(1.3,1/Math.sqrt(Math.abs(data.spin)))*.45;
      if(mesh.userData.moonPivot) mesh.userData.moonPivot.rotation.y += Math.PI*2*simulatedDays/27.3;
      if(mesh.userData.clouds) mesh.userData.clouds.rotation.y += delta*.045*timeScale;
    });
    asteroidBelt.rotation.y += delta*.012*timeScale;
    const sun=bodies.get('sun');
    sun.rotation.y += delta*.035*timeScale;
    sun.userData.surfaceTexture.offset.x=(sun.userData.surfaceTexture.offset.x+delta*.004*timeScale)%1;
  }
  if(selected&&!cameraFlight){
    const current=worldPosition(selected); const shift=current.clone().sub(lastSelectedPosition);
    camera.position.add(shift); controls.target.copy(current); lastSelectedPosition.copy(current);
  }
  updateFlight(now); controls.update(); renderer.render(scene,camera);
}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(animationId)}else{clock.getDelta();animate()}
});

animate();
const loading=document.querySelector('#loading');
requestAnimationFrame(()=>requestAnimationFrame(()=>loading.classList.add('hidden')));
setTimeout(()=>loading.remove(),900);
setTimeout(()=>document.querySelector('#hint').classList.add('hidden'),6000);
