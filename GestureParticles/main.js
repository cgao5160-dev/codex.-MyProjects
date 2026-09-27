import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';

const container = document.querySelector('#scene');
const PARTICLE_COUNT = 5000;
const video = document.querySelector('#camera');
const overlay = document.querySelector('#hand-overlay');
const overlayContext = overlay.getContext('2d');
const trackingStatus = document.querySelector('#tracking-status');
const gestureStatus = document.querySelector('#gesture-status');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02030a, 0.055);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 11;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
container.appendChild(renderer.domElement);

// 以球坐标均匀分布粒子；保留原始位置，以便每一帧生成流动和呼吸。
const positions = new Float32Array(PARTICLE_COUNT * 3);
const basePositions = new Float32Array(PARTICLE_COUNT * 3);
const scissorsPositions = new Float32Array(PARTICLE_COUNT * 3);
const phases = new Float32Array(PARTICLE_COUNT);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const color = new THREE.Color();

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const i3 = i * 3;
  const theta = Math.acos(1 - 2 * Math.random());
  const phi = Math.random() * Math.PI * 2;
  // 立方根使球体内部也有自然、均匀的密度。
  const radius = 3.25 * Math.cbrt(Math.random());
  const sinTheta = Math.sin(theta);
  const x = radius * sinTheta * Math.cos(phi);
  const y = radius * Math.cos(theta);
  const z = radius * sinTheta * Math.sin(phi);

  basePositions.set([x, y, z], i3);
  positions.set([x, y, z], i3);
  const ringIndex = i % 2;
  const ringAngle = (i / 2) / (PARTICLE_COUNT / 2) * Math.PI * 2;
  const ringRadius = 1.18 + Math.cos(ringAngle * 5) * 0.32;
  scissorsPositions[i3] = (ringIndex ? 1.35 : -1.35) + Math.cos(ringAngle) * ringRadius;
  scissorsPositions[i3 + 1] = Math.sin(ringAngle) * ringRadius;
  scissorsPositions[i3 + 2] = Math.sin(ringAngle * 2) * 0.22 + z * 0.08;
  phases[i] = Math.random() * Math.PI * 2;

  color.setHSL(0.52 + Math.random() * 0.08, 0.8, 0.58 + Math.random() * 0.22);
  colors.set([color.r, color.g, color.b], i3);
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.055,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});

const particleRig = new THREE.Group();
const particles = new THREE.Points(geometry, material);
particleRig.add(particles);
scene.add(particleRig);

// 手势只更新这些目标值，真正的数值在动画循环中平滑靠近目标，避免粒子跳动。
let targetSpread = 1;
let targetParticleSize = 1;
let targetHorizontalPosition = 0;
let lastHandSeenAt = -Infinity;

const mouse = new THREE.Vector2();
const targetRotation = new THREE.Vector2();
window.addEventListener('pointermove', (event) => {
  mouse.x = event.clientX / window.innerWidth * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight * 2 - 1);
  targetRotation.set(mouse.y * 0.32, mouse.x * 0.48);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const clock = new THREE.Clock();
function animateBase() {
  const elapsed = clock.getElapsedTime();
  const position = geometry.attributes.position.array;
  const breathe = 1 + Math.sin(elapsed * 1.35) * 0.035;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const phase = phases[i];
    // 为每一粒子加入很小的波动，避免球体像静止的点阵。
    const ripple = Math.sin(elapsed * 1.8 + phase) * 0.026;
    position[i3] = basePositions[i3] * (breathe + ripple);
    position[i3 + 1] = basePositions[i3 + 1] * (breathe + ripple) + Math.sin(elapsed * 1.35 + phase) * 0.018;
    position[i3 + 2] = basePositions[i3 + 2] * (breathe + ripple);
  }
  geometry.attributes.position.needsUpdate = true;

  particles.rotation.y += 0.0018;
  particles.rotation.z = Math.sin(elapsed * 0.35) * 0.08;
  // 手在画面中时优先响应手势；没有手时保留原有的鼠标旋转体验。
  if (performance.now() - lastHandSeenAt > 250) {
    particles.rotation.x += (targetRotation.x - particles.rotation.x) * 0.025;
    particles.rotation.y += (targetRotation.y - particles.rotation.y) * 0.018;
  }

  const spreadSmoothing = 0.055;
  particles.scale.x += (targetSpread - particles.scale.x) * spreadSmoothing;
  particles.scale.y += (targetSpread - particles.scale.y) * spreadSmoothing;
  particles.scale.z += (targetSpread - particles.scale.z) * spreadSmoothing;
  particleRig.scale.x += (targetParticleSize - particleRig.scale.x) * 0.07;
  particleRig.scale.y += (targetParticleSize - particleRig.scale.y) * 0.07;
  particleRig.scale.z += (targetParticleSize - particleRig.scale.z) * 0.07;
  particleRig.position.x += (targetHorizontalPosition - particleRig.position.x) * 0.065;

  renderer.render(scene, camera);
}

// MediaPipe Hand Landmarker 的 21 个手部关键点连线定义。
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

function setTrackingStatus(message, state = '') {
  trackingStatus.textContent = message;
  trackingStatus.className = `tracking-status ${state}`;
}

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const FINGER_INDICES = [
  [4, 3, 2], // 拇指：指尖、关节、掌指关节
  [8, 6, 5], [12, 10, 9], [16, 14, 13], [20, 18, 17],
];
let candidateGesture = '普通状态';
let candidateFrames = 0;
let stableGesture = '普通状态';

function getGestureCandidate(landmarks) {
  const wrist = landmarks[0];
  const extendedFingers = FINGER_INDICES.reduce((count, [tip, joint]) => {
    // 使用相对于手腕的长度，不依赖手必须竖直朝上。
    return count + (distance2D(landmarks[tip], wrist) > distance2D(landmarks[joint], wrist) * 1.16 ? 1 : 0);
  }, 0);
  const pinchDistance = distance2D(landmarks[4], landmarks[8]);

  // 先识别拳头，避免握拳时拇指和食指恰好靠近而被误判为捏合。
  if (extendedFingers <= 1) return { gesture: '握拳', pinchDistance };
  if (pinchDistance < 0.18) return { gesture: '捏合', pinchDistance };
  if (extendedFingers >= 4) return { gesture: '张开手掌', pinchDistance };
  return { gesture: '普通状态', pinchDistance };
}

function updateBaseGestureControl(landmarks) {
  const { gesture, pinchDistance } = getGestureCandidate(landmarks);
  if (gesture === candidateGesture) candidateFrames += 1;
  else {
    candidateGesture = gesture;
    candidateFrames = 1;
  }

  // 连续 5 帧相同结果后才切换，显著减轻识别边缘时的闪烁。
  if (candidateFrames >= 5) stableGesture = candidateGesture;
  gestureStatus.textContent = `手势：${stableGesture}`;

  const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
  // 摄像头画面被镜像，使用 0.5 - x 才能让粒子跟随预览中的左右移动方向。
  targetHorizontalPosition = THREE.MathUtils.clamp((0.5 - palmCenterX) * 5.2, -2.35, 2.35);

  if (stableGesture === '张开手掌') {
    targetSpread = 2.05;
    targetParticleSize = 1;
  } else if (stableGesture === '握拳') {
    targetSpread = 1;
    targetParticleSize = 1;
  } else if (stableGesture === '捏合') {
    targetSpread = 1;
    // 仅在捏合模式中以两指距离控制尺寸，限定范围防止球体消失或撑满画面。
    targetParticleSize = THREE.MathUtils.mapLinear(pinchDistance, 0.035, 0.18, 0.68, 1.48);
    targetParticleSize = THREE.MathUtils.clamp(targetParticleSize, 0.68, 1.48);
  } else {
    targetSpread = 1;
    targetParticleSize = 1;
  }
}

function resetGestureControl() {
  candidateFrames = 0;
  stableGesture = '普通状态';
  gestureStatus.textContent = '手势：普通状态';
  targetSpread = 1;
  targetParticleSize = 1;
  targetHorizontalPosition = 0;
}

function drawHand(landmarks) {
  overlayContext.clearRect(0, 0, overlay.width, overlay.height);
  if (!landmarks) return;

  overlayContext.lineWidth = Math.max(1.5, overlay.width / 210);
  overlayContext.strokeStyle = '#65eaff';
  overlayContext.fillStyle = '#e5ffff';
  overlayContext.shadowColor = '#27cfff';
  overlayContext.shadowBlur = 8;

  for (const [start, end] of HAND_CONNECTIONS) {
    overlayContext.beginPath();
    overlayContext.moveTo(landmarks[start].x * overlay.width, landmarks[start].y * overlay.height);
    overlayContext.lineTo(landmarks[end].x * overlay.width, landmarks[end].y * overlay.height);
    overlayContext.stroke();
  }

  for (const point of landmarks) {
    overlayContext.beginPath();
    overlayContext.arc(point.x * overlay.width, point.y * overlay.height, Math.max(2, overlay.width / 115), 0, Math.PI * 2);
    overlayContext.fill();
  }
  overlayContext.shadowBlur = 0;
}

async function startHandTracking() {
  try {
    setTrackingStatus('正在启动摄像头');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    setTrackingStatus('正在加载手部识别模型');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
    );
    const handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });

    setTrackingStatus('正在寻找手部');
    let lastVideoTime = -1;
    let lastDetectionTime = 0;
    const detectHands = (now) => {
      // 最多每秒检测 30 次；Three.js 动画仍由独立的渲染循环驱动。
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && video.currentTime !== lastVideoTime
        && now - lastDetectionTime >= 33) {
        lastVideoTime = video.currentTime;
        lastDetectionTime = now;
        const result = handLandmarker.detectForVideo(video, now);
        const landmarks = result.landmarks[0];
        drawHand(landmarks);
        setTrackingStatus(landmarks ? '已识别到手部' : '正在寻找手部', landmarks ? 'is-detected' : '');
        if (landmarks) {
          lastHandSeenAt = performance.now();
          updateGestureControl(landmarks);
        } else {
          resetGestureControl();
        }
      }
      requestAnimationFrame(detectHands);
    };
    requestAnimationFrame(detectHands);
  } catch (error) {
    console.error('摄像头或手部识别启动失败：', error);
    setTrackingStatus('无法启动摄像头，请检查权限', 'is-error');
  }
}

startHandTracking();

// 第四阶段：扩展手势状态机与效果。
let advancedShape = 0, advancedVortex = 0, advancedSpin = 0, advancedBurst = 0;
let advancedShapeTarget = 0, advancedVortexTarget = 0, advancedSpinTarget = 0;
let advancedBurstStart = -Infinity, advancedThumbsUp = -Infinity;
let advancedFinger = new THREE.Vector2(), advancedFingerTarget = new THREE.Vector2();
let advancedPalmX = null, advancedPalmAt = 0, advancedSwipeAt = -Infinity;
let advancedStable = '普通状态', advancedCandidate = '普通状态', advancedFrames = 0;

function getAdvancedGestureCandidate(landmarks) {
  const wrist = landmarks[0];
  const states = FINGER_INDICES.map(([tip, joint]) => distance2D(landmarks[tip], wrist) > distance2D(landmarks[joint], wrist) * 1.16);
  const [thumb, index, middle, ring, pinky] = states;
  const pinchDistance = distance2D(landmarks[4], landmarks[8]);
  let gesture = '普通状态';
  if (thumb && !index && !middle && !ring && !pinky) gesture = '点赞手势';
  else if (index && middle && !ring && !pinky) gesture = '剪刀手';
  else if (index && !thumb && !middle && !ring && !pinky) gesture = '单独伸出食指';
  else if (index && middle && ring && !pinky) gesture = '三指手势';
  else if (!thumb && !index && !middle && !ring && !pinky) gesture = '握拳';
  else if (pinchDistance < 0.18) gesture = '捏合';
  else if (states.filter(Boolean).length >= 4) gesture = '张开手掌';
  return { gesture, pinchDistance };
}

function updateGestureControl(landmarks) {
  const { gesture, pinchDistance } = getAdvancedGestureCandidate(landmarks);
  advancedFrames = gesture === advancedCandidate ? advancedFrames + 1 : 1;
  advancedCandidate = gesture;
  if (advancedFrames >= 5 && advancedStable !== gesture) {
    advancedStable = gesture;
    if (gesture === '点赞手势' && performance.now() - advancedThumbsUp > 2200) {
      advancedThumbsUp = performance.now(); advancedBurstStart = advancedThumbsUp;
    }
  }
  gestureStatus.textContent = `手势：${advancedStable}`;
  const palmX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
  targetHorizontalPosition = THREE.MathUtils.clamp((0.5 - palmX) * 5.2, -2.35, 2.35);
  const now = performance.now();
  if (advancedPalmX !== null) {
    const velocity = (palmX - advancedPalmX) / Math.max((now - advancedPalmAt) / 1000, 0.02);
    if (Math.abs(velocity) > 1.1 && now - advancedSwipeAt > 180) { advancedSpin += THREE.MathUtils.clamp(-velocity * 0.009, -0.045, 0.045); advancedSwipeAt = now; }
  }
  advancedPalmX = palmX; advancedPalmAt = now;
  advancedShapeTarget = advancedStable === '剪刀手' ? 1 : 0;
  advancedVortexTarget = advancedStable === '单独伸出食指' ? 1 : 0;
  advancedSpinTarget = advancedStable === '三指手势' ? 0.016 : 0.0018;
  if (advancedStable === '张开手掌') { targetSpread = 2.05; targetParticleSize = 1; }
  else if (advancedStable === '捏合') { targetSpread = 1; targetParticleSize = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(pinchDistance, .035, .18, .68, 1.48), .68, 1.48); }
  else { targetSpread = 1; targetParticleSize = 1; }
  advancedFingerTarget.set((.5 - landmarks[8].x) * 4 - particleRig.position.x, (.5 - landmarks[8].y) * 3.4);
}

function animate() {
  const elapsed = clock.getElapsedTime(), now = performance.now(), position = geometry.attributes.position.array;
  advancedShape += (advancedShapeTarget - advancedShape) * .06; advancedVortex += (advancedVortexTarget - advancedVortex) * .09;
  advancedFinger.lerp(advancedFingerTarget, .13); advancedSpin += (advancedSpinTarget - advancedSpin) * .06; advancedSpin *= .97;
  const burstTarget = now - advancedBurstStart < 180 ? 1 : 0; advancedBurst += (burstTarget - advancedBurst) * (burstTarget ? .18 : .045);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const j = i * 3, phase = phases[i], s = 1 + Math.sin(elapsed * 1.35) * .035 + Math.sin(elapsed * 1.8 + phase) * .026;
    const a = (i / 2) / (PARTICLE_COUNT / 2) * Math.PI * 2, r = 1.18 + Math.cos(a * 5) * .32;
    const sx = (i % 2 ? 1.35 : -1.35) + Math.cos(a) * r, sy = Math.sin(a) * r, sz = Math.sin(a * 2) * .22 + basePositions[j + 2] * .08;
    let x = THREE.MathUtils.lerp(basePositions[j], sx, advancedShape) * s, y = THREE.MathUtils.lerp(basePositions[j + 1], sy, advancedShape) * s, z = THREE.MathUtils.lerp(basePositions[j + 2], sz, advancedShape) * s;
    const dx = x - advancedFinger.x, dy = y - advancedFinger.y, d = Math.hypot(dx, dy);
    if (advancedVortex > .01 && d < 1.7) { const q = (1-d/1.7)*advancedVortex, c=Math.cos(q*1.5), si=Math.sin(q*1.5); x=advancedFinger.x+dx*c-dy*si; y=advancedFinger.y+dx*si+dy*c; z += q*Math.sin(elapsed*5+phase)*.35; }
    const b = 1 + advancedBurst * (1.15 + (i%7)*.035); position[j]=x*b; position[j+1]=y*b; position[j+2]=z*b;
  }
  geometry.attributes.position.needsUpdate = true;
  particles.rotation.y += advancedSpin; particles.rotation.z = Math.sin(elapsed*.35)*.08;
  if (performance.now()-lastHandSeenAt > 250) { particles.rotation.x += (targetRotation.x-particles.rotation.x)*.025; particles.rotation.y += (targetRotation.y-particles.rotation.y)*.018; }
  particles.scale.lerp(new THREE.Vector3(targetSpread,targetSpread,targetSpread),.055); particleRig.scale.lerp(new THREE.Vector3(targetParticleSize,targetParticleSize,targetParticleSize),.07); particleRig.position.x += (targetHorizontalPosition-particleRig.position.x)*.065;
  renderer.render(scene,camera);
}




