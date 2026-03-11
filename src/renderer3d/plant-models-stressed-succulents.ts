import * as THREE from 'three';
import { mat, addCanopy, addTrunk, jitter } from './plant-models';

// ── Stressed succulent variants: body shrunk ~15%, slight tilt, muted colors ──
// Slots: Saguaro(18), Aloe(19), Caudiciform(20), Euphorbia(21),
//        IcePlant(22), Epiphytic(23), BarrelCactus(36), Jade(37)

// ── Hi-LOD stressed builders ──

function buildSaguaroStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed saguaro — slightly deflated, arms droop more, muted colors, slight lean
  const bodyGreen = mat(0x7a8a55);
  const lightGreen = mat(0x8a9a60);
  const darkGreen = mat(0x5a7a3a);

  // Main column — slightly thinner (deflated), slight lean
  const mainH = 1.9;
  const mainGeo = new THREE.CylinderGeometry(0.11, 0.15, mainH, 8);
  const mainMesh = new THREE.Mesh(mainGeo, bodyGreen);
  mainMesh.position.set(0, mainH / 2, 0);
  g.add(mainMesh);

  // Dome cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), lightGreen);
  cap.position.set(0, mainH, 0);
  g.add(cap);

  // 4 arms — drooping more (lower topY relative to startY), slightly thinner
  const armData = [
    { a: 0.4, startY: 0.80, spread: 0.44, topY: 1.10, thick: 0.063 },
    { a: 2.0, startY: 1.00, spread: 0.38, topY: 1.30, thick: 0.055 },
    { a: 3.5, startY: 0.60, spread: 0.48, topY: 0.85, thick: 0.060 },
    { a: 5.2, startY: 1.15, spread: 0.34, topY: 1.45, thick: 0.050 },
  ];
  for (let i = 0; i < armData.length; i++) {
    const arm = armData[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.15, arm.startY, cz * 0.15),
      new THREE.Vector3(cx * arm.spread, arm.startY - 0.14, cz * arm.spread),
      new THREE.Vector3(cx * (arm.spread + 0.04), arm.startY + (arm.topY - arm.startY) * 0.4, cz * (arm.spread + 0.04)),
      new THREE.Vector3(cx * arm.spread * 0.92, arm.topY, cz * arm.spread * 0.92),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, arm.thick, 6, false), i % 2 === 0 ? bodyGreen : lightGreen));
    const tip = curve.getPoint(1);
    const armCap = new THREE.Mesh(
      new THREE.SphereGeometry(arm.thick, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      lightGreen,
    );
    armCap.position.copy(tip);
    g.add(armCap);
  }

  // Vertical rib accents — slightly fewer
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const ribGeo = new THREE.BoxGeometry(0.012, mainH * 0.85, 0.012);
    const rib = new THREE.Mesh(ribGeo, darkGreen);
    rib.position.set(Math.cos(a) * 0.13, mainH * 0.46, Math.sin(a) * 0.13);
    g.add(rib);
  }

  // Slight lean to the whole plant
  g.rotation.z = 0.04;
  g.rotation.x = 0.03;

  return g;
}
function buildAloeStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed aloe — leaves curl inward, muted colors, tips brown, slightly deflated
  const leafMuted = mat(0x7a8a55);
  const leafDull = mat(0x6a7a4a);
  const leafDark = mat(0x5a6a40);
  const tipBrown = mat(0x8a7755);

  // 3 rings — curled inward more (higher lean values = more upright/inward)
  const rings = [
    { count: 10, offset: 0.0, lean: 0.75, len: 1.2, thick: 0.07, baseR: 0.15 },
    { count: 7, offset: 0.28, lean: 0.50, len: 0.95, thick: 0.06, baseR: 0.10 },
    { count: 5, offset: 0.55, lean: 0.30, len: 0.65, thick: 0.05, baseR: 0.05 },
  ];

  const ringMats = [leafMuted, leafDull, leafDark];
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    for (let i = 0; i < ring.count; i++) {
      const a = i * Math.PI * 2 / ring.count + ring.offset;

      // Thick fleshy leaf — tapered, slightly deflated (thinner)
      const leafGeo = new THREE.BoxGeometry(ring.thick * 2.2, ring.len, ring.thick * 0.85, 1, 6, 1);
      const pos = leafGeo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const origY = pos.getY(vi);
        const t = (origY + ring.len / 2) / ring.len;
        pos.setX(vi, pos.getX(vi) * (1 - 0.75 * t));
        pos.setZ(vi, pos.getZ(vi) * (1 - 0.5 * t));
        // Curl inward more — less outward curve
        const curveY = t * ring.len * 0.65 + 0.05;
        const curveOut = t * t * ring.len * 0.35; // reduced from 0.5
        pos.setY(vi, curveY);
        pos.setZ(vi, pos.getZ(vi) + curveOut);
      }
      leafGeo.computeVertexNormals();

      const leafMesh = new THREE.Mesh(leafGeo, ringMats[ri]);
      leafMesh.position.set(Math.cos(a) * ring.baseR, 0, Math.sin(a) * ring.baseR);
      leafMesh.rotation.y = -a + Math.PI / 2;
      leafMesh.rotation.x = -ring.lean;
      g.add(leafMesh);

      // Brown tips on outer ring leaves
      if (ri === 0 && i % 2 === 0) {
        const tipGeo = new THREE.BoxGeometry(ring.thick * 0.8, 0.08, ring.thick * 0.5);
        const tipMesh = new THREE.Mesh(tipGeo, tipBrown);
        // Place at approximate leaf tip
        const tipDist = ring.baseR + Math.sin(ring.lean) * ring.len * 0.85;
        const tipY = Math.cos(ring.lean) * ring.len * 0.6;
        tipMesh.position.set(Math.cos(a) * tipDist, tipY, Math.sin(a) * tipDist);
        tipMesh.rotation.y = -a;
        g.add(tipMesh);
      }
    }
  }

  // Slight tilt
  g.rotation.z = 0.03;

  return g;
}
function buildCaudiciformStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed caudiciform — deflated caudex, no flowers, muted leaves, slight tilt
  const caudexMat = mat(0x8a7a65);
  const caudexDark = mat(0x7a6a58);
  const branchMat = mat(0x6a5a48);

  // Slightly deflated caudex
  const caudexGeo = new THREE.SphereGeometry(0.26, 10, 8);
  caudexGeo.scale(1.0, 0.70, 0.85);
  const caudex = new THREE.Mesh(jitter(caudexGeo, 0.02), caudexMat);
  caudex.position.set(0, 0.18, 0);
  g.add(caudex);

  // Fewer surface bumps
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI * 2 / 6 + 0.3;
    const bumpR = 0.05 + Math.random() * 0.02;
    const bump = new THREE.Mesh(
      jitter(new THREE.SphereGeometry(bumpR, 5, 4), 0.008),
      i % 2 === 0 ? caudexMat : caudexDark,
    );
    bump.position.set(Math.cos(a) * 0.19, 0.14 + Math.random() * 0.07, Math.sin(a) * 0.19);
    g.add(bump);
  }

  // Root flanges
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const rootGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.16, 4);
    const root = new THREE.Mesh(rootGeo, caudexDark);
    root.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    root.rotation.z = -Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }

  // 5 short branches — NO flowers, muted leaf colors
  const leafColors = [0x6a7a4a, 0x7a8a55, 0x5a6a3d];

  const branches = [
    { a: 0.3, h: 0.42, spread: 0.11 },
    { a: 1.5, h: 0.36, spread: 0.13 },
    { a: 2.8, h: 0.46, spread: 0.09 },
    { a: 4.2, h: 0.32, spread: 0.12 },
    { a: 5.4, h: 0.40, spread: 0.10 },
  ];
  for (let i = 0; i < branches.length; i++) {
    const b = branches[i];
    const cx = Math.cos(b.a), cz = Math.sin(b.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.08, 0.30, cz * 0.08),
      new THREE.Vector3(cx * b.spread, 0.30 + b.h * 0.5, cz * b.spread),
      new THREE.Vector3(cx * (b.spread + 0.03), 0.30 + b.h, cz * (b.spread + 0.03)),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.022, 4, false), branchMat));

    // Smaller leaf clusters at tip — muted
    const tip = curve.getPoint(0.9);
    addCanopy(g, tip.x, tip.y, tip.z, 0.08, leafColors[i % leafColors.length]);
    addCanopy(g, tip.x + 0.02, tip.y + 0.03, tip.z, 0.055, leafColors[(i + 1) % leafColors.length]);
  }

  // Slight tilt
  g.rotation.z = 0.04;

  return g;
}
function buildEuphorbiaStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed euphorbia — thinner stems, muted colors, no cyathia tips, slight lean
  const stemDark = mat(0x4a6a3a);
  const stemMid = mat(0x5a7a45);
  const stemLight = mat(0x6a8a50);

  // Short woody trunk
  addTrunk(g, 0, 0, 0, 0.09, 0.07, 0.50, 0x5a4a30);

  // Central stem — slightly thinner
  const centerH = 1.45;
  const centerGeo = new THREE.CylinderGeometry(0.042, 0.055, centerH - 0.50, 6);
  const center = new THREE.Mesh(centerGeo, stemMid);
  center.position.set(0, 0.50 + (centerH - 0.50) / 2, 0);
  g.add(center);
  const cCap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), stemLight);
  cCap.position.set(0, centerH, 0);
  g.add(cCap);
  // No cyathia at center tip (stressed = no flowering)

  // 6 candelabra arms — slightly thinner, drooping a bit more
  const armData = [
    { a: 0.3, startY: 0.48, spread: 0.27, topY: 1.22, thick: 0.040 },
    { a: 1.2, startY: 0.55, spread: 0.23, topY: 1.05, thick: 0.035 },
    { a: 2.0, startY: 0.43, spread: 0.29, topY: 1.30, thick: 0.042 },
    { a: 2.9, startY: 0.52, spread: 0.21, topY: 1.00, thick: 0.034 },
    { a: 3.8, startY: 0.46, spread: 0.25, topY: 1.18, thick: 0.038 },
    { a: 5.0, startY: 0.57, spread: 0.22, topY: 1.08, thick: 0.035 },
  ];
  for (let i = 0; i < armData.length; i++) {
    const arm = armData[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.07, arm.startY, cz * 0.07),
      new THREE.Vector3(cx * arm.spread * 0.9, arm.startY - 0.08, cz * arm.spread * 0.9),
      new THREE.Vector3(cx * arm.spread, arm.startY + (arm.topY - arm.startY) * 0.4, cz * arm.spread),
      new THREE.Vector3(cx * arm.spread * 0.95, arm.topY, cz * arm.spread * 0.95),
    ]);
    const armMat = [stemDark, stemMid, stemLight][i % 3];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, arm.thick, 5, false), armMat));

    // Dome cap
    const tip = curve.getPoint(1);
    const armCap = new THREE.Mesh(
      new THREE.SphereGeometry(arm.thick, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      stemLight,
    );
    armCap.position.copy(tip);
    g.add(armCap);
    // No cyathia or forks (stressed)
  }

  // Slight lean
  g.rotation.z = 0.04;
  g.rotation.x = 0.02;

  return g;
}
function buildIcePlantStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed ice plant — fewer clumps with gaps, no flowers, muted colors
  const leafMuted = mat(0x7a8a55);
  const leafDull = mat(0x6a7a4a);
  const leafDark = mat(0x5a6a3d);

  // 8 clumps (fewer than 12 healthy) — some gaps in coverage
  const clumps = [
    { x: 0.00, z: 0.00, count: 12, r: 0.35 },
    { x: -0.50, z: 0.22, count: 10, r: 0.28 },
    { x: 0.45, z: -0.25, count: 9, r: 0.26 },
    { x: 0.20, z: 0.50, count: 9, r: 0.25 },
    { x: -0.25, z: -0.45, count: 8, r: 0.24 },
    { x: 0.55, z: 0.20, count: 7, r: 0.22 },
    { x: -0.50, z: -0.15, count: 7, r: 0.20 },
    { x: 0.00, z: -0.55, count: 6, r: 0.18 },
  ];

  const leafMats = [leafMuted, leafDull, leafDark];
  for (let ci = 0; ci < clumps.length; ci++) {
    const cl = clumps[ci];

    for (let i = 0; i < cl.count; i++) {
      const a = i * Math.PI * 2 / cl.count + ci * 0.35;
      const lean = 0.4 + Math.random() * 0.25;
      const fLen = 0.11 + Math.random() * 0.05; // shorter fingers
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.024, fLen, 3, 5), // thinner
        leafMats[(i + ci) % 3],
      );
      finger.position.set(
        cl.x + Math.cos(a) * cl.r * 0.4,
        fLen * 0.22,
        cl.z + Math.sin(a) * cl.r * 0.4,
      );
      finger.rotation.z = -Math.cos(a) * lean;
      finger.rotation.x = -Math.sin(a) * lean;
      g.add(finger);
    }
    // No flowers (stressed)
  }

  return g;
}
function buildEpiphyticStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed epiphytic cactus — fewer stems, no flowers, muted colors, more droop
  const segMuted = mat(0x5a8a44);
  const segMid = mat(0x4a7a38);
  const segDark = mat(0x3a6a2d);

  // Slightly smaller central base
  const base = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.22, 7, 5), 0.02),
    segDark,
  );
  base.position.y = 0.20;
  base.scale.y = 0.60;
  g.add(base);

  const baseTop = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.15, 6, 4), 0.015),
    segMid,
  );
  baseTop.position.y = 0.32;
  baseTop.scale.y = 0.55;
  g.add(baseTop);

  // 7 arching stems (fewer than 10 healthy), more droop, no flowers
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + (Math.random() - 0.5) * 0.15;
    const spread = 0.58 + Math.random() * 0.18;
    const archH = 0.22 + Math.random() * 0.12;
    const droop = 0.18 + Math.random() * 0.18; // more droop
    const segCount = 4 + Math.floor(Math.random() * 2);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.10, 0.25, Math.sin(a) * 0.10),
      new THREE.Vector3(Math.cos(a) * spread * 0.35, 0.26 + archH, Math.sin(a) * spread * 0.35),
      new THREE.Vector3(Math.cos(a) * spread * 0.65, 0.20 + archH * 0.4, Math.sin(a) * spread * 0.65),
      new THREE.Vector3(Math.cos(a) * spread, 0.10 - droop, Math.sin(a) * spread),
    ]);

    // Thinner stem
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.018, 4, false), segMid));

    // Fewer, smaller segments along stem
    const segMats = [segMuted, segMid, segDark];
    for (let s = 0; s < segCount; s++) {
      const t = (s + 0.5) / segCount;
      const pt = curve.getPoint(t);
      const blobSize = 0.05 + Math.random() * 0.015;
      const blobGeo = jitter(new THREE.IcosahedronGeometry(blobSize, 0), 0.005);
      const blob = new THREE.Mesh(blobGeo, segMats[(s + i) % 3]);
      blob.position.copy(pt);
      blob.scale.set(1.2, 0.55, 0.9);
      g.add(blob);
    }
    // No flowers (stressed)
  }

  return g;
}
function buildBarrelCactusStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed barrel cactus — slightly deflated body, no flower crown, muted colors, slight lean
  const bodyGreen = mat(0x7a8a55);
  const darkGreen = mat(0x6a7a45);
  const lightGreen = mat(0x8a9a60);

  // Slightly deflated barrel body
  const bodyR = 0.36;
  const bodyH = 0.45;
  const bodyGeo = new THREE.SphereGeometry(bodyR, 12, 8);
  bodyGeo.scale(1, bodyH / bodyR, 1);
  const body = new THREE.Mesh(bodyGeo, bodyGreen);
  body.position.set(0, bodyH * 0.9, 0);
  g.add(body);

  // Vertical ribs — preserved
  const ribCount = 12;
  const spineMat = mat(0xbbaa66);
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    const ribH = bodyH * 0.85;
    const ribGeo = new THREE.BoxGeometry(0.022, ribH, 0.015);
    const pos = ribGeo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      const t = (y + ribH / 2) / ribH;
      const bulge = Math.sin(t * Math.PI) * bodyR * 0.09;
      pos.setZ(vi, pos.getZ(vi) + bulge);
    }
    ribGeo.computeVertexNormals();
    const rib = new THREE.Mesh(ribGeo, darkGreen);
    rib.position.set(Math.cos(a) * bodyR * 0.86, bodyH * 0.9, Math.sin(a) * bodyR * 0.86);
    rib.rotation.y = -a;
    g.add(rib);

    // Spine nubs — slightly fewer (2 per rib)
    for (let si = 0; si < 2; si++) {
      const t = 0.3 + si * 0.35;
      const sy = bodyH * 0.5 + t * bodyH * 0.7;
      const sphereT = Math.sin(t * Math.PI);
      const sr = bodyR * 0.93 + sphereT * 0.02;
      const spineGeo = new THREE.CylinderGeometry(0.002, 0.004, 0.016, 3);
      const spine = new THREE.Mesh(spineGeo, spineMat);
      spine.position.set(Math.cos(a) * sr, sy, Math.sin(a) * sr);
      spine.rotation.z = Math.cos(a) * 0.5;
      spine.rotation.x = Math.sin(a) * 0.5;
      g.add(spine);
    }
  }

  // Dome cap — smaller
  const capGeo = new THREE.SphereGeometry(bodyR * 0.30, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, lightGreen);
  cap.position.set(0, bodyH * 1.65, 0);
  g.add(cap);

  // No flower crown (stressed)

  // Slight lean
  g.rotation.z = 0.05;
  g.rotation.x = 0.03;

  return g;
}
function buildJadeStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed jade — slightly thinner branches, muted leaf colors, outer leaves curling inward
  const barkColor = 0x8a7a6a;
  const barkMat = mat(barkColor);

  // Thick stubby trunk — slightly thinner
  addTrunk(g, 0, 0, 0, 0.10, 0.09, 0.20, barkColor);

  // Muted yellow-green for stressed jade leaves
  const leafColors = [0x6a8a4a, 0x78995a, 0x5a7a40, 0x7a9a55, 0x6a8548];
  const lc = () => leafColors[Math.floor(Math.random() * leafColors.length)];

  // 3 forking branches — slightly thinner
  const forks = [
    { a: 0.5, tilt: 0.48, len: 0.18, thick: 0.06 },
    { a: 2.6, tilt: 0.43, len: 0.16, thick: 0.055 },
    { a: 4.5, tilt: 0.52, len: 0.20, thick: 0.06 },
  ];

  for (const f of forks) {
    const cx = Math.cos(f.a), cz = Math.sin(f.a);
    const brGeo = new THREE.CylinderGeometry(f.thick * 0.70, f.thick * 0.95, f.len, 6);
    const br = new THREE.Mesh(brGeo, barkMat);
    br.position.set(cx * 0.04, 0.20 + f.len * 0.3, cz * 0.04);
    br.rotation.z = cx * f.tilt;
    br.rotation.x = cz * f.tilt;
    g.add(br);

    const tipX = cx * (0.04 + Math.sin(f.tilt) * f.len);
    const tipY = 0.20 + Math.cos(f.tilt) * f.len;
    const tipZ = cz * (0.04 + Math.sin(f.tilt) * f.len);

    // 2 secondary forks — slightly thinner
    for (let si = 0; si < 2; si++) {
      const sa = f.a + (si === 0 ? -0.6 : 0.6);
      const sTilt = 0.42 + Math.random() * 0.12;
      const sLen = 0.10 + Math.random() * 0.03;
      const sThick = f.thick * 0.55;
      const scx = Math.cos(sa), scz = Math.sin(sa);

      const sGeo = new THREE.CylinderGeometry(sThick * 0.65, sThick, sLen, 5);
      const sBr = new THREE.Mesh(sGeo, barkMat);
      sBr.position.set(tipX, tipY, tipZ);
      sBr.rotation.z = scx * sTilt;
      sBr.rotation.x = scz * sTilt;
      g.add(sBr);

      const stX = tipX + scx * Math.sin(sTilt) * sLen;
      const stY = tipY + Math.cos(sTilt) * sLen;
      const stZ = tipZ + scz * Math.sin(sTilt) * sLen;

      // Smaller, fewer leaf clusters — muted
      addCanopy(g, stX, stY, stZ, 0.065, lc());
      for (let li = 0; li < 2; li++) {
        const la = (li / 2) * Math.PI * 2 + sa;
        addCanopy(g, stX + Math.cos(la) * 0.04, stY + (Math.random() - 0.3) * 0.02,
          stZ + Math.sin(la) * 0.04, 0.05, lc());
      }
    }

    // Smaller leaf cluster at primary tip
    addCanopy(g, tipX, tipY + 0.01, tipZ, 0.055, lc());
  }

  // Smaller central top crown
  addCanopy(g, 0, 0.36, 0, 0.065, lc());

  // Slight tilt
  g.rotation.z = 0.03;

  return g;
}

// ── Low-LOD stressed builders ──

function buildSaguaroStressedLow(): THREE.Group {
  // Saguaro healthy reuses full builder for low-LOD; same here
  return buildSaguaroStressed();
}
function buildAloeStressedLow(): THREE.Group {
  // Aloe healthy reuses full builder for low-LOD; same here
  return buildAloeStressed();
}
function buildCaudiciformStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Deflated caudex, 3 branches with leaf tips, no flowers
  const caudexGeo = new THREE.SphereGeometry(0.26, 8, 6);
  caudexGeo.scale(1.0, 0.70, 0.85);
  const caudex = new THREE.Mesh(jitter(caudexGeo, 0.02), mat(0x8a7a65));
  caudex.position.set(0, 0.18, 0);
  g.add(caudex);
  // 2 root flanges
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.16, 3), mat(0x7a6a58));
    root.position.set(Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    root.rotation.z = -Math.cos(a) * 0.5;
    root.rotation.x = -Math.sin(a) * 0.5;
    g.add(root);
  }
  // 3 short branches with leaf tips
  const branchMat = mat(0x6a5a48);
  const leafColors = [0x6a7a4a, 0x7a8a55, 0x5a6a3d];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.3;
    const cx = Math.cos(a), cz = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.08, 0.30, cz * 0.08),
      new THREE.Vector3(cx * 0.11, 0.58, cz * 0.11),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.022, 3, false), branchMat));
    const tip = curve.getPoint(0.9);
    addCanopy(g, tip.x, tip.y, tip.z, 0.08, leafColors[i]);
  }
  g.rotation.z = 0.04;
  return g;
}
function buildEuphorbiaStressedLow(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.09, 0.07, 0.50, 0x5a4a30);
  // Central stem
  const centerGeo = new THREE.CylinderGeometry(0.042, 0.055, 0.95, 5);
  const center = new THREE.Mesh(centerGeo, mat(0x5a7a45));
  center.position.set(0, 0.50 + 0.475, 0);
  g.add(center);
  // 4 candelabra arms — no cyathia
  const armData = [
    { a: 0.5, startY: 0.48, spread: 0.25, topY: 1.20, thick: 0.038 },
    { a: 2.1, startY: 0.53, spread: 0.23, topY: 1.05, thick: 0.035 },
    { a: 3.7, startY: 0.45, spread: 0.27, topY: 1.28, thick: 0.040 },
    { a: 5.3, startY: 0.55, spread: 0.22, topY: 1.08, thick: 0.035 },
  ];
  for (const arm of armData) {
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.07, arm.startY, cz * 0.07),
      new THREE.Vector3(cx * arm.spread * 0.9, arm.startY - 0.06, cz * arm.spread * 0.9),
      new THREE.Vector3(cx * arm.spread, arm.startY + (arm.topY - arm.startY) * 0.5, cz * arm.spread),
      new THREE.Vector3(cx * arm.spread * 0.95, arm.topY, cz * arm.spread * 0.95),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, arm.thick, 4, false), mat(0x5a7a45)));
    const tip = curve.getPoint(1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(arm.thick, 4, 3, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a8a50));
    cap.position.copy(tip);
    g.add(cap);
  }
  g.rotation.z = 0.04;
  g.rotation.x = 0.02;
  return g;
}
function buildIcePlantStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const leafMats = [mat(0x7a8a55), mat(0x6a7a4a), mat(0x5a6a3d)];
  // 7 flattened blobs — fewer and smaller than healthy, gaps visible
  const blobs: [number, number, number][] = [
    [0.0, 0.0, 0.28], [-0.32, 0.0, 0.24], [0.32, 0.0, 0.24],
    [0.0, 0.32, 0.22], [0.0, -0.32, 0.22],
    [-0.28, -0.26, 0.20], [0.26, 0.28, 0.20],
  ];
  for (let i = 0; i < blobs.length; i++) {
    const [bx, bz, r] = blobs[i];
    const blob = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.06),
      leafMats[i % 3],
    );
    blob.position.set(bx, 0.07, bz);
    blob.scale.set(1.0, 0.32, 1.0);
    g.add(blob);
  }
  // No flowers (stressed)
  return g;
}
function buildEpiphyticStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Smaller central base
  const base = new THREE.Mesh(
    jitter(new THREE.SphereGeometry(0.21, 6, 4), 0.02),
    mat(0x3a6a2d),
  );
  base.position.y = 0.20;
  base.scale.y = 0.60;
  g.add(base);
  // 5 arching stems with mid-blob, more droop, no flowers
  const segMats = [mat(0x5a8a44), mat(0x4a7a38), mat(0x3a6a2d)];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + 0.15;
    const spread = 0.58 + Math.random() * 0.15;
    const archH = 0.22 + Math.random() * 0.10;
    const droop = 0.18 + Math.random() * 0.15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.10, 0.22, Math.sin(a) * 0.10),
      new THREE.Vector3(Math.cos(a) * spread * 0.35, 0.24 + archH, Math.sin(a) * spread * 0.35),
      new THREE.Vector3(Math.cos(a) * spread * 0.65, 0.20 + archH * 0.4, Math.sin(a) * spread * 0.65),
      new THREE.Vector3(Math.cos(a) * spread, 0.10 - droop, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.018, 3, false), mat(0x4a7a38)));
    const midPt = curve.getPoint(0.5);
    const blob = new THREE.Mesh(
      jitter(new THREE.IcosahedronGeometry(0.05, 0), 0.004),
      segMats[i % 3],
    );
    blob.position.copy(midPt);
    blob.scale.set(1.2, 0.55, 0.9);
    g.add(blob);
  }
  return g;
}
function buildBarrelCactusStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Deflated body + cap, no flowers
  const bodyR = 0.36, bodyH = 0.45;
  const bodyGeo = new THREE.SphereGeometry(bodyR, 10, 6);
  bodyGeo.scale(1, bodyH / bodyR, 1);
  const body = new THREE.Mesh(bodyGeo, mat(0x7a8a55));
  body.position.set(0, bodyH * 0.9, 0);
  g.add(body);
  const capGeo = new THREE.SphereGeometry(bodyR * 0.30, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, mat(0x8a9a60));
  cap.position.set(0, bodyH * 1.65, 0);
  g.add(cap);
  // No flower crown (stressed)
  g.rotation.z = 0.05;
  g.rotation.x = 0.03;
  return g;
}
function buildJadeStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // Low-LOD stressed jade — trunk + 3 branch stubs + 3 small leaf clusters
  const barkMat = mat(0x8a7a6a);
  addTrunk(g, 0, 0, 0, 0.10, 0.09, 0.20, 0x8a7a6a);
  const leafColors = [0x6a8a4a, 0x78995a, 0x5a7a40];
  const forks = [
    { a: 0.5, tilt: 0.48 },
    { a: 2.6, tilt: 0.43 },
    { a: 4.5, tilt: 0.52 },
  ];
  for (let i = 0; i < forks.length; i++) {
    const f = forks[i];
    const cx = Math.cos(f.a), cz = Math.sin(f.a);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.16, 4), barkMat);
    br.position.set(cx * 0.04, 0.26, cz * 0.04);
    br.rotation.z = cx * f.tilt;
    br.rotation.x = cz * f.tilt;
    g.add(br);
    // Small leaf cluster at tip
    const tipX = cx * (0.04 + Math.sin(f.tilt) * 0.16);
    const tipY = 0.20 + Math.cos(f.tilt) * 0.16;
    const tipZ = cz * (0.04 + Math.sin(f.tilt) * 0.16);
    addCanopy(g, tipX, tipY + 0.06, tipZ, 0.08, leafColors[i]);
  }
  g.rotation.z = 0.05;
  return g;
}

export const STRESSED_SUCCULENTS: Record<number, () => THREE.Group> = {
  18: buildSaguaroStressed,
  19: buildAloeStressed,
  20: buildCaudiciformStressed,
  21: buildEuphorbiaStressed,
  22: buildIcePlantStressed,
  23: buildEpiphyticStressed,
  36: buildBarrelCactusStressed,
  37: buildJadeStressed,
};

export const STRESSED_SUCCULENTS_LOW: Record<number, () => THREE.Group> = {
  18: buildSaguaroStressedLow,
  19: buildAloeStressedLow,
  20: buildCaudiciformStressedLow,
  21: buildEuphorbiaStressedLow,
  22: buildIcePlantStressedLow,
  23: buildEpiphyticStressedLow,
  36: buildBarrelCactusStressedLow,
  37: buildJadeStressedLow,
};

void jitter; void addCanopy; void addTrunk;
