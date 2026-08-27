/* CSS 템플릿 안의 백틱 금지 — 실행: node e2e/css-backtick-check.mjs (앱 기동 불필요)
 *
 * 왜 있나: App.jsx 의 스타일은 **템플릿 리터럴 한 덩어리**다. 주석에 백틱을 하나 쓰면
 *   문자열이 거기서 끊기고 뒤가 JS 로 해석된다. 2026-08-27 하루에 **같은 실수를 두 번** 했다 —
 *   첫 번째는 `.stage.holo` 를 멤버 접근으로 읽어 앱이 통째로 죽었고(런타임 TypeError),
 *   두 번째는 더 나빴다: **문법 오류 없이 조용히 규칙 몇 줄이 사라졌다.**
 *   화면은 멀쩡히 뜨는데 스타일만 안 먹으니 원인을 찾는 데 오래 걸린다.
 *   사람이 조심해서 될 일이 아니라 검사로 막는다. */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/App.jsx"), "utf8");

/* 스타일 덩어리 — `const CSS = \`…\`;` 한 덩어리다 */
const marks = [...SRC.matchAll(/const CSS = `/g)];
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
ck("스타일 템플릿을 찾았다", marks.length > 0, `${marks.length}개`);

let bad = [];
for (const m of marks) {
  const start = m.index + m[0].length;
  const end = SRC.indexOf("`;", start);   // 닫는 백틱은 검사 대상이 아니다 — 그 앞까지만 본다
  const body = SRC.slice(start, end < 0 ? SRC.length : end);
  body.split("\n").forEach((line, i) => {
    if (line.includes("`")) bad.push(`${SRC.slice(0, start).split("\n").length + i}행: ${line.trim().slice(0, 70)}`);
  });
}
ck("CSS 템플릿 안에 백틱이 없다", bad.length === 0, bad.join(" | ") || "깨끗");

const pass = R.filter(Boolean).length;
console.log(`\n=== CSS 백틱: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
