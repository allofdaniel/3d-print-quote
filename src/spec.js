// 3D프린팅(FDM) 견적 기준값.
// 기본값은 이도 3D프린팅(https://ido3dprint.com)이 공개한 자동 견적 단가다.
// 자기 작업실 단가로 바꿔 쓰면 된다. 가격 계산 설명: https://ido3dprint.com/3d-printing-price.html

export const SPEC = {
  maxMm: 250,                 // 한 번에 출력할 수 있는 최대 크기(가로·세로·높이 각각)
  minWallMm: 0.8,             // 이보다 얇으면 '주의'
  recWallMm: 1.2,             // 권장 두께
  overhangDeg: 45,            // 수직에서 이 각도보다 더 누우면 받침(서포트) 필요
  maxFiles: 10,
  maxBytes: 250 * 1024 * 1024,
  formats: ['stl', 'obj', '3mf', 'step', 'stp', 'glb', 'gltf'],
  formatLabel: 'STL · OBJ · 3MF · STEP · GLB',
};

// 가격 상수 (원). 화면에는 '예상가'로만 보여주고 파일 검토 후 확정한다.
export const RATE = {
  machinePerHourList: 30000,  // 기준 정가: 개별 상담 견적 시 출력 시간 1시간당
  machinePerHour: 20000,      // 온라인 셀프 접수(자동 견적) 할인가: 출력 시간 1시간당
  orderBase: 5000,            // 주문 1건당 파일 검토·세팅
  minOrder: 20000,            // 최소 주문 금액 (배송비 제외)
  shipping: 3500,             // 배송비 (별도)
  freeShipFrom: 50000,        // 주문 금액(배송비 제외)이 이 금액 이상이면 무료배송
  validDays: 14,              // 견적 유효기간
  flowMm3s: 8,                // 평균 압출 속도(이동·가감속 포함 보수값)
  layerOverheadS: 3,          // 층 바뀔 때마다 드는 시간
  shellMm: 1.0,               // 벽·윗면·아랫면 두께 합의 근사
  supportFill: 0.15,          // 서포트 채움 비율
};

export const MATERIALS = {
  PLA:  { name: 'PLA',  density: 1.24, wonPerG: 40, note: '매끈한 표면, 피규어·굿즈' },
  PETG: { name: 'PETG', density: 1.27, wonPerG: 45, note: '물과 충격에 강한 생활용품' },
  ABS:  { name: 'ABS',  density: 1.04, wonPerG: 45, note: '열에 강한 기능 부품' },
};

// 품질: 층 높이와 채움(인필). time = 시간 배수
export const QUALITY = {
  std:    { name: '표준',   layer: 0.20, infill: 15, time: 1.0, note: '0.2mm 층 · 채움 15%' },
  strong: { name: '튼튼',   layer: 0.20, infill: 40, time: 1.0, note: '0.2mm 층 · 채움 40%' },
  fine:   { name: '정밀',   layer: 0.12, infill: 15, time: 1.55, note: '0.12mm 층 · 결이 덜 보임' },
};

// 납기 (출고 기준, 영업일). k = 가격 배수
export const LEAD = {
  relaxed:  { name: '여유', days: '10영업일 이내', k: 0.95 },
  standard: { name: '표준', days: '5~7영업일', k: 1.0 },
  rush:     { name: '급행', days: '2~3영업일 · 일정 확인 후 확정', k: 1.3 },
};

// 후가공 (개당)
export const FINISH = {
  basic:  { name: '서포트 제거·기본 정리', fixed: 0, perCm2: 0, note: '기본 포함' },
  sand:   { name: '샌딩 정리', fixed: 3000, perCm2: 10, note: '거친 결·서포트 자국을 갈아냄' },
  vapor:  { name: 'ABS 표면 훈증', fixed: 5000, perCm2: 0, note: 'ABS만 · 결이 녹아 매끈해짐', only: 'ABS' },
  paint:  { name: '도색', consult: true, note: '색·마감 상담 후 견적' },
};

// 수량 할인 (개당 금액에 적용, 판 하나에 여러 개 묶어 뽑는 효율)
export const QTY_TIERS = [
  { from: 1, off: 0 }, { from: 2, off: 0.05 }, { from: 5, off: 0.10 },
  { from: 10, off: 0.15 }, { from: 30, off: 0.20 }, { from: 100, off: 0.25 },
];

export const UNITS = { mm: 1, cm: 10, inch: 25.4 };
