// 실행: npm run preview -- --port 4173 & 후 node e2e/smoke.mjs (playwright 필요)
// 비나리 v16 런타임 스모크 테스트 — 모바일 뷰포트, 온보딩→수호신→의식 실패 복구→재회(localStorage)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;

const SHOTS = process.env.SHOTS_DIR || "/tmp/binari-shots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, pass, note = "") => { results.push({ name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} — ${name}${note ? " · " + note : ""}`); };

const browser = await chromium.launch((process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}));
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
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();

  // 3. 회상 리빌 → 곧장 수호신 형성 (v114 MBTI 4문항 · v128 가치여정 3화면 제거)
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 }); // v128: 회상 다음이 곧장 수호신 형성
  
  check("혈액형 입력 제거됨(v24)", (await page.getByText("혈액형").count()) === 0 && (await page.getByRole("button", { name: "B형", exact: true }).count()) === 0);
  await shot("03_reveal");
  await page.waitForTimeout(700);
  // 5. 수호신 형성(3.2s) → 로비(질문 감춤) → 두드려봐 깨움 → 질문 UI
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  await page.waitForTimeout(800);
  check("로비: 질문 UI 감춰짐(깨우기 전)", (await page.locator("textarea.qbox").count()) === 0);
  check("로비: 깨우기 힌트 노출", await page.getByText("두드려봐").isVisible());
  await shot("05_lobby");
  await page.locator("canvas").first().dblclick(); // 두드려봐 깨움
  await page.waitForTimeout(1000);
  check("깨운 뒤 질문 UI 노출", await page.locator("textarea.qbox").isVisible());
  check("깨운 뒤 로비 힌트 사라짐", (await page.getByText("두드려봐").count()) === 0);
  check("첫 방문엔 데일리 카드 없음", (await page.locator(".daily").count()) === 0);
  await shot("05b_awake");

  // 6. v103 — 속결 제거. 질문 화면에 길은 하나뿐이어야 한다(입구에서 또 고르게 하지 않는다)
  await page.locator("textarea.qbox").fill("점심 뭐 먹지");
  await page.waitForTimeout(300);
  check("속결 버튼 사라짐", (await page.getByRole("button", { name: "가볍게 물을래" }).count()) === 0);
  check("가벼운 질문에도 '판결을 청한다' 단일 경로", await page.getByRole("button", { name: "판결을 청한다" }).isVisible());
  const onlyCls = (await page.getByRole("button", { name: "판결을 청한다" }).getAttribute("class")) || "";
  check("단일 버튼이 기본 강조(gold)", onlyCls.includes("gold"));
  await shot("06_single_path");

  // 7. 동전 의식 — 실패 시 '다시 청하기'+'질문을 고칠래' (데드엔드 수리 검증)
  await page.locator("textarea.qbox").fill("이직할까?");
  await page.waitForTimeout(300);
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
  check("재회: 로비 직행(온보딩 생략)", await page.getByText("두드려봐").isVisible() && (await page.locator("textarea.qbox").count()) === 0);
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

  /* ── A-1 (작업지시 2026-08-14): 처리방침이 안내한 분석 거부 수단이 화면에 실재하고 실제로 끄는가 ──
     v122 가 동의 체크박스를 빼면서, 문서만 "해제하면 중단된다"고 남았다. 수단을 만들었으니 화면에서 확인한다. */
  const optBtn = page.getByRole("button", { name: /사용 통계 수집을 끌래|사용 통계 수집 — 꺼짐/ });
  check("A-1 분석 거부 스위치가 로비에 있다", (await optBtn.count()) >= 1);
  if (await optBtn.count()) {
    await optBtn.first().click(); await page.waitForTimeout(250);
    const off = await page.evaluate(() => localStorage.getItem("binari.analytics_optout.v1"));
    check("A-1 누르면 실제로 꺼진다", off === "1", `키=${off}`);
    await optBtn.first().click(); await page.waitForTimeout(250);   // 되돌려 둔다
  }

  /* ── A-6: 남의 생년월일이 리셋에 **실제로** 지워지는가 ──
     정적 검사(privacy-check)는 코드 모양만 본다. 궁합의 상대 생년월일은 **제3자 정보**라
     "코드가 그렇게 생겼다"로는 부족하다 — 브라우저에서 눌러서 확인한다. */
  await page.evaluate(() => {
    localStorage.setItem("binari.match_last.v1", JSON.stringify({ y: 1997, m: 4, d: 22 }));
    localStorage.setItem("binari.imprint_extra.v1", JSON.stringify({ married: true }));
    localStorage.setItem("binari.internal.v1", "1");
  });
  check("A-6 상대 생년월일이 저장된 상태(사전 조건)",
    await page.evaluate(() => !!localStorage.getItem("binari.match_last.v1")));
  await page.getByText("다른 사람이야?").click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "응, 흩어져도 돼" }).click();
  await page.waitForTimeout(1200);
  const left = await page.evaluate(() => ({
    match: localStorage.getItem("binari.match_last.v1"),
    extra: localStorage.getItem("binari.imprint_extra.v1"),
    team: localStorage.getItem("binari.internal.v1"),
  }));
  check("A-6 리셋이 상대 생년월일을 지운다", left.match === null, String(left.match));
  check("A-6 리셋이 각인 선택 입력도 지운다", left.extra === null, String(left.extra));
  check("A-6 리셋이 팀 플래그는 남긴다(계측 오염 방지)", left.team === "1", String(left.team));

  /* v128 이관 — 가치여정·MBTI 를 없앤 뒤에도 **그 전에 저장한 사람**이 멀쩡해야 한다.
     두 번 났던 사고라 실제 옛 저장분을 심어 놓고 확인한다: 필수 조각 검증에 core 가 남아 있으면
     ①온보딩이 처음부터 다시 뜨고 ②질감 코드가 사라져 쓰던 수호신 얼굴이 달라진다. 둘 다 오류는 안 뜬다. */
  const legacy = {
    birth: { y: "1990", m: "2", d: "25", h: "14", min: "30", name: "테스트", sex: "여", cal: "양", city: "서울" },
    saju: { main: "화", dayGan: "병", counts: { 목: 1, 화: 3, 토: 2, 금: 1, 수: 1 }, pillars: { 년: "경오", 월: "무인", 일: "병자", 시: "을미" } },
    zo: { name: "물고기자리", el: "물" }, moon: { name: "그믐달", sub: "s", read: "r" }, num: 7,
    mbti: "ENTJ", vals8: ["안정", "성장", "자유", "인정", "관계", "성취"], vals4: ["안정", "성장", "자유"], core: "안정",
    convo: [], records: [], streak: { last: "2026-08-15", count: 1 },
  };
  await page.goto("http://localhost:4173/");
  await page.evaluate((m) => localStorage.setItem("binari.v1", JSON.stringify(m)), legacy);
  await page.reload(); await page.waitForTimeout(3000);
  const btxt = await page.locator("body").innerText();
  check("v128 이관: 옛 저장분이 온보딩을 다시 요구하지 않음", !btxt.includes("조각을 모으러 갈래"));
  const mig = await page.evaluate(() => JSON.parse(localStorage.getItem("binari.v1") || "{}"));
  check("v128 이관: 수호신 질감 코드 보존(mbti→tex)", mig.tex === "ENTJ", `tex=${mig.tex}`);
  check("v128 이관: 가치 필드는 정리됨", mig.core === undefined && mig.vals8 === undefined);
  check("v128 이관: 기억 본체 생존", !!mig.saju);
} catch (e) {
  check("예외 없이 완주", false, e.message.slice(0, 200));
  await shot("99_error");
}

await browser.close();
const fails = results.filter(r => !r.pass);
console.log(`\n=== 결과: ${results.length - fails.length}/${results.length} PASS ===`);
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log(` - ${f.name}: ${f.note}`)); process.exit(1); }
