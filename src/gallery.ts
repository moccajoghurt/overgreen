import * as THREE from 'three';
import {
  BUILDERS,
  mat,
  scaleToTarget,
  TARGET_MODEL_HEIGHTS,
} from './renderer3d/plant-models';
import { BUILDERS_STRESSED } from './renderer3d/plant-models-stressed';
import { BUILDERS_DYING } from './renderer3d/plant-models-dying';
import { createDeerGeometry } from './renderer3d/herbivores';

// ============================================================
// LAYOUT — fit to viewport width
// ============================================================
const COLS = 8, ROWS = 14;
const PAD = 10;
const W = window.innerWidth;
const CELL_W = Math.floor((W - PAD * 2) / COLS);
const CELL_3D = Math.floor(CELL_W * 0.93);
const LABEL_H = Math.floor(CELL_W * 0.23);
const HEADER_H = Math.floor(CELL_W * 0.17);
const TITLE_H = Math.floor(CELL_W * 0.27);
const ROW_H = HEADER_H + CELL_3D + LABEL_H;
const H = TITLE_H + ROWS * ROW_H + PAD;

// ============================================================
// PLANT DATA
// ============================================================
interface PlantEntry { id: string; name: string; species: string }
type HealthState = 'thriving' | 'stressed' | 'dying';
interface DisplayRow { name: string; color: string; state: HealthState; plants: PlantEntry[] }

const GRASSES: PlantEntry[] = [
  { id: '1.1', name: 'Turfgrass', species: 'Poa pratensis' },
  { id: '1.2', name: 'Tallgrass', species: 'Andropogon gerardii' },
  { id: '1.3', name: 'Bunch grass', species: 'Festuca idahoensis' },
  { id: '1.4', name: 'Bamboo', species: 'Phyllostachys edulis' },
  { id: '1.5', name: 'Spreading grass', species: 'Cynodon dactylon' },
  { id: '1.6', name: 'Sedge/Rush', species: 'Cyperus papyrus' },
  { id: '1.7', name: 'Pampas grass', species: 'Cortaderia selloana' },
  { id: '1.8', name: 'Desert grass', species: 'Stipagrostis plumosa' },
];

const TREES: PlantEntry[] = [
  { id: '2.1', name: 'Broadleaf deciduous', species: 'Quercus robur' },
  { id: '2.2', name: 'Broadleaf evergreen', species: 'Magnolia grandiflora' },
  { id: '2.3', name: 'Conifer', species: 'Pinus sylvestris' },
  { id: '2.4', name: 'Tropical hardwood', species: 'Swietenia mahagoni' },
  { id: '2.5', name: 'Palm', species: 'Cocos nucifera' },
  { id: '2.6', name: 'Pioneer/fast-growth', species: 'Betula pendula' },
  { id: '2.7', name: 'Cypress', species: 'Cupressus sempervirens' },
  { id: '2.8', name: 'Acacia/Thorn tree', species: 'Vachellia tortilis' },
];

const SHRUBS: PlantEntry[] = [
  { id: '3.1', name: 'Evergreen shrub', species: 'Buxus sempervirens' },
  { id: '3.2', name: 'Deciduous shrub', species: 'Sambucus nigra' },
  { id: '3.3', name: 'Mediterranean', species: 'Rosmarinus officinalis' },
  { id: '3.4', name: 'Thorny/Armed', species: 'Ulex europaeus' },
  { id: '3.5', name: 'Desert shrub', species: 'Larrea tridentata' },
  { id: '3.6', name: 'Mangrove', species: 'Rhizophora mangle' },
  { id: '3.7', name: 'Flowering shrub', species: 'Hibiscus rosa-sinensis' },
  { id: '3.8', name: 'Aromatic/Garrigue', species: 'Lavandula angustifolia' },
];

const SUCCULENTS: PlantEntry[] = [
  { id: '4.1', name: 'Stem succulent', species: 'Carnegiea gigantea' },
  { id: '4.2', name: 'Leaf succulent', species: 'Aloe vera' },
  { id: '4.3', name: 'Caudiciform', species: 'Adenium obesum' },
  { id: '4.4', name: 'Euphorbia', species: 'Euphorbia ingens' },
  { id: '4.5', name: 'Ice plant/Mesemb', species: 'Lithops' },
  { id: '4.6', name: 'Epiphytic succulent', species: 'Schlumbergera' },
  { id: '4.7', name: 'Barrel cactus', species: 'Ferocactus wislizeni' },
  { id: '4.8', name: 'Jade/Crassula', species: 'Crassula ovata' },
];

const FORBS: PlantEntry[] = [
  { id: '5.1', name: 'Broadleaf wildflower', species: 'Taraxacum officinale' },
  { id: '5.2', name: 'Tall herb', species: 'Solidago canadensis' },
  { id: '5.3', name: 'Fern', species: 'Dryopteris filix-mas' },
  { id: '5.4', name: 'Vine/Climber', species: 'Hedera helix' },
  { id: '5.5', name: 'Ground cover', species: 'Trifolium repens' },
  { id: '5.6', name: 'Moss', species: 'Polytrichum commune' },
  { id: '5.7', name: 'Tropical herb', species: 'Heliconia rostrata' },
  { id: '5.8', name: 'Desert annual', species: 'Eschscholzia californica' },
];

const DEER: PlantEntry[] = [
  { id: 'deer', name: 'Deer', species: 'Cervus elaphus' },
];

// Category base colors
const CAT_COLORS: Record<string, string> = {
  GRASSES: '#4c8738',
  TREES: '#654321',
  SHRUBS: '#8c783c',
  SUCCULENTS: '#558c64',
  FORBS: '#b45a8c',
  DEER: '#8a5c3a',
};

// State-specific header colors
const STATE_COLORS: Record<HealthState, (base: string) => string> = {
  thriving: (base) => base,
  stressed: () => '#b8a030',
  dying: () => '#8a5a5a',
};

function makeRows(name: string, plants: PlantEntry[]): DisplayRow[] {
  const base = CAT_COLORS[name];
  return [
    { name: `${name} — Thriving`, color: STATE_COLORS.thriving(base), state: 'thriving', plants },
    { name: `${name} — Stressed`, color: STATE_COLORS.stressed(base), state: 'stressed', plants },
    { name: `${name} — Dying`, color: STATE_COLORS.dying(base), state: 'dying', plants },
  ];
}

const DISPLAY_ROWS: DisplayRow[] = [
  { name: 'GRASSES', color: CAT_COLORS.GRASSES, state: 'thriving', plants: GRASSES },
  ...makeRows('TREES', TREES),
  ...makeRows('SHRUBS', SHRUBS),
  ...makeRows('SUCCULENTS', SUCCULENTS),
  ...makeRows('FORBS', FORBS),
  { name: 'DEER (Herbivore)', color: CAT_COLORS.DEER, state: 'thriving', plants: DEER },
];

// ============================================================
// GALLERY-ONLY HELPERS
// ============================================================
function addGround(group: THREE.Group): void {
  const geo = new THREE.BoxGeometry(1, 0.05, 1);
  const m = new THREE.Mesh(geo, mat(0xc4a882, { roughness: 1 }));
  m.position.y = -0.025;
  group.add(m);
}

function addWaterDisc(group: THREE.Group): void {
  const geo = new THREE.BoxGeometry(1, 0.04, 1);
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
  // Forbs (24-29)
  0.20, 1.0, 0.60, 0.15, 0.10, 0.05,
  // New climate-zone subtypes (30-39)
  2.0, 0.5, 20.0, 12.0, 3.0, 0.75, 1.5, 1.0, 1.0, 0.30,
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
let camDist = 14.0;

// Map string IDs to BUILDERS indices
const ID_TO_INDEX: Record<string, number> = {
  '1.1': 0,  '1.2': 1,  '1.3': 2,  '1.4': 3,  '1.5': 4,  '1.6': 5,
  '2.1': 6,  '2.2': 7,  '2.3': 8,  '2.4': 9,  '2.5': 10, '2.6': 11,
  '3.1': 12, '3.2': 13, '3.3': 14, '3.4': 15, '3.5': 16, '3.6': 17,
  '4.1': 18, '4.2': 19, '4.3': 20, '4.4': 21, '4.5': 22, '4.6': 23,
  '5.1': 24, '5.2': 25, '5.3': 26, '5.4': 27, '5.5': 28, '5.6': 29,
  '1.7': 30, '1.8': 31, '2.7': 32, '2.8': 33, '3.7': 34, '3.8': 35,
  '4.7': 36, '4.8': 37, '5.7': 38, '5.8': 39,
};

// ============================================================
// BUILDER MAP — select builders based on health state
// ============================================================
function getBuilder(id: string, state: HealthState): () => THREE.Group {
  const idx = ID_TO_INDEX[id];
  if (state === 'stressed') return BUILDERS_STRESSED[idx];
  if (state === 'dying') return BUILDERS_DYING[idx];
  return BUILDERS[idx];
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

for (let row = 0; row < DISPLAY_ROWS.length; row++) {
  const drow = DISPLAY_ROWS[row];
  for (let col = 0; col < drow.plants.length; col++) {
    const plant = drow.plants[col];
    const isDeer = plant.id === 'deer';
    let group: THREE.Group;

    if (isDeer) {
      // Deer uses its own geometry builder
      const geo = createDeerGeometry();
      const deerMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
      const mesh = new THREE.Mesh(geo, deerMat);
      const plantGroup = new THREE.Group();
      plantGroup.add(mesh);
      group = new THREE.Group();
      group.add(plantGroup);
      addGround(group);
    } else {
      const builder = getBuilder(plant.id, drow.state);
      const plantGroup = builder();

      // Scale plant to correct game-world proportions
      const idx = ID_TO_INDEX[plant.id];
      const GROUND_COVER = new Set([0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29, 30, 31, 38, 39]);
      if (GROUND_COVER.has(idx)) {
        plantGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(plantGroup);
        const rawH = Math.max(0.01, box.max.y);
        const yScale = TARGET_MODEL_HEIGHTS[idx] / rawH;
        const rawXZ = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
        const xzScale = 1.0 / Math.max(0.01, rawXZ);
        plantGroup.scale.set(xzScale, yScale, xzScale);
      } else {
        scaleToTarget(plantGroup, idx);
      }

      // Wrapper so ground disc isn't affected by plant scale
      group = new THREE.Group();
      group.add(plantGroup);
      if (idx === 17) {
        addWaterDisc(group);
      } else {
        addGround(group);
      }
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

    // Scale ruler
    if (!isDeer) {
      const idx = ID_TO_INDEX[plant.id];
      addRuler(scene, REAL_HEIGHTS_M[idx]);
    } else {
      addRuler(scene, 1.5); // ~1.5m at shoulder for red deer
    }

    // Camera
    const cam = new THREE.PerspectiveCamera(38, CELL_W / CELL_3D, 0.1, 500);
    cam.position.set(camDist * 0.7, CAM_Y + camDist * 0.35, camDist * 0.7);
    cam.lookAt(0, CAM_Y * 0.7, 0);

    // Viewport
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

const FS = CELL_W / 300;

function drawLabels(): void {
  ctx.clearRect(0, 0, W, H);

  // Title
  ctx.font = `bold ${Math.round(28 * FS)}px "Segoe UI", sans-serif`;
  ctx.fillStyle = '#1e1e1e';
  ctx.textAlign = 'center';
  ctx.fillText('OVERGREEN \u2014 Plant Subtype Gallery', W / 2, TITLE_H / 2 + 10 * FS);

  for (let row = 0; row < DISPLAY_ROWS.length; row++) {
    const drow = DISPLAY_ROWS[row];
    const hy = TITLE_H + row * ROW_H;

    // Header bar
    ctx.fillStyle = drow.color;
    const rx = PAD, rw = W - PAD * 2, rh = HEADER_H - 4;
    ctx.beginPath();
    ctx.roundRect(rx, hy, rw, rh, 6 * FS);
    ctx.fill();

    ctx.font = `bold ${Math.round(22 * FS)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText((row + 1) + '. ' + drow.name, PAD + 12 * FS, hy + rh / 2 + 7 * FS);

    for (let col = 0; col < drow.plants.length; col++) {
      const p = drow.plants[col];
      const cx = PAD + col * CELL_W + CELL_W / 2;
      const labelY = hy + HEADER_H + CELL_3D;

      // Index badge
      const bx = PAD + col * CELL_W + 6 * FS;
      const by = hy + HEADER_H + 4 * FS;
      const badgeW = 36 * FS, badgeH = 20 * FS;
      ctx.fillStyle = drow.color;
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 4 * FS);
      ctx.fill();
      ctx.font = `bold ${Math.round(13 * FS)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(p.id, bx + badgeW / 2, by + badgeH * 0.73);

      // Name + species + real-world height
      ctx.font = `bold ${Math.round(12 * FS)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#1e1e1e';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, cx, labelY + LABEL_H * 0.28);
      ctx.font = `italic ${Math.round(10 * FS)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#5a5a5a';
      ctx.fillText(p.species, cx, labelY + LABEL_H * 0.52);
      const idx2 = ID_TO_INDEX[p.id];
      ctx.font = `bold ${Math.round(10 * FS)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#aa6633';
      const realH = idx2 !== undefined ? REAL_HEIGHTS_M[idx2] : 1.5;
      ctx.fillText(formatHeight(realH), cx, labelY + LABEL_H * 0.76);
    }
  }
}
drawLabels();

// ============================================================
// ZOOM (scroll wheel)
// ============================================================
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camDist *= e.deltaY > 0 ? 1.1 : 0.9;
  camDist = Math.max(1, Math.min(50, camDist));
}, { passive: false });

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate(time: number): void {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  for (const c of cells) {
    c.group.rotation.y = t * 0.3;
    c.camera.position.set(camDist * 0.7, CAM_Y + camDist * 0.35, camDist * 0.7);
    c.camera.lookAt(0, CAM_Y * 0.7, 0);
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
