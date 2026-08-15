/* 곁 명부 — 사람이 생기는데 **순위는 안 생기는가**.
   실행: node e2e/gyeot-roster-check.mjs (브라우저 불필요)

   왜 있나: `gyeotShares(n)` 은 사람 수 n 을 받는데 그 n 을 만드는 명부가 없었다.
   명부를 만들면 그 순간 **지금까지 순위가 없던 이유가 사라진다** — 원칙이 아니라
   화면에 사람이 한 명뿐이었기 때문이었다(작업배분 §1 ⚠ · 역할과초대 §C-3 방어 1).
   그래서 이 검사는 두 가지를 동시에 본다:
     ① 명부가 실제로 굴러가는가 (들이기·중복제거·삭제·별칭·상한)
     ② 명부가 순위로 읽히지 않게 하는 장치 셋이 살아 있는가
        (정렬키 하나 · 자리각이 순서와 무관 · 원값 미저장)
   ②가 조용히 깨지면 화면은 멀쩡하고 **뜻만 바뀐다**. 그게 이 파일이 있는 이유다. */
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

/* localStorage 대역 — App.jsx 의 store 는 브라우저 것이라 여기선 Map 으로 세운다.
   writeGyeot 이 실제로 무엇을 적는지 봐야 "원값을 안 쌓는다"를 검사할 수 있다. */
const disk = new Map();
const store = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)), removeItem: (k) => disk.delete(k) };
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

const M = new Function("store", "hex2rgb", `
  ${grab("const EL_COLOR = {", "const")}
  ${grab("const GYEOT_KEY =", "const")}
  ${grab("const GYEOT_MAX =", "const")}
  ${grab("const GYEOT_SAENG =", "const")}
  ${grab("const GYEOT_GEUK ", "const")}
  ${grab("const GYEOT_REL_LINE = {")}
  ${grab("function gyeotHash(")}
  ${grab("function gyeotFingerprint(")}
  ${grab("const GYEOT_SEATS =", "const")}
  ${grab("function gyeotSeat(")}
  ${grab("function gyeotRel(")}
  ${grab("function readGyeot(")}
  ${grab("function writeGyeot(")}
  ${grab("function gyeotAdd(")}
  ${grab("function gyeotDrop(")}
  ${grab("function gyeotRename(")}
  ${grab("function gyeotOrder(")}
  ${grab("function gyeotView(")}
  return { GYEOT_KEY, GYEOT_MAX, GYEOT_REL_LINE, gyeotFingerprint, gyeotSeat, gyeotRel,
           readGyeot, writeGyeot, gyeotAdd, gyeotDrop, gyeotRename, gyeotOrder, gyeotView };
`)(store, hex2rgb);

const reset = () => disk.clear();
const fp = (y, m, d) => M.gyeotFingerprint(y, m, d);

/* ── ① 명부가 굴러간다 ──────────────────────────────────────────────────── */
{
  reset();
  let l = [];
  l = M.gyeotAdd(l, { key: fp(1997, 4, 22), el: "수" }, 1000);
  l = M.gyeotAdd(l, { key: fp(1988, 1, 3), el: "화" }, 2000);
  ck("① 들이면 는다", l.length === 2, `${l.length}명`);
  ck("① 저장까지 간다", M.readGyeot().length === 2);

  const again = M.gyeotAdd(l, { key: fp(1997, 4, 22), el: "수" }, 3000);
  ck("① 같은 사람을 두 번 안 센다", again.length === 2, `재실행 후 ${again.length}명`);
  ck("① 다시 만나면 시각만 갱신된다", again.find((x) => x.key === fp(1997, 4, 22)).at === 3000);

  const named = M.gyeotRename(again, fp(1988, 1, 3), "같이 일하는 사람");
  ck("① 별칭이 붙는다", named.find((x) => x.key === fp(1988, 1, 3)).alias === "같이 일하는 사람");
  ck("① 별칭은 12자에서 끊긴다", M.gyeotRename(named, fp(1988, 1, 3), "가".repeat(30))
      .find((x) => x.key === fp(1988, 1, 3)).alias.length === 12);

  ck("① 지우면 준다", M.gyeotDrop(named, fp(1988, 1, 3)).length === 1);
  ck("① 지운 건 저장에서도 빠진다", M.readGyeot().length === 1);

  reset();
  let big = [];
  for (let i = 0; i < M.GYEOT_MAX + 8; i++) big = M.gyeotAdd(big, { key: `k${i}`, el: "토" }, i);
  ck("① 상한이 있다 — 명부가 수집 카운터가 되지 않는다", big.length === M.GYEOT_MAX, `${big.length}/${M.GYEOT_MAX}`);

  reset();
  ck("① 이상값에도 안 터진다",
     M.gyeotAdd([], null, 1).length === 0 && M.gyeotAdd([], { key: "x" }, 1).length === 0 && M.gyeotAdd([], { el: "수" }, 1).length === 0);
  disk.set(M.GYEOT_KEY, "{망가진 JSON");
  ck("① 저장이 깨져 있어도 빈 명부로 시작한다", M.readGyeot().length === 0);
}

/* ── ② 원값(생년월일)을 안 쌓는다 (역할과초대 §D) ─────────────────────────── */
{
  reset();
  let l = [];
  l = M.gyeotAdd(l, { key: fp(1997, 4, 22), el: "수" }, 1000);
  const raw = disk.get(M.GYEOT_KEY);
  ck("② 저장된 문자열에 생년월일이 없다",
     !/1997/.test(raw) && !/"y"/.test(raw) && !/"d"/.test(raw) && !/birth/.test(raw), raw);
  const keys = Object.keys(l[0]).sort().join(",");
  ck("② 남는 필드는 파생값 넷뿐", keys === "alias,at,el,key,tier", keys);
  ck("② 지문은 같은 날짜에 같고 다른 날짜에 다르다",
     fp(1997, 4, 22) === fp(1997, 4, 22) && fp(1997, 4, 22) !== fp(1997, 4, 23));
}

/* ── ③ 목록이 순위가 되지 않는다 (§C-3 방어 1) ────────────────────────────── */
{
  reset();
  /* 사이(rel)가 전부 다른 셋을 넣는다 — 순위가 생긴다면 여기서 '생'이 위로 올라온다 */
  const me = "화";                              // 나를 생하는 건 목, 나를 극하는 건 수
  const list = [
    { key: "a", el: "수", alias: "", tier: "대기", at: 100 },   // 극
    { key: "b", el: "목", alias: "", tier: "대기", at: 300 },   // 생
    { key: "c", el: "화", alias: "", tier: "곁", at: 200 },     // 동
  ];
  const ord = M.gyeotOrder(list);
  ck("③ 정렬은 최근순 하나뿐 — 사이로 줄 세우지 않는다",
     ord.map((x) => x.key).join("") === "bca", ord.map((x) => x.key).join(""));

  /* at 을 뒤집으면 순서가 그대로 뒤집혀야 한다. 다른 키가 섞여 있으면 안 뒤집힌다. */
  const flipped = M.gyeotOrder(list.map((x) => ({ ...x, at: 400 - x.at })));
  ck("③ 시간만 뒤집으면 순서도 그대로 뒤집힌다",
     flipped.map((x) => x.key).join("") === "acb", flipped.map((x) => x.key).join(""));

  /* 방어 ② — 궤도 위 자리는 목록 순서가 아니라 그 사람 지문에서 나온다.
     순서를 섞어도 **각자의** 자리각이 그대로여야 한다(바뀌면 인덱스를 쓰고 있다는 뜻).
     v2 는 뒤집은 목록의 결과라, 도로 뒤집어야 v1 과 같은 사람끼리 맞대진다. */
  const v1 = M.gyeotView(list, me);
  const v2 = M.gyeotView(list.slice().reverse(), me).slice().reverse();
  const ang1 = v1.map((x) => x.ang.toFixed(6)).join(",");
  const ang2 = v2.map((x) => x.ang.toFixed(6)).join(",");
  ck("③ 궤도 자리는 목록 순서와 무관하다", ang1 === ang2, ang1);
  /* 각도가 '다르기만' 하면 안 된다 — 0.097 / 0.098 / 0.099 도 서로 다른 값이지만
     화면에선 셋이 한 덩어리로 겹친다(실제로 그렇게 한 번 틀렸다). 눈에 보일 만큼 떨어져야 한다. */
  const gapOK = (vs) => {
    const a = vs.map((x) => x.ang).sort((p, q) => p - q);
    let min = Infinity;
    for (let i = 0; i < a.length; i++) {
      const g = i ? a[i] - a[i - 1] : a[0] + Math.PI * 2 - a[a.length - 1];
      if (g < min) min = g;
    }
    return min;
  };
  ck("③ 앞줄 셋이 겹쳐 서지 않는다", gapOK(v1) >= Math.PI * 2 / 12 - 1e-9, `최소 간격 ${gapOK(v1).toFixed(3)}rad`);
  /* 지문이 이웃해도 자리는 벌어져야 한다 — 처음 이 검사를 깨뜨린 바로 그 모양 */
  const near = ["a", "b", "c"].map((k, i) => ({ key: k, el: "토", tier: "곁", at: i }));
  ck("③ 이웃한 지문도 자리가 벌어진다", gapOK(M.gyeotView(near, me)) >= Math.PI * 2 / 12 - 1e-9,
     `최소 간격 ${gapOK(M.gyeotView(near, me)).toFixed(3)}rad`);

  /* 사이 셋은 종류지 등급이 아니다 — 셋 다 문구가 있어야 한다.
     하나라도 비면 그 자리가 "말할 게 없는 사이"가 되고, 그게 곧 꼴찌다. */
  ck("③ 사이 셋 전부에 쓸모의 한 줄이 있다",
     ["1", "-1", "0"].every((k) => (M.GYEOT_REL_LINE[k] || "").length > 4));
  const lines = Object.values(M.GYEOT_REL_LINE).join(" ");
  ck("③ 사이 문구에 서열·부정어가 없다 (역할과초대 §A-2)",
     !/(가장|최적|1순위|추천|피해|도움이 안|잘 맞|안 맞|나쁜|좋은 사이)/.test(lines), lines);

  ck("③ 사이 판정이 맞다", M.gyeotRel("화", "목") === 1 && M.gyeotRel("화", "수") === -1 && M.gyeotRel("화", "화") === 0);
  ck("③ 명식이 없으면 사이도 안 만든다", M.gyeotRel(null, "수") === 0 && M.gyeotRel("화", null) === 0);
}

/* ── ④ 두 층 — 회신 온 사람 / 답 대기 (창업자 결정 2026-08-15 #1) ─────────── */
{
  reset();
  const l = M.gyeotAdd([], { key: "z", el: "토" }, 1);
  ck("④ 새로 드는 사람은 '대기' 다 (회신 레그가 아직 없다)", l[0].tier === "대기", l[0].tier);
  const vw = M.gyeotView([{ key: "z", el: "토", tier: "곁" }, { key: "z2", el: "토", tier: "대기" }], "화");
  ck("④ '대기' 는 흐리게 선다", vw[1].col[0] < vw[0].col[0], `${vw[0].col[0].toFixed(3)} → ${vw[1].col[0].toFixed(3)}`);
  ck("④ 흐린 것도 꺼지지는 않는다", vw[1].col[0] > 0);
  ck("④ 셰이더가 받는 모양은 {rel,ang,col} 뿐",
     Object.keys(vw[0]).sort().join(",") === "ang,col,rel", Object.keys(vw[0]).sort().join(","));
}

/* ── ⑤ 소스 규약 — 화면 쪽 금지 (곁탭IA §5) ───────────────────────────────── */
{
  const panel = src.slice(src.indexOf('<ul className="gyeotlist">'), src.indexOf("</ul>", src.indexOf('<ul className="gyeotlist">')));
  ck("⑤ 목록에 개수·순번을 안 찍는다", !/\.length\}|\bindex\b|\bidx\b|\bi \+ 1\b/.test(panel));
  ck("⑤ 저장 키가 binari. 규칙을 따른다 — 초기화 스윕이 지운다", /^binari\./.test(M.GYEOT_KEY), M.GYEOT_KEY);
  /* 명부를 기기 밖으로 내보내는 배선이 생기면 위 ② 의 전제가 무너진다(지문은 역산 가능하다).
     지금 0인지 본다 — 나중에 붙일 땐 이 검사를 먼저 고치게 된다. */
  ck("⑤ 명부를 서버로 보내는 경로가 0",
     !new RegExp("(fetch|XMLHttpRequest|navigator\\.sendBeacon)[^\\n]*GYEOT_KEY").test(src)
     && !/track\([^)]*gyeot[^)]*el\b/.test(src));
}

const f = R.filter((x) => !x).length;
console.log(`\n=== 곁 명부: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
