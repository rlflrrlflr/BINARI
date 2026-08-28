/* 템플릿 리터럴 안의 백틱 금지 — 실행: node e2e/css-backtick-check.mjs (앱 기동 불필요)
 *
 * 왜 있나: App.jsx 의 스타일은 **템플릿 리터럴 한 덩어리**다. 주석에 백틱을 하나 쓰면
 *   문자열이 거기서 끊기고 뒤가 JS 로 해석된다. 2026-08-27 하루에 **같은 실수를 두 번** 했다 —
 *   첫 번째는 `.stage.holo` 를 멤버 접근으로 읽어 앱이 통째로 죽었고(런타임 TypeError),
 *   두 번째는 더 나빴다: **문법 오류 없이 조용히 규칙 몇 줄이 사라졌다.**
 *   화면은 멀쩡히 뜨는데 스타일만 안 먹으니 원인을 찾는 데 오래 걸린다.
 *   사람이 조심해서 될 일이 아니라 검사로 막는다.
 *
 * ⚠ **2026-08-28 확장.** CSS 만 보고 있었는데 같은 사고가 **셰이더에서** 났다 —
 *   FIELD_FRAG 도 템플릿 리터럴이고, 주석에 백틱을 넣어 빌드가 깨졌다.
 *   위험한 건 "CSS"가 아니라 **여러 줄 템플릿 상수 전부**다. 대상을 그렇게 넓힌다. */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/App.jsx"), "utf8");

/* 검사 대상 — **한 덩어리로 쓰는** 템플릿 상수. 새 셰이더가 생기면 여기 이름을 더한다.
   ⚠ sim 엔진 셰이더(SIM_FRAG·RND_FRAG 등)는 뺀다 — 그쪽은 `\` + SHAPE_UNI + \`` 처럼
      **일부러 문자열을 결합**하므로 백틱이 정상이고, 넣으면 늘 FAIL 이 난다(실제로 그랬다).
      "백틱 금지"가 아니라 "한 덩어리 템플릿 안의 백틱 금지"가 규칙이다. */
const NAMES = ["CSS", "FIELD_FRAG", "FIELD_VERT"];
const marks = NAMES.flatMap((n) => [...SRC.matchAll(new RegExp("const " + n + " = `", "g"))]);
const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };
ck("템플릿 상수를 찾았다", marks.length >= 2, `${marks.length}개 (CSS·셰이더)`);

let bad = [];
for (const m of marks) {
  const start = m.index + m[0].length;
  const end = SRC.indexOf("`;", start);   // 닫는 백틱은 검사 대상이 아니다 — 그 앞까지만 본다
  const body = SRC.slice(start, end < 0 ? SRC.length : end);
  body.split("\n").forEach((line, i) => {
    if (line.includes("`")) bad.push(`${SRC.slice(0, start).split("\n").length + i}행: ${line.trim().slice(0, 70)}`);
  });
}
ck("템플릿 안에 백틱이 없다", bad.length === 0, bad.join(" | ") || "깨끗");

const pass = R.filter(Boolean).length;
console.log(`\n=== 템플릿 백틱: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
