/* 예시 — 개인정보 없음. 성씨·용신·후보를 전부 인자로 받는다.
   실행: node data/fetch.mjs && node demo.mjs */
import { ensureData } from "./data/fetch.mjs";
import { loadHanja } from "./lib/hanja.mjs";
import { sagyeok, eumyang, baleum, yongsinFit } from "./lib/score.mjs";
import { HARD, FLAG, duEumSubstitute, makeSurnameCompoundCheck, verdict, meaningOK } from "./lib/filter.mjs";

const CFG = {
  surname:     { kor: "김", han: "金", wonhoek: 8 },
  yongsin:     ["금", "수"],   // 사주에서 도출 — 이 엔진 밖의 입력
  lacking:     ["금"],         // 개수 0인 오행
  compoundBan: [],             // 성+음절이 단어가 되는 음절 (성마다 다름)
  familyGiven: [],             // 부모·형제 함자 음절
  candidates:  [["태","윤"], ["하","준"], ["지","호"]],   // 실사용이 확인된 이름만 넣는다
  usage:       { "태윤": 11539, "하준": 9800, "지호": null },  // 사람이 채우는 값(통계 미연동)
};

const raw = await ensureData();
const H = loadHanja(raw);
console.log(`\n인명용 한자 ${H.size.toLocaleString()}자 적재\n`);
const isCompound = makeSurnameCompoundCheck(CFG.compoundBan);

for (const [s1, s2] of CFG.candidates) {
  const name = s1 + s2;
  const hard = [];
  if (CFG.usage[name] == null) hard.push(HARD.noRealUsage);
  if (isCompound(s1)) hard.push(HARD.surnameCompound);
  for (const s of [s1, s2]) if (CFG.familyGiven.includes(s)) hard.push(HARD.familyClash);
  for (const s of [s1, s2]) { const sub = duEumSubstitute(s); if (sub) hard.push(`${HARD.wordClash} (${s}→${sub} 확인)`); }

  let best = null;
  for (const c1 of H.byReading.get(s1) ?? []) for (const c2 of H.byReading.get(s2) ?? []) {
    const i1 = H.info(c1), i2 = H.info(c2);
    if (i1.wonhoek == null || i2.wonhoek == null) continue;
    if (!meaningOK(i1.meaning) || !meaningOK(i2.meaning)) continue;   // HARD — 뜻이 이름에 부적합
    const ey = eumyang([CFG.surname.wonhoek, i1.wonhoek, i2.wonhoek]);
    if (ey.pure) continue;                        // HARD — 순양·순음
    const sg = sagyeok(CFG.surname.wonhoek, i1.wonhoek, i2.wonhoek);
    const ys = yongsinFit([i1.jawon, i2.jawon], CFG.yongsin, CFG.lacking);
    const rank = ys.fillsLack * 100 + ys.hit * 50 + sg.gil * 10 - (i1.pilhoek + i2.pilhoek) * 0.5;
    if (!best || rank > best.rank) best = { rank, i1, i2, sg, ey, ys };
  }
  if (!best) { console.log(`${CFG.surname.kor}${name} — 조건 맞는 한자 조합 없음\n`); continue; }

  const ph = baleum([CFG.surname.kor, s1, s2]);
  const v = verdict({ hardHits: hard });
  // 이름은 반드시 한자와 함께 — 한글 단독 노출 금지
  console.log(`${CFG.surname.kor}${name}  ${CFG.surname.han}${best.i1.char}${best.i2.char}   ${v.pass ? "통과" : "탈락"}`);
  console.log(`  뜻    ${best.i1.meaning} · ${best.i2.meaning}`);
  console.log(`  사격  ${Object.values(best.sg.four).join("·")}   음양 ${best.ey.pattern}   용신 ${best.ys.hit}/2 (0개 오행 ${best.ys.fillsLack}자)`);
  if (v.hardHits.length) console.log(`  탈락  ${v.hardHits.join(" / ")}`);
  console.log(`  참고  발음오행 해례 ${ph.haerye.chain}/${ph.haerye.total} · 운해 ${ph.unhae.chain}/${ph.unhae.total}${ph.agree ? " (일치)" : " (갈림 — 단독 판정 불가)"}`);
  console.log(`  참고  사격 ${best.sg.gil}/4 · 원획 ${best.i1.wonhoek}·${best.i2.wonhoek} / 필획 ${best.i1.pilhoek}·${best.i2.pilhoek}\n`);
}
