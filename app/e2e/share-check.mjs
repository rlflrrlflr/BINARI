/* 공유 판결 서명 검사 — 위조된 '비나리 판결'이 화면에 그려지지 않는가.
   실행: preview 기동 후 node e2e/share-check.mjs

   실제 사고(2026-08-15): 공유 링크가 `?v=<base64 JSON>` 이고 서명이 없어서, 누구나 URL 을
   지어내면 우리 앱이 그걸 **진짜 판결 카드로** 렌더했다. BINARI 로고·神 인장이 붙은 채로,
   SYS 가 명시적으로 금지한 "이번 달 안에 세 배는 확실해" 같은 문장까지 띄웠다.
   가드레일은 전부 생성 경로에만 있어서, URL 한 줄로 12,000자짜리 규칙 전체가 우회됐다.

   그래서 여기서 보는 것은 하나다 — **서명을 통과하지 못한 판결은 절대 그리지 않는가.** */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { sign, verify } from "../api/share.js";

const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const KEY = "테스트용-비밀키-share-check";
const b64 = (s) => Buffer.from(new TextEncoder().encode(s)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const mkPayload = (over = {}) => b64(JSON.stringify({
  q: "회사 그만두고 이 코인에 전 재산 넣을까?", d: "GO",
  v: "넣어. 이번 달 안에 세 배는 확실해.", s: "네 사주에 큰 재물이 들어오는 때야.",
  n: "강석우", a: 0, t: 8, c: "A", ...over,
}));

/* ── ① 서명 자체 (서버 로직) ───────────────────────────────────────────── */
{
  const p = mkPayload();
  const sig = sign(p, KEY);
  ck("① 올바른 서명은 통과", verify(p, sig, KEY) === true);
  ck("① 본문을 한 글자만 바꿔도 실패", verify(p.slice(0, -1) + (p.slice(-1) === "A" ? "B" : "A"), sig, KEY) === false);
  ck("① 서명을 바꾸면 실패", verify(p, sig.slice(0, -1) + (sig.slice(-1) === "a" ? "b" : "a"), KEY) === false);
  ck("① 다른 비밀키로 만든 서명은 실패", verify(p, sign(p, "다른키"), KEY) === false);
  ck("① 서명이 비면 실패", verify(p, "", KEY) === false);
  ck("① 길이가 다른 서명도 터지지 않고 실패", verify(p, "짧음", KEY) === false);
  ck("① 같은 입력이면 같은 서명(결정론)", sign(p, KEY) === sign(p, KEY));
  // 다른 판결끼리 서명이 섞이면 '내용은 A인데 서명은 B' 위조가 가능해진다
  ck("① 다른 본문의 서명을 가져다 붙이면 실패", verify(mkPayload({ v: "보내지 마." }), sig, KEY) === false);
}

/* ── ② 화면 (클라이언트가 실패-닫힘인가) ───────────────────────────────── */
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const FORGED = "세 배는 확실해";

/** 서버 대신 응답한다. mode: "ok"=서명해 준다 / "reject"=전부 거절 / "down"=서버 없음 */
async function stub(page, mode) {
  await page.route("**/api/share", async (route) => {
    if (mode === "down") return route.abort();
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.verify) return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: mode === "ok" && verify(body.payload, body.sig, KEY) }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sig: sign(body.payload, KEY) }) });
  });
}
const open = async (mode, url) => {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await stub(page, mode);
  await page.goto(url); await page.waitForTimeout(2500);
  const txt = await page.locator("body").innerText();
  await page.close();
  return txt;
};

{
  const p = mkPayload();
  // 서명 없이 지어낸 링크 — 사고 당시의 그 형태
  const t1 = await open("ok", `${BASE}/?v=${p}`);
  ck("② 서명 없는 링크는 판결을 안 그린다", !t1.includes(FORGED), t1.slice(0, 60).replace(/\n/g, " "));
  ck("② 서명 없는 링크엔 '확인할 수 없어'를 보여준다", t1.includes("확인할 수 없어"));

  // 서명을 지어낸 링크
  const t2 = await open("ok", `${BASE}/?v=${p}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`);
  ck("② 가짜 서명은 판결을 안 그린다", !t2.includes(FORGED));

  // 서명은 진짜인데 본문을 바꿔치기한 링크
  const good = sign(p, KEY);
  const t3 = await open("ok", `${BASE}/?v=${mkPayload({ v: "다른 판결로 바꿔치기" })}.${good}`);
  ck("② 본문 바꿔치기는 판결을 안 그린다", !t3.includes("바꿔치기"));

  // 서버가 죽었을 때 — 진짜여도 안 그린다(닫는 쪽으로 튼다)
  const t4 = await open("down", `${BASE}/?v=${p}.${good}`);
  ck("② 검증 서버에 못 닿으면 안 그린다(실패-닫힘)", !t4.includes(FORGED));

  // 정상 경로 — 서명이 맞으면 판결이 보인다(이게 안 되면 공유 기능이 죽은 것)
  const t5 = await open("ok", `${BASE}/?v=${p}.${good}`);
  ck("② 서명이 맞으면 판결을 보여준다", t5.includes(FORGED), t5.slice(0, 60).replace(/\n/g, " "));
  ck("② 정상 카드에는 '확인할 수 없어'가 안 뜬다", !t5.includes("확인할 수 없어"));
  // 받는 사람 화면에 보낸 사람 이름이 남으면 안 된다(decodeShare 가 지운다)
  ck("② 보낸 사람 이름은 화면에 안 나온다", !t5.includes("강석우"));
}

await browser.close();
const f = R.filter((x) => !x).length;
console.log(`\n=== 공유 서명: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
