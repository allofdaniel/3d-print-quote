// 간단 검증: 50mm 정육면체 측정값으로 견적이 계산되는지 확인
import assert from 'node:assert/strict';
import { itemCost, orderQuote, qtyOff } from './src/price.js';
import { RATE } from './src/spec.js';

const cube = { volMm3: 125000, areaMm2: 15000, heightMm: 50, supportMm3: 0 };
const one = itemCost(cube, { material: 'PLA', quality: 'std', qty: 1, finish: [] });
assert.ok(one.grams > 0 && one.hours > 0 && one.unit > 0, '무게·시간·금액이 0보다 커야 함');

const q = orderQuote([{ m: cube, qty: 1 }], { material: 'PLA', quality: 'std', lead: 'standard' });
assert.ok(q.total >= RATE.minOrder, '최소 주문 금액 이상');

assert.equal(qtyOff(1), 0);
assert.equal(qtyOff(10), 0.15);
const ten = itemCost(cube, { material: 'PLA', quality: 'std', qty: 10, finish: [] });
assert.ok(ten.unit < one.unit, '수량이 많으면 개당 금액이 낮아야 함');

console.log('ok', { grams: one.grams.toFixed(1), hours: one.hours.toFixed(2), unit: one.unit, total: q.total });
