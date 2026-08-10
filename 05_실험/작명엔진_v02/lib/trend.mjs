/* 연도별 추세 — 데이터가 없으면 '모른다'고 답한다. 절대 추정하지 않는다.
   (누적 인원만으로 추세를 흉내 내면 신흥 이름이 구조적으로 과소평가된다) */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function loadTrend(dir) {
  const byYear = new Map();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      const m = /^(\d{4})\.csv$/.exec(f);
      if (!m) continue;
      const year = +m[1], rows = new Map();
      for (const line of readFileSync(join(dir, f), "utf8").trim().split("\n").slice(1)) {
        const [name, gender, count] = line.split(",").map(s => s.trim());
        if (!name || !gender) continue;
        rows.set(`${gender}:${name}`, +count || 0);
      }
      byYear.set(year, rows);
    }
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  /** 이름의 연도별 인원. 데이터 없으면 null — 호출부는 '모름'으로 표기해야 한다. */
  function series(name, gender = "m") {
    if (!years.length) return null;
    return years.map(y => ({ year: y, count: byYear.get(y).get(`${gender}:${name}`) ?? 0 }));
  }
  /** 최근 N년 방향. 표본이 모자라면 null. */
  function direction(name, gender = "m", window = 3) {
    const s = series(name, gender);
    if (!s || s.length < window) return null;
    const tail = s.slice(-window);
    const first = tail[0].count, last = tail[tail.length - 1].count;
    if (first === 0 && last === 0) return null;
    const delta = last - first;
    const pct = first ? delta / first : null;
    return { window, from: tail[0].year, to: tail[tail.length-1].year, first, last, delta,
             pct, label: delta > 0 ? "상승" : delta < 0 ? "하락" : "횡보" };
  }
  return {
    years, available: years.length > 0,
    series, direction,
    summary() {
      return years.length
        ? `연도별 데이터 ${years.length}개 (${years[0]}–${years[years.length-1]}) · 최근 3년 추세 계산 ${years.length >= 3 ? "가능" : "불가(3년 필요)"}`
        : "연도별 데이터 없음 — 추세는 '모름'으로 표기됨. data/trend/README.md 참고";
    },
  };
}
