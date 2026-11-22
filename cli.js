#!/usr/bin/env node
// STL 파일 하나로 3D프린팅(FDM) 예상 견적을 계산한다.
// 사용: node cli.js model.stl [--material PLA|PETG|ABS] [--quality std|strong|fine] [--qty 1] [--lead standard] [--unit mm|cm|inch] [--json]
import { readFileSync } from 'node:fs';
import { BufferGeometry, Matrix4 } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { analyze, compareOrients, thinAt } from './src/analyze.js';
import { orderQuote } from './src/price.js';
import { SPEC, MATERIALS, QUALITY, LEAD, UNITS } from './src/spec.js';

function args(argv) {
  const o = { material: 'PLA', quality: 'std', qty: 1, lead: 'standard', unit: 'mm', json: false, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
    else o.file = a;
  }
  o.qty = Math.max(1, parseInt(o.qty, 10) || 1);
  return o;
}

const o = args(process.argv.slice(2));
if (!o.file) {
  console.error('사용법: node cli.js model.stl [--material PLA|PETG|ABS] [--quality std|strong|fine] [--qty 1] [--lead relaxed|standard|rush] [--unit mm|cm|inch] [--json]');
  process.exit(2);
}
if (!MATERIALS[o.material]) { console.error(`소재는 ${Object.keys(MATERIALS).join(', ')} 중 하나`); process.exit(2); }
if (!QUALITY[o.quality]) { console.error(`품질은 ${Object.keys(QUALITY).join(', ')} 중 하나`); process.exit(2); }
if (!LEAD[o.lead]) { console.error(`납기는 ${Object.keys(LEAD).join(', ')} 중 하나`); process.exit(2); }

const buf = readFileSync(o.file);
let geo = new STLLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
if (geo.index) geo = geo.toNonIndexed();
geo = new BufferGeometry().setAttribute('position', geo.getAttribute('position'));

// STL은 보통 Z가 위. 계산은 Y가 위인 좌표를 쓴다.
geo.applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2));
const s = UNITS[o.unit] || 1;
if (s !== 1) geo.scale(s, s, s);
geo.computeBoundingBox();
const bb = geo.boundingBox;
geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);

const A = analyze(geo);
const m = { volMm3: A.volMm3, areaMm2: A.areaMm2, heightMm: A.size.h, supportMm3: A.supportMm3 };
const q = orderQuote([{ m, qty: o.qty }], { material: o.material, quality: o.quality, lead: o.lead, finish: ['basic'] });
const line = q.lines[0];
const thin = thinAt(A, 1);
const tooBig = Math.max(A.size.w, A.size.d, A.size.h) > SPEC.maxMm;
const best = compareOrients(A.F).sort((a, b) => a.supCm3 - b.supCm3)[0];

const out = {
  file: o.file,
  sizeMm: { w: +A.size.w.toFixed(1), d: +A.size.d.toFixed(1), h: +A.size.h.toFixed(1) },
  volumeCm3: +(A.volMm3 / 1000).toFixed(2),
  surfaceCm2: +(A.areaMm2 / 100).toFixed(1),
  overhangCm2: +(A.ohArea / 100).toFixed(1),
  supportCm3: +(A.supportMm3 / 1000).toFixed(2),
  openEdges: A.openEdges,
  thinWallRatio: +thin.ratio.toFixed(3),
  minWallMm: thin.minMm === null ? null : +thin.minMm.toFixed(2),
  leastSupportOrientation: best.key,
  material: o.material, quality: o.quality, qty: o.qty, lead: o.lead,
  grams: +line.grams.toFixed(1),
  hours: +line.hours.toFixed(2),
  unitWon: line.unit,
  totalWon: q.total,
  shippingWon: q.shipping,
  grandWon: q.grand,
  belowMinimum: q.belowMin,
  warnings: [
    tooBig ? `가장 긴 변이 ${SPEC.maxMm}mm를 넘음` : null,
    A.openEdges ? `열린 모서리 ${A.openEdges}개(구멍 난 메시)` : null,
    thin.ratio > 0.02 ? `두께 ${SPEC.minWallMm}mm 미만 부분이 겉면의 ${(thin.ratio * 100).toFixed(1)}%` : null,
  ].filter(Boolean),
};

if (o.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const won = (n) => n.toLocaleString('ko-KR') + '원';
console.log(`파일        ${out.file}`);
console.log(`크기        ${out.sizeMm.w} × ${out.sizeMm.d} × ${out.sizeMm.h} mm`);
console.log(`부피·겉넓이  ${out.volumeCm3} cm³ · ${out.surfaceCm2} cm²`);
console.log(`받침        필요 면 ${out.overhangCm2} cm², 부피 근사 ${out.supportCm3} cm³ (받침이 가장 적은 방향: ${out.leastSupportOrientation})`);
console.log(`소재·품질   ${o.material} · ${QUALITY[o.quality].note} · 납기 ${LEAD[o.lead].days}`);
console.log(`예상        ${out.grams} g · 출력 ${out.hours} 시간`);
console.log(`개당        ${won(out.unitWon)} × ${o.qty}개`);
console.log(`합계        ${won(out.totalWon)} (+배송 ${won(out.shippingWon)})${out.belowMinimum ? ' · 최소 주문 금액 적용' : ''}`);
for (const w of out.warnings) console.log(`주의        ${w}`);
console.log('\n예상가입니다. 실제 금액은 파일 검토 후 확정됩니다.');
