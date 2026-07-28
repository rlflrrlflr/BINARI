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


def post_json(url, payload, headers=None, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json", **(headers or {})})
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
Q_DAILY = """
SELECT
    toDate(timestamp)                                   AS d,
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
WHERE timestamp >= today() - 2 AND event NOT LIKE '$%'
GROUP BY d ORDER BY d DESC LIMIT 3
"""

Q_DIR = """
SELECT properties.dir AS dir, count() AS n
FROM events
WHERE timestamp >= today() - 1 AND timestamp < today() AND event = 'verdict_shown'
GROUP BY dir ORDER BY n DESC
"""

# 실패는 원인을 알아야 손을 쓴다. rate_limited 면 RL_MAX, origin_blocked 면 허용목록 문제다.
Q_FAIL = """
SELECT properties.reason AS reason, count() AS n
FROM events
WHERE timestamp >= today() - 1 AND timestamp < today() AND event = 'verdict_failed'
GROUP BY reason ORDER BY n DESC
"""

# 온보딩에서 어느 화면이 사람을 가장 많이 잃는가
Q_ONBOARD = """
SELECT properties.step AS step, uniq(person_id) AS u
FROM events
WHERE timestamp >= today() - 1 AND timestamp < today() AND event = 'onboard_step'
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
        return ("비나리 데일리 리포트\n"
                "전일 자 데이터가 조회되지 않습니다. 배포 상태 및 계측 연결 확인이 필요합니다.")

    keys = ["d", "people", "internal_people", "visits", "ob_start", "ob_done",
            "asked", "verdicts", "failed", "rated", "letter", "letter_yes", "shared"]
    t = dict(zip(keys, rows[0]))
    p = dict(zip(keys, rows[1])) if len(rows) > 1 else {}

    L = ["비나리 데일리 리포트", f"전일 자({t['d']}) 비나리 데일리 리포트 공유드립니다!"]

    # ── 총평: 이슈 유무를 먼저 판단해 알린다 ──
    if t["failed"]:
        L.append(f"판결 {t['asked']}건 중 {t['failed']}건이 응답에 실패하여 운영 이슈 확인되었습니다. "
                 "해당 건은 유저가 판결을 받지 못하고 이탈한 것으로, 우선 확인이 필요합니다.")
    elif t["asked"] == 0:
        L.append("전일 질문이 한 건도 발생하지 않았습니다. 유입 경로부터 점검이 필요할 것으로 판단됩니다.")
    else:
        L.append(f"질문 {t['asked']}건 전부 판결까지 정상 응답하여 운영 이슈 없는 것으로 확인됩니다.")

    if t["people"] == 0 and t["internal_people"]:
        L.append("다만 전일 활동이 전부 내부(팀·지인) 트래픽이라 제품 판단에는 쓰기 어렵습니다.")

    # ── 유입·재방문 ──
    seg = [f"유입의 경우, 외부 사용자 {t['people']}명{delta(t['people'], p.get('people'))} · "
           f"방문 {t['visits']}회{delta(t['visits'], p.get('visits'))} 기록하였습니다."]
    if t["people"]:
        per = round(t["visits"] / t["people"], 1)
        seg.append(f"1인당 {per}회 방문으로, "
                   + ("재방문 습관이 형성되는 흐름으로 보입니다."
                      if per >= 2 else "아직 재방문까지는 이어지지 않고 있습니다."))
    if t["internal_people"]:
        seg.append(f"내부 {t['internal_people']}명은 지표에서 제외 대상입니다.")
    L += ["", " ".join(seg)]

    # ── 온보딩: 최대 이탈 지점을 짚고 조치를 제안한다 ──
    if t["ob_start"]:
        seg = [f"온보딩의 경우, {t['ob_start']}건 시작하여 {t['ob_done']}건 완주"
               f"({pct(t['ob_done'], t['ob_start'])})하였습니다."]
        ob = [(str(r[0]), r[1]) for r in hogql(cfg, Q_ONBOARD)]
        worst, drop = None, 0
        for i in range(1, len(ob)):
            d = ob[i - 1][1] - ob[i][1]
            if d > drop:
                worst, drop = ob[i][0], d
        if worst:
            seg.append(f"{STEP_KO.get(worst, worst)} 화면에서 {drop}명 이탈하여 해당 구간이 "
                       "최대 이탈 지점으로 확인되며, 화면 축소 또는 순서 조정 검토 제안드립니다.")
        L += ["", " ".join(seg)]

    # ── 판결: HOLD 편중을 계속 추적한다 ──
    if t["verdicts"]:
        dirs = {str(r[0]): r[1] for r in hogql(cfg, Q_DIR)}
        tv = sum(dirs.values()) or t["verdicts"]
        go, hold, stop = dirs.get("GO", 0), dirs.get("HOLD", 0), dirs.get("STOP", 0)
        seg = [f"판결은 {t['verdicts']}건{delta(t['verdicts'], p.get('verdicts'))} 발생하였고, "
               f"방향은 GO {go} · HOLD {hold}({pct(hold, tv)}) · STOP {stop}입니다."]
        if stop == 0 and tv >= 5:
            seg.append("STOP이 한 건도 없어 '망설임엔 단언을'이라는 핵심 가치와는 거리가 있는 상황으로, "
                       "표본 누적 후 판결 프롬프트 임계값 조정 검토가 필요해 보입니다.")
        seg.append(f"판결 평가는 {t['rated']}건(평가율 {pct(t['rated'], t['verdicts'])}) 수집되었습니다.")
        L += ["", " ".join(seg)]

    # ── 지불 의사(D4) ──
    if t["verdicts"]:
        seg = [f"서신의 경우, 클릭률 {pct(t['letter'], t['verdicts'])}"
               f"({t['letter']}/{t['verdicts']}) 기록하였습니다."]
        if t["letter"]:
            seg.append(f"이 중 {t['letter_yes']}건이 '받을게'까지 도달"
                       f"(전환 {pct(t['letter_yes'], t['letter'])})하였습니다.")
        seg.append("표본이 충분치 않아 판단은 유보하며 추이 모니터링 지속하겠습니다."
                   if t["verdicts"] < 300 else
                   "노출 300회를 넘겨 지불 의사 판정이 가능한 시점입니다.")
        L += ["", " ".join(seg)]

    # ── 참고 불릿 ──
    notes = []
    if t["failed"]:
        fails = hogql(cfg, Q_FAIL)
        if fails:
            notes.append("실패 원인: " + " · ".join(
                f"{FAIL_KO.get(str(r[0]), str(r[0]))} {r[1]}건" for r in fails))
    if t["shared"]:
        notes.append(f"공유 {t['shared']}건(공유율 {pct(t['shared'], t['verdicts'])})")
    if notes:
        L += [""] + [f"• {n}" for n in notes]

    return "\n".join(L)


def send_discord(cfg, text):
    # 디스코드 메시지 상한 2000자. 넘치면 잘라 보낸다(리포트를 통째로 잃는 것보다 낫다).
    if len(text) > 1900:
        text = text[:1890] + "\n…(생략)"
    post_json(cfg["DISCORD_WEBHOOK_URL"], {"content": text, "allowed_mentions": {"parse": []}})


def main():
    cfg = load_env()
    dry = "--dry" in sys.argv[1:]

    need = ["POSTHOG_API_KEY", "POSTHOG_PROJECT_ID"] + ([] if dry else ["DISCORD_WEBHOOK_URL"])
    missing = [k for k in need if not cfg.get(k)]
    if missing:
        sys.exit(f"설정 누락: {', '.join(missing)}")

    try:
        report = build_report(cfg)
    except urllib.error.HTTPError as e:
        sys.exit(f"PostHog 조회 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}")

    if dry:
        print(report)
        return

    try:
        send_discord(cfg, report)
        print("발송 완료")
    except urllib.error.HTTPError as e:
        sys.exit(f"디스코드 발송 실패 ({e.code}): {e.read().decode('utf-8', 'ignore')[:300]}")


if __name__ == "__main__":
    main()
