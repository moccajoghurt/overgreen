/**
 * Plant Workshop — renders a single plant subtype from multiple camera angles.
 *
 * Query params:
 *   ?subtype=6        subtype index (default 6 = Oak)
 *   ?angles=3         number of camera angles (default 4)
 *   ?compare=1        show high-mesh (top) and low-mesh (bottom) side by side
 *
 * Signals readiness by setting window.__workshopReady = true
 */
import * as THREE from 'three';
import { BUILDERS, BUILDERS_LOW, scaleToTarget, TARGET_MODEL_HEIGHTS } from './renderer3d/plant-models';

// ── Config from query params ──
const params = new URLSearchParams(location.search);
const subtypeIdx = parseInt(params.get('subtype') ?? '6', 10);
const angleCount = parseInt(params.get('angles') ?? '4', 10);
const compareMode = params.get('compare') === '1';

// ── Layout ──
const CELL = 400;                       // px per view
const COLS = angleCount;
const ROWS = compareMode ? 2 : 1;
const W = COLS * CELL;
const H = ROWS * CELL;

// ── Subtype names for label ──
const NAMES: Record<number, string> = {
  0: 'Turfgrass', 1: 'Tallgrass', 2: 'Bunchgrass', 3: 'Bamboo',
  4: 'Spreading', 5: 'Sedge', 6: 'Oak', 7: 'Magnolia', 8: 'Conifer',
  9: 'Tropical', 10: 'Palm', 11: 'Birch', 12: 'Evergreen Shrub',
  13: 'Deciduous Shrub', 14: 'Mediterranean', 15: 'Thorny', 16: 'Desert Shrub',
  17: 'Mangrove', 18: 'Stem Succulent', 19: 'Leaf Succulent', 20: 'Caudiciform',
  21: 'Euphorbia', 22: 'Ice Plant', 23: 'Epiphytic',
};

// ── Renderer ──
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = W * devicePixelRatio;
canvas.height = H * devicePixelRatio;
canvas.style.width = W + 'px';
canvas.style.height = H + 'px';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(W, H);
renderer.setScissorTest(true);
renderer.setClearColor(0x2a2a2a);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// ── Build the plant ──
const GROUND_COVER = new Set([0, 1, 2, 3, 4, 5]);

function scalePlant(plantGroup: THREE.Group): void {
  if (GROUND_COVER.has(subtypeIdx)) {
    plantGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(plantGroup);
    const rawH = Math.max(0.01, box.max.y);
    const yScale = TARGET_MODEL_HEIGHTS[subtypeIdx] / rawH;
    const rawXZ = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const xzScale = 1.0 / Math.max(0.01, rawXZ);
    plantGroup.scale.set(xzScale, yScale, xzScale);
  } else {
    scaleToTarget(plantGroup, subtypeIdx);
  }
}

function makeScene(builders: (() => THREE.Group)[]): { scene: THREE.Scene; centerY: number; camDist: number } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0ede8);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dir = new THREE.DirectionalLight(0xfff5e0, 1.0);
  dir.position.set(3, 5, 2);
  scene.add(dir);
  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x8a7a6a, 0.3));

  // Ground disc
  const groundGeo = new THREE.BoxGeometry(1, 0.05, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.025;
  scene.add(ground);

  const plantGroup = builders[subtypeIdx]();
  scalePlant(plantGroup);
  scene.add(plantGroup);

  plantGroup.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(plantGroup);
  const plantH = bbox.max.y - bbox.min.y;
  const centerY = (bbox.max.y + bbox.min.y) / 2;
  const plantW = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z);
  const frameDim = Math.max(plantH, plantW) || 0.5;
  const camDist = Math.max(frameDim * 2.2, 0.8);

  return { scene, centerY, camDist };
}

// Build scene(s)
const hiScene = makeScene(BUILDERS);
const loScene = compareMode ? makeScene(BUILDERS_LOW) : null;

// Use the high-mesh framing for both so they're at the same scale
const { centerY, camDist } = hiScene;

// ── Camera angles ──
const cameras: THREE.PerspectiveCamera[] = [];
for (let i = 0; i < angleCount; i++) {
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  const angle = (i / angleCount) * Math.PI * 2;
  const elevAngle = 0.35;
  cam.position.set(
    Math.sin(angle) * camDist * Math.cos(elevAngle),
    centerY + camDist * Math.sin(elevAngle),
    Math.cos(angle) * camDist * Math.cos(elevAngle),
  );
  cam.lookAt(0, centerY, 0);
  cameras.push(cam);
}

// ── Render all views ──
// Top row: high-mesh
for (let i = 0; i < cameras.length; i++) {
  const vx = i * CELL;
  const vy = compareMode ? CELL : 0; // WebGL y=0 is bottom, so top row = H - CELL
  renderer.setViewport(vx, vy, CELL, CELL);
  renderer.setScissor(vx, vy, CELL, CELL);
  renderer.render(hiScene.scene, cameras[i]);
}

// Bottom row: low-mesh (compare mode only)
if (compareMode && loScene) {
  for (let i = 0; i < cameras.length; i++) {
    const vx = i * CELL;
    renderer.setViewport(vx, 0, CELL, CELL);
    renderer.setScissor(vx, 0, CELL, CELL);
    renderer.render(loScene.scene, cameras[i]);
  }
}

// ── Draw labels on a 2D overlay ──
const overlay = document.createElement('canvas');
overlay.width = W * devicePixelRatio;
overlay.height = H * devicePixelRatio;
overlay.style.cssText = `position:absolute;top:0;left:0;width:${W}px;height:${H}px;pointer-events:none`;
document.body.appendChild(overlay);

const ctx = overlay.getContext('2d')!;
ctx.scale(devicePixelRatio, devicePixelRatio);

const label = `#${subtypeIdx} ${NAMES[subtypeIdx] ?? 'Unknown'}`;
ctx.font = 'bold 16px monospace';
ctx.fillStyle = '#fff';
ctx.fillText(label, 10, 24);

if (compareMode) {
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#8f8';
  ctx.fillText('HIGH MESH', 10, 44);
  ctx.fillStyle = '#f88';
  ctx.fillText('LOW MESH', 10, CELL + 20);
}

const angleLabels = ['Front', 'Side R', 'Back', 'Side L', '45°', '135°', '225°', '315°'];
for (let i = 0; i < angleCount; i++) {
  ctx.font = '12px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(angleLabels[i] ?? `${Math.round((i / angleCount) * 360)}°`, i * CELL + 10, H - 10);
}

// Signal ready for puppeteer
(window as any).__workshopReady = true;
console.log(`[workshop] Rendered subtype ${subtypeIdx} (${NAMES[subtypeIdx]}) from ${angleCount} angles${compareMode ? ' [COMPARE]' : ''}`);
