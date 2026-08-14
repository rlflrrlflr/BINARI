/* 예시 — 개인정보 없음. 성씨·용신·후보를 전부 인자로 받는다.
   실행: node data/fetch.mjs && node demo.mjs */
import { ensureData } from "./data/fetch.mjs";
import { loadHanja } from "./lib/hanja.mjs";
import { loadUsage } from "./lib/usage.mjs";
import { loadTrend } from "./lib/trend.mjs";
import { sagyeok, eumyang, baleum, yongsinFit } from "./lib/score.mjs";
import { HARD, FLAG, duEumSubstitute, makeSurnameCompoundCheck, verdict, meaningOK } from "./lib/filter.mjs";

const CFG = {
  surname:     { kor: "김", han: "金", wonhoek: 8 },
  yongsin:     ["금", "수"],   // 사주에서 도출 — 이 엔진 밖의 입력
  lacking:     ["금"],         // 개수 0인 오행
  compoundBan: [],             // 성+음절이 단어가 되는 음절 (성마다 다름)
  familyGiven: [],             // 부모·형제 함자 음절
  minUsage:    300,            // 남아 최소 인원 — 이 아래는 "들어본 적 없는 이름"
  minMaleShare: 0.7,           // 남아 비율 하한
  topN:        40,             // 실사용 상위 N 에서 출발한다 (순서를 뒤집는 원칙)
};

const raw = await ensureData();
const H = loadHanja(raw);
const U = loadUsage(raw);
const T = loadTrend(new URL('./data/trend', import.meta.url).pathname);
console.log(`\n인명용 한자 ${H.size.toLocaleString()}자 · 실사용 ${U.period}`);
console.log(`추세: ${T.summary()}\n`);
const isCompound = makeSurnameCompoundCheck(CFG.compoundBan);

/* 순서를 뒤집는다 — 성명학 조건으로 이름을 만들지 않고, 실제로 쓰이는 이름에서 출발한다 */
const roster = U.topMale(CFG.topN)
  .map(x => ({ ...x, u: U.lookup(x.name) }))
  .filter(x => x.name.length === 2);

for (const { name, u } of roster) {
  const [s1, s2] = [...name];
  const hard = [];
  if (!u.exists || u.male < CFG.minUsage) hard.push(HARD.noRealUsage);
  if (u.maleShare != null && u.maleShare < CFG.minMaleShare) hard.push(`${HARD.noRealUsage} — 여아 우세(남 ${(u.maleShare*100).toFixed(0)}%)`);
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
  if (!best) continue;
  if (hard.length) continue;                       // HARD 탈락은 조용히 버린다

  const ph = baleum([CFG.surname.kor, s1, s2]);
  const v = verdict({ hardHits: hard });
  // 이름은 반드시 한자와 함께 — 한글 단독 노출 금지
  // 이름은 반드시 한자와 함께 — 한글 단독 노출 금지
  const tr = T.direction(name, "m");
  const trTxt = tr ? `${tr.label}(${tr.from}→${tr.to})` : "추세 모름";   // 없으면 추정하지 않는다
  console.log(`${CFG.surname.kor}${name}  ${CFG.surname.han}${best.i1.char}${best.i2.char}   남 ${u.male.toLocaleString()}명 · ${(u.maleShare*100).toFixed(0)}% · ${u.maleRank}위 · ${trTxt}`);
  console.log(`  뜻    ${best.i1.meaning} · ${best.i2.meaning}`);
  console.log(`  사격  ${Object.values(best.sg.four).join("·")}   음양 ${best.ey.pattern}   용신 ${best.ys.hit}/2 (0개 오행 ${best.ys.fillsLack}자)`);
  console.log(`  참고  발음오행 해례 ${ph.haerye.chain}/${ph.haerye.total} · 운해 ${ph.unhae.chain}/${ph.unhae.total}${ph.agree ? " (일치)" : " (갈림 — 단독 판정 불가)"}`);
  console.log(`  참고  사격 ${best.sg.gil}/4 · 원획 ${best.i1.wonhoek}·${best.i2.wonhoek} / 필획 ${best.i1.pilhoek}·${best.i2.pilhoek}\n`);
}
