# 3d-print-quote — 3D프린팅(FDM) 견적 계산기

STL 파일 하나로 **3D프린팅 예상 가격, 출력 시간, 소재 무게, 받침(서포트) 양**을 계산하는 오픈소스 엔진입니다.
모델의 바운딩 박스(겉 크기)가 아니라 **실제 부피·겉넓이·받침이 필요한 면**을 측정해서 계산합니다.

- 실제 서비스에서 쓰는 코드입니다: [이도 3D프린팅 온라인 자동 견적](https://ido3dprint.com/order.html)
- 계산 기준 설명(한국어): [3D프린팅 가격은 이렇게 계산합니다](https://ido3dprint.com/3d-printing-price.html)
- 만든 곳: [이도 3D프린팅](https://ido3dprint.com) · 세종특별자치시 조치원읍 · FDM 3D프린터 출력 대행, 3D 모델링, 시제품 제작

> English: An open-source FDM 3D printing quote engine. It measures real volume, surface area and overhang/support volume from an STL (not just the bounding box) and estimates print time, filament grams and price. It is the same code that powers the online quote at [ido3dprint.com](https://ido3dprint.com/order.html), a 3D printing service in Sejong, South Korea.

## 빠른 사용

```bash
npm install
node cli.js model.stl
node cli.js model.stl --material PETG --quality strong --qty 10 --lead rush
node cli.js model.stl --unit inch --json
```

출력 예시(50mm 정육면체, PLA 표준):

```
크기        50 × 50 × 50 mm
부피·겉넓이  125 cm³ · 150 cm²
받침        필요 면 0 cm², 부피 근사 0 cm³ (받침이 가장 적은 방향: +y)
소재·품질   PLA · 0.2mm 층 · 채움 15% · 납기 5~7영업일
예상        39.1 g · 출력 1.3 시간
개당        27,600원 × 1개
합계        32,600원 (+배송 3,500원)
```

## 3D프린팅 가격은 어떻게 계산하나요?

FDM 3D프린팅 가격은 대부분 **출력 시간**과 **소재 사용량**으로 정해집니다. 이 엔진은 아래 순서로 계산합니다.

1. **실제로 쌓이는 부피**
   - 껍데기 = min(전체 부피, 겉넓이 × 1.0mm)
   - 속 채움 = (전체 부피 − 껍데기) × 채움 비율(15% 또는 40%)
   - 받침 = 받침 부피 근사 × 15%
2. **소재 무게(g)** = 쌓이는 부피(cm³) × 소재 밀도(PLA 1.24, PETG 1.27, ABS 1.04)
3. **출력 시간(시간)** = (쌓이는 부피 ÷ 평균 압출 속도 8mm³/s × 품질 배수 + 층 수 × 3초) ÷ 3600
4. **개당 금액** = 소재비(g × 40~45원) + 출력 시간 × 시간당 단가 + 후가공. 여기에 수량 할인을 적용합니다(2개 5%, 5개 10%, 10개 15%, 30개 20%, 100개 25%).
5. **주문 합계** = (개당 금액 × 수량 + 주문당 세팅비) × 납기 배수(여유 0.95, 표준 1.0, 급행 1.3). 최소 주문 금액보다 작으면 최소 금액을 적용합니다.

모든 숫자는 [`src/spec.js`](src/spec.js) 한 파일에 있습니다. 자기 작업실의 단가·장비 값으로 바꿔 쓰면 됩니다.

## 함께 계산하는 것

| 항목 | 방법 |
|---|---|
| 받침이 필요한 면(오버행) | 수직에서 45°보다 더 누운 아래쪽 면. 바닥에 닿은 면은 제외 |
| 받침 부피 | 오버행 면에서 아래로 광선을 쏴서 바닥 또는 부품 윗면까지의 높이를 면적으로 가중 평균 |
| 얇은 벽 | 겉면에서 안쪽으로 광선을 쏴서 맞은편 면까지의 거리. 0.8mm 미만이면 주의 |
| 열린 모서리 | 삼각형 한 개에만 속한 모서리 수(구멍 난 메시 감지) |
| 출력 방향 비교 | 6방향(위·아래·옆)별 받침 면적, 받침 부피, 바닥 접촉 면적, 높이 |

광선 계산은 [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)를 씁니다.

## 한계

- 슬라이서(Bambu Studio, OrcaSlicer, Cura)로 실제로 자른 결과가 아니라 근사입니다. 실제 금액은 파일 검토 후 확정하세요.
- 안쪽이 막힌 빈 공간이 있는 모델은 받침 양이 크게 잡힐 수 있습니다.
- 지원 형식은 CLI 기준 STL입니다. 웹 버전은 OBJ·3MF·STEP·GLB도 읽습니다.

## 자주 묻는 질문

**3D프린팅 출력 비용은 보통 얼마인가요?**
크기보다 출력 시간과 소재량이 결정합니다. 기본값 기준으로 50mm 정육면체(PLA, 채움 15%)는 약 39g, 1.3시간이고 합계는 32,600원(배송 별도)입니다. 같은 크기라도 속이 비어 있거나 받침이 적으면 더 쌉니다.

**PLA·PETG·ABS 중 무엇이 비싼가요?**
기본값은 1g당 PLA 40원, PETG·ABS 45원입니다. ABS는 밀도가 낮아 같은 부피일 때 더 가볍습니다.

**정밀 품질(0.12mm 층)은 왜 비싼가요?**
층이 얇아 같은 높이를 쌓는 데 시간이 약 1.55배 걸립니다.

**출력을 맡기고 싶으면 어디로 하나요?**
[ido3dprint.com/order.html](https://ido3dprint.com/order.html)에 파일을 올리면 같은 계산으로 견적이 나오고, 바로 주문할 수 있습니다. 파일이 없으면 사진·도면으로 [견적 문의](https://ido3dprint.com/contact.html)를 남기면 됩니다.

## 라이선스

MIT © 이도 3D프린팅 (IDO 3D Printing)
