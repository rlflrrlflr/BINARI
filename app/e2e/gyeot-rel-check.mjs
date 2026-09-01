/* 곁에게 묻기 — 관계 줄 + 예상질문 (2026-09-01 팀 제안)
   ⚠ 표는 **소스에서 뽑아 쓴다**(베끼지 않는다). 베끼면 코드가 바뀌어도 검사가 안 깨진다. */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const SRC = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const BASE = process.env.BASE || "http://localhost:4173";
let pass = 0, fail = 0;
const ck = (n, ok, note = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* ── 소스 검사 ───────────────────────────────────────────── */
const REL = (SRC.match(/const GREL = \[([^\]]+)\]/) || [])[1];
ck("① 관계 넷이 표에 있다", !!REL && ["비즈니스", "썸·연애", "친구", "가족"].every((r) => REL.includes(r)), REL);

const gaskBody = (SRC.match(/const GASK = \{([\s\S]*?)\n\};/) || [])[1] || "";
const keys = [...gaskBody.matchAll(/^  "([^"]*)": \{/gm)].map((m) => m[1]);
ck("② 관계마다 + 안 고른 경우까지 물음이 있다", REL && ["비즈니스","썸·연애","친구","가족",""].every((k) => keys.includes(k)), keys.join("/"));
ck("③ 한 명일 때와 여럿일 때가 갈린다",
  (gaskBody.match(/one:/g) || []).length === keys.length && (gaskBody.match(/many:/g) || []).length === keys.length);

/* ④ **줄 세우는 물음이 없다.** gyeotOrder 방어 ①②③ 과 askGyeot 의 「순위를 매기지 마라」가
      막는 것이고, 곁 이름은 실명이라 그 답이 사람 이름으로 렌더된다. */
const RANK = ["서열", "갑을", "갑이", "을이", "순위", "1등", "등수", "랭킹", "제일 나은", "누가 낫"];
const hit = RANK.filter((w) => gaskBody.includes(w));
ck("④ 줄 세우는 물음이 예상질문에 없다", hit.length === 0, hit.join("/") || "깨끗");
ck("⑤ 프롬프트의 순위 금지가 살아 있다", /순위를 매기지 마라/.test(SRC));
/* ⑥ 관계는 **재료지 축이 아니다** — 사주 축(VOTE_AX)이나 가중치에 안 들어간다 */
ck("⑥ 관계가 판결 축으로 안 샜다", !/VOTE_AX[\s\S]{0,400}gqRel/.test(SRC) && !/gqRel[\s\S]{0,200}VOTE_AX/.test(SRC));
ck("⑦ 안 고르면 틀을 아예 안 싣는다", /gqRel \? `틀:/.test(SRC));

/* ── 화면 검사 ───────────────────────────────────────────── */
const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE);
/* 곁 셋을 직접 심는다 — 사유는 gyeot-ask-check 와 같다(게이트상 직접 입력은 한 명뿐). */
await page.evaluate(() => localStorage.setItem("binari.gyeot.v1", JSON.stringify([
  { key: "a", el: "화", dg: 2, name: "민수",  tier: "standing", at: 3000 },
  { key: "b", el: "수", dg: 8, name: "팀장님", tier: "standing", at: 2000 },
  { key: "c", el: "목", dg: 0, name: "엄마",  tier: "standing", at: 1000 },
])));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(5200);
await page.getByRole("button", { name: "곁", exact: true }).click();
await page.waitForTimeout(1000);
await page.locator("canvas").first().dblclick();
await page.waitForTimeout(900);

const rel = page.locator(".grel .gpchip");
ck("⑧ 관계 줄이 한 줄로 보인다", (await rel.count()) === 4);
const box = page.locator("textarea.gqbox");
ck("⑨ 빈 칸이면 예상질문이 보인다", (await page.locator(".gsugchip").count()) === 3);

const before = await page.locator(".gsugchip").first().innerText();
await rel.filter({ hasText: "썸·연애" }).click();
await page.waitForTimeout(300);
const after = await page.locator(".gsugchip").first().innerText();
ck("⑩ 관계를 고르면 예상질문이 바뀐다", before !== after, after.slice(0, 24));

await page.locator(".gsugchip").first().click();
await page.waitForTimeout(300);
ck("⑪ 예상질문을 누르면 질문 칸에 들어간다", (await box.inputValue()) === after);
ck("⑫ 채워지면 예상질문이 물러난다(쓰던 걸 안 덮는다)", (await page.locator(".gsugchip").count()) === 0);

/* ⑬ 관계는 **껐다 켤 수 있다** — 안 고르고도 물을 수 있어야 한다(강제 게이트가 아니다) */
await box.fill("");
await page.waitForTimeout(250);
await rel.filter({ hasText: "썸·연애" }).click();
await page.waitForTimeout(300);
ck("⑬ 같은 관계를 다시 누르면 꺼진다", (await page.locator(".grel .gpchip.on").count()) === 0);
ck("⑭ 관계를 안 골라도 예상질문이 있다(강제 아님)", (await page.locator(".gsugchip").count()) === 3);

/* ⑮ 사람 줄과 관계 줄이 **서로 다른 규칙** — 사람은 여럿, 관계는 하나 */
await rel.filter({ hasText: "친구" }).click();
await rel.filter({ hasText: "가족" }).click();
await page.waitForTimeout(300);
ck("⑮ 관계는 하나만 켜진다", (await page.locator(".grel .gpchip.on").count()) === 1);

/* ⑯ 사람 수가 바뀌면 물음이 바뀐다(한 명 ↔ 여럿) */
const many = await page.locator(".gsugchip").first().innerText();
const names = page.locator(".gpick:not(.grel) .gpchip");
const n = await names.count();
for (let i = 2; i < n; i++) await names.nth(i).click();   // 첫 곁 하나만 남긴다
await page.waitForTimeout(400);
const one = await page.locator(".gsugchip").first().innerText();
ck("⑯ 한 명만 고르면 물음이 갈린다", many !== one, one.slice(0, 24));

await b.close();
console.log(`\n=== 곁 관계·예상질문: ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
