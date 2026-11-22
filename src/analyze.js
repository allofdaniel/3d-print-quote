// 모델 분석: 부피·겉넓이, 열린 면, 얇은 벽, 오버행(받침 필요 면), 받침 접점, 결 지도, 방향 후보.
// 모든 계산은 브라우저 안에서만 한다(파일을 서버로 보내지 않음).
// geo: 위치만 있는 non-indexed BufferGeometry, 단위 mm, Y가 위, 바닥(minY)=0.
import { Vector3, Ray, DoubleSide } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SPEC } from './spec.js';

const COS_OH = Math.cos((SPEC.overhangDeg * Math.PI) / 180); // 0.707

export function faceData(pos) {
  const n = pos.count / 3;
  const nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n);
  const cx = new Float32Array(n), cy = new Float32Array(n), cz = new Float32Array(n), ar = new Float32Array(n);
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), e1 = new Vector3(), e2 = new Vector3();
  let vol = 0, area = 0;
  for (let i = 0; i < n; i++) {
    a.fromBufferAttribute(pos, i * 3); b.fromBufferAttribute(pos, i * 3 + 1); c.fromBufferAttribute(pos, i * 3 + 2);
    vol += a.dot(e1.copy(b).cross(c)) / 6;
    e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
    const l = e1.length(); const s = l / 2;
    ar[i] = s; area += s;
    if (l > 0) { nx[i] = e1.x / l; ny[i] = e1.y / l; nz[i] = e1.z / l; }
    cx[i] = (a.x + b.x + c.x) / 3; cy[i] = (a.y + b.y + c.y) / 3; cz[i] = (a.z + b.z + c.z) / 3;
  }
  return { n, nx, ny, nz, cx, cy, cz, ar, vol: Math.abs(vol), area };
}

// 면적 비례 표본 추출
function sample(idx, ar, max, repeat = false) {
  if (!repeat && idx.length <= max) return idx;
  if (!idx.length) return idx;
  const total = idx.reduce((s, i) => s + ar[i], 0), out = [];
  let acc = 0, step = total / max, next = step * Math.random();
  for (const i of idx) { acc += ar[i]; while (acc >= next && out.length < max) { out.push(i); next += step; } }
  return out;
}

function openEdges(pos) {
  const tris = pos.count / 3;
  if (tris > 400000) return null;                       // 너무 크면 검토 단계에서 확인
  const q = (v) => Math.round(v * 1000);
  const vid = new Map(); let next = 0;
  const id = (i) => {
    const k = q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
    let v = vid.get(k); if (v === undefined) { v = next++; vid.set(k, v); } return v;
  };
  const edges = new Map();
  for (let t = 0; t < tris; t++) {
    const v = [id(t * 3), id(t * 3 + 1), id(t * 3 + 2)];
    for (let e = 0; e < 3; e++) {
      const p = v[e], r = v[(e + 1) % 3]; if (p === r) continue;
      const k = p < r ? p * 4194304 + r : r * 4194304 + p;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let bad = 0; for (const c of edges.values()) if (c !== 2) bad++;
  return bad;
}

export function analyze(geo, mesh) {
  const pos = geo.attributes.position;
  const F = faceData(pos);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = bb.getSize(new Vector3());
  const bvh = new MeshBVH(geo, { maxLeafTris: 20 });
  geo.boundsTree = bvh;

  // 오버행: 아래를 향하는 정도가 45°보다 큰 면, 바닥에 닿은 면 제외
  const over = new Uint8Array(F.n);
  const ohIdx = [];
  let ohArea = 0, bedArea = 0;
  for (let i = 0; i < F.n; i++) {
    if (F.cy[i] < 0.3 && F.ny[i] < -0.98) { bedArea += F.ar[i]; continue; }
    if (F.ny[i] < -COS_OH) { over[i] = F.ny[i] < -0.94 ? 2 : 1; ohIdx.push(i); ohArea += F.ar[i]; }
  }

  // 받침 접점: 오버행 면에서 아래로 광선 → 바닥 또는 부품 윗면
  const ray = new Ray(), down = new Vector3(0, -1, 0), o = new Vector3();
  const pins = [];
  let hSum = 0, wSum = 0;
  // 면적에 비례해 삼각형 안의 임의 점을 뽑는다(큰 평면에도 고르게 분포)
  const va = new Vector3(), vb = new Vector3(), vc = new Vector3(), pt = new Vector3();
  for (const i of sample(ohIdx, F.ar, Math.min(160, Math.max(12, Math.round(ohArea / 40))), true)) {
    va.fromBufferAttribute(pos, i * 3); vb.fromBufferAttribute(pos, i * 3 + 1); vc.fromBufferAttribute(pos, i * 3 + 2);
    let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    pt.copy(va).addScaledVector(vb.sub(va), r1).addScaledVector(vc.sub(va), r2);
    o.set(pt.x, pt.y - 0.05, pt.z);
    ray.set(o, down);
    const hit = bvh.raycastFirst(ray, DoubleSide);
    const yTo = hit ? hit.point.y : 0;
    const h = Math.max(0, pt.y - yTo);
    pins.push({ x: pt.x, y: pt.y, z: pt.z, to: yTo, onPart: !!hit });
    hSum += h * F.ar[i]; wSum += F.ar[i];
  }
  const supportMm3 = wSum ? ohArea * (hSum / wSum) : 0;

  // 얇은 벽: 면 안쪽으로 광선 → 맞은편 면까지 거리(크기를 바꾸면 비례해서 다시 판정)
  const walls = [];
  const all = []; for (let i = 0; i < F.n; i++) all.push(i);
  const inward = new Vector3();
  let sampArea = 0;
  for (const i of sample(all, F.ar, 320)) {
    inward.set(-F.nx[i], -F.ny[i], -F.nz[i]);
    o.set(F.cx[i], F.cy[i], F.cz[i]).addScaledVector(inward, 0.005);
    ray.set(o, inward);
    const hit = bvh.raycastFirst(ray, DoubleSide);
    sampArea += F.ar[i];
    if (hit && hit.distance > 0.001) walls.push({ x: F.cx[i], y: F.cy[i], z: F.cz[i], d: hit.distance, a: F.ar[i] });
  }

  // 결 지도: 0 윗면(매끈) 1 완만한 윗면(계단 뚜렷) 2 옆면(가는 결) 3 받침 닿는 면(거침) 4 바닥면
  const finish = new Uint8Array(F.n);
  for (let i = 0; i < F.n; i++) {
    const y = F.ny[i];
    finish[i] = over[i] ? 3 : (F.cy[i] < 0.3 && y < -0.98) ? 4 : y > 0.96 ? 0 : y > 0.5 ? 1 : 2;
  }

  return {
    F, size: { w: size.x, d: size.z, h: size.y }, volMm3: F.vol, areaMm2: F.area,
    over, ohArea, bedArea, pins, supportMm3, walls, sampArea,
    openEdges: openEdges(pos), finish, tris: F.n,
  };
}

// 6가지 바닥 방향 후보 비교(자기 그늘은 무시한 근사). dir: 바닥으로 갈 축
export const ORIENTS = [
  { key: '+y', name: '지금 방향', up: [0, 1, 0] },
  { key: '-y', name: '뒤집기', up: [0, -1, 0] },
  { key: '+x', name: '옆으로 눕히기 A', up: [1, 0, 0] },
  { key: '-x', name: '옆으로 눕히기 B', up: [-1, 0, 0] },
  { key: '+z', name: '앞뒤로 눕히기 A', up: [0, 0, 1] },
  { key: '-z', name: '앞뒤로 눕히기 B', up: [0, 0, -1] },
];

// 각 방향에서 오버행 면적, 받침 부피 근사(자기 그늘 무시), 바닥 접촉, 높이
export function compareOrients(F) {
  const res = [];
  for (const o of ORIENTS) {
    const up = o.up;
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < F.n; i++) { const h = F.cx[i] * up[0] + F.cy[i] * up[1] + F.cz[i] * up[2]; if (h < minH) minH = h; if (h > maxH) maxH = h; }
    let oh = 0, sup = 0, bed = 0;
    for (let i = 0; i < F.n; i++) {
      const ny = F.nx[i] * up[0] + F.ny[i] * up[1] + F.nz[i] * up[2];
      const h = F.cx[i] * up[0] + F.cy[i] * up[1] + F.cz[i] * up[2] - minH;
      if (h < 0.3 && ny < -0.98) { bed += F.ar[i]; continue; }
      if (ny < -COS_OH) { oh += F.ar[i]; sup += F.ar[i] * h; }
    }
    res.push({ ...o, ohCm2: oh / 100, supCm3: sup / 1000, bedCm2: bed / 100, heightMm: maxH - minH });
  }
  return res;
}

// 크기 배율 s(가장 작은 축 배율)에서 얇은 곳 판정
export function thinAt(A, s) {
  const thin = A.walls.filter((w) => w.d * s < SPEC.minWallMm);
  const area = thin.reduce((t, w) => t + w.a, 0);
  return { pts: thin, ratio: A.sampArea ? area / A.sampArea : 0, minMm: A.walls.length ? Math.min(...A.walls.map((w) => w.d)) * s : null };
}
