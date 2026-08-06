// 상세 리포트(타고난 그릇) 회귀 — v107에서 신설.
// 배경(실사고 2026-08-02): 십성 동률일 때 상위 3개가 삽입 순서로 뽑혔고, 흐름에 주 시계(대운)가 없었고,
// 미래 생일에 이번 주 택일이 나갔다. 이 화면은 카드 뒷면 안에 있어서 어떤 e2e도 열어보지 않았다 —
// 고장 나도 아무 검사가 안 우는 자리였다. 그래서 리포트를 실제로 열어 확인하는 검사를 신설한다.
// 실행: preview 기동 후 node e2e/report-check.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";

const R = []; const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
const CALL1 = JSON.stringify({ category: "B", votes: [{ axis: "사주", v: "GO" }, { axis: "달", v: "GO" }, { axis: "별자리", v: "STOP" }], tone: "단호", direction: "STOP", verdict: "보내지 마. 끝.", against: 4, total: 6 });
const CALL2 = JSON.stringify({ subline: "밤이 널 속이는 거야.", reasons: [{ axis: "사주", vote: "STOP", text: "화기가 널 밀어." }], funLine: "욱하지 마.", disclaimer: "" });

async function onboard(page) {
  await page.goto(BASE); await page.waitForTimeout(900);
  await page.getByRole("button", { name: "조각을 모으러 갈래" }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "이름 없이 갈래" }).click();
  const ins = page.locator("input.in:not(.wide)");
  await ins.nth(0).fill("1990"); await ins.nth(1).fill("2"); await ins.nth(2).fill("25");
  await page.getByRole("button", { name: "이 하늘이야" }).click();
  const tins = page.locator("input.in:not(.wide)");
  await tins.nth(0).fill("14"); await tins.nth(1).fill("30");
  await page.getByRole("button", { name: "기억났어" }).click();
  // 성별 장면(bstep 3): 버튼 문구는 '남'/'여' — 대운 사다리를 보려면 성별이 필요하다
  await page.getByRole("button", { name: "남", exact: true }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "하늘을 열기" }).click();
  await page.getByRole("button", { name: "응, 기억나" }).click({ timeout: 12000 });
  await page.waitForSelector("text=요즘의 너는", { timeout: 10000 });
  for (const t of ["혼자일 때 차오르는 쪽", "아직 오지 않은 것을 보는 쪽", "마음이 먼저 움직이는 쪽", "열어둔 길이 편한 쪽"]) await page.getByRole("button", { name: t }).click();
  await page.getByRole("button", { name: "마음의 방으로" }).click(); await page.waitForTimeout(500);
  for (const v of ["안정", "성장", "자유", "인정", "관계", "성취"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "여섯 개 골랐어" }).click(); await page.waitForTimeout(300);
  for (const v of ["안정", "성장", "자유"]) await page.getByRole("button", { name: v, exact: true }).click();
  await page.getByRole("button", { name: "셋을 남겼어" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: "안정", exact: true }).click();
  await page.getByRole("button", { name: "수호신 깨우기" }).click();
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 12000 }); await page.waitForTimeout(600);
}

const b = await chromium.launch((process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}));
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await page.addInitScript(({ c1, c2 }) => {
  window.claude = { complete: async (p) => (p.includes("[이미 확정된 판결]") ? c2 : c1) };
}, { c1: CALL1, c2: CALL2 });

await onboard(page);
await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
await page.getByRole("button", { name: "판결을 청한다" }).click();
await page.waitForSelector("text=동전 셋", { timeout: 5000 });
await page.getByRole("button", { name: "한 번에 던지기" }).click();
let got = false;
for (let i = 0; i < 40; i++) { if (((await page.locator(".vv").allTextContents())[0] || "").includes("보내지 마")) { got = true; break; } await page.waitForTimeout(300); }
ck("판결 도착", got);

// 뒤집기는 '왜 이렇게 봤어?'(콜2)가 온 뒤에만 열린다 — 실제 유저 경로 그대로 탄다
await page.getByRole("button", { name: "왜 이렇게 봤어?" }).click();
let sub = false;
for (let i = 0; i < 30; i++) { if (await page.getByText("밤이 널 속이는 거야.").isVisible().catch(() => false)) { sub = true; break; } await page.waitForTimeout(300); }
ck("근거(콜2) 도착 — 뒤집기 활성화 조건", sub);
await page.locator(".persp").first().click(); await page.waitForTimeout(800);
const btn = page.locator(".msrbtn");
ck("리포트 버튼 노출(뒷면)", (await btn.count()) > 0);
// v109 알 권리 — 리포트는 기본 펼침이다. 클릭하지 않고 바로 본문이 있어야 한다.
// (예전엔 여기서 msrbtn 을 눌러야 열렸다. 이제 누르면 오히려 접힌다.)
ck("리포트 기본 펼침(알 권리)", (await page.locator(".msrbody").count()) > 0);
ck("버튼 문구가 '접기'", /접기/.test((await btn.first().textContent()) || ""));

const body = (await page.locator(".msrbody").textContent().catch(() => "")) || "";
ck("힘의 저울(간이 신강·신약) 표시", /힘의 저울/.test(body) && /(신강|신약|중간)/.test(body));
ck("대운 사다리 — 첫 구간이 있다", /1?\d~\d+세 [가-힣]{2}/.test(body), body.match(/\d+~\d+세 [가-힣]{2}/g)?.slice(0, 2).join(" ") || "");
ck("대운에 '지금' 구간 표식", /◂ 지금/.test(body));
ck("세운(배경) 병기", /\d{4} [가-힣]{2}/.test(body));
// v107.1 용신 — 억부는 신강·신약에서 기계적으로 도출되므로 항상 나와야 한다
ck("채울 기운(용신) 표시", /채울 기운 — [목화토금수]/.test(body), (body.match(/채울 기운 — [목화토금수·]+/) || [])[0] || "");
ck("용신 대운 구간에 ★ 표식", /채울 기운이 들어오는 구간 ★/.test(body));
ck("곁에 두면 좋은 것(색·방위·이름 소리)", /곁에 두면 좋은 것/.test(body) && /이름 소리로는/.test(body));
// 1990-02-25 14:30 남 — 십성에 동률이 있으면 3위 값과 같은 항목이 모두 나와야 한다(잘림 검출은 개수 하한으로)
const ssLines = (body.match(/(비견|겁재|식신|상관|정재|편재|정관|편관|정인|편인) \d/g) || []).length;
ck("십성 표기 3개 이상(동률 잘림 없음)", ssLines >= 3, `${ssLines}개`);
// v109 명식 원판 — 사주 8자·오행 개수·일간은 온보딩 연출에만 있었고 리포트엔 없었다.
// 재방문하면 온보딩을 건너뛰므로 유저는 자기 사주를 두 번 다시 볼 수 없었다.
ck("명식 — 사주 네 기둥 전부 표시", (body.match(/[갑을병정무기경신임계][자축인묘진사오미신유술해]/g) || []).length >= 4,
   (body.match(/[갑을병정무기경신임계][자축인묘진사오미신유술해]/g) || []).slice(0, 4).join(" "));
ck("명식 — 일간(나)이 누구인지 명시", /나\(일간\) [갑을병정무기경신임계] · [목화토금수]/.test(body));
ck("명식 — 오행 개수 막대 5종", (await page.locator(".msrbody .bar").count()) === 5);
ck("계산 근거 고지(절기·일주·자동검증)", /태양황경/.test(body) && /율리우스일/.test(body) && /자동검증/.test(body));
ck("진태양시 보정 분 공개", /진태양시로 [+−]\d+분/.test(body), (body.match(/진태양시로 [+−]\d+분/) || [])[0] || "");
ck("십성 전량 공개(그 밖의 십성)", /그 밖의 십성/.test(body) || ssLines >= 10);
ck("화면 오류 없음", errs.length === 0, errs.join(" / "));

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 리포트 체크: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
