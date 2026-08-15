/* 평가 페르소나 조립 — **가상 생년월일 → 앱의 엔진으로 명식을 뽑는다.**
   실행은 안 한다(모듈). 쓰는 쪽: eval/run-eval.mjs · eval/personas-check.mjs

   ── 왜 이 파일이 생겼나 (v128) ────────────────────────────────────────────
   v127 까지 `personas.json` 은 명식을 **손으로 적은 표**였다. 두 가지가 잘못돼 있었다.

   ① **실인물이 들어 있었다.** P1 이 창업자의 이름(석우)과 사주 네 기둥이었다.
      사주 네 기둥은 60년 안에서 생년월일시와 **일대일**이라, 이름과 나란히 적히면
      그 자체로 한 사람을 특정한다. CLAUDE.md §운영 규칙이 금지하는 바로 그 형태다.
      → 가상 생년월일로 갈았다. **검사에 필요한 건 "고정된 입력"이지 "진짜 입력"이 아니다.**

   ② **손으로 적은 값은 엔진을 안 따라온다.** 만세력·대운·나크샤트라 계산이 바뀌어도
      표는 그대로 남아, 하네스가 **앱과 다른 명식으로 앱을 평가**하게 된다.
      실제로 위험한 자리다 — v117 에 위도가 상승궁에 연결되고 v101 에 대운이 바뀌었다.
      → 이제 앱이 export 하는 엔진을 그대로 불러 쓴다. 진실이 한 곳에만 산다.

   ⚠ App.jsx 를 esbuild 로 번들해 순수 함수를 임포트한다(e2e/mansae-test.mjs 와 같은 방식).
     번들은 `src/` 안에 떨궈야 한다 — App.jsx 가 `./lib/imprint.js` 를 상대경로로 임포트하므로
     app 루트에 떨구면 그 경로가 깨진다(v124.1 에 실제로 통째로 못 돌았다). */
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APPDIR = join(HERE, "..");
const TMP = join(APPDIR, "src", ".personas.tmp.mjs");

let ENG = null;
async function engine() {
  if (ENG) return ENG;
  execSync(`npx esbuild src/App.jsx --format=esm --jsx=automatic --define:import.meta.env={} --outfile=src/${".personas.tmp.mjs"}`,
    { cwd: APPDIR, stdio: ["ignore", "ignore", "inherit"] });
  ENG = await import(TMP + `?t=${process.pid}`);
  try { rmSync(TMP); } catch (_) {}       // 번들은 남기지 않는다 — 커밋 사고의 씨앗이다
  return ENG;
}

/** 가상 생년월일 하나 → 하네스 프로필에 필요한 필드 전부. 전부 앱 엔진 산출이다. */
export async function derive(p, nowY) {
  const E = await engine();
  const b = p.birth, noHour = !!b.noHour;
  const lon = E.cityLon(b.city);
  const s = E.calcSaju(b.y, b.m, b.d, b.h, b.min, noHour, lon);
  const mp = E.moonPlacements(b.y, b.m, b.d, b.h, b.min, noHour);
  const ph = E.moonPhase(b.y, b.m, b.d);
  const zo = E.getZodiac(b.m, b.d);
  const tz = E.tzolkin(Math.floor(E.jdn(b.y, b.m, b.d)));
  const lp = E.lifePath(b.y, b.m, b.d);
  const du = E.daeun(b.y, b.m, b.d, noHour ? 12 : b.h, noHour ? 0 : b.min, noHour, lon, p.sex === "M", nowY);
  const EL = ["목", "화", "토", "금", "수"];
  return {
    id: p.id, name: p.name, sex: p.sex, job: p.job, rel: p.rel, 노림수: p.노림수,
    saju: `${s.pillars.년}년 ${s.pillars.월}월 ${s.pillars.일}일 ${s.pillars.시 === "미상" ? "시 미상" : s.pillars.시 + "시"}`,
    ohaeng: EL.map((e) => `${e}${s.counts[e]}`).join(" "),
    main: s.main,
    nayin: s.nayin,
    zodiac: `${zo.name}(${zo.el})`,
    moon: ph.name,
    moonSign: mp.moonSign,
    nakshatra: mp.nakshatra,
    tzolkin: `${tz.tone}의 톤 · ${tz.sign}`,
    lifepath: String(lp),   // lifePath 는 숫자를 그대로 돌려준다(11·22·33 은 마스터수라 안 줄인다)
    daeun: du.pre
      ? `아직 첫 대운 전(대운수 ${du.num} · ${du.dir})`
      : `${du.ganji}(${du.el}) 대운 · ${du.startAge}~${du.endAge}세 · ${du.dir}`,
  };
}

/** personas.json 을 읽어 전원 조립. nowY 는 대운 구간을 정하므로 **반드시 밖에서 준다** —
    안에서 new Date() 를 부르면 해가 바뀔 때 같은 입력이 다른 표를 낸다. */
export async function loadPersonas(nowY) {
  const raw = JSON.parse(readFileSync(join(HERE, "personas.json"), "utf8"));
  const list = Array.isArray(raw) ? raw : raw.인물;
  if (!Array.isArray(list) || !list.length) throw new Error("personas.json 에 인물 배열이 없다");
  for (const p of list) {
    if (!p.birth || !p.birth.y) throw new Error(`${p.id}: 가상 생년월일이 없다 — 명식을 손으로 적지 않는다`);
    if (p.saju) throw new Error(`${p.id}: 명식이 손으로 적혀 있다. 생년월일만 적고 엔진이 뽑게 둔다`);
  }
  const out = [];
  for (const p of list) out.push(await derive(p, nowY));
  return out;
}
