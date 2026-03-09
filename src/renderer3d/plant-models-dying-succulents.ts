import * as THREE from 'three';
import { mat, addCanopy, addTrunk, jitter } from './plant-models';

// ── Dying succulent variants: body shrunk ~30%, tilted off-vertical, collapsed segments ──
// Slots: Saguaro(18), Aloe(19), Caudiciform(20), Euphorbia(21),
//        IcePlant(22), Epiphytic(23), BarrelCactus(36), Jade(37)

function stub(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(0x8a5a5a));
  m.position.y = 0.15;
  g.add(m);
  return g;
}

// ── Hi-LOD dying builders ──

function buildSaguaroDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying saguaro — leaning column, 2 broken/drooping arms, exposed ribs, brown palette
  const deadBrown = mat(0x8a7a55);
  const dryTan = mat(0x9a8a60);
  const ribBrown = mat(0x6a5a3a);

  // Main column — shorter, thinner, tilted
  const mainH = 1.4;
  const mainGeo = new THREE.CylinderGeometry(0.10, 0.14, mainH, 7);
  const mainMesh = new THREE.Mesh(mainGeo, deadBrown);
  mainMesh.position.set(0, mainH / 2, 0);
  g.add(mainMesh);

  // Cracked/dry cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2),
    dryTan,
  );
  cap.position.set(0, mainH, 0);
  g.add(cap);

  // 2 arms — one broken/drooping, one sagging
  // Arm 1: severely drooping
  const a1 = 0.6;
  const cx1 = Math.cos(a1), cz1 = Math.sin(a1);
  const curve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx1 * 0.14, 0.7, cz1 * 0.14),
    new THREE.Vector3(cx1 * 0.35, 0.6, cz1 * 0.35),
    new THREE.Vector3(cx1 * 0.40, 0.35, cz1 * 0.40),
    new THREE.Vector3(cx1 * 0.38, 0.15, cz1 * 0.38),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve1, 8, 0.06, 5, false), deadBrown));

  // Arm 2: broken stub
  const a2 = 3.2;
  const cx2 = Math.cos(a2), cz2 = Math.sin(a2);
  const curve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx2 * 0.14, 0.9, cz2 * 0.14),
    new THREE.Vector3(cx2 * 0.28, 0.85, cz2 * 0.28),
    new THREE.Vector3(cx2 * 0.30, 0.70, cz2 * 0.30),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, 6, 0.055, 5, false), dryTan));

  // Exposed ribs on main column — prominent
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8;
    const ribGeo = new THREE.BoxGeometry(0.018, mainH * 0.85, 0.012);
    const rib = new THREE.Mesh(ribGeo, ribBrown);
    rib.position.set(Math.cos(a) * 0.12, mainH * 0.45, Math.sin(a) * 0.12);
    g.add(rib);
  }

  // Whole thing tilts
  g.rotation.z = 0.12;
  g.rotation.x = 0.06;

  return g;
}
function buildAloeDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying aloe — leaves collapsed flat, tips heavily browned, outer leaves dead
  const deadBrown = mat(0x8a7a55);
  const dryTan = mat(0x9a8a60);
  const darkDead = mat(0x6a5a3a);

  // 2 rings: outer dead/flat, inner barely alive
  const rings = [
    { count: 9, offset: 0.0, lean: 1.4, len: 0.9, thick: 0.06, baseR: 0.16, color: darkDead },
    { count: 5, offset: 0.35, lean: 1.0, len: 0.55, thick: 0.05, baseR: 0.08, color: dryTan },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = i * Math.PI * 2 / ring.count + ring.offset;

      const leafGeo = new THREE.BoxGeometry(ring.thick * 2.2, ring.len, ring.thick, 1, 5, 1);
      const pos = leafGeo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const origY = pos.getY(vi);
        const t = (origY + ring.len / 2) / ring.len;
        pos.setX(vi, pos.getX(vi) * (1 - 0.8 * t));
        pos.setZ(vi, pos.getZ(vi) * (1 - 0.6 * t));
        // Collapsed — curve down instead of up
        const curveY = t * ring.len * 0.3 + 0.03;
        const curveOut = t * t * ring.len * 0.6;
        pos.setY(vi, curveY);
        pos.setZ(vi, pos.getZ(vi) + curveOut);
      }
      leafGeo.computeVertexNormals();

      const leafMesh = new THREE.Mesh(leafGeo, ring.color);
      leafMesh.position.set(Math.cos(a) * ring.baseR, 0, Math.sin(a) * ring.baseR);
      leafMesh.rotation.y = -a + Math.PI / 2;
      leafMesh.rotation.x = -ring.lean;
      g.add(leafMesh);
    }
  }

  // Slight tilt
  g.rotation.z = 0.08;

  return g;
}
function buildCaudiciformDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying caudiciform — swollen caudex preserved (identity), branches bare, no flowers/leaves
  const caudexDry = mat(0x8a7a55);
  const caudexDark = mat(0x7a6a4a);
  const branchDead = mat(0x6a5a3a);

  // Big bulbous caudex — slightly shrunken but still the defining feature
  const caudexGeo = new THREE.SphereGeometry(0.26, 10, 8);
  caudexGeo.scale(1.0, 0.72, 0.88);
  const caudex = new THREE.Mesh(jitter(caudexGeo, 0.025), caudexDry);
  caudex.position.set(0, 0.18, 0);
  g.add(caudex);

  // Surface texture bumps — dried/wrinkled
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.3;
    const bumpR = 0.05 + Math.random() * 0.02;
    const bump = new THREE.Mesh(
      jitter(new THREE.SphereGeometry(bumpR, 5, 4), 0.008),
      i % 2 === 0 ? caudexDry : caudexDark,
    );
    bump.position.set(Math.cos(a) * 0.19, 0.14 + Math.random() * 0.07, Math.sin(a) * 0.19);
    g.add(bump);
  }

  // Exposed root flanges at base
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4;
    const rootGeo = new THREE.CylinderGeometry(0.018, 0.035, 0.16, 4);
    const root = new THREE.Mesh(rootGeo, caudexDark);
    root.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    root.rotation.z = -Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }

  // 4 bare branches — no leaves, no flowers, some drooping
  const branches = [
    { a: 0.3, h: 0.38, spread: 0.11, droop: false },
    { a: 1.8, h: 0.30, spread: 0.13, droop: true },
    { a: 3.2, h: 0.42, spread: 0.10, droop: false },
    { a: 4.8, h: 0.28, spread: 0.12, droop: true },
  ];
  for (const b of branches) {
    const cx = Math.cos(b.a), cz = Math.sin(b.a);
    const endY = b.droop ? 0.30 + b.h * 0.3 : 0.30 + b.h;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.07, 0.30, cz * 0.07),
      new THREE.Vector3(cx * b.spread, 0.30 + b.h * 0.6, cz * b.spread),
      new THREE.Vector3(cx * (b.spread + 0.03), endY, cz * (b.spread + 0.03)),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.020, 4, false), branchDead));
  }

  // Tilt the whole thing
  g.rotation.z = 0.10;
  g.rotation.x = 0.05;

  return g;
}
function buildEuphorbiaDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying euphorbia — arms drooping/broken, severely leaning, no cyathia tips
  const trunkDead = mat(0x6a5a3a);
  const stemDry = mat(0x7a6a4a);
  const stemDark = mat(0x8a7a55);

  // Short woody trunk — preserved
  addTrunk(g, 0, 0, 0, 0.09, 0.07, 0.50, 0x6a5a3a);

  // Central stem — shorter, thinner
  const centerH = 1.1;
  const centerGeo = new THREE.CylinderGeometry(0.04, 0.055, centerH - 0.50, 6);
  const center = new THREE.Mesh(centerGeo, stemDry);
  center.position.set(0, 0.50 + (centerH - 0.50) / 2, 0);
  g.add(center);

  // 5 arms — drooping/broken, no caps or flowers
  const armData = [
    { a: 0.4, startY: 0.48, spread: 0.26, topY: 0.70, thick: 0.042, broken: false },
    { a: 1.5, startY: 0.52, spread: 0.22, topY: 0.55, thick: 0.038, broken: true },
    { a: 2.6, startY: 0.45, spread: 0.28, topY: 0.80, thick: 0.044, broken: false },
    { a: 3.8, startY: 0.50, spread: 0.20, topY: 0.48, thick: 0.036, broken: true },
    { a: 5.2, startY: 0.46, spread: 0.25, topY: 0.65, thick: 0.040, broken: false },
  ];
  for (let i = 0; i < armData.length; i++) {
    const arm = armData[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    if (arm.broken) {
      // Broken stub — short, ends abruptly
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx * 0.07, arm.startY, cz * 0.07),
        new THREE.Vector3(cx * arm.spread * 0.6, arm.startY - 0.04, cz * arm.spread * 0.6),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, arm.thick, 4, false), trunkDead));
    } else {
      // Drooping arm — curves downward
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx * 0.07, arm.startY, cz * 0.07),
        new THREE.Vector3(cx * arm.spread * 0.8, arm.startY - 0.05, cz * arm.spread * 0.8),
        new THREE.Vector3(cx * arm.spread, arm.startY - 0.10, cz * arm.spread),
        new THREE.Vector3(cx * arm.spread * 0.95, arm.topY, cz * arm.spread * 0.95),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, arm.thick, 4, false), i % 2 === 0 ? stemDry : stemDark));
    }
  }

  // Severe lean
  g.rotation.z = 0.14;
  g.rotation.x = 0.08;

  return g;
}
function buildIcePlantDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying ice plant — 70% rosettes gone, bare patches, remaining very brown
  const deadBrown = mat(0x8a7a55);
  const dryTan = mat(0x9a8a60);
  const darkDead = mat(0x6a5a3a);

  // Only 4 surviving clumps (down from 12), much sparser
  const clumps = [
    { x: 0.00, z: 0.00, count: 8, r: 0.28 },
    { x: -0.45, z: 0.20, count: 5, r: 0.20 },
    { x: 0.40, z: -0.35, count: 4, r: 0.18 },
    { x: 0.20, z: 0.45, count: 3, r: 0.15 },
  ];

  const leafMats = [deadBrown, dryTan, darkDead];
  for (let ci = 0; ci < clumps.length; ci++) {
    const cl = clumps[ci];

    for (let i = 0; i < cl.count; i++) {
      const a = i * Math.PI * 2 / cl.count + ci * 0.35;
      const lean = 0.6 + Math.random() * 0.4;
      const fLen = 0.10 + Math.random() * 0.04;
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022, fLen, 3, 4),
        leafMats[(i + ci) % 3],
      );
      finger.position.set(
        cl.x + Math.cos(a) * cl.r * 0.4,
        fLen * 0.2,
        cl.z + Math.sin(a) * cl.r * 0.4,
      );
      finger.rotation.z = -Math.cos(a) * lean;
      finger.rotation.x = -Math.sin(a) * lean;
      g.add(finger);
    }
  }

  // Dead bare patches — flat brown discs to show where rosettes used to be
  const patchMat = mat(0x7a6a4a);
  const patches = [
    { x: -0.30, z: -0.40 }, { x: 0.50, z: 0.25 }, { x: -0.50, z: -0.15 },
    { x: 0.10, z: -0.50 }, { x: -0.10, z: 0.55 },
  ];
  for (const p of patches) {
    const patchGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.02, 5);
    const patch = new THREE.Mesh(patchGeo, patchMat);
    patch.position.set(p.x, 0.01, p.z);
    g.add(patch);
  }

  return g;
}
function buildEpiphyticDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying epiphytic — most trailing segments fallen off, few shriveled ones remain
  const baseDry = mat(0x7a6a4a);
  const segDead = mat(0x8a7a55);
  const segDark = mat(0x6a5a3a);

  // Shrunken central base — deflated
  const base = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.18, 6, 4), 0.02),
    baseDry,
  );
  base.position.y = 0.16;
  base.scale.y = 0.55;
  g.add(base);

  // Only 3 surviving stems (down from 10), shorter, more droopy
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    const spread = 0.35 + Math.random() * 0.12;
    const archH = 0.12 + Math.random() * 0.08;
    const droop = 0.18 + Math.random() * 0.10;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.10, 0.18, Math.sin(a) * 0.10),
      new THREE.Vector3(Math.cos(a) * spread * 0.35, 0.18 + archH, Math.sin(a) * spread * 0.35),
      new THREE.Vector3(Math.cos(a) * spread * 0.65, 0.12 + archH * 0.3, Math.sin(a) * spread * 0.65),
      new THREE.Vector3(Math.cos(a) * spread, 0.05 - droop, Math.sin(a) * spread),
    ]);

    // Thinner, dried stem
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.016, 3, false), segDark));

    // 2 shriveled segments per stem (down from 5-6)
    for (let s = 0; s < 2; s++) {
      const t = (s + 0.5) / 2;
      const pt = curve.getPoint(t);
      const blobSize = 0.035 + Math.random() * 0.01;
      const blobGeo = jitter(new THREE.IcosahedronGeometry(blobSize, 0), 0.005);
      const blob = new THREE.Mesh(blobGeo, s === 0 ? segDead : segDark);
      blob.position.copy(pt);
      blob.scale.set(1.1, 0.45, 0.8); // shriveled flat
      g.add(blob);
    }
  }

  // Fallen segments on ground — debris
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 0.25 + Math.random() * 0.30;
    const debris = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.03, 0), 0.004),
      i % 2 === 0 ? segDead : baseDry,
    );
    debris.position.set(Math.cos(a) * dist, 0.02, Math.sin(a) * dist);
    debris.scale.set(1.2, 0.3, 0.9);
    g.add(debris);
  }

  return g;
}
function buildBarrelCactusDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying barrel cactus — significantly deflated, tilted, spines present but body shrunken
  const bodyDry = mat(0x8a7a55);
  const ribDark = mat(0x6a5a3a);
  const spineMat = mat(0x9a8a60);

  // Deflated barrel body — ~30% smaller, more squashed
  const bodyR = 0.28;
  const bodyH = 0.35;
  const bodyGeo = new THREE.SphereGeometry(bodyR, 10, 7);
  bodyGeo.scale(1, bodyH / bodyR, 1);
  const body = new THREE.Mesh(bodyGeo, bodyDry);
  body.position.set(0, bodyH * 0.85, 0);
  g.add(body);

  // Vertical ribs — exposed, prominent on shrunken body
  const ribCount = 10;
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    const ribH = bodyH * 0.85;
    const ribGeo = new THREE.BoxGeometry(0.022, ribH, 0.015);
    const pos = ribGeo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      const t = (y + ribH / 2) / ribH;
      const bulge = Math.sin(t * Math.PI) * bodyR * 0.08;
      pos.setZ(vi, pos.getZ(vi) + bulge);
    }
    ribGeo.computeVertexNormals();
    const rib = new THREE.Mesh(ribGeo, ribDark);
    rib.position.set(Math.cos(a) * bodyR * 0.85, bodyH * 0.85, Math.sin(a) * bodyR * 0.85);
    rib.rotation.y = -a;
    g.add(rib);

    // Spines still present — 2 per rib
    for (let si = 0; si < 2; si++) {
      const t = 0.3 + si * 0.35;
      const sy = bodyH * 0.45 + t * bodyH * 0.7;
      const sr = bodyR * 0.92;
      const spineGeo = new THREE.CylinderGeometry(0.002, 0.004, 0.020, 3);
      const spine = new THREE.Mesh(spineGeo, spineMat);
      spine.position.set(Math.cos(a) * sr, sy, Math.sin(a) * sr);
      spine.rotation.z = Math.cos(a) * 0.5;
      spine.rotation.x = Math.sin(a) * 0.5;
      g.add(spine);
    }
  }

  // Dry cap — no flowers
  const capGeo = new THREE.SphereGeometry(bodyR * 0.30, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, ribDark);
  cap.position.set(0, bodyH * 1.6, 0);
  g.add(cap);

  // Strong tilt
  g.rotation.z = 0.15;
  g.rotation.x = 0.08;

  return g;
}
function buildJadeDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying jade — most branches bare, 1-2 small leaf clusters, trunk exposed
  const barkDry = mat(0x8a7a55);
  const barkDark = mat(0x7a6a4a);
  const deadLeaf = mat(0x6a5a3a);
  const lastLeaf = mat(0x9a8a60);

  // Thick stubby main trunk — exposed
  addTrunk(g, 0, 0, 0, 0.11, 0.09, 0.20, 0x8a7a55);

  // 3 major forking branches — bare, no leaves except 1
  const forks = [
    { a: 0.5, tilt: 0.50, len: 0.18, thick: 0.065, hasLeaf: false },
    { a: 2.6, tilt: 0.45, len: 0.16, thick: 0.060, hasLeaf: true },
    { a: 4.5, tilt: 0.55, len: 0.20, thick: 0.065, hasLeaf: false },
  ];

  for (const f of forks) {
    const cx = Math.cos(f.a), cz = Math.sin(f.a);
    // Primary branch
    const brGeo = new THREE.CylinderGeometry(f.thick * 0.7, f.thick, f.len, 5);
    const br = new THREE.Mesh(brGeo, barkDry);
    br.position.set(cx * 0.04, 0.20 + f.len * 0.3, cz * 0.04);
    br.rotation.z = cx * f.tilt;
    br.rotation.x = cz * f.tilt;
    g.add(br);

    const tipX = cx * (0.04 + Math.sin(f.tilt) * f.len);
    const tipY = 0.20 + Math.cos(f.tilt) * f.len;
    const tipZ = cz * (0.04 + Math.sin(f.tilt) * f.len);

    // 2 bare sub-branches per fork
    for (let si = 0; si < 2; si++) {
      const sa = f.a + (si === 0 ? -0.6 : 0.6);
      const sTilt = 0.45 + Math.random() * 0.15;
      const sLen = 0.10 + Math.random() * 0.03;
      const sThick = f.thick * 0.55;
      const scx = Math.cos(sa), scz = Math.sin(sa);

      const sGeo = new THREE.CylinderGeometry(sThick * 0.65, sThick, sLen, 4);
      const sBr = new THREE.Mesh(sGeo, barkDark);
      sBr.position.set(tipX, tipY, tipZ);
      sBr.rotation.z = scx * sTilt;
      sBr.rotation.x = scz * sTilt;
      g.add(sBr);

      // Only 1 branch gets a tiny surviving leaf cluster
      if (f.hasLeaf && si === 0) {
        const stX = tipX + scx * Math.sin(sTilt) * sLen;
        const stY = tipY + Math.cos(sTilt) * sLen;
        const stZ = tipZ + scz * Math.sin(sTilt) * sLen;
        addCanopy(g, stX, stY, stZ, 0.05, 0x9a8a60);
      }
    }
  }

  // A couple of fallen dead leaf blobs on ground
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.8;
    const dist = 0.12 + Math.random() * 0.08;
    const debris = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.025, 0),
      i === 0 ? deadLeaf : lastLeaf,
    );
    debris.position.set(Math.cos(a) * dist, 0.015, Math.sin(a) * dist);
    debris.scale.set(1.0, 0.3, 1.0);
    g.add(debris);
  }

  // Tilt
  g.rotation.z = 0.10;

  return g;
}

// ── Low-LOD dying builders ──

function buildSaguaroDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying saguaro — leaning column, 1 drooping arm, ribs
  const deadBrown = mat(0x8a7a55);
  const dryTan = mat(0x9a8a60);
  const ribBrown = mat(0x6a5a3a);

  // Main column
  const mainH = 1.4;
  const mainGeo = new THREE.CylinderGeometry(0.10, 0.14, mainH, 5);
  const mainMesh = new THREE.Mesh(mainGeo, deadBrown);
  mainMesh.position.set(0, mainH / 2, 0);
  g.add(mainMesh);

  // Cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 4, 2, 0, Math.PI * 2, 0, Math.PI / 2),
    dryTan,
  );
  cap.position.set(0, mainH, 0);
  g.add(cap);

  // 1 drooping arm
  const a1 = 0.6;
  const cx1 = Math.cos(a1), cz1 = Math.sin(a1);
  const curve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx1 * 0.14, 0.7, cz1 * 0.14),
    new THREE.Vector3(cx1 * 0.35, 0.6, cz1 * 0.35),
    new THREE.Vector3(cx1 * 0.40, 0.35, cz1 * 0.40),
    new THREE.Vector3(cx1 * 0.38, 0.15, cz1 * 0.38),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve1, 6, 0.06, 4, false), deadBrown));

  // Broken stub arm
  const a2 = 3.2;
  const cx2 = Math.cos(a2), cz2 = Math.sin(a2);
  const curve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(cx2 * 0.14, 0.9, cz2 * 0.14),
    new THREE.Vector3(cx2 * 0.28, 0.85, cz2 * 0.28),
    new THREE.Vector3(cx2 * 0.30, 0.70, cz2 * 0.30),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, 4, 0.055, 3, false), dryTan));

  // 4 exposed ribs
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI * 2 / 4;
    const ribGeo = new THREE.BoxGeometry(0.018, mainH * 0.85, 0.012);
    const rib = new THREE.Mesh(ribGeo, ribBrown);
    rib.position.set(Math.cos(a) * 0.12, mainH * 0.45, Math.sin(a) * 0.12);
    g.add(rib);
  }

  g.rotation.z = 0.12;
  g.rotation.x = 0.06;

  return g;
}
function buildAloeDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying aloe — fewer collapsed leaves
  const deadBrown = mat(0x8a7a55);
  const dryTan = mat(0x9a8a60);
  const darkDead = mat(0x6a5a3a);

  // Outer ring: 6 dead flat leaves
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6;
    const leafGeo = new THREE.BoxGeometry(0.12, 0.9, 0.06, 1, 4, 1);
    const pos = leafGeo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const origY = pos.getY(vi);
      const t = (origY + 0.45) / 0.9;
      pos.setX(vi, pos.getX(vi) * (1 - 0.8 * t));
      pos.setZ(vi, pos.getZ(vi) * (1 - 0.6 * t));
      pos.setY(vi, t * 0.27 + 0.03);
      pos.setZ(vi, pos.getZ(vi) + t * t * 0.54);
    }
    leafGeo.computeVertexNormals();
    const leaf = new THREE.Mesh(leafGeo, i % 2 === 0 ? darkDead : deadBrown);
    leaf.position.set(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16);
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.x = -1.4;
    g.add(leaf);
  }

  // Inner: 3 slightly less collapsed
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.35;
    const leafGeo = new THREE.BoxGeometry(0.10, 0.55, 0.05, 1, 3, 1);
    const pos = leafGeo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const origY = pos.getY(vi);
      const t = (origY + 0.275) / 0.55;
      pos.setX(vi, pos.getX(vi) * (1 - 0.8 * t));
      pos.setY(vi, t * 0.165 + 0.03);
      pos.setZ(vi, pos.getZ(vi) + t * t * 0.33);
    }
    leafGeo.computeVertexNormals();
    const leaf = new THREE.Mesh(leafGeo, dryTan);
    leaf.position.set(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.x = -1.0;
    g.add(leaf);
  }

  g.rotation.z = 0.08;
  return g;
}
function buildCaudiciformDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying caudiciform — caudex + bare branches
  const caudexDry = mat(0x8a7a55);
  const caudexDark = mat(0x7a6a4a);
  const branchDead = mat(0x6a5a3a);

  // Caudex
  const caudexGeo = new THREE.SphereGeometry(0.26, 7, 5);
  caudexGeo.scale(1.0, 0.72, 0.88);
  const caudex = new THREE.Mesh(jitter(caudexGeo, 0.025), caudexDry);
  caudex.position.set(0, 0.18, 0);
  g.add(caudex);

  // 2 root flanges
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 0.16, 3), caudexDark);
    root.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    root.rotation.z = -Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }

  // 3 bare branches
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    const cx = Math.cos(a), cz = Math.sin(a);
    const droop = i === 1;
    const endY = droop ? 0.42 : 0.62;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.07, 0.30, cz * 0.07),
      new THREE.Vector3(cx * 0.12, endY, cz * 0.12),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.020, 3, false), branchDead));
  }

  g.rotation.z = 0.10;
  g.rotation.x = 0.05;
  return g;
}
function buildEuphorbiaDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying euphorbia — trunk + central stem + 3 drooping arms
  const trunkDead = mat(0x6a5a3a);
  const stemDry = mat(0x7a6a4a);

  // Trunk
  addTrunk(g, 0, 0, 0, 0.09, 0.07, 0.50, 0x6a5a3a);

  // Central stem
  const centerGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.60, 4);
  const center = new THREE.Mesh(centerGeo, stemDry);
  center.position.set(0, 0.80, 0);
  g.add(center);

  // 3 drooping arms
  const arms = [
    { a: 0.5, startY: 0.48, spread: 0.26, topY: 0.70 },
    { a: 2.6, startY: 0.45, spread: 0.28, topY: 0.75 },
    { a: 5.0, startY: 0.46, spread: 0.24, topY: 0.60 },
  ];
  for (const arm of arms) {
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.07, arm.startY, cz * 0.07),
      new THREE.Vector3(cx * arm.spread * 0.8, arm.startY - 0.05, cz * arm.spread * 0.8),
      new THREE.Vector3(cx * arm.spread, arm.topY, cz * arm.spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.042, 3, false), trunkDead));
  }

  g.rotation.z = 0.14;
  g.rotation.x = 0.08;
  return g;
}
function buildIcePlantDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying ice plant — 3 small brown blobs + 4 bare patches
  const deadBrown = mat(0x8a7a55);
  const dryTan = mat(0x9a8a60);
  const patchMat = mat(0x7a6a4a);

  // 3 surviving clump blobs — flattened
  const blobs: [number, number, number, number][] = [
    [0.0, 0.0, 0.18, 0x8a7a55],
    [-0.40, 0.18, 0.13, 0x9a8a60],
    [0.35, -0.30, 0.11, 0x6a5a3a],
  ];
  for (const [bx, bz, r, c] of blobs) {
    const blob = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.05),
      mat(c),
    );
    blob.position.set(bx, 0.05, bz);
    blob.scale.set(1.0, 0.30, 1.0);
    g.add(blob);
  }

  // 4 bare ground patches
  const patches: [number, number][] = [[-0.30, -0.40], [0.45, 0.25], [-0.45, -0.15], [0.10, 0.50]];
  for (const [px, pz] of patches) {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.02, 4), patchMat);
    patch.position.set(px, 0.01, pz);
    g.add(patch);
  }

  return g;
}
function buildEpiphyticDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying epiphytic — shrunken base + 3 droopy stems + 2 debris
  const baseDry = mat(0x7a6a4a);
  const segDead = mat(0x8a7a55);
  const segDark = mat(0x6a5a3a);

  // Shrunken base
  const base = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.18, 5, 3), 0.02),
    baseDry,
  );
  base.position.y = 0.16;
  base.scale.y = 0.55;
  g.add(base);

  // 3 droopy stems with 1 segment each
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    const spread = 0.38;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.10, 0.18, Math.sin(a) * 0.10),
      new THREE.Vector3(Math.cos(a) * spread * 0.5, 0.22, Math.sin(a) * spread * 0.5),
      new THREE.Vector3(Math.cos(a) * spread, 0.0, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 5, 0.016, 3, false), segDark));

    // 1 shriveled segment blob
    const pt = curve.getPoint(0.45);
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.035, 0),
      i === 0 ? segDead : segDark,
    );
    blob.position.copy(pt);
    blob.scale.set(1.1, 0.45, 0.8);
    g.add(blob);
  }

  // 2 ground debris
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 1.0;
    const debris = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.03, 0),
      segDead,
    );
    debris.position.set(Math.cos(a) * 0.35, 0.02, Math.sin(a) * 0.35);
    debris.scale.set(1.2, 0.3, 0.9);
    g.add(debris);
  }

  return g;
}
function buildBarrelCactusDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying barrel cactus — deflated body + cap
  const bodyDry = mat(0x8a7a55);
  const ribDark = mat(0x6a5a3a);

  // Deflated body
  const bodyR = 0.28;
  const bodyH = 0.35;
  const bodyGeo = new THREE.SphereGeometry(bodyR, 8, 5);
  bodyGeo.scale(1, bodyH / bodyR, 1);
  const body = new THREE.Mesh(bodyGeo, bodyDry);
  body.position.set(0, bodyH * 0.85, 0);
  g.add(body);

  // Cap
  const capGeo = new THREE.SphereGeometry(bodyR * 0.30, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, ribDark);
  cap.position.set(0, bodyH * 1.6, 0);
  g.add(cap);

  g.rotation.z = 0.15;
  g.rotation.x = 0.08;
  return g;
}
function buildJadeDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD dying jade — trunk + 3 bare branches + 1 tiny leaf cluster
  const barkDry = mat(0x8a7a55);
  const barkDark = mat(0x7a6a4a);

  // Trunk
  addTrunk(g, 0, 0, 0, 0.11, 0.09, 0.20, 0x8a7a55);

  // 3 bare branches
  const branches = [
    { a: 0.5, tilt: 0.50, tipX: 0.12, tipY: 0.34, tipZ: 0.08 },
    { a: 2.6, tilt: 0.45, tipX: -0.10, tipY: 0.32, tipZ: -0.07 },
    { a: 4.5, tilt: 0.55, tipX: 0.07, tipY: 0.36, tipZ: -0.12 },
  ];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    const brGeo = new THREE.CylinderGeometry(0.04, 0.065, 0.16, 4);
    const br = new THREE.Mesh(brGeo, i % 2 === 0 ? barkDry : barkDark);
    br.position.set(Math.cos(b.a) * 0.04, 0.26, Math.sin(b.a) * 0.04);
    br.rotation.z = Math.cos(b.a) * b.tilt;
    br.rotation.x = Math.sin(b.a) * b.tilt;
    g.add(br);

    // Sub-branch stubs
    const subGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.10, 3);
    const sub = new THREE.Mesh(subGeo, barkDark);
    sub.position.set(b.tipX, b.tipY, b.tipZ);
    sub.rotation.z = Math.cos(b.a + 0.5) * 0.5;
    sub.rotation.x = Math.sin(b.a + 0.5) * 0.5;
    g.add(sub);
  }

  // 1 tiny surviving leaf cluster on middle branch
  addCanopy(g, -0.14, 0.38, -0.10, 0.05, 0x9a8a60);

  // 2 ground debris
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.8;
    const debris = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.025, 0),
      mat(0x6a5a3a),
    );
    debris.position.set(Math.cos(a) * 0.14, 0.015, Math.sin(a) * 0.14);
    debris.scale.set(1.0, 0.3, 1.0);
    g.add(debris);
  }

  g.rotation.z = 0.10;
  return g;
}

export const DYING_SUCCULENTS: Record<number, () => THREE.Group> = {
  18: buildSaguaroDying,
  19: buildAloeDying,
  20: buildCaudiciformDying,
  21: buildEuphorbiaDying,
  22: buildIcePlantDying,
  23: buildEpiphyticDying,
  36: buildBarrelCactusDying,
  37: buildJadeDying,
};

export const DYING_SUCCULENTS_LOW: Record<number, () => THREE.Group> = {
  18: buildSaguaroDyingLow,
  19: buildAloeDyingLow,
  20: buildCaudiciformDyingLow,
  21: buildEuphorbiaDyingLow,
  22: buildIcePlantDyingLow,
  23: buildEpiphyticDyingLow,
  36: buildBarrelCactusDyingLow,
  37: buildJadeDyingLow,
};

void jitter; void addCanopy; void addTrunk;
