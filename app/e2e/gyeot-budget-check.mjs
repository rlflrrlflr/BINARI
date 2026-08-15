/* 곁 입자 예산 — 친구를 부를수록 만족스러운가, 그런데 벌레떼가 되지는 않는가.
   실행: node e2e/gyeot-budget-check.mjs (브라우저 불필요)

   왜 있나: 시안의 원 규칙은 **입자 예산 고정**이었다. 성능과 벌레떼는 막지만 수집 유인을 죽인다 —
   총량이 고정이면 넷째를 불러도 화면이 그대로고, 앞줄을 인원수로 나누던 탓에
   **둘째를 부르면 첫째가 어두워졌다**(72%/1명 → 72%/2명 = 각 36%). 친구를 부를수록 손해였다.
   창업자 지시: "친구가 많은 게 만족스러워야 수집 욕구가 생긴다. 다만 어노잉하면 안 된다."

   이 검사가 지키는 건 그 **줄타기**다. 셋 다 동시에 참이어야 한다:
     ① 앞줄 각자는 절대 옅어지지 않는다(부를수록 손해가 나면 안 된다)
     ② 부를 때마다 총량이 는다 — 단 증가폭은 줄어든다(보상은 있되 폭주하지 않는다)
     ③ 총량에 상한이 있다(열 명이 열 배가 되면 그게 벌레떼다)
   숫자를 조금만 만져도 셋 중 하나가 조용히 깨진다 — 화면은 멀쩡해 보이고, 유인만 사라진다. */
import { readFileSync } from "node:fs";

const R = [];
const ck = (n, p, note = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${note ? " · " + note : ""}`); };

/* 함수를 베끼지 않고 App.jsx 소스에서 꺼내 돌린다 — 베끼면 본체가 바뀌어도 사본만 통과한다. */
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const grab = (head, kind = "fn") => {
  const i = src.indexOf(head);
  if (i < 0) throw new Error(`${head} 를 App.jsx 에서 찾지 못했습니다 — 이름이 바뀌었는지 확인하세요`);
  if (kind !== "fn") return src.slice(i, src.indexOf("\n", i) + 1);
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error(`${head} 본문이 닫히지 않았습니다`);
};
const gyeotShares = new Function(`${grab("const GYEOT = {", "const")}${grab("function gyeotShares(")}
  return gyeotShares;`)();

const N = [1, 2, 3, 4, 5, 6, 8, 10, 20, 50];
const S = Object.fromEntries(N.map((n) => [n, gyeotShares(n)]));

/* ── ① 앞줄 각자는 옅어지지 않는다 (시안이 틀렸던 바로 그 자리) ────────── */
{
  const pers = N.map((n) => S[n].per);
  ck("① 앞줄 1인분이 인원수와 무관하게 일정", new Set(pers.map((x) => x.toFixed(6))).size === 1,
     `1명 ${pers[0].toFixed(3)} → 50명 ${pers[pers.length - 1].toFixed(3)}`);
  // 둘째를 불렀을 때 첫째 몫이 줄면 그건 부를수록 손해다
  ck("① 둘째를 불러도 첫째가 어두워지지 않는다", S[2].per >= S[1].per, `${S[1].per.toFixed(3)} → ${S[2].per.toFixed(3)}`);
}

/* ── ② 부를 때마다 는다, 단 체감은 줄어든다 ───────────────────────────── */
{
  // 앞줄이 차기 전(1→2→3)은 확실히 커야 한다 — 첫 몇 명이 수집을 시작시킨다
  ck("② 1→2 는 눈에 띄게 는다", S[2].total >= S[1].total * 1.5, `${S[1].total.toFixed(3)} → ${S[2].total.toFixed(3)}`);
  ck("② 2→3 도 는다", S[3].total > S[2].total, `${S[2].total.toFixed(3)} → ${S[3].total.toFixed(3)}`);
  // 앞줄이 찬 뒤에도 한동안은 는다 — 여기서 0이 되면 "넷째부터 무의미"가 된다
  ck("② 앞줄이 찬 뒤에도 넷째·다섯째는 는다", S[4].total > S[3].total && S[5].total > S[4].total,
     `3→4 +${((S[4].total / S[3].total - 1) * 100).toFixed(0)}% · 4→5 +${((S[5].total / S[4].total - 1) * 100).toFixed(0)}%`);
  // 단조 증가(줄어드는 구간이 있으면 안 된다)
  ck("② 총량이 줄어드는 구간이 없다", N.every((n, i) => i === 0 || S[n].total >= S[N[i - 1]].total));
  // 증가폭은 점점 작아져야 한다 — 안 그러면 폭주한다
  const d = [S[2].total - S[1].total, S[3].total - S[2].total, S[4].total - S[3].total, S[5].total - S[4].total];
  /* 부동소수점 허용오차 — 앞줄 구간(1→2, 2→3)은 의도상 증가폭이 **같다**. 엄격 비교로 두면
     0.3-0.2 가 0.2-0.1 보다 미세하게 커서 실패한다(실제로 그렇게 한 번 틀렸다). 곡선의 모양을
     보는 검사지 소수점을 보는 검사가 아니다. */
  const EPS = 1e-9;
  ck("② 증가폭이 점점 작아진다(폭주하지 않는다)",
     d[1] <= d[0] + EPS && d[2] <= d[1] + EPS && d[3] <= d[2] + EPS,
     d.map((x) => x.toFixed(3)).join(" → "));
}

/* ── ③ 상한 — 열 명이 열 배가 되면 그게 시안 ⑤판의 벌레떼다 ──────────── */
{
  ck("③ 총량에 상한이 있다", S[50].total <= 0.5, `50명 ${S[50].total.toFixed(3)}`);
  ck("③ 50명이 1명의 10배를 넘지 않는다", S[50].total < S[1].total * 10,
     `1명 ${S[1].total.toFixed(3)} · 50명 ${S[50].total.toFixed(3)} (${(S[50].total / S[1].total).toFixed(1)}배)`);
  // 앞줄은 셋까지 — 넷째부터는 개체로 안 선다(숫자를 그림으로 세지 않기 위해)
  ck("③ 앞줄은 셋까지", S[10].front === 3 && S[2].front === 2, `10명일 때 앞줄 ${S[10].front}`);
  ck("③ 넷째부터는 뒤 성운으로", S[4].hidden === 1 && S[10].hidden === 7 && S[3].back === 0,
     `4명 숨김 ${S[4].hidden} · 3명 뒤성운 ${S[3].back}`);
}

/* ── ④ 경계 ──────────────────────────────────────────────────────────── */
{
  ck("④ 곁이 없으면 0", gyeotShares(0).total === 0 && gyeotShares(null).total === 0);
  ck("④ 음수·이상값에도 안 터진다", gyeotShares(-3).total === 0 && gyeotShares(undefined).total === 0);
}

const f = R.filter((x) => !x).length;
console.log(`\n=== 곁 입자 예산: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
