/* CSS 블록 안 백틱 감시 — 2026-08-31 신설.
   `App.jsx` 의 스타일은 **템플릿 리터럴** 안에 산다. 그래서 주석에 백틱을 하나 쓰면
   문자열이 그 자리에서 끊기고 빌드가 죽는다. 같은 실수를 **세 번** 했다(작업로그 참조).
   빌드가 잡아 주긴 하지만 메시지가 「Expected ";" but found "li"」처럼 원인과 멀어서
   매번 다시 추적하게 된다. 여기서 **자리와 이유를 바로 말해 준다.**
   ⚠ 값을 안 세고 **성질**을 문다 — 「CSS 블록 안에 백틱이 있는가」. */
import { readFileSync } from "node:fs";
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

const f = R.filter((x) => !x).length;
console.log(`\n=== CSS 백틱: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
