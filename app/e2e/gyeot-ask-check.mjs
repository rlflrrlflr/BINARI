/* 곁에게 묻기 — **고른 사람에게 물었는가, 이름은 안 나갔는가, 판결이 되지 않았는가.**
   실행: preview 기동 후 node e2e/gyeot-ask-check.mjs

   창업자(2026-08-30): *"곁 탭에 질문 채팅칸을 넣으면 어때? 팀원들이 엄청 궁금해해서.
   질문 칸 위에 물어보고 싶은 사람을 선택할 수 있는 토글 … 전체를 누르면 다 선택."*

   무는 것 넷:
     ① **고른 사람만 실린다** — 토글이 장식이면 안 된다.
     ② **이름이 모델로 안 간다** — 상대는 이 앱을 쓴 적도 동의한 적도 없는 제3자다.
        자리표(곁1·곁2)로 보내고 앱이 이름으로 되돌린다(gyeotPromptLine 과 같은 규칙).
     ③ **되돌릴 때 번호를 매긴 그 목록을 쓴다** — 전체 명부로 되돌리면 **사람이 뒤바뀐다.**
        실제로 그랬다(팀장님·엄마만 골랐는데 답이 민수 이름으로 나갔다 — 실물 스샷으로 잡음).
     ④ **판결 포맷을 안 씌운다** — GO/STOP/HOLD 는 「할까 말까」의 답이지 「누구와」의 답이 아니다. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const BASE = process.env.BASE || "http://localhost:4173";
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(12000);
await page.addInitScript(() => {
  window.__prompts = [];
  window.claude = { complete: async (x) => { window.__prompts.push(typeof x === "string" ? x : JSON.stringify(x));
    return JSON.stringify({ rows: [{ who: "곁1", line: "먼저 한 줄 보내 봐." }, { who: "곁2", line: "일정부터 맞춰." }],
                            close: "둘은 자리가 달라 — 역할을 갈라 둬." }); } };
});
const { onboard } = await import("./onboard.mjs");
await onboard(page, BASE);
/* ⚠ 곁 셋을 **직접 심는다.** 게이트상 궁합으로는 한 명만 만들 수 있고(첫 곁만 직접 입력),
   나머지는 초대에 답이 와야 선다 — 그 경로는 invite-landing-check 가 이미 밟는다.
   여기서 볼 건 「여럿을 두고 고르는 것」이라 명부를 재료로 놓는 게 맞다. */
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

/* ── ① 토글 ─────────────────────────────────────────────────────────────── */
const chips = page.locator(".gpchip");
ck("① 질문 칸이 곁 탭에 있다", await page.locator("textarea.gqbox").isVisible().catch(() => false));
ck("① 토글이 한 줄이다(가로 스크롤)", await page.evaluate(() => {
  const el = document.querySelector(".gpick"); if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display === "flex" && /auto|scroll/.test(cs.overflowX) && cs.flexWrap !== "wrap";
}));
ck("① 전체 + 사람들이 칩으로 선다", (await chips.allTextContents()).join("·") === "전체·민수·팀장님·엄마",
   (await chips.allTextContents()).join("·"));
/* ⚠ 칩 순서는 **명부와 같은 최근순**이어야 한다 — 다른 순서를 쓰면 그 줄이 순위가 된다(§C-3 방어 ①) */
ck("① 칩 순서가 명부 순서와 같다(순위가 아니다)", await page.evaluate(() => {
  const chip = [...document.querySelectorAll(".gpchip")].slice(1).map((x) => x.innerText.trim());
  const row = [...document.querySelectorAll(".gyeotlist li input.galias")].map((x) => x.value.trim());
  return chip.join("|") === row.join("|");
}));
const on = async () => (await page.locator(".gpchip.on").allTextContents()).join("·");
ck("① 처음엔 전부 켜져 있다", (await on()) === "전체·민수·팀장님·엄마", await on());
await chips.nth(1).click(); await page.waitForTimeout(250);
ck("① 하나를 끄면 나머지만 남는다(전체도 같이 꺼진다)", (await on()) === "팀장님·엄마", await on());
await chips.first().click(); await page.waitForTimeout(250);
ck("① 전체를 누르면 다 켜진다", (await on()) === "전체·민수·팀장님·엄마", await on());
/* 다 끄면 물어볼 대상이 없어진다 — 그때는 전체로 되돌린다(빈 물음을 막는다) */
for (let i = 1; i <= 3; i++) { await chips.nth(i).click(); await page.waitForTimeout(180); }
ck("① 다 끄면 전체로 되돌아간다(빈 물음이 안 생긴다)", (await on()) === "전체·민수·팀장님·엄마", await on());
/* §5 — 개수 표기 금지. 칩 줄에 「2명 선택」 같은 게 붙으면 그 줄이 카운터가 된다 */
ck("① 고른 수를 세지 않는다", !/\d+\s*명|\d+\s*\/\s*\d+/.test(await page.locator(".gask2").innerText()));

/* ── ②③ 물어본다 ────────────────────────────────────────────────────────── */
await chips.nth(1).click(); await page.waitForTimeout(250);          // 민수를 끈다 → 팀장님·엄마
await page.locator("textarea.gqbox").fill("이번 프로젝트 누구랑 할까?");
await page.getByRole("button", { name: "물어볼게" }).click();
await page.waitForTimeout(1600);
/* ⚠ `pop()` 을 쓰면 **검사가 제 증거를 먹는다** — 아래 「몇 번 불렀나」가 0 이 됐다(직접 겪음). 안 지운다. */
const prompts = await page.evaluate(() => (window.__prompts || []).slice());
const prompt = prompts[prompts.length - 1] || "";
ck("② 이름이 모델로 안 나간다", !/민수|팀장님|엄마/.test(prompt),
   (prompt.match(/민수|팀장님|엄마/) || ["안 나감"])[0]);
ck("② 자리표로 보낸다", /곁1 = /.test(prompt));
ck("① 고른 사람만 실린다", (prompt.match(/곁\d = /g) || []).length === 2,
   `${(prompt.match(/곁\d = /g) || []).length}명`);
/* ④ 판결 포맷을 안 씌운다 */
ck("④ 판결을 내지 말라고 못 박는다", /GO\/STOP\/HOLD 를 내지 마라/.test(prompt));
ck("④ 순위를 매기지 말라고 못 박는다", /순위를 매기지 마라/.test(prompt));
ck("④ 아는 것 밖을 말하지 말라고 못 박는다", /지어내지 마라/.test(prompt) && /이 앱을 쓴 적도 동의한 적도 없다/.test(prompt));
/* ③ **여기가 실물 스샷으로 잡은 자리다** — 되돌릴 때 전체 명부를 쓰면 사람이 뒤바뀐다 */
const res = (await page.locator(".gqres").innerText()).replace(/\n/g, " ");
ck("③ 답의 이름이 **고른 사람**으로 되돌아온다", /팀장님/.test(res) && /엄마/.test(res) && !/민수/.test(res), res.slice(0, 60));
ck("③ 자리표가 화면에 그대로 안 나온다", !/곁\d/.test(res), (res.match(/곁\d/) || ["없음"])[0]);
ck("③ AI 표시가 붙는다", /AI가 만들어요/.test(res));

/* ── ⑤ 원가 — 판결과 같은 SYS 를 쓴다(캐시가 걸린다) ────────────────────── */
ck("⑤ 한 번만 부른다 — 물음 하나에 콜 하나", prompts.length === 1, `${prompts.length}콜`);
/* 원가 — **판결과 같은 SYS 를 쓴다.** 새 시스템 프롬프트를 만들면 캐시 프리픽스가 갈려
   write 가 한 벌 더 생기고 원가가 뛴다(2026-08-30 창업자가 원가를 물은 그 자리다). */
{
  const src = (await import("node:fs")).readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const fn = (src.match(/const askGyeot = async[\s\S]*?\n  \};/) || [""])[0];
  ck("⑤ 판결과 같은 SYS 를 쓴다(캐시가 걸린다)", /makeSystem\(\)/.test(fn) && !/const SYS2|새 시스템/.test(fn));
  ck("⑤ 출력 상한이 작다(관계 답은 길 이유가 없다)",
     /callClaude\(system, \[msg\], (\d+)\)/.test(fn) && +RegExp.$1 <= 900, RegExp.$1 || "?");
}

await b.close();
const pass = R.filter(Boolean).length;
console.log(`\n=== 곁에게 묻기: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
