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
  /* 따옴표를 다루는 CSV 파서.
     data-gov.csv 는 두음법칙 글자의 독음을 `"리,이"` 처럼 **따옴표로 묶어** 저장한다.
     naive split(",") 로 읽으면 열이 밀려 利·理 같은 글자가 통째로 유실된다(실제로 그랬다). */
  const csvLine = (line) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur); return out;
  };
  const csv = (t) => { const [h, ...rows] = t.trim().split(/\r?\n/); const cols = csvLine(h);
    return rows.map(r => { const v = csvLine(r); return Object.fromEntries(cols.map((c,i)=>[c, v[i]])); }); };
  for (const r of csv(rd("data-naver.csv"))) if (!meaning.has(r.hanja)) meaning.set(r.hanja, r.meaning);
  /* IDS 보강 — makemeahanzi 에 없는 글자(珸 등)의 구성요소를 채운다 */
  try {
    for (const line of rd("ids.txt").split("\n")) {
      if (!line || line[0] === "#") continue;
      const [, ch, ...ids] = line.split("\t");
      if (!ch || decomp.has(ch)) continue;
      const first = (ids[0] || "").replace(/\[[^\]]*\]/g, "").trim();
      if (first) decomp.set(ch, first);
    }
  } catch { /* 없으면 보강 없이 진행 */ }

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
  /* makemeahanzi 는 9,574자만 담고 있어 인명용 일부(珸 등)가 빠진다.
     빠진 글자는 IDS 구성요소의 획수를 더해 보완한다 — 없다고 후보에서 지워버리면
     실제로 珸(옥돌 오)가 통째로 사라진다(실측). 보완값은 estimated 로 표시한다. */
  const IDS_OP = /[\u2FF0-\u2FFB]/g;
  function pilFallback(c, depth = 0) {
    if (strokes.has(c)) return { n: strokes.get(c), est: false };
    if (depth > 2) return { n: null, est: true };
    const d = decomp.get(c);
    if (!d) return { n: null, est: true };
    let sum = 0;
    for (const ch of d.replace(IDS_OP, "")) {
      if (ch === "？" || ch === c) return { n: null, est: true };
      const r = pilFallback(ch, depth + 1);
      if (r.n == null) return { n: null, est: true };
      sum += r.n;
    }
    return { n: sum || null, est: true };
  }
  /* 부수도 IDS 로 보완한다. 부수가 없으면 원획 보정도 자원오행도 못 하므로
     珸(王+吾) 같은 글자가 조건에서 조용히 빠진다. 좌변이 알려진 부수면 그걸 쓴다. */
  const KNOWN_RAD = new Set([...Object.keys(EL_BY_RADICAL), ...Object.keys(WON_CORR)]);
  function radFallback(c) {
    const r = radical.get(c); if (r) return r;
    const d = decomp.get(c); if (!d) return null;
    for (const ch of d.replace(IDS_OP, "")) if (KNOWN_RAD.has(ch)) return ch;
    return null;
  }
  const pil = (c) => pilFallback(c).n;
  const won = (c) => { const s = pil(c); return s == null ? null : s + (WON_CORR[radFallback(c)] ?? 0); };
  return {
    byReading, size: all.size,
    isRegistered: (c) => all.has(c),
    info: (c) => ({ char:c, readings: all.get(c) ?? [], meaning: meaning.get(c) ?? null,
      radical: radFallback(c), decomposition: decomp.get(c) ?? "",
      pilhoek: pil(c), wonhoek: won(c), jawon: EL_BY_RADICAL[radFallback(c)] ?? null,
      strokesEstimated: !strokes.has(c) }),
  };
}
