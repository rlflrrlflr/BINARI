/* 무엇이 이름을 죽이는가 — v01 의 가장 큰 오류를 교정한 자리.
   ────────────────────────────────────────────────────────────
   v01 은 발음오행·81수리 사격을 하드 컷으로 썼다. 그 결과 실제 인기 남아 이름
   상위 30개 중 15개가 죽었고, 살아남은 것은 아무도 쓰지 않는 조합이었다.
   교정: 자를 수 있는 것은 '사실'뿐이고, 유파가 갈리는 지표는 표기만 한다. */

/** HARD — 이건 자른다. 전부 사실 판정이거나 사용자가 직접 정한 규칙이다. */
export const HARD = {
  notRegistered:  "인명용 한자 미등재 — 출생신고 불가",
  noRealUsage:    "출생신고 통계에 안 잡힘 — 들어본 적 없는 이름",
  familyClash:    "부모·형제 함자와 겹침",
  siblingNear:    "형제 이름과 소리가 너무 가까움",
  surnameCompound:"성+첫음절이 단어가 됨 (예: 강도·강시)",
  wordClash:      "두음 치환 시 단어가 됨 (리후→이후, 리온→이온)",
  teasing:        "놀림 소지 (이기·세균 등)",
  badMeaning:     "뜻이 이름에 부적합",
  pureYinYang:    "수리음양 순양·순음",
};

/** FLAG — 이건 표기만 한다. 자를 자격이 없는 이유를 함께 남긴다. */
export const FLAG = {
  baleum:  "발음오행 — 해례본식과 운해식이 정반대로 배속하는 자모가 있어, 한 체계만으로는 판정이 성립하지 않는다",
  sagyeok: "81수리 사격 — 1929년 일본에서 성립한 체계(쿠마사키 켄오). 참고 지표로만 쓴다",
  romaja:  "로마자 표기 — '외국에서 쓸 것'이 요구사항일 때만 적용한다. 상시 조건이 아니다",
  hoek:    "획수 유파 — 원획법(다수설)과 필획법이 갈리면 사격 결과가 뒤집힐 수 있다",
};

/** 성+첫음절 합성어 검사 — 성마다 목록이 다르므로 성별로 정의해 넘긴다. */
export function makeSurnameCompoundCheck(compoundSyllables) {
  const set = new Set(compoundSyllables);
  return (nameFirstSyllable) => set.has(nameFirstSyllable);
}

/** 두음 치환 검사 — ㄹ 초성을 ㅇ으로 바꿔 단어가 되는지 본다.
    (실사용 검증에서 리건→이건, 리후→이후, 리온→이온을 잡아낸 검사) */
export function duEumSubstitute(syllable) {
  const code = syllable.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return null;
  const cho = Math.floor(code / 588);
  if (cho !== 5) return null;                 // ㄹ 초성이 아니면 해당 없음
  return String.fromCharCode(0xAC00 + 11 * 588 + (code % 588));   // ㄹ → ㅇ
}

/** 판정 결과 하나 — 통과 여부와 이유를 항상 함께 들고 다닌다. */
export function verdict({ hardHits = [], flags = [] }) {
  return { pass: hardHits.length === 0, hardHits, flags };
}

/* ── 뜻 검사 ────────────────────────────────────────────────
   인명용에 등재돼 있다고 이름에 쓸 수 있는 건 아니다. 鈦(티타늄)·瑕(허물)·鱒(송어)·砥(숫돌)은
   전부 등재 글자지만 이름자가 아니다. 등재 여부와 이름 적합성은 별개다. */
const MEANING_BAD = [
  "진흙","눈물","음란","음탕","망할","빠질","막힐","갈라","뒤섞","어두","잃","도둑","헐","흉","슬픔","거품","뜨물",
  "오줌","썩","늪","젖을","담글","쌀 일","끓을","병","더러","천할","게으","미칠","괴이","허물","재앙","근심","성낼",
  "훔칠","속일","무너","쇠할","어리석","좁을","빚","가난","잠길","샐","마를","얕을","흐릴","탐할","아첨","번거","시끄",
  "죽","주검","꾸짖","무덤","귀신","벌레","오랑캐","첩","노비","늙을","앓","아플","괴로","원망","다툴","싸울","해칠",
  "나쁠","악할","간사","거짓","구걸","더딜","끊을","찌를","때릴","칼","형벌","깎을","이길","팔 ","문서","찰 ","골몰",
  "가를","희롱","찌꺼기","앙금","술 취","송어","숫돌","티타늄","유황","연유","돼지","개 ","암컷","수컷","짐승","벨 ",
];
/* 이름에 쓰기 좋은 뜻 — 화이트리스트. 블랙리스트만으로는 '송어'류가 계속 새어 나온다. */
const MEANING_GOOD = [
  "클","맑을","밝","빛","옥","구슬","보배","아름","넓을","깊을","바다","물","강","샘","시내","비 ","구름","하늘",
  "이를","도울","기쁠","착할","어질","온화","따뜻","편안","굳","귀할","성할","빼어","뛰어","높을","길할","복",
  "상서","기릴","다스릴","이로울","슬기","지혜","총명","재주","기록","믿을","참","곧을","바를","이룰","윤택",
  "불을","나루","화할","즐거","자랄","무성","은혜","법","본받","나라","물가","별","해 돋","빛날","이을","봄",
];
/* 이름 전용자 — 훈이 '사람 이름 X' 하나뿐인 글자.
   화이트리스트에 걸리는 뜻이 없다고 자르면 **작명용으로 만들어진 글자가 통째로 사라진다**
   (실측: 瑥(사람 이름 온)이 탈락했다). 인명용에 이 훈으로 등재됐다는 것 자체가 적합 근거다. */
const NAME_GLOSS = /사람\s*이름|^이름\s/;

/* 사전이 훈을 하나만 싣는 바람에 오탐이 나는 글자 — 근거를 적고 명시적으로 통과시킨다.
   이 목록은 "예쁜 글자 봐주기"가 아니라 **사전 결손 보정**이다. 늘릴 때 반드시 이유를 남길 것.
   利 — 표준 훈은 '이로울/날카로울' 둘인데 수집 사전엔 '날카로울'만 실려 있다.
        국내 남아 이름에 가장 많이 쓰이는 글자 축에 들어, 이걸 자르면 후보 상당수가 통째로 사라진다. */
const MEANING_ALLOW = new Map([["利", "표준 훈 '이로울'이 사전에 누락 — 날카로울만 수록"]]);

/* 훈음에서 '훈'(뜻) 부분만 떼낸다. "복어 태" → "복어" / "다스릴 리(이)" → "다스릴" */
function hunOf(meaning) {
  return meaning.split(/[\/,]/).map(seg => seg.trim().replace(/\([^)]*\)/g, "").trim())
    .map(seg => { const t = seg.split(/\s+/); return t.length > 1 ? t.slice(0, -1).join(" ") : seg; });
}
/** 이름자로 쓸 만한 뜻인가.
    ⚠️ 부분문자열로 보면 오탐한다 — "복어"가 "복"에, "물미"가 "물"에 걸린다(실제로 鮐(복어 태)·鐏(창 물미 준)이 통과했다).
    그래서 훈을 토큰으로 끊고 **토큰 단위로** 대조한다. */
export function meaningOK(meaning, mode = "strict", char = null) {
  if (!meaning) return false;
  if (char && MEANING_ALLOW.has(char)) return true;          // 사전 결손 보정 — 블랙리스트보다 앞선다
  if (MEANING_BAD.some(w => meaning.includes(w))) return false;
  if (NAME_GLOSS.test(meaning)) return true;                 // 이름 전용자
  if (mode === "loose") return true;
  const huns = hunOf(meaning);
  const PREFIX_OK = ["옥","구슬","보배","빛","물","강","해","별","하늘","바다"];   // 명사 접두 결합 허용
  return huns.some(h => MEANING_GOOD.some(w =>
    h === w || h.startsWith(w + " ") || h.endsWith(" " + w) || h === w + "할" || h === w + "을" ||
    (PREFIX_OK.includes(w) && h.startsWith(w) && h.length <= w.length + 2)));
}

/* ── 훈음의 독음이 실제로 그 음인가 ──────────────────────────
   대법원 목록은 한 글자를 여러 독음 아래 중복 수록한다. 그래서 '태'로 검색하면
   珆(옥돌 이)처럼 **주 독음이 다른 글자**가 딸려 온다. 그런 글자를 이름에 쓰면
   사람들은 그 음으로 읽지 않는다. 훈음 끝의 독음과 대조해 거른다.
   예) "다스릴 리(이)" → 리·이 둘 다 인정 / "옥돌 이" → '태'로는 불인정 */
export function readingMatches(meaning, reading) {
  if (!meaning) return false;
  const found = new Set();
  for (const m of meaning.matchAll(/([가-힣])(?=\s*(?:\/|\(|$|,))/g)) found.add(m[1]);
  for (const m of meaning.matchAll(/\(([가-힣])\)/g)) found.add(m[1]);
  const tail = meaning.trim().split(/[\s/]+/).pop().replace(/[()]/g, "");
  for (const ch of tail) if (/[가-힣]/.test(ch)) found.add(ch);
  return found.has(reading);
}
