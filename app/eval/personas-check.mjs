/* 평가 페르소나 검사 — 실행: cd app && node eval/personas-check.mjs
   두 가지를 지킨다.

   ① **실인물이 다시 들어오지 못하게.** v127 까지 이 픽스처엔 창업자의 이름과 사주 네 기둥이
      나란히 적혀 있었다. 사주 네 기둥은 60년 안에서 생년월일시와 일대일이라 그 자체로 사람을
      특정한다 — CLAUDE.md §운영 규칙이 금지하는 형태다. 그래서 **명식을 손으로 적는 것 자체**를 막는다.
   ② **하네스가 앱과 같은 엔진으로 명식을 뽑는가.** 손으로 적은 값은 엔진이 바뀌어도 안 따라와서,
      하네스가 앱과 다른 명식으로 앱을 평가하게 된다.

   ⚠ 이 검사는 "값이 무엇인가"를 못 박지 않는다. 못 박으면 만세력을 고칠 때마다 빨개지고,
     그러면 사람이 검사를 고쳐 맞추게 된다. 대신 **구조와 커버리지**를 본다. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPersonas } from "./build-personas.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = []; const ck = (n, p, g = "") => { R.push(p); console.log(`${p ? "PASS" : "FAIL"} — ${n}${g ? " · " + g : ""}`); };

const raw = readFileSync(join(HERE, "personas.json"), "utf8");
const json = JSON.parse(raw);
const list = Array.isArray(json) ? json : json.인물;

/* ── ① 픽스처에 명식이 손으로 적혀 있지 않은가 ── */
const GANJI = /[갑을병정무기경신임계][자축인묘진사오미신유술해]/;
/* ⚠ 간지 두 글자만으로 잡으면 안 된다 — "한여름 **정오**"의 정+오가 그대로 간지다(실제로 울었다).
   막아야 하는 건 **기둥 표기**(무진년·을묘월·경신일·무인시)이므로 뒤따르는 년/월/일/시까지 본다. */
const PILLAR = /[갑을병정무기경신임계][자축인묘진사오미신유술해]\s*[년월일시]/;
ck("픽스처에 사주 네 기둥이 안 적혀 있다", !PILLAR.test(raw),
   (raw.match(new RegExp(`.{0,20}${PILLAR.source}.{0,20}`)) || [""])[0]);
ck("픽스처에 파생 명식 필드가 없다",
   list.every((p) => !p.saju && !p.ohaeng && !p.nayin && !p.daeun && !p.nakshatra && !p.tzolkin),
   list.filter((p) => p.saju || p.ohaeng || p.nayin || p.daeun).map((p) => p.id).join(",") || "0개");
ck("인물마다 가상 생년월일이 있다", list.every((p) => p.birth && p.birth.y && p.birth.m && p.birth.d));
/* 실인물이 아니라는 걸 기계로 증명할 수는 없다. 대신 **엔진이 뽑았다**는 사실을 증명하고,
   픽스처에 손으로 적을 자리 자체를 없앤 것으로 갈음한다. 위 두 검사가 그 자리를 막는다. */

/* ── ② 엔진으로 실제로 뽑히는가 · 커버리지가 나오는가 ── */
const P = await loadPersonas(2026);
ck("여덟 인물이 다 조립된다", P.length === list.length && P.length >= 8, `${P.length}명`);
ck("전원 사주 네 기둥이 뽑힌다", P.every((p) => GANJI.test(p.saju)), P.find((p) => !GANJI.test(p.saju))?.id || "전부");
ck("전원 대운이 뽑힌다", P.every((p) => p.daeun && p.daeun.length >= 6));
ck("전원 납음·나크샤트라·촐킨이 뽑힌다", P.every((p) => p.nayin && p.nakshatra && p.tzolkin));

const els = new Set(P.map((p) => p.main));
ck("주기운 다섯 오행이 다 나온다", els.size === 5, [...els].join(","));
ck("남녀가 다 있다", new Set(P.map((p) => p.sex)).size === 2);
ck("대운 순행·역행이 다 있다", ["순행", "역행"].every((d) => P.some((p) => p.daeun.includes(d))));
ck("시(時)를 모르는 경우가 하나 있다", P.some((p) => /시 미상/.test(p.saju)),
   P.filter((p) => /시 미상/.test(p.saju)).map((p) => p.id).join(",") || "없음");
ck("입춘 경계(1~2월생)가 하나 있다", list.some((p) => p.birth.m <= 2),
   list.filter((p) => p.birth.m <= 2).map((p) => p.id).join(",") || "없음");
ck("서울 밖 도시가 섞여 있다", new Set(list.map((p) => p.birth.city)).size >= 4,
   `${new Set(list.map((p) => p.birth.city)).size}개 도시`);
/* 사람이 바뀌면 명식도 바뀌어야 한다 — 다 같으면 하네스가 한 사람을 여덟 번 재는 것이다 */
ck("여덟 명식이 서로 다르다", new Set(P.map((p) => p.saju)).size === P.length);

/* ── ③ 하네스가 이 조립기를 실제로 쓰는가(픽스처만 고치고 하네스는 옛 필드를 읽으면 무의미) ── */
{
  const ev = readFileSync(join(HERE, "run-eval.mjs"), "utf8");
  ck("하네스가 조립기를 쓴다", /loadPersonas\(/.test(ev) && /build-personas\.js|build-personas\.mjs/.test(ev));
  ck("하네스에 MBTI 가 안 남아 있다", !/mbti|MBTI/i.test(ev));
  ck("대운 기준 연도를 밖에서 준다(해가 바뀌어도 재현된다)", /--year=/.test(ev));
  /* v129 — 하네스가 **앱이 안 보내는 값**을 프로필에 실으면, 채점이 앱 품질과 무관해진다.
     v128 에 가치여정을 앱에서 통째로 없앴는데 하네스 프로필엔 남아 있었다. */
  ck("앱이 안 보내는 값(가치여정)을 프로필에 안 싣는다", !/가치여정/.test(ev));
  ck("앱이 보내는 삶의 국면(직업·관계)은 싣는다", /요즘 삶의 국면/.test(ev) && list.every((p) => p.job && p.rel));
}

console.log("\n표 —");
for (const p of P) console.log(`  ${p.id} ${p.name}(${p.sex}) 주기운 ${p.main} · ${p.saju} · ${p.daeun}`);

const pass = R.filter(Boolean).length;
console.log(`\n=== 평가 페르소나: ${pass}/${R.length} PASS ===`);
process.exit(pass === R.length ? 0 : 1);
