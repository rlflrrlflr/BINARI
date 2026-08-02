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
// v105 콜3(서신). 콜2와 헷갈리지 않게 표지를 따로 둔다 — 콜3 지시문에 '[이미 확정된 판결]' 문자열이 들어가면
// 아래 분기가 콜3을 콜2로 잘못 태운다. 앱 쪽 문구를 '[확정된 판결 —'로 바꿔 그 충돌을 없앴다.
const LETTER_MARK = "[이번 출력 — 수호신의 서신]";
// v105.1 서신은 두 조각을 동시에 부른다. 조각별로 다른 응답을 돌려줘 합쳐지는지까지 본다.
const CALL3A = JSON.stringify({
  chapters: [
    { t: "네가 망설인 자리", body: "너는 '전남친에게 연락할까?'라고 물었어. 그 문장 하나에 오래 서 있었지. 관성이 두터운 사람이라 남의 눈이 먼저 보인다." },
    { t: "여덟 글자가 이 일을 보는 눈", body: "네 명식에서 사람 자리는 두터운데, 거둘 자리가 얇아. 벌이는 힘은 있고 끝내는 힘이 모자란 구조야." },
  ],
});
/* 조각 B는 일부러 t/body 가 아닌 title/text 로 준다 — 2026-08-01 실제 사고의 회귀 시험.
   그때 서버는 200으로 잘 돌아왔는데 클라이언트가 정확한 키만 받아서 서신을 통째로 버렸다. */
const CALL3B = JSON.stringify({
  chapters: [
    { title: "언제 — 흐름과 움직일 날", text: "이달 하순은 아니야. 다음 달 초순, 특히 말날이 열려 있어. 8월 12일과 24일을 적어둬." },
    { title: "누구와 — 도울 사람, 피할 자리", text: "돼지띠가 널 돕고, 뱀띠 앞에서는 말을 줄여. 서쪽으로 난 자리에서 얘기를 꺼내는 게 낫다." },
    { title: "무엇을 걸고", text: "멈추면 미련이 남아. 그건 치러야 할 값이야. 대신 저쪽이 먼저 연락해 오면 이 판결을 뒤집어." },
  ],
  closing: "네 편이야, 늘.",
});

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
  await page.addInitScript(({ c1, c2, c3a, c3b, mk }) => {
    window.claude = { complete: async (p) => (p.includes(mk) ? (p.includes('1장 "') ? c3a : c3b) : p.includes("[이미 확정된 판결]") ? c2 : c1) };
  }, { c1: CALL1, c2: CALL2, c3a: CALL3A, c3b: CALL3B, mk: LETTER_MARK });
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
  /* 알(pip) 표기 — 2026-08-02 실측 사고: 7:1로 이긴 GO 판결이 "8개 중 1개 찬성"으로 찍혀
     화면상 1:7로 뒤집혀 보였다. 켜진 알은 언제나 '이 판결과 같은 쪽'이어야 한다.
     이 픽스처의 표는 사주 GO·달 GO·별자리 STOP → 앱이 GO 로 집계(3개 중 2개 같은 쪽, 알 2개). */
  {
    await page.waitForSelector(".pips em", { timeout: 15000 }).catch(() => {});
    const label = (await page.locator(".pips em").allTextContents())[0] || "";
    const lit = await page.locator(".pips .pip.on").count();
    ck("알 표기가 지지 수를 가리킴", label.includes("2개 같은 쪽") && lit === 2, `${label} · 켜진 알 ${lit}`);
  }

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
  /* v105 서신 본문 — 로비 서신함 → 전문 → 값했나 평가. 콜3이 실제로 다녀왔는지까지 본다. */
  await page.waitForSelector("text=서신을 펼친다", { timeout: 20000 });
  ck("⑦ 로비 서신함 도착", true);
  const wrote = await page.evaluate(() => (window.__binariEvents || []).find((e) => e.ev === "letter_written"));
  ck("⑧ 콜3 성사(letter_written)", !!wrote, wrote ? `${wrote.props.chapters}장 · ${wrote.props.chars}자` : "이벤트 없음");
  await page.getByRole("button", { name: "서신을 펼친다" }).click();
  await page.waitForSelector(".readwrap", { timeout: 5000 });
  const chaps = await page.locator(".rct").allTextContents();
  ck("⑨ 두 조각이 다섯 장으로 합쳐짐", chaps.length === 5, chaps.map((s) => s.replace(/^\d/, "")).join(" · "));
  // title/text 로 온 3~5장이 살아남았는지 = 2026-08-01 사고의 회귀 시험
  ck("⑨-2 다른 키 이름(title/text)도 읽음", await page.getByText("8월 12일과 24일을 적어둬", { exact: false }).isVisible().catch(() => false));
  ck("⑨-3 맺음말", await page.getByText("네 편이야, 늘.", { exact: false }).isVisible().catch(() => false));
  ck("⑩ 서신에 AI 생성 고지", await page.getByText("이 서신은 AI가 생성한 내용입니다", { exact: false }).isVisible().catch(() => false));
  await page.getByRole("button", { name: "값했어" }).click();
  const rated = await page.evaluate(() => (window.__binariEvents || []).find((e) => e.ev === "letter_rated"));
  ck("⑪ 값했나 평가 계측", rated?.props?.worth === true, JSON.stringify(rated?.props?.worth));
  await page.getByRole("button", { name: "접어둘게" }).click();
  await page.waitForSelector(".readwrap", { state: "detached", timeout: 5000 });
  // 서신을 맡긴 뒤 한 번 더 묻는가 = 이 연출의 유일한 존재 이유. 그 표식이 실제로 붙는지 확인한다.
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 8000 });
  // v105.2 홈 서신함 — 유료로 산 것이니 판결이 끝난 뒤에도 홈에서 상시 열려야 한다
  ck("⑫ 홈 서신함 상시 노출", await page.getByRole("button", { name: /수호신의 서신함/ }).isVisible().catch(() => false));
  await page.getByRole("button", { name: /수호신의 서신함/ }).click();
  ck("⑬ 서신 번호 표시", /[2-9A-Z]{4}-[2-9A-Z]{4}/.test((await page.locator(".lboxno").allTextContents())[0] || ""), (await page.locator(".lboxno").allTextContents())[0] || "");
  await page.getByRole("button", { name: "서신함 접기" }).click();
  await page.locator("textarea.qbox").fill("그럼 그동안 뭘 하면 좋을까"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "판결을 청한다" }).click();
  await page.waitForSelector("text=동전 셋", { timeout: 5000 });
  await page.getByRole("button", { name: "한 번에 던지기" }).click();   // question_asked 는 괘를 뽑은 뒤 judge() 안에서 나간다
  ck("서신 후 판결 성사", await waitVerdict(page));
  const qa = await page.evaluate(() => (window.__binariEvents || []).filter((e) => e.ev === "question_asked").pop());
  ck("⑥ 서신 후 재질문 표식(after_letter)", qa?.props?.after_letter === true, JSON.stringify(qa?.props?.after_letter));

  /* v105.2 재발행 — "고객이 서신을 날렸다"를 실제로 재현한다.
     저장소에서 본문만 지우고 새로고침 = 기기를 바꿨거나 iOS 가 저장소를 비운 상황.
     영수증(paid)과 재료(lmat)가 남아 있으면 값을 다시 받지 않고 되살릴 수 있어야 한다. */
  await page.evaluate(() => {
    const k = "binari.v1"; const m = JSON.parse(localStorage.getItem(k) || "{}");
    (m.records || []).forEach((r) => { delete r.letter; });
    localStorage.setItem(k, JSON.stringify(m));
  });
  await page.reload();
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 12000 });
  const boxBtn = page.getByRole("button", { name: /수호신의 서신함/ });
  ck("⑭ 잃어버린 서신도 서신함에 남음", (await boxBtn.textContent().catch(() => "") || "").includes("못 받은 게 있어"), await boxBtn.textContent().catch(() => ""));
  await boxBtn.click();
  await page.getByRole("button", { name: "다시 받기" }).click();
  await page.waitForSelector(".readwrap", { timeout: 25000 });
  ck("⑮ 재발행 성공(값 다시 안 받음)", await page.getByText("8월 12일과 24일을 적어둬", { exact: false }).isVisible().catch(() => false));
  const rei = await page.evaluate(() => (window.__binariEvents || []).find((e) => e.ev === "letter_reissued"));
  ck("⑯ 재발행 계측", !!rei, rei ? `${rei.props.chapters}장` : "이벤트 없음");
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
