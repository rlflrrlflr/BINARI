/* CSS 블록 안 백틱 감시 — 2026-08-31 신설.
   `App.jsx` 의 스타일은 **템플릿 리터럴** 안에 산다. 그래서 주석에 백틱을 하나 쓰면
   문자열이 그 자리에서 끊기고 빌드가 죽는다. 같은 실수를 **세 번** 했다(작업로그 참조).
   빌드가 잡아 주긴 하지만 메시지가 「Expected ";" but found "li"」처럼 원인과 멀어서
   매번 다시 추적하게 된다. 여기서 **자리와 이유를 바로 말해 준다.**
   ⚠ 값을 안 세고 **성질**을 문다 — 「템플릿 안에 백틱이 있는가」.

   ⚠ **2026-08-31 범위 복구.** 이 파일이 한 번 덮어써지며 **CSS 만 보는 판**으로 좁혀졌다.
      그런데 이 세션에서 난 백틱 사고 여섯 건 중 **넷이 CSS 밖**이었다 —
      셰이더(FIELD_FRAG) 셋, 보드 생성기 하나. 좁은 그물은 그 넷을 다 놓친다.
      위험한 건 「CSS」가 아니라 **여러 줄 템플릿 전부**다. 셋을 다 본다:
        ①CSS ②셰이더 상수 ③보드 생성기가 **문법적으로 파싱되는가**(이름을 안 외워도 된다). */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* 스타일 블록을 찾는다 — const CSS = `...` 꼴 */
const blocks = [...src.matchAll(/const CSS = `([\s\S]*?)`;?\s*\n(?=const |function |\/\* |export )/g)];
ck("스타일 블록을 찾았다", blocks.length >= 1, `${blocks.length}개`);

let bad = [];
for (const m of blocks) {
  const start = src.slice(0, m.index).split("\n").length;
  m[1].split("\n").forEach((ln, i) => { if (ln.includes("`")) bad.push(`${start + i}행: ${ln.trim().slice(0, 70)}`); });
}
ck("CSS 블록 안에 백틱이 없다", bad.length === 0, bad.join(" | "));
if (bad.length) console.log("  → 백틱은 템플릿 리터럴을 끊는다. 주석에서 코드 이름을 감쌀 땐 그냥 맨 글자로 써라.");

/* ── 셰이더 상수 — 한 덩어리로 쓰는 템플릿. 새 셰이더가 생기면 이름을 더한다.
   ⚠ sim 엔진 셰이더(SIM_FRAG 등)는 뺀다 — 거기는 **일부러 문자열을 결합**해서
      백틱이 정상이다(넣었더니 늘 FAIL 이 났다). */
const SH = ["FIELD_FRAG", "FIELD_VERT"];
let shBad = [];
for (const n of SH) {
  for (const m of src.matchAll(new RegExp("const " + n + " = `", "g"))) {
    const st = m.index + m[0].length;
    const en = src.indexOf("`;", st);
    src.slice(st, en < 0 ? src.length : en).split("\n").forEach((ln, i) => {
      if (ln.includes("`")) shBad.push(`${src.slice(0, st).split("\n").length + i}행: ${ln.trim().slice(0, 60)}`);
    });
  }
}
ck("셰이더 상수 안에 백틱이 없다", shBad.length === 0, shBad.join(" | ") || "깨끗");

/* ── 보드 생성기 — 이름을 외우는 대신 **파싱되는지 직접 묻는다** */
const GEN = new URL("../tools/build-face-mock.mjs", import.meta.url).pathname;
let genErr = "";
try { execSync(`node --check ${JSON.stringify(GEN)}`, { stdio: "pipe" }); }
catch (e) { genErr = String(e.stderr || e).split("\n").find((l) => l.includes("Error")) || "파싱 실패"; }
ck("보드 생성기가 파싱된다", !genErr, genErr || "build-face-mock.mjs 문법 정상");

const f = R.filter((x) => !x).length;
console.log(`\n=== 템플릿 백틱: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
