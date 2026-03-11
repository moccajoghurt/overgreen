import * as THREE from 'three';
import { mat, matDS, addCanopy, addTrunk, jitter } from './plant-models';

// ── Stressed forb variants: bent stems, flowers removed, yellow-olive palette ──
// Slots: Wildflower(24), TallHerb(25), Fern(26), Vine(27),
//        Clover(28), Moss(29), TropicalHerb(38), DesertAnnual(39)

// ── Hi-LOD stressed builders ──

function buildWildflowerStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed wildflower — no flowers, just wilting stems with dried tips

  const stemMat = mat(0x88993a);
  const tipMat = mat(0xaaaa55);

  // Only 5 stems (down from 8), shorter, slight lean
  const stems = [
    { x: 0.02, z: 0.04, h: 0.17, lean: 0.15 },
    { x: -0.14, z: 0.08, h: 0.20, lean: -0.2 },
    { x: 0.12, z: -0.12, h: 0.15, lean: 0.1 },
    { x: -0.06, z: -0.18, h: 0.19, lean: 0.18 },
    { x: 0.20, z: 0.14, h: 0.13, lean: -0.12 },
  ];
  for (const s of stems) {
    // Thin wilting stem
    const stemGeo = new THREE.CylinderGeometry(0.003, 0.005, s.h, 3);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(s.x, s.h / 2, s.z);
    stem.rotation.z = s.lean;
    g.add(stem);
    // Dried bud tip instead of flower — small dark nub
    const tipGeo = new THREE.SphereGeometry(0.012, 3, 2);
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(s.x + Math.sin(s.lean) * s.h * 0.5, s.h * 0.95, s.z);
    g.add(tip);
  }

  return g;
}
function buildTallHerbStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed goldenrod — no flower plumes, wilting stems, yellow-olive leaves

  const stemMat = mat(0x88993a);
  const leafMat = matDS(0x8a9a3a);

  // 4 stems (down from 6), shorter, leaning
  const stems = [
    { x: 0.00, z: 0.00, h: 1.2, lean: 0.12 },
    { x: -0.14, z: 0.10, h: 1.0, lean: -0.18 },
    { x: 0.16, z: -0.08, h: 1.1, lean: 0.15 },
    { x: -0.08, z: -0.16, h: 0.85, lean: -0.1 },
  ];
  for (const s of stems) {
    const stemGeo = new THREE.CylinderGeometry(0.007, 0.012, s.h, 4);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(s.x, s.h / 2, s.z);
    stem.rotation.z = s.lean;
    g.add(stem);
    // 1-2 drooping leaves per stem
    for (let li = 0; li < 2; li++) {
      const ly = 0.15 + (li / 2) * s.h * 0.35;
      const side = li % 2 === 0 ? 1 : -1;
      const lGeo = new THREE.PlaneGeometry(0.018, 0.05, 1, 1);
      const leaf = new THREE.Mesh(lGeo, leafMat);
      leaf.position.set(s.x + side * 0.010, ly, s.z);
      leaf.rotation.z = side * 0.9; // droopier than healthy
      leaf.rotation.y = Math.atan2(s.z, s.x) + side * 0.8;
      g.add(leaf);
    }
    // Dried tip instead of flower plume — small brown nub
    const tipGeo = new THREE.SphereGeometry(0.015, 3, 2);
    const tip = new THREE.Mesh(tipGeo, mat(0xa0a840));
    tip.position.set(s.x + Math.sin(s.lean) * s.h * 0.5, s.h * 0.95, s.z);
    tip.scale.y = 1.5;
    g.add(tip);
  }

  return g;
}
function buildFernStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed fern — fewer fronds, drooping, tips curl, yellow-olive

  const frondMats = [matDS(0x88993a), matDS(0x8a9a3a), matDS(0x99aa44), matDS(0xa0a840)];

  // Central crown — slightly exposed
  const crownGeo = jitter(new THREE.SphereGeometry(0.06, 5, 4), 0.015);
  const crown = new THREE.Mesh(crownGeo, mat(0x6a5a3a));
  crown.position.y = 0.04;
  crown.scale.y = 0.6;
  g.add(crown);

  // Only 2 tiers (drop innermost), fewer fronds per tier, drooping
  const tiers = [
    { count: 4, len: 0.30, w: 0.13, yBase: 0.04, offset: 0.0, droop: 0.35 },
    { count: 6, len: 0.38, w: 0.15, yBase: 0.02, offset: 0.15, droop: 0.55 },
  ];

  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti];
    for (let fi = 0; fi < tier.count; fi++) {
      const a = (fi / tier.count) * Math.PI * 2 + tier.offset;
      const frondMat = frondMats[(fi + ti) % frondMats.length];
      const len = tier.len + (Math.random() - 0.5) * 0.06;
      const w = tier.w + (Math.random() - 0.5) * 0.03;

      // Tapered plane with curling tips
      const geo = new THREE.PlaneGeometry(w, len, 5, 7);
      const pos = geo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const lx = pos.getX(vi);
        const ly = pos.getY(vi);
        const t = (ly + len / 2) / len;
        // Diamond taper
        const widthMult = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
        pos.setX(vi, lx * widthMult);
        // Serrated edge
        const xNorm = Math.abs(lx) / (w / 2);
        if (xNorm > 0.3) {
          const serration = Math.sin(t * 14) * 0.010 * xNorm;
          pos.setX(vi, pos.getX(vi) + serration);
        }
        // Tip curl — Z bends upward at tips
        const curl = t > 0.7 ? (t - 0.7) / 0.3 : 0;
        pos.setZ(vi, (1 - xNorm) * 0.010 + t * 0.006 + curl * 0.04);
      }
      geo.computeVertexNormals();

      const frond = new THREE.Mesh(geo, frondMat);
      frond.position.set(0, 0, len / 2);
      frond.rotation.x = -Math.PI / 2 + tier.droop; // droop down

      const frondGroup = new THREE.Group();
      frondGroup.add(frond);
      frondGroup.position.set(Math.cos(a) * 0.04, tier.yBase, Math.sin(a) * 0.04);
      frondGroup.rotation.y = a;
      g.add(frondGroup);
    }
  }

  return g;
}
function buildVineStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed vine — fewer leaves, no buds/berries, sagging stems, yellow-olive

  const stemMat = mat(0x6a5a3a);
  const leafMats = [matDS(0x88993a), matDS(0x8a9a3a), matDS(0x99aa44)];

  // 3 tendrils (down from 5), sagging closer to ground
  const armCount = 3;
  for (let ai = 0; ai < armCount; ai++) {
    const baseA = (ai / armCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const armLen = 0.30 + Math.random() * 0.14;
    const segments = 3; // fewer segments
    let cx = 0, cz = 0;
    let dir = baseA;
    const stepLen = armLen / segments;

    for (let si = 0; si < segments; si++) {
      dir += (Math.random() - 0.5) * 0.35;
      const nx = cx + Math.cos(dir) * stepLen;
      const nz = cz + Math.sin(dir) * stepLen;

      // Thin stem segment
      const segLen = Math.sqrt((nx - cx) ** 2 + (nz - cz) ** 2);
      const segGeo = new THREE.CylinderGeometry(0.007, 0.009, segLen, 3);
      const seg = new THREE.Mesh(segGeo, stemMat);
      seg.position.set((cx + nx) / 2, 0.012, (cz + nz) / 2);
      seg.rotation.z = Math.PI / 2;
      seg.rotation.y = Math.atan2(nz - cz, nx - cx);
      g.add(seg);

      // Only every other node gets a leaf (sparse)
      if (si % 2 === 0) {
        const leafSize = 0.055 + Math.random() * 0.02;
        const lGeo = new THREE.PlaneGeometry(leafSize, leafSize * 1.0);
        const leaf = new THREE.Mesh(lGeo, leafMats[si % 3]);
        const leafSide = si % 2 === 0 ? 1 : -1;
        const off = leafSize * 0.25;
        leaf.position.set(
          nx + Math.cos(dir + leafSide * Math.PI / 2) * off,
          0.015,
          nz + Math.sin(dir + leafSide * Math.PI / 2) * off,
        );
        leaf.rotation.x = -Math.PI / 2;
        leaf.rotation.z = dir + leafSide * 0.4;
        g.add(leaf);
      }

      cx = nx;
      cz = nz;
    }
    // No bud/berry at tip — just a dried stem end
  }

  // Sparse center — only 2 leaves
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2;
    const r = 0.02 + Math.random() * 0.04;
    const leafSize = 0.05 + Math.random() * 0.02;
    const geo = new THREE.PlaneGeometry(leafSize, leafSize * 1.0);
    const leaf = new THREE.Mesh(geo, leafMats[i % 3]);
    leaf.position.set(Math.cos(a) * r, 0.018, Math.sin(a) * r);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = a + Math.random() * 0.5;
    g.add(leaf);
  }

  return g;
}
function buildCloverStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed clover — sparser patches, no flowers, browning yellow-olive leaves

  const petioleMat = mat(0x88993a);
  const leafMats = [matDS(0x8a9a3a), matDS(0x99aa44), matDS(0xa0a840)];

  // Only 8 trifoliate clusters (down from 12), some with only 2 leaflets
  const cloverSpots = [
    { x: 0, z: 0, leaves: 3 }, { x: 0.20, z: 0.15, leaves: 2 },
    { x: -0.18, z: 0.20, leaves: 3 }, { x: -0.15, z: -0.18, leaves: 2 },
    { x: 0.22, z: -0.12, leaves: 3 }, { x: -0.28, z: 0.0, leaves: 2 },
    { x: 0.0, z: -0.26, leaves: 3 }, { x: 0.0, z: 0.28, leaves: 2 },
  ];
  for (let ci = 0; ci < cloverSpots.length; ci++) {
    const cs = cloverSpots[ci];
    const petioleH = 0.025 + Math.random() * 0.015;
    const pGeo = new THREE.CylinderGeometry(0.003, 0.004, petioleH, 3);
    const petiole = new THREE.Mesh(pGeo, petioleMat);
    petiole.position.set(cs.x, petioleH / 2, cs.z);
    g.add(petiole);
    const baseAngle = ci * 1.3;
    for (let li = 0; li < cs.leaves; li++) {
      const la = baseAngle + (li / 3) * Math.PI * 2;
      const lGeo = new THREE.CircleGeometry(0.024, 5);
      const leaf = new THREE.Mesh(lGeo, leafMats[li % 3]);
      leaf.position.set(cs.x + Math.cos(la) * 0.016, petioleH + 0.002, cs.z + Math.sin(la) * 0.016);
      leaf.rotation.x = -Math.PI / 2;
      g.add(leaf);
    }
  }

  // No flowers at all — just bare stems where flowers used to be
  const deadStemSpots = [
    { x: 0.02, z: 0.04 }, { x: -0.16, z: 0.18 }, { x: 0.22, z: -0.10 },
    { x: -0.08, z: -0.22 }, { x: 0.28, z: 0.16 },
  ];
  for (const fp of deadStemSpots) {
    const stemH = 0.06 + Math.random() * 0.04;
    const stemGeo = new THREE.CylinderGeometry(0.003, 0.004, stemH, 3);
    const stem = new THREE.Mesh(stemGeo, petioleMat);
    stem.position.set(fp.x, stemH / 2, fp.z);
    stem.rotation.z = (Math.random() - 0.5) * 0.3; // slight lean
    g.add(stem);
  }

  return g;
}
function buildMossStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed moss — thinner cushions, bare patches, duller yellow-olive

  const mossVariety = [mat(0x88993a), mat(0x8a9a3a), mat(0x99aa44), mat(0xa0a840)];

  // Fewer, smaller mounds (5 instead of 8) — gaps = bare patches
  const mounds = [
    { x: 0.00, z: 0.00, r: 0.08 }, { x: -0.18, z: 0.14, r: 0.06 },
    { x: 0.20, z: -0.10, r: 0.07 }, { x: -0.10, z: -0.20, r: 0.05 },
    { x: 0.14, z: 0.18, r: 0.05 },
  ];

  for (let mi = 0; mi < mounds.length; mi++) {
    const m = mounds[mi];
    const geo = jitter(new THREE.SphereGeometry(m.r, 5, 3), m.r * 0.12);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi);
      if (y < 0) pos.setY(vi, y * 0.06);
      else pos.setY(vi, y * 0.25); // Even flatter than healthy
    }
    geo.computeVertexNormals();
    const bump = new THREE.Mesh(geo, mossVariety[mi % mossVariety.length]);
    bump.position.set(m.x, 0, m.z);
    g.add(bump);
  }

  // Only 2 sporophyte stalks (down from 5), leaning
  const sporeMat = mat(0x8a6633);
  const capMat = mat(0x7a5522);
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 0.5;
    const r = 0.06 + Math.random() * 0.10;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r;
    const h = 0.06 + Math.random() * 0.03;
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.003, h, 3),
      sporeMat,
    );
    stalk.position.set(sx, h / 2, sz);
    stalk.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(stalk);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.007, 3, 2), capMat);
    cap.position.set(sx, h, sz);
    cap.scale.y = 1.3;
    g.add(cap);
  }

  return g;
}
function buildTropicalHerbStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed heliconia — fewer stalks, no flower bracts, wilting leaves
  const leafMats = [matDS(0x88993a), matDS(0x8a9a3a), matDS(0x99aa44)];
  const stemMat = mat(0x7a8a55);
  const stalks = [
    { x: 0, z: 0, h: 0.42, lean: 0.08 },
    { x: 0.16, z: 0.12, h: 0.36, lean: -0.1 },
    { x: -0.14, z: 0.15, h: 0.38, lean: 0.12 },
    { x: -0.12, z: -0.14, h: 0.32, lean: -0.06 },
    { x: 0.18, z: -0.10, h: 0.30, lean: 0.1 },
  ];
  for (let si = 0; si < stalks.length; si++) {
    const fp = stalks[si];
    const sg = new THREE.CylinderGeometry(0.012, 0.016, fp.h, 4);
    const sm = new THREE.Mesh(sg, stemMat);
    sm.position.set(fp.x, fp.h / 2, fp.z);
    sm.rotation.z = fp.lean;
    g.add(sm);
    const la = si * 1.7 + Math.random() * 0.3;
    const leafLen = 0.15 + Math.random() * 0.06;
    const leafW = 0.06 + Math.random() * 0.02;
    const geo = new THREE.PlaneGeometry(leafW, leafLen, 2, 4);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + leafLen / 2) / leafLen;
      pos.setX(vi, pos.getX(vi) * (1 - t * 0.5));
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMats[si % leafMats.length]);
    leaf.position.set(0, 0, leafLen / 2);
    leaf.rotation.x = -Math.PI / 3;
    const leafGrp = new THREE.Group();
    leafGrp.add(leaf);
    leafGrp.position.set(fp.x, fp.h * 0.4, fp.z);
    leafGrp.rotation.y = la;
    g.add(leafGrp);
  }
  return g;
}
function buildDesertAnnualStressed(): THREE.Group {
  const g = new THREE.Group();
  // Stressed poppy — no flowers, just dried stems with seed pods
  const stemMat = mat(0x88993a);
  const podMat = mat(0xaaaa55);
  const stems = [
    { x: 0.02, z: 0.03, h: 0.14, lean: 0.12 },
    { x: -0.12, z: 0.10, h: 0.12, lean: -0.15 },
    { x: 0.14, z: -0.10, h: 0.11, lean: 0.1 },
    { x: -0.06, z: -0.16, h: 0.13, lean: 0.18 },
    { x: 0.18, z: 0.12, h: 0.10, lean: -0.08 },
  ];
  for (const s of stems) {
    const sg = new THREE.CylinderGeometry(0.003, 0.005, s.h, 3);
    const sm = new THREE.Mesh(sg, stemMat);
    sm.position.set(s.x, s.h / 2, s.z);
    sm.rotation.z = s.lean;
    g.add(sm);
    // Dried seed pod instead of flower
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.015, 3, 2), podMat);
    pod.position.set(s.x + Math.sin(s.lean) * s.h * 0.4, s.h * 0.9, s.z);
    pod.scale.y = 1.8;
    g.add(pod);
  }
  return g;
}

// ── Low-LOD stressed builders ──

function buildWildflowerStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 4 small dried nubs — no flowers, just withered tips
  const tipMat = mat(0xaaaa55);
  const positions: [number, number, number][] = [
    [0.02, 0.14, 0.04], [-0.14, 0.17, 0.08], [0.12, 0.12, -0.12], [-0.06, 0.16, -0.18],
  ];
  for (const [x, y, z] of positions) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 3, 2), tipMat);
    tip.position.set(x, y, z);
    g.add(tip);
  }
  return g;
}
function buildTallHerbStressedLow(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x88993a);
  const tipMat = mat(0xa0a840);
  // 3 leaning stems + 3 dried tips = 6 meshes
  const stemData = [
    { x: 0, z: 0, h: 1.1, lean: 0.12 },
    { x: 0.14, z: 0.10, h: 0.95, lean: -0.15 },
    { x: -0.12, z: -0.08, h: 0.85, lean: 0.1 },
  ];
  for (const s of stemData) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, s.h, 3), stemMat);
    stem.position.set(s.x, s.h / 2, s.z);
    stem.rotation.z = s.lean;
    g.add(stem);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 3, 2), tipMat);
    tip.position.set(s.x + Math.sin(s.lean) * s.h * 0.5, s.h * 0.93, s.z);
    tip.scale.y = 1.4;
    g.add(tip);
  }
  return g;
}
function buildFernStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 7 meshes: 1 crown + 6 drooping frond planes
  const frondMat = matDS(0x8a9a3a);
  const crown = new THREE.Mesh(jitter(new THREE.SphereGeometry(0.06, 4, 3), 0.01), mat(0x6a5a3a));
  crown.position.y = 0.04;
  crown.scale.y = 0.6;
  g.add(crown);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const len = 0.34;
    const w = 0.13;
    const geo = new THREE.PlaneGeometry(w, len, 2, 4);
    const pos = geo.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getY(vi) + len / 2) / len;
      const widthMult = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
      pos.setX(vi, pos.getX(vi) * widthMult);
    }
    geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, frondMat);
    frond.position.set(0, 0, len / 2);
    frond.rotation.x = -Math.PI / 2 + 0.45; // droop
    const fg = new THREE.Group();
    fg.add(frond);
    fg.position.set(Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04);
    fg.rotation.y = a;
    g.add(fg);
  }
  return g;
}
function buildVineStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 4 sparse leaves flat on ground — no buds, yellow-olive
  const leafMats = [matDS(0x88993a), matDS(0x99aa44)];
  const positions: [number, number, number][] = [
    [0, 0, 0.015], [0.18, 0.14, 0.015], [-0.16, 0.18, 0.015], [0.20, -0.12, 0.015],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, z, y] = positions[i];
    const geo = new THREE.PlaneGeometry(0.07, 0.08, 1, 1);
    const leaf = new THREE.Mesh(geo, leafMats[i % 2]);
    leaf.position.set(x, y, z);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = i * 1.5;
    g.add(leaf);
  }
  return g;
}
function buildCloverStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 8 meshes: 5 small leaf discs + 3 bare stem stubs — no flowers
  const leafMat = matDS(0x8a9a3a);
  const stemMat = mat(0x88993a);
  const leafPos: [number, number][] = [[0, 0], [0.20, 0.15], [-0.18, 0.20], [-0.15, -0.18], [0.22, -0.12]];
  for (const [x, z] of leafPos) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.05, 5), leafMat);
    leaf.position.set(x, 0.02, z);
    leaf.rotation.x = -Math.PI / 2;
    g.add(leaf);
  }
  // Bare stems
  const stemPos: [number, number][] = [[0.02, 0.04], [-0.16, 0.18], [0.28, 0.16]];
  for (const [x, z] of stemPos) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.07, 3), stemMat);
    stem.position.set(x, 0.035, z);
    g.add(stem);
  }
  return g;
}
function buildMossStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 4 small flat cushion domes — sparser, duller
  const mossMats = [mat(0x88993a), mat(0x8a9a3a), mat(0x99aa44)];
  const positions = [
    [0, 0], [-0.16, 0.12], [0.18, -0.10], [-0.08, -0.18],
  ];
  for (let i = 0; i < positions.length; i++) {
    const [x, z] = positions[i];
    const geo = new THREE.SphereGeometry(0.08, 4, 3);
    geo.scale(1, 0.15, 1);
    const bump = new THREE.Mesh(geo, mossMats[i % 3]);
    bump.position.set(x, 0.004, z);
    g.add(bump);
  }
  return g;
}
function buildTropicalHerbStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 4 stems + 4 droopy leaves = 8 meshes
  const stemMat = mat(0x7a8a55);
  const leafMat = matDS(0x88993a);
  const stalks = [
    { x: 0, z: 0, h: 0.38 }, { x: 0.14, z: 0.10, h: 0.32 },
    { x: -0.12, z: 0.12, h: 0.34 }, { x: -0.10, z: -0.12, h: 0.28 },
  ];
  for (let si = 0; si < stalks.length; si++) {
    const fp = stalks[si];
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, fp.h, 3), stemMat);
    sm.position.set(fp.x, fp.h / 2, fp.z);
    g.add(sm);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.12), leafMat);
    leaf.position.set(fp.x, fp.h * 0.5, fp.z + 0.04);
    leaf.rotation.x = -0.8;
    leaf.rotation.y = si * 1.5;
    g.add(leaf);
  }
  return g;
}
function buildDesertAnnualStressedLow(): THREE.Group {
  const g = new THREE.Group();
  // 4 dried pods on stems
  const stemMat = mat(0x88993a);
  const podMat = mat(0xaaaa55);
  const stems = [
    [0.02, 0.12, 0.03], [-0.12, 0.10, 0.10],
    [0.14, 0.09, -0.10], [-0.06, 0.11, -0.16],
  ];
  for (const [x, h, z] of stems) {
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, h, 3), stemMat);
    sm.position.set(x, h / 2, z);
    g.add(sm);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.014, 3, 2), podMat);
    pod.position.set(x, h * 0.85, z);
    pod.scale.y = 1.6;
    g.add(pod);
  }
  return g;
}

export const STRESSED_FORBS: Record<number, () => THREE.Group> = {
  24: buildWildflowerStressed,
  25: buildTallHerbStressed,
  26: buildFernStressed,
  27: buildVineStressed,
  28: buildCloverStressed,
  29: buildMossStressed,
  38: buildTropicalHerbStressed,
  39: buildDesertAnnualStressed,
};

export const STRESSED_FORBS_LOW: Record<number, () => THREE.Group> = {
  24: buildWildflowerStressedLow,
  25: buildTallHerbStressedLow,
  26: buildFernStressedLow,
  27: buildVineStressedLow,
  28: buildCloverStressedLow,
  29: buildMossStressedLow,
  38: buildTropicalHerbStressedLow,
  39: buildDesertAnnualStressedLow,
};

void jitter; void matDS; void addCanopy; void addTrunk;
