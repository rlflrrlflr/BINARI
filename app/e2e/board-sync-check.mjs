/* 시제품 보드가 앱과 같은 그림을 보여주는가. 실행: node e2e/board-sync-check.mjs (앱 기동 불필요)
 *
 * 왜 있나 — **두 번 어긋났다.**
 *   ① v143: 보드가 셰이더를 **베껴** 갖고 있어서 앱이 바뀌어도 보드는 옛 그림을 보여줬다.
 *      → v146 에서 `sliceConst` 로 App.jsx 에서 뽑아 쓰게 고쳤다.
 *   ② v150: 뽑아 쓰게 고쳤는데도 **생성기를 다시 안 돌려서** public/holo-field.html 이
 *      v149 시점에 멈춰 있었다. 창업자가 "메인에 반영됐어?" 라고 묻고서야 발견했다.
 *   그리고 이번엔 새 유니폼(u_born·u_touch)이 생겼는데 보드가 그 값을 안 줘서,
 *   생성기를 돌려도 **오라가 안 태어난 채로** 그려질 뻔했다.
 *
 * 검사하는 것 — 보드가 거짓말을 하는 세 경로를 각각 막는다
 *   ① 보드에 박힌 셰이더 == App.jsx 의 FIELD_FRAG (생성기를 안 돌리면 여기서 걸린다)
 *   ② 셰이더가 읽는 uniform 을 보드가 **하나도 빠짐없이** 세팅한다 (새 축이 생기면 걸린다)
 *   ③ 보드가 읽는 스펙 == src/lib/aura-spec.json
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const { sliceConst } = await import(resolve(APP, "tools/lib/extract.mjs"));

const SRC = readFileSync(resolve(APP, "src/App.jsx"), "utf8");
const HTML = readFileSync(resolve(APP, "public/holo-field.html"), "utf8");
const SPEC = JSON.parse(readFileSync(resolve(APP, "src/lib/aura-spec.json"), "utf8"));

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

const frag = sliceConst(SRC, "FIELD_FRAG");

/* ① 보드에 박힌 셰이더가 앱 것과 글자 하나까지 같은가 */
const m = HTML.match(/const FRAG=("(?:[^"\\]|\\.)*");/);
ck("① 보드에 셰이더가 박혀 있다", !!m);
if (m) {
  const boardFrag = JSON.parse(m[1]);
  ck("① 보드 셰이더 == App.jsx FIELD_FRAG", boardFrag === frag,
     boardFrag === frag ? "일치" : "어긋남 — `cd app && node tools/build-holo-field.mjs` 를 안 돌렸다");
}

/* ② 셰이더가 읽는 uniform 을 보드가 전부 세팅하는가 (새 축이 생기면 여기서 걸린다) */
const declared = new Set();
for (const d of frag.matchAll(/uniform\s+\w+\s+([^;]+);/g))
  /* ⚠ 배열 uniform(`u_trail[3]`)은 첨자를 떼야 이름이 된다 — 안 떼면 늘 "빠짐"으로 잡힌다 */
  d[1].split(",").forEach((v) => declared.add(v.trim().replace(/\[.*$/, "")));
const missing = [...declared].filter((u) => !new RegExp(`U\\("${u}"\\)`).test(HTML));
ck("② 셰이더의 uniform 을 보드가 전부 세팅한다", missing.length === 0,
   missing.length ? `빠짐: ${missing.join(", ")}` : `${declared.size}개 전부`);

/* ③ 보드가 들고 있는 스펙이 정본과 같은가 */
const dm = HTML.match(/const DATA=(\{[\s\S]*?\});\n/);
ck("③ 보드에 스펙이 박혀 있다", !!dm);
if (dm) {
  let aura = null;
  try { aura = JSON.parse(dm[1]).aura; } catch (_) {}
  ck("③ 보드 스펙 == aura-spec.json", JSON.stringify(aura) === JSON.stringify(SPEC),
     JSON.stringify(aura) === JSON.stringify(SPEC) ? "일치" : "어긋남 — 생성기를 다시 돌릴 것");
}

const pass = R.filter(Boolean).length;
console.log(`\n=== 보드-앱 동기화: ${pass}/${R.length} ${pass === R.length ? "PASS" : "FAIL"} ===`);
process.exit(pass === R.length ? 0 : 1);
