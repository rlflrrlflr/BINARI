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
ck("힘의 저울 표시", /힘의 저울/.test(body) && /(제 힘으로 미는 쪽|받쳐줘야 사는 쪽|어느 쪽도 아닌 가운데)/.test(body));
ck("대운 사다리 — 첫 구간이 있다", /1?\d~\d+세 [가-힣]{2}/.test(body), body.match(/\d+~\d+세 [가-힣]{2}/g)?.slice(0, 2).join(" ") || "");
ck("대운에 '지금' 구간 표식", /◂ 지금/.test(body));
ck("세운(배경) 병기", /\d{4} [가-힣]{2}/.test(body));
// v107.1 용신 — 억부는 신강·신약에서 기계적으로 도출되므로 항상 나와야 한다
ck("채울 기운 표시", /채울 기운[^—]{0,12}— (나무|불|흙|쇠|물)/.test(body), (body.match(/채울 기운[^—]{0,12}— [가-힣·]+/) || [])[0] || "");
ck("용신 대운 구간에 ★ 표식", /채울 기운이 들어오는 구간 ★/.test(body));
ck("곁에 두면 좋은 것(색·방위·이름 소리)", /곁에 두면 좋은 것/.test(body) && /이름 소리로는/.test(body));
// 1990-02-25 14:30 남 — 십성에 동률이 있으면 3위 값과 같은 항목이 모두 나와야 한다(잘림 검출은 개수 하한으로)
const ssLines = (body.match(/(나란히 서는 힘|겨루는 힘|먹고사는 재주|튀는 재주|꾸준한 재물|굴리는 재물|자리와 책임|몰아치는 압박|배움과 도움|혼자 파는 힘) \d/g) || []).length;
ck("자리 표기 3개 이상(동률 잘림 없음)", ssLines >= 3, `${ssLines}개`);
// v109 명식 원판 — 사주 8자·오행 개수·일간은 온보딩 연출에만 있었고 리포트엔 없었다.
// 재방문하면 온보딩을 건너뛰므로 유저는 자기 사주를 두 번 다시 볼 수 없었다.
ck("각인 — 여덟 자리 전부 표시", (body.match(/[갑을병정무기경신임계][자축인묘진사오미신유술해]/g) || []).length >= 4,
   (body.match(/[갑을병정무기경신임계][자축인묘진사오미신유술해]/g) || []).slice(0, 4).join(" "));
ck("각인 — 너 자신이 누구인지 명시", /너 자신 [갑을병정무기경신임계] · (나무|불|흙|쇠|물)/.test(body));
ck("각인 — 기운 개수 막대 5종", (await page.locator(".msrbody .bar").count()) === 5);
ck("계산 근거 고지(직접 계산·대조 검증)", /태양의 실제 위치를 직접 계산/.test(body) && /대조 검증 28건/.test(body));
ck("시각 보정 분 공개", /[+−]\d+분 보정/.test(body), (body.match(/[+−]\d+분 보정/) || [])[0] || "");
ck("자리 전량 공개(그 밖의 자리들)", /그 밖의 자리들/.test(body));
// ── v110 정직성 4 (작명 구상 §3-8 차용). 리포트는 '알 권리' 국면이라 판결과 규칙이 반대다.
// ① 판단마다 확신도 3단 — 계산값과 유파 해석과 곁가지를 같은 목소리로 말하면 전부가 헐거워진다
const cfs = await page.locator(".msrbody .cf").allTextContents();
ck("확신도 꼬리표 3종이 모두 쓰인다", ["확실한 것", "갈리는 것", "곁들이는 것"].every((t) => cfs.includes(t)),
   `${cfs.length}개 · ${[...new Set(cfs)].join("/")}`);
ck("확신도 범례를 본문 앞에 준다", (await page.locator(".msrbody .cfleg").count()) === 1);
// ② 읽은 것과 못 읽은 것을 먼저 가른다 — 빠진 게 없으면 '없다'고 말해야 한다('침묵'과 '완전'은 다른 정보다)
ck("'읽지 못한 것' 절이 항상 있다", /읽지 못한 것/.test(body));
ck("빠짐없이 읽혔으면 그렇다고 말한다", /전부 읽혔어/.test(body) || /(태어난 시|성별|태어난 도시|아직 오지 않은 날)/.test(body));
// ③ 용어 → 쉬운 말 → 실제로 나타나는 모습, 그리고 ④ 그늘까지
const three = await page.locator(".msrbody .msr3").count();
ck("십성 해설이 3단(실제로는·그늘)", three >= 1 && /실제로는/.test(body) && /그늘/.test(body), `${three}개`);
// 알 권리 — 일지는 배우자궁인데 지금까지 계산만 하고 화면에 안 썼다
ck("짝의 자리 공개", /짝의 자리 — .{4,}/.test(body), (body.match(/짝의 자리 — .{0,24}/) || [])[0] || "");
// ── v111 항목별 4단 (창업자 지시 2026-08-11): 리포트의 본체는 '사주 항목'이 아니라 '삶의 자리'다.
// "태어날 때 이랬어 → 자라며 이렇게 나타났어 → 지금 어디야 → 앞으로 이렇게 돼"
const nDom = await page.locator(".msrbody .dom").count();
ck("삶의 자리가 아홉(성별 있을 때)", nDom === 9, `${nDom}개`);
const nStep = await page.locator(".msrbody .dstep").count();
ck("자리마다 네 단", nStep === nDom * 4, `${nStep}단`);
const labs = [...new Set(await page.locator(".msrbody .dstep i").allTextContents())];
ck("4단 이름이 넷뿐", labs.length === 4 && ["새겨질 때", "자라면서", "지금", "앞으로"].every((t) => labs.includes(t)), labs.join("/"));
// .dstep 은 flex 다. 본문을 한 겹으로 안 싸면 강조 조각마다 열이 갈려 글이 세로로 찢어진다(v111 실측)
const wrapped = await page.evaluate(() => [...document.querySelectorAll(".dstep")]
  .every((p) => p.children.length === 2 && p.children[1].classList.contains("dt")));
ck("4단 본문이 한 열로 묶인다(세로 찢김 방지)", wrapped);
const dom = (await page.locator(".msrbody .dom").allTextContents()).join("\n");
ck("「지금」이 실제 흐름 구간을 짚는다", /지금[\s\S]{0,90}\d+~\d+세/.test(dom),
   (dom.match(/지금[\s\S]{0,60}\d+~\d+세/) || [])[0]?.replace(/\s+/g, " ") || "");
// "어떤 류다"로 끝내지 말고 예를 들라는 지시 — 사건 예시가 실제로 나가는지 본다
ck("「앞으로」가 예를 들어 말한다(선을 넘는다)",
   /(월급이 오르거나|목돈이 오가는|직함이 생기거나|이직·발령|학교·자격|동업·팀|경쟁자가 생기고|먹는 일·가르치는|말·글·영상|혼자 파는 일)/.test(dom));
ck("몸 자리가 어디가 약한지 말한다", /(콩팥·방광|폐·대장|비장·위|심장·혈관|간·쓸개)/.test(dom),
   (dom.match(/그 자리는 [^.]{0,24}/) || [])[0] || "");
ck("아홉 자리 제목이 다 있다",
   ["몸 —", "마음 —", "배움 —", "일 —", "돈 —", "연애 —", "결혼 —", "자녀 —", "사람 —"].every((t) => dom.includes(t)));
// 표에서 조립한 문장이라 받침 처리를 빠뜨리면 바로 티가 난다(v111 실측: "식신로 결이", "귀이야")
// 받침 있음: 힘(ㅁ)·책임(ㅁ)·압박(ㄱ)·도움(ㅁ) → 으로 / 없거나 ㄹ: 재주·자리·재물(ㄹ) → 로
ck("조사 — 받침 있는 말 뒤엔 '으로'",
   !/(힘|책임|압박|도움)로 결이/.test(dom) && !/(재주|재물|자리)으로 결이/.test(dom),
   (dom.match(/.{0,12} 결이 바뀌어/) || [])[0] || "해당 없음");
ck("조사 — 받침 없는 말 뒤엔 '야'", !/(귀|코)이야/.test(dom));
ck("성별이 있으면 '못 편다' 안내가 안 뜬다", !/연애·자녀 두 자리는/.test(body));
// ── v112 용어 은닉 (창업자 지시 2026-08-12: "어떤 분석 기법이 들어갔는지 안 나왔으면 좋겠어") ──
// 용어 자체는 공개 지식이지만, 그대로 쓰면 **어떤 기법을 어떤 표에 매핑했는지**가 한 화면에 통째로 읽힌다.
// 이 검사가 없으면 다음 기능을 붙일 때 용어가 슬그머니 돌아온다. 그래서 금칙어를 못 박는다.
// 경계선: 그 사람의 값(여덟 글자·간지·개수)은 남기고, 기법의 이름만 뺀다.
const BANNED = [
  "십성", "일간", "일지", "월지", "년주", "월주", "일주", "시주", "명식", "대운", "세운", "용신",
  "신강", "신약", "억부", "조후", "신살", "지장간", "배우자궁", "재다신약", "만세력", "명리",
  "진태양시", "태양황경", "율리우스", "균시차", "유파", "통설", "삼합", "육합", "원진",
  "비견", "겁재", "식신", "정재", "편재", "정관", "편관", "정인", "편인",
  "천을귀인", "문창귀인", "암록", "역마", "도화", "화개",
];   // '상관'은 "직접 상관없다"로도 쓰여 오탐이 나므로 아래에서 따로 본다
const leaked = BANNED.filter((w) => body.includes(w));
ck("기법 용어가 화면에 안 나온다", leaked.length === 0, leaked.join(",") || "깨끗");
ck("'상관'이 십성 뜻으로 안 쓰인다", !/상관 \d|상관[의·]|상관 십/.test(body),
   (body.match(/.{0,10}상관.{0,10}/) || [])[0] || "없음");
// 그 사람의 값은 그대로 남아 있어야 한다 — 용어를 뺀다고 근거까지 지우면 알 권리 위반이다
ck("값은 그대로 남는다(여덟 글자)", (body.match(/[갑을병정무기경신임계][자축인묘진사오미신유술해]/g) || []).length >= 4);
ck("값은 그대로 남는다(흐름 구간)", /\d+~\d+세 [가-힣]{2}/.test(body));
ck("평범한 말로 갈렸다(십성 자리 이름)",
   /(나란히 서는 힘|겨루는 힘|먹고사는 재주|튀는 재주|꾸준한 재물|굴리는 재물|자리와 책임|몰아치는 압박|배움과 도움|혼자 파는 힘)/.test(body));
ck("확신도 꼬리표도 평범한 말", ["확실한 것", "갈리는 것", "곁들이는 것"].every((t) => cfs.includes(t)), [...new Set(cfs)].join("/"));
ck("화면 오류 없음", errs.length === 0, errs.join(" / "));

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 리포트 체크: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
