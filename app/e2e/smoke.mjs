// 실행: npm run preview -- --port 4173 & 후 node e2e/smoke.mjs (playwright 필요)
// 비나리 v16 런타임 스모크 테스트 — 모바일 뷰포트, 온보딩→수호신→속결/의식 실패 복구→재회(localStorage)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;

const SHOTS = process.env.SHOTS_DIR || "/tmp/binari-shots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, pass, note = "") => { results.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} — ${name}${note ? " · " + note : ""}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(8000);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });

try {
  await page.goto("http://localhost:4173/");
  await page.waitForTimeout(1200);

  // 1. 오프닝
  check("오프닝 렌더", await page.getByText("불렀어?").isVisible());
  check("가짜 '건너뛰기' 제거됨", (await page.getByText("건너뛰기").count()) === 0);
  await shot("01_opening");
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click();

  // 2. 생년월일
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "이름 없이 갈래" }).click(); // v26: 이름 장면 건너뛰기
  const ins = page.locator("input.in:not(.wide)");
  await ins.nth(0).fill("1993"); await ins.nth(1).fill("7"); await ins.nth(2).fill("15");
  await page.getByRole("button", { name: "이 하늘이야" }).click();
  const tins = page.locator("input.in:not(.wide)");
  await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
  await shot("02_birth");
  await page.getByRole("button", { name: "기억났어" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();

  // 3. 회상 리빌 → MBTI/혈액형
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 }); // v30: 회상 나레이션 넘기기
  await page.waitForSelector("text=요즘의 너는", { timeout: 10000 });
  for (const t of ["혼자일 때 차오르는 쪽", "아직 오지 않은 것을 보는 쪽", "마음이 먼저 움직이는 쪽", "열어둔 길이 편한 쪽"]) await page.getByRole("button", { name: t }).click(); // v24: 순차 문항 — 한 번에 하나씩 나타남
  check("혈액형 입력 제거됨(v24)", (await page.getByText("혈액형").count()) === 0 && (await page.getByRole("button", { name: "B형", exact: true }).count()) === 0);
  await shot("03_reveal");
  await page.getByRole("button", { name: "마음의 방으로" }).click();

  // 4. 가치여정 8→4→1
  await page.waitForTimeout(700);
  for (const v of ["안정", "성장", "자유", "인정", "관계", "성취"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "여섯 개 골랐어" }).click();
  await page.waitForTimeout(500);
  for (const v of ["안정", "성장", "자유"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "셋을 남겼어" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "안정", exact: true }).click();
  await shot("04_values");
  await page.getByRole("button", { name: "수호신 깨우기" }).click();

  // 5. 수호신 형성(3.2s) → 로비(질문 감춤) → 두 번 두드려 깨움 → 질문 UI
  await page.waitForSelector("text=두 번 두드리면", { timeout: 12000 });
  await page.waitForTimeout(800);
  check("로비: 질문 UI 감춰짐(깨우기 전)", (await page.locator("textarea.qbox").count()) === 0);
  check("로비: 깨우기 힌트 노출", await page.getByText("두 번 두드리면").isVisible());
  await shot("05_lobby");
  await page.locator("canvas").first().dblclick(); // 두 번 두드려 깨움
  await page.waitForTimeout(1000);
  check("깨운 뒤 질문 UI 노출", await page.locator("textarea.qbox").isVisible());
  check("깨운 뒤 로비 힌트 사라짐", (await page.getByText("두 번 두드리면").count()) === 0);
  check("첫 방문엔 데일리 카드 없음", (await page.locator(".daily").count()) === 0);
  await shot("05b_awake");

  // 6. 속결 모드 — C형 힌트면 '가볍게'가 gold, 실패해도 데드엔드 없음
  await page.locator("textarea.qbox").fill("점심 뭐 먹지");
  await page.waitForTimeout(300);
  const quickCls = (await page.getByRole("button", { name: "가볍게 물을래" }).getAttribute("class")) || "";
  check("C형 힌트 → 속결이 기본(gold)", quickCls.includes("gold"));
  await page.getByRole("button", { name: "가볍게 물을래" }).click();
  await page.waitForSelector("text=판결이 닿지 못했어", { timeout: 10000 });
  check("속결 실패 시 에러 표시", true);
  check("속결 실패 후 버튼 생존(데드엔드 없음)", await page.getByRole("button", { name: "가볍게 물을래" }).isVisible());
  await shot("06_quick_fail");

  // 7. 동전 의식 — 실패 시 '다시 청하기'+'질문을 고칠래' (데드엔드 수리 검증)
  await page.locator("textarea.qbox").fill("이직할까?");
  await page.waitForTimeout(300);
  const ritualCls = (await page.getByRole("button", { name: "판결을 청한다" }).getAttribute("class")) || "";
  check("무게 질문 → 의식이 기본(gold)", ritualCls.includes("gold"));
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();
  await page.waitForSelector("text=판결이 닿지 못했어", { timeout: 12000 });
  check("의식 실패: '다시 청하기' 노출", await page.getByRole("button", { name: "다시 청하기" }).isVisible());
  check("의식 실패: '질문을 고칠래' 노출", await page.getByRole("button", { name: "질문을 고칠래" }).isVisible());
  await shot("07_ritual_fail_recovery");
  await page.getByRole("button", { name: "질문을 고칠래" }).click();
  await page.waitForTimeout(400);
  check("탈출구 후 질문 수정 가능", await page.locator("textarea.qbox").isEnabled());

  // 8. 재회 — localStorage 복원
  const stored = await page.evaluate(() => localStorage.getItem("binari.v1"));
  check("localStorage 저장됨", !!stored, stored ? `${stored.length} bytes` : "없음");
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1600);
  // v52: 재방문도 로비 직행 — 인사·힌트만, 질문/데일리는 깨운 뒤
  check("재회: 로비 직행(온보딩 생략)", await page.getByText("두 번 두드리면").isVisible() && (await page.locator("textarea.qbox").count()) === 0);
  check("재회 인사(로비)", await page.getByText("다시 왔네. 기다렸어.").isVisible());
  await shot("08_lobby_return");
  await page.locator("canvas").first().dblclick(); // 깨움 → 방 진입
  await page.waitForTimeout(1000);
  check("깨운 뒤 질문 UI", await page.locator("textarea.qbox").isVisible());
  // v18 모를 권리: 자동 펼침이 아니라 노크 → 탭해야 카드
  check("재회: 아침 문안 노크(자동 펼침 아님)", await page.getByText("수호신이 오늘의 하늘을 봐뒀어").isVisible());
  check("노크 전 카드 미노출(모를 권리)", (await page.getByText("아침 문안").count()) === 0);
  check("토정비결 읽기UI 제거(운세 카탈로그 정리)", (await page.getByText("올해의 흐름도 봐줄까?").count()) === 0 && (await page.getByText("새해의 괘").count()) === 0);
  await page.getByText("수호신이 오늘의 하늘을 봐뒀어").click();
  await page.waitForTimeout(400);
  check("노크 후 아침 문안 펼침", await page.getByText("아침 문안").isVisible());
  await shot("08_return_daily");
  await page.getByRole("button", { name: "받았어" }).click();
  await page.waitForTimeout(400);
  check("데일리 수령 후 카드 소멸", (await page.getByText("아침 문안").count()) === 0);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1600);
  await page.locator("canvas").first().dblclick(); // 재재방문 로비 → 깨움
  await page.waitForTimeout(1000);
  check("재재방문: 노크·카드 재노출 없음", (await page.getByText("수호신이 오늘의 하늘을 봐뒀어").count()) === 0 && (await page.getByText("아침 문안").count()) === 0);
  check("리셋 링크 존재", await page.getByText("다른 사람이야?").isVisible());
  await shot("09_return_after_daily");
} catch (e) {
  check("예외 없이 완주", false, e.message.slice(0, 200));
  await shot("99_error");
}

await browser.close();
const fails = results.filter(r => !r.pass);
console.log(`\n=== 결과: ${results.length - fails.length}/${results.length} PASS ===`);
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log(` - ${f.name}: ${f.note}`)); process.exit(1); }
