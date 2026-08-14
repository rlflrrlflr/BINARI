/* 원천 데이터 수집 — 공개 URL에서만 받는다. 저장소에는 코드만 두고 데이터는 받아 쓴다.
   (대법원·네임차트 계열 도메인은 사내/에이전트 환경에서 막히는 경우가 많아, GitHub 미러를 쓴다) */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "../lib/ismain.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));

export const SOURCES = [
  { file: "data-gov.csv",  why: "대법원 인명용 한자 (독음·유니코드·한자)",
    url: "https://raw.githubusercontent.com/rutopio/Korean-Name-Hanja-Charset/main/data-gov.csv" },
  { file: "data-naver.csv", why: "훈음(뜻과 음)",
    url: "https://raw.githubusercontent.com/rutopio/Korean-Name-Hanja-Charset/main/data-naver.csv" },
  { file: "mmah.txt",       why: "부수·구성(IDS)",
    url: "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt" },
  { file: "graphics.txt",   why: "필획(획 하나하나의 좌표 → 개수로 환산)",
    url: "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt" },
  { file: "ids.txt", why: "구성요소(IDS) — makemeahanzi 가 못 담은 글자의 획수 보완용",
    url: "https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt" },
  /* 실사용 통계 — 대법원 전자가족관계등록시스템 '선호하는 출생자 이름 현황' 미러.
     freqAccList 는 누적합이므로 반드시 차분해야 실제 인원이 나온다(그냥 쓰면 전원 200만명대가 된다). */
  { file: "name-m.js", why: "남아 이름별 출생신고 인원 (대법원, 2008~2019 누계)",
    url: "https://raw.githubusercontent.com/randkid/name/master/m.js" },
  { file: "name-f.js", why: "여아 이름별 출생신고 인원 (동일)",
    url: "https://raw.githubusercontent.com/randkid/name/master/f.js" },
];

export async function ensureData(dir = join(HERE, "raw")) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const s of SOURCES) {
    const path = join(dir, s.file);
    if (existsSync(path)) { console.log(`· 있음 ${s.file}`); continue; }
    process.stdout.write(`· 받는 중 ${s.file} … `);
    const r = await fetch(s.url);
    if (!r.ok) throw new Error(`${s.file} 실패 ${r.status} — ${s.url}`);
    writeFileSync(path, Buffer.from(await r.arrayBuffer()));
    console.log("완료");
  }
  return dir;
}
if (isMain(import.meta.url)) await ensureData();
