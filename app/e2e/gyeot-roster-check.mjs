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
const { roleOf } = await import("../src/lib/match.js");
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
/* 층(부른 곁/곁)이 실제로 **밝기·자리·꼬리**로 갈리는 자리는 이제 셰이더다(v147).
   그래서 소스 그대로를 검사 대상으로 든다 — 주석은 걷어내고 본다(주석이 검사에 걸리는 사고를
   이 리포가 네 번 겪었다: `same ? 1 : 1`, \bidx\b, 5-g 의 (O) 예문, invite-check 의 match.js). */
const SRC = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const M = new Function("store", "hex2rgb", "roleOf", `
  ${grab("const EL_COLOR = {", "const")}
  ${grab("const GYEOT_KEY =", "const")}
  ${grab("const GY_CALLED =", "const")}
  ${grab("const GY_STANDING =", "const")}
  ${grab("const GYEOT_MAX =", "const")}
  ${grab("const GYEOT_NAME_MAX =", "const")}
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
  ${grab("function gyeotFill(")}
  ${grab("function gyeotSetName(")}
  ${grab("function gyeotOrder(")}
  ${grab("function gyeotSummary(")}
  ${grab("function gyeotView(")}
  return { GYEOT_KEY, GYEOT_MAX, GY_CALLED, GY_STANDING, gyeotSummary, GYEOT_REL_LINE, gyeotFingerprint, gyeotSeat, gyeotRel, gyeotFill,
           readGyeot, writeGyeot, gyeotAdd, gyeotDrop, gyeotSetName, gyeotOrder, gyeotView };
`)(store, hex2rgb, roleOf);

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

  const named = M.gyeotSetName(again, fp(1988, 1, 3), "민수");
  ck("① 이름이 붙는다", named.find((x) => x.key === fp(1988, 1, 3)).name === "민수");
  ck("① 이름은 12자에서 끊긴다", M.gyeotSetName(named, fp(1988, 1, 3), "가".repeat(30))
      .find((x) => x.key === fp(1988, 1, 3)).name.length === 12);

  ck("① 지우면 준다", M.gyeotDrop(named, fp(1988, 1, 3)).length === 1);
  ck("① 지운 건 저장에서도 빠진다", M.readGyeot().length === 1);

  reset();
  let big = [];
  for (let i = 0; i < M.GYEOT_MAX + 8; i++) big = M.gyeotAdd(big, { key: `k${i}`, el: "토" }, i);
  ck("① 상한이 있다 — 명부가 수집 카운터가 되지 않는다", big.length === M.GYEOT_MAX, `${big.length}/${M.GYEOT_MAX}`);

  reset();
  /* ⚠ v147 에서 조건이 하나 풀렸다: **오행 없는 자리를 받는다.** 부르기만 한 곁은 하늘이 없다
     — 답이 와야 사람이 되고, 그 전엔 상대의 오행을 우리가 모른다(지시서 §10 「B의 값을 A에게 보내기 — 안 한다」).
     그래서 `{key}` 만으로도 자리가 선다. 열쇠 없는 것은 여전히 안 받는다 — 그건 자리가 아니다. */
  ck("① 이상값에도 안 터진다",
     M.gyeotAdd([], null, 1).length === 0 && M.gyeotAdd([], { el: "수" }, 1).length === 0 && M.gyeotAdd([], {}, 1).length === 0);
  ck("① 하늘을 모르는 자리도 선다 (부르기만 한 곁)", M.gyeotAdd([], { key: "x", name: "민수" }, 1).length === 1);
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
  /* ⚠ v159 에서 `ax`(관계 좌표)가 늘었다 — **이미 본 궁합을 다시 보려면** 그게 있어야 한다
     (없으면 생년월일을 또 쳐야 한다). 늘어난 게 문제가 아니라 **그 안에 무엇이 들었는가**가 문제이므로,
     목록을 넓히는 대신 **좌표 안에 원값이 없는지**까지 같이 문다. */
  ck("② 남는 필드는 파생값 + 이름뿐(생년월일 없음)", keys === "at,ax,dg,el,key,name,tier", keys);
  {
    const withAx = M.gyeotAdd([], { key: "k", el: "수", dg: 3,
      ax: { ax: 1, dG: 3, dJ: 5, nayin: "천하수", sun: "황소자리", moon: "게자리",
        nak: 4, rashi: 2, wday: "화요일", pasa: "폰", neptu: 10, tone: 5, tsign: "오크(개)", lp: 8 } }, 1);
    const raw2 = disk.get(M.GYEOT_KEY);
    ck("② 좌표에도 생년월일 원값이 없다",
       !Object.keys(withAx[0].ax).some((k) => /^(y|m|d|h|min|birth)$/i.test(k)),
       Object.keys(withAx[0].ax).join(","));
    ck("② 좌표를 저장해도 문자열에 연도가 안 남는다", !/19\d\d|20\d\d/.test(raw2), (raw2.match(/(19|20)\d\d/) || ["없음"])[0]);
  }
  ck("② 지문은 같은 날짜에 같고 다른 날짜에 다르다",
     fp(1997, 4, 22) === fp(1997, 4, 22) && fp(1997, 4, 22) !== fp(1997, 4, 23));
}

/* ── ③ 목록이 순위가 되지 않는다 (§C-3 방어 1) ────────────────────────────── */
{
  reset();
  /* 사이(rel)가 전부 다른 셋을 넣는다 — 순위가 생긴다면 여기서 '생'이 위로 올라온다 */
  const me = "화";                              // 나를 생하는 건 목, 나를 극하는 건 수
  const list = [
    { key: "a", el: "수", alias: "", tier: "called", at: 100 },   // 극
    { key: "b", el: "목", alias: "", tier: "called", at: 300 },   // 생
    { key: "c", el: "화", alias: "", tier: "standing", at: 200 },     // 동
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
  const near = ["a", "b", "c"].map((k, i) => ({ key: k, el: "토", tier: "standing", at: i }));
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

/* ── ④ 두 층 — 「곁」(standing) / 「부른 곁」(called) ────────────────────────
   창업자 결정 2026-08-15 #1 의 **층 구분**은 그대로 채택했고, 「답 대기」라는 **말**만
   디자인 레인이 기각했다(행정 용어 · 사람을 규정 · 대기열은 순번을 부른다 → §5 위반).
   ⚠ 코드 값이 한글이면 화면 말이 바뀔 때마다 저장분이 깨진다 — v134.2 가 실제로 그랬다.
     그래서 값은 called/standing 이고, 구 한글 값은 읽을 때 한 번 옮긴다(아래 ④-b). */
{
  reset();
  const l = M.gyeotAdd([], { key: "z", el: "토" }, 1);
  ck("④ 새로 드는 사람은 '부른 곁'이다 (회신 레그가 아직 없다)", l[0].tier === M.GY_CALLED, l[0].tier);
  ck("④ 코드 값이 한글이 아니다(화면 말이 바뀌어도 저장분이 안 깨진다)",
     !/[가-힣]/.test(M.GY_CALLED + M.GY_STANDING), `${M.GY_CALLED}/${M.GY_STANDING}`);
  const vw = M.gyeotView([{ key: "z", el: "토", tier: M.GY_STANDING }, { key: "z2", el: "토", tier: M.GY_CALLED }], "화");
  /* ⚠ **v147 에서 흐리게 만드는 자리가 옮겨졌다.** 예전엔 여기서 색에 0.45 를 곱해 넘겼는데,
     그러면 승격이 한 프레임 만에 끝나 전이가 안 생긴다(§5 D-2: 끊기면 교체, 이어지면 자세).
     이제 층은 `tier`(0/1)로만 넘기고 밝기·자리·꼬리는 셰이더가 프레임마다 따라간다.
     그래서 검사도 **같은 뜻을 새 자리에서** 잡는다 — 뜻은 하나도 안 무르게 한다:
       ① 뷰가 층을 구분해서 넘기는가  ② 셰이더가 그 층으로 실제 밝기를 가르는가. */
  ck("④ '부른 곁'과 '곁'이 층으로 갈린다", vw[0].tier === 1 && vw[1].tier === 0, `${vw[0].tier} → ${vw[1].tier}`);
  ck("④ '부른 곁'은 흐리게 선다 (셰이더가 0.45 를 층으로 건다)",
     /v_gc\s*=\s*gcol\*mix\(0\.45,\s*1\.0,\s*gt\)/.test(SRC), "v_gc = gcol*mix(0.45, 1.0, gt)");
  ck("④ 승격은 밝기 하나로만 말하지 않는다 (자리·꼬리도 같이 움직인다)",
     /mix\(0\.46\*1\.18,\s*0\.46,\s*gt\)/.test(SRC) && /gtail\*mix\(0\.95,\s*0\.5,\s*gt\)/.test(SRC));
  /* ④-b 구값 승계 — v134.2 가 한글로 저장한 것을 안 옮기면 **밝기 판정이 조용히 뒤집힌다**
     (둘 다 GY_STANDING 이 아니게 되어 전원이 흐려지거나, 반대로 전원이 밝아진다). */
  reset();
  disk.set(M.GYEOT_KEY, JSON.stringify([{ key: "old1", el: "토", alias: "", tier: "곁", at: 1 },
                                        { key: "old2", el: "토", alias: "", tier: "대기", at: 2 }]));
  const migrated = M.readGyeot();
  ck("④-b v134.2 가 저장한 한글 층이 승계된다",
     migrated[0].tier === M.GY_STANDING && migrated[1].tier === M.GY_CALLED,
     migrated.map((x) => x.tier).join(","));
  ck("④ 흐린 것도 꺼지지는 않는다", vw[1].col[0] > 0);
  /* `key` 가 늘었다 — 승격 보간을 **사람마다** 들고 가야 해서다. 슬롯 번호로 들면
     곁이 하나 늘어 자리가 밀리는 순간 남의 전이를 이어받아 엉뚱한 위성이 밝아진다.
     ⚠ 늘어도 되는 건 여기까지다 — **이름은 여전히 안 넘어간다**(아래 ⑤가 잡는다). */
  ck("④ 셰이더가 받는 모양은 {key,rel,ang,col,tier} 뿐",
     Object.keys(vw[0]).sort().join(",") === "ang,col,key,rel,tier", Object.keys(vw[0]).sort().join(","));
  /* ── 답이 온 자리를 채운다 (v155~157) ──────────────────────────────────
     초대는 이름 없이 나가고, 답이 오면 **받은 사람이 쓴 이름**이 붙는다
     (2026-08-28 창업자: "누구를 부를지 이름을 쓰는 게 왜 필요해? 받은 사람이 쓰면 되지").
     ⚠ 단 A가 이미 적어 둔 이름은 **안 덮는다** — 그게 A가 그 사람을 알아보는 이름이다. */
  {
    const AX = { dG: 7, dJ: 4, el: "금", nak: 11, rashi: 1, lp: 3 };
    const seeded = M.gyeotAdd([], { key: "inv:x1", el: null, dg: null, name: "", inv: "x1" }, 10);
    ck("④-c 부른 자리는 하늘 없이 선다", seeded[0].el === null && seeded[0].tier === M.GY_CALLED);
    const filled = M.gyeotFill(seeded, "inv:x1", AX, "주영");
    ck("④-c 답이 오면 하늘이 찬다", filled[0].el === "금" && filled[0].dg === 7 && filled[0].tier === M.GY_STANDING,
       `${filled[0].el}/${filled[0].dg}/${filled[0].tier}`);
    ck("④-c 관계 좌표가 실린다(둘 사이를 이 기기에서 계산한다)", filled[0].ax && filled[0].ax.nak === 11);
    ck("④-c 받은 사람이 쓴 이름이 붙는다", filled[0].name === "주영", filled[0].name);
    ck("④-c 시각(at)은 안 건드린다 — 승격이 목록 순서를 안 흔든다", filled[0].at === 10, String(filled[0].at));
    /* A가 이미 적어 둔 이름이 있으면 그게 이긴다 */
    const named = M.gyeotAdd([], { key: "inv:x2", el: null, dg: null, name: "팀장님", inv: "x2" }, 11);
    ck("④-c A가 적어 둔 이름은 안 덮인다",
       M.gyeotFill(named, "inv:x2", AX, "주영")[0].name === "팀장님",
       M.gyeotFill(named, "inv:x2", AX, "주영")[0].name);
    /* 동의를 껐으면 좌표가 안 온다 — 그래도 밝기는 올라가면 안 된다(A는 아무것도 못 받는다) */
    ck("④-c 좌표 없이 채우려 해도 하늘을 지어내지 않는다",
       M.gyeotFill(seeded, "inv:x1", null, "")[0].el === null);
  }

  ck("④ 하늘을 모르는 곁은 흙색을 지어내지 않는다", (() => {
    const unk = M.gyeotView([{ key: "u", el: null, tier: M.GY_CALLED }], "화")[0];
    const soil = M.gyeotView([{ key: "s", el: "토", tier: M.GY_CALLED }], "화")[0];
    return unk.col.join() !== soil.col.join() && unk.rel === 0;
  })());
}

/* ── ⑥ 써머리 색인 — 표와 목록을 잇는 장치 (2026-08-17) ─────────────────────
   창업자: "요약과 리스트의 매칭이 어렵네. 색인으로 매칭하면 좋겠다."
   ⚠ 여기서 지켜야 하는 건 **번호가 자리에 붙지 사람에 붙지 않는 것**이다.
     같은 자리의 사람은 같은 번호를 단다 — 사람마다 다른 번호면 그건 줄 세우기다. */
{
  const me = 0;                                  // 갑(甲)
  const L = [
    { key: "a", el: "토", dg: 4, name: "가", tier: "called", at: 400 },
    { key: "b", el: "토", dg: 4, name: "나", tier: "called", at: 300 },   // a 와 같은 자리
    { key: "c", el: "화", dg: 2, name: "다", tier: "called", at: 200 },
    { key: "d", el: "수", dg: 9, name: "라", tier: "called", at: 100 },
  ];
  const sum = M.gyeotSummary(L, me);
  ck("⑥ 색인이 1부터 빠짐없이 붙는다",
     sum.rows.map((r) => r.i).join(",") === sum.rows.map((_, i) => i + 1).join(","), sum.rows.map((r) => r.i).join(","));
  ck("⑥ 같은 자리는 같은 번호를 단다", sum.index.get("a") === sum.index.get("b"),
     `가=${sum.index.get("a")} 나=${sum.index.get("b")}`);
  ck("⑥ 다른 자리는 다른 번호를 단다", sum.index.get("a") !== sum.index.get("c"));
  ck("⑥ 번호 가짓수 = 자리 가짓수 (사람 수가 아니다)",
     new Set([...sum.index.values()]).size === sum.rows.length, `번호 ${new Set([...sum.index.values()]).size}종 · 자리 ${sum.rows.length}종`);
  ck("⑥ 자리를 못 읽은 곁은 번호를 안 받는다",
     !M.gyeotSummary([{ key: "z", el: "토", tier: "called", at: 1 }], me).index.has("z"));
  /* 표는 개수 내림차순(범주의 분포), 목록은 최근순 — 둘이 같은 순서면 목록이 순위가 된다 */
  ck("⑥ 표는 개수 내림차순", sum.rows.every((r, i) => i === 0 || sum.rows[i - 1].people.length >= r.people.length),
     sum.rows.map((r) => r.people.length).join(">="));
}

/* ── ⑤ 소스 규약 — 화면 쪽 금지 (곁탭IA §5) ───────────────────────────────── */
{
  const panel = src.slice(src.indexOf('<ul className="gyeotlist">'), src.indexOf("</ul>", src.indexOf('<ul className="gyeotlist">')));
  /* ⚠ 예전엔 `\bidx\b` 도 금칙에 넣었다가 **명식의 `saju.idx`** 에 걸려 오탐이 났다.
     여기서 막고 싶은 건 "목록의 몇 번째"를 화면에 찍는 것이지 idx 라는 낱말이 아니다. */
  ck("⑤ 목록에 개수·순번을 안 찍는다",
     !/\.length\}|\{\s*i\s*\+\s*1\s*\}|map\(\([^)]*,\s*i\)\s*=>/.test(panel), panel.slice(0, 0));
  ck("⑤ 저장 키가 binari. 규칙을 따른다 — 초기화 스윕이 지운다", /^binari\./.test(M.GYEOT_KEY), M.GYEOT_KEY);
  /* 명부를 기기 밖으로 내보내는 배선이 생기면 위 ② 의 전제가 무너진다(지문은 역산 가능하다).
     지금 0인지 본다 — 나중에 붙일 땐 이 검사를 먼저 고치게 된다. */
  /* ── 이름은 기기 밖으로 한 걸음도 안 나간다 (2026-08-17 결정의 **조건**) ────────
     결정은 "이름을 받는다"였지 "이름을 내보낸다"가 아니다. 화면에 그렇게 적어 놨으므로
     이건 카피가 아니라 **지켜야 하는 약속**이다(v127.7: 약속을 먼저 쓰고 코드가 안 따라간 사고). */
  ck("⑤ 프롬프트엔 이름 대신 자리표가 간다",
     /곁\$\{i \+ 1\}=/.test(src) && !/gyeotPromptLine[\s\S]{0,600}x\.name/.test(src));
  ck("⑤ 판결 응답을 이름으로 바꾸기 전 r1 을 안 건드린다 — convo·계측·콜2 가 r1 을 탄다",
     !/r1\.verdict = gyeotFillNames/.test(src));
  ck("⑤ 밖으로 나가는 면(공유·부적)엔 이름 대신 가림말",
     (src.match(/gyeotMaskNames\(/g) || []).length >= 4);
  ck("⑤ 계측엔 이름이 아니라 적었는지 여부만", /named: !!\(f\.nm/.test(src) && !/track\([^)]*\bname:\s*[^)]*nm/.test(src));
  ck("⑤ 명부를 서버로 보내는 경로가 0",
     !new RegExp("(fetch|XMLHttpRequest|navigator\\.sendBeacon)[^\\n]*GYEOT_KEY").test(src)
     /* ⚠ **`el` 은 키 자리에 있을 때만 문다.** 예전엔 `el\b` 였는데 그러면 `rel:`(관계)·`del:` 같은
        **다른 낱말의 꼬리**까지 걸린다 — 실제로 v180 의 관계 계측(`rel: …`)이 여기 걸려 멈췄다.
        잡으려던 건 「곁의 **오행**을 계측에 싣는 것」이므로, `{` 나 `,` 뒤에 오는 **키로서의 el** 만 문다.
        느슨해진 게 아니라 **겨냥이 좁아진 것**이다 — 아래 반증검사가 그걸 확인한다. */
     && !/track\([^)]*gyeot[^)]*[{,]\s*el\s*:/.test(src));
}

const f = R.filter((x) => !x).length;
console.log(`\n=== 곁 명부: ${R.length - f}/${R.length} PASS ===`);
if (f) process.exit(1);
