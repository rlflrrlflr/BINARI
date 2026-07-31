// 판결 경로 회귀 — ①window.claude.complete 정상 ②complete 고장 시 폭포수(→server 404→direct)
// 실행: preview 기동 후 node e2e/verdict.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";

const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const CALL1 = JSON.stringify({ category: "B", votes: [{ axis: "사주", v: "GO" }, { axis: "달", v: "GO" }, { axis: "별자리", v: "STOP" }], tone: "단호", direction: "STOP", verdict: "보내지 마. 끝.", against: 4, total: 6 });
const CALL2 = JSON.stringify({ subline: "밤이 널 속이는 거야.", reasons: [{ axis: "사주", vote: "STOP", text: "화기가 널 밀어." }], funLine: "욱하지 마.", disclaimer: "" });

async function onboard(page, qs = "") {   // qs: "?trackdebug" 처럼 쿼리를 붙일 때 쓴다(계측 검증용)
  await page.goto(BASE + qs); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "이름 없이 갈래" }).click(); // v26: 이름 장면 건너뛰기
  const ins = page.locator("input.in:not(.wide)");
  await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
  await page.getByRole("button", { name: "이 하늘이야" }).click();
  const tins = page.locator("input.in:not(.wide)");
  await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
  await page.getByRole("button", { name: "기억났어" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 }); // v30: 회상 나레이션 넘기기
  await page.waitForSelector("text=요즘의 너는", { timeout: 10000 });
  for (const t of ["혼자일 때 차오르는 쪽", "아직 오지 않은 것을 보는 쪽", "마음이 먼저 움직이는 쪽", "열어둔 길이 편한 쪽"]) await page.getByRole("button", { name: t }).click(); // v24: 순차 문항
  await page.getByRole("button", { name: "마음의 방으로" }).click(); await page.waitForTimeout(500);
  for (const v of ["안정", "성장", "자유", "인정", "관계", "성취"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "여섯 개 골랐어" }).click(); await page.waitForTimeout(300);
  for (const v of ["안정", "성장", "자유"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "셋을 남겼어" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "안정", exact: true }).click();
  await page.getByRole("button", { name: "수호신 깨우기" }).click();
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });        // v52: 로비
  await page.locator("canvas").first().dblclick();                              // 두드려봐 깨움
  await page.waitForSelector("textarea.qbox", { timeout: 12000 }); await page.waitForTimeout(600);
}
const vvText = async (page) => (await page.locator(".vv").allTextContents())[0] || "";
const waitVerdict = async (page) => { for (let i = 0; i < 40; i++) { if ((await vvText(page)).includes("보내지 마")) return true; await page.waitForTimeout(300); } return false; };

const b = await chromium.launch((process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}));

// ── 시나리오 1: complete 정상 (아티팩트 표준 환경) ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(9000);
  await page.addInitScript(({ c1, c2 }) => {
    window.claude = { complete: async (p) => (p.includes("[이미 확정된 판결]") ? c2 : c1) };
  }, { c1: CALL1, c2: CALL2 });
  await onboard(page, "?trackdebug");
  ck("S1 complete 감지", await page.evaluate(() => typeof window.claude?.complete === "function"));
  await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();
  ck("S1 판결(콜1)", await waitVerdict(page), await vvText(page));
  await page.getByRole("button", { name: "다른 걸 물어볼래" }).click(); await page.waitForTimeout(500);
  await page.waitForSelector("text=두드려봐", { timeout: 8000 }); // v55: 판결 후 로비 복귀
  await page.locator("canvas").first().dblclick(); // 다시 깨움
  await page.waitForSelector("textarea.qbox", { timeout: 8000 });
  await page.locator("textarea.qbox").fill("이직할까 크게 고민이야"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();
  ck("S1 두 번째 판결(콜1)", await waitVerdict(page));
  await page.getByRole("button", { name: "왜 이렇게 봤어?" }).click().catch(() => {});
  let subOk = false;
  for (let i = 0; i < 30; i++) { if (await page.getByText("밤이 널 속이는 거야.").isVisible().catch(() => false)) { subOk = true; break; } await page.waitForTimeout(300); }
  ck("S1 근거(콜2)", subOk);

  /* v104 서신 대기 연출 — 봉인 5초 → '곧 답변이 있을 것이다' 2초 → 로비.
     전체화면을 덮는 데다 되돌릴 버튼이 없으므로, 타이머가 끊기면 유저가 갇힌다. 끝까지 실제로 태워 본다. */
  await page.getByRole("button", { name: /수호신의 서신/ }).click();
  ck("서신 미리보기 + 환불 고지", await page.getByText("환불되지 않아요", { exact: false }).isVisible().catch(() => false));
  await page.getByRole("button", { name: "받을게" }).click();
  await page.waitForSelector(".sealwrap", { timeout: 3000 });
  ck("① 봉인 연출 등장", await page.getByText("수호신이 붓을 들었어").isVisible().catch(() => false));
  const t0 = Date.now();   // 연출 시작점 = 오버레이가 뜬 직후(클릭 처리 지연을 재지 않는다)
  await page.waitForSelector("text=곧 답변이 있을 것이다.", { timeout: 9000 });
  const dt = Date.now() - t0;
  ck("② 대기 문구 전환(약 5초 뒤)", dt >= 4000 && dt <= 7000, `${(dt / 1000).toFixed(1)}초`);
  await page.waitForSelector(".sealwrap", { state: "detached", timeout: 8000 });
  ck("③ 로비 복귀 + 수호신 한마디", await page.getByText("기다림이 짙을수록 가야할길은 투명해진다.").isVisible().catch(() => false));
  ck("④ 추가 질문 유도 문구", await page.getByText("지금 물어도 돼", { exact: false }).isVisible().catch(() => false));
  const evs = await page.evaluate(() => (window.__binariEvents || []).map((e) => e.ev));
  const seq = ["letter_clicked", "letter_intent_confirmed", "letter_seal_shown", "letter_wait_shown", "letter_lobby_returned"];
  let at = -1, ordered = true;
  for (const s of seq) { const i = evs.indexOf(s, at + 1); if (i < 0 || i < at) { ordered = false; break; } at = i; }
  ck("⑤ 단계별 계측 순서", ordered, seq.join(" → "));
  // 서신을 맡긴 뒤 한 번 더 묻는가 = 이 연출의 유일한 존재 이유. 그 표식이 실제로 붙는지 확인한다.
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 8000 });
  await page.locator("textarea.qbox").fill("그럼 그동안 뭘 하면 좋을까"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();   // question_asked 는 괘를 뽑은 뒤 judge() 안에서 나간다
  ck("서신 후 판결 성사", await waitVerdict(page));
  const qa = await page.evaluate(() => (window.__binariEvents || []).filter((e) => e.ev === "question_asked").pop());
  ck("⑥ 서신 후 재질문 표식(after_letter)", qa?.props?.after_letter === true, JSON.stringify(qa?.props?.after_letter));
  await page.close();
}

// ── 시나리오 2: complete가 존재하지만 고장(모바일 브리지 재현) → server 404 → direct 로 판결 성사 ──
{
  const page = await b.newPage({ viewport: { width: 430, height: 932 } });
  page.setDefaultTimeout(9000);
  await page.addInitScript(() => {
    window.claude = { complete: async () => { throw new Error("Invalid response format"); } };
  });
  await page.route("https://api.anthropic.com/**", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    // 콜1/콜2는 토큰 상한이 아니라 **앱이 실제로 쓰는 표지**로 가른다.
    // 사고(2026-07-28): 콜1 상한이 320→560으로 오르자 <=400 기준이 콜1 자리에 콜2 응답을 물려
    // "폭포수 판결 실패"로 보고했다. 앱은 멀쩡했고 고장난 건 이 줄이었다.
    const txt = JSON.stringify(body.messages || []).includes("[이미 확정된 판결]") ? CALL2 : CALL1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: txt }] }) });
  });
  await onboard(page);
  await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();
  ck("S2 complete 고장 → 폭포수로 판결 성사", await waitVerdict(page), await vvText(page));
  ck("S2 화면에 에러 없음(사용자는 실패를 못 느낌)", (await page.locator(".err").count()) === 0);
  await page.close();
}

// ── 시나리오 3: 클로드 '앱' 웹뷰(iOS UA, Safari 토큰 없음) — complete 봉인 + 정직한 안내 (2026-07 진단 실측 반영) ──
{
  const page = await b.newPage({
    viewport: { width: 430, height: 932 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  });
  page.setDefaultTimeout(9000);
  await page.addInitScript(() => {
    window.__completeCalled = false;
    window.claude = { complete: async () => { window.__completeCalled = true; throw new Error("Invalid response format"); } };
  });
  await page.route("https://api.anthropic.com/**", (route) => route.abort());   // 앱처럼 직접 호출도 차단
  await onboard(page);
  await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();
  let errTxt = "";
  for (let i = 0; i < 30; i++) { errTxt = (await page.locator(".err").allTextContents()).join(""); if (errTxt) break; await page.waitForTimeout(300); }
  ck("S3 앱 웹뷰: complete 호출 안 함(아티팩트 사망 방지)", (await page.evaluate(() => window.__completeCalled)) === false);
  ck("S3 앱 웹뷰: 정직한 안내 표시", errTxt.includes("사파리"), errTxt.slice(0, 80));
  ck("S3 앱 웹뷰: 재시도 UI 생존", await page.getByRole("button", { name: "다시 청하기" }).isVisible());
  await page.close();
}

await b.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 판결 경로: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
