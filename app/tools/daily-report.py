#!/usr/bin/env python3
"""비나리 데일리 리포트 — PostHog에서 전일 지표를 뽑아 디스코드로 보낸다.

GitHub Actions(.github/workflows/daily-report.yml)가 매일 아침 자동 실행한다.
맥을 켜둘 필요도, Zapier 같은 중계 서비스도, 유료 플랜도 필요 없다.
표준 라이브러리만 쓰므로 pip 설치가 없다.

필요한 값 3개 — GitHub 저장소 Settings > Secrets and variables > Actions 에 넣는다.
    POSTHOG_API_KEY       PostHog > Settings > Personal API keys (query:read 권한)
    POSTHOG_PROJECT_ID    526669
    DISCORD_WEBHOOK_URL   디스코드 채널 편집 > 연동 > 웹후크 에서 복사한 주소
로컬에서 돌릴 때는 ~/.binari-report.env 에 같은 이름으로 넣어도 된다(git 에 올리지 말 것).

사용:
    python3 daily-report.py           # 전일 리포트를 디스코드로 발송
    python3 daily-report.py --dry     # 발송 없이 화면에만 출력(연결 점검용)
"""
import datetime
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ENV_PATH = Path.home() / ".binari-report.env"
PH_HOST = "https://us.posthog.com"
KEYS = ("POSTHOG_API_KEY", "POSTHOG_PROJECT_ID", "DISCORD_WEBHOOK_URL")


def load_env():
    """환경변수 우선, 없으면 ~/.binari-report.env 에서 읽는다."""
    cfg = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in KEYS:
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


# ⚠️ 이 줄을 지우지 말 것. urllib 의 기본 User-Agent("Python-urllib/3.x")로 디스코드에 붙으면
#    Cloudflare 가 "브라우저 서명 차단"으로 막는다(HTTP 403 · error code 1010).
#    2026-07-28 첫 발송이 이 이유로 실패했다. 디스코드 API 문서가 요구하는 형식으로 자신을 밝힌다.
USER_AGENT = "DiscordBot (https://binari-sepia.vercel.app, 1.0)"


def post_json(url, payload, headers=None, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        **(headers or {}),
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read().decode("utf-8")
        return json.loads(body) if body.strip() else {}


def hogql(cfg, query):
    """PostHog Query API로 HogQL 실행 → 행 리스트."""
    url = f"{PH_HOST}/api/projects/{cfg['POSTHOG_PROJECT_ID']}/query/"
    out = post_json(url, {"query": {"kind": "HogQLQuery", "query": query}},
                    {"Authorization": f"Bearer {cfg['POSTHOG_API_KEY']}"})
    return out.get("results", [])


# ── 지표 ─────────────────────────────────────────────────────────────────────
# 내부(팀·지인) 트래픽을 항상 따로 센다. 섞어서 보면 게이트 판정이 무력화된다.
#
# ⚠️ 날짜 기준 — 모든 쿼리가 '한국 날짜로 어제 하루'만 본다. 하나라도 다른 창을 쓰면
#    요약과 상세가 어긋난다(2026-07-28: 요약은 오늘 26건, 방향은 어제 7건이 나가 합이 안 맞았다).
#    PostHog 프로젝트 시간대가 UTC 라서 today() 를 그냥 쓰면 아침 8시(KST)에 받는
#    '어제'와 하루가 밀린다. 그래서 +9시간 해서 한국 날짜로 자른다.
KST_YDAY = ("toDate(timestamp + INTERVAL 9 HOUR) = toDate(now() + INTERVAL 9 HOUR) - 1")
Q_DAILY = """
SELECT
    toDate(timestamp + INTERVAL 9 HOUR)                 AS d,
    uniqIf(person_id, properties.is_internal != true)   AS people,
    uniqIf(person_id, properties.is_internal = true)    AS internal_people,
    countIf(event = 'app_open')                         AS visits,
    countIf(event = 'onboard_start')                    AS ob_start,
    countIf(event = 'guardian_awaken')                  AS ob_done,
    countIf(event = 'question_asked')                   AS asked,
    countIf(event = 'verdict_shown')                    AS verdicts,
    countIf(event = 'verdict_failed')                   AS failed,
    countIf(event = 'verdict_rated')                    AS rated,
    countIf(event = 'letter_clicked')                   AS letter,
    countIf(event = 'letter_intent_confirmed')          AS letter_yes,
    countIf(event = 'verdict_shared')                   AS shared
FROM events
WHERE timestamp >= now() - INTERVAL 5 DAY AND event NOT LIKE '$%'
GROUP BY d
HAVING d <= toDate(now() + INTERVAL 9 HOUR) - 1   -- 진행 중인 오늘은 뺀다
ORDER BY d DESC LIMIT 2
"""

Q_DIR = """
SELECT properties.dir AS dir, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND """ + KST_YDAY + """ AND event = 'verdict_shown'
GROUP BY dir ORDER BY n DESC
"""

# 실패는 원인을 알아야 손을 쓴다. rate_limited 면 RL_MAX, origin_blocked 면 허용목록 문제다.
Q_FAIL = """
SELECT properties.reason AS reason, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND """ + KST_YDAY + """ AND event = 'verdict_failed'
GROUP BY reason ORDER BY n DESC
"""

# 온보딩에서 어느 화면이 사람을 가장 많이 잃는가
Q_ONBOARD = """
SELECT properties.step AS step, uniq(person_id) AS u
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND """ + KST_YDAY + """ AND event = 'onboard_step'
GROUP BY step ORDER BY u DESC
"""

STEP_KO = {
    "name": "이름", "birth_date": "생년월일", "birth_time_city": "태어난 시·도시",
    "sex": "성별", "context": "직업·관계", "mbti": "MBTI",
    "values_16to6": "가치 16→6", "values_6to3": "가치 6→3", "values_3to1": "가치 3→1",
}
FAIL_KO = {
    "rate_limited": "호출 한도 초과", "upstream_error": "AI 서버 장애",
    "parse_failed": "응답 형식 오류", "origin_blocked": "허용되지 않은 주소",
    "bad_request": "잘못된 요청", "network": "네트워크",
}


# ══════════════════════════════════════════════════════════════════════════════
#  ★ 말투 — 리포트에 나가는 문장은 전부 여기 있다. 이 블록만 고치면 말투가 바뀐다.
#
#  고치는 법
#    · 따옴표 " " 안의 한국어만 바꾼다.
#    · {중괄호} 안의 이름은 숫자가 들어갈 자리다. 이름은 그대로 두고 위치만 옮긴다.
#      예) "질문 {질문}건 전부 정상입니다" → "물음 {질문}개 다 잘 나갔어요"
#    · 줄 맨 앞의 이름(총평_정상 등)과 콜론(:) 은 건드리지 않는다.
#    · 아예 빼고 싶은 문장은 "" 로 비우면 그 줄이 나가지 않는다.
# ══════════════════════════════════════════════════════════════════════════════
MSG = {
    # ── 머리말 ──
    "제목":        "비나리 데일리 리포트",
    "인사":        "{날짜}",                 # 날짜+요일만. 다른 말은 넣지 않기로 함(2026-07-28 결정)

    # ── 총평: 넷 중 하나만 나간다 ──
    "총평_정상":    "질문 {질문}건 전부 판결까지 잘 나갔습니다. 문제 없습니다.",
    "총평_실패":    "질문 {질문}건 중 {실패}건이 판결까지 못 갔습니다. 확인이 필요합니다.",
    "총평_유입없음": "어제는 질문이 하나도 없었습니다. 사람이 안 들어온 건지 봐야 합니다.",
    "총평_내부만":  "문제는 없지만 어제 쓴 사람이 전부 우리 쪽이라, 이 숫자로 제품을 판단하면 안 됩니다.",

    # ── 데이터 요약 블록의 각 줄 ──
    "숫자_사람":    "외부 {외부}명{외부증감}",
    "숫자_내부":    " · 내부 {내부}명(제외)",
    "숫자_방문":    "방문 {방문}회{방문증감}{일인당}",
    "숫자_일인당":  " · 1인 {일인당}회",
    "숫자_온보딩":  "온보딩 {시작} → {완주} 완주 {완주율}",
    "숫자_판결":    "질문 {질문} → 판결 {판결}{판결증감}",
    "숫자_실패":    " · 실패 {실패}",
    "숫자_방향":    "GO {GO} · HOLD {HOLD}({HOLD비율}) · STOP {STOP}",
    "숫자_반응":    "평가 {평가}건 {평가율} · 서신 {서신}건 {서신클릭률}",
    "숫자_받을게":  " → 받을게 {받을게}건",
    "숫자_공유":    " · 공유 {공유}건",

    # ── 코멘트: 해당하는 것만 • 로 붙는다 ──
    "말_실패원인":  "실패 이유는 {원인}입니다. 그만큼 사람들이 답을 못 받고 나갔다는 뜻이라 제일 먼저 봐야 합니다.",
    "말_이탈지점":  "{화면} 화면에서 {인원}명이 빠져나갔습니다. 어제 사람을 가장 많이 잃은 곳입니다. 이 화면을 줄이거나 순서를 바꾸는 걸 생각해볼 만합니다.",
    "말_STOP없음":  "어제 'STOP(하지 마)' 판결이 하나도 없었습니다. 망설일 때 딱 잘라 말해주는 게 비나리인데, 정작 말리는 법이 없는 셈입니다. 데이터가 좀 더 쌓이면 판결 기준을 손볼지 정해야 합니다.",
    "말_서신유보":  "서신은 아직 눌린 횟수가 적어 돈 낼 사람이 있는지 판단하기 이릅니다. 계속 지켜보겠습니다.",
    "말_서신판정":  "서신이 300번 넘게 노출됐습니다. 이제 돈 낼 사람이 있는지 판단할 수 있는 시점입니다.",

    # ── 예외 ──
    "데이터없음":   "어제 데이터를 못 가져왔습니다. 앱이 살아있는지, 기록이 붙어있는지 봐야 합니다.",
    "연결확인":     "비나리 연결 확인 — 이 메시지가 보이면 디스코드 발송은 정상입니다.",
}


def say(key, **kw):
    """MSG 에서 문장을 꺼내 숫자를 채운다. 빈 문자열이면 그 줄은 나가지 않는다."""
    tpl = MSG.get(key, "")
    if not tpl:
        return ""
    try:
        return tpl.format(**kw)
    except (KeyError, IndexError):
        # 사용자가 {중괄호} 이름을 잘못 고쳐도 리포트 전체가 죽지 않게 원문을 그대로 내보낸다
        return tpl


def kdate(v):
    """2026-07-28 → 7/28(화). 매일 보는 리포트라 연도는 빼고 요일을 붙인다."""
    s = str(v)[:10]
    try:
        d = datetime.date(*(int(x) for x in s.split("-")))
        return f"{d.month}/{d.day}({'월화수목금토일'[d.weekday()]})"
    except Exception:
        return s                                   # 형식이 예상과 다르면 원본을 그대로 쓴다


def pct(a, b):
    return f"{round(a / b * 100)}%" if b else "—"


def delta(now, prev):
    if prev is None:
        return ""
    diff = now - prev
    return " (—)" if diff == 0 else f" ({'+' if diff > 0 else ''}{diff})"


def build_report(cfg):
    """사내 데일리 리포트 양식을 따른다(#project-모니모·#soomgo 채널 관행).

    표가 아니라 서술이다. 순서가 곧 형식이다:
      제목 → "전일 자 ~ 공유드립니다!" → 이슈 유무 판단 → 항목별 [현상+해석+조치] → 참고 불릿
    숫자만 나열하지 않고 항상 "그래서 무엇을 할 것인가"로 문단을 닫는다.
    """
    rows = hogql(cfg, Q_DAILY)
    if not rows:
        return MSG["제목"] + "\n" + MSG["데이터없음"]

    keys = ["d", "people", "internal_people", "visits", "ob_start", "ob_done",
            "asked", "verdicts", "failed", "rated", "letter", "letter_yes", "shared"]
    t = dict(zip(keys, rows[0]))
    p = dict(zip(keys, rows[1])) if len(rows) > 1 else {}

    L = [MSG["제목"], say("인사", 날짜=kdate(t["d"]))]

    # ── 총평: 이슈 유무를 한 문장으로 먼저 알린다 ──
    if t["failed"]:
        L.append(say("총평_실패", 질문=t["asked"], 실패=t["failed"]))
    elif t["asked"] == 0:
        L.append(say("총평_유입없음"))
    elif t["people"] == 0 and t["internal_people"]:
        L.append(say("총평_내부만"))
    else:
        L.append(say("총평_정상", 질문=t["asked"]))

    # ── 데이터 요약: 숫자는 여기 몰아넣는다 ──
    dirs = {str(r[0]): r[1] for r in hogql(cfg, Q_DIR)} if t["verdicts"] else {}
    tv = sum(dirs.values()) or t["verdicts"]
    go, hold, stop = dirs.get("GO", 0), dirs.get("HOLD", 0), dirs.get("STOP", 0)
    per = say("숫자_일인당", 일인당=round(t["visits"] / t["people"], 1)) if t["people"] else ""

    D = ["```",
         say("숫자_사람", 외부=t["people"], 외부증감=delta(t["people"], p.get("people")))
         + (say("숫자_내부", 내부=t["internal_people"]) if t["internal_people"] else ""),
         say("숫자_방문", 방문=t["visits"], 방문증감=delta(t["visits"], p.get("visits")), 일인당=per)]
    if t["ob_start"]:
        D.append(say("숫자_온보딩", 시작=t["ob_start"], 완주=t["ob_done"],
                     완주율=pct(t["ob_done"], t["ob_start"])))
    D.append(say("숫자_판결", 질문=t["asked"], 판결=t["verdicts"],
                 판결증감=delta(t["verdicts"], p.get("verdicts")))
             + (say("숫자_실패", 실패=t["failed"]) if t["failed"] else ""))
    if t["verdicts"]:
        D += [say("숫자_방향", GO=go, HOLD=hold, HOLD비율=pct(hold, tv), STOP=stop),
              say("숫자_반응", 평가=t["rated"], 평가율=pct(t["rated"], t["verdicts"]),
                  서신=t["letter"], 서신클릭률=pct(t["letter"], t["verdicts"]))
              + (say("숫자_받을게", 받을게=t["letter_yes"]) if t["letter"] else "")
              + (say("숫자_공유", 공유=t["shared"]) if t["shared"] else "")]
    D.append("```")
    L += [""] + [d for d in D if d]

    # ── 코멘트: 숫자 반복 없이 '무엇을 할 것인가'만 ──
    notes = []
    if t["failed"]:
        fails = hogql(cfg, Q_FAIL)
        cause = " · ".join(f"{FAIL_KO.get(str(r[0]), str(r[0]))} {r[1]}건" for r in fails) if fails else "원인 미분류"
        notes.append(say("말_실패원인", 원인=cause))

    if t["ob_start"]:
        ob = [(str(r[0]), r[1]) for r in hogql(cfg, Q_ONBOARD)]
        worst, drop = None, 0
        for i in range(1, len(ob)):
            d = ob[i - 1][1] - ob[i][1]
            if d > drop:
                worst, drop = ob[i][0], d
        if worst:
            notes.append(say("말_이탈지점", 화면=STEP_KO.get(worst, worst), 인원=drop))

    if t["verdicts"] and stop == 0 and tv >= 5:
        notes.append(say("말_STOP없음"))

    if t["letter"]:
        notes.append(say("말_서신유보") if t["verdicts"] < 300 else say("말_서신판정"))

    notes = [n for n in notes if n]

    if notes:
        L += [""] + [f"• {n}" for n in notes]

    return "\n".join(L)


def send_discord(cfg, text):
    # 디스코드 메시지 상한 2000자. 넘치면 잘라 보낸다(리포트를 통째로 잃는 것보다 낫다).
    if len(text) > 1900:
        text = text[:1890] + "\n…(생략)"
    post_json(cfg["DISCORD_WEBHOOK_URL"], {"content": text, "allowed_mentions": {"parse": []}})


def discord_error(e):
    """실패했을 때 무엇을 손봐야 하는지까지 알려준다. 코드만 뱉으면 다음 사람이 또 헤맨다."""
    body = e.read().decode("utf-8", "ignore")[:200]
    if e.code == 403 and "1010" in body:
        hint = ("Cloudflare 가 요청을 막았습니다(브라우저 서명 차단). "
                "User-Agent 헤더가 빠졌거나 기본값(Python-urllib)일 때 발생합니다 — USER_AGENT 상수를 확인하세요.")
    elif e.code in (401, 403):
        hint = "웹훅 주소가 만료·삭제되었을 수 있습니다. 디스코드 채널 편집 > 연동 > 웹후크에서 재발급하세요."
    elif e.code == 404:
        hint = "웹훅이 존재하지 않습니다. 주소를 다시 확인하세요."
    elif e.code == 429:
        hint = "디스코드 호출 한도입니다. 잠시 후 재실행하세요."
    else:
        hint = "디스코드 응답을 확인하세요."
    return f"디스코드 발송 실패 ({e.code}): {body}\n→ {hint}"


def main():
    args = sys.argv[1:]
    cfg = load_env()
    dry, ping = "--dry" in args, "--ping" in args

    # --ping: PostHog 없이 디스코드 연결만 시험한다. 실패 시 원인이 어느 쪽인지 바로 갈린다.
    if ping:
        if not cfg.get("DISCORD_WEBHOOK_URL"):
            sys.exit("설정 누락: DISCORD_WEBHOOK_URL")
        try:
            send_discord(cfg, MSG["연결확인"])
            print("연결 확인 완료 — 디스코드로 시험 메시지를 보냈습니다.")
        except urllib.error.HTTPError as e:
            sys.exit(discord_error(e))
        return

    need = ["POSTHOG_API_KEY", "POSTHOG_PROJECT_ID"] + ([] if dry else ["DISCORD_WEBHOOK_URL"])
    missing = [k for k in need if not cfg.get(k)]
    if missing:
        sys.exit(f"설정 누락: {', '.join(missing)}")

    try:
        report = build_report(cfg)
    except urllib.error.HTTPError as e:
        sys.exit(f"PostHog 조회 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}\n"
                 "→ POSTHOG_API_KEY 가 Personal API key(query:read 권한)인지, "
                 "POSTHOG_PROJECT_ID 가 526669 인지 확인하세요.")

    if dry:
        print(report)
        return

    try:
        send_discord(cfg, report)
        print("발송 완료")
    except urllib.error.HTTPError as e:
        sys.exit(discord_error(e))


if __name__ == "__main__":
    main()
