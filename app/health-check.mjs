#!/usr/bin/env node
/**
 * 비나리 건강검진 — 비개발자가 직접 돌려서, 코드를 읽지 않고도 앱의 고장을 알아내는 도구.
 *
 * 실행:  npm run 검진
 *
 * 설계 원칙
 *  1) 이 검사들은 "있으면 좋은 것"이 아니라 **실제로 터졌던 사고**에서 역산해 만들었다.
 *     새 사고가 나면 여기에 검사를 하나 추가한다. 그래야 같은 사고가 두 번 나지 않는다.
 *  2) 출력은 스택트레이스가 아니라 **한국어 증상 + 조치**다. 읽는 사람은 개발자가 아니다.
 *  3) 정적 검사는 항상 돌고, 브라우저 검사는 preview가 떠 있을 때만 돈다(없으면 건너뛴다).
 */
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const APP = "src/App.jsx";
const src = readFileSync(APP, "utf8");
const R = [];   // { level: "심각"|"주의"|"정상", title, detail, fix }
const add = (level, title, detail, fix) => R.push({ level, title, detail, fix });

/* ── 검사 1. GLSL 예약어를 변수로 쓰고 있는가 ─────────────────────────────
   사고 이력: 변수명 asm(GLSL 예약어) 때문에 sim 셰이더가 엄격한 드라이버(iOS 등)에서만
   컴파일 실패 → 조용히 열등한 렌더러로 폴백. 개발 PC에선 멀쩡해 보여서 발견이 늦었다. */
const GLSL_RESERVED = ["asm", "union", "packed", "namespace", "using", "template", "this",
  "goto", "switch", "default", "inline", "static", "extern", "external", "interface",
  "long", "short", "double", "half", "fixed", "unsigned", "input", "output", "typedef",
  "volatile", "public", "cast", "class", "enum", "sizeof"];
{
  const bad = [];
  for (const w of GLSL_RESERVED) {
    const re = new RegExp(`\\b(float|int|vec2|vec3|vec4|mat2|mat3|mat4|bool)\\s+${w}\\b`, "g");
    let m; while ((m = re.exec(src))) bad.push({ word: w, line: src.slice(0, m.index).split("\n").length });
  }
  if (bad.length) {
    add("심각", "셰이더에 GLSL 예약어를 변수명으로 사용",
      bad.map(b => `${b.line}행: '${b.word}'`).join(", "),
      "변수 이름을 바꾸세요. 이 이름들은 일부 기기(특히 iPhone)에서만 오류를 내고, 그런 기기에서는 수호신이 조용히 저품질 모드로 떨어집니다.");
  } else {
    add("정상", "셰이더 예약어", "GLSL 예약어를 변수로 쓴 곳 없음", "");
  }
}

/* ── 검사 2. 같은 값이 두 곳에 있는데 서로 어긋났는가(상수 표류) ──────────
   사고 이력: 응집 시차(stg)를 한쪽 셰이더에서만 고쳐서, 시뮬레이션과 화면 표시의
   기준이 달라졌다. 눈으로는 "뭔가 이상한데" 수준이라 원인 추적이 오래 걸렸다. */
{
  // 단일 진실 원천(TUNE)로 옮긴 값은 구조적으로 어긋날 수 없다 — 그 사실 자체를 검사한다.
  const tuned = /const TUNE = \{/.test(src);
  const injected = (src.match(/\$\{TUNE\.\w+\}/g) || []).length;
  if (tuned && injected >= 3) {
    add("정상", "튜닝값 단일화(TUNE)", `${injected}곳이 한 곳에서 주입됨 — 한쪽만 바뀌는 표류가 구조적으로 불가`, "");
  } else {
    add("주의", "튜닝값이 단일화되지 않음", "같은 값이 여러 곳에 직접 박혀 있음",
      "TUNE 블록으로 옮기면 한쪽만 고쳐 어긋나는 사고를 원천 차단할 수 있습니다.");
  }
  const pairs = [
    { name: "응집 시차(stg)", re: /float stg=a_r1\.z\*([\d.]+)/g, why: "수호신이 손끝으로 모이는 순서. 두 값이 다르면 움직임과 밝기가 어긋납니다." },
    { name: "입자 수", re: /const n = E \? (\d+) : (\d+);/g, why: "렌더러마다 입자 수가 다르면 같은 사람인데 기기별로 다른 수호신이 보입니다." },
    { name: "노출 예산(F_AL)", re: /F_AL = \{ 화: ([\d.]+)/g, why: "밝기 기준. 다르면 렌더러를 바꿀 때 화면이 갑자기 밝아지거나 어두워집니다." },
    { name: "별 입자 대비", re: /mix\(([\d.]+),([\d.]+),star\)\*\(0\.90/g, why: "알갱이 위계. 다르면 두 렌더러의 질감이 달라집니다." },
  ];
  for (const p of pairs) {
    const vals = [...src.matchAll(p.re)].map(m => m.slice(1).join("/"));
    if (vals.length >= 2 && new Set(vals).size > 1) {
      add("심각", `같은 설정값이 서로 다름 — ${p.name}`, `발견된 값: ${vals.join(" vs ")}`, `${p.why} 두 곳을 같은 값으로 맞추세요.`);
    } else if (vals.length >= 2) {
      add("정상", `설정값 일치 — ${p.name}`, `${vals.length}곳 모두 ${vals[0]}`, "");
    }
  }
}

/* ── 검사 3. 같은 수식을 두 벌 유지하고 있는가(중복) ─────────────────────
   중복 자체는 당장 고장은 아니지만, 위 1·2번 사고의 원인이다. 개수를 눈에 보이게 둔다. */
{
  const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
  const norm = t => t.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
  try {
    const gl = norm(cut("const GL_VERT", "const GL_FRAG"));
    const fn = norm(cut("const SHAPE_FN", "const SIM_VERT"));
    const forms = t => [...t.matchAll(/u_form<([\d.]+)\)\{(.*?)\}else/gs)].map(m => m[0]);
    const g = forms(gl), f = forms(fn);
    const same = g.filter((x, i) => x === f[i]).length;
    if (same > 0) {
      add("주의", "수호신 형상 수식이 두 벌로 존재",
        `${same}개 분기가 두 곳(GL_VERT / SHAPE_FN)에 똑같이 있음`,
        "한쪽만 고치면 두 렌더러가 다르게 보입니다. 지금은 검사 2가 어긋남을 잡아주지만, 근본적으로는 한 곳으로 합치는 게 안전합니다.");
    }
  } catch (_) { /* 구조가 바뀌면 조용히 넘어간다 */ }
}

/* ── 검사 4. 화면에 반드시 있어야 할 것들(법·약속) ──────────────────────
   법정 고지가 리팩터링 중 조용히 사라지는 사고를 막는다. */
{
  const must = [
    { name: "AI 생성 고지", pat: /AI가 생성/, fix: "AI기본법 제31조 고지입니다. 삭제하면 안 됩니다." },
    { name: "만 14세 확인 게이트", pat: /_age !== null && _age < 14/, fix: "개인정보보호법 제22조의2. 없으면 과태료 대상입니다." },
    { name: "서신 가격 표시", pat: /LETTER_PRICE/, fix: "가격 없는 버튼은 지불 의사를 잴 수 없습니다." },
    { name: "환불 불가 고지", pat: /환불되지 않아/, fix: "전자상거래법 제17조⑥. 미리보기와 함께 있어야 청약철회 배제가 유효합니다." },
    { name: "위기 상황 안내(109)", pat: /자살예방상담 109/, fix: "가드레일입니다. 어떤 리팩터링에서도 지우면 안 됩니다." },
    { name: "버전 배지", pat: /APP_VER/, fix: "지금 무엇을 보고 있는지 확인하는 수단입니다." },
  ];
  for (const m of must) {
    if (m.pat.test(src)) add("정상", `화면 필수 요소 — ${m.name}`, "있음", "");
    else add("심각", `화면 필수 요소 사라짐 — ${m.name}`, "코드에서 찾을 수 없음", m.fix);
  }
}

/* ── 검사 5. 앱과 평가 하네스가 같은 것을 재고 있는가 ────────────────────
   사고 위험: 프롬프트에 태그를 붙였는데 하네스에 안 붙이면, 채점 결과가 실제 앱과 무관해진다. */
{
  const tag = "유저가 '속결'로 물었다";
  const inApp = src.includes(tag);
  const evalPath = "eval/run-eval.mjs";
  if (existsSync(evalPath)) {
    const ev = readFileSync(evalPath, "utf8");
    if (inApp && !ev.includes(tag)) {
      add("심각", "평가 도구가 앱과 다른 것을 측정 중", "앱에는 판돈 태그가 있는데 평가 하네스에는 없음",
        "eval/run-eval.mjs에도 같은 태그를 넣으세요. 안 그러면 채점 결과가 실제 앱 품질과 무관합니다.");
    } else if (inApp) {
      add("정상", "평가 도구 정합", "앱과 하네스가 같은 프롬프트를 사용", "");
    }
  }
}

/* ── 검사 6. 빌드 산출물 ─────────────────────────────────────────────── */
add(existsSync("dist/index.html") ? "정상" : "주의", "빌드 산출물",
  existsSync("dist/index.html") ? "dist/ 있음" : "dist/ 없음",
  "npm run build 를 실행하세요.");

/* ── 검사 7. (브라우저) 실제로 어떤 렌더러가 뜨는가 ──────────────────────
   가장 중요한 검사. 사고 이력: 사용자가 몇 시간 동안 실행되지도 않는 렌더러를 튜닝했다.
   preview가 떠 있을 때만 실행한다. */
async function browserCheck() {
  const require = createRequire(import.meta.url);
  let pw; try { pw = require("playwright"); } catch { try { pw = require("/opt/node22/lib/node_modules/playwright"); } catch { return null; } }
  const base = process.env.BASE || "http://localhost:4173";
  try { const r = await fetch(base); if (!r.ok) return null; } catch (_) { return null; }
  const b = await pw.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", e => errs.push(String(e).slice(0, 80)));
  let out = {};
  try {
    await p.goto(base, { timeout: 15000 });
    await p.waitForTimeout(1200);
    out.badge = await p.locator(".verbadge").textContent().catch(() => null);
    out.shaders = await p.evaluate(() => {
      const c = document.createElement("canvas"); const gl = c.getContext("webgl");
      if (!gl) return { webgl: false };
      return { webgl: true, float: !!gl.getExtension("OES_texture_float"), vtf: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) };
    });
    out.errs = errs;
  } catch (e) { out.err = String(e).slice(0, 80); }
  await b.close();
  return out;
}

const bc = await browserCheck();
if (bc === null) {
  add("주의", "실행 중 검사 건너뜀", "preview 서버가 없어 실제 화면을 확인하지 못함",
    "터미널을 하나 더 열고 'npm run preview' 를 켠 뒤 다시 검진하면, 실제로 어떤 수호신이 뜨는지까지 확인합니다.");
} else if (bc.err) {
  add("심각", "앱이 열리지 않음", bc.err, "npm run build 후 preview를 다시 켜 보세요.");
} else {
  if (bc.errs?.length) add("심각", "화면에서 오류 발생", bc.errs.join(" / "), "이 오류는 사용자 화면에서도 납니다.");
  else add("정상", "화면 오류", "없음", "");
  add("정상", "지금 보이는 버전", bc.badge || "(배지 없음)", "");
}

/* ── 출력 ──────────────────────────────────────────────────────────── */
const bad = R.filter(r => r.level === "심각"), warn = R.filter(r => r.level === "주의"), ok = R.filter(r => r.level === "정상");
const line = "─".repeat(58);
console.log(`\n${line}\n  비나리 건강검진\n${line}`);
if (bad.length) {
  console.log(`\n■ 지금 고쳐야 할 것 (${bad.length}건)\n`);
  bad.forEach(r => console.log(`  ✗ ${r.title}\n     무엇이: ${r.detail}\n     어떻게: ${r.fix}\n`));
}
if (warn.length) {
  console.log(`\n■ 알아두면 좋은 것 (${warn.length}건)\n`);
  warn.forEach(r => console.log(`  △ ${r.title}\n     무엇이: ${r.detail}\n     어떻게: ${r.fix}\n`));
}
console.log(`\n■ 이상 없음 (${ok.length}건)`);
ok.forEach(r => console.log(`  ✓ ${r.title}${r.detail ? ` — ${r.detail}` : ""}`));
console.log(`\n${line}`);
console.log(bad.length ? `  결과: 문제 ${bad.length}건. 위 '어떻게'를 그대로 AI에게 전달하면 고칠 수 있습니다.`
  : warn.length ? `  결과: 당장 고칠 것은 없습니다. 주의 ${warn.length}건은 시간 날 때.`
  : `  결과: 모두 정상입니다.`);
console.log(`${line}\n`);
process.exit(bad.length ? 1 : 0);
