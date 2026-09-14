/* 공유·저장 폴백 (2026-09-14 지시서 §2)
   실행: node e2e/share-fallback-check.mjs

   **왜 있나.** 폴백은 평소에 안 돈다 — 공유시트가 되는 기기에서는 첫 칸에서 끝난다.
   그래서 **폴백이 죽어 있어도 아무도 모른다.** 실제로 셋이 죽어 있었다:
     ① 판결·초대 공유가 `catch (_) { return; }` 라 복사 폴백이 영영 안 돌았다
     ② iOS 카드 저장이 `await` 뒤 `window.open` 이라 사파리가 막았고,
        막혀도 `done("new_tab")` 을 불러 **실패가 성공으로 집계**됐다
     ③ 그 둘 다 계측이 0건이라 「눌렀는데 아무 일도 없다」가 안 보였다
   따라서 이 검사는 **일부러 부순 환경**을 만들어 사다리 각 칸을 밟는다. */
import fs from "node:fs";
import { launch } from "./browser.mjs";

const SRC = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");   // 주석은 코드가 아니다
const BASE = process.env.BASE || "http://localhost:4173";
let pass = 0, fail = 0;
const ck = (n, ok, note = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* ── ① 죽은 구조가 되살아나지 않는다 ─────────────────────────────── */
ck("① 취소만 걸러 낸다 — catch 에서 곧바로 return 하지 않는다",
   !/catch \(_\) \{ return; \}/.test(CODE), (CODE.match(/catch \(_\) \{ return; \}/g) || []).length + "곳");
ck("① 공유가 한 곳으로 모였다", (CODE.match(/shareOrCopy\(/g) || []).length >= 4);
/* ⚠ `navigator.share` 는 **두 곳만** 남아야 한다 — 링크 사다리(shareOrCopy) 하나와
   카드의 **파일** 공유 하나. 파일 공유는 성질이 달라(사진을 넘긴다) 사다리에 못 넣는다.
   셋째가 생기면 그건 사다리를 우회한 새 공유 지점이다. */
ck("① 링크 공유가 사다리를 우회하지 않는다(share 호출은 사다리+카드파일 둘뿐)",
   (CODE.match(/navigator\.share\(/g) || []).length === 2,
   `${(CODE.match(/navigator\.share\(/g) || []).length}곳`);
ck("① 남은 하나는 파일 공유다", /navigator\.share\(\{ files: \[file\] \}\)/.test(CODE));
ck("① 사다리가 네 칸이다(시트→클립보드→옛방식→보고)",
   /navigator\.share/.test(CODE) && /clipboard\.writeText/.test(CODE) && /execCommand/.test(CODE) && /share_failed/.test(CODE));

/* ── ② 카드 저장 ──────────────────────────────────────────────── */
ck("② 다운로드가 blob 이다(거대한 data URL 아님)", /createObjectURL\(dataUrlToFile\(/.test(CODE));
ck("② 만든 blob 을 되돌려준다(새는 것 막기)", /revokeObjectURL/.test(CODE));
ck("② 새 탭을 안 연다 — 화면 안 이미지다",
   !/window\.open\("", "_blank"\)/.test(CODE) && /showCardFallback\(/.test(CODE));
ck("② 앱 밖으로 튕겨 나가지 않는다", !/location\.href = dataUrl/.test(CODE));
/* ⚠ 예전엔 새 탭이 막혀도 done("new_tab") 을 불러 실패가 성공으로 집계됐다 */
ck("② 실패를 성공으로 세지 않는다", !/done\("new_tab"\)/.test(CODE));

/* ── ③ 실패 계측 ─────────────────────────────────────────────── */
for (const [ev, why] of [["share_failed", "공유가 끝까지 막힘"], ["share_sheet_failed", "시트만 실패"],
                          ["card_save_failed", "카드 저장 실패"], ["card_share_sheet_failed", "카드 시트 실패"],
                          ["share_done", "성공한 경로"]])
  ck(`③ ${why} 를 센다 (${ev})`, new RegExp(`track\\("${ev}"`).test(CODE));
/* ⚠ 오류 메시지에는 공유하려던 주소가 섞일 수 있다 — 이름만 싣는다 */
ck("③ 계측에 오류 '이름'만 싣는다(주소 안 샘)",
   /const errName = /.test(CODE) && !/err: String\(/.test(CODE));

/* ── 화면: 사다리를 실제로 밟는다 ─────────────────────────────── */
const b = await launch();
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
const evs = [];
await page.exposeFunction("__ev", (n, p) => evs.push({ n, p }));
await page.addInitScript(() => {
  window.__hits = [];
  /* 공유시트를 **취소가 아닌 이유로** 실패시킨다 — 예전 코드가 여기서 통째로 멈췄다 */
  navigator.share = () => Promise.reject(Object.assign(new Error("nope"), { name: "NotAllowedError" }));
  /* ⚠ `navigator.clipboard = …` 는 **조용히 무시된다**(프로토타입의 읽기 전용 getter).
     그대로 두면 진짜 클립보드가 돌아 스텁이 안 먹고, 검사는 「폴백이 안 돈다」로 잘못 읽는다. */
  Object.defineProperty(navigator, "clipboard", {
    configurable: true, get: () => ({ writeText: (t) => { window.__hits.push(t); return Promise.resolve(); } }) });
});
/* ⚠ 미리보기에는 초대 서버가 없다. **서버만** 흉내 내고 공유 경로는 진짜 코드를 밟는다 —
   여기서 보려는 건 서버가 아니라 「시트가 실패했을 때 그다음 칸이 도는가」다. */
const fakeInvite = (pg) => pg.route("**/api/invite/new", (route) => route.fulfill({
  status: 200, contentType: "application/json", body: JSON.stringify({ id: "testinvite123" }) }));
const { onboard } = await import("./onboard.mjs");
await fakeInvite(page);
await onboard(page, BASE);
await page.evaluate(() => localStorage.setItem("binari.gyeot.v1", JSON.stringify(
  [{ key: "a", el: "화", dg: 2, name: "민수", tier: "standing", at: 3000 }])));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(5200);
await page.getByRole("button", { name: "곁", exact: true }).click();
await page.waitForTimeout(900);
await page.locator("canvas").first().dblclick().catch(() => {});
await page.waitForTimeout(900);
const invite = page.locator("button", { hasText: "한 사람 더 부를래" }).first();
if (await invite.count()) {
  await invite.click();
  await page.waitForTimeout(3000);
  const hits = await page.evaluate(() => window.__hits);
  ck("④ 시트가 실패해도 복사 폴백이 돈다", hits.length >= 1, hits.length ? hits[0].slice(0, 34) : "복사 0건");
  ck("④ 복사된 것이 초대 주소다", hits.some((t) => /\?inv=/.test(t)));
} else { ck("④ 시트가 실패해도 복사 폴백이 돈다", false, "초대 버튼을 못 찾음"); ck("④ 복사된 것이 초대 주소다", false); }

/* ⑤ 클립보드까지 막으면 **옛 방식**으로 내려가고, 그것도 막히면 화면에 주소를 보여 준다 */
const p2 = await b.newPage({ viewport: { width: 430, height: 932 } });
await p2.addInitScript(() => {
  navigator.share = () => Promise.reject(Object.assign(new Error("nope"), { name: "NotAllowedError" }));
  Object.defineProperty(navigator, "clipboard", { get: () => undefined });
  document.execCommand = () => false;                       // 마지막 다리까지 끊는다
});
await fakeInvite(p2);
await onboard(p2, BASE);
await p2.evaluate(() => localStorage.setItem("binari.gyeot.v1", JSON.stringify(
  [{ key: "a", el: "화", dg: 2, name: "민수", tier: "standing", at: 3000 }])));
await p2.reload({ waitUntil: "domcontentloaded" });
await p2.waitForTimeout(5200);
await p2.getByRole("button", { name: "곁", exact: true }).click();
await p2.waitForTimeout(900);
await p2.locator("canvas").first().dblclick().catch(() => {});
await p2.waitForTimeout(900);
const inv2 = p2.locator("button", { hasText: "한 사람 더 부를래" }).first();
if (await inv2.count()) {
  await inv2.click();
  await p2.waitForTimeout(3000);
  ck("⑤ 전부 막히면 주소를 화면에 보여 준다(빈손 금지)", (await p2.locator(".failurl").count()) === 1);
  const v = await p2.locator(".failurl").inputValue().catch(() => "");
  ck("⑤ 보여 주는 주소가 진짜 초대 주소다", /\?inv=/.test(v), v.slice(0, 40));
} else { ck("⑤ 전부 막히면 주소를 화면에 보여 준다(빈손 금지)", false, "초대 버튼 없음"); ck("⑤ 보여 주는 주소가 진짜 초대 주소다", false); }

/* ── ⑥ 화면 안 이미지가 실제로 그려지는가 ─────────────────────────────
   ⚠ **함수를 베끼지 않고 소스에서 꺼내 돌린다**(gyeot-roster-check 와 같은 방식).
     베끼면 본체가 바뀌어도 사본만 통과한다.
   ⚠ **솔직히 적어 둔다** — 이건 폴백 *화면*을 무는 것이지, iOS 사파리에서 저장까지
     되는지를 무는 게 아니다. 그건 아이폰 실물로만 확인된다(`?cardfb` 스위치를 그래서 붙였다). */
const fnSrc = (() => {
  const i = SRC.indexOf("function showCardFallback(");
  if (i < 0) return "";
  let d = 0;
  for (let k = SRC.indexOf("{", i); k < SRC.length; k++) {
    if (SRC[k] === "{") d++; else if (SRC[k] === "}") { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  return "";
})();
ck("⑥ 폴백 화면 함수를 소스에서 찾았다", !!fnSrc);
const p3 = await b.newPage({ viewport: { width: 430, height: 932 } });
await p3.goto(BASE, { waitUntil: "domcontentloaded" });
const seen = await p3.evaluate(([fn]) => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const call = new Function(fn + "; return showCardFallback;")();
  const ok = call(png, "비나리 부적");
  const el = document.getElementById("cardfb");
  return { ok, exists: !!el, img: el ? el.querySelectorAll("img").length : 0,
           hint: el ? /길게 눌러/.test(el.innerText) : false,
           closes: el ? el.querySelectorAll("button").length : 0,
           onTop: el ? getComputedStyle(el).position === "fixed" : false };
}, [fnSrc]);
ck("⑥ 화면 안 이미지가 뜬다", seen.ok === true && seen.exists && seen.img === 1, JSON.stringify(seen));
ck("⑥ 저장하는 법을 알려 준다", seen.hint);
ck("⑥ 닫을 수 있다(갇히지 않는다)", seen.closes === 1);
ck("⑥ 화면 위에 뜬다", seen.onTop);
/* 두 번 눌러도 겹쳐 쌓이지 않는다 */
const twice = await p3.evaluate(([fn]) => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  new Function(fn + "; return showCardFallback;")()(png, "또");
  return document.querySelectorAll("#cardfb").length;
}, [fnSrc]);
ck("⑥ 두 번 눌러도 겹치지 않는다", twice === 1, `${twice}장`);

await b.close();
console.log(`\n=== 공유·저장 폴백: ${pass}/${pass + fail} PASS ===`);
process.exit(fail ? 1 : 0);
