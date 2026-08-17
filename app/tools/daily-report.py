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
KEYS = ("POSTHOG_API_KEY", "POSTHOG_PROJECT_ID", "DISCORD_WEBHOOK_URL",
        "GITHUB_TOKEN", "GITHUB_REPO")   # 뒤 둘은 선택 — 없으면 변경 안내만 빠진다


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
# 모든 제품 지표는 외부(실유저)만 센다. 내부는 맨 아래 한 줄로 따로 알린다.
#   2026-07-28 사고: 사람 수만 내부를 빼고 나머지(방문·질문·판결·평가·서신)는 합산이라
#   '내부 6명(제외)' 라고 써놓고 판결 26건 중 19건이 내부였다. 라벨이 거짓말을 했다.
#
# ⚠ **이중 필터** (2026-08-16 실측 반전 · 작업배분 §6-1 1번)
#   is_internal 플래그만 걸면 부족하다. 플래그가 배포된 건 7/25 19:13(bc54a82)인데
#   그 전에 유입된 내부 헤비유저 2인(666·614이벤트)은 플래그를 영영 못 받는다.
#   그 둘이 외부로 집계되는 바람에 8/15 전략 문서가 공유율 5%·k≈0.14 를 유저 신호로 실었고,
#   8/16 에 뒤집혔다 — **이중 필터로 보면 외부 공유 발신은 0건이다.**
#   소급 식별은 코호트 436757("계측 분리 이전 내부")이 맡는다. 게이트 대시보드 4종도 같은 코호트를 뺀다.
#   → 여기 EXT 하나만 고치면 아래 네 질의가 전부 같은 정의를 쓴다. 손으로 두 조건을 기억하지 않는다.
INTERNAL_COHORT = 436757
EXT = f"properties.is_internal != true AND person_id NOT IN COHORT {INTERNAL_COHORT}"
# 내부 쪽 줄(맨 아래 '위 숫자에서 내부 N명은 뺐습니다')은 EXT 의 여집합이어야 한다.
# 플래그만 보면 코호트 내부인이 어느 쪽에도 안 세어져 합이 안 맞는다.
INT = f"(properties.is_internal = true OR person_id IN COHORT {INTERNAL_COHORT})"

Q_DAILY = f"""
SELECT
    toDate(timestamp + INTERVAL 9 HOUR)                                 AS d,
    uniqIf(person_id, {EXT})                                            AS people,
    countIf(event = 'app_open' AND {EXT})                               AS visits,
    countIf(event = 'onboard_start' AND {EXT})                          AS ob_start,
    countIf(event = 'guardian_awaken' AND {EXT})                        AS ob_done,
    countIf(event = 'question_asked' AND {EXT})                         AS asked,
    countIf(event = 'verdict_shown' AND {EXT})                          AS verdicts,
    countIf(event = 'verdict_failed' AND {EXT})                         AS failed,
    countIf(event = 'verdict_rated' AND {EXT})                          AS rated,
    countIf(event = 'letter_clicked' AND {EXT})                         AS letter,
    countIf(event = 'letter_intent_confirmed' AND {EXT})                AS letter_yes,
    countIf(event = 'letter_written' AND {EXT})                         AS letter_made,
    countIf(event LIKE 'letter_%failed' AND {EXT})                      AS letter_err,
    countIf(event = 'imprint_clicked' AND {EXT})                        AS imprint,
    countIf(event = 'imprint_opened' AND {EXT})                         AS imprint_open,
    -- 각인·궁합은 '열었나'가 아니라 '읽었나'가 값어치의 지표다(스크롤 최대 도달률의 평균)
    round(avgIf(toInt(coalesce(properties.read_pct, 0)),
                event = 'imprint_read' AND {EXT}))                      AS imprint_read,
    countIf(event = 'match_clicked' AND {EXT})                          AS match_c,
    countIf(event = 'match_run' AND {EXT})                              AS match_run,
    countIf(event = 'match_again' AND {EXT})                            AS match_again,
    round(avgIf(toInt(coalesce(properties.read_pct, 0)),
                event = 'match_read' AND {EXT}))                        AS match_read,
    countIf(event IN ('imprint_failed','match_failed') AND {EXT})       AS doc_err,
    countIf(event = 'verdict_shared' AND {EXT})                         AS shared,
    -- 공유는 '보낸 것'과 '그래서 들어온 것'이 다르다. 분자가 없으면 바이럴 계수를 못 낸다.
    countIf(event = 'shared_verdict_view' AND {EXT})                    AS share_in,
    -- 원가: 유료 상품을 파는 이상 마진을 매일 봐야 한다
    sumIf(toInt(coalesce(properties.tok_in, 0)) + toInt(coalesce(properties.tok_out, 0)),
          event IN ('verdict_shown','detail_shown','letter_written') AND {EXT})  AS tokens,
    uniqIf(person_id, {INT})                                            AS in_people,
    countIf(event = 'verdict_shown' AND {INT})                          AS in_verdicts
FROM events
WHERE timestamp >= now() - INTERVAL 5 DAY AND event NOT LIKE '$%'
GROUP BY d
HAVING d <= toDate(now() + INTERVAL 9 HOUR) - 1   -- 진행 중인 오늘은 뺀다
ORDER BY d DESC LIMIT 2
"""

Q_DIR = """
SELECT properties.dir AS dir, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND """ + KST_YDAY + """ AND event = 'verdict_shown' AND """ + EXT + """
GROUP BY dir ORDER BY n DESC
"""

# 실패는 원인을 알아야 손을 쓴다. rate_limited 면 RL_MAX, origin_blocked 면 허용목록 문제다.
Q_FAIL = """
SELECT properties.reason AS reason, count() AS n
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND """ + KST_YDAY + """ AND event = 'verdict_failed' AND """ + EXT + """
GROUP BY reason ORDER BY n DESC
"""

# 온보딩에서 어느 화면이 사람을 가장 많이 잃는가
Q_ONBOARD = """
SELECT properties.step AS step, uniq(person_id) AS u
FROM events
WHERE timestamp >= now() - INTERVAL 3 DAY AND """ + KST_YDAY + """ AND event = 'onboard_step' AND """ + EXT + """
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
    "제목":        "비나리 데일리 리포트 - {날짜}",   # 날짜+요일만. 다른 말은 넣지 않기로 함(2026-07-28 결정)

    # ── 총평: 넷 중 하나만 나간다 ──
    "총평_정상":    "질문 {질문}건 전부 판결까지 잘 나갔습니다. 문제 없습니다.",
    "총평_실패":    "질문 {질문}건 중 {실패}건이 판결까지 못 갔습니다. 확인이 필요합니다.",
    "총평_유입없음": "어제는 질문이 하나도 없었습니다. 사람이 안 들어온 건지 봐야 합니다.",
    "총평_내부만":  "어제 외부 사용자 활동이 없었습니다. 아래 숫자는 전부 0입니다.",

    # ── 데이터 요약 블록의 각 줄 ──
    "숫자_사람":    "사용자 {외부}명{외부증감}",
    "숫자_내부":    "위 숫자에서 내부(팀) {내부}명 · 판결 {내부판결}건은 뺐습니다",
    "숫자_방문":    "방문 {방문}회{방문증감}{일인당}",
    "숫자_일인당":  " · 1인 {일인당}회",
    "숫자_온보딩":  "온보딩 {시작} → {완주} 완주 {완주율}",
    "숫자_판결":    "질문 {질문} → 판결 {판결}{판결증감}",
    "숫자_실패":    " · 실패 {실패}",
    "숫자_방향":    "GO {GO} · HOLD {HOLD}({HOLD비율}) · STOP {STOP}",
    "숫자_반응":    "평가 {평가}건 {평가율}",
    "숫자_받을게":  " → 받을게 {받을게}건",
    "숫자_공유유입": "공유 {보냄}건 → 그걸로 들어온 사람 {들어옴}명{계수}",
    "숫자_공유계수": " · 1건당 {계수}명",
    "숫자_서신":    "서신 {클릭}건 클릭 → {확인}건 받을게 → {발행}건 발행",
    "숫자_서신실패": " · 실패 {실패}건",
    "숫자_각인":    "각인 {클릭}건 클릭 → {열람}건 열람{읽음}",
    "숫자_궁합":    "궁합 {클릭}건 클릭 → {실행}건 실행 → {재사용}건 다시{읽음}",
    # 여는 것과 읽는 것은 다르다. 9,900원짜리 문서를 두 줄 보고 닫았는지 끝까지 내렸는지가
    # "값을 하는가"에 대한 지금 유일한 답이다(별점은 아직 안 붙였다).
    "숫자_읽음":    " · 평균 {비율}% 읽음",
    "숫자_원가":    "AI 원가 약 {원}원 · 1인 {인당}원",

    # ── 코멘트: 해당하는 것만 • 로 붙는다 ──
    "말_실패원인":  "실패 이유는 {원인}입니다. 그만큼 사람들이 답을 못 받고 나갔다는 뜻이라 제일 먼저 봐야 합니다.",
    "말_이탈지점":  "{화면} 화면에서 {인원}명이 빠져나갔습니다. 어제 사람을 가장 많이 잃은 곳입니다. 이 화면을 줄이거나 순서를 바꾸는 걸 생각해볼 만합니다.",
    "말_STOP없음":  "어제 'STOP(하지 마)' 판결이 하나도 없었습니다. 망설일 때 딱 잘라 말해주는 게 비나리인데, 정작 말리는 법이 없는 셈입니다. 데이터가 좀 더 쌓이면 판결 기준을 손볼지 정해야 합니다.",
    "말_서신실패":  "서신 발행이 {실패}건 실패했습니다. 돈 받는 물건이라 판결 실패보다 급합니다. 바로 확인이 필요합니다.",
    "말_문서실패":  "각인·궁합 문서가 {실패}건 만들어지지 않았습니다. 값을 매길 물건이라 판결 실패와 같은 급으로 봐야 합니다. 바로 확인이 필요합니다.",
    "말_안읽힘":    "{문서}을 연 사람들이 평균 {비율}%에서 멈췄습니다. 문서는 나오는데 안 읽히는 상태라, 길이나 앞부분 구성을 의심해볼 자리입니다.",
    "말_서신유보":  "서신은 아직 눌린 횟수가 적어 돈 낼 사람이 있는지 판단하기 이릅니다. 계속 지켜보겠습니다.",
    "말_서신판정":  "서신이 300번 넘게 노출됐습니다. 이제 돈 낼 사람이 있는지 판단할 수 있는 시점입니다.",

    # ── 어제 앱에 반영된 것 ──
    "변경_제목":    "📦 어제 앱에 반영된 것",
    "변경_없음":    "",                      # 변경이 없으면 섹션 자체를 안 넣는다

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


KST_TZ = datetime.timezone(datetime.timedelta(hours=9))


def yesterday_kst():
    """리포트가 다루는 날 = 한국 날짜로 어제. 데이터를 못 가져왔을 때 제목에 쓴다."""
    return (datetime.datetime.now(KST_TZ) - datetime.timedelta(days=1)).date()


def app_changes(cfg, day):
    """어제(KST) 앱에 실제로 반영된 변경을 가져온다.

    커밋 전부가 아니라 유저에게 닿는 경로(app/src·public·api)를 건드린 것만 본다.
    2026-07-28 실측: main 커밋 38건 중 머지 9 · 앱 15 · 문서와 도구 14였다.
    전부 나열하면 읽히지 않으므로 앱에 닿은 것만, 그것도 6건까지만 싣는다.
    토큰이 없으면 조용히 건너뛴다 — 리포트 본체가 이것 때문에 죽으면 안 된다."""
    tok, repo = cfg.get("GITHUB_TOKEN"), cfg.get("GITHUB_REPO")
    if not tok or not repo:
        return []
    since = f"{day}T00:00:00+09:00"
    until = f"{day}T23:59:59+09:00"
    seen, out = set(), []
    for path in ("app/src", "app/public", "app/api"):
        url = (f"https://api.github.com/repos/{repo}/commits"
               f"?sha=main&path={path}&since={since}&until={until}&per_page=30")
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json",
            "User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                rows = json.loads(r.read().decode("utf-8"))
        except Exception:
            continue                                   # 조회 실패는 리포트를 막지 않는다
        for c in rows:
            sha = c.get("sha")
            if sha in seen:
                continue
            seen.add(sha)
            title = (c.get("commit", {}).get("message") or "").strip().splitlines()
            if not title:
                continue
            t = title[0].strip()
            if t.startswith("Merge ") or t.startswith("정리:"):
                continue                               # 머지·잡정리는 팀이 알 필요가 없다
            out.append((c.get("commit", {}).get("committer", {}).get("date", ""), t))
    out.sort(reverse=True)
    return [t for _, t in out][:6]


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
        return say("제목", 날짜=kdate(yesterday_kst())) + "\n" + MSG["데이터없음"]

    keys = ["d", "people", "visits", "ob_start", "ob_done", "asked", "verdicts",
            "failed", "rated", "letter", "letter_yes", "letter_made", "letter_err",
            "imprint", "imprint_open", "imprint_read",
            "match_c", "match_run", "match_again", "match_read", "doc_err",
            "shared", "share_in", "tokens", "in_people", "in_verdicts"]
    t = dict(zip(keys, rows[0]))
    p = dict(zip(keys, rows[1])) if len(rows) > 1 else {}

    L = [say("제목", 날짜=kdate(t["d"]))]

    # ── 총평: 이슈 유무를 한 문장으로 먼저 알린다 ──
    if t["failed"]:
        L.append(say("총평_실패", 질문=t["asked"], 실패=t["failed"]))
    elif t["asked"] == 0:
        L.append(say("총평_유입없음"))
    elif t["people"] == 0:
        L.append(say("총평_내부만"))
    else:
        L.append(say("총평_정상", 질문=t["asked"]))

    # ── 데이터 요약: 숫자는 여기 몰아넣는다 ──
    dirs = {str(r[0]): r[1] for r in hogql(cfg, Q_DIR)} if t["verdicts"] else {}
    tv = sum(dirs.values()) or t["verdicts"]
    go, hold, stop = dirs.get("GO", 0), dirs.get("HOLD", 0), dirs.get("STOP", 0)
    per = say("숫자_일인당", 일인당=round(t["visits"] / t["people"], 1)) if t["people"] else ""

    D = ["```",
         say("숫자_사람", 외부=t["people"], 외부증감=delta(t["people"], p.get("people"))),
         say("숫자_방문", 방문=t["visits"], 방문증감=delta(t["visits"], p.get("visits")), 일인당=per)]
    if t["ob_start"]:
        D.append(say("숫자_온보딩", 시작=t["ob_start"], 완주=t["ob_done"],
                     완주율=pct(t["ob_done"], t["ob_start"])))
    D.append(say("숫자_판결", 질문=t["asked"], 판결=t["verdicts"],
                 판결증감=delta(t["verdicts"], p.get("verdicts")))
             + (say("숫자_실패", 실패=t["failed"]) if t["failed"] else ""))
    if t["verdicts"]:
        D.append(say("숫자_방향", GO=go, HOLD=hold, HOLD비율=pct(hold, tv), STOP=stop))
        D.append(say("숫자_반응", 평가=t["rated"], 평가율=pct(t["rated"], t["verdicts"])))
    # 공유는 보낸 수가 아니라 '그걸로 들어온 사람'이 성장 축이다 — G3 게이트(공유발 유입)의 분자
    if t["shared"] or t["share_in"]:
        k = (say("숫자_공유계수", 계수=round(t["share_in"] / t["shared"], 1))
             if t["shared"] and t["share_in"] else "")
        D.append(say("숫자_공유유입", 보냄=t["shared"], 들어옴=t["share_in"], 계수=k))
    # 유료 상품 두 개는 각자 한 줄을 갖는다 — 돈이 오가는 자리라 클릭만 세면 안 된다
    if t["letter"] or t["letter_made"]:
        D.append(say("숫자_서신", 클릭=t["letter"], 확인=t["letter_yes"], 발행=t["letter_made"])
                 + (say("숫자_서신실패", 실패=t["letter_err"]) if t["letter_err"] else ""))
    if t["imprint"]:
        D.append(say("숫자_각인", 클릭=t["imprint"], 열람=t["imprint_open"],
                     읽음=say("숫자_읽음", 비율=t["imprint_read"]) if t["imprint_read"] else ""))
    if t["match_c"]:
        D.append(say("숫자_궁합", 클릭=t["match_c"], 실행=t["match_run"], 재사용=t["match_again"],
                     읽음=say("숫자_읽음", 비율=t["match_read"]) if t["match_read"] else ""))
    if t["tokens"]:
        # 대략치다. 정확한 단가는 모델·티어마다 다르니 '약' 으로 적는다.
        won = round(t["tokens"] / 1000 * 4)          # 1,000토큰 ≈ 4원 (sonnet 급 입출력 평균)
        D.append(say("숫자_원가", 원=f"{won:,}", 인당=round(won / t["people"]) if t["people"] else 0))
    if t["in_people"] or t["in_verdicts"]:
        D.append(say("숫자_내부", 내부=t["in_people"], 내부판결=t["in_verdicts"]))
    D.append("```")
    L += [""] + [d for d in D if d]

    # ── 코멘트: 숫자 반복 없이 '무엇을 할 것인가'만 ──
    notes = []
    if t["letter_err"]:
        notes.append(say("말_서신실패", 실패=t["letter_err"]))
    # 각인·궁합이 안 나오는 사고는 여태 화면에만 뜨고 우리한테는 안 왔다. 이제 온다.
    if t["doc_err"]:
        notes.append(say("말_문서실패", 실패=t["doc_err"]))
    # 열리기는 하는데 아무도 안 읽는 상태 — 사고보다 조용하고 더 나쁘다
    if t["imprint_open"] >= 5 and t["imprint_read"] and t["imprint_read"] < 40:
        notes.append(say("말_안읽힘", 문서="각인", 비율=t["imprint_read"]))
    if t["match_run"] >= 5 and t["match_read"] and t["match_read"] < 40:
        notes.append(say("말_안읽힘", 문서="궁합", 비율=t["match_read"]))

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

    changes = app_changes(cfg, t["d"])
    if changes and MSG.get("변경_제목"):
        L += ["", MSG["변경_제목"]] + [f"• {c}" for c in changes]

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
