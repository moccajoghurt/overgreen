import * as THREE from 'three';
import { mat, addCanopy, addTrunk, jitter } from './plant-models';

// ── Stressed shrub variants: 30% foliage removed, slight droop, yellow-olive palette ──
// Slots: EvergreenShrub(12), DeciduousShrub(13), Mediterranean(14), Thorny(15),
//        DesertShrub(16), Mangrove(17), FloweringShrub(34), Aromatic(35)

// ── Hi-LOD stressed builders ──

function buildEvergreenShrubStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed boxwood — thinner canopy, yellowed, slight droop
  const stemMat = mat(0x6a4a2a);
  const stressColors = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];

  // Short multi-stem base (same as healthy)
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.3;
    const r = 0.08 + Math.random() * 0.04;
    const h = 0.25 + Math.random() * 0.1;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, h, 4), stemMat);
    stem.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    stem.rotation.z = Math.cos(a) * 0.15;
    stem.rotation.x = Math.sin(a) * 0.15;
    g.add(stem);
  }

  // Smaller opaque core — drooped down
  const coreGeo = new THREE.SphereGeometry(0.46, 14, 10);
  coreGeo.scale(1.0, 0.60, 1.0);
  const coreMesh = new THREE.Mesh(coreGeo, mat(0x556633));
  coreMesh.position.set(0, 0.30, 0);
  g.add(coreMesh);

  // Core mass — drooped, thinner
  addCanopy(g, 0, 0.34, 0, 0.40, stressColors[0]);
  addCanopy(g, 0, 0.42, 0, 0.34, stressColors[1]);

  // Reduced equatorial ring — 8 blobs instead of 12, drooped
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.15;
    const r = 0.34 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.28 + Math.random() * 0.05, Math.sin(a) * r,
      0.24 + Math.random() * 0.03, stressColors[i % stressColors.length]);
  }

  // Reduced upper dome — fewer lumps, lower
  const topOffsets: [number, number, number, number][] = [
    [0.0, 0.48, 0.0, 0.26], [-0.15, 0.50, 0.12, 0.20], [0.16, 0.49, -0.10, 0.19],
    [0.0, 0.52, 0.0, 0.17], [-0.18, 0.47, -0.18, 0.16],
  ];
  for (let i = 0; i < topOffsets.length; i++) {
    const [x, y, z, r] = topOffsets[i];
    addCanopy(g, x, y, z, r, stressColors[i % stressColors.length]);
  }

  // Reduced bottom skirt — 6 instead of 10
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const r = 0.30 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.15 + Math.random() * 0.03, Math.sin(a) * r,
      0.20, stressColors[(i + 2) % stressColors.length]);
  }

  return g;
}
function buildDeciduousShrubStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed forsythia — no flowers, yellowed sparse foliage, drooping branches
  const stemMat = mat(0x7a6a55);
  const stressLeaf = [0x99aa44, 0xaaaa55, 0x88993a, 0xa0a840, 0x8a9a3a];

  // 7 arching stems — same structure but slightly more droopy
  const stemHeights = [1.2, 1.0, 1.3, 0.9, 1.15, 0.85, 1.25];
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + (Math.random() - 0.5) * 0.45;
    const h = stemHeights[i];
    const spread = 0.68 + Math.random() * 0.15; // slightly wider spread (droopier)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.18, h * 0.45, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, h * 0.78, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.65, Math.sin(a) * spread), // droops more
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.028, 5, false), stemMat));

    // Foliage only on ~5 of 7 branches (remove ~30%)
    if (i < 5) {
      const tip = curve.getPoint(0.88);
      addCanopy(g, tip.x, tip.y - 0.02, tip.z, 0.18 + Math.random() * 0.04, stressLeaf[i % stressLeaf.length]);
    }
  }

  // Thinner crown fill
  const crownGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const crownMesh = new THREE.Mesh(crownGeo, mat(stressLeaf[2]));
  crownMesh.position.set(0, 0.82, 0);
  g.add(crownMesh);

  addCanopy(g, 0, 0.86, 0, 0.20, stressLeaf[0]);
  addCanopy(g, -0.08, 0.84, 0.10, 0.16, stressLeaf[1]);

  // Reduced upper canopy ring — 5 instead of 8
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.2;
    const r = 0.32 + Math.random() * 0.08;
    addCanopy(g, Math.cos(a) * r, 0.74 + Math.random() * 0.08, Math.sin(a) * r,
      0.15 + Math.random() * 0.03, stressLeaf[i % stressLeaf.length]);
  }

  // NO flowers — stressed plants don't flower

  return g;
}
function buildMediterraneanStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed Mediterranean maquis — no lavender flowers, sparser yellowed foliage
  const woodMat = mat(0x8a7a66);
  const stressLeaf = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const darkStress = [0x7a8a3a, 0x6a7a2e, 0x8a9a48];

  // Gnarled woody base — same as healthy
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + (Math.random() - 0.5) * 0.4;
    const h = 0.35 + Math.random() * 0.15;
    const spread = 0.12 + Math.random() * 0.08;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03),
      new THREE.Vector3(Math.cos(a) * spread * 0.5, h * 0.5, Math.sin(a) * spread * 0.5),
      new THREE.Vector3(Math.cos(a) * spread, h, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.025 + Math.random() * 0.01, 5, false), woodMat));
  }

  // Smaller opaque core — drooped
  const coreGeo = new THREE.SphereGeometry(0.50, 14, 10);
  coreGeo.scale(1.0, 0.28, 1.0);
  g.add(new THREE.Mesh(coreGeo, mat(darkStress[0])));
  (g.children[g.children.length - 1] as THREE.Mesh).position.set(0, 0.17, 0);

  // Thinner cushion foliage — fewer blobs, drooped
  addCanopy(g, 0, 0.19, 0, 0.44, stressLeaf[0]);
  addCanopy(g, 0, 0.24, 0, 0.36, stressLeaf[2]);

  // Reduced equatorial ring — 8 instead of 12
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8 + 0.15;
    const r = 0.40 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.15 + Math.random() * 0.03, Math.sin(a) * r,
      0.20 + Math.random() * 0.03, stressLeaf[i % stressLeaf.length]);
  }

  // Reduced bumpy mounding — 5 instead of 8
  const bumpHeights = [0.28, 0.24, 0.30, 0.22, 0.26];
  const bumpSizes = [0.18, 0.15, 0.20, 0.14, 0.17];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.3;
    const r = 0.16 + Math.random() * 0.12;
    addCanopy(g, Math.cos(a) * r, bumpHeights[i], Math.sin(a) * r,
      bumpSizes[i], stressLeaf[(i + 1) % stressLeaf.length]);
  }

  // Reduced bottom skirt — 6 instead of 10
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const r = 0.34 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.08 + Math.random() * 0.03, Math.sin(a) * r,
      0.17, darkStress[i % darkStress.length]);
  }

  // NO lavender flower spikes — stressed

  return g;
}
function buildThornyStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed thorny — no bracts/flowers, fewer leaves, same thorns, slightly droopy
  const woodMat = mat(0x7a5533);
  const stressLeaf = [0x88993a, 0x99aa44, 0x8a9a3a];
  const thornMat = mat(0xddeecc);

  // 8 branches — same structure, slightly more outward lean (droop)
  const branchData = [
    { a: 0.0, h: 1.15, spread: 0.58 },
    { a: 0.78, h: 0.50, spread: 0.64 },
    { a: 1.57, h: 1.25, spread: 0.68 },
    { a: 2.35, h: 0.45, spread: 0.62 },
    { a: 3.14, h: 1.05, spread: 0.62 },
    { a: 3.93, h: 0.60, spread: 0.74 },
    { a: 4.71, h: 1.20, spread: 0.66 },
    { a: 5.50, h: 0.65, spread: 0.60 },
  ];
  for (let i = 0; i < branchData.length; i++) {
    const { a, h, spread } = branchData[i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.14, h * 0.32, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * spread * 0.6, h * 0.65, Math.sin(a) * spread * 0.6),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.55, Math.sin(a) * spread), // droops more
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.032, 5, false), woodMat));

    // Fork on every other branch
    if (i % 2 === 0) {
      const forkPt = curve.getPoint(0.50);
      const forkA = a + (i % 4 === 0 ? 0.6 : -0.6);
      const forkCurve = new THREE.CatmullRomCurve3([
        forkPt,
        new THREE.Vector3(Math.cos(forkA) * spread * 0.5, h * 0.75, Math.sin(forkA) * spread * 0.5),
        new THREE.Vector3(Math.cos(forkA) * spread * 0.85, h * 0.60, Math.sin(forkA) * spread * 0.85),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 6, 0.020, 4, false), woodMat));
    }

    // Sparse tiny leaves only on 3 of 8 branches — no bracts/flowers
    if (i % 3 === 0) {
      const tip = curve.getPoint(0.82);
      addCanopy(g, tip.x, tip.y, tip.z, 0.06, stressLeaf[i % stressLeaf.length]);
    }

    // Thorns preserved — 3 per branch
    for (let t = 0; t < 3; t++) {
      const tPt = curve.getPoint(0.25 + t * 0.25);
      const outDir = Math.atan2(tPt.z, tPt.x);
      const side = (t % 2 === 0) ? 1 : -1;
      const perpDir = outDir + side * Math.PI / 2;
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.30, 3), thornMat);
      spine.position.set(tPt.x, tPt.y, tPt.z);
      spine.lookAt(
        tPt.x + Math.cos(perpDir) * 0.4,
        tPt.y - 0.1,
        tPt.z + Math.sin(perpDir) * 0.4,
      );
      g.add(spine);
    }
  }

  return g;
}
function buildDesertShrubStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed creosote — no flowers, even fewer leaf tufts, droopier stems
  const stemMat = mat(0x8a7a66);
  const leafMat = mat(0x99aa44);

  // 8 wiry stems — droopier
  const stemData = [
    { a: 0.0, h: 0.78, lean: 0.46 },
    { a: 0.78, h: 0.55, lean: 0.56 },
    { a: 1.57, h: 0.88, lean: 0.42 },
    { a: 2.35, h: 0.50, lean: 0.60 },
    { a: 3.14, h: 0.74, lean: 0.48 },
    { a: 3.93, h: 0.62, lean: 0.54 },
    { a: 4.71, h: 0.85, lean: 0.44 },
    { a: 5.50, h: 0.52, lean: 0.58 },
  ];
  for (let i = 0; i < stemData.length; i++) {
    const s = stemData[i];
    const spread = s.lean * s.h * 0.88;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * 0.03, 0, Math.sin(s.a) * 0.03),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.35, s.h * 0.38, Math.sin(s.a) * spread * 0.35),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.75, s.h * 0.75, Math.sin(s.a) * spread * 0.75),
      new THREE.Vector3(Math.cos(s.a) * spread, s.h * 0.60, Math.sin(s.a) * spread), // droops more
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.022, 4, false), stemMat));

    // Only 1 fork per stem instead of 2-3
    const forkT = 0.55;
    const forkPt = curve.getPoint(forkT);
    const forkA = s.a + 0.3;
    const forkLen = 0.12 + Math.random() * 0.08;
    const forkCurve = new THREE.CatmullRomCurve3([
      forkPt,
      new THREE.Vector3(
        Math.cos(forkA) * (spread + forkLen * 0.6),
        forkPt.y + forkLen * 0.25,
        Math.sin(forkA) * (spread + forkLen * 0.6),
      ),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 4, 0.010, 3, false), stemMat));

    // Very sparse leaf tufts — only on every 3rd stem
    if (i % 3 === 0) {
      const tip = curve.getPoint(0.85);
      const tipTuft = new THREE.Mesh(
        jitter(new THREE.IcosahedronGeometry(0.025, 0), 0.004),
        leafMat,
      );
      tipTuft.position.set(tip.x, tip.y, tip.z);
      g.add(tipTuft);
    }

    // NO flowers — stressed
  }

  return g;
}
function buildMangroveStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed mangrove — thinner canopy, yellowed, stilt roots preserved
  const rootMat = mat(0x7a4030);
  const rootMat2 = mat(0x6a3525);
  const stressLeaf = [0x88993a, 0x99aa44, 0xa0a840];
  const darkStress = [0x6a7a2e, 0x556622, 0x7a8a38];

  // Central trunk
  addTrunk(g, 0, 0.40, 0, 0.07, 0.06, 0.20, 0x7a4030);

  // 9 prop/stilt roots — same as healthy (defining feature)
  const roots = [
    { a: 0.0, spread: 0.58, thick: 0.030, startY: 0.50 },
    { a: 0.70, spread: 0.48, thick: 0.022, startY: 0.42 },
    { a: 1.20, spread: 0.62, thick: 0.028, startY: 0.48 },
    { a: 1.85, spread: 0.44, thick: 0.020, startY: 0.38 },
    { a: 2.50, spread: 0.55, thick: 0.026, startY: 0.46 },
    { a: 3.30, spread: 0.60, thick: 0.028, startY: 0.50 },
    { a: 4.10, spread: 0.42, thick: 0.022, startY: 0.40 },
    { a: 4.90, spread: 0.56, thick: 0.027, startY: 0.47 },
    { a: 5.60, spread: 0.50, thick: 0.024, startY: 0.44 },
  ];
  for (let i = 0; i < roots.length; i++) {
    const rt = roots[i];
    const a = rt.a;
    const sp = rt.spread;
    const midOff = (Math.random() - 0.5) * 0.12;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, rt.startY, 0),
      new THREE.Vector3(Math.cos(a + midOff) * sp * 0.35, rt.startY * 0.55, Math.sin(a + midOff) * sp * 0.35),
      new THREE.Vector3(Math.cos(a) * sp * 0.75, 0.04, Math.sin(a) * sp * 0.75),
      new THREE.Vector3(Math.cos(a) * sp, -0.06, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, rt.thick, 5, false), i % 2 === 0 ? rootMat : rootMat2));

    // Fewer secondary drop-roots
    if (i % 3 === 0) {
      const dropA = a + (Math.random() - 0.5) * 0.4;
      const dropR = sp * 0.45;
      const dropCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * sp * 0.40, 0.20, Math.sin(a) * sp * 0.40),
        new THREE.Vector3(Math.cos(dropA) * dropR, -0.03, Math.sin(dropA) * dropR),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 5, 0.012, 4, false), rootMat2));
    }
  }

  // Smaller opaque core — drooped
  const coreGeo = new THREE.SphereGeometry(0.32, 12, 8);
  coreGeo.scale(1.2, 0.65, 1.2);
  const coreMesh = new THREE.Mesh(coreGeo, mat(darkStress[1]));
  coreMesh.position.set(0, 0.66, 0);
  g.add(coreMesh);

  // Thinner central dome — 2 blobs instead of 3
  addCanopy(g, 0, 0.68, 0, 0.32, stressLeaf[0]);
  addCanopy(g, 0.05, 0.74, 0.05, 0.26, stressLeaf[1]);

  // Reduced equatorial ring — 6 instead of 10
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.2;
    const r = 0.26 + Math.random() * 0.05;
    const y = 0.62 + Math.random() * 0.06;
    addCanopy(g, Math.cos(a) * r, y, Math.sin(a) * r,
      0.18 + Math.random() * 0.03, stressLeaf[i % stressLeaf.length]);
  }

  // Reduced upper dome — 3 instead of 6
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.5;
    const r = 0.15 + Math.random() * 0.05;
    addCanopy(g, Math.cos(a) * r, 0.78 + Math.random() * 0.04, Math.sin(a) * r,
      0.15, stressLeaf[i]);
  }

  // Fewer aerial roots — 3 instead of 5
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.8;
    const edgeR = 0.30 + Math.random() * 0.06;
    const dropCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * edgeR, 0.56, Math.sin(a) * edgeR),
      new THREE.Vector3(Math.cos(a) * edgeR * 1.05, 0.28, Math.sin(a) * edgeR * 1.05),
      new THREE.Vector3(Math.cos(a) * edgeR * 0.95, 0.02, Math.sin(a) * edgeR * 0.95),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 6, 0.008, 3, false), rootMat2));
  }

  return g;
}
function buildFloweringShrubStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed hibiscus — no flowers, sparser yellowed dome
  const stressLeaf = [0x88993a, 0x99aa44, 0xa0a840, 0x8a9a3a, 0xaaaa55];
  const cc = () => stressLeaf[Math.floor(Math.random() * stressLeaf.length)];

  // Multi-stem base — same as healthy
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.04 + Math.random() * 0.02;
    addTrunk(g, Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, r, r * 0.7, 0.3, 0x5a4a30);
  }

  // Smaller opaque core — drooped
  const coreGeo = new THREE.SphereGeometry(0.30, 10, 8);
  coreGeo.scale(1.1, 0.85, 1.1);
  const core = new THREE.Mesh(coreGeo, mat(0x556633));
  core.position.set(0, 0.50, 0);
  g.add(core);

  // Reduced canopy dome — 2 tiers instead of 3, fewer per tier
  for (let tier = 0; tier < 2; tier++) {
    const y = 0.38 + tier * 0.15;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tier * 0.3;
      const dist = 0.22 + Math.random() * 0.08;
      addCanopy(g, Math.cos(a) * dist, y - 0.02, Math.sin(a) * dist,
        0.17 + Math.random() * 0.04, cc());
    }
  }

  // Reduced top + bottom fill
  addCanopy(g, 0, 0.64, 0, 0.24, cc());
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.18, 0.30, Math.sin(a) * 0.18, 0.15, cc());
  }

  // NO flowers — stressed

  return g;
}
function buildAromaticStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed lavender — no purple flower spikes, sparser yellowed mound
  const stressLeaf = [0x88993a, 0x99aa44, 0xa0a840, 0x8a9a3a];
  const cc = () => stressLeaf[Math.floor(Math.random() * stressLeaf.length)];

  // Smaller opaque core mound — drooped
  const coreGeo = new THREE.SphereGeometry(0.30, 10, 6);
  coreGeo.scale(1.2, 0.45, 1.2);
  const core = new THREE.Mesh(coreGeo, mat(0x6a7a3a));
  core.position.set(0, 0.15, 0);
  g.add(core);

  // Reduced mound surface blobs — 7 instead of 10, drooped
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const dist = 0.22 + Math.random() * 0.08;
    addCanopy(g, Math.cos(a) * dist, 0.14 + Math.random() * 0.04, Math.sin(a) * dist,
      0.15, cc());
  }
  // Reduced inner fill — 3 instead of 5
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    addCanopy(g, Math.cos(a) * 0.10, 0.18, Math.sin(a) * 0.10, 0.13, cc());
  }

  // NO purple flower spikes — stressed

  return g;
}

// ── Low-LOD stressed builders ──

function buildEvergreenShrubStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stressColors = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  // Smaller opaque core — drooped
  const coreGeo = new THREE.SphereGeometry(0.44, 10, 8);
  coreGeo.scale(1.0, 0.60, 1.0);
  const core = new THREE.Mesh(coreGeo, mat(0x556633));
  core.position.set(0, 0.30, 0);
  g.add(core);
  // 6 canopy blobs — thinner dome
  addCanopy(g, 0, 0.34, 0, 0.40, stressColors[0]);
  addCanopy(g, 0.30, 0.28, 0, 0.26, stressColors[1]);
  addCanopy(g, -0.30, 0.28, 0.1, 0.26, stressColors[2]);
  addCanopy(g, 0, 0.28, 0.30, 0.26, stressColors[3]);
  addCanopy(g, 0, 0.47, 0, 0.26, stressColors[4]);
  addCanopy(g, 0, 0.13, 0, 0.34, stressColors[0]);
  return g;
}
function buildDeciduousShrubStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a55);
  const stressLeaf = [0x99aa44, 0xaaaa55, 0x88993a, 0xa0a840];
  // 4 arching stems — droopy vase shape
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.2;
    const h = 0.95 + i * 0.10;
    const spread = 0.60 + Math.random() * 0.1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.18, h * 0.45, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, h * 0.78, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.65, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.028, 4, false), stemMat));
    // Smaller canopy blob at tip — 3 of 4 branches
    if (i < 3) {
      const tip = curve.getPoint(0.82);
      addCanopy(g, tip.x, tip.y - 0.02, tip.z, 0.24, stressLeaf[i]);
    }
  }
  // Central fill
  addCanopy(g, 0, 0.82, 0, 0.22, stressLeaf[0]);
  addCanopy(g, 0, 0.90, 0, 0.18, stressLeaf[2]);
  // NO flowers
  return g;
}
function buildMediterraneanStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stressLeaf = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840];
  // Flat opaque core
  const coreGeo = new THREE.SphereGeometry(0.48, 10, 8);
  coreGeo.scale(1.0, 0.28, 1.0);
  const core = new THREE.Mesh(coreGeo, mat(0x7a8a3a));
  core.position.set(0, 0.17, 0);
  g.add(core);
  // 4 canopy blobs — flat cushion
  addCanopy(g, 0, 0.20, 0, 0.42, stressLeaf[0]);
  addCanopy(g, 0.28, 0.17, 0.18, 0.26, stressLeaf[1]);
  addCanopy(g, -0.28, 0.17, -0.18, 0.26, stressLeaf[2]);
  addCanopy(g, 0, 0.26, 0, 0.26, stressLeaf[3]);
  // NO lavender spikes
  return g;
}
function buildThornyStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const woodMat = mat(0x7a5533);
  const thornMat = mat(0xddeecc);
  // 5 branches — skeleton dominant
  const branchData = [
    { a: 0.0, h: 1.10, spread: 0.62 },
    { a: 1.25, h: 0.60, spread: 0.60 },
    { a: 2.50, h: 1.20, spread: 0.66 },
    { a: 3.75, h: 1.00, spread: 0.62 },
    { a: 5.00, h: 0.65, spread: 0.58 },
  ];
  for (let i = 0; i < branchData.length; i++) {
    const { a, h, spread } = branchData[i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.14, h * 0.32, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * spread * 0.6, h * 0.65, Math.sin(a) * spread * 0.6),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.55, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.032, 4, false), woodMat));
    // 1 thorn per branch
    const tPt = curve.getPoint(0.45);
    const side = i % 2 === 0 ? 1 : -1;
    const perpDir = Math.atan2(tPt.z, tPt.x) + side * Math.PI / 2;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.25, 3), thornMat);
    spine.position.set(tPt.x, tPt.y, tPt.z);
    spine.lookAt(tPt.x + Math.cos(perpDir) * 0.4, tPt.y - 0.1, tPt.z + Math.sin(perpDir) * 0.4);
    g.add(spine);
  }
  // 1 tiny stress-colored leaf
  addCanopy(g, 0, 0.35, 0, 0.06, 0x88993a);
  return g;
}
function buildDesertShrubStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x8a7a66);
  const leafMat = mat(0x99aa44);
  // 5 wiry stems — skeleton only, nearly bare
  const stemData = [
    { a: 0.0, h: 0.78, lean: 0.46 },
    { a: 1.3, h: 0.55, lean: 0.54 },
    { a: 2.5, h: 0.85, lean: 0.42 },
    { a: 3.8, h: 0.60, lean: 0.52 },
    { a: 5.1, h: 0.74, lean: 0.48 },
  ];
  for (let i = 0; i < stemData.length; i++) {
    const s = stemData[i];
    const spread = s.lean * s.h * 0.85;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * 0.03, 0, Math.sin(s.a) * 0.03),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.4, s.h * 0.40, Math.sin(s.a) * spread * 0.4),
      new THREE.Vector3(Math.cos(s.a) * spread, s.h * 0.62, Math.sin(s.a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.020, 3, false), stemMat));
    // Only 1 tiny leaf tuft on first stem
    if (i === 0) {
      const tip = curve.getPoint(0.85);
      const tuft = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(0.022, 0), 0.003), leafMat);
      tuft.position.set(tip.x, tip.y, tip.z);
      g.add(tuft);
    }
  }
  return g;
}
function buildMangroveStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const rootMat = mat(0x7a4030);
  const stressLeaf = [0x88993a, 0x99aa44, 0xa0a840];
  // Trunk
  addTrunk(g, 0, 0.40, 0, 0.07, 0.06, 0.20, 0x7a4030);
  // 4 stilt roots
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.3;
    const sp = 0.5;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.48, 0),
      new THREE.Vector3(Math.cos(a) * sp * 0.4, 0.25, Math.sin(a) * sp * 0.4),
      new THREE.Vector3(Math.cos(a) * sp, -0.04, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.026, 4, false), rootMat));
  }
  // Smaller stressed core + canopy
  const coreGeo = new THREE.SphereGeometry(0.30, 8, 6);
  coreGeo.scale(1.2, 0.65, 1.2);
  const core = new THREE.Mesh(coreGeo, mat(0x556622));
  core.position.set(0, 0.66, 0);
  g.add(core);
  addCanopy(g, 0, 0.70, 0, 0.30, stressLeaf[0]);
  addCanopy(g, 0.15, 0.66, 0.10, 0.20, stressLeaf[1]);
  addCanopy(g, -0.10, 0.64, -0.15, 0.20, stressLeaf[2]);
  addCanopy(g, 0, 0.78, 0, 0.20, stressLeaf[0]);
  return g;
}
function buildFloweringShrubStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stressLeaf = [0x88993a, 0x99aa44, 0xa0a840, 0x8a9a3a, 0xaaaa55];
  // 1 trunk
  addTrunk(g, 0, 0, 0, 0.05, 0.04, 0.25, 0x5a4a30);
  // Thinner canopy — 5 blobs
  addCanopy(g, 0, 0.50, 0, 0.34, stressLeaf[0]);
  addCanopy(g, 0.18, 0.46, 0.12, 0.22, stressLeaf[1]);
  addCanopy(g, -0.15, 0.44, -0.10, 0.22, stressLeaf[2]);
  addCanopy(g, 0.0, 0.62, 0.0, 0.24, stressLeaf[3]);
  addCanopy(g, 0.0, 0.34, 0.0, 0.24, stressLeaf[4]);
  // NO flowers
  return g;
}
function buildAromaticStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stressLeaf = [0x88993a, 0x99aa44, 0xa0a840];
  // Compact stressed mound — just blobs, no spikes
  addCanopy(g, 0, 0.16, 0, 0.30, stressLeaf[0]);
  addCanopy(g, 0.0, 0.20, 0.0, 0.24, stressLeaf[1]);
  addCanopy(g, 0.18, 0.14, 0.10, 0.18, stressLeaf[2]);
  addCanopy(g, -0.16, 0.14, -0.08, 0.18, stressLeaf[0]);
  // NO flower spikes
  return g;
}

export const STRESSED_SHRUBS: Record<number, () => THREE.Group> = {
  12: buildEvergreenShrubStressed,
  13: buildDeciduousShrubStressed,
  14: buildMediterraneanStressed,
  15: buildThornyStressed,
  16: buildDesertShrubStressed,
  17: buildMangroveStressed,
  34: buildFloweringShrubStressed,
  35: buildAromaticStressed,
};

export const STRESSED_SHRUBS_LOW: Record<number, () => THREE.Group> = {
  12: buildEvergreenShrubStressedLow,
  13: buildDeciduousShrubStressedLow,
  14: buildMediterraneanStressedLow,
  15: buildThornyStressedLow,
  16: buildDesertShrubStressedLow,
  17: buildMangroveStressedLow,
  34: buildFloweringShrubStressedLow,
  35: buildAromaticStressedLow,
};

void jitter; void addCanopy; void addTrunk;
