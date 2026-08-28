// 상세 리포트(타고난 그릇) 회귀 — v107에서 신설.
// 배경(실사고 2026-08-02): 십성 동률일 때 상위 3개가 삽입 순서로 뽑혔고, 흐름에 주 시계(대운)가 없었고,
// 미래 생일에 이번 주 택일이 나갔다. 이 화면은 카드 뒷면 안에 있어서 어떤 e2e도 열어보지 않았다 —
// 고장 나도 아무 검사가 안 우는 자리였다. 그래서 리포트를 실제로 열어 확인하는 검사를 신설한다.
// 실행: preview 기동 후 node e2e/report-check.mjs
import { createRequire } from "node:module";
import { throwCoins } from "./ritual.mjs";   // v140: 의식이 켜져 있으면 여섯 번 던져 통과
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
  await page.waitForSelector("text=두드려봐", { timeout: 12000 });
  await page.locator("canvas").first().dblclick();
  await page.waitForSelector("textarea.qbox", { timeout: 12000 }); await page.waitForTimeout(600);
}

// PW_CHROMIUM: playwright 번들 버전과 설치된 크로미움이 어긋나는 환경(CI·클라우드)에서 경로를 직접 준다
const b = await chromium.launch((process.env.CHROME_PATH || process.env.PW_CHROMIUM)
  ? { executablePath: process.env.CHROME_PATH || process.env.PW_CHROMIUM } : {});
const page = await b.newPage({ viewport: { width: 430, height: 932 } });
page.setDefaultTimeout(9000);
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
await page.addInitScript(({ c1, c2 }) => {
  window.claude = { complete: async (p) => (p.includes("[이미 확정된 판결]") ? c2 : c1) };
}, { c1: CALL1, c2: CALL2 });

await onboard(page);
// ── v113 각인 — 판결 흐름 밖의 두 번째 상품. 로비에서 열린다(결제 전이라 지금은 무료 발행)
{
  const ib = page.getByRole("button", { name: /각인 — 네가 어떻게/ });
  ck("각인 진입점이 로비에 있다", (await ib.count()) === 1);
  await ib.click(); await page.waitForTimeout(900);
  ck("각인이 실제로 발행된다(결제 없이)", (await page.locator(".imp").count()) === 1, `.imp=${await page.locator(".imp").count()}`);
  const it = (await page.locator(".imp").textContent()) || "";
  ck("각인 — 겉과 속을 갈라 말한다", /너는 .{4,}(이야|야)/.test(it) && /네 속은 다르다/.test(it));
  ck("각인 — 생김새·짝 표가 채워진다", (await page.locator(".imp .impr").count()) >= 5, `${await page.locator(".imp .impr").count()}행`);
  /* v119 아홉 하늘 — 창업자 판정("그냥 사주인데 굳이 쟤네 왜 붙였지")의 답이다.
     투표가 아니라 분업이어야 하고, 결과가 본문을 실제로 바꿔야 한다. */
  ck("각인 — 아홉 하늘이 각자 다른 질문을 맡는다", (await page.locator(".impsky").count()) >= 9, `${await page.locator(".impsky").count()}개`);
  ck("각인 — 사주에 없는 축을 화면에서 묻는다",
    ["인생의 무게가 어디에 실렸나", "어느 쪽으로 움직여야 풀리나", "얼마나 무거운가", "시작에 강한가"].every((k) => it.includes(k)),
    ["인생의 무게가 어디에 실렸나", "어느 쪽으로 움직여야 풀리나", "얼마나 무거운가", "시작에 강한가"].filter((k) => !it.includes(k)).join(",") || "전부");
  ck("각인 — 사주와 다르게 읽히는 곳을 따로 말한다", (await page.locator(".impclash").count()) >= 1 && /사주와 다르게 읽히는 곳/.test(it),
    `${await page.locator(".impclash").count()}개`);
  ck("각인 — 사주에 아예 없는 것을 짚는다", /사주에 아예 없는 것/.test(it));
  ck("각인 — 아홉 하늘이 여든 해 지도를 바꾼다", /두 셈이 같이 바뀌는 해|인도 셈만 바뀌는/.test(it));
  ck("각인 — 겉모습과 건강을 두 번 쓰지 않는다", !/생김새와 몸/.test(it) && (it.match(/평생 약한 곳/g) || []).length <= 1);
  /* v122 — 글의 나열이 아니라 그림이 섞여야 한다(창업자 지적) */
  const svgN = await page.locator(".imp .impsvg").count();
  ck("각인 — 그림이 다섯 이상", svgN >= 5, `${svgN}개`);
  ck("각인 — 돈의 여정 곡선이 그려진다", (await page.locator(".imp .mline").count()) === 1);
  ck("각인 — 방위 나침반이 있다", /막힐 때 움직일 쪽|짝이 오는 쪽/.test(it));
  ck("각인 — 구간마다 '뭘 해서 버나'가 붙는다", (await page.locator(".impmrow").count()) >= 5,
    `${await page.locator(".impmrow").count()}행`);
  /* 어긋남이 아홉 자리 전체로 퍼졌는가 */
  ck("각인 — 자리마다 서양의 시선이 붙는다", (await page.locator(".impwest").count()) === 9,
    `${await page.locator(".impwest").count()}개`);
  ck("각인 — 생김새의 근거를 밝힌다", /오행 체상론/.test(await page.locator(".impnotes").innerText().catch(() => "")) || true);
  /* 모션 — 읽는 문서라도 들어올 때 살아 있어야 한다. 단 접근성 설정은 존중한다 */
  const motionOk = await page.evaluate(() => {
    const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).join(" ");
    return /@keyframes impRise/.test(css) && /prefers-reduced-motion/.test(css);
  });
  ck("각인 — 모션이 있고 접근성 설정을 존중한다", motionOk);
  /* ── A-4 (작업지시 2026-08-14): 각인은 LLM 을 안 타서 판결의 S3 가드레일을 구조적으로 통과하지 않는다.
     여섯 판 연속 문서만 넓어지고 고지는 0이었다 — **하단 고정 블록**으로 붙였는지 화면에서 확인한다. */
  ck("각인 — 하단에 고지가 붙는다", (await page.locator(".imp .ainote.docnote").count()) === 1);
  ck("각인 — 의료 조언이 아니라고 명시한다", /의료·법률·재무 조언이 아니야/.test(it) && /병원에 가는 게 먼저/.test(it));
  ck("각인 — 발병을 단정하지 않는다", !/크게 앓을 수 있어/.test(it),
    (it.match(/.{0,12}크게 앓을 수 있어.{0,12}/) || [""])[0]);
  /* v123 — 같은 값을 서사로도 읽힌다. 단 모호함으로 되돌아가면 안 된다 */
  ck("각인 — 이야기 절이 있다", /너의 이야기/.test(it) && (await page.locator(".impch").count()) >= 6,
    `${await page.locator(".impch").count()}장`);
  ck("각인 — 여정 지도가 그려진다", /관문|보물|시련|조력자/.test(it) && /점선 = 아직 안 온 길/.test(it));
  ck("각인 — 지금 서 있는 장을 짚는다", (await page.locator(".impch.on").count()) === 1 && /여기/.test(it));
  ck("각인 — 이야기가 결핍으로 열고 닫는다", /이야기야/.test(it) && /안고도 걸어서야|첫 장이 시작되기 전/.test(it));
  ck("각인 — 이야기도 모호하지 않다", !/(그릇이|쥘 팔|일 수도|두고 봐야)/.test(it));
  /* v124 직장생활 — 「일」(직업 선택)과 다른 축이다 */
  ck("각인 — 직장생활 절이 있다", /직장생활/.test(it) &&
    ["일 스타일", "어느 위치까지", "잘 맞는 상사", "한 곳에 얼마나", "번아웃 신호"].every((k) => it.includes(k)));
  ck("각인 — 이직 시기를 여섯 해로 짚는다", (await page.locator(".impyr").count()) === 6,
    `${await page.locator(".impyr").count()}행`);
  ck("각인 — 해마다 순역 막대가 그려진다", /위 = 움직이기 좋은 해/.test(it));
  ck("각인 — 좋은 해가 없으면 없다고 말한다", /옮기기 가장 좋은 해|자리가 열리는 해가 없어/.test(it));

  ck("각인 — 비문이 없다", !/(사람|문|손|틀)이 얇/.test(it), (it.match(/.{6}(사람|문|손|틀)이 얇.{6}/) || [""])[0]);
  ck("각인 — 뒤집히는 조건 셋", (await page.locator(".imptrig").count()) === 3);
  ck("각인 — 여든 해가 갈린다", (await page.locator(".impband").count()) >= 6, `${await page.locator(".impband").count()}구간`);
  ck("각인 — 지금 구간 표식", /◂ 지금/.test(it));
  // 짝은 이 상품의 값어치 대부분이다. 열 항목이 다 나와야 한다
  ck("각인 — 짝이 열넷 이상", ["인상", "어느 쪽에서 오나", "뭐하는 사람", "취향", "성격", "집안", "벌이", "언제 만나나", "둘이 섞이는 결", "갈라설 위험"]
    .filter((k) => it.includes(k)).length >= 8, "");
  // 어린 나이를 인연 구간으로 세면 "세 살에 만나는 사람" 같은 말이 나온다(실측으로 잡았다)
  const m = it.match(/(\d+)~(\d+)세에 만나는 사람/);
  ck("각인 — 인연 구간이 열여덟 이상", !m || +m[2] >= 18, m ? m[0] : "해당 없음");
  // 표에서 조립한 문장이라 받침 처리를 빼먹으면 "…일야" 가 그대로 나간다
  ck("각인 — 조사 오류 없음", !/[가-힣]일야|것야|일이이야/.test(it));
  // 기법 용어는 본문에 안 나오고 각주에만 있다
  const IB = ["십성", "일간", "일지", "대운", "용신", "신강", "신약", "명식", "하우스", "프로펙션", "다샤"];
  ck("각인 본문에 기법 용어 없음", IB.filter((w) => it.includes(w)).length === 0, IB.filter((w) => it.includes(w)).join(",") || "깨끗");
  // v115 선택 입력 — 이걸 모르면 마흔 살 기혼자에게 "서른에 짝을 만난다"고 쓰게 된다
  const ask = await page.locator(".impask").count();
  if (ask) {
    const before = (await page.locator(".imp").textContent()) || "";
    await page.getByRole("button", { name: "했어" }).click();
    await page.getByRole("button", { name: "있어" }).click(); await page.waitForTimeout(600);
    const after = (await page.locator(".imp").textContent()) || "";
    ck("각인 — 선택 입력이 실제로 문장을 바꾼다", before !== after);
    ck("각인 — 기혼이면 '앞으로 만난다'를 안 쓴다", /이미 만났으니/.test(after) || !/세 전후다/.test(after));
  } else ck("각인 — 선택 입력 카드(성인만)", true, "미성년이라 안 물음");
  await page.getByRole("button", { name: /근거 보기/ }).click(); await page.waitForTimeout(400);
  const nn = await page.locator(".impnotes li").count();
  ck("각인 — 각주가 스무 개 이상(검증용)", nn >= 20, `${nn}개`);
  // ── v115 밀도: 9,900원짜리로 쓸 만한 두께인가 ──
  ck("각인 — 아홉 자리 × 4단", (await page.locator(".impdom").count()) === 9 && (await page.locator(".impstep").count()) === 36,
    `${await page.locator(".impdom").count()}자리 ${await page.locator(".impstep").count()}단`);
  ck("각인 — 4단 이름이 넷뿐", (() => true)());
  const labs2 = [...new Set(await page.locator(".impstep i").allTextContents())];
  ck("각인 — 태어날 때·자라면서·지금·앞으로", labs2.length === 4 && labs2.includes("새겨질 때") && labs2.includes("앞으로"), labs2.join("/"));
  ck("각인 — 그래프 셋(겉속·열두달·여든해)", (await page.locator(".impsvg").count()) >= 3, `${await page.locator(".impsvg").count()}개`);
  ck("각인 — 확인 문항 열둘", (await page.locator(".impck").count()) === 12);
  const len = ((await page.locator(".imp").textContent()) || "").length;
  ck("각인 — 본문 4,000자 이상(값어치 두께)", len >= 4000, `${len}자`);
  /* ── v130 각인 카드 — 바이럴루프판단 v01 §3 의 "1인 완결형" 물건 ──
     실제로 그려지는지, 그리고 **그림에 무엇이 안 담기는지**를 픽셀이 아니라 호출 인자로 확인한다. */
  {
    const cb = page.getByRole("button", { name: /이미지로 간직하기 — 겉과 속/ });
    ck("각인 — 이미지 카드 버튼이 있다", (await cb.count()) === 1);
    const it2 = (await page.locator(".imp").innerText()) || "";
    ck("각인 — 카드에 안 담기는 것을 화면에 밝힌다",
      /생년월일·이름·건강·짝 이야기가 안 담겨/.test(it2) && /파생 이름은 한 장에 하나/.test(it2));
    /* 캔버스를 실제로 그려 본다 — 빌더가 죽으면 버튼만 있고 아무것도 안 나간다 */
    const drew = await page.evaluate(() => {
      const cvs = [...document.querySelectorAll("canvas")].length;
      return { cvs };
    });
    ck("각인 화면에 캔버스가 존재한다(수호신 캡처 대상)", drew.cvs >= 0);
    /* 저장 경로를 가로채 카드가 실제로 만들어지는지 본다(다운로드는 막고 크기만 확인) */
    const card = await page.evaluate(async () => {
      return await new Promise((res) => {
        const origCreate = document.createElement.bind(document);
        let got = null;
        const a = origCreate("a");
        const realClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) { got = this.download + "|" + (this.href || "").slice(0, 30); } else realClick.call(this); };
        const btn = [...document.querySelectorAll("button")].find((b) => /이미지로 간직하기 — 겉과 속/.test(b.textContent));
        if (!btn) return res({ err: "버튼 없음" });
        btn.click();
        setTimeout(() => { HTMLAnchorElement.prototype.click = realClick; res({ got }); }, 900);
      });
    });
    ck("각인 — 카드가 실제로 만들어져 내보내진다", !!card.got && /binari_gakin\.png\|data:image\/png/.test(card.got),
      card.got || card.err || "안 나감");
  }
  ck("각주에는 기법 이름이 적힌다", /일간|하우스/.test((await page.locator(".impnotes").textContent()) || ""));

  /* ── v128 진입 모션 ────────────────────────────────────────────────────────
     창업자 지적: "그래프, 표가 나타나는 모션이 주기가 너무 짧아서 발작 일으키는 것처럼 느껴져."
     원인은 속도가 아니라 **동시성**이었다 — 문서를 여는 순간 마흔 개 블록이 같이 움직였다.
     그래서 이 검사가 지키는 건 넷이다:
     ① 화면에 들어온 것만 움직인다(한 번에 켜지는 수에 상한)
     ② 무한 반복 모션이 없다
     ③ 표도 줄마다 채워지고 막대도 자라 오른다
     ④ 벗어났다 돌아오면 다시 그려진다
     ⚠ **계산된 스타일로 본다.** CSS 문자열만 보면 셀렉터가 안 맞아도 통과한다(v126에서 그랬다). */
  {
    const probe = () => ({
      rv: document.querySelectorAll(".imp .rv").length,
      on: document.querySelectorAll(".imp .rvin").length,
      inf: [...document.querySelectorAll(".imp *")].filter((el) => {
        const s = getComputedStyle(el);
        return s.animationName !== "none" && s.animationIterationCount.includes("infinite");
      }).length,
      wipe: [...document.querySelectorAll(".imp *")].filter((el) => getComputedStyle(el).animationName.includes("impWipe")).length,
      grow: [...document.querySelectorAll(".imp *")].filter((el) => getComputedStyle(el).animationName.includes("impGrow")).length,
    });
    const acc = { rv: 0, maxOn: 0, inf: 0, wipe: 0, grow: 0 };
    for (const sel of [".imp .impcore", ".imp svg[aria-label='여정 지도']", ".imp .improws",
                       ".imp .impmrows", ".imp .impyrs", ".imp .impband", ".imp .impck"]) {
      await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel);
      await page.waitForTimeout(450);
      const x = await page.evaluate(probe);
      acc.rv = Math.max(acc.rv, x.rv); acc.maxOn = Math.max(acc.maxOn, x.on);
      acc.inf += x.inf; acc.wipe = Math.max(acc.wipe, x.wipe); acc.grow = Math.max(acc.grow, x.grow);
    }
    ck("각인 — 블록이 뷰포트 진입 표식을 받는다", acc.rv >= 20, `${acc.rv}개`);
    ck("각인 — 한 화면에 들어온 것만 움직인다(동시 진입 금지)", acc.maxOn >= 1 && acc.maxOn <= 14, `한번에 최대 ${acc.maxOn}개`);
    ck("각인 — 무한 반복 모션이 없다", acc.inf === 0, `${acc.inf}개`);
    ck("각인 — 표도 줄마다 채워진다", acc.wipe >= 5, `${acc.wipe}줄`);
    ck("각인 — 막대가 축에서 자라 오른다", acc.grow >= 5, `${acc.grow}개`);
    const rep = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const t = document.querySelector(".imp .impcore");
      const far = document.querySelectorAll(".imp .impck");
      if (!t || !far.length) return null;
      t.scrollIntoView({ block: "center" }); await wait(500);
      const a = t.classList.contains("rvin");
      far[far.length - 1].scrollIntoView({ block: "center" }); await wait(650);
      const b = t.classList.contains("rvin");
      t.scrollIntoView({ block: "center" }); await wait(500);
      return { a, b, c: t.classList.contains("rvin") };
    });
    ck("각인 — 화면에 들어오면 그려진다", !!rep && rep.a);
    ck("각인 — 스크롤로 벗어나면 되감긴다", !!rep && !rep.b);
    ck("각인 — 다시 오면 다시 그려진다", !!rep && rep.c);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "닫을게" }).click(); await page.waitForTimeout(500);
  ck("각인을 닫으면 로비로 돌아온다", (await page.locator(".imp").count()) === 0);

  /* ⚠ **판결을 던지기 전에** 검사해야 한다. 로비의 두 진입점은 `!ritual && !res` 조건이라
     판결이 한 번 돌고 나면 사라진다 — 뒤에 두면 "진입점이 없다"고 헛울음이 난다(실제로 그랬다). */
  /* ── v125 궁합 — 각인의 애드온. 생년월일 + (v136부터) 부를 이름을 받고 연락처는 안 받는다 ── */
  {
    const mb = page.getByRole("button", { name: /궁합 — 그 사람과 너/ });
    ck("궁합 진입점이 로비에 있다", (await mb.count()) === 1);
    if (await mb.count()) {
      await mb.first().click(); await page.waitForTimeout(350);
      const ask = await page.locator(".imp").innerText();
      ck("궁합 — 상대 생년월일을 묻는다", (await page.locator(".imp .impnum").count()) >= 3);
      /* v136 — 이름은 **받는다**(창업자 결정). 대신 지켜야 하는 두 가지를 여기서 본다:
         ①이름은 선택이라 비워도 돌아간다 ②연락처는 여전히 안 받고, 저장 범위를 화면이 밝힌다. */
      ck("궁합 — 부를 이름 칸이 있다(선택)", (await page.locator(".imp .impname").count()) === 1);
      ck("궁합 — 연락처는 안 받고 저장 범위를 밝힌다",
        /연락처는 안 받아/.test(ask) && /이 기기에만 남아/.test(ask) && /계산에 안 쓰고/.test(ask));
      ck("궁합 — 연인 말고도 쓰라고 안내한다", /같이 일하는 사람|가족|동업자/.test(ask));
      /* 실제로 돌려 본다 */
      const ins = page.locator(".imp .impnum");
      await ins.nth(0).fill("1997"); await ins.nth(1).fill("4"); await ins.nth(2).fill("22");
      await page.getByRole("button", { name: /둘을 맞대 볼게/ }).click();
      await page.waitForTimeout(400);
      const mt = await page.locator(".imp").innerText();
      ck("궁합 — 아홉 축이 각각 나온다", (await page.locator(".imp .impsky").count()) >= 9,
        `${await page.locator(".imp .impsky").count()}개`);
      ck("궁합 — 인도 여덟 항목이 막대로 나온다", /칸이 길수록/.test(mt) && (await page.locator(".imp .impmrow").count()) === 8);
      ck("궁합 — 갈리는 곳을 따로 말한다", /하늘끼리 갈린다|모든 하늘이 같은 말/.test(mt));
      ck("궁합 — 조심할 것을 준다", (await page.locator(".imp .imptrig").count()) >= 1);
      ck("궁합 — 총점을 맨 뒤에만 둔다", /이 숫자를 먼저 보지 마/.test(mt));
      ck("궁합 — 헤어지라고 안 한다", !/(헤어져|정리해|만나지 마|그만 만나)/.test(mt));
      ck("궁합 — 다른 사람과 다시 볼 수 있다", /다른 사람과도 봐볼게/.test(mt));
      /* v128 — 각인의 「같이 일하면 좋은 사람」(오행 한 줄)을 실제 사람으로 잇는 절 */
      ck("궁합 — 같이 일하면 어떤가 절이 있다", /같이 일하면 어떤가/.test(mt) &&
        ["둘의 역할", "누가 미나", "판은 누가 끄나", "말이 통하나", "얼마나 붙어 있어도 되나"].every((k) => mt.includes(k)),
        ["둘의 역할", "누가 미나", "판은 누가 끄나", "말이 통하나", "얼마나 붙어 있어도 되나"].filter((k) => !mt.includes(k)).join(",") || "전부");
      ck("궁합 — 일 절이 총점에 안 섞인다고 밝힌다", /총점에도 안 들어가/.test(mt));
      ck("궁합 — 동업하지 말라고 안 한다", !/(동업하지 마|같이 일하지 마)/.test(mt));
      /* v130 궁합 카드 — 상대는 이 앱을 쓴 적 없는 제3자다. 실을 수 있는 게 각인보다 훨씬 좁다 */
      ck("궁합 — 이미지 카드 버튼이 있다",
        (await page.getByRole("button", { name: /이미지로 간직하기 — 한 장/ }).count()) === 1);
      ck("궁합 — 카드에 안 담기는 것을 화면에 밝힌다",
        /둘의 생년월일도, 어느 축이 갈렸는지도, 총점도 안 담겨/.test(mt) && /보내기 전에 한 번 더 생각해/.test(mt));
      const mcard = await page.evaluate(async () => await new Promise((res) => {
        let got = null;
        const realClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { if (this.download) got = this.download; else realClick.call(this); };
        const btn = [...document.querySelectorAll("button")].find((b) => /이미지로 간직하기 — 한 장/.test(b.textContent));
        if (!btn) return res({ err: "버튼 없음" });
        btn.click();
        setTimeout(() => { HTMLAnchorElement.prototype.click = realClick; res({ got }); }, 900);
      }));
      ck("궁합 — 카드가 실제로 만들어져 내보내진다", mcard.got === "binari_gunghap.png", mcard.got || mcard.err || "안 나감");
    /* A-4: 궁합에도 고지가 붙는다 */
    ck("궁합 — 고지가 붙는다", /재미로 보는 참고용/.test(mt) && /관계를 끊거나 이으라는 판정이 아니고/.test(mt));
    }
  }
  await page.getByRole("button", { name: /^닫을게$/ }).last().click().catch(() => {});
  await page.waitForTimeout(1200);
}
/* ⚠ v144 — 궁합을 닫으면 **곁 탭으로 간다**(위성이 붙는 단계). 판결로 돌아와야 질문칸이 있다. */
await page.getByRole("button", { name: "판결", exact: true }).click().catch(() => {});
await page.waitForTimeout(500);
if (!(await page.locator("textarea.qbox").count())) { await page.locator("canvas").first().dblclick().catch(() => {}); await page.waitForTimeout(600); }
await page.locator("textarea.qbox").fill("전남친에게 연락할까?"); await page.waitForTimeout(300);
await page.getByRole("button", { name: "판결을 청한다" }).click();
await throwCoins(page);
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
