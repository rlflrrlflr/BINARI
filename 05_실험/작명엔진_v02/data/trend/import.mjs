/* 아무 형식이나 받아서 data/trend/<연도>.csv 로 정규화한다.
   대법원 통계 페이지에서 받은 것을 그대로 던져도 되게 만드는 게 목적.

   사용:
     node data/trend/import.mjs 2024 받은파일.csv
     node data/trend/import.mjs 2024 받은파일.xlsx.csv --gender=m
     cat 붙여넣기.txt | node data/trend/import.mjs 2024 -

   받아들이는 것:
     · 쉼표/탭/여러 칸 구분
     · 헤더 있든 없든
     · 열 순서 아무거나 (이름·성별·인원을 값 모양으로 알아낸다)
     · 성별이 남/여, M/F, m/f, 남자/여자
     · 인원에 1,234 처럼 쉼표가 들어간 것
     · 순위 열이 섞여 있어도 무시
*/
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "../../lib/ismain.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));

const NAME_RE   = /^[가-힣]{2,4}$/;
const GENDER_M  = new Set(["m","M","남","남자","남아","male","MALE"]);
const GENDER_F  = new Set(["f","F","여","여자","여아","female","FEMALE"]);
const num = (s) => { const t = String(s).replace(/[,\s명]/g, ""); return /^\d+$/.test(t) ? +t : null; };

export function parseLoose(text, defaultGender = null) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    /* 천단위 쉼표(2,431)를 셀 구분자로 오해하지 않도록 먼저 보호한다.
       이 한 줄이 없으면 2,431 이 [2, 431] 로 쪼개져 인원이 431 로 들어간다. */
    const guarded = line.replace(/(\d),(?=\d{3}(\D|$))/g, "$1\u0000");
    const cells = guarded.split(/[\t,;]|\s{2,}/).flatMap(c => c.split(/\s+/))
      .map(s => s.replace(/\u0000/g, "").trim()).filter(Boolean);
    if (cells.length < 2) continue;

    let name = null, gender = defaultGender, count = null;
    const nums = [];
    for (const c of cells) {
      if (!name && NAME_RE.test(c) && !GENDER_M.has(c) && !GENDER_F.has(c)) { name = c; continue; }
      if (GENDER_M.has(c)) { gender = "m"; continue; }
      if (GENDER_F.has(c)) { gender = "f"; continue; }
      const n = num(c); if (n != null) nums.push(n);
    }
    if (!name || !gender) continue;
    /* 숫자가 둘이면 보통 [순위, 인원] — 큰 쪽이 인원이다 */
    count = nums.length === 0 ? null : nums.length === 1 ? nums[0] : Math.max(...nums);
    if (count == null) continue;
    rows.push({ name, gender, count });
  }
  return rows;
}

if (isMain(import.meta.url)) {
  const [year, file, ...rest] = process.argv.slice(2);
  if (!year || !file) { console.error("사용: node data/trend/import.mjs <연도> <파일|-> [--gender=m|f]"); process.exit(1); }
  const gArg = rest.find(a => a.startsWith("--gender="));
  const text = file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8");
  const rows = parseLoose(text, gArg ? gArg.split("=")[1] : null);
  if (!rows.length) {
    console.error("읽어낸 행이 없습니다. 이름(한글 2~4자)·인원 숫자가 같은 줄에 있어야 합니다.");
    console.error("성별 열이 없으면 --gender=m 또는 --gender=f 를 붙이세요."); process.exit(1);
  }
  const out = join(HERE, `${year}.csv`);
  const merged = new Map();
  if (existsSync(out)) for (const l of readFileSync(out,"utf8").trim().split("\n").slice(1)) {
    const [n,g,c] = l.split(","); if (n) merged.set(`${g}:${n}`, +c);
  }
  for (const r of rows) merged.set(`${r.gender}:${r.name}`, r.count);
  const lines = ["name,gender,count", ...[...merged.entries()]
    .map(([k,v]) => { const [g,n] = k.split(":"); return [n,g,v]; })
    .sort((a,b) => b[2]-a[2]).map(r => r.join(","))];
  writeFileSync(out, lines.join("\n") + "\n");
  const m = rows.filter(r=>r.gender==="m").length, f = rows.length - m;
  console.log(`${year}.csv 저장 — 이번 입력 ${rows.length}행(남 ${m}·여 ${f}) · 파일 누적 ${merged.size}행`);
  console.log(`상위 5: ${lines.slice(1,6).map(l=>{const[n,g,c]=l.split(",");return `${n}(${g}) ${(+c).toLocaleString()}`}).join(" · ")}`);
}
