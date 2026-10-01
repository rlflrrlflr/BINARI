/* 타이핑 반응 — 질문 칸에 글자를 치는 동안 수호신이 **읽고, 놀라고, 어이없어한다**.
 * (창업자 2026-10-01: "표정 변화도 드라마틱해야해. 어이없는 느낌으로 더 뜨악하고 경악하고
 *  / 살아있는 생명체같이 느껴져야지")
 *
 * ⚠ **치는 글은 어디에도 안 보낸다.** 판단은 아래 낱말 표로 기기 안에서 끝난다.
 *    보내기 전 글이 서버로 가면 「유저가 무엇이 나가는지 보고 있는가」(헌장)에 정면으로 걸린다.
 * ⚠ **무거운 말에는 놀라지 않는다.** 「죽고 싶다」에 경악하면 비웃음으로 읽힌다 —
 *    표정을 키우지 않고 고개를 숙이고 몸을 가라앉힌다. 목록이 겹치면 무거움이 이긴다.
 * ⚠ 목록은 **팀이 실제 질문으로 다듬을 초안**이다(사람들이 뭘 묻는지는 팀이 더 안다).
 */
/* 낱말(w)과 모양(re). **실시간**이 목표다(창업자 2026-10-01: "타이핑할때 실시간으로 표정이 바뀌면 좋겠고") —
   예전엔 낱말 표에 걸려야만 표정이 바뀌어서 「오늘 밥을 먹는데 끼야아아앙 벌레가 나온거야」를 다 칠 때까지
   **평온** 그대로였다(실기 캡처). 그래서 ①말투의 모양(ㅋㅋ·ㅠㅠ·늘인 소리·!!·?)도 읽고
   ②여러 감정이 섞이면 **가장 최근에 친 것**을 따른다 — 「밥 먹는데(신남) → 끼야아앙(경악)」으로 문장을 따라 바뀐다. */
export const FX_MOODS = [
  { k: "heavy",   w: ["죽고","죽을까","자살","이혼","아파","아프","병원","우울","힘들","장례","사고","무서","불안","외로","괴로"] },
  { k: "shock",   w: ["외계인","복권","로또","ufo","귀신","좀비","세계정복","대통령","재벌","100억","1조","순간이동","투명인간",
                      "타임머신","전생","공룡","드래곤","마법","초능력","화성","우주","벌레","바퀴","쥐가","똥","헐","대박","미친","ㄷㄷ"],
    re: /(끼야|꺄|으아|악{2,}|아{3,}|야{3,}|앙{2,}|!{2,})/g },
  { k: "laugh",   w: ["웃겨","웃김","개웃"], re: /(ㅋ{2,}|ㅎ{2,})/g },
  { k: "sad",     w: ["슬퍼","슬프","눈물","울었","울고","서운","속상"], re: /(ㅠ+|ㅜ{2,})/g },
  { k: "angry",   w: ["짜증","화나","화가","열받","빡쳐","빡치","싸웠","억울"] },
  { k: "love",    w: ["고백","썸","좋아해","좋아하는","연애","결혼","데이트","전남친","전여친","사귀","소개팅","재회","설레"] },
  { k: "serious", w: ["퇴사","이직","사업","투자","계약","대출","시험","면접","주식","코인","이사","창업","전세","월세"] },
  { k: "food",    w: ["밥","먹","저녁","점심","아침","치킨","라면","야식","배고","떡볶이","피자","마라탕"] },
  { k: "curious", re: /\?\s*$/g },
];

/* 기기 안에만 있는 상태. 질문 칸이 쓴다(typeIn), 수호신이 읽는다(typeFx). */
export const FX = { text: "", caret: 0, t: -1e9, kind: null, kindT: -1e9, kindIdx: -1, fired: true };

/* 가장 최근에 나온 감정과 그 위치를 돌려준다. ⚠ **무거운 말은 위치와 상관없이 이긴다** —
   「힘들어서 ㅋㅋ」의 ㅋㅋ 에 웃으면 안 된다. */
export function classify(s) {
  const q = (s || "").toLowerCase();
  let best = null, at = -1;
  for (const m of FX_MOODS) {
    let i = -1;
    if (m.w) for (const w of m.w) i = Math.max(i, q.lastIndexOf(w));
    if (m.re) { m.re.lastIndex = 0; let r; while ((r = m.re.exec(q))) { i = Math.max(i, r.index); if (!r[0].length) break; } }
    if (i < 0) continue;
    if (m.k === "heavy") return { k: "heavy", i };
    if (i > at || (i === at && m.k !== "curious")) { best = m.k; at = i; }
  }
  return best ? { k: best, i: at } : null;
}

export function typeIn(el) {
  if (!el) return;
  const v = el.value || "", now = performance.now();
  FX.text = v; FX.caret = el.selectionStart == null ? v.length : el.selectionStart; FX.t = now;
  const c = classify(v), k = c ? c.k : null, i = c ? c.i : -1;
  /* 같은 감정이라도 **새 자리에서 또 나오면** 다시 반응한다(벌레 → 끼야아앙: 둘 다 경악이지만 두 번 놀란다) */
  if (k !== FX.kind || (k && i > FX.kindIdx + 1)) { FX.kind = k; FX.kindT = now; FX.fired = false; }
  FX.kindIdx = i;
}

/* 지금 수호신이 보일 반응. 마지막 글자 뒤 6초가 지나면 다 풀린다(판결이 나온 뒤까지 경악해 있으면 안 된다). */
export function typeFx(now) {
  const since = now - FX.t;
  const live = since < 6000;
  const v = FX.text, i = Math.min(FX.caret, v.length);
  const col = i - (v.lastIndexOf("\n", i - 1) + 1), PER = 16;
  return {
    typing: since < 1500,
    sinceKey: since / 1000,
    caretX: -0.30 + ((col % PER) / PER) * 0.60,     // 앱의 고개 한계(±0.30) 안에서 커서를 따라간다
    kind: live ? FX.kind : null,
    age: (now - FX.kindT) / 1000,
  };
}
