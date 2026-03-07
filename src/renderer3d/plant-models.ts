import * as THREE from 'three';

// ── Helpers (ported from plant-gallery.html) ──

export function jitter(geo: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * amount);
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * amount);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

export function grassBlade(h: number, w: number, bend: number, twist = 0): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 1, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + h / 2) / h;
    pos.setZ(i, bend * t * t);
    pos.setX(i, pos.getX(i) * (1 - 0.6 * t) + twist * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Material helper — roughness is cosmetic for gallery; sim only reads color channel. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mat(color: number, extra?: Record<string, any>): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(Object.assign(
    { color, roughness: 0.85, flatShading: true }, extra,
  ));
}

export function matDS(color: number): THREE.MeshStandardMaterial {
  return mat(color, { side: THREE.DoubleSide });
}

export function addCanopy(group: THREE.Group, x: number, y: number, z: number, radius: number, color = 0x2d5a1e): THREE.Mesh {
  const geo = jitter(new THREE.IcosahedronGeometry(radius, 1), radius * 0.15);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

export function addTrunk(group: THREE.Group, x: number, y: number, z: number, rBot: number, rTop: number, h: number, color = 0x6a4a2a): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 7);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y + h / 2, z);
  group.add(m);
  return m;
}

// ── Builders (24 subtypes) ──

function buildTurfgrass(): THREE.Group {
  const g = new THREE.Group();
  const bm = matDS(0x4a8a3a);
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.3;
    const h = 0.12 + Math.random() * 0.08;
    const geo = grassBlade(h, 0.03, 0.02 * (Math.random() - 0.5));
    const m = new THREE.Mesh(geo, bm);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    g.add(m);
  }
  return g;
}

function buildTallgrass(): THREE.Group {
  const g = new THREE.Group();
  const bm = matDS(0x3a7a4a);
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.25;
    const h = 1.2 + Math.random() * 0.8;
    const bend = 0.3 + Math.random() * 0.4;
    const geo = grassBlade(h, 0.06, bend, (Math.random() - 0.5) * 0.15);
    const m = new THREE.Mesh(geo, bm);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI;
    g.add(m);
  }
  const sm = mat(0x8a6a4a);
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.ConeGeometry(0.02, 0.15, 4);
    const m = new THREE.Mesh(geo, sm);
    m.position.set((Math.random() - 0.5) * 0.3, 1.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
    g.add(m);
  }
  return g;
}

function buildBunchgrass(): THREE.Group {
  const g = new THREE.Group();
  const bm = matDS(0x6a8a6a);
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.15;
    const h = 0.4 + Math.random() * 0.35;
    const bend = 0.2 + Math.random() * 0.3;
    const geo = grassBlade(h, 0.02, bend);
    const m = new THREE.Mesh(geo, bm);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.rotation.y = a + (Math.random() - 0.5) * 0.5;
    g.add(m);
  }
  return g;
}

function buildBamboo(): THREE.Group {
  const g = new THREE.Group();
  const culmMat = mat(0x8aaa3a);
  const leafMat = matDS(0x2a6a2a);
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
    for (let l = 0; l < 6; l++) {
      const la = l * Math.PI / 3 + Math.random() * 0.3;
      const leaf = new THREE.Mesh(grassBlade(0.4, 0.06, 0.2), leafMat);
      leaf.position.set(cx + Math.cos(la) * 0.1, totalH, cz + Math.sin(la) * 0.1);
      leaf.rotation.y = la;
      leaf.rotation.z = 0.3;
      g.add(leaf);
    }
  }
  return g;
}

function buildSpreading(): THREE.Group {
  const g = new THREE.Group();
  const bm = matDS(0x4a8a3a);
  const sm = mat(0x6a7a3a);
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
      for (let k = 0; k < 4; k++) {
        const h = 0.1 + Math.random() * 0.07;
        const geo = grassBlade(h, 0.02, 0.01);
        const m = new THREE.Mesh(geo, bm);
        m.position.set(sx + (Math.random() - 0.5) * 0.05, h / 2, sz + (Math.random() - 0.5) * 0.05);
        m.rotation.y = Math.random() * Math.PI;
        g.add(m);
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const h = 0.1 + Math.random() * 0.06;
    const geo = grassBlade(h, 0.025, 0.01);
    const m = new THREE.Mesh(geo, bm);
    m.position.set((Math.random() - 0.5) * 0.1, h / 2, (Math.random() - 0.5) * 0.1);
    m.rotation.y = Math.random() * Math.PI;
    g.add(m);
  }
  return g;
}

function buildSedge(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x5a9a4a);
  const umbMat = matDS(0x3a8a3a);
  for (let i = 0; i < 5; i++) {
    const sx = (Math.random() - 0.5) * 0.3;
    const sz = (Math.random() - 0.5) * 0.3;
    const h = 1.5 + Math.random() * 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 3), stemMat);
    stem.position.set(sx, h / 2, sz);
    g.add(stem);
    for (let j = 0; j < 14; j++) {
      const ba = j * Math.PI * 2 / 14;
      const bract = new THREE.Mesh(grassBlade(0.5, 0.012, 0.3), umbMat);
      bract.position.set(sx + Math.cos(ba) * 0.03, h, sz + Math.sin(ba) * 0.03);
      bract.rotation.y = ba;
      bract.rotation.z = -0.2;
      g.add(bract);
    }
  }
  return g;
}

function buildOak(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.2, 0.12, 1.2, 0x5a3a1a);
  const t1 = addTrunk(g, -0.15, 1.0, 0, 0.08, 0.05, 0.7, 0x5a3a1a);
  t1.rotation.z = 0.6;
  const t2 = addTrunk(g, 0.15, 1.0, 0.1, 0.08, 0.05, 0.65, 0x5a3a1a);
  t2.rotation.z = -0.5;
  const t3 = addTrunk(g, 0, 1.0, -0.15, 0.07, 0.04, 0.5, 0x5a3a1a);
  t3.rotation.x = 0.5;
  addCanopy(g, 0, 1.9, 0, 0.75, 0x2a5a1a);
  addCanopy(g, -0.6, 1.7, 0.15, 0.5, 0x2d5a1e);
  addCanopy(g, 0.55, 1.65, -0.1, 0.48, 0x2a5a1a);
  addCanopy(g, 0.1, 1.55, 0.45, 0.4, 0x335a22);
  addCanopy(g, -0.3, 2.0, -0.35, 0.38, 0x2d5a1e);
  return g;
}

function buildMagnolia(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.12, 0.08, 1.0, 0x6a5a4a);
  const geo = jitter(new THREE.SphereGeometry(0.8, 8, 6), 0.08);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * 1.3);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(0x1a4a1a));
  m.position.set(0, 1.8, 0);
  g.add(m);
  return g;
}

function buildConifer(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.1, 0.06, 1.5, 0x8a4a2a);
  const nm = mat(0x1a4a2a);
  for (let i = 0; i < 5; i++) {
    const y = 0.7 + i * 0.35;
    const r = 0.75 - i * 0.14;
    const h = 0.35;
    const cone = new THREE.Mesh(jitter(new THREE.ConeGeometry(r, h, 7), 0.04), nm);
    cone.position.set(0, y, 0);
    g.add(cone);
  }
  return g;
}

function buildTropical(): THREE.Group {
  const g = new THREE.Group();
  addTrunk(g, 0, 0, 0, 0.15, 0.08, 2.2, 0x6a5a4a);
  const buttMat = mat(0x6a5a4a);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.3;
    const geo = new THREE.CylinderGeometry(0.015, 0.07, 0.5, 4);
    const m = new THREE.Mesh(geo, buttMat);
    m.position.set(Math.cos(a) * 0.13, 0.2, Math.sin(a) * 0.13);
    m.rotation.z = Math.cos(a) * 0.35;
    m.rotation.x = Math.sin(a) * 0.35;
    g.add(m);
  }
  addCanopy(g, 0, 2.6, 0, 0.7, 0x2a6a2a);
  addCanopy(g, 0.3, 2.4, 0.2, 0.4, 0x2d6a25);
  addCanopy(g, -0.25, 2.5, -0.2, 0.38, 0x2a6a2a);
  return g;
}

function buildPalm(): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.6, 0.03),
    new THREE.Vector3(0.12, 1.3, 0),
    new THREE.Vector3(0.08, 1.9, -0.02),
    new THREE.Vector3(0.05, 2.3, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.06, 6, false), mat(0x8a7a6a)));
  const ringMat = mat(0x7a6a5a);
  for (let ri = 1; ri < 8; ri++) {
    const pt = curve.getPoint(ri / 8);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.01, 4, 8), ringMat);
    ring.position.copy(pt);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const fm = matDS(0x4a8a2a);
  const topY = 2.3, topX = 0.05;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8;
    const fLen = 1.1 + Math.random() * 0.2;
    const fGeo = new THREE.PlaneGeometry(0.25, fLen, 1, 8);
    const fPos = fGeo.attributes.position;
    for (let vi = 0; vi < fPos.count; vi++) {
      const origY = fPos.getY(vi);
      const t = (origY + fLen / 2) / fLen;
      fPos.setX(vi, fPos.getX(vi) * (1 - 0.65 * t));
      fPos.setY(vi, t * 0.2 - t * t * fLen * 0.45);
      fPos.setZ(vi, t * fLen * 0.85);
    }
    fGeo.computeVertexNormals();
    const frond = new THREE.Mesh(fGeo, fm);
    frond.position.set(topX, topY, 0);
    frond.rotation.y = a;
    g.add(frond);
  }
  return g;
}

function buildBirch(): THREE.Group {
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
    addCanopy(g, Math.cos(a) * len * 0.6, y - 0.1, Math.sin(a) * len * 0.6, 0.2, 0x5aaa3a);
  }
  addCanopy(g, 0, 1.85, 0, 0.35, 0x5aaa3a);
  return g;
}

function buildEvergreenShrub(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x5a3a1a);
  const clusters: [number, number, number, number][] = [
    [0, 0, 0.45, 0.32],
    [-0.2, 0.1, 0.4, 0.25],
    [0.22, 0.05, 0.38, 0.24],
    [0.05, -0.18, 0.42, 0.26],
    [-0.1, 0.2, 0.35, 0.22],
    [0.15, -0.1, 0.5, 0.28],
  ];
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cz, cy, cr] = clusters[i];
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, cy, 4), stemMat);
    stem.position.set(cx * 0.3, cy / 2, cz * 0.3);
    const lean = 0.2;
    stem.rotation.z = cx * lean;
    stem.rotation.x = cz * lean;
    g.add(stem);
    addCanopy(g, cx, cy, cz, cr, 0x2a5a2a + (i % 3) * 0x020200);
  }
  return g;
}

function buildDeciduousShrub(): THREE.Group {
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
    addCanopy(g, tip.x, tip.y, tip.z, 0.2, 0x4a7a3a);
    const mid = curve.getPoint(0.6);
    addCanopy(g, mid.x, mid.y + 0.05, mid.z, 0.12, 0x4a7a3a);
  }
  return g;
}

function buildMediterranean(): THREE.Group {
  const g = new THREE.Group();
  addCanopy(g, 0, 0.35, 0, 0.3, 0x4a6a4a);
  addCanopy(g, 0.1, 0.55, 0.05, 0.25, 0x4a6a4a);
  addCanopy(g, -0.08, 0.5, -0.06, 0.22, 0x486848);
  addCanopy(g, 0.05, 0.7, -0.04, 0.2, 0x4a6a4a);
  addCanopy(g, -0.05, 0.25, 0.1, 0.22, 0x486848);
  addCanopy(g, 0, 0.15, -0.05, 0.25, 0x4a6a4a);
  const stemMat = mat(0x6a5a4a);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.2, 4), stemMat);
    stem.position.set(Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12);
    stem.rotation.z = Math.cos(a) * 0.2;
    stem.rotation.x = Math.sin(a) * 0.2;
    g.add(stem);
  }
  return g;
}

function buildThorny(): THREE.Group {
  const g = new THREE.Group();
  const spineMat = mat(0x3a5a2a);
  const flowerMat = mat(0xddbb22);
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
  const clumps: [number, number, number, number][] = [
    [0, 0.5, 0, 0.25], [-0.2, 0.55, 0.15, 0.2], [0.2, 0.5, -0.1, 0.2],
    [0, 0.7, 0.1, 0.18], [0.15, 0.65, 0.15, 0.17], [-0.15, 0.6, -0.15, 0.18],
    [0.05, 0.4, -0.2, 0.2], [-0.1, 0.45, 0.2, 0.17],
  ];
  for (const [cx, cy, cz, cr] of clumps) {
    addCanopy(g, cx, cy, cz, cr, 0x3a5a2a);
  }
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2;
    const elev = Math.random() * 0.8;
    const r = 0.3 + Math.random() * 0.15;
    const sx = Math.cos(a) * r;
    const sy = 0.35 + elev * 0.5;
    const sz = Math.sin(a) * r;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.1, 3), spineMat);
    spine.position.set(sx, sy, sz);
    spine.lookAt(sx * 2.5, sy * 1.2, sz * 2.5);
    g.add(spine);
  }
  for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.2 + Math.random() * 0.2;
    const fy = 0.45 + Math.random() * 0.35;
    const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), flowerMat);
    flower.position.set(Math.cos(a) * r, fy, Math.sin(a) * r);
    g.add(flower);
  }
  return g;
}

function buildDesertShrub(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = mat(0x7a6a5a);
  const leafMat = mat(0x5a6a3a);
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
      const lf = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(0.06 + Math.random() * 0.03, 0), 0.01), leafMat);
      lf.position.copy(forkTip);
      g.add(lf);
    }
  }
  return g;
}

function buildMangrove(): THREE.Group {
  const g = new THREE.Group();
  // Skip water surface (gallery-only)
  addTrunk(g, 0, 0.35, 0, 0.06, 0.05, 0.25, 0x6a3525);
  const rootMat = mat(0x6a3525);
  const roots = [
    { a: 0.2, spread: 0.55, thick: 0.028, startY: 0.48 },
    { a: 1.15, spread: 0.42, thick: 0.02, startY: 0.4 },
    { a: 1.9, spread: 0.6, thick: 0.025, startY: 0.45 },
    { a: 2.85, spread: 0.38, thick: 0.018, startY: 0.42 },
    { a: 3.4, spread: 0.52, thick: 0.027, startY: 0.47 },
    { a: 4.6, spread: 0.48, thick: 0.022, startY: 0.38 },
    { a: 5.5, spread: 0.44, thick: 0.024, startY: 0.44 },
  ];
  for (let i = 0; i < roots.length; i++) {
    const rt = roots[i];
    const a = rt.a;
    const sp = rt.spread;
    const midOff = (Math.random() - 0.5) * 0.15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, rt.startY, 0),
      new THREE.Vector3(Math.cos(a + midOff) * sp * 0.4, 0.22 + Math.random() * 0.08, Math.sin(a + midOff) * sp * 0.4),
      new THREE.Vector3(Math.cos(a) * sp * 0.8, 0.02 + Math.random() * 0.05, Math.sin(a) * sp * 0.8),
      new THREE.Vector3(Math.cos(a) * sp, -0.06 - Math.random() * 0.05, Math.sin(a) * sp),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, rt.thick, 5, false), rootMat));
    if (i % 3 === 0) {
      const dropA = a + (Math.random() - 0.5) * 0.5;
      const dropR = sp * (0.35 + Math.random() * 0.2);
      const dropCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * sp * 0.45, 0.18, Math.sin(a) * sp * 0.45),
        new THREE.Vector3(Math.cos(dropA) * dropR, -0.02, Math.sin(dropA) * dropR),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 5, 0.013, 4, false), rootMat));
    }
  }
  addCanopy(g, 0, 0.7, 0, 0.35, 0x2a5a2a);
  addCanopy(g, 0.2, 0.65, 0.15, 0.25, 0x2d5a25);
  addCanopy(g, -0.2, 0.68, -0.1, 0.25, 0x2a5a2a);
  addCanopy(g, -0.1, 0.63, 0.22, 0.2, 0x2d5a25);
  addCanopy(g, 0.15, 0.7, -0.2, 0.22, 0x2a5a2a);
  return g;
}

function buildSaguaro(): THREE.Group {
  const g = new THREE.Group();
  const cm = mat(0x5a8a4a);
  const main = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.0, 10), cm);
  main.position.set(0, 1.0, 0);
  g.add(main);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  cap.position.set(0, 2.0, 0);
  g.add(cap);
  const arm1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 0.8, 0),
    new THREE.Vector3(0.5, 0.7, 0),
    new THREE.Vector3(0.55, 1.0, 0),
    new THREE.Vector3(0.5, 1.3, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm1, 10, 0.08, 8, false), cm));
  const arm1Cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  arm1Cap.position.set(0.5, 1.3, 0);
  g.add(arm1Cap);
  const arm2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 1.0, 0),
    new THREE.Vector3(-0.45, 0.95, 0),
    new THREE.Vector3(-0.48, 1.2, 0),
    new THREE.Vector3(-0.42, 1.55, 0),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(arm2, 10, 0.07, 8, false), cm));
  const arm2Cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), cm);
  arm2Cap.position.set(-0.42, 1.55, 0);
  g.add(arm2Cap);
  return g;
}

function buildAloe(): THREE.Group {
  const g = new THREE.Group();
  const rings = [
    { count: 7, offset: 0, lean: 0.7, len: 0.55, baseR: 0.06 },
    { count: 5, offset: 0.45, lean: 0.4, len: 0.45, baseR: 0.04 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = i * Math.PI * 2 / ring.count + ring.offset;
      const lGeo = new THREE.PlaneGeometry(0.07, ring.len, 1, 6);
      const lPos = lGeo.attributes.position;
      for (let vi = 0; vi < lPos.count; vi++) {
        const origY = lPos.getY(vi);
        const t = (origY + ring.len / 2) / ring.len;
        lPos.setX(vi, lPos.getX(vi) * (1 - 0.7 * t));
        lPos.setY(vi, t * ring.len * 0.6 + 0.05);
        lPos.setZ(vi, t * t * ring.len * 0.5);
      }
      lGeo.computeVertexNormals();
      const leaf = new THREE.Mesh(lGeo, matDS(0x5a7a4a));
      leaf.position.set(Math.cos(a) * ring.baseR, 0, Math.sin(a) * ring.baseR);
      leaf.rotation.y = -a + Math.PI / 2;
      leaf.rotation.x = -ring.lean;
      g.add(leaf);
      const lGeo2 = lGeo.clone();
      const leaf2 = new THREE.Mesh(lGeo2, matDS(0x4a6a3a));
      leaf2.position.set(Math.cos(a) * ring.baseR, 0.015, Math.sin(a) * ring.baseR);
      leaf2.rotation.y = -a + Math.PI / 2;
      leaf2.rotation.x = -ring.lean;
      g.add(leaf2);
    }
  }
  return g;
}

function buildCaudiciform(): THREE.Group {
  const g = new THREE.Group();
  const brMat = mat(0x9a9080);
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
    addCanopy(g, Math.cos(b.a) * 0.2, b.h + 0.02, Math.sin(b.a) * 0.2, 0.09, 0x4a7a3a);
  }
  for (let fi = 0; fi < 3; fi++) {
    const fa = branches[fi].a + 0.2;
    const fh = branches[fi].h;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), mat(0xcc4477));
    fl.position.set(Math.cos(fa) * 0.22, fh + 0.06, Math.sin(fa) * 0.22);
    g.add(fl);
  }
  return g;
}

function buildEuphorbia(): THREE.Group {
  const g = new THREE.Group();
  const em = mat(0x3a6a3a);
  addTrunk(g, 0.03, 0, -0.02, 0.1, 0.07, 0.7, 0x5a4a2a);
  const arms = [
    { a: 0.3, startY: 0.65, spread: 0.32, topY: 1.4, thick: 0.05 },
    { a: 1.5, startY: 0.55, spread: 0.28, topY: 1.15, thick: 0.045 },
    { a: 2.4, startY: 0.7, spread: 0.35, topY: 1.55, thick: 0.05 },
    { a: 3.8, startY: 0.6, spread: 0.25, topY: 1.25, thick: 0.04 },
    { a: 5.0, startY: 0.5, spread: 0.3, topY: 1.0, thick: 0.042 },
    { a: 5.8, startY: 0.68, spread: 0.22, topY: 1.35, thick: 0.038 },
  ];
  for (let i = 0; i < arms.length; i++) {
    const arm = arms[i];
    const cx = Math.cos(arm.a), cz = Math.sin(arm.a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.03, arm.startY, -0.02),
      new THREE.Vector3(cx * arm.spread * 0.8, arm.startY - 0.1, cz * arm.spread * 0.8),
      new THREE.Vector3(cx * arm.spread, arm.topY, cz * arm.spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, arm.thick, 6, false), em));
    const armTop = curve.getPoint(1);
    const armCap = new THREE.Mesh(new THREE.SphereGeometry(arm.thick, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), em);
    armCap.position.copy(armTop);
    g.add(armCap);
    if (i % 2 === 0) {
      const forkA = arm.a + (Math.random() - 0.5) * 0.8;
      const forkCurve = new THREE.CatmullRomCurve3([
        armTop,
        new THREE.Vector3(Math.cos(forkA) * (arm.spread + 0.12), arm.topY + 0.25, Math.sin(forkA) * (arm.spread + 0.12)),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(forkCurve, 5, arm.thick * 0.7, 5, false), em));
      const fTip = forkCurve.getPoint(1);
      const fCap = new THREE.Mesh(new THREE.SphereGeometry(arm.thick * 0.7, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), em);
      fCap.position.copy(fTip);
      g.add(fCap);
    }
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.8, 6), em);
  top.position.set(0.03, 1.1, -0.02);
  g.add(top);
  const centerCap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), em);
  centerCap.position.set(0.03, 1.5, -0.02);
  g.add(centerCap);
  return g;
}

function buildIcePlant(): THREE.Group {
  const g = new THREE.Group();
  const leafMat = mat(0x6a9a4a);
  const leafMat2 = mat(0x5a8a3a);
  const clumps = [
    { x: 0, z: 0, count: 12, r: 0.12, flower: true },
    { x: -0.18, z: 0.1, count: 10, r: 0.1, flower: true },
    { x: 0.16, z: -0.1, count: 9, r: 0.09, flower: false },
    { x: 0.1, z: 0.16, count: 8, r: 0.08, flower: true },
    { x: -0.12, z: -0.14, count: 7, r: 0.07, flower: false },
  ];
  for (let ci = 0; ci < clumps.length; ci++) {
    const cl = clumps[ci];
    for (let i = 0; i < cl.count; i++) {
      const a = i * Math.PI * 2 / cl.count + ci * 0.5;
      const lean = 0.4 + Math.random() * 0.3;
      const fLen = 0.06 + Math.random() * 0.03;
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.012, fLen, 3, 5),
        i % 2 === 0 ? leafMat : leafMat2,
      );
      finger.position.set(
        cl.x + Math.cos(a) * cl.r * 0.3,
        fLen * 0.4,
        cl.z + Math.sin(a) * cl.r * 0.3,
      );
      finger.rotation.z = -Math.cos(a) * lean;
      finger.rotation.x = -Math.sin(a) * lean;
      g.add(finger);
    }
    if (cl.flower) {
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.015, 5, 3), mat(0xdd8822));
      center.position.set(cl.x, 0.1, cl.z);
      g.add(center);
      const petalMat = matDS(0xeedd33);
      for (let pi = 0; pi < 10; pi++) {
        const pa = pi * Math.PI * 2 / 10;
        const petal = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.035), petalMat);
        petal.position.set(
          cl.x + Math.cos(pa) * 0.025,
          0.1,
          cl.z + Math.sin(pa) * 0.025,
        );
        petal.rotation.y = -pa;
        petal.rotation.x = -0.4;
        g.add(petal);
      }
    }
  }
  return g;
}

function buildEpiphytic(): THREE.Group {
  const g = new THREE.Group();
  const segMat = mat(0x2a6a3a);
  const base = new THREE.Mesh(jitter(new THREE.SphereGeometry(0.08, 5, 4), 0.01), mat(0x3a5a2a));
  base.position.y = 0.06;
  base.scale.y = 0.6;
  g.add(base);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + (Math.random() - 0.5) * 0.3;
    const spread = 0.25 + Math.random() * 0.15;
    const droop = 0.1 + Math.random() * 0.1;
    const segCount = 4 + Math.floor(Math.random() * 3);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(Math.cos(a) * spread * 0.4, 0.12, Math.sin(a) * spread * 0.4),
      new THREE.Vector3(Math.cos(a) * spread * 0.7, 0.06, Math.sin(a) * spread * 0.7),
      new THREE.Vector3(Math.cos(a) * spread, -droop, Math.sin(a) * spread),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.008, 3, false), segMat));
    for (let s = 0; s < segCount; s++) {
      const t = (s + 0.5) / segCount;
      const pt = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const geo = new THREE.PlaneGeometry(0.06, 0.035);
      jitter(geo, 0.003);
      const seg = new THREE.Mesh(geo, matDS(s % 2 === 0 ? 0x2a6a3a : 0x2a7a3a));
      seg.position.copy(pt);
      seg.rotation.y = Math.atan2(tangent.x, tangent.z);
      seg.rotation.x = Math.PI / 2 + Math.asin(Math.max(-1, Math.min(1, tangent.y)));
      g.add(seg);
    }
    if (i % 3 === 0) {
      const tip = curve.getPoint(1);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 3), mat(0xcc4466));
      flower.position.copy(tip);
      g.add(flower);
    }
  }
  return g;
}

// ── Merge utility ──

function mergeGroupGeometry(group: THREE.Group): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  group.updateMatrixWorld(true);

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry.clone();
    geo.applyMatrix4(child.matrixWorld);

    const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
    const pos = nonIndexed.attributes.position;
    const nor = nonIndexed.attributes.normal;
    const vertCount = pos.count;

    const m = child.material as THREE.MeshStandardMaterial;
    const c = m.color;

    for (let i = 0; i < vertCount; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(c.r, c.g, c.b);
    }

    if (nonIndexed !== geo) nonIndexed.dispose();
    geo.dispose();
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return merged;
}

// ── Public API ──

export interface SubtypeModel {
  geometry: THREE.BufferGeometry;
  referenceHeight: number;
}

export const BUILDERS: (() => THREE.Group)[] = [
  // Grasses (0-5)
  buildTurfgrass, buildTallgrass, buildBunchgrass, buildBamboo, buildSpreading, buildSedge,
  // Trees (6-11)
  buildOak, buildMagnolia, buildConifer, buildTropical, buildPalm, buildBirch,
  // Shrubs (12-17)
  buildEvergreenShrub, buildDeciduousShrub, buildMediterranean, buildThorny, buildDesertShrub, buildMangrove,
  // Succulents (18-23)
  buildSaguaro, buildAloe, buildCaudiciform, buildEuphorbia, buildIcePlant, buildEpiphytic,
];

/**
 * Target game-world heights (units) for each model.
 * Based on real-world heights at 1m = 1/3 game unit, with a floor
 * of ~0.08 so ground-cover plants remain visible in the sim.
 */
/**
 * Proportional scale: 1 real meter = 1/3 game unit.
 * Small plants floored at ~0.08 so they stay visible in the sim.
 */
export const TARGET_MODEL_HEIGHTS: number[] = [
  // Grasses (0-5)          real → true scale (floor 0.08)
  0.08,   // 0: Turfgrass     0.10m → 0.033 (floored)
  0.67,   // 1: Tallgrass     2.0m  → 0.67
  0.17,   // 2: Bunchgrass    0.50m → 0.17
  2.67,   // 3: Bamboo        8.0m  → 2.67
  0.08,   // 4: Spreading     0.08m → 0.027 (floored)
  0.83,   // 5: Sedge         2.5m  → 0.83
  // Trees (6-11)
  5.00,   // 6: Oak           15m   → 5.0
  4.00,   // 7: Magnolia      12m   → 4.0
  6.67,   // 8: Conifer       20m   → 6.67
  6.67,   // 9: Tropical      20m   → 6.67
  6.00,   // 10: Palm         18m   → 6.0
  5.00,   // 11: Birch        15m   → 5.0
  // Shrubs (12-17)
  0.50,   // 12: Ev. Shrub    1.5m  → 0.50
  1.00,   // 13: Dec. Shrub   3.0m  → 1.0
  0.33,   // 14: Mediterranean 1.0m → 0.33
  0.67,   // 15: Thorny       2.0m  → 0.67
  0.67,   // 16: Desert Shrub 2.0m  → 0.67
  1.67,   // 17: Mangrove     5.0m  → 1.67
  // Succulents (18-23)
  4.00,   // 18: Saguaro      12m   → 4.0
  0.17,   // 19: Aloe         0.5m  → 0.17
  0.67,   // 20: Caudiciform  2.0m  → 0.67
  2.00,   // 21: Euphorbia    6.0m  → 2.0
  0.08,   // 22: Ice Plant    0.15m → 0.05 (floored)
  0.10,   // 23: Epiphytic    0.3m  → 0.10
];

/** Scale a model group to its target game-world height using Box3 measurement. */
export function scaleToTarget(group: THREE.Group, subtypeIndex: number): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const rawH = Math.max(0.01, box.max.y);
  group.scale.setScalar(TARGET_MODEL_HEIGHTS[subtypeIndex] / rawH);
}

/**
 * The simulation height at which each subtype renders at 1× authored model scale.
 * This is a design tuning knob, not derived from geometry.
 *
 * Instance scale: s = plant.height / REF_SIM_HEIGHT[subtype]
 * Rendered height = authored_model_height × s
 *
 * Example: Oak (model ~2.75 units) at sim h=8 → 2.75 × (8/10) = 2.2 world units
 *          Turfgrass (model ~0.2 units) at sim h=1 → 0.2 × (1/1.5) = 0.13 world units
 */
const REF_SIM_HEIGHT: number[] = [
  // Grasses (0-5)
  1.5,   // 0: Turfgrass — short lawn grass, full size at low sim height
  8.0,   // 1: Tallgrass — prairie grass
  4.0,   // 2: Bunchgrass — tussock
  8.0,   // 3: Bamboo — tall culm
  1.0,   // 4: Spreading — ground cover
  7.0,   // 5: Sedge — papyrus
  // Trees (6-11)
  10.0,  // 6: Oak — large broadleaf
  10.0,  // 7: Magnolia — medium tree
  10.0,  // 8: Conifer — tall conifer
  12.0,  // 9: Tropical — tall tropical
  9.0,   // 10: Palm — tall palm
  9.0,   // 11: Birch — medium tree
  // Shrubs (12-17)
  6.0,   // 12: Evergreen Shrub — hedge
  6.0,   // 13: Deciduous Shrub — multi-stem
  5.0,   // 14: Mediterranean — mound
  5.0,   // 15: Thorny — spiny shrub
  5.0,   // 16: Desert Shrub — open shrub
  7.0,   // 17: Mangrove — small tree
  // Succulents (18-23)
  8.0,   // 18: Saguaro — tall cactus
  2.0,   // 19: Aloe — rosette
  4.0,   // 20: Caudiciform — swollen-trunk
  9.0,   // 21: Euphorbia — candelabra
  1.0,   // 22: Ice Plant — ground-level
  1.5,   // 23: Epiphytic — trailing
];

export function buildSubtypeModels(): SubtypeModel[] {
  return BUILDERS.map((build, i) => {
    const group = build();
    scaleToTarget(group, i);
    const merged = mergeGroupGeometry(group);

    // Dispose all source geometries/materials
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });

    return { geometry: merged, referenceHeight: REF_SIM_HEIGHT[i] };
  });
}
