/* 한자 사전 — 인명용 등재 · 원획/필획 · 부수 · 자원오행 · 훈음 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* 원획법 보정: 부수의 변형꼴을 본래 글자 획수로 되돌린다.
   성명학 실무 다수설이며, 필획법을 쓰는 유파에서는 결과가 달라진다 → 둘 다 계산해 병기한다. */
export const WON_CORR = { "氵":1, "王":1, "忄":1, "扌":1, "犭":1, "艹":2, "辶":3, "衤":1, "礻":1, "罒":1 };

/* 부수 → 자원오행. 통설이 갈리지 않는 부수만 담는다(모르는 건 null로 두고 표기한다). */
export const EL_BY_RADICAL = {
  "氵":"수","水":"수","雨":"수","魚":"수","冫":"수",
  "金":"금","釒":"금","王":"금","玉":"금","石":"금","刂":"금","刀":"금","貝":"금","言":"금","白":"금","辛":"금","酉":"금",
  "木":"목","艹":"목","竹":"목","禾":"목","米":"목","糸":"목","舟":"목",
  "火":"화","灬":"화","日":"화","亻":"화","人":"화","忄":"화","心":"화","羽":"화","馬":"화","目":"화","車":"화",
  "土":"토","山":"토","田":"토","阝":"토",
};

export function loadHanja(rawDir) {
  const rd = (f) => readFileSync(join(rawDir, f), "utf8");
  const radical = new Map(), decomp = new Map(), strokes = new Map(), meaning = new Map();
  for (const line of rd("mmah.txt").split("\n")) {
    if (!line.trim()) continue;
    const d = JSON.parse(line);
    radical.set(d.character, d.radical); decomp.set(d.character, d.decomposition || "");
  }
  for (const line of rd("graphics.txt").split("\n")) {
    if (!line.trim()) continue;
    const d = JSON.parse(line);
    strokes.set(d.character, d.strokes.length);
  }
  const csv = (t) => { const [h, ...rows] = t.trim().split("\n"); const cols = h.split(",");
    return rows.map(r => { const v = r.split(","); return Object.fromEntries(cols.map((c,i)=>[c, v[i]])); }); };
  for (const r of csv(rd("data-naver.csv"))) if (!meaning.has(r.hanja)) meaning.set(r.hanja, r.meaning);

  const byReading = new Map(), all = new Map();
  for (const r of csv(rd("data-gov.csv"))) {
    /* 두음법칙 글자는 독음이 "리,이"처럼 쉼표로 묶여 저장된다 — 반드시 분해해야 한다.
       (이걸 놓치면 利·理 같은 핵심 글자가 통째로 검색에서 빠진다) */
    for (const k of String(r.hangul).split(",").map(s=>s.trim())) {
      if (!byReading.has(k)) byReading.set(k, new Set());
      byReading.get(k).add(r.hanja);
    }
    if (!all.has(r.hanja)) all.set(r.hanja, String(r.hangul).split(",").map(s=>s.trim()));
  }
  const pil = (c) => strokes.get(c) ?? null;
  const won = (c) => { const s = strokes.get(c); return s == null ? null : s + (WON_CORR[radical.get(c)] ?? 0); };
  return {
    byReading, size: all.size,
    isRegistered: (c) => all.has(c),
    info: (c) => ({ char:c, readings: all.get(c) ?? [], meaning: meaning.get(c) ?? null,
      radical: radical.get(c) ?? null, decomposition: decomp.get(c) ?? "",
      pilhoek: pil(c), wonhoek: won(c), jawon: EL_BY_RADICAL[radical.get(c)] ?? null }),
  };
}
