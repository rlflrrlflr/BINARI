/* 실사용 통계 — 대법원 '선호하는 출생자 이름 현황'
   HARD 필터 중 유일하게 자동화가 안 됐던 항목. 이제 연동된다.

   ⚠️ 원본은 freqAccList(누적합)로 저장돼 있다. 차분하지 않고 그대로 쓰면
      모든 이름이 200만명대로 나와 순위·성비가 통째로 무의미해진다. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function parse(path) {
  const s = readFileSync(path, "utf8");
  const d = JSON.parse(s.slice(s.indexOf("{")).trim().replace(/;$/, ""));
  const acc = d.freqAccList;
  const out = new Map();
  for (let i = 0; i < d.categories.length; i++) out.set(d.categories[i], i ? acc[i] - acc[i-1] : acc[0]);
  return { counts: out, total: acc[acc.length - 1] };
}

export function loadUsage(rawDir) {
  const m = parse(join(rawDir, "name-m.js"));
  const f = parse(join(rawDir, "name-f.js"));
  const rankOf = (counts) => {
    const r = new Map();
    [...counts.entries()].sort((a,b) => b[1]-a[1]).forEach(([n], i) => r.set(n, i+1));
    return r;
  };
  const rm = rankOf(m.counts), rf = rankOf(f.counts);
  return {
    period: "2008–2019 누계 (대법원)",
    totals: { male: m.total, female: f.total, names: m.counts.size + f.counts.size },
    /** 이름 하나의 실사용 — 남/여 인원, 남아 비율, 남자 순위 */
    lookup(name) {
      const male = m.counts.get(name) ?? 0, female = f.counts.get(name) ?? 0;
      const sum = male + female;
      return {
        name, male, female, total: sum,
        maleShare: sum ? male / sum : null,
        maleRank: rm.get(name) ?? null,
        femaleRank: rf.get(name) ?? null,
        exists: sum > 0,
      };
    },
    /** 남아 이름 상위 N — '실제 쓰이는 이름에서 출발한다'는 원칙의 출발점 */
    topMale(n = 100) {
      return [...m.counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, n)
        .map(([name, count], i) => ({ name, count, rank: i+1, ...{} }));
    },
  };
}
