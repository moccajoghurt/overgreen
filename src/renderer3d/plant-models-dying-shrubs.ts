import * as THREE from 'three';
import { mat, addCanopy, addTrunk, jitter } from './plant-models';

// ── Dying shrub variants: 60-70% foliage gone, strong droop, brown/gray palette ──
// Slots: EvergreenShrub(12), DeciduousShrub(13), Mediterranean(14), Thorny(15),
//        DesertShrub(16), Mangrove(17), FloweringShrub(34), Aromatic(35)

// ── Hi-LOD dying builders ──

function buildEvergreenShrubDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying boxwood — skeletal, most foliage gone, brown/gray, strongly drooped
  const stemMat = mat(0x6a6a5a);
  const deadColors = [0x8a7a55, 0x7a6a4a, 0x6a5a3a, 0x9a8a60];

  // Exposed stems — now visible since foliage is mostly gone
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.3;
    const r = 0.08 + Math.random() * 0.04;
    const h = 0.25 + Math.random() * 0.1;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, h, 4), stemMat);
    stem.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    stem.rotation.z = Math.cos(a) * 0.25; // more droop
    stem.rotation.x = Math.sin(a) * 0.25;
    g.add(stem);
    // Bare branch stubs extending from stems
    const stubH = 0.08 + Math.random() * 0.06;
    const branchStub = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.01, stubH, 3), stemMat);
    branchStub.position.set(Math.cos(a) * (r + 0.06), h * 0.7, Math.sin(a) * (r + 0.06));
    branchStub.rotation.z = Math.cos(a) * 0.6;
    branchStub.rotation.x = Math.sin(a) * 0.6;
    g.add(branchStub);
  }

  // Shrunken opaque core — much smaller, drooped
  const coreGeo = new THREE.SphereGeometry(0.30, 10, 8);
  coreGeo.scale(1.0, 0.55, 1.0);
  const coreMesh = new THREE.Mesh(coreGeo, mat(0x5a5a4a));
  coreMesh.position.set(0, 0.24, 0);
  g.add(coreMesh);

  // Only 3 sparse brown leaf clusters remaining — drooped low
  addCanopy(g, 0.15, 0.26, 0.10, 0.18, deadColors[0]);
  addCanopy(g, -0.20, 0.22, -0.05, 0.16, deadColors[1]);
  addCanopy(g, 0.05, 0.30, -0.18, 0.14, deadColors[2]);

  // 2 tiny remnant patches on sides
  addCanopy(g, 0.28, 0.18, 0.0, 0.10, deadColors[3]);
  addCanopy(g, -0.10, 0.16, 0.22, 0.09, deadColors[0]);

  return g;
}
function buildDeciduousShrubDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying forsythia — bare arching stems, almost no leaves, no flowers, strong droop
  const stemMat = mat(0x6a6a5a);
  const deadColors = [0x8a7a55, 0x7a6a4a, 0x6a5a3a];

  // 7 arching stems — sagging more than healthy, exposed
  const stemHeights = [1.1, 0.9, 1.2, 0.85, 1.05, 0.80, 1.15];
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + (Math.random() - 0.5) * 0.45;
    const h = stemHeights[i];
    const spread = 0.70 + Math.random() * 0.15; // wider spread = more droop
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.18, h * 0.40, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, h * 0.65, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.50, Math.sin(a) * spread), // droops lower at tip
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.028, 5, false), stemMat));

    // Only 2 branches get tiny dead leaf clusters
    if (i === 0 || i === 3) {
      const tip = curve.getPoint(0.75);
      addCanopy(g, tip.x, tip.y, tip.z, 0.12, deadColors[i % deadColors.length]);
    }

    // Bare branch stub on some stems
    if (i % 2 === 0) {
      const mid = curve.getPoint(0.55);
      const stubA = a + 0.8;
      const branchStub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.012, 0.10, 3), stemMat,
      );
      branchStub.position.set(mid.x, mid.y, mid.z);
      branchStub.rotation.z = Math.cos(stubA) * 0.7;
      branchStub.rotation.x = Math.sin(stubA) * 0.7;
      g.add(branchStub);
    }
  }

  // One tiny brown cluster at center, very sparse
  addCanopy(g, 0, 0.65, 0, 0.10, deadColors[2]);

  return g;
}
function buildMediterraneanDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying maquis — gnarled woody base exposed, sparse brown remnant foliage, no lavender
  const woodMat = mat(0x7a7a6a);
  const deadColors = [0x8a7a55, 0x7a6a4a, 0x6a5a3a, 0x9a8a60];

  // Gnarled woody stems — now highly visible
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + (Math.random() - 0.5) * 0.4;
    const h = 0.35 + Math.random() * 0.15;
    const spread = 0.15 + Math.random() * 0.10;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03),
      new THREE.Vector3(Math.cos(a) * spread * 0.5, h * 0.5, Math.sin(a) * spread * 0.5),
      new THREE.Vector3(Math.cos(a) * spread, h, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.028 + Math.random() * 0.01, 5, false), woodMat));

    // Bare branch stubs forking from stems
    const mid = curve.getPoint(0.6);
    const stubA = a + (i % 2 === 0 ? 0.5 : -0.5);
    const branchStub = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.010, 0.08, 3), woodMat);
    branchStub.position.set(mid.x, mid.y, mid.z);
    branchStub.rotation.z = Math.cos(stubA) * 0.8;
    branchStub.rotation.x = Math.sin(stubA) * 0.8;
    g.add(branchStub);
  }

  // Shrunken dying core — much smaller flat pancake
  const coreGeo = new THREE.SphereGeometry(0.35, 10, 8);
  coreGeo.scale(1.0, 0.25, 1.0);
  const coreMesh = new THREE.Mesh(coreGeo, mat(0x5a5a4a));
  coreMesh.position.set(0, 0.16, 0);
  g.add(coreMesh);

  // Only 3 sparse brown foliage patches — flat and drooped
  addCanopy(g, 0.18, 0.16, 0.10, 0.16, deadColors[0]);
  addCanopy(g, -0.15, 0.14, -0.12, 0.14, deadColors[1]);
  addCanopy(g, -0.05, 0.18, 0.20, 0.12, deadColors[3]);

  // 2 dead lavender spike stubs — brown, leaning over
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const r = 0.22;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.12, 4),
      mat(0x7a6a5a),
    );
    spike.position.set(Math.cos(a) * r, 0.22, Math.sin(a) * r);
    spike.rotation.z = 0.4; // leaning
    g.add(spike);
  }

  return g;
}
function buildThornyDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying thorny shrub — bare branch skeleton, thorns still prominent, no bracts/flowers, minimal leaves
  const woodMat = mat(0x6a5a4a);
  const thornMat = mat(0xbbaa88); // faded pale thorns

  // 8 branches — same structure but sagging more
  const branchData = [
    { a: 0.0, h: 1.00, spread: 0.55 },
    { a: 0.78, h: 0.45, spread: 0.60 },
    { a: 1.57, h: 1.10, spread: 0.65 },
    { a: 2.35, h: 0.42, spread: 0.58 },
    { a: 3.14, h: 0.90, spread: 0.58 },
    { a: 3.93, h: 0.55, spread: 0.70 },
    { a: 4.71, h: 1.05, spread: 0.62 },
    { a: 5.50, h: 0.60, spread: 0.55 },
  ];
  for (let i = 0; i < branchData.length; i++) {
    const { a, h, spread } = branchData[i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.14, h * 0.30, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * spread * 0.6, h * 0.55, Math.sin(a) * spread * 0.6),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.40, Math.sin(a) * spread), // droops lower
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.032, 5, false), woodMat));

    // Fork on every other branch (same as healthy)
    if (i % 2 === 0) {
      const forkPt = curve.getPoint(0.50);
      const forkA = a + (i % 4 === 0 ? 0.6 : -0.6);
      const forkCurve = new THREE.CatmullRomCurve3([
        forkPt,
        new THREE.Vector3(Math.cos(forkA) * spread * 0.5, h * 0.6, Math.sin(forkA) * spread * 0.5),
        new THREE.Vector3(Math.cos(forkA) * spread * 0.85, h * 0.45, Math.sin(forkA) * spread * 0.85),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 6, 0.020, 4, false), woodMat));
    }

    // NO leaves or bracts — dying = bare skeleton

    // Thorns remain — 3 per branch, slightly faded
    for (let t = 0; t < 3; t++) {
      const tPt = curve.getPoint(0.25 + t * 0.25);
      const outDir = Math.atan2(tPt.z, tPt.x);
      const side = (t % 2 === 0) ? 1 : -1;
      const perpDir = outDir + side * Math.PI / 2;
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 3), thornMat);
      spine.position.set(tPt.x, tPt.y, tPt.z);
      spine.lookAt(
        tPt.x + Math.cos(perpDir) * 0.4,
        tPt.y - 0.15,
        tPt.z + Math.sin(perpDir) * 0.4,
      );
      g.add(spine);
    }
  }

  // One tiny dying leaf cluster at center
  addCanopy(g, 0, 0.30, 0, 0.07, 0x7a6a4a);

  return g;
}
function buildDesertShrubDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying creosote — wiry skeleton fully exposed, no leaf tufts, no flowers, gray stems
  const stemMat = mat(0x7a7a6a);

  // 8 wiry stems — drooping, grayed out
  const stemData = [
    { a: 0.0, h: 0.70, lean: 0.48 },
    { a: 0.78, h: 0.50, lean: 0.56 },
    { a: 1.57, h: 0.80, lean: 0.44 },
    { a: 2.35, h: 0.45, lean: 0.60 },
    { a: 3.14, h: 0.65, lean: 0.50 },
    { a: 3.93, h: 0.55, lean: 0.54 },
    { a: 4.71, h: 0.75, lean: 0.46 },
    { a: 5.50, h: 0.48, lean: 0.58 },
  ];
  for (let i = 0; i < stemData.length; i++) {
    const s = stemData[i];
    const spread = s.lean * s.h * 0.90; // wider spread = more droop
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * 0.03, 0, Math.sin(s.a) * 0.03),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.35, s.h * 0.35, Math.sin(s.a) * spread * 0.35),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.75, s.h * 0.60, Math.sin(s.a) * spread * 0.75),
      new THREE.Vector3(Math.cos(s.a) * spread, s.h * 0.45, Math.sin(s.a) * spread), // droops
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.020, 4, false), stemMat));

    // Sub-branches — bare, no leaf tufts
    const forkCount = 2;
    for (let f = 0; f < forkCount; f++) {
      const forkT = 0.50 + f * 0.20;
      const forkPt = curve.getPoint(forkT);
      const forkA = s.a + (f - 1) * 0.45;
      const forkLen = 0.10 + Math.random() * 0.06;
      const forkCurve = new THREE.CatmullRomCurve3([
        forkPt,
        new THREE.Vector3(
          Math.cos(forkA) * (spread + forkLen * 0.6),
          forkPt.y + forkLen * 0.1, // barely rises — drooping
          Math.sin(forkA) * (spread + forkLen * 0.6),
        ),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 3, 0.008, 3, false), stemMat));
    }

    // One tiny brown remnant tuft on 2 stems only
    if (i === 1 || i === 5) {
      const tip = curve.getPoint(0.80);
      const tuft = new THREE.Mesh(
        jitter(new THREE.IcosahedronGeometry(0.018, 0), 0.003),
        mat(0x8a7a55),
      );
      tuft.position.set(tip.x, tip.y, tip.z);
      g.add(tuft);
    }
  }

  return g;
}
function buildMangroveDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying mangrove — stilt roots intact but grayed, canopy nearly gone, bare aerial roots
  const rootMat = mat(0x6a5a50);
  const rootMat2 = mat(0x5a4a40);

  // Central trunk
  addTrunk(g, 0, 0.40, 0, 0.07, 0.06, 0.20, 0x6a5a50);

  // 9 prop/stilt roots — same structure, grayed
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
  }

  // Tiny shrunken dying canopy — just 2 sparse brown clusters
  const deadColors = [0x7a6a4a, 0x8a7a55, 0x6a5a3a];
  addCanopy(g, 0.10, 0.70, 0.05, 0.15, deadColors[0]);
  addCanopy(g, -0.08, 0.68, -0.10, 0.13, deadColors[1]);

  // Bare branch stubs where canopy used to be
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.5;
    const stubLen = 0.12 + Math.random() * 0.06;
    const branchStub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.014, stubLen, 3), rootMat,
    );
    branchStub.position.set(Math.cos(a) * 0.12, 0.62, Math.sin(a) * 0.12);
    branchStub.rotation.z = Math.cos(a) * 0.6;
    branchStub.rotation.x = Math.sin(a) * 0.6;
    g.add(branchStub);
  }

  // Aerial roots still hanging — bare, gray
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.8;
    const edgeR = 0.30 + Math.random() * 0.06;
    const dropCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * edgeR, 0.55, Math.sin(a) * edgeR),
      new THREE.Vector3(Math.cos(a) * edgeR * 1.05, 0.28, Math.sin(a) * edgeR * 1.05),
      new THREE.Vector3(Math.cos(a) * edgeR * 0.95, 0.02, Math.sin(a) * edgeR * 0.95),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 5, 0.008, 3, false), rootMat2));
  }

  return g;
}
function buildFloweringShrubDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying hibiscus — exposed stems, sparse brown foliage, no flowers
  const stemMat = mat(0x5a5a4a);
  const deadColors = [0x7a6a4a, 0x8a7a55, 0x6a5a3a];

  // Multi-stem base — exposed, grayed
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 0.04 + Math.random() * 0.02;
    addTrunk(g, Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, r, r * 0.7, 0.35, 0x5a5a4a);

    // Bare branch stubs extending up from stems
    if (i % 2 === 0) {
      const stubH = 0.10;
      const branchStub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, stubH, 3), stemMat);
      branchStub.position.set(Math.cos(a) * 0.08, 0.35, Math.sin(a) * 0.08);
      branchStub.rotation.z = Math.cos(a) * 0.5;
      branchStub.rotation.x = Math.sin(a) * 0.5;
      g.add(branchStub);
    }
  }

  // Shrunken dying core — much smaller
  const coreGeo = new THREE.SphereGeometry(0.22, 8, 6);
  coreGeo.scale(1.1, 0.7, 1.1);
  const core = new THREE.Mesh(coreGeo, mat(0x4a4a3a));
  core.position.set(0, 0.45, 0);
  g.add(core);

  // Only 3 sparse brown leaf clusters
  addCanopy(g, 0.12, 0.48, 0.08, 0.14, deadColors[0]);
  addCanopy(g, -0.10, 0.42, -0.06, 0.12, deadColors[1]);
  addCanopy(g, 0.0, 0.52, -0.12, 0.10, deadColors[2]);

  // 2 shriveled dead flower heads — brown, flat
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.4;
    const dist = 0.28;
    const flGeo = new THREE.SphereGeometry(0.06, 4, 2);
    flGeo.scale(1, 0.25, 1);
    const fl = new THREE.Mesh(flGeo, mat(0x6a4a3a));
    fl.position.set(Math.cos(a) * dist, 0.40, Math.sin(a) * dist);
    g.add(fl);
  }

  return g;
}
function buildAromaticDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying lavender — shriveled mound, dead flower spike stubs, brown/gray
  const deadColors = [0x7a6a4a, 0x6a5a3a, 0x8a7a55];

  // Shrunken dying mound core — smaller and lower
  const coreGeo = new THREE.SphereGeometry(0.25, 8, 5);
  coreGeo.scale(1.2, 0.4, 1.2);
  const core = new THREE.Mesh(coreGeo, mat(0x5a5a4a));
  core.position.set(0, 0.14, 0);
  g.add(core);

  // Only 4 sparse brown surface blobs (from 10+5 healthy)
  addCanopy(g, 0.15, 0.14, 0.08, 0.12, deadColors[0]);
  addCanopy(g, -0.12, 0.12, -0.10, 0.10, deadColors[1]);
  addCanopy(g, 0.0, 0.16, -0.15, 0.09, deadColors[2]);
  addCanopy(g, -0.08, 0.15, 0.14, 0.10, deadColors[0]);

  // Dead flower spike stubs — brown, leaning, broken-looking (from 18 healthy)
  const stubMat = mat(0x6a5a4a);
  const stemMat = mat(0x6a6a5a);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.2;
    const dist = 0.06 + Math.random() * 0.18;
    const stemH = 0.10 + Math.random() * 0.05;
    // Short gray-brown stem
    const stemGeo = new THREE.CylinderGeometry(0.006, 0.008, stemH, 3);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(Math.cos(a) * dist, stemH / 2 + 0.18, Math.sin(a) * dist);
    stem.rotation.z = (Math.random() - 0.5) * 0.4; // leaning more
    stem.rotation.x = (Math.random() - 0.5) * 0.4;
    g.add(stem);
    // Shriveled brown spike head — smaller
    const spikeH = 0.05 + Math.random() * 0.03;
    const spikeGeo = new THREE.CylinderGeometry(0.018, 0.014, spikeH, 4);
    const spike = new THREE.Mesh(spikeGeo, stubMat);
    spike.position.set(Math.cos(a) * dist, stemH + 0.18 + spikeH / 2, Math.sin(a) * dist);
    spike.rotation.z = (Math.random() - 0.5) * 0.4;
    g.add(spike);
  }

  return g;
}

// ── Low-LOD dying builders ──

function buildEvergreenShrubDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Shrunken dying core
  const coreGeo = new THREE.SphereGeometry(0.30, 8, 6);
  coreGeo.scale(1.0, 0.55, 1.0);
  const core = new THREE.Mesh(coreGeo, mat(0x5a5a4a));
  core.position.set(0, 0.24, 0);
  g.add(core);
  // 3 sparse brown blobs
  addCanopy(g, 0.15, 0.26, 0.10, 0.18, 0x8a7a55);
  addCanopy(g, -0.20, 0.22, -0.05, 0.16, 0x7a6a4a);
  addCanopy(g, 0.05, 0.30, -0.18, 0.14, 0x6a5a3a);
  // 2 exposed stem stubs
  const stemMat = mat(0x6a6a5a);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.22, 3), stemMat);
    stem.position.set(Math.cos(a) * 0.08, 0.11, Math.sin(a) * 0.08);
    stem.rotation.z = Math.cos(a) * 0.2;
    g.add(stem);
  }
  return g;
}
function buildDeciduousShrubDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x6a6a5a);
  // 4 bare arching stems — drooping
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.2;
    const h = 0.9 + i * 0.1;
    const spread = 0.65;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.18, h * 0.40, Math.sin(a) * 0.18),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, h * 0.65, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.50, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.028, 4, false), stemMat));
  }
  // 2 tiny dead leaf clusters
  addCanopy(g, 0.35, 0.50, 0.20, 0.10, 0x8a7a55);
  addCanopy(g, -0.25, 0.45, -0.30, 0.10, 0x7a6a4a);
  return g;
}
function buildMediterraneanDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Dying flat core
  const coreGeo = new THREE.SphereGeometry(0.35, 8, 6);
  coreGeo.scale(1.0, 0.25, 1.0);
  const core = new THREE.Mesh(coreGeo, mat(0x5a5a4a));
  core.position.set(0, 0.16, 0);
  g.add(core);
  // 2 sparse brown blobs
  addCanopy(g, 0.18, 0.16, 0.10, 0.16, 0x8a7a55);
  addCanopy(g, -0.15, 0.14, -0.12, 0.14, 0x7a6a4a);
  // 3 exposed woody stems
  const woodMat = mat(0x7a7a6a);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    const h = 0.30;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03),
      new THREE.Vector3(Math.cos(a) * 0.10, h, Math.sin(a) * 0.10),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.025, 3, false), woodMat));
  }
  // 1 dead spike stub
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 3), mat(0x7a6a5a));
  spike.position.set(0.20, 0.22, 0.10);
  spike.rotation.z = 0.4;
  g.add(spike);
  return g;
}
function buildThornyDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const woodMat = mat(0x6a5a4a);
  const thornMat = mat(0xbbaa88);
  // 5 bare drooping branches
  const branchData = [
    { a: 0.0, h: 0.95, spread: 0.58 },
    { a: 1.25, h: 0.50, spread: 0.55 },
    { a: 2.50, h: 1.05, spread: 0.62 },
    { a: 3.75, h: 0.55, spread: 0.60 },
    { a: 5.00, h: 0.90, spread: 0.55 },
  ];
  for (let i = 0; i < branchData.length; i++) {
    const { a, h, spread } = branchData[i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * 0.14, h * 0.30, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * spread * 0.6, h * 0.55, Math.sin(a) * spread * 0.6),
      new THREE.Vector3(Math.cos(a) * spread, h * 0.40, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.032, 4, false), woodMat));
    // 1 thorn per branch
    const tPt = curve.getPoint(0.45);
    const side = i % 2 === 0 ? 1 : -1;
    const perpDir = a + side * Math.PI / 2;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 3), thornMat);
    spine.position.set(tPt.x, tPt.y, tPt.z);
    spine.lookAt(tPt.x + Math.cos(perpDir) * 0.4, tPt.y - 0.15, tPt.z + Math.sin(perpDir) * 0.4);
    g.add(spine);
  }
  return g;
}
function buildDesertShrubDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a7a6a);
  // 5 bare wiry stems — drooping
  const stemData = [
    { a: 0.0, h: 0.70, lean: 0.48 },
    { a: 1.3, h: 0.50, lean: 0.54 },
    { a: 2.5, h: 0.75, lean: 0.44 },
    { a: 3.8, h: 0.52, lean: 0.56 },
    { a: 5.1, h: 0.65, lean: 0.50 },
  ];
  for (const s of stemData) {
    const spread = s.lean * s.h * 0.85;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(s.a) * 0.03, 0, Math.sin(s.a) * 0.03),
      new THREE.Vector3(Math.cos(s.a) * spread * 0.4, s.h * 0.35, Math.sin(s.a) * spread * 0.4),
      new THREE.Vector3(Math.cos(s.a) * spread, s.h * 0.45, Math.sin(s.a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.018, 3, false), stemMat));
  }
  return g;
}
function buildMangroveDyingLow(): THREE.Group {
  const g = new THREE.Group();
  const rootMat = mat(0x6a5a50);
  // Trunk
  addTrunk(g, 0, 0.40, 0, 0.07, 0.06, 0.20, 0x6a5a50);
  // 4 stilt roots
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4 + 0.3;
    const sp = 0.5;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.48, 0),
      new THREE.Vector3(Math.cos(a) * sp * 0.4, 0.25, Math.sin(a) * sp * 0.4),
      new THREE.Vector3(Math.cos(a) * sp, -0.04, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.026, 4, false), rootMat));
  }
  // 2 tiny brown canopy blobs
  addCanopy(g, 0.08, 0.68, 0.05, 0.14, 0x7a6a4a);
  addCanopy(g, -0.06, 0.66, -0.08, 0.12, 0x8a7a55);
  // 2 bare branch stubs
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.8;
    const branchStub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.10, 3), rootMat);
    branchStub.position.set(Math.cos(a) * 0.10, 0.60, Math.sin(a) * 0.10);
    branchStub.rotation.z = Math.cos(a) * 0.5;
    branchStub.rotation.x = Math.sin(a) * 0.5;
    g.add(branchStub);
  }
  return g;
}
function buildFloweringShrubDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Exposed stem
  addTrunk(g, 0, 0, 0, 0.05, 0.04, 0.30, 0x5a5a4a);
  // Shrunken dying core
  const coreGeo = new THREE.SphereGeometry(0.22, 6, 4);
  coreGeo.scale(1.1, 0.7, 1.1);
  const core = new THREE.Mesh(coreGeo, mat(0x4a4a3a));
  core.position.set(0, 0.45, 0);
  g.add(core);
  // 2 brown leaf blobs
  addCanopy(g, 0.12, 0.48, 0.08, 0.14, 0x7a6a4a);
  addCanopy(g, -0.10, 0.42, -0.06, 0.12, 0x8a7a55);
  // 1 dead flower head
  const flGeo = new THREE.SphereGeometry(0.06, 3, 2);
  flGeo.scale(1, 0.25, 1);
  const fl = new THREE.Mesh(flGeo, mat(0x6a4a3a));
  fl.position.set(0.26, 0.40, 0.10);
  g.add(fl);
  return g;
}
function buildAromaticDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Shrunken dying mound
  const coreGeo = new THREE.SphereGeometry(0.25, 6, 4);
  coreGeo.scale(1.2, 0.4, 1.2);
  const core = new THREE.Mesh(coreGeo, mat(0x5a5a4a));
  core.position.set(0, 0.14, 0);
  g.add(core);
  // 2 brown blobs
  addCanopy(g, 0.12, 0.14, 0.06, 0.11, 0x7a6a4a);
  addCanopy(g, -0.10, 0.13, -0.08, 0.10, 0x6a5a3a);
  // 4 dead spike stubs
  const stubMat = mat(0x6a5a4a);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const dist = 0.06 + (i % 2) * 0.08;
    const spikeGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.06, 3);
    const spike = new THREE.Mesh(spikeGeo, stubMat);
    spike.position.set(Math.cos(a) * dist, 0.30, Math.sin(a) * dist);
    spike.rotation.z = (i % 2 === 0 ? 0.3 : -0.2);
    g.add(spike);
  }
  return g;
}

export const DYING_SHRUBS: Record<number, () => THREE.Group> = {
  12: buildEvergreenShrubDying,
  13: buildDeciduousShrubDying,
  14: buildMediterraneanDying,
  15: buildThornyDying,
  16: buildDesertShrubDying,
  17: buildMangroveDying,
  34: buildFloweringShrubDying,
  35: buildAromaticDying,
};

export const DYING_SHRUBS_LOW: Record<number, () => THREE.Group> = {
  12: buildEvergreenShrubDyingLow,
  13: buildDeciduousShrubDyingLow,
  14: buildMediterraneanDyingLow,
  15: buildThornyDyingLow,
  16: buildDesertShrubDyingLow,
  17: buildMangroveDyingLow,
  34: buildFloweringShrubDyingLow,
  35: buildAromaticDyingLow,
};

void jitter; void addCanopy; void addTrunk;
