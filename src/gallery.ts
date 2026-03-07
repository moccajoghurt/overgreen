import * as THREE from 'three';
import {
  BUILDERS,
  mat,
  scaleToTarget,
} from './renderer3d/plant-models';

// ============================================================
// LAYOUT
// ============================================================
const COLS = 6, ROWS = 4;
const CELL_W = 300, CELL_3D = 280, LABEL_H = 70, HEADER_H = 50;
const TITLE_H = 80, PAD = 20;
const W = PAD * 2 + COLS * CELL_W;
const ROW_H = HEADER_H + CELL_3D + LABEL_H;
const H = TITLE_H + ROWS * ROW_H + PAD;

// ============================================================
// PLANT DATA
// ============================================================
interface PlantEntry { id: string; name: string; species: string }
interface ArchetypeRow { name: string; color: string; plants: PlantEntry[] }

const ARCHETYPES: ArchetypeRow[] = [
  { name: 'GRASSES', color: '#4c8738', plants: [
    { id: '1.1', name: 'Turfgrass', species: 'Poa pratensis' },
    { id: '1.2', name: 'Tallgrass', species: 'Andropogon gerardii' },
    { id: '1.3', name: 'Bunch grass', species: 'Festuca idahoensis' },
    { id: '1.4', name: 'Bamboo', species: 'Phyllostachys edulis' },
    { id: '1.5', name: 'Spreading grass', species: 'Cynodon dactylon' },
    { id: '1.6', name: 'Sedge/Rush', species: 'Cyperus papyrus' },
  ]},
  { name: 'TREES', color: '#654321', plants: [
    { id: '2.1', name: 'Broadleaf deciduous', species: 'Quercus robur' },
    { id: '2.2', name: 'Broadleaf evergreen', species: 'Magnolia grandiflora' },
    { id: '2.3', name: 'Conifer', species: 'Pinus sylvestris' },
    { id: '2.4', name: 'Tropical hardwood', species: 'Swietenia mahagoni' },
    { id: '2.5', name: 'Palm', species: 'Cocos nucifera' },
    { id: '2.6', name: 'Pioneer/fast-growth', species: 'Betula pendula' },
  ]},
  { name: 'SHRUBS', color: '#8c783c', plants: [
    { id: '3.1', name: 'Evergreen shrub', species: 'Buxus sempervirens' },
    { id: '3.2', name: 'Deciduous shrub', species: 'Sambucus nigra' },
    { id: '3.3', name: 'Mediterranean', species: 'Rosmarinus officinalis' },
    { id: '3.4', name: 'Thorny/Armed', species: 'Ulex europaeus' },
    { id: '3.5', name: 'Desert shrub', species: 'Larrea tridentata' },
    { id: '3.6', name: 'Mangrove', species: 'Rhizophora mangle' },
  ]},
  { name: 'SUCCULENTS', color: '#558c64', plants: [
    { id: '4.1', name: 'Stem succulent', species: 'Carnegiea gigantea' },
    { id: '4.2', name: 'Leaf succulent', species: 'Aloe vera' },
    { id: '4.3', name: 'Caudiciform', species: 'Adenium obesum' },
    { id: '4.4', name: 'Euphorbia', species: 'Euphorbia ingens' },
    { id: '4.5', name: 'Ice plant/Mesemb', species: 'Lithops' },
    { id: '4.6', name: 'Epiphytic succulent', species: 'Schlumbergera' },
  ]},
];

// ============================================================
// GALLERY-ONLY HELPERS
// ============================================================
function addGround(group: THREE.Group, radius = 1.5): void {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.05, 16);
  const m = new THREE.Mesh(geo, mat(0xc4a882, { roughness: 1 }));
  m.position.y = -0.025;
  group.add(m);
}

function addWaterDisc(group: THREE.Group): void {
  const geo = new THREE.CylinderGeometry(GROUND_R, GROUND_R, 0.04, 16);
  const m = new THREE.Mesh(geo, mat(0x4a7a8a, { roughness: 0.3, transparent: true, opacity: 0.7 }));
  m.position.y = -0.02;
  group.add(m);
}

// ============================================================
// REAL-WORLD HEIGHTS (for display labels + ruler)
// ============================================================
const REAL_HEIGHTS_M: number[] = [
  // Grasses (0-5)
  0.10, 2.0, 0.50, 8.0, 0.08, 2.5,
  // Trees (6-11)
  15.0, 12.0, 20.0, 20.0, 18.0, 15.0,
  // Shrubs (12-17)
  1.5, 3.0, 1.0, 2.0, 2.0, 5.0,
  // Succulents (18-23)
  12.0, 0.5, 2.0, 6.0, 0.15, 0.3,
];

function formatHeight(m: number): string {
  if (m >= 1) return m + 'm';
  return Math.round(m * 100) + 'cm';
}

/** Fixed scale: 1 real meter = 1/3 game unit (ground disc = 1 unit = 3m). */
const M_TO_UNITS = 1 / 3;

/** Add a fixed-scale reference ruler showing real-world meters. */
function addRuler(scene: THREE.Scene, realH: number): void {
  const rulerMat = new THREE.MeshBasicMaterial({ color: 0xaa6633 });
  const rx = -1.5, rz = 1.5;
  const rulerH = realH * M_TO_UNITS;

  // Vertical bar
  const barGeo = new THREE.BoxGeometry(0.02, rulerH, 0.02);
  const bar = new THREE.Mesh(barGeo, rulerMat);
  bar.position.set(rx, rulerH / 2, rz);
  scene.add(bar);

  // Bottom and top caps
  for (const y of [0, rulerH]) {
    const capGeo = new THREE.BoxGeometry(0.15, 0.015, 0.02);
    const cap = new THREE.Mesh(capGeo, rulerMat);
    cap.position.set(rx, y, rz);
    scene.add(cap);
  }

  // Tick marks at regular meter intervals
  let tickInterval: number;
  if (realH >= 10) tickInterval = 5;
  else if (realH >= 2) tickInterval = 1;
  else if (realH >= 0.5) tickInterval = 0.25;
  else if (realH >= 0.1) tickInterval = 0.05;
  else tickInterval = 0.02;

  for (let m = tickInterval; m < realH - tickInterval * 0.1; m += tickInterval) {
    const y = m * M_TO_UNITS;
    const tickGeo = new THREE.BoxGeometry(0.08, 0.01, 0.02);
    const tick = new THREE.Mesh(tickGeo, rulerMat);
    tick.position.set(rx, y, rz);
    scene.add(tick);
  }
}

// ============================================================
// CAMERA — uniform for all cells so relative sizes are visible
// ============================================================
const CAM_Y = 3.0;
const CAM_DIST = 14.0;
const GROUND_R = 0.5; // matches 1×1 sim cell (radius = half cell width)

// Map string IDs to BUILDERS indices
const ID_TO_INDEX: Record<string, number> = {
  '1.1': 0,  '1.2': 1,  '1.3': 2,  '1.4': 3,  '1.5': 4,  '1.6': 5,
  '2.1': 6,  '2.2': 7,  '2.3': 8,  '2.4': 9,  '2.5': 10, '2.6': 11,
  '3.1': 12, '3.2': 13, '3.3': 14, '3.4': 15, '3.5': 16, '3.6': 17,
  '4.1': 18, '4.2': 19, '4.3': 20, '4.4': 21, '4.5': 22, '4.6': 23,
};

// ============================================================
// BUILDER MAP
// ============================================================
const builders: Record<string, () => THREE.Group> = {};

for (const [id, idx] of Object.entries(ID_TO_INDEX)) {
  builders[id] = BUILDERS[idx];
}

// ============================================================
// RENDERER SETUP
// ============================================================
const canvas = document.getElementById('main') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;

canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = W + 'px';
canvas.style.height = H + 'px';
overlay.width = W * dpr;
overlay.height = H * dpr;
overlay.style.width = W + 'px';
overlay.style.height = H + 'px';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(dpr);
renderer.setSize(W, H);
renderer.setScissorTest(true);
renderer.setClearColor(0xf5f3ee);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// Build cells
interface Cell {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  vx: number;
  vyGL: number;
  plant: PlantEntry;
}

const cells: Cell[] = [];

for (let row = 0; row < ARCHETYPES.length; row++) {
  const arch = ARCHETYPES[row];
  for (let col = 0; col < arch.plants.length; col++) {
    const plant = arch.plants[col];
    const plantGroup = builders[plant.id]();

    // Scale plant to correct game-world proportions
    const idx = ID_TO_INDEX[plant.id];
    scaleToTarget(plantGroup, idx);

    // Wrapper so ground disc isn't affected by plant scale
    const group = new THREE.Group();
    group.add(plantGroup);
    if (idx === 17) {
      addWaterDisc(group); // Mangrove
    } else {
      addGround(group, GROUND_R);
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0ede8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xfff5e0, 1.0);
    dir.position.set(3, 5, 2);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x8a7a6a, 0.3));
    scene.add(group);

    // Scale ruler (added to scene, not group, so it doesn't rotate)
    addRuler(scene, REAL_HEIGHTS_M[idx]);

    // Camera (uniform for all cells)
    const cam = new THREE.PerspectiveCamera(38, CELL_W / CELL_3D, 0.1, 500);
    cam.position.set(CAM_DIST * 0.7, CAM_Y + CAM_DIST * 0.35, CAM_DIST * 0.7);
    cam.lookAt(0, CAM_Y * 0.7, 0);

    // Viewport (WebGL y=0 is bottom)
    const vx = PAD + col * CELL_W;
    const vyHtml = TITLE_H + row * ROW_H + HEADER_H;
    const vyGL = H - vyHtml - CELL_3D;

    cells.push({ scene, camera: cam, group, vx, vyGL, plant });
  }
}

// ============================================================
// 2D OVERLAY — LABELS
// ============================================================
const ctx = overlay.getContext('2d')!;
ctx.scale(dpr, dpr);

function drawLabels(): void {
  ctx.clearRect(0, 0, W, H);

  // Title
  ctx.font = 'bold 28px "Segoe UI", sans-serif';
  ctx.fillStyle = '#1e1e1e';
  ctx.textAlign = 'center';
  ctx.fillText('OVERGREEN \u2014 Plant Subtype Gallery', W / 2, TITLE_H / 2 + 10);

  for (let row = 0; row < ARCHETYPES.length; row++) {
    const arch = ARCHETYPES[row];
    const hy = TITLE_H + row * ROW_H;

    // Header bar
    ctx.fillStyle = arch.color;
    const rx = PAD, ry = hy, rw = W - PAD * 2, rh = HEADER_H - 6;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 8);
    ctx.fill();

    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText((row + 1) + '. ' + arch.name, PAD + 18, hy + rh / 2 + 7);

    for (let col = 0; col < arch.plants.length; col++) {
      const p = arch.plants[col];
      const cx = PAD + col * CELL_W + CELL_W / 2;
      const labelY = hy + HEADER_H + CELL_3D;

      // Index badge
      const bx = PAD + col * CELL_W + 8;
      const by = hy + HEADER_H + 6;
      ctx.fillStyle = arch.color;
      ctx.beginPath();
      ctx.roundRect(bx, by, 40, 24, 5);
      ctx.fill();
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(p.id, bx + 20, by + 17);

      // Name + species + real-world height
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e1e1e';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, cx, labelY + 18);
      ctx.font = 'italic 11px "Segoe UI", sans-serif';
      ctx.fillStyle = '#5a5a5a';
      ctx.fillText(p.species, cx, labelY + 34);
      const idx2 = ID_TO_INDEX[p.id];
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillStyle = '#aa6633';
      ctx.fillText(formatHeight(REAL_HEIGHTS_M[idx2]), cx, labelY + 50);
    }
  }
}
drawLabels();

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate(time: number): void {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  for (const c of cells) {
    c.group.rotation.y = t * 0.3;
    renderer.setViewport(c.vx, c.vyGL, CELL_W, CELL_3D);
    renderer.setScissor(c.vx, c.vyGL, CELL_W, CELL_3D);
    renderer.render(c.scene, c.camera);
  }
}
requestAnimationFrame(animate);

// ============================================================
// SAVE PNG
// ============================================================
document.getElementById('save-btn')!.addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = W * dpr;
  out.height = H * dpr;
  const oc = out.getContext('2d')!;
  oc.drawImage(canvas, 0, 0);
  oc.drawImage(overlay, 0, 0);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plant_gallery_3d.png';
    a.click();
    URL.revokeObjectURL(url);
  });
});
