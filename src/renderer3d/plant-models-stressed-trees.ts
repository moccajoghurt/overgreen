import * as THREE from 'three';
import { mat, matDS, addCanopy, addTrunk, jitter } from './plant-models';

// ── Stressed tree variants: 30% foliage removed, slight droop, yellow-olive palette ──
// Slots: Oak(6), Magnolia(7), Conifer(8), Tropical(9), Palm(10), Birch(11), Cypress(32), Acacia(33)

// ── Hi-LOD stressed builders ──

function buildOakStressed(): THREE.Group {
  const g = new THREE.Group();

  // Trunk and root flare — same as healthy, slightly grayer bark
  const flareGeo = new THREE.CylinderGeometry(0.18, 0.35, 0.25, 8);
  const flare = new THREE.Mesh(flareGeo, mat(0x4a2a10));
  flare.position.y = 0.125;
  g.add(flare);
  addTrunk(g, 0, 0.25, 0, 0.18, 0.13, 0.45, 0x5a3a1a);

  // Major fork — same structure, branches droop slightly more outward
  const branchMat = mat(0x5a3a1a);
  const forks = [
    { a: 0.4, tilt: 0.8, len: 0.5, rBot: 0.1, rTop: 0.06 },
    { a: 2.5, tilt: 0.7, len: 0.45, rBot: 0.09, rTop: 0.055 },
    { a: 4.2, tilt: 0.75, len: 0.4, rBot: 0.08, rTop: 0.05 },
  ];
  for (const f of forks) {
    const geo = new THREE.CylinderGeometry(f.rTop, f.rBot, f.len, 6);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(f.a) * 0.08, 0.62, Math.sin(f.a) * 0.08);
    m.rotation.z = Math.cos(f.a) * f.tilt;
    m.rotation.x = Math.sin(f.a) * f.tilt;
    g.add(m);
  }

  // Stressed canopy — yellow-olive palette, ~30% fewer spheres
  const canopyColors = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Only 3 lobes instead of 5 — gaps show stress
  const lobes = [
    { cx: 0.55, cz: 0.15, cy: 1.0, size: 0.38 },
    { cx: -0.5, cz: -0.2, cy: 1.05, size: 0.35 },
    { cx: -0.15, cz: -0.5, cy: 1.0, size: 0.33 },
  ];
  for (const lobe of lobes) {
    addCanopy(g, lobe.cx, lobe.cy, lobe.cz, lobe.size, cc());
    // Only 2 satellite spheres per lobe instead of 3
    for (let j = 0; j < 2; j++) {
      const a = (j / 2) * Math.PI * 2 + Math.random() * 0.5;
      const d = lobe.size * 0.5;
      addCanopy(g,
        lobe.cx + Math.cos(a) * d,
        lobe.cy + (Math.random() - 0.4) * 0.12,
        lobe.cz + Math.sin(a) * d,
        lobe.size * (0.5 + Math.random() * 0.12), cc());
    }
  }

  // Outer reach — only 5 instead of 8, drooped down
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const dist = 0.65 + Math.random() * 0.1;
    addCanopy(g, Math.cos(a) * dist, 0.88 + Math.random() * 0.15, Math.sin(a) * dist,
      0.25 + Math.random() * 0.08, cc());
  }

  // Top cap — lower, sparser
  addCanopy(g, 0, 1.28, 0, 0.3, cc());

  // Reduced inner fill — only 5 instead of 10
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const dist = 0.2 + Math.random() * 0.25;
    const y = 0.85 + Math.random() * 0.25;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.22 + Math.random() * 0.08, cc());
  }

  // Reduced bottom skirt — only 4
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.35, 0.78, Math.sin(a) * 0.35, 0.2, cc());
  }

  return g;
}
function buildMagnoliaStressed(): THREE.Group {
  const g = new THREE.Group();

  // Pale silvery-gray bark — slightly grayer for stress
  const barkColor = 0xb0a090;
  const barkDark = 0xa09080;
  const flareGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.2, 8);
  const flareMesh = new THREE.Mesh(flareGeo, mat(barkDark));
  flareMesh.position.y = 0.1;
  g.add(flareMesh);
  addTrunk(g, 0, 0.2, 0, 0.16, 0.11, 0.45, barkColor);

  // Low branching — same structure, slightly more outward tilt
  const branchMat = mat(barkColor);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const geo = new THREE.CylinderGeometry(0.025, 0.06, 0.35, 5);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(a) * 0.08, 0.57, Math.sin(a) * 0.08);
    m.rotation.z = Math.cos(a) * 0.5;
    m.rotation.x = Math.sin(a) * 0.5;
    g.add(m);
  }

  // Stressed canopy — yellow-olive, fewer spheres
  const canopyColors = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Core mass — egg shape, drooped down ~10%
  addCanopy(g, 0, 1.05, 0, 0.5, cc());
  addCanopy(g, 0, 1.22, 0, 0.45, cc());
  addCanopy(g, 0, 0.88, 0, 0.45, cc());

  // Only 2 tiers instead of 3, with fewer blobs per tier
  for (let tier = 0; tier < 2; tier++) {
    const y = 0.8 + tier * 0.28;
    const tierR = 0.48 - tier * 0.05;
    const count = 5; // was 7
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tier * 0.4;
      const dist = tierR * (0.5 + Math.random() * 0.3);
      const r = 0.22 + Math.random() * 0.08;
      addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, r, cc());
    }
  }

  // Reduced inner fill — 4 instead of 8
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.2;
    const dist = 0.12 + Math.random() * 0.18;
    const y = 0.85 + Math.random() * 0.35;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.2 + Math.random() * 0.06, cc());
  }

  // Top cap — lower
  addCanopy(g, 0, 1.4, 0, 0.32, cc());

  // Bottom skirt — 3 instead of 5
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.28, 0.7, Math.sin(a) * 0.28, 0.2, cc());
  }

  // NO flowers — removed entirely for stressed state

  return g;
}
function buildConiferStressed(): THREE.Group {
  const g = new THREE.Group();

  // Trunk — same reddish-brown
  addTrunk(g, 0, 0, 0, 0.08, 0.05, 0.4, 0x8a5a3a);

  // Stressed tier palette — yellow-olive gradient
  const tierPalette = [
    0x7a8a3a, // tier 0 — darkest olive
    0x84943e,
    0x8e9e42,
    0x99aa44, // tier 3 — mid
    0xa0a840,
    0xaaaa55,
    0xb0b05a, // tier 6 — lightest
  ];
  const undersidePalette = [
    0x6a7a30, 0x748438, 0x7e8e3c, 0x88993a, 0x929e3e, 0x99aa44, 0xa0a840,
  ];

  // All 7 tiers but smaller radii (~80%), no inner fill, fewer droops
  const tierCount = 7;
  for (let i = 0; i < tierCount; i++) {
    const t = i / (tierCount - 1);
    const y = 0.28 + i * 0.28;
    const r = 0.7 - i * 0.09; // smaller than healthy (0.8 - i*0.1)
    const h = 0.30 + (1 - t) * 0.08;
    const tierColor = tierPalette[i];
    const underColor = undersidePalette[i];

    // Main tier cone
    const coneGeo = new THREE.ConeGeometry(r, h, 8);
    const cone = new THREE.Mesh(coneGeo, mat(tierColor));
    cone.position.set(0, y, 0);
    g.add(cone);

    // Fewer droop cones — 3 per tier instead of 5-8, drooping more
    const droopCount = 3;
    for (let j = 0; j < droopCount; j++) {
      const a = (j / droopCount) * Math.PI * 2 + i * 0.4;
      const droopR = r * 0.3;
      const droopH = h * 0.55;
      const droopGeo = new THREE.ConeGeometry(droopR, droopH, 5);
      const droop = new THREE.Mesh(droopGeo, mat(underColor));
      droop.position.set(
        Math.cos(a) * r * 0.5,
        y - h * 0.28,
        Math.sin(a) * r * 0.5,
      );
      droop.rotation.z = Math.cos(a) * 0.35;
      droop.rotation.x = Math.sin(a) * 0.35;
      g.add(droop);
    }

    // No inner fill cones — sparser appearance
  }

  // Top spire — duller color
  const topY = 0.28 + (tierCount - 1) * 0.28;
  const spireGeo = new THREE.ConeGeometry(0.13, 0.3, 6);
  const spire = new THREE.Mesh(spireGeo, mat(0xb0b888));
  spire.position.set(0, topY + 0.12, 0);
  g.add(spire);

  return g;
}
function buildTropicalStressed(): THREE.Group {
  const g = new THREE.Group();

  // Trunk and buttress roots — preserved, slightly grayer
  const trunkColor = 0x7a6a5a;
  const buttMat = mat(0x6a5a4a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    const geo = new THREE.BoxGeometry(0.08, 0.5, 0.22);
    const m = new THREE.Mesh(geo, buttMat);
    m.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
    m.rotation.y = a;
    g.add(m);
  }
  addTrunk(g, 0, 0, 0, 0.16, 0.1, 1.1, trunkColor);

  // Stressed canopy — yellow-olive, sparser
  const canopyColors = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Core mass — drooped down ~10%, smaller
  addCanopy(g, 0, 1.42, 0, 0.55, cc());
  addCanopy(g, 0, 1.28, 0, 0.5, cc());

  // Fewer spreading lobes — 6 instead of 10, drooped
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dist = 0.55 + Math.random() * 0.1;
    const y = 1.22 + Math.random() * 0.2;
    const r = 0.32 + Math.random() * 0.1;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, r, cc());
  }

  // Reduced fill layer — 4 instead of 8
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const dist = 0.25 + Math.random() * 0.2;
    const y = 1.25 + Math.random() * 0.2;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.26 + Math.random() * 0.08, cc());
  }

  // No sun-bleached top — just a single dull cap
  addCanopy(g, 0, 1.6, 0, 0.32, 0xa0a840);

  // Reduced bottom skirt — 3 instead of 6
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.3, 1.02, Math.sin(a) * 0.3, 0.22, cc());
  }

  // No vines/epiphytes — stressed trees lose these first

  return g;
}
function buildPalmStressed(): THREE.Group {
  const g = new THREE.Group();

  // Curved trunk — same as healthy
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.5, 0.03),
    new THREE.Vector3(0.1, 1.1, 0),
    new THREE.Vector3(0.07, 1.6, -0.02),
    new THREE.Vector3(0.04, 2.0, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.065, 6, false), mat(0x9a8a7a)));
  // Rings
  const ringMat = mat(0x8a7a6a);
  for (let ri = 1; ri < 10; ri++) {
    const pt = curve.getPoint(ri / 10);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 4, 8), ringMat);
    ring.position.copy(pt);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  // Crown shaft — yellowed
  const shaftGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.15, 6);
  const shaft = new THREE.Mesh(shaftGeo, mat(0x88993a));
  shaft.position.set(0.04, 2.05, 0);
  g.add(shaft);

  // Stressed fronds — 8 instead of 12, yellow-olive, droopier
  const frondColors = [matDS(0x99aa44), matDS(0x88993a), matDS(0xaaaa55), matDS(0xa0a840)];
  const fc = () => frondColors[Math.floor(Math.random() * frondColors.length)];
  const topY = 2.1, topX = 0.04;
  const frondCount = 8;

  for (let i = 0; i < frondCount; i++) {
    const a = (i / frondCount) * Math.PI * 2;
    const fLen = 0.85 + Math.random() * 0.2; // shorter
    const fWidth = 0.25 + Math.random() * 0.06; // narrower

    // Single blade only — no cross blade for stressed
    const fGeo = new THREE.PlaneGeometry(fWidth, fLen, 2, 12);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.7 * t));
      // More droop — heavier cubic term
      fPos.setY(vi, t * 0.2 - t * t * t * fLen * 0.7);
      fPos.setZ(vi, t * fLen * 0.75);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, fc());
    frond.position.set(topX, topY, 0);
    frond.rotation.y = a;
    g.add(frond);
  }

  // More dead/brown fronds — 5 instead of 3
  const deadMat = matDS(0x887744);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.8;
    const fLen = 0.55;
    const fGeo = new THREE.PlaneGeometry(0.13, fLen, 1, 6);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.5 * t));
      fPos.setY(vi, -t * fLen * 0.75);
      fPos.setZ(vi, t * fLen * 0.25);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, deadMat);
    frond.position.set(topX, topY - 0.1, 0);
    frond.rotation.y = a;
    g.add(frond);
  }

  // No coconuts — stressed palms drop fruit

  return g;
}
function buildBirchStressed(): THREE.Group {
  const g = new THREE.Group();

  // White bark — same signature look
  const barkWhite = 0xf0ece6;
  addTrunk(g, 0, 0, 0, 0.06, 0.035, 0.9, barkWhite);

  // Lenticel patches — same
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

  // Visible branches — more exposed due to sparse canopy
  const brMat = mat(0xe0d8d0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.random() * 0.4;
    const y = 0.5 + i * 0.12;
    const len = 0.25 + Math.random() * 0.15;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.02, len, 4), brMat);
    branch.position.set(Math.cos(a) * 0.06, y + len * 0.3, Math.sin(a) * 0.06);
    branch.rotation.z = Math.cos(a) * 0.55;
    branch.rotation.x = Math.sin(a) * 0.55;
    g.add(branch);
  }

  // Stressed canopy — yellow-olive, sparser
  const canopyColors = [0x99aa44, 0xaaaa55, 0xa0a840, 0x8a9a3a, 0x99aa44];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Core column — drooped, smaller
  addCanopy(g, 0, 1.05, 0, 0.34, cc());
  addCanopy(g, 0, 0.88, 0, 0.32, cc());
  addCanopy(g, 0, 1.22, 0, 0.3, cc());

  // Narrow mid ring — 4 instead of 6
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const dist = 0.22 + Math.random() * 0.06;
    const y = 0.88 + Math.random() * 0.35;
    addCanopy(g, Math.cos(a) * dist, y, Math.sin(a) * dist, 0.18 + Math.random() * 0.05, cc());
  }

  // No fill layer — sparser

  // Reduced apex — lower
  addCanopy(g, 0, 1.45, 0, 0.2, cc());

  // Lower fringe — only 3
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.2;
    addCanopy(g, Math.cos(a) * 0.18, 0.7, Math.sin(a) * 0.18, 0.15, cc());
  }

  return g;
}
function buildCypressStressed(): THREE.Group {
  const g = new THREE.Group();

  // Trunk — same thin trunk
  addTrunk(g, 0, 0, 0, 0.07, 0.04, 0.5, 0x6a4a30);

  // Stressed yellow-olive palette for depth
  const darkColors = [0x6a7a30, 0x6e8034, 0x657528];
  const midColors = [0x7a8a3a, 0x84943e, 0x7e9038];
  const lightColors = [0x99aa44, 0xa0a840, 0x95a03e];
  const dark = () => darkColors[Math.floor(Math.random() * darkColors.length)];
  const mid = () => midColors[Math.floor(Math.random() * midColors.length)];
  const light = () => lightColors[Math.floor(Math.random() * lightColors.length)];

  // 10 tiers instead of 12 — slightly sparser, narrower column
  for (let tier = 0; tier < 10; tier++) {
    const t = tier / 9;
    const y = 0.30 + tier * 0.22;
    const baseR = 0.25 - t * 0.07; // narrower than healthy (0.28)
    const tierColor = t < 0.3 ? dark : t < 0.7 ? mid : light;

    // 3 blobs per tier instead of 5, but bigger to maintain overlap
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + tier * 0.63;
      const rOff = baseR * (0.3 + Math.random() * 0.3);
      const blobR = baseR * (0.55 + Math.random() * 0.15);
      addCanopy(g, Math.cos(a) * rOff, y + (Math.random() - 0.5) * 0.05,
        Math.sin(a) * rOff, blobR, tierColor());
    }
    // Center fill per tier
    addCanopy(g, 0, y, 0, baseR * 0.5, tierColor());
  }

  // Pointed tip — duller
  addCanopy(g, 0, 2.55, 0, 0.13, light());
  const tipGeo = new THREE.ConeGeometry(0.10, 0.22, 5);
  const tip = new THREE.Mesh(tipGeo, mat(0x99aa44));
  tip.position.set(0, 2.68, 0);
  g.add(tip);

  // Bottom skirt — 4 instead of 6
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    addCanopy(g, Math.cos(a) * 0.13, 0.25, Math.sin(a) * 0.13, 0.18, dark());
  }

  return g;
}
function buildAcaciaStressed(): THREE.Group {
  const g = new THREE.Group();

  const barkColor = 0x7a5a3a;
  const barkDark = 0x5a3a1a;

  // Root flare — same
  const flareGeo = new THREE.CylinderGeometry(0.10, 0.18, 0.15, 7);
  const flare = new THREE.Mesh(flareGeo, mat(barkDark));
  flare.position.y = 0.075;
  g.add(flare);

  // Main trunk
  addTrunk(g, 0, 0.15, 0, 0.10, 0.07, 0.6, barkColor);

  // Forking branches — same structure, slightly more outward
  const branchMat = mat(barkColor);
  const forks = [
    { a: 0.3, tilt: 0.95, len: 0.55, rBot: 0.05, rTop: 0.025 },
    { a: 1.8, tilt: 0.90, len: 0.50, rBot: 0.045, rTop: 0.022 },
    { a: 3.2, tilt: 1.0, len: 0.58, rBot: 0.05, rTop: 0.025 },
    { a: 4.6, tilt: 0.85, len: 0.48, rBot: 0.04, rTop: 0.020 },
    { a: 5.8, tilt: 0.92, len: 0.52, rBot: 0.045, rTop: 0.022 },
  ];
  for (const f of forks) {
    const geo = new THREE.CylinderGeometry(f.rTop, f.rBot, f.len, 5);
    const m = new THREE.Mesh(geo, branchMat);
    m.position.set(Math.cos(f.a) * 0.06, 0.68, Math.sin(f.a) * 0.06);
    m.rotation.z = Math.cos(f.a) * f.tilt;
    m.rotation.x = Math.sin(f.a) * f.tilt;
    g.add(m);
  }

  // Stressed canopy — yellow-olive, sparser flat umbrella
  const canopyColors = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const cc = () => canopyColors[Math.floor(Math.random() * canopyColors.length)];

  // Flat disk — smaller, slightly lower
  const diskGeo = new THREE.CylinderGeometry(0.60, 0.65, 0.12, 10);
  const disk = new THREE.Mesh(diskGeo, mat(0x6a7a30));
  disk.position.set(0, 0.88, 0);
  g.add(disk);

  // Wide ring — 8 instead of 12, drooped
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dist = 0.45 + Math.random() * 0.12;
    addCanopy(g, Math.cos(a) * dist, 0.88 + Math.random() * 0.04, Math.sin(a) * dist,
      0.22 + Math.random() * 0.05, cc());
  }

  // Reduced inner fill — 4 instead of 8
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    const dist = 0.2 + Math.random() * 0.15;
    addCanopy(g, Math.cos(a) * dist, 0.9, Math.sin(a) * dist,
      0.18 + Math.random() * 0.04, cc());
  }

  // Flat top cap — lower
  addCanopy(g, 0, 0.95, 0, 0.28, cc());

  return g;
}

// ── Low-LOD stressed builders ──

function buildOakStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Trunk + flare
  addTrunk(g, 0, 0, 0, 0.18, 0.13, 0.6, 0x5a3a1a);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.2, 6), mat(0x4a2a10));
  flare.position.y = 0.1;
  g.add(flare);
  // Sparse canopy — 5 lobes in yellow-olive, gaps visible
  const cc = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const lobes: [number, number, number, number][] = [
    [0.45, 1.0, 0.15, 0.4], [-0.4, 1.05, -0.2, 0.38],
    [-0.15, 1.0, -0.4, 0.35], [0.0, 1.15, 0.0, 0.42],
    [0.0, 0.82, 0.0, 0.35],
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [x, y, z, r] = lobes[i];
    addCanopy(g, x, y, z, r, cc[i]);
  }
  return g;
}
function buildMagnoliaStressedLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.16, 0.11, 0.5, 0xb0a090);
  // Egg-shaped crown — 4 spheres, no flowers
  const cc = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840];
  addCanopy(g, 0, 1.05, 0, 0.48, cc[0]);
  addCanopy(g, 0, 1.25, 0, 0.42, cc[1]);
  addCanopy(g, 0, 0.85, 0, 0.4, cc[2]);
  addCanopy(g, 0, 1.4, 0, 0.3, cc[3]);
  return g;
}
function buildConiferStressedLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.08, 0.05, 0.35, 0x8a5a3a);
  // 7 stacked cones — smaller radii, olive palette
  const palette = [0x7a8a3a, 0x84943e, 0x8e9e42, 0x99aa44, 0xa0a840, 0xaaaa55, 0xb0b05a];
  for (let i = 0; i < 7; i++) {
    const y = 0.28 + i * 0.28;
    const r = 0.7 - i * 0.09;
    const h = 0.30 + (1 - i / 6) * 0.08;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(palette[i]));
    cone.position.set(0, y, 0);
    g.add(cone);
  }
  return g;
}
function buildTropicalStressedLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.16, 0.1, 1.1, 0x7a6a5a);
  // 2 buttress roots
  const buttMat = mat(0x6a5a4a);
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 0.4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.22), buttMat);
    m.position.set(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18);
    m.rotation.y = a;
    g.add(m);
  }
  // Canopy — 4 large spheres, olive-yellow
  const cc = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840];
  addCanopy(g, 0, 1.42, 0, 0.55, cc[0]);
  addCanopy(g, 0.35, 1.28, 0.2, 0.38, cc[1]);
  addCanopy(g, -0.25, 1.25, -0.25, 0.35, cc[2]);
  addCanopy(g, 0, 1.6, 0, 0.32, cc[3]);
  return g;
}
function buildPalmStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Curved trunk — fewer segments
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.5, 0.03),
    new THREE.Vector3(0.1, 1.1, 0),
    new THREE.Vector3(0.07, 1.6, -0.02),
    new THREE.Vector3(0.04, 2.0, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.065, 4, false), mat(0x9a8a7a)));
  // Crown shaft — yellowed
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.15, 5), mat(0x88993a));
  shaft.position.set(0.04, 2.05, 0);
  g.add(shaft);
  // 7 stressed fronds — single wider blade, droopier, olive
  const frondColors = [matDS(0x99aa44), matDS(0x88993a), matDS(0xaaaa55), matDS(0xa0a840)];
  const topY = 2.1, topX = 0.04;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const fLen = 0.85 + Math.random() * 0.15;
    const fWidth = 0.3;
    const fGeo = new THREE.PlaneGeometry(fWidth, fLen, 1, 8);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.7 * t));
      fPos.setY(vi, t * 0.2 - t * t * t * fLen * 0.7);
      fPos.setZ(vi, t * fLen * 0.75);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, frondColors[i % frondColors.length]);
    frond.position.set(topX, topY, 0);
    frond.rotation.y = a;
    g.add(frond);
  }
  return g;
}
function buildBirchStressedLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.06, 0.035, 0.9, 0xf0ece6);
  // Narrow tall crown — 5 spheres, olive-yellow
  const cc = [0x99aa44, 0xaaaa55, 0xa0a840, 0x8a9a3a, 0x99aa44];
  addCanopy(g, 0, 1.05, 0, 0.32, cc[0]);
  addCanopy(g, 0, 0.88, 0, 0.3, cc[1]);
  addCanopy(g, 0, 1.22, 0, 0.28, cc[2]);
  addCanopy(g, 0, 1.45, 0, 0.2, cc[3]);
  addCanopy(g, 0.1, 1.0, 0.08, 0.22, cc[4]);
  return g;
}
function buildCypressStressedLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.06, 0.04, 0.4, 0x6a4a30);
  // 7 tiers — narrower, olive palette
  const colors = [0x6a7a30, 0x7a8a3a, 0x84943e, 0x99aa44, 0xa0a840, 0xaaaa55, 0x99aa44];
  for (let i = 0; i < 7; i++) {
    const y = 0.25 + i * 0.30;
    const r = 0.30 - i * 0.022;
    addCanopy(g, 0, y, 0, r, colors[i]);
  }
  return g;
}
function buildAcaciaStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Flare + trunk
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 0.15, 6), mat(0x5a3a1a));
  flare.position.y = 0.075;
  g.add(flare);
  addTrunk(g, 0, 0.15, 0, 0.10, 0.07, 0.6, 0x7a5a3a);
  // 2 visible branches
  for (const a of [1.0, 4.0]) {
    const geo = new THREE.CylinderGeometry(0.02, 0.04, 0.45, 4);
    const m = new THREE.Mesh(geo, mat(0x7a5a3a));
    m.position.set(Math.cos(a) * 0.06, 0.68, Math.sin(a) * 0.06);
    m.rotation.z = Math.cos(a) * 0.95;
    m.rotation.x = Math.sin(a) * 0.95;
    g.add(m);
  }
  // Flat canopy — 5 wide blobs, olive-yellow
  const cc = [0x99aa44, 0x88993a, 0xaaaa55, 0xa0a840, 0x8a9a3a];
  const lobes: [number, number, number, number][] = [
    [0.40, 0.88, 0.12, 0.26], [-0.38, 0.88, -0.12, 0.24],
    [0.08, 0.90, 0.38, 0.22], [0.0, 0.92, 0.0, 0.30],
    [0.0, 0.85, 0.0, 0.25],
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [x, y, z, r] = lobes[i];
    addCanopy(g, x, y, z, r, cc[i]);
  }
  return g;
}

/** Subtype index → stressed hi-LOD builder */
export const STRESSED_TREES: Record<number, () => THREE.Group> = {
  6: buildOakStressed,
  7: buildMagnoliaStressed,
  8: buildConiferStressed,
  9: buildTropicalStressed,
  10: buildPalmStressed,
  11: buildBirchStressed,
  32: buildCypressStressed,
  33: buildAcaciaStressed,
};

/** Subtype index → stressed low-LOD builder */
export const STRESSED_TREES_LOW: Record<number, () => THREE.Group> = {
  6: buildOakStressedLow,
  7: buildMagnoliaStressedLow,
  8: buildConiferStressedLow,
  9: buildTropicalStressedLow,
  10: buildPalmStressedLow,
  11: buildBirchStressedLow,
  32: buildCypressStressedLow,
  33: buildAcaciaStressedLow,
};

// Suppress unused import warnings — agents will use these as they author real builders
void jitter; void addCanopy; void addTrunk;
