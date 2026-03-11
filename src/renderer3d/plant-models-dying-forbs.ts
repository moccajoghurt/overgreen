import * as THREE from 'three';
import { mat, matDS, addCanopy, addTrunk, jitter } from './plant-models';

// ── Dying forb variants: bent/collapsed stems, near-horizontal fronds, brown/gray palette ──
// Slots: Wildflower(24), TallHerb(25), Fern(26), Vine(27),
//        Clover(28), Moss(29), TropicalHerb(38), DesertAnnual(39)

// ── Hi-LOD dying builders ──

function buildWildflowerDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying wildflower — stems bent over/collapsed, no flowers, 2-3 wilted leaf shapes

  const stemMat = mat(0x7a6a4a);
  const leafMat = matDS(0x8a7a55);

  // Only 3 stems remaining, heavily bent
  const stems = [
    { x: 0.02, z: 0.04, h: 0.16, lean: 0.8 },
    { x: -0.14, z: 0.08, h: 0.18, lean: -1.1 },
    { x: 0.12, z: -0.12, h: 0.12, lean: 0.6 },
  ];
  for (const s of stems) {
    const stemGeo = new THREE.CylinderGeometry(0.003, 0.005, s.h, 3);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(s.x, s.h / 2 * 0.7, s.z);
    stem.rotation.z = s.lean;
    g.add(stem);
    // Small wilted leaf clinging to stem
    const leafGeo = new THREE.PlaneGeometry(0.025, 0.035);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(
      s.x + Math.sin(s.lean) * s.h * 0.3,
      s.h * 0.5,
      s.z,
    );
    leaf.rotation.x = -0.4;
    leaf.rotation.z = s.lean + 0.5;
    g.add(leaf);
  }

  return g;
}
function buildTallHerbDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying tall herb — main stems heavily bent/broken, very few leaves, no flower plume

  const stemMat = mat(0x7a6a4a);
  const leafMat = matDS(0x8a7a55);

  // 3 stems remaining, heavily bent or broken
  const stems = [
    { x: 0.00, z: 0.00, h: 1.0, lean: 0.9 },
    { x: -0.14, z: 0.10, h: 0.7, lean: -1.2 },
    { x: 0.16, z: -0.08, h: 0.5, lean: 0.7 },
  ];
  for (const s of stems) {
    // Lower stem segment — still mostly upright
    const lowerH = s.h * 0.4;
    const lowerGeo = new THREE.CylinderGeometry(0.007, 0.012, lowerH, 4);
    const lower = new THREE.Mesh(lowerGeo, stemMat);
    lower.position.set(s.x, lowerH / 2, s.z);
    lower.rotation.z = s.lean * 0.2;
    g.add(lower);

    // Upper stem — bent heavily, like it snapped
    const upperH = s.h * 0.5;
    const upperGeo = new THREE.CylinderGeometry(0.005, 0.008, upperH, 3);
    const upper = new THREE.Mesh(upperGeo, stemMat);
    upper.position.set(s.x + Math.sin(s.lean * 0.2) * lowerH * 0.5, lowerH * 0.7, s.z);
    upper.rotation.z = s.lean;
    g.add(upper);

    // One small wilted leaf clinging
    const leafGeo = new THREE.PlaneGeometry(0.018, 0.045, 1, 1);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(s.x, lowerH * 0.6, s.z + 0.015);
    leaf.rotation.z = s.lean * 0.5 + 0.3;
    leaf.rotation.x = -0.3;
    g.add(leaf);
  }

  return g;
}
function buildFernDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying fern — most fronds gone, remaining 4 collapsed flat on ground, heavily browned

  const frondMats = [matDS(0x7a6a4a), matDS(0x8a7a55), matDS(0x6a5a3a), matDS(0x9a8a60)];

  // Dried central crown — shrunken
  const crownGeo = jitter(new THREE.SphereGeometry(0.04, 4, 3), 0.01);
  const crown = new THREE.Mesh(crownGeo, mat(0x5a4a2a));
  crown.position.y = 0.02;
  crown.scale.y = 0.4;
  g.add(crown);

  // Only 4 fronds remaining, collapsed nearly flat
  const frondAngles = [0.3, 1.8, 3.5, 5.2];
  for (let fi = 0; fi < frondAngles.length; fi++) {
    const a = frondAngles[fi];
    const len = 0.25 + Math.random() * 0.08;
    const w = 0.10 + Math.random() * 0.03;

    const geo = new THREE.PlaneGeometry(w, len, 4, 6);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const lx = pos.getX(vi);
      const ly = pos.getY(vi);
      const t = (ly + len / 2) / len;
      // Taper to tip
      const widthMult = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
      pos.setX(vi, lx * widthMult);
      // Curl edges down — dying fronds droop at edges
      const xNorm = Math.abs(lx) / (w / 2);
      pos.setZ(vi, -xNorm * 0.015 + t * 0.005);
    }
    geo.computeVertexNormals();

    const frond = new THREE.Mesh(geo, frondMats[fi]);
    frond.position.set(0, 0, len / 2);
    frond.rotation.x = -Math.PI / 2; // lay flat on ground

    const frondGroup = new THREE.Group();
    frondGroup.add(frond);
    frondGroup.position.set(Math.cos(a) * 0.03, 0.01, Math.sin(a) * 0.03);
    frondGroup.rotation.y = a;
    g.add(frondGroup);
  }

  return g;
}
function buildVineDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying vine — limp bare woody tendrils on ground, very few wilted leaf clusters

  const stemMat = mat(0x6a5a3a);
  const leafMat = matDS(0x8a7a55);

  // 4 bare tendrils meandering limp on the ground
  const armCount = 4;
  for (let ai = 0; ai < armCount; ai++) {
    const baseA = (ai / armCount) * Math.PI * 2 + ai * 0.4;
    const armLen = 0.30 + ai * 0.05;
    const segments = 3;
    let cx = 0, cz = 0;
    let dir = baseA;
    const stepLen = armLen / segments;

    for (let si = 0; si < segments; si++) {
      dir += (si % 2 === 0 ? 0.25 : -0.2);
      const nx = cx + Math.cos(dir) * stepLen;
      const nz = cz + Math.sin(dir) * stepLen;

      // Thin woody stem segment lying on ground
      const segLen = Math.sqrt((nx - cx) ** 2 + (nz - cz) ** 2);
      const segGeo = new THREE.CylinderGeometry(0.006, 0.009, segLen, 3);
      const seg = new THREE.Mesh(segGeo, stemMat);
      seg.position.set((cx + nx) / 2, 0.008, (cz + nz) / 2);
      seg.rotation.z = Math.PI / 2;
      seg.rotation.y = Math.atan2(nz - cz, nx - cx);
      g.add(seg);

      cx = nx;
      cz = nz;
    }

    // Only 1 wilted leaf on every other tendril
    if (ai % 2 === 0) {
      const leafGeo = new THREE.PlaneGeometry(0.05, 0.055);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(cx * 0.6, 0.012, cz * 0.6);
      leaf.rotation.x = -Math.PI / 2 + 0.1;
      leaf.rotation.z = baseA;
      g.add(leaf);
    }
  }

  return g;
}
function buildCloverDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying clover — mostly bare, only 4 brown/wilted trifoliate clusters remain, no flowers

  const petioleMat = mat(0x7a6a4a);
  const leafMats = [matDS(0x8a7a55), matDS(0x9a8a60), matDS(0x7a6a4a)];

  // Just 4 sparse wilted clover spots
  const spots = [
    { x: 0.06, z: 0.08 }, { x: -0.18, z: -0.10 },
    { x: 0.22, z: -0.16 }, { x: -0.08, z: 0.22 },
  ];
  for (let ci = 0; ci < spots.length; ci++) {
    const cs = spots[ci];
    // Short drooping petiole
    const petioleH = 0.02 + Math.random() * 0.01;
    const pGeo = new THREE.CylinderGeometry(0.002, 0.003, petioleH, 3);
    const petiole = new THREE.Mesh(pGeo, petioleMat);
    petiole.position.set(cs.x, petioleH / 2, cs.z);
    petiole.rotation.z = (ci % 2 === 0 ? 0.3 : -0.3);
    g.add(petiole);
    // 3 wilted leaf circles — smaller, browned
    const baseAngle = ci * 1.5;
    for (let li = 0; li < 3; li++) {
      const la = baseAngle + (li / 3) * Math.PI * 2;
      const lGeo = new THREE.CircleGeometry(0.020, 4);
      const leaf = new THREE.Mesh(lGeo, leafMats[li]);
      leaf.position.set(
        cs.x + Math.cos(la) * 0.014,
        petioleH * 0.5 + 0.002,
        cs.z + Math.sin(la) * 0.014,
      );
      leaf.rotation.x = -Math.PI / 2 + 0.2;
      g.add(leaf);
    }
  }

  // 2 dead flower stems — dried brown stumps, no heads
  const deadStems = [{ x: 0.14, z: 0.04 }, { x: -0.20, z: 0.14 }];
  for (const ds of deadStems) {
    const h = 0.04 + Math.random() * 0.02;
    const stemGeo = new THREE.CylinderGeometry(0.003, 0.004, h, 3);
    const stem = new THREE.Mesh(stemGeo, petioleMat);
    stem.position.set(ds.x, h / 2, ds.z);
    stem.rotation.z = 0.5;
    g.add(stem);
  }

  return g;
}
function buildMossDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying moss — ultra-thin patchy remnants, mostly bare, brown-green

  const mossMats = [mat(0x7a6a4a), mat(0x6a5a3a), mat(0x8a7a55)];

  // Only 3 tiny shriveled cushion patches remain
  const patches = [
    { x: 0.00, z: 0.00, r: 0.06 },
    { x: -0.16, z: 0.12, r: 0.05 },
    { x: 0.14, z: -0.14, r: 0.04 },
  ];
  for (let mi = 0; mi < patches.length; mi++) {
    const p = patches[mi];
    const geo = new THREE.SphereGeometry(p.r, 5, 3);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      if (y < 0) pos.setY(vi, y * 0.05);
      else pos.setY(vi, y * 0.12); // Ultra-thin, nearly flat
    }
    geo.computeVertexNormals();
    const bump = new THREE.Mesh(geo, mossMats[mi]);
    bump.position.set(p.x, 0, p.z);
    g.add(bump);
  }

  // 2 dried sporophyte stalks — bent over
  const sporeMat = mat(0x6a5a3a);
  for (let i = 0; i < 2; i++) {
    const a = i * 3.0 + 0.5;
    const r = 0.06 + i * 0.06;
    const h = 0.05;
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.003, h, 3),
      sporeMat,
    );
    stalk.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    stalk.rotation.z = 0.6;
    g.add(stalk);
  }

  return g;
}
function buildTropicalHerbDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying tropical herb — stems bent/collapsed, large leaves drooping/torn, no flowers

  const stemMat = mat(0x6a5a3a);
  const leafMats = [matDS(0x7a6a4a), matDS(0x8a7a55), matDS(0x6a5a3a)];

  // 3 stalks remaining, heavily bent
  const stalks = [
    { x: 0, z: 0, h: 0.35, lean: 0.8 },
    { x: 0.14, z: 0.10, h: 0.28, lean: -1.0 },
    { x: -0.12, z: -0.12, h: 0.24, lean: 0.6 },
  ];
  for (let si = 0; si < stalks.length; si++) {
    const fp = stalks[si];
    // Bent stem
    const sg = new THREE.CylinderGeometry(0.012, 0.016, fp.h, 4);
    const sm = new THREE.Mesh(sg, stemMat);
    sm.position.set(fp.x, fp.h / 2 * 0.6, fp.z);
    sm.rotation.z = fp.lean;
    g.add(sm);

    // 1 collapsed leaf per stalk — large, drooping nearly flat
    const la = si * 2.1 + 0.5;
    const leafLen = 0.16 + Math.random() * 0.06;
    const leafW = 0.07 + Math.random() * 0.02;
    const geo = new THREE.PlaneGeometry(leafW, leafLen, 2, 3);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + leafLen / 2) / leafLen;
      pos.setX(vi, pos.getX(vi) * (1 - t * 0.6)); // taper
      // Torn/curled edges
      pos.setZ(vi, Math.abs(pos.getX(vi)) * -0.03);
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMats[si]);
    leaf.position.set(0, 0, leafLen / 2);
    leaf.rotation.x = -Math.PI / 2 + 0.15; // nearly flat, slight lift

    const leafGrp = new THREE.Group();
    leafGrp.add(leaf);
    leafGrp.position.set(
      fp.x + Math.sin(fp.lean) * fp.h * 0.3,
      fp.h * 0.3,
      fp.z,
    );
    leafGrp.rotation.y = la;
    g.add(leafGrp);
  }

  return g;
}
function buildDesertAnnualDying(): THREE.Group {
  const g = new THREE.Group();
  // Dying desert annual — dried bent stems, no flowers, withered leaves

  const stemMat = mat(0x9a8a60);
  const leafMat = matDS(0x8a7a55);

  // Only 3 dried stems remaining, heavily bent
  const stems = [
    { x: 0.02, z: 0.03, h: 0.13, lean: 0.9 },
    { x: -0.12, z: 0.10, h: 0.11, lean: -0.7 },
    { x: 0.14, z: -0.10, h: 0.10, lean: 1.1 },
  ];
  for (const s of stems) {
    // Dried wiry stem
    const stemGeo = new THREE.CylinderGeometry(0.003, 0.005, s.h, 3);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(s.x, s.h / 2 * 0.7, s.z);
    stem.rotation.z = s.lean;
    g.add(stem);
    // Dried seed pod at tip instead of flower — small brown nub
    const podGeo = new THREE.SphereGeometry(0.010, 3, 2);
    const pod = new THREE.Mesh(podGeo, mat(0x6a5a3a));
    pod.position.set(
      s.x + Math.sin(s.lean) * s.h * 0.45,
      s.h * 0.6,
      s.z,
    );
    g.add(pod);
  }

  // 2 small withered leaf scraps on ground
  for (let i = 0; i < 2; i++) {
    const leafGeo = new THREE.PlaneGeometry(0.022, 0.030);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(
      i === 0 ? -0.06 : 0.08,
      0.008,
      i === 0 ? -0.16 : 0.14,
    );
    leaf.rotation.x = -Math.PI / 2 + 0.15;
    leaf.rotation.z = i * 1.5;
    g.add(leaf);
  }

  return g;
}

// ── Low-LOD dying builders ──

function buildWildflowerDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 3 tiny wilted leaf shapes on ground — minimal
  const leafMat = matDS(0x8a7a55);
  const positions: [number, number, number, number][] = [
    [0.02, 0.03, 0.04, 0.7],
    [-0.14, 0.02, 0.08, -1.0],
    [0.12, 0.02, -0.12, 0.5],
  ];
  for (const [x, y, z, rot] of positions) {
    const geo = new THREE.PlaneGeometry(0.03, 0.04);
    const leaf = new THREE.Mesh(geo, leafMat);
    leaf.position.set(x, y, z);
    leaf.rotation.x = -0.6;
    leaf.rotation.z = rot;
    g.add(leaf);
  }
  return g;
}
function buildTallHerbDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 6 meshes: 3 lower stumps + 3 bent upper stems
  const stemMat = mat(0x7a6a4a);
  const stemData = [
    { x: 0, z: 0, h: 0.4, lean: 0.9 },
    { x: 0.14, z: 0.10, h: 0.3, lean: -1.1 },
    { x: -0.12, z: -0.08, h: 0.25, lean: 0.7 },
  ];
  for (const s of stemData) {
    // Lower stump
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, s.h, 3), stemMat);
    lower.position.set(s.x, s.h / 2, s.z);
    g.add(lower);
    // Bent upper
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, s.h * 0.8, 3), stemMat);
    upper.position.set(s.x, s.h * 0.7, s.z);
    upper.rotation.z = s.lean;
    g.add(upper);
  }
  return g;
}
function buildFernDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 5 meshes: 1 dried crown + 4 flat collapsed frond planes
  const frondMat = matDS(0x7a6a4a);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.04, 3, 2), mat(0x5a4a2a));
  crown.position.y = 0.015;
  crown.scale.y = 0.3;
  g.add(crown);
  const angles = [0.3, 1.8, 3.5, 5.2];
  for (const a of angles) {
    const geo = new THREE.PlaneGeometry(0.09, 0.22, 1, 2);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + 0.11) / 0.22;
      const widthMult = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
      pos.setX(vi, pos.getX(vi) * widthMult);
    }
    geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, frondMat);
    frond.position.set(0, 0, 0.11);
    frond.rotation.x = -Math.PI / 2;
    const fg = new THREE.Group();
    fg.add(frond);
    fg.position.set(Math.cos(a) * 0.03, 0.01, Math.sin(a) * 0.03);
    fg.rotation.y = a;
    g.add(fg);
  }
  return g;
}
function buildVineDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 6 meshes: 4 bare stem segments on ground + 2 wilted leaves
  const stemMat = mat(0x6a5a3a);
  const leafMat = matDS(0x8a7a55);
  const arms: [number, number, number, number][] = [
    [0.18, 0.008, 0.12, 0.4], [-0.20, 0.008, 0.16, 2.0],
    [0.16, 0.008, -0.14, -0.6], [-0.14, 0.008, -0.18, 3.5],
  ];
  for (const [x, y, z, rot] of arms) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.18, 3), stemMat);
    seg.position.set(x, y, z);
    seg.rotation.z = Math.PI / 2;
    seg.rotation.y = rot;
    g.add(seg);
  }
  // 2 wilted leaves
  for (const [x, z, rot] of [[0.10, 0.06, 0.5], [-0.08, -0.10, 2.2]] as [number, number, number][]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.055), leafMat);
    leaf.position.set(x, 0.012, z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rot;
    g.add(leaf);
  }
  return g;
}
function buildCloverDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 4 meshes: 4 small brown leaf discs on ground
  const leafMat = matDS(0x8a7a55);
  const leafPos: [number, number][] = [[0.06, 0.08], [-0.18, -0.10], [0.22, -0.16], [-0.08, 0.22]];
  for (const [x, z] of leafPos) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.04, 4), leafMat);
    leaf.position.set(x, 0.01, z);
    leaf.rotation.x = -Math.PI / 2;
    g.add(leaf);
  }
  return g;
}
function buildMossDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 3 meshes: tiny flat brown patches
  const mossMats = [mat(0x7a6a4a), mat(0x6a5a3a), mat(0x8a7a55)];
  const positions: [number, number][] = [[0, 0], [-0.16, 0.12], [0.14, -0.14]];
  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i];
    const geo = new THREE.SphereGeometry(0.055, 4, 2);
    geo.scale(1, 0.08, 1);
    const bump = new THREE.Mesh(geo, mossMats[i]);
    bump.position.set(x, 0.002, z);
    g.add(bump);
  }
  return g;
}
function buildTropicalHerbDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 6 meshes: 3 bent stems + 3 collapsed leaf planes
  const stemMat = mat(0x6a5a3a);
  const leafMat = matDS(0x7a6a4a);
  const stalks: [number, number, number, number][] = [
    [0, 0, 0.30, 0.8], [0.14, 0.10, 0.24, -1.0], [-0.12, -0.12, 0.20, 0.6],
  ];
  for (const [x, z, h, lean] of stalks) {
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, h, 3), stemMat);
    sm.position.set(x, h / 2 * 0.6, z);
    sm.rotation.z = lean;
    g.add(sm);
    // Collapsed leaf
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.14), leafMat);
    leaf.position.set(x + Math.sin(lean) * h * 0.2, h * 0.2, z);
    leaf.rotation.x = -Math.PI / 2 + 0.15;
    leaf.rotation.z = lean * 0.5;
    g.add(leaf);
  }
  return g;
}
function buildDesertAnnualDyingLow(): THREE.Group {
  const g = new THREE.Group();
  // 5 meshes: 3 bent dried stems + 2 withered leaf scraps
  const stemMat = mat(0x9a8a60);
  const leafMat = matDS(0x8a7a55);
  const stems: [number, number, number, number][] = [
    [0.02, 0.03, 0.11, 0.9], [-0.12, 0.10, 0.09, -0.7], [0.14, -0.10, 0.08, 1.1],
  ];
  for (const [x, z, h, lean] of stems) {
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, h, 3), stemMat);
    sm.position.set(x, h / 2 * 0.7, z);
    sm.rotation.z = lean;
    g.add(sm);
  }
  for (const [x, z, rot] of [[-0.06, -0.16, 0], [0.08, 0.14, 1.5]] as [number, number, number][]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.030), leafMat);
    leaf.position.set(x, 0.008, z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = rot;
    g.add(leaf);
  }
  return g;
}

export const DYING_FORBS: Record<number, () => THREE.Group> = {
  24: buildWildflowerDying,
  25: buildTallHerbDying,
  26: buildFernDying,
  27: buildVineDying,
  28: buildCloverDying,
  29: buildMossDying,
  38: buildTropicalHerbDying,
  39: buildDesertAnnualDying,
};

export const DYING_FORBS_LOW: Record<number, () => THREE.Group> = {
  24: buildWildflowerDyingLow,
  25: buildTallHerbDyingLow,
  26: buildFernDyingLow,
  27: buildVineDyingLow,
  28: buildCloverDyingLow,
  29: buildMossDyingLow,
  38: buildTropicalHerbDyingLow,
  39: buildDesertAnnualDyingLow,
};

void jitter; void matDS; void addCanopy; void addTrunk;
