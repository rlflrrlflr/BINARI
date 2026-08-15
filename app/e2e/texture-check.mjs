/* 수호신 질감 검사 — texture() 가 사람마다 실제로 갈리는가.
   실행: node e2e/texture-check.mjs (브라우저 불필요)

   왜 이 검사가 있나: v114 에서 MBTI 문항을 없앨 때 원 주석이 경고했다 —
   "그냥 지우면 모든 새 유저의 수호신이 같은 질감이 된다. v27~v28 이 공들여 만든 다양성이 통째로 죽는다."
   질감 넷은 화면의 물리량(퍼짐·명멸·정연함·속도)이라, 한 축이라도 상수로 굳으면
   **오류 하나 없이** 모두 비슷한 수호신이 된다. 눈으로는 늦게 발견된다.

   ⚠ 이 파일은 texture() 를 **베끼지 않고 App.jsx 소스에서 꺼내 실행한다.**
      베끼면 본체가 바뀌어도 사본만 통과하는, 가장 흔한 거짓 초록불이 된다. */
import { readFileSync } from "node:fs";
import { sipseong, JI_BONGI, GAN, JI, GAN_EL } from "../src/lib/sky.js";

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

// ── App.jsx 에서 실제 함수 본문을 꺼낸다 ──────────────────────────────────
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const grab = (name) => {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`${name}() 를 App.jsx 에서 찾지 못했습니다 — 이름이 바뀌었는지 확인하세요`);
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error(`${name}() 본문이 닫히지 않았습니다`);
};
const texture = new Function("sipseongDist", "GAN", `${grab("texture")}; return texture;`)(
  new Function("sipseong", "JI_BONGI", `${grab("sipseongDist")}; return sipseongDist;`)(sipseong, JI_BONGI), GAN);

// ── 표본 만들기 — 실제 명식이 가질 수 있는 조합을 넓게 훑는다 ─────────────
const ZO_EL = ["불", "흙", "공기", "물"];
const MOONS = ["새달", "초승달", "상현달", "차오르는 달", "보름달", "기우는 달", "하현달", "그믐달"];
const EL = ["목", "화", "토", "금", "수"];
const rnd = (seed) => { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };
const rn = rnd(20260815);
const sample = [];
for (let i = 0; i < 4000; i++) {
  const pick = (a) => a[Math.floor(rn() * a.length)];
  const counts = {}; EL.forEach((e) => { counts[e] = Math.floor(rn() * 4); });
  const idx = { dG: Math.floor(rn() * 10), yG: Math.floor(rn() * 10), mG: Math.floor(rn() * 10), hG: Math.floor(rn() * 10),
                yJ: Math.floor(rn() * 12), mJ: Math.floor(rn() * 12), dJ: Math.floor(rn() * 12), hJ: Math.floor(rn() * 12) };
  sample.push({
    saju: { counts, idx, dayGan: GAN[idx.dG], main: pick(EL) },
    zo: { el: pick(ZO_EL) }, num: 1 + Math.floor(rn() * 9), moon: { name: pick(MOONS) },
  });
}
const codes = sample.map((s) => texture(s.saju, s.zo, s.num, s.moon));

// ── ① 네 축이 각각 실제로 갈리는가 (한 축이라도 상수면 그 시각 채널이 죽은 것) ──
const AX = [["퍼짐", 0, "E", "I"], ["명멸", 1, "N", "S"], ["정연함", 2, "T", "F"], ["속도", 3, "P", "J"]];
for (const [name, i, a, b] of AX) {
  const na = codes.filter((c) => c[i] === a).length, nb = codes.length - na;
  const minShare = Math.min(na, nb) / codes.length;
  ck(`축이 갈린다 — ${name}(${a}/${b})`, minShare >= 0.15,
     `${a} ${na} : ${b} ${nb} (적은 쪽 ${(minShare * 100).toFixed(0)}%)`);
}

// ── ② 조합이 충분히 흩어지는가 — 16가지 중 몇 개가 실제로 나오나 ──
const uniq = new Set(codes);
ck("16가지 중 대부분이 실제로 나온다", uniq.size >= 12, `${uniq.size}/16`);
const top = [...uniq].map((c) => [c, codes.filter((x) => x === c).length]).sort((x, y) => y[1] - x[1])[0];
ck("한 조합이 표본을 독점하지 않는다", top[1] / codes.length < 0.35, `최다 ${top[0]} ${(top[1] / codes.length * 100).toFixed(0)}%`);

// ── ③ 재료가 없을 때 폴백이 v114 판과 같은 값을 준다 (구버전 저장분이 조용히 다른 얼굴이 되지 않게) ──
{
  const legacy = (saju, zo, num) => {
    const c = saju.counts || {};
    return ((c.목 || 0) + (c.화 || 0) >= (c.금 || 0) + (c.수 || 0) ? "E" : "I")
      + (["공기", "불"].includes(zo?.el) ? "N" : "S")
      + (saju.main === "금" || saju.main === "토" ? "T" : "F")
      + (((num || 5) % 2) ? "P" : "J");
  };
  let same = 0, n = 0;
  for (const s of sample.slice(0, 500)) {
    const bare = { counts: s.saju.counts, main: s.saju.main };     // idx·dayGan 없음 = 구버전 저장분
    n++; if (texture(bare, s.zo, s.num, undefined) === legacy(bare, s.zo, s.num)) same++;
  }
  ck("재료가 없으면 폴백이 v114 판과 일치", same === n, `${same}/${n}`);
}

// ── ④ 같은 입력이면 같은 결과 (결정론 — 수호신은 볼 때마다 달라지면 안 된다) ──
{
  const s = sample[0];
  const a = texture(s.saju, s.zo, s.num, s.moon), b = texture(s.saju, s.zo, s.num, s.moon);
  ck("같은 명식이면 항상 같은 질감", a === b, `${a} = ${b}`);
}

// ── ⑤ 명식이 없으면 안전한 기본값 ──
ck("명식 없으면 기본값으로 떨어진다", texture(null, null, null, null) === "ISFJ");

const f = R.filter((x) => !x).length;
console.log(`\n=== 수호신 질감: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
