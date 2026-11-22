// 예상 견적 계산. 바운딩 박스가 아니라 실제 부피·겉넓이·서포트량·출력 시간으로 계산한다.
import { RATE, MATERIALS, QUALITY, LEAD, FINISH, QTY_TIERS } from './spec.js';

export const qtyOff = (q) => QTY_TIERS.reduce((o, t) => (q >= t.from ? t.off : o), 0);

// m: 현재 크기에 맞춘 측정값 { volMm3, areaMm2, heightMm, supportMm3 }
export function itemCost(m, o) {
  const mat = MATERIALS[o.material] || MATERIALS.PLA;
  const q = QUALITY[o.quality] || QUALITY.std;
  const shell = Math.min(m.volMm3, m.areaMm2 * RATE.shellMm);
  const infill = Math.max(0, m.volMm3 - shell) * (q.infill / 100);
  const support = (m.supportMm3 || 0) * RATE.supportFill;
  const printMm3 = shell + infill + support;
  const grams = (printMm3 / 1000) * mat.density;
  const layers = m.heightMm / q.layer;
  const hours = ((printMm3 / RATE.flowMm3s) * q.time * (mat.timeK || 1) + layers * RATE.layerOverheadS) / 3600;
  const material = grams * mat.wonPerG;
  const machine = hours * RATE.machinePerHour;
  const machineList = hours * RATE.machinePerHourList;
  let finish = 0, consult = false;
  for (const k of o.finish || []) {
    const f = FINISH[k]; if (!f) continue;
    if (f.consult) { consult = true; continue; }
    if (f.only && f.only !== o.material) continue;
    finish += f.fixed + f.perCm2 * (m.areaMm2 / 100);
  }
  const unitRaw = material + machine + finish;
  const off = qtyOff(o.qty);
  const unit = Math.round((unitRaw * (1 - off)) / 10) * 10;
  // 기준 정가(개별 상담 견적, 시간당 RATE.machinePerHourList) — 비교 표시용. 출력 시간 단가만 다르다.
  const unitList = Math.round(((material + machineList + finish) * (1 - off)) / 10) * 10;
  return { grams, hours, material, machine, machineList, finish, unitRaw, off, unit, unitList, consult, supportG: (support / 1000) * mat.density };
}

// 배송비: 주문 금액(배송비 제외)이 RATE.freeShipFrom 이상이면 무료
export const shippingFee = (total) => (total >= RATE.freeShipFrom ? 0 : RATE.shipping);

// items: [{ m, qty }] / o: 공통 옵션
export function orderQuote(items, o) {
  const lines = items.map((it) => ({ ...itemCost(it.m, { ...o, qty: it.qty }), qty: it.qty }));
  const lead = LEAD[o.lead] || LEAD.standard;
  const extra = RATE.orderBase + (o.colorExtra || 0);
  const raw = (lines.reduce((s, l) => s + l.unit * l.qty, 0) + extra) * lead.k;
  const rawList = (lines.reduce((s, l) => s + l.unitList * l.qty, 0) + extra) * lead.k;
  const total = Math.max(RATE.minOrder, Math.round(raw / 100) * 100);          // 온라인 자동견적 금액(배송비 제외)
  const listTotal = Math.max(RATE.minOrder, Math.round(rawList / 100) * 100);  // 개별 상담 견적 기준 금액(배송비 제외)
  const shipping = shippingFee(total);
  const hours = lines.reduce((s, l) => s + l.hours * l.qty, 0);
  return {
    lines, total, listTotal, save: Math.max(0, listTotal - total), shipping, grand: total + shipping,
    belowMin: raw < RATE.minOrder, hours, consult: lines.some((l) => l.consult), lead,
  };
}
