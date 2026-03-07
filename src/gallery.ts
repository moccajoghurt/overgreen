import * as THREE from 'three';
import {
  BUILDERS,
  mat, jitter, grassBlade, addCanopy, addTrunk,
} from './renderer3d/plant-models';

// ============================================================
// LAYOUT
// ============================================================
const COLS = 6, ROWS = 8;
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
  { name: 'GRASSES \u2014 WINTER', color: '#7a7a5a', plants: [
    { id: '1.1w', name: 'Turfgrass', species: 'Dormant' },
    { id: '1.2w', name: 'Tallgrass', species: 'Dormant' },
    { id: '1.3w', name: 'Bunch grass', species: 'Dormant' },
    { id: '1.4w', name: 'Bamboo', species: 'Semi-evergreen' },
    { id: '1.5w', name: 'Spreading grass', species: 'Dormant' },
    { id: '1.6w', name: 'Sedge/Rush', species: 'Dormant' },
  ]},
  { name: 'TREES', color: '#654321', plants: [
    { id: '2.1', name: 'Broadleaf deciduous', species: 'Quercus robur' },
    { id: '2.2', name: 'Broadleaf evergreen', species: 'Magnolia grandiflora' },
    { id: '2.3', name: 'Conifer', species: 'Pinus sylvestris' },
    { id: '2.4', name: 'Tropical hardwood', species: 'Swietenia mahagoni' },
    { id: '2.5', name: 'Palm', species: 'Cocos nucifera' },
    { id: '2.6', name: 'Pioneer/fast-growth', species: 'Betula pendula' },
  ]},
  { name: 'TREES \u2014 WINTER', color: '#5a4a3a', plants: [
    { id: '2.1w', name: 'Broadleaf deciduous', species: 'Bare' },
    { id: '2.2w', name: 'Broadleaf evergreen', species: 'Evergreen' },
    { id: '2.3w', name: 'Conifer', species: 'Evergreen' },
    { id: '2.4w', name: 'Tropical hardwood', species: 'Evergreen' },
    { id: '2.5w', name: 'Palm', species: 'Evergreen' },
    { id: '2.6w', name: 'Pioneer/fast-growth', species: 'Bare' },
  ]},
  { name: 'SHRUBS', color: '#8c783c', plants: [
    { id: '3.1', name: 'Evergreen shrub', species: 'Buxus sempervirens' },
    { id: '3.2', name: 'Deciduous shrub', species: 'Sambucus nigra' },
    { id: '3.3', name: 'Mediterranean', species: 'Rosmarinus officinalis' },
    { id: '3.4', name: 'Thorny/Armed', species: 'Ulex europaeus' },
    { id: '3.5', name: 'Desert shrub', species: 'Larrea tridentata' },
    { id: '3.6', name: 'Mangrove', species: 'Rhizophora mangle' },
  ]},
  { name: 'SHRUBS \u2014 WINTER', color: '#6a6a4a', plants: [
    { id: '3.1w', name: 'Evergreen shrub', species: 'Evergreen' },
    { id: '3.2w', name: 'Deciduous shrub', species: 'Bare' },
    { id: '3.3w', name: 'Mediterranean', species: 'Evergreen' },
    { id: '3.4w', name: 'Thorny/Armed', species: 'Bare' },
    { id: '3.5w', name: 'Desert shrub', species: 'Bare' },
    { id: '3.6w', name: 'Mangrove', species: 'Evergreen' },
  ]},
  { name: 'SUCCULENTS', color: '#558c64', plants: [
    { id: '4.1', name: 'Stem succulent', species: 'Carnegiea gigantea' },
    { id: '4.2', name: 'Leaf succulent', species: 'Aloe vera' },
    { id: '4.3', name: 'Caudiciform', species: 'Adenium obesum' },
    { id: '4.4', name: 'Euphorbia', species: 'Euphorbia ingens' },
    { id: '4.5', name: 'Ice plant/Mesemb', species: 'Lithops' },
    { id: '4.6', name: 'Epiphytic succulent', species: 'Schlumbergera' },
  ]},
  { name: 'SUCCULENTS \u2014 WINTER', color: '#4a6a4a', plants: [
    { id: '4.1w', name: 'Stem succulent', species: 'Unchanged' },
    { id: '4.2w', name: 'Leaf succulent', species: 'Unchanged' },
    { id: '4.3w', name: 'Caudiciform', species: 'Bare' },
    { id: '4.4w', name: 'Euphorbia', species: 'Unchanged' },
    { id: '4.5w', name: 'Ice plant/Mesemb', species: 'Unchanged' },
    { id: '4.6w', name: 'Epiphytic succulent', species: 'Unchanged' },
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
  const geo = new THREE.CylinderGeometry(1.5, 1.5, 0.04, 16);
  const m = new THREE.Mesh(geo, mat(0x4a7a8a, { roughness: 0.3, transparent: true, opacity: 0.7 }));
  m.position.y = -0.02;
  group.add(m);
}

// ============================================================
// CAMERA & GROUND PARAMS PER SUBTYPE
// ============================================================
interface CellParams { camY: number; camDist: number; groundR: number }

// Indexed 0-23 matching BUILDERS order
const CELL_PARAMS: CellParams[] = [
  // Grasses
  { camY: 0.1,  camDist: 1.0, groundR: 0.5 },  // 0: Turfgrass
  { camY: 0.9,  camDist: 3.5, groundR: 1.5 },  // 1: Tallgrass
  { camY: 0.35, camDist: 2.2, groundR: 1.5 },  // 2: Bunchgrass
  { camY: 1.2,  camDist: 4.2, groundR: 1.5 },  // 3: Bamboo
  { camY: 0.1,  camDist: 1.0, groundR: 0.5 },  // 4: Spreading
  { camY: 1.0,  camDist: 3.8, groundR: 1.5 },  // 5: Sedge
  // Trees
  { camY: 1.2,  camDist: 4.8, groundR: 2.0 },  // 6: Oak
  { camY: 1.3,  camDist: 4.5, groundR: 1.5 },  // 7: Magnolia
  { camY: 1.2,  camDist: 4.2, groundR: 1.5 },  // 8: Conifer
  { camY: 1.4,  camDist: 5.2, groundR: 1.5 },  // 9: Tropical
  { camY: 1.2,  camDist: 6.2, groundR: 1.5 },  // 10: Palm
  { camY: 1.2,  camDist: 4.2, groundR: 1.5 },  // 11: Birch
  // Shrubs
  { camY: 0.35, camDist: 2.8, groundR: 1.5 },  // 12: Evergreen shrub
  { camY: 0.6,  camDist: 3.5, groundR: 1.5 },  // 13: Deciduous shrub
  { camY: 0.4,  camDist: 2.6, groundR: 1.5 },  // 14: Mediterranean
  { camY: 0.4,  camDist: 3.0, groundR: 1.5 },  // 15: Thorny
  { camY: 0.4,  camDist: 3.2, groundR: 1.5 },  // 16: Desert shrub
  { camY: 0.5,  camDist: 3.5, groundR: 0   },  // 17: Mangrove (water, not ground)
  // Succulents
  { camY: 1.1,  camDist: 4.2, groundR: 1.5 },  // 18: Saguaro
  { camY: 0.3,  camDist: 2.5, groundR: 1.5 },  // 19: Aloe
  { camY: 0.3,  camDist: 2.5, groundR: 1.5 },  // 20: Caudiciform
  { camY: 0.8,  camDist: 4.0, groundR: 1.5 },  // 21: Euphorbia
  { camY: 0.1,  camDist: 1.3, groundR: 0.8 },  // 22: Ice Plant
  { camY: 0.12, camDist: 1.8, groundR: 1.5 },  // 23: Epiphytic
];

// Map string IDs to BUILDERS indices
const ID_TO_INDEX: Record<string, number> = {
  '1.1': 0,  '1.2': 1,  '1.3': 2,  '1.4': 3,  '1.5': 4,  '1.6': 5,
  '2.1': 6,  '2.2': 7,  '2.3': 8,  '2.4': 9,  '2.5': 10, '2.6': 11,
  '3.1': 12, '3.2': 13, '3.3': 14, '3.4': 15, '3.5': 16, '3.6': 17,
  '4.1': 18, '4.2': 19, '4.3': 20, '4.4': 21, '4.5': 22, '4.6': 23,
};

// ============================================================
// WINTER BUILDERS (gallery-only, using shared helpers)
// ============================================================

function buildTurfgrassWinter(): THREE.Group {
  const g = new THREE.Group();
  const bm = mat(0x9a8a5a, { side: THREE.DoubleSide });
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.3;
    const h = 0.08 + Math.random() * 0.06;
    const geo = grassBlade(h, 0.03, 0.02 * (Math.random() - 0.5));
    const m = new THREE.Mesh(geo, bm);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    g.add(m);
  }
  return g;
}

function buildTallgrassWinter(): THREE.Group {
  const g = new THREE.Group();
  const bm = mat(0x8a7a4a, { side: THREE.DoubleSide });
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.25;
    const h = 1.0 + Math.random() * 0.6;
    const bend = 0.4 + Math.random() * 0.5;
    const geo = grassBlade(h, 0.05, bend, (Math.random() - 0.5) * 0.15);
    const m = new THREE.Mesh(geo, bm);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    g.add(m);
  }
  const sm = mat(0x7a6a4a);
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.ConeGeometry(0.025, 0.18, 4);
    const m = new THREE.Mesh(geo, sm);
    m.position.set((Math.random() - 0.5) * 0.3, 1.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
    g.add(m);
  }
  return g;
}

function buildBunchgrassWinter(): THREE.Group {
  const g = new THREE.Group();
  const bm = mat(0x8a8a5a, { side: THREE.DoubleSide });
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.15;
    const h = 0.3 + Math.random() * 0.25;
    const bend = 0.3 + Math.random() * 0.4;
    const geo = grassBlade(h, 0.02, bend);
    const m = new THREE.Mesh(geo, bm);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.rotation.y = a + (Math.random() - 0.5) * 0.5;
    g.add(m);
  }
  return g;
}

function buildBambooWinter(): THREE.Group {
  const g = new THREE.Group();
  const culmMat = mat(0x7a9a4a);
  const leafMat = mat(0x8a8a3a, { side: THREE.DoubleSide });
  const nodeMat = mat(0x6a8a2a);
  for (let ci = 0; ci < 5; ci++) {
    const cx = (Math.random() - 0.5) * 0.35;
    const cz = (Math.random() - 0.5) * 0.35;
    const totalH = 2.0 + Math.random() * 0.5;
    const segH = 0.3;
    const r = 0.035;
    for (let s = 0; s < Math.floor(totalH / segH); s++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, segH, 6), culmMat);
      seg.position.set(cx, s * segH + segH / 2, cz);
      g.add(seg);
      if (s > 0 && s % 2 === 0) {
        const node = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, r * 0.35, 4, 8), nodeMat);
        node.position.set(cx, s * segH, cz);
        node.rotation.x = Math.PI / 2;
        g.add(node);
      }
    }
    for (let l = 0; l < 3; l++) {
      const la = l * Math.PI * 2 / 3 + Math.random() * 0.5;
      const leaf = new THREE.Mesh(grassBlade(0.3, 0.05, 0.25), leafMat);
      leaf.position.set(cx + Math.cos(la) * 0.1, totalH, cz + Math.sin(la) * 0.1);
      leaf.rotation.y = la;
      leaf.rotation.z = 0.4;
      g.add(leaf);
    }
  }
  return g;
}

function buildSpreadingWinter(): THREE.Group {
  const g = new THREE.Group();
  const bm = mat(0x9a8a5a, { side: THREE.DoubleSide });
  const sm = mat(0x7a6a4a);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.random() * 0.3;
    const len = 0.15 + Math.random() * 0.12;
    const stolon = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, len, 4), sm);
    stolon.position.set(Math.cos(a) * len / 2, 0.015, Math.sin(a) * len / 2);
    stolon.rotation.z = Math.PI / 2;
    stolon.rotation.y = -a;
    g.add(stolon);
    for (let j = 0; j < 2; j++) {
      const t = (j + 1) / 3;
      const sx = Math.cos(a) * len * t;
      const sz = Math.sin(a) * len * t;
      for (let k = 0; k < 3; k++) {
        const h = 0.06 + Math.random() * 0.04;
        const geo = grassBlade(h, 0.02, 0.01);
        const m = new THREE.Mesh(geo, bm);
        m.position.set(sx + (Math.random() - 0.5) * 0.05, h / 2, sz + (Math.random() - 0.5) * 0.05);
        m.rotation.y = Math.random() * Math.PI;
        g.add(m);
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    const h = 0.06 + Math.random() * 0.04;
    const geo = grassBlade(h, 0.025, 0.01);
    const m = new THREE.Mesh(geo, bm);
    m.position.set((Math.random() - 0.5) * 0.1, h / 2, (Math.random() - 0.5) * 0.1);
    m.rotation.y = Math.random() * Math.PI;
    g.add(m);
  }
  return g;
}

function buildSedgeWinter(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a4a);
  const umbMat = mat(0x8a7a4a, { side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const sx = (Math.random() - 0.5) * 0.3;
    const sz = (Math.random() - 0.5) * 0.3;
    const h = 1.3 + Math.random() * 0.4;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 3), stemMat);
    stem.position.set(sx, h / 2, sz);
    g.add(stem);
    for (let j = 0; j < 10; j++) {
      const ba = j * Math.PI * 2 / 10;
      const bract = new THREE.Mesh(grassBlade(0.4, 0.012, 0.45), umbMat);
      bract.position.set(sx + Math.cos(ba) * 0.03, h, sz + Math.sin(ba) * 0.03);
      bract.rotation.y = ba;
      bract.rotation.z = -0.3;
      g.add(bract);
    }
  }
  return g;
}

function buildOakWinter(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.2, 0.12, 1.2, 0x5a3a1a);
  const t1 = addTrunk(g, -0.15, 1.0, 0, 0.08, 0.05, 0.7, 0x5a3a1a);
  t1.rotation.z = 0.6;
  const t2 = addTrunk(g, 0.15, 1.0, 0.1, 0.08, 0.05, 0.65, 0x5a3a1a);
  t2.rotation.z = -0.5;
  const t3 = addTrunk(g, 0, 1.0, -0.15, 0.07, 0.04, 0.5, 0x5a3a1a);
  t3.rotation.x = 0.5;
  const twigMat = mat(0x5a3a1a);
  const twigs = [
    { x: -0.5, y: 1.6, z: 0.1, a: 0.8, len: 0.3 },
    { x: 0.45, y: 1.55, z: -0.1, a: -0.6, len: 0.25 },
    { x: 0.1, y: 1.7, z: 0.35, a: 0.3, len: 0.2 },
    { x: -0.25, y: 1.85, z: -0.3, a: 0.5, len: 0.22 },
    { x: 0.3, y: 1.8, z: 0.2, a: -0.4, len: 0.18 },
    { x: -0.1, y: 1.9, z: 0, a: 0.1, len: 0.25 },
  ];
  for (const tw of twigs) {
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.015, tw.len, 3), twigMat);
    twig.position.set(tw.x, tw.y, tw.z);
    twig.rotation.z = tw.a;
    g.add(twig);
  }
  return g;
}

function buildBirchWinter(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.07, 0.04, 2.0, 0xd8d0c8);
  const patchMat = mat(0x3a3a3a);
  for (let pi = 0; pi < 6; pi++) {
    const pa = Math.random() * Math.PI * 2;
    const py = 0.3 + Math.random() * 1.2;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.02), patchMat);
    patch.position.set(Math.cos(pa) * 0.06, py, Math.sin(pa) * 0.06);
    patch.rotation.y = pa;
    g.add(patch);
  }
  const brMat = mat(0x9a8a7a);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + Math.random() * 0.3;
    const y = 1.1 + Math.random() * 0.7;
    const len = 0.4 + Math.random() * 0.25;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, len, 4), brMat);
    branch.position.set(Math.cos(a) * len / 3, y, Math.sin(a) * len / 3);
    branch.rotation.z = Math.cos(a) * 0.7;
    branch.rotation.x = Math.sin(a) * 0.7;
    g.add(branch);
    for (let ti = 0; ti < 3; ti++) {
      const ta = a + (ti - 1) * 0.4;
      const tLen = 0.1 + Math.random() * 0.08;
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.007, tLen, 3), brMat);
      twig.position.set(
        Math.cos(a) * len * 0.6 + Math.cos(ta) * 0.05,
        y - 0.1 + ti * 0.04,
        Math.sin(a) * len * 0.6 + Math.sin(ta) * 0.05,
      );
      twig.rotation.z = Math.cos(ta) * 0.9;
      twig.rotation.x = Math.sin(ta) * 0.9;
      g.add(twig);
    }
  }
  return g;
}

function buildDeciduousShrubWinter(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a5a);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + Math.random() * 0.2;
    const h = 0.8 + Math.random() * 0.4;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * 0.2, h * 0.5, Math.sin(a) * 0.2),
      new THREE.Vector3(Math.cos(a) * 0.5, h * 0.8, Math.sin(a) * 0.5),
      new THREE.Vector3(Math.cos(a) * 0.6, h * 0.7, Math.sin(a) * 0.6),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.02, 4, false), stemMat));
    const tip = curve.getPoint(0.85);
    for (let ti = 0; ti < 2; ti++) {
      const ta = a + (ti - 0.5) * 0.6;
      const tLen = 0.08 + Math.random() * 0.06;
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.01, tLen, 3), stemMat);
      twig.position.set(tip.x + Math.cos(ta) * 0.03, tip.y + 0.02, tip.z + Math.sin(ta) * 0.03);
      twig.rotation.z = Math.cos(ta) * 0.5;
      twig.rotation.x = Math.sin(ta) * 0.5;
      g.add(twig);
    }
  }
  return g;
}

function buildThornyWinter(): THREE.Group {
  const g = new THREE.Group();
  const spineMat = mat(0x5a4a3a);
  const woodMat = mat(0x6a4a2a);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const h = 0.6 + Math.random() * 0.2;
    const lean = 0.35 + Math.random() * 0.2;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, h, 4), woodMat);
    branch.position.set(Math.cos(a) * 0.06, h / 2, Math.sin(a) * 0.06);
    branch.rotation.z = Math.cos(a) * lean;
    branch.rotation.x = Math.sin(a) * lean;
    g.add(branch);
  }
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2;
    const elev = Math.random() * 0.8;
    const r = 0.15 + Math.random() * 0.15;
    const sx = Math.cos(a) * r;
    const sy = 0.35 + elev * 0.4;
    const sz = Math.sin(a) * r;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.1, 3), spineMat);
    spine.position.set(sx, sy, sz);
    spine.lookAt(sx * 2.5, sy * 1.2, sz * 2.5);
    g.add(spine);
  }
  return g;
}

function buildDesertShrubWinter(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a5a);
  const mainStems = [
    { a: 0.0, lean: 0.35, h: 0.65 },
    { a: 1.1, lean: 0.4, h: 0.55 },
    { a: 2.3, lean: 0.3, h: 0.7 },
    { a: 3.5, lean: 0.45, h: 0.5 },
    { a: 4.7, lean: 0.35, h: 0.6 },
    { a: 5.6, lean: 0.25, h: 0.55 },
  ];
  for (const s of mainStems) {
    const baseR = 0.03 + Math.random() * 0.03;
    const midR = baseR + s.lean * s.h * 0.35;
    const tipR = midR + s.lean * s.h * 0.25;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * baseR, 0, Math.sin(s.a) * baseR),
      new THREE.Vector3(Math.cos(s.a) * midR, s.h * 0.5, Math.sin(s.a) * midR),
      new THREE.Vector3(Math.cos(s.a) * tipR, s.h * 0.85, Math.sin(s.a) * tipR),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.015, 4, false), stemMat));
    const forkCount = 2 + Math.floor(Math.random() * 2);
    for (let f = 0; f < forkCount; f++) {
      const forkA = s.a + (f - forkCount / 2) * 0.5;
      const forkLen = 0.15 + Math.random() * 0.12;
      const forkBase = new THREE.Vector3(Math.cos(s.a) * tipR, s.h * 0.85, Math.sin(s.a) * tipR);
      const forkTip = new THREE.Vector3(
        Math.cos(forkA) * (tipR + forkLen * 0.7),
        s.h * 0.85 + forkLen * 0.5,
        Math.sin(forkA) * (tipR + forkLen * 0.7),
      );
      const fCurve = new THREE.CatmullRomCurve3([forkBase, forkTip]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(fCurve, 4, 0.008, 3, false), stemMat));
    }
  }
  return g;
}

function buildCaudiciformWinter(): THREE.Group {
  const g = new THREE.Group();
  const brMat = mat(0x9a9080, { roughness: 0.5 });
  const branches = [
    { a: 0.4, h: 0.4 },
    { a: 1.8, h: 0.35 },
    { a: 3.2, h: 0.45 },
    { a: 4.8, h: 0.38 },
  ];
  for (const b of branches) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(b.a) * 0.06, b.h * 0.4, Math.sin(b.a) * 0.06),
      new THREE.Vector3(Math.cos(b.a) * 0.18, b.h, Math.sin(b.a) * 0.18),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.03, 5, false), brMat));
  }
  return g;
}

// ============================================================
// BUILDER MAP (summer from shared module, winter gallery-only)
// ============================================================
const builders: Record<string, () => THREE.Group> = {};

// Summer: map string IDs to shared BUILDERS
for (const [id, idx] of Object.entries(ID_TO_INDEX)) {
  builders[id] = BUILDERS[idx];
}

// Winter: unique builders or aliases to summer
builders['1.1w'] = buildTurfgrassWinter;
builders['1.2w'] = buildTallgrassWinter;
builders['1.3w'] = buildBunchgrassWinter;
builders['1.4w'] = buildBambooWinter;
builders['1.5w'] = buildSpreadingWinter;
builders['1.6w'] = buildSedgeWinter;
builders['2.1w'] = buildOakWinter;
builders['2.2w'] = BUILDERS[7];  // Magnolia — evergreen
builders['2.3w'] = BUILDERS[8];  // Conifer — evergreen
builders['2.4w'] = BUILDERS[9];  // Tropical — evergreen
builders['2.5w'] = BUILDERS[10]; // Palm — evergreen
builders['2.6w'] = buildBirchWinter;
builders['3.1w'] = BUILDERS[12]; // Evergreen shrub — unchanged
builders['3.2w'] = buildDeciduousShrubWinter;
builders['3.3w'] = BUILDERS[14]; // Mediterranean — evergreen
builders['3.4w'] = buildThornyWinter;
builders['3.5w'] = buildDesertShrubWinter;
builders['3.6w'] = BUILDERS[17]; // Mangrove — evergreen
builders['4.1w'] = BUILDERS[18]; // Saguaro — unchanged
builders['4.2w'] = BUILDERS[19]; // Aloe — unchanged
builders['4.3w'] = buildCaudiciformWinter;
builders['4.4w'] = BUILDERS[21]; // Euphorbia — unchanged
builders['4.5w'] = BUILDERS[22]; // Ice plant — unchanged
builders['4.6w'] = BUILDERS[23]; // Epiphytic — unchanged

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
    const group = builders[plant.id]();

    // Add ground platform or water disc
    const baseId = plant.id.replace('w', '');
    const idx = ID_TO_INDEX[baseId];
    const params = CELL_PARAMS[idx];
    if (idx === 17) {
      addWaterDisc(group); // Mangrove
    } else {
      addGround(group, params.groundR);
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

    // Camera
    const cam = new THREE.PerspectiveCamera(38, CELL_W / CELL_3D, 0.1, 500);
    const d = params.camDist;
    const cy = params.camY;
    cam.position.set(d * 0.7, cy + d * 0.35, d * 0.7);
    cam.lookAt(0, cy * 0.7, 0);

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

      // Name + species
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e1e1e';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, cx, labelY + 18);
      ctx.font = 'italic 11px "Segoe UI", sans-serif';
      ctx.fillStyle = '#5a5a5a';
      ctx.fillText(p.species, cx, labelY + 34);
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
