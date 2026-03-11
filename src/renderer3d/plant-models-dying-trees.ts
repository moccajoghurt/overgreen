import * as THREE from 'three';
import { mat, matDS, addCanopy, addTrunk, jitter } from './plant-models';

// ── Dying tree variants: 60-70% foliage gone, strong droop, brown/gray palette ──
// Exposed trunk + fork, only 1-2 sparse leaf clusters, bare branch stubs
// Slots: Oak(6), Magnolia(7), Conifer(8), Tropical(9), Palm(10), Birch(11), Cypress(32), Acacia(33)

// ── Hi-LOD dying builders ──

function buildOakDying(): THREE.Group {
  const g = new THREE.Group();

  // Grayed bark — dying tree
  const barkColor = 0x5a5a4a;
  const flareGeo = new THREE.CylinderGeometry(0.18, 0.35, 0.25, 8);
  const flare = new THREE.Mesh(flareGeo, mat(0x4a4a3a));
  flare.position.y = 0.125;
  g.add(flare);
  addTrunk(g, 0, 0.25, 0, 0.18, 0.13, 0.45, barkColor);

  // Major fork — same structure, branches droop heavily
  const branchMat = mat(barkColor);
  const forks = [
    { a: 0.4, tilt: 0.8, len: 0.5, rBot: 0.1, rTop: 0.06 },
    { a: 2.5, tilt: 0.7, len: 0.45, rBot: 0.09, rTop: 0.055 },
    { a: 4.2, tilt: 0.75, len: 0.4, rBot: 0.08, rTop: 0.05 },
  ];
  for (const f of forks) {
    const geo = new THREE.CylinderGeometry(f.rTop, f.rBot, f.len, 6);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(f.a) * 0.08, 0.60, Math.sin(f.a) * 0.08);
    m.rotation.z = Math.cos(f.a) * f.tilt;
    m.rotation.x = Math.sin(f.a) * f.tilt;
    g.add(m);
  }

  // Bare branch stubs — thin cylinders radiating out where canopy used to be
  const stubMat = mat(0x6a6a5a);
  const stubAngles = [0.8, 1.8, 3.0, 4.5, 5.5];
  for (const sa of stubAngles) {
    const len = 0.2 + Math.random() * 0.15;
    const stubGeo = new THREE.CylinderGeometry(0.01, 0.025, len, 4);
    const s = new THREE.Mesh(stubGeo, stubMat);
    s.position.set(Math.cos(sa) * 0.35, 0.85 + Math.random() * 0.2, Math.sin(sa) * 0.35);
    s.rotation.z = Math.cos(sa) * 0.9;
    s.rotation.x = Math.sin(sa) * 0.9;
    g.add(s);
  }

  // Only 1-2 sparse leaf clusters — brown/dying palette
  const dyingColors = [0x8a7a55, 0x7a6a4a, 0x9a8a60];
  const dc = () => dyingColors[Math.floor(Math.random() * dyingColors.length)];

  // Single sparse cluster on one side
  addCanopy(g, 0.45, 0.95, 0.1, 0.25, dc());
  addCanopy(g, 0.55, 0.90, 0.2, 0.18, dc());
  // Second tiny cluster opposite
  addCanopy(g, -0.35, 1.0, -0.15, 0.18, dc());

  return g;
}
function buildMagnoliaDying(): THREE.Group {
  const g = new THREE.Group();

  // Pale bark grayed further
  const barkColor = 0x9a9a8a;
  const barkDark = 0x8a8a7a;
  const flareGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.2, 8);
  const flareMesh = new THREE.Mesh(flareGeo, mat(barkDark));
  flareMesh.position.y = 0.1;
  g.add(flareMesh);
  addTrunk(g, 0, 0.2, 0, 0.16, 0.11, 0.45, barkColor);

  // Low branches — exposed, drooping heavily
  const branchMat = mat(barkColor);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const geo = new THREE.CylinderGeometry(0.02, 0.055, 0.35, 5);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(a) * 0.08, 0.55, Math.sin(a) * 0.08);
    m.rotation.z = Math.cos(a) * 0.55;
    m.rotation.x = Math.sin(a) * 0.55;
    g.add(m);
  }

  // Bare branch stubs — 4 thin sticks radiating out
  const stubMat = mat(0x7a7a6a);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.8;
    const len = 0.18 + Math.random() * 0.12;
    const stubGeo = new THREE.CylinderGeometry(0.008, 0.02, len, 4);
    const s = new THREE.Mesh(stubGeo, stubMat);
    s.position.set(Math.cos(a) * 0.3, 1.0 + Math.random() * 0.2, Math.sin(a) * 0.3);
    s.rotation.z = Math.cos(a) * 0.7;
    s.rotation.x = Math.sin(a) * 0.7;
    g.add(s);
  }

  // Only 2 sparse dying leaf clusters — brown palette
  const dyingColors = [0x8a7a55, 0x7a6a4a, 0x6a5a3a];
  const dc = () => dyingColors[Math.floor(Math.random() * dyingColors.length)];

  addCanopy(g, 0.15, 1.1, 0.2, 0.25, dc());
  addCanopy(g, -0.1, 1.2, -0.1, 0.2, dc());
  // Tiny remnant at top
  addCanopy(g, 0, 1.35, 0, 0.15, dc());

  return g;
}
function buildConiferDying(): THREE.Group {
  const g = new THREE.Group();

  // Trunk fully exposed — grayed bark
  addTrunk(g, 0, 0, 0, 0.08, 0.04, 1.8, 0x6a5a4a);

  // Bare branch stubs along trunk — where tiers used to be
  const stubMat = mat(0x6a6a5a);
  for (let i = 0; i < 5; i++) {
    const y = 0.4 + i * 0.3;
    const a = (i / 5) * Math.PI * 2 + 0.5;
    const len = 0.25 - i * 0.03;
    const stubGeo = new THREE.CylinderGeometry(0.008, 0.02, len, 4);
    const s = new THREE.Mesh(stubGeo, stubMat);
    s.position.set(Math.cos(a) * 0.06, y, Math.sin(a) * 0.06);
    s.rotation.z = Math.cos(a) * 0.7;
    s.rotation.x = Math.sin(a) * 0.7;
    g.add(s);
    // Opposite side stub
    const a2 = a + Math.PI;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.015, len * 0.8, 4), stubMat);
    s2.position.set(Math.cos(a2) * 0.06, y + 0.05, Math.sin(a2) * 0.06);
    s2.rotation.z = Math.cos(a2) * 0.6;
    s2.rotation.x = Math.sin(a2) * 0.6;
    g.add(s2);
  }

  // Only 2 sparse dying tiers near bottom — brown cones
  const dyingColor = 0x7a6a4a;
  const dyingDark = 0x6a5a3a;
  for (let i = 0; i < 2; i++) {
    const y = 0.35 + i * 0.28;
    const r = 0.5 - i * 0.1;
    const h = 0.25;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(dyingColor));
    cone.position.set(0, y, 0);
    g.add(cone);
    // 3 sparse droop cones
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + i * 0.6;
      const droop = new THREE.Mesh(
        new THREE.ConeGeometry(r * 0.25, h * 0.5, 4),
        mat(dyingDark),
      );
      droop.position.set(Math.cos(a) * r * 0.4, y - h * 0.2, Math.sin(a) * r * 0.4);
      droop.rotation.z = Math.cos(a) * 0.3;
      droop.rotation.x = Math.sin(a) * 0.3;
      g.add(droop);
    }
  }

  // Dead spire at top — brown/gray
  const spireGeo = new THREE.ConeGeometry(0.06, 0.2, 5);
  const spire = new THREE.Mesh(spireGeo, mat(0x8a7a55));
  spire.position.set(0, 1.75, 0);
  g.add(spire);

  return g;
}
function buildTropicalDying(): THREE.Group {
  const g = new THREE.Group();

  // Buttress roots — grayed
  const buttMat = mat(0x5a5a4a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    const geo = new THREE.BoxGeometry(0.08, 0.5, 0.22);
    const m = new THREE.Mesh(geo, buttMat);
    m.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
    m.rotation.y = a;
    g.add(m);
  }
  // Main trunk — grayed bark
  addTrunk(g, 0, 0, 0, 0.16, 0.1, 1.1, 0x6a6a5a);

  // Bare branch stubs — where the lush canopy used to be
  const stubMat = mat(0x6a6a5a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const len = 0.2 + Math.random() * 0.12;
    const stubGeo = new THREE.CylinderGeometry(0.008, 0.022, len, 4);
    const s = new THREE.Mesh(stubGeo, stubMat);
    s.position.set(Math.cos(a) * 0.2, 1.3 + Math.random() * 0.2, Math.sin(a) * 0.2);
    s.rotation.z = Math.cos(a) * 0.8;
    s.rotation.x = Math.sin(a) * 0.8;
    g.add(s);
  }

  // Only 2 sparse dying leaf clusters
  const dyingColors = [0x8a7a55, 0x7a6a4a, 0x6a5a3a];
  const dc = () => dyingColors[Math.floor(Math.random() * dyingColors.length)];

  addCanopy(g, 0.3, 1.45, 0.15, 0.3, dc());
  addCanopy(g, -0.2, 1.5, -0.2, 0.25, dc());
  // Tiny remnant at top
  addCanopy(g, 0.05, 1.65, 0, 0.18, dc());

  // Dead hanging vines — brown
  const vineMat = mat(0x7a6a4a);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const dist = 0.3;
    const len = 0.25 + Math.random() * 0.1;
    const vine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.015, len, 3),
      vineMat,
    );
    vine.position.set(Math.cos(a) * dist, 1.15 - len / 2, Math.sin(a) * dist);
    g.add(vine);
  }

  return g;
}
function buildPalmDying(): THREE.Group {
  const g = new THREE.Group();

  // Curved trunk — same shape, grayed
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.5, 0.03),
    new THREE.Vector3(0.1, 1.1, 0),
    new THREE.Vector3(0.07, 1.6, -0.02),
    new THREE.Vector3(0.04, 2.0, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.065, 6, false), mat(0x8a7a6a)));
  // Rings
  const ringMat = mat(0x7a6a5a);
  for (let ri = 1; ri < 10; ri++) {
    const pt = curve.getPoint(ri / 10);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 4, 8), ringMat);
    ring.position.copy(pt);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  // Dead crown shaft — brown
  const shaftGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.15, 6);
  const shaft = new THREE.Mesh(shaftGeo, mat(0x7a6a4a));
  shaft.position.set(0.04, 2.05, 0);
  g.add(shaft);

  const topY = 2.1, topX = 0.04;

  // Only 3 sparse dying fronds — brown, heavily drooping
  const dyingMat = matDS(0x8a7a55);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const fLen = 0.8;
    const fWidth = 0.25;
    const fGeo = new THREE.PlaneGeometry(fWidth, fLen, 2, 10);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.7 * t));
      // Heavy droop — barely arches, hangs down
      fPos.setY(vi, t * 0.15 - t * t * fLen * 0.6);
      fPos.setZ(vi, t * fLen * 0.6);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, dyingMat);
    frond.position.set(topX, topY, 0);
    frond.rotation.y = a;
    g.add(frond);
  }

  // 5 dead hanging fronds — brown, hanging straight down
  const deadMat = matDS(0x7a6a4a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    const fLen = 0.7;
    const fGeo = new THREE.PlaneGeometry(0.12, fLen, 1, 6);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.5 * t));
      fPos.setY(vi, -t * fLen * 0.8);
      fPos.setZ(vi, t * fLen * 0.2);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, deadMat);
    frond.position.set(topX, topY - 0.05, 0);
    frond.rotation.y = a;
    g.add(frond);
  }

  return g;
}
function buildBirchDying(): THREE.Group {
  const g = new THREE.Group();

  // White bark — still birch's signature, slightly grayed
  const barkWhite = 0xe8e4dd;
  addTrunk(g, 0, 0, 0, 0.06, 0.035, 0.9, barkWhite);

  // Lenticular patches — birch identity
  const lenticelMat = mat(0x443322);
  for (let pi = 0; pi < 8; pi++) {
    const pa = (pi / 8) * Math.PI * 2 + Math.random() * 0.3;
    const py = 0.15 + pi * 0.1 + Math.random() * 0.05;
    const pw = 0.06 + Math.random() * 0.04;
    const ph = 0.018 + Math.random() * 0.01;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), lenticelMat);
    patch.position.set(Math.cos(pa) * 0.05, py, Math.sin(pa) * 0.05);
    patch.rotation.y = pa;
    g.add(patch);
  }

  // Exposed branches — white bark, drooping heavily
  const brMat = mat(0xd8d0c8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random() * 0.4;
    const y = 0.45 + i * 0.12;
    const len = 0.3 + Math.random() * 0.15;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.018, len, 4), brMat);
    branch.position.set(Math.cos(a) * 0.06, y + len * 0.25, Math.sin(a) * 0.06);
    branch.rotation.z = Math.cos(a) * 0.6;
    branch.rotation.x = Math.sin(a) * 0.6;
    g.add(branch);
  }

  // Bare branch stubs higher up — thin twigs
  const stubMat = mat(0xc8c0b8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.7;
    const len = 0.15 + Math.random() * 0.1;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.01, len, 3), stubMat);
    s.position.set(Math.cos(a) * 0.2, 1.1 + Math.random() * 0.3, Math.sin(a) * 0.2);
    s.rotation.z = Math.cos(a) * 0.8;
    s.rotation.x = Math.sin(a) * 0.8;
    g.add(s);
  }

  // Only 2 sparse dying leaf clusters — brown/olive
  addCanopy(g, 0.15, 1.2, 0.1, 0.2, 0x8a7a55);
  addCanopy(g, -0.1, 1.0, -0.12, 0.18, 0x9a8a60);

  return g;
}
function buildCypressDying(): THREE.Group {
  const g = new THREE.Group();

  // Trunk fully exposed — grayed, taller since foliage is gone
  addTrunk(g, 0, 0, 0, 0.07, 0.035, 2.5, 0x5a5a4a);

  // Bare branch stubs along the column — where dense foliage used to be
  const stubMat = mat(0x6a6a5a);
  for (let i = 0; i < 8; i++) {
    const y = 0.4 + i * 0.25;
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const len = 0.12 + Math.random() * 0.08;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.015, len, 4), stubMat);
    s.position.set(Math.cos(a) * 0.05, y, Math.sin(a) * 0.05);
    s.rotation.z = Math.cos(a) * 0.6;
    s.rotation.x = Math.sin(a) * 0.6;
    g.add(s);
  }

  // Only 3 sparse dying foliage patches clinging to trunk — brown/gray
  const dyingColors = [0x7a6a4a, 0x6a5a3a, 0x8a7a55];
  // Low patch
  addCanopy(g, 0.08, 0.6, 0.05, 0.18, dyingColors[0]);
  // Mid patch
  addCanopy(g, -0.05, 1.2, 0.06, 0.15, dyingColors[1]);
  // Upper patch
  addCanopy(g, 0.04, 1.8, -0.04, 0.12, dyingColors[2]);

  // Dead pointed tip — brown cone
  const tipGeo = new THREE.ConeGeometry(0.06, 0.18, 5);
  const tip = new THREE.Mesh(tipGeo, mat(0x6a5a3a));
  tip.position.set(0, 2.55, 0);
  g.add(tip);

  return g;
}
function buildAcaciaDying(): THREE.Group {
  const g = new THREE.Group();

  const barkColor = 0x6a5a4a;
  const barkDark = 0x5a4a3a;

  // Root flare
  const flareGeo = new THREE.CylinderGeometry(0.10, 0.18, 0.15, 7);
  const flare = new THREE.Mesh(flareGeo, mat(barkDark));
  flare.position.y = 0.075;
  g.add(flare);

  // Main trunk — grayed
  addTrunk(g, 0, 0.15, 0, 0.10, 0.07, 0.6, barkColor);

  // Major forking branches — fully exposed, defining acacia silhouette
  const branchMat = mat(barkColor);
  const forks = [
    { a: 0.3, tilt: 0.9, len: 0.55, rBot: 0.05, rTop: 0.025 },
    { a: 1.8, tilt: 0.85, len: 0.50, rBot: 0.045, rTop: 0.022 },
    { a: 3.2, tilt: 0.95, len: 0.58, rBot: 0.05, rTop: 0.025 },
    { a: 4.6, tilt: 0.80, len: 0.48, rBot: 0.04, rTop: 0.020 },
    { a: 5.8, tilt: 0.88, len: 0.52, rBot: 0.045, rTop: 0.022 },
  ];
  for (const f of forks) {
    const geo = new THREE.CylinderGeometry(f.rTop, f.rBot, f.len, 5);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(f.a) * 0.06, 0.7, Math.sin(f.a) * 0.06);
    m.rotation.z = Math.cos(f.a) * f.tilt;
    m.rotation.x = Math.sin(f.a) * f.tilt;
    g.add(m);
  }

  // Bare branch stubs at branch tips — thin twigs pointing up/out
  const stubMat = mat(0x6a6a5a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    const dist = 0.45 + Math.random() * 0.1;
    const len = 0.12 + Math.random() * 0.08;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.012, len, 3), stubMat);
    s.position.set(Math.cos(a) * dist, 0.95 + Math.random() * 0.1, Math.sin(a) * dist);
    s.rotation.z = Math.cos(a) * 0.4;
    s.rotation.x = Math.sin(a) * 0.4;
    g.add(s);
  }

  // Only 2 sparse flat dying canopy patches — brown palette
  const dyingColors = [0x8a7a55, 0x7a6a4a, 0x6a5a3a];
  const dc = () => dyingColors[Math.floor(Math.random() * dyingColors.length)];

  // Sparse flat patches where umbrella used to be
  addCanopy(g, 0.35, 0.95, 0.1, 0.2, dc());
  addCanopy(g, -0.25, 0.92, -0.2, 0.18, dc());
  // Tiny remnant center
  addCanopy(g, 0.05, 0.98, 0.05, 0.15, dc());

  return g;
}

// ── Low-LOD dying builders ──

function buildOakDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Trunk + flare
  addTrunk(g, 0, 0, 0, 0.18, 0.13, 0.6, 0x5a5a4a);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.2, 6), mat(0x4a4a3a));
  flare.position.y = 0.1;
  g.add(flare);
  // 2 bare branch stubs
  const stubMat = mat(0x6a6a5a);
  for (const a of [0.8, 3.5]) {
    const geo = new THREE.CylinderGeometry(0.01, 0.025, 0.25, 3);
    const s = new THREE.Mesh(geo, stubMat);
    s.position.set(Math.cos(a) * 0.3, 0.85, Math.sin(a) * 0.3);
    s.rotation.z = Math.cos(a) * 0.9;
    s.rotation.x = Math.sin(a) * 0.9;
    g.add(s);
  }
  // 2 sparse dying leaf clusters
  addCanopy(g, 0.45, 0.95, 0.1, 0.25, 0x8a7a55);
  addCanopy(g, -0.35, 1.0, -0.15, 0.18, 0x7a6a4a);
  return g;
}
function buildMagnoliaDyingLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.16, 0.11, 0.5, 0x9a9a8a);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 6), mat(0x8a8a7a));
  flare.position.y = 0.1;
  g.add(flare);
  // 2 bare branch stubs
  const stubMat = mat(0x7a7a6a);
  for (const a of [1.0, 4.0]) {
    const geo = new THREE.CylinderGeometry(0.008, 0.02, 0.22, 3);
    const s = new THREE.Mesh(geo, stubMat);
    s.position.set(Math.cos(a) * 0.28, 1.05, Math.sin(a) * 0.28);
    s.rotation.z = Math.cos(a) * 0.7;
    s.rotation.x = Math.sin(a) * 0.7;
    g.add(s);
  }
  // 2 sparse dying leaf clusters
  addCanopy(g, 0.15, 1.1, 0.2, 0.25, 0x8a7a55);
  addCanopy(g, -0.1, 1.25, -0.1, 0.18, 0x7a6a4a);
  return g;
}
function buildConiferDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Tall bare trunk
  addTrunk(g, 0, 0, 0, 0.08, 0.04, 1.8, 0x6a5a4a);
  // 2 sparse dying tiers at bottom
  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.25, 5), mat(0x7a6a4a));
  cone1.position.set(0, 0.35, 0);
  g.add(cone1);
  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.25, 5), mat(0x6a5a3a));
  cone2.position.set(0, 0.63, 0);
  g.add(cone2);
  // Dead spire
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), mat(0x8a7a55));
  spire.position.set(0, 1.75, 0);
  g.add(spire);
  return g;
}
function buildTropicalDyingLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.16, 0.1, 1.1, 0x6a6a5a);
  // 2 buttress roots
  const buttMat = mat(0x5a5a4a);
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 0.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.22), buttMat);
    m.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
    m.rotation.y = a;
    g.add(m);
  }
  // 2 sparse dying canopy blobs
  addCanopy(g, 0.3, 1.45, 0.15, 0.3, 0x8a7a55);
  addCanopy(g, -0.2, 1.5, -0.2, 0.25, 0x7a6a4a);
  addCanopy(g, 0.05, 1.65, 0, 0.18, 0x6a5a3a);
  return g;
}
function buildPalmDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Curved trunk — fewer segments
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.5, 0.03),
    new THREE.Vector3(0.1, 1.1, 0),
    new THREE.Vector3(0.07, 1.6, -0.02),
    new THREE.Vector3(0.04, 2.0, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.065, 4, false), mat(0x8a7a6a)));
  // Dead crown shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.15, 5), mat(0x7a6a4a));
  shaft.position.set(0.04, 2.05, 0);
  g.add(shaft);
  const topY = 2.1, topX = 0.04;
  // 3 dying fronds — heavy droop
  const dyingMat = matDS(0x8a7a55);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const fLen = 0.8;
    const fGeo = new THREE.PlaneGeometry(0.25, fLen, 1, 6);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.7 * t));
      fPos.setY(vi, t * 0.15 - t * t * fLen * 0.6);
      fPos.setZ(vi, t * fLen * 0.6);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, dyingMat);
    frond.position.set(topX, topY, 0);
    frond.rotation.y = a;
    g.add(frond);
  }
  // 3 dead hanging fronds
  const deadMat = matDS(0x7a6a4a);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 1.2;
    const fLen = 0.6;
    const fGeo = new THREE.PlaneGeometry(0.12, fLen, 1, 4);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.5 * t));
      fPos.setY(vi, -t * fLen * 0.8);
      fPos.setZ(vi, t * fLen * 0.2);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, deadMat);
    frond.position.set(topX, topY - 0.05, 0);
    frond.rotation.y = a;
    g.add(frond);
  }
  return g;
}
function buildBirchDyingLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.06, 0.035, 0.9, 0xe8e4dd);
  // 2 exposed branches
  const brMat = mat(0xd8d0c8);
  for (const a of [0.8, 3.5]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.016, 0.3, 3), brMat);
    branch.position.set(Math.cos(a) * 0.06, 0.65, Math.sin(a) * 0.06);
    branch.rotation.z = Math.cos(a) * 0.6;
    branch.rotation.x = Math.sin(a) * 0.6;
    g.add(branch);
  }
  // 2 bare twig stubs
  const stubMat = mat(0xc8c0b8);
  for (const a of [1.5, 4.8]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.01, 0.15, 3), stubMat);
    s.position.set(Math.cos(a) * 0.18, 1.2, Math.sin(a) * 0.18);
    s.rotation.z = Math.cos(a) * 0.8;
    s.rotation.x = Math.sin(a) * 0.8;
    g.add(s);
  }
  // 2 sparse dying leaf clusters
  addCanopy(g, 0.15, 1.2, 0.1, 0.2, 0x8a7a55);
  addCanopy(g, -0.1, 1.0, -0.12, 0.18, 0x9a8a60);
  return g;
}
function buildCypressDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Tall bare trunk
  addTrunk(g, 0, 0, 0, 0.07, 0.035, 2.5, 0x5a5a4a);
  // 3 sparse dying foliage patches
  addCanopy(g, 0.08, 0.6, 0.05, 0.18, 0x7a6a4a);
  addCanopy(g, -0.05, 1.2, 0.06, 0.15, 0x6a5a3a);
  addCanopy(g, 0.04, 1.8, -0.04, 0.12, 0x8a7a55);
  // Dead tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), mat(0x6a5a3a));
  tip.position.set(0, 2.55, 0);
  g.add(tip);
  return g;
}
function buildAcaciaDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying acacia — trunk + flare + 3 exposed branches + 2 brown patches
  const barkColor = 0x6a5a4a;
  addTrunk(g, 0, 0.15, 0, 0.10, 0.07, 0.6, barkColor);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 0.15, 5), mat(0x5a4a3a));
  flare.position.y = 0.075;
  g.add(flare);
  // 3 spreading branches
  const branchMat = mat(barkColor);
  for (const a of [0.3, 2.2, 4.2]) {
    const geo = new THREE.CylinderGeometry(0.02, 0.045, 0.5, 4);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(a) * 0.06, 0.7, Math.sin(a) * 0.06);
    m.rotation.z = Math.cos(a) * 0.9;
    m.rotation.x = Math.sin(a) * 0.9;
    g.add(m);
  }
  // 2 sparse dying patches
  addCanopy(g, 0.3, 0.92, 0.1, 0.18, 0x8a7a55);
  addCanopy(g, -0.2, 0.90, -0.15, 0.15, 0x7a6a4a);
  return g;
}

export const DYING_TREES: Record<number, () => THREE.Group> = {
  6: buildOakDying,
  7: buildMagnoliaDying,
  8: buildConiferDying,
  9: buildTropicalDying,
  10: buildPalmDying,
  11: buildBirchDying,
  32: buildCypressDying,
  33: buildAcaciaDying,
};

export const DYING_TREES_LOW: Record<number, () => THREE.Group> = {
  6: buildOakDyingLow,
  7: buildMagnoliaDyingLow,
  8: buildConiferDyingLow,
  9: buildTropicalDyingLow,
  10: buildPalmDyingLow,
  11: buildBirchDyingLow,
  32: buildCypressDyingLow,
  33: buildAcaciaDyingLow,
};

void jitter; void addCanopy; void addTrunk;
